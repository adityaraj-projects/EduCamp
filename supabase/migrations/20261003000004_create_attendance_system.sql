-- ====================================================================
-- EduCamp Phase 5 Migration: Production-Grade Attendance System
-- ====================================================================

-- 1. Helper Function: Check if user is an authorized teacher or admin for a batch
CREATE OR REPLACE FUNCTION public.is_teacher_assigned_to_batch(p_batch_id UUID, p_subject_id UUID DEFAULT NULL)
RETURNS boolean AS $$
BEGIN
  -- 1. System administrators are always authorized
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  -- 2. Check if logged-in user is a faculty member assigned to this batch
  RETURN EXISTS (
    SELECT 1
    FROM public.teachers t
    JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
    WHERE t.profile_id = auth.uid()
      AND ta.batch_id = p_batch_id
      AND ta.is_active = true
      AND (p_subject_id IS NULL OR ta.subject_id = p_subject_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ====================================================================
-- 2. Attendance Sessions Table
-- Represents a single daily or subject-specific roll-call event
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Duplicate Prevention at Session Level:
-- Case A: One daily general session per batch per date (where subject_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_sessions_daily_unique
  ON public.attendance_sessions (batch_id, attendance_date)
  WHERE subject_id IS NULL;

-- Case B: One session per batch per subject per date (where subject_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_sessions_subject_unique
  ON public.attendance_sessions (batch_id, subject_id, attendance_date)
  WHERE subject_id IS NOT NULL;

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_batch ON public.attendance_sessions (batch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON public.attendance_sessions (attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_year ON public.attendance_sessions (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher ON public.attendance_sessions (teacher_id);

CREATE TRIGGER set_attendance_sessions_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 3. Attendance Records Table
-- Individual student presence per attendance session
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave')),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_attendance_session_enrollment UNIQUE (attendance_session_id, enrollment_id),
  CONSTRAINT uq_attendance_session_student UNIQUE (attendance_session_id, student_id)
);

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON public.attendance_records (attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON public.attendance_records (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_enrollment ON public.attendance_records (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON public.attendance_records (status);

CREATE TRIGGER set_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 4. Database-Level Relational Consistency Trigger
-- Guarantees students can only be marked in sessions of their enrolled batch
-- ====================================================================

CREATE OR REPLACE FUNCTION public.validate_attendance_record_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  v_session RECORD;
  v_enrollment RECORD;
BEGIN
  -- Fetch session context
  SELECT academic_year_id, batch_id
  INTO v_session
  FROM public.attendance_sessions
  WHERE id = NEW.attendance_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced attendance session does not exist';
  END IF;

  -- Fetch student enrollment context
  SELECT student_id, academic_year_id, batch_id
  INTO v_enrollment
  FROM public.student_enrollments
  WHERE id = NEW.enrollment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced student enrollment does not exist';
  END IF;

  -- Validate student_id matches enrollment
  IF v_enrollment.student_id != NEW.student_id THEN
    RAISE EXCEPTION 'Student ID does not match the referenced enrollment record';
  END IF;

  -- Validate batch matches session
  IF v_enrollment.batch_id != v_session.batch_id THEN
    RAISE EXCEPTION 'Student is not enrolled in the batch of this attendance session';
  END IF;

  -- Validate academic year matches session
  IF v_enrollment.academic_year_id != v_session.academic_year_id THEN
    RAISE EXCEPTION 'Student enrollment academic year does not match session academic year';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_attendance_record_enrollment ON public.attendance_records;
CREATE TRIGGER trg_validate_attendance_record_enrollment
  BEFORE INSERT OR UPDATE OF attendance_session_id, enrollment_id, student_id
  ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_record_enrollment();

-- ====================================================================
-- 5. Atomic Bulk Attendance Submission RPC
-- Transactional, idempotent marking/updating of an entire batch roster
-- ====================================================================

CREATE OR REPLACE FUNCTION public.submit_batch_attendance(
  p_academic_year_id UUID,
  p_batch_id UUID,
  p_attendance_date DATE,
  p_subject_id UUID DEFAULT NULL,
  p_records JSONB DEFAULT '[]'::jsonb,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_teacher_id UUID;
  v_session_id UUID;
  v_rec RECORD;
  v_count INT := 0;
BEGIN
  -- 1. Verify caller authorization
  IF NOT public.is_teacher_assigned_to_batch(p_batch_id, p_subject_id) THEN
    RAISE EXCEPTION 'User is not authorized to submit attendance for this batch or subject';
  END IF;

  -- 2. Determine teacher identifier
  SELECT id INTO v_teacher_id
  FROM public.teachers
  WHERE profile_id = auth.uid()
  LIMIT 1;

  -- If admin is submitting on behalf without teacher profile, resolve assigned teacher or raise
  IF v_teacher_id IS NULL THEN
    IF public.is_admin() THEN
      SELECT teacher_id INTO v_teacher_id
      FROM public.teacher_assignments
      WHERE batch_id = p_batch_id AND (p_subject_id IS NULL OR subject_id = p_subject_id) AND is_active = true
      LIMIT 1;
      
      IF v_teacher_id IS NULL THEN
        SELECT id INTO v_teacher_id FROM public.teachers WHERE status = 'active' LIMIT 1;
      END IF;
    ELSE
      RAISE EXCEPTION 'Teacher profile not found for authenticated user';
    END IF;
  END IF;

  -- 3. Find or Create Attendance Session (Upsert behavior for session)
  IF p_subject_id IS NULL THEN
    SELECT id INTO v_session_id
    FROM public.attendance_sessions
    WHERE batch_id = p_batch_id AND attendance_date = p_attendance_date AND subject_id IS NULL;
  ELSE
    SELECT id INTO v_session_id
    FROM public.attendance_sessions
    WHERE batch_id = p_batch_id AND attendance_date = p_attendance_date AND subject_id = p_subject_id;
  END IF;

  IF v_session_id IS NULL THEN
    INSERT INTO public.attendance_sessions (
      academic_year_id,
      batch_id,
      teacher_id,
      subject_id,
      attendance_date,
      notes
    ) VALUES (
      p_academic_year_id,
      p_batch_id,
      v_teacher_id,
      p_subject_id,
      p_attendance_date,
      p_notes
    ) RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.attendance_sessions
    SET notes = COALESCE(p_notes, notes), updated_at = timezone('utc'::text, now())
    WHERE id = v_session_id;
  END IF;

  -- 4. Process each student record atomically
  FOR v_rec IN 
    SELECT 
      (elem->>'enrollment_id')::uuid AS enrollment_id,
      (elem->>'student_id')::uuid AS student_id,
      (elem->>'status')::varchar AS status,
      (elem->>'remarks')::text AS remarks
    FROM jsonb_array_elements(p_records) AS elem
  LOOP
    INSERT INTO public.attendance_records (
      attendance_session_id,
      enrollment_id,
      student_id,
      status,
      remarks
    ) VALUES (
      v_session_id,
      v_rec.enrollment_id,
      v_rec.student_id,
      v_rec.status,
      v_rec.remarks
    )
    ON CONFLICT (attendance_session_id, enrollment_id) DO UPDATE
    SET
      status = EXCLUDED.status,
      remarks = EXCLUDED.remarks,
      updated_at = timezone('utc'::text, now());

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'records_marked', v_count,
    'attendance_date', p_attendance_date,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 6. Student Attendance Summary RPC
-- Computes aggregated counts and attendance percentage on-the-fly
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_student_attendance_summary(
  p_student_id UUID,
  p_academic_year_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_total INT := 0;
  v_present INT := 0;
  v_absent INT := 0;
  v_late INT := 0;
  v_leave INT := 0;
  v_pct NUMERIC(5, 2) := 0.00;
BEGIN
  -- Ensure security: caller must be admin, teacher, or the student themselves
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher' AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND profile_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied to student attendance summary';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE r.status = 'present'),
    count(*) FILTER (WHERE r.status = 'absent'),
    count(*) FILTER (WHERE r.status = 'late'),
    count(*) FILTER (WHERE r.status = 'leave')
  INTO v_total, v_present, v_absent, v_late, v_leave
  FROM public.attendance_records r
  JOIN public.attendance_sessions s ON s.id = r.attendance_session_id
  WHERE r.student_id = p_student_id
    AND (p_academic_year_id IS NULL OR s.academic_year_id = p_academic_year_id);

  IF v_total > 0 THEN
    -- Formula: ((present + late) / total) * 100
    v_pct := ROUND(((v_present + v_late)::numeric / v_total::numeric) * 100.0, 1);
  END IF;

  RETURN jsonb_build_object(
    'total_classes', v_total,
    'present', v_present,
    'absent', v_absent,
    'late', v_late,
    'leave', v_leave,
    'attendance_percentage', v_pct
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ====================================================================
-- 7. Row Level Security (RLS) Policies
-- ====================================================================

-- 7.1 Attendance Sessions RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view attendance sessions"
  ON public.attendance_sessions FOR SELECT
  USING (
    public.is_admin()
    OR public.is_teacher_assigned_to_batch(batch_id, subject_id)
    OR EXISTS (
      SELECT 1 FROM public.student_enrollments se
      JOIN public.students s ON s.id = se.student_id
      WHERE s.profile_id = auth.uid()
        AND se.batch_id = attendance_sessions.batch_id
    )
  );

CREATE POLICY "Authorized teachers and admins can create attendance sessions"
  ON public.attendance_sessions FOR INSERT
  WITH CHECK (
    public.is_teacher_assigned_to_batch(batch_id, subject_id)
  );

CREATE POLICY "Authorized teachers and admins can update attendance sessions"
  ON public.attendance_sessions FOR UPDATE
  USING (public.is_teacher_assigned_to_batch(batch_id, subject_id))
  WITH CHECK (public.is_teacher_assigned_to_batch(batch_id, subject_id));

CREATE POLICY "Only admins can delete attendance sessions"
  ON public.attendance_sessions FOR DELETE
  USING (public.is_admin());

-- 7.2 Attendance Records RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view attendance records"
  ON public.attendance_records FOR SELECT
  USING (
    public.is_admin()
    OR student_id IN (
      SELECT id FROM public.students WHERE profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_records.attendance_session_id
        AND public.is_teacher_assigned_to_batch(s.batch_id, s.subject_id)
    )
  );

CREATE POLICY "Authorized teachers and admins can create attendance records"
  ON public.attendance_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_records.attendance_session_id
        AND public.is_teacher_assigned_to_batch(s.batch_id, s.subject_id)
    )
  );

CREATE POLICY "Authorized teachers and admins can update attendance records"
  ON public.attendance_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_records.attendance_session_id
        AND public.is_teacher_assigned_to_batch(s.batch_id, s.subject_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_records.attendance_session_id
        AND public.is_teacher_assigned_to_batch(s.batch_id, s.subject_id)
    )
  );

CREATE POLICY "Only admins can delete attendance records"
  ON public.attendance_records FOR DELETE
  USING (public.is_admin());
