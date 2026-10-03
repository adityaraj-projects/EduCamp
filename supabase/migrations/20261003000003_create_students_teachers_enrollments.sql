-- ====================================================================
-- EduCamp Phase 4 Migration: Students, Teachers & Academic Enrollment
-- ====================================================================

-- 1. Helper Functions for Human-Facing Codes (Admission Number & Employee Code)

-- Generate next admission number in format ADM-YYYY-XXXX
CREATE OR REPLACE FUNCTION public.generate_admission_number(p_prefix TEXT DEFAULT 'ADM')
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_code TEXT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT count(*) + 1 INTO v_count
  FROM public.students
  WHERE admission_number LIKE p_prefix || '-' || v_year || '-%';
  
  v_code := p_prefix || '-' || v_year || '-' || lpad(v_count::text, 4, '0');
  RETURN v_code;
END;
$$ LANGUAGE plpgsql STABLE;

-- Generate next employee code in format TCH-XXXX
CREATE OR REPLACE FUNCTION public.generate_employee_code(p_prefix TEXT DEFAULT 'TCH')
RETURNS TEXT AS $$
DECLARE
  v_count INT;
  v_code TEXT;
BEGIN
  SELECT count(*) + 1 INTO v_count
  FROM public.teachers
  WHERE employee_code LIKE p_prefix || '-%';
  
  v_code := p_prefix || '-' || lpad(v_count::text, 3, '0');
  RETURN v_code;
END;
$$ LANGUAGE plpgsql STABLE;

-- ====================================================================
-- 2. Students Master Table (1-to-1 with profiles)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
  admission_number VARCHAR(50) NOT NULL UNIQUE,
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
  guardian_name VARCHAR(150),
  guardian_phone VARCHAR(20),
  guardian_relation VARCHAR(50),
  emergency_contact VARCHAR(20),
  address TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transferred', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_students_profile_id ON public.students(profile_id);
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON public.students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);

CREATE TRIGGER set_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 3. Teachers Master Table (1-to-1 with profiles)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
  employee_code VARCHAR(50) NOT NULL UNIQUE,
  joining_date DATE,
  designation VARCHAR(100),
  qualification VARCHAR(150),
  specialization VARCHAR(150),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'left')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_teachers_profile_id ON public.teachers(profile_id);
CREATE INDEX IF NOT EXISTS idx_teachers_employee_code ON public.teachers(employee_code);
CREATE INDEX IF NOT EXISTS idx_teachers_status ON public.teachers(status);

CREATE TRIGGER set_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 4. Student Enrollments Table (Historical & Multi-Year Academic Tracking)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  board_class_id UUID NOT NULL REFERENCES public.board_classes(id) ON DELETE RESTRICT,
  stream_id UUID REFERENCES public.streams(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  roll_number VARCHAR(50),
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'promoted', 'transferred', 'dropped', 'completed')),
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Constraint: A student can only have ONE current active enrollment per academic year
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_single_current_enrollment_per_year
  ON public.student_enrollments (student_id, academic_year_id)
  WHERE is_current = true;

-- Indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_academic_year ON public.student_enrollments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_board_class ON public.student_enrollments(board_class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_batch ON public.student_enrollments(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_current ON public.student_enrollments(is_current) WHERE is_current = true;

CREATE TRIGGER set_student_enrollments_updated_at
  BEFORE UPDATE ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Database-Level Consistency Validation for Batch Relationship
CREATE OR REPLACE FUNCTION public.validate_student_enrollment_batch()
RETURNS TRIGGER AS $$
DECLARE
  v_batch RECORD;
BEGIN
  SELECT academic_year_id, board_class_id, stream_id
  INTO v_batch
  FROM public.batches
  WHERE id = NEW.batch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced batch % does not exist', NEW.batch_id;
  END IF;

  IF v_batch.academic_year_id != NEW.academic_year_id THEN
    RAISE EXCEPTION 'Batch academic year (%) does not match enrollment academic year (%)',
      v_batch.academic_year_id, NEW.academic_year_id;
  END IF;

  IF v_batch.board_class_id != NEW.board_class_id THEN
    RAISE EXCEPTION 'Batch board-class (%) does not match enrollment board-class (%)',
      v_batch.board_class_id, NEW.board_class_id;
  END IF;

  IF (v_batch.stream_id IS DISTINCT FROM NEW.stream_id) THEN
    RAISE EXCEPTION 'Batch stream does not match enrollment stream';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_student_enrollment_batch ON public.student_enrollments;
CREATE TRIGGER trg_validate_student_enrollment_batch
  BEFORE INSERT OR UPDATE OF batch_id, academic_year_id, board_class_id, stream_id
  ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.validate_student_enrollment_batch();

-- ====================================================================
-- 5. Teacher Assignments Table (Teacher to Batch & Subject Mapping)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  role VARCHAR(50) NOT NULL DEFAULT 'primary_teacher' CHECK (role IN ('primary_teacher', 'assistant_teacher', 'substitute')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_teacher_assignment UNIQUE (teacher_id, academic_year_id, batch_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_academic_year ON public.teacher_assignments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_batch ON public.teacher_assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_subject ON public.teacher_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_active ON public.teacher_assignments(is_active);

CREATE TRIGGER set_teacher_assignments_updated_at
  BEFORE UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Database-Level Consistency Validation for Teacher Assignments
CREATE OR REPLACE FUNCTION public.validate_teacher_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_batch RECORD;
  v_subject_valid BOOLEAN;
BEGIN
  SELECT academic_year_id, board_class_id, stream_id
  INTO v_batch
  FROM public.batches
  WHERE id = NEW.batch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced batch % does not exist', NEW.batch_id;
  END IF;

  IF v_batch.academic_year_id != NEW.academic_year_id THEN
    RAISE EXCEPTION 'Batch academic year (%) does not match assignment academic year (%)',
      v_batch.academic_year_id, NEW.academic_year_id;
  END IF;

  -- Verify subject is taught in the batch's board-class & stream
  SELECT EXISTS (
    SELECT 1 FROM public.board_class_subjects
    WHERE board_class_id = v_batch.board_class_id
      AND subject_id = NEW.subject_id
      AND is_active = true
      AND (
        v_batch.stream_id IS NULL 
        OR stream_id IS NULL 
        OR stream_id = v_batch.stream_id
      )
  ) INTO v_subject_valid;

  IF NOT v_subject_valid THEN
    RAISE EXCEPTION 'Subject % is not part of the active curriculum for the assigned batch board-class/stream', NEW.subject_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_teacher_assignment ON public.teacher_assignments;
CREATE TRIGGER trg_validate_teacher_assignment
  BEFORE INSERT OR UPDATE OF batch_id, academic_year_id, subject_id
  ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_teacher_assignment();

-- ====================================================================
-- 6. Row Level Security (RLS) Policies
-- ====================================================================

-- 6.1 Students RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Admins: Full management
CREATE POLICY "Admins can manage students"
  ON public.students FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Students: Read own student record
CREATE POLICY "Students can view own student record"
  ON public.students FOR SELECT
  USING (profile_id = auth.uid());

-- Teachers: View active student directory for academic duties
CREATE POLICY "Teachers can view students"
  ON public.students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'::public.user_role AND is_active = true
    )
  );

-- 6.2 Teachers RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Admins: Full management
CREATE POLICY "Admins can manage teachers"
  ON public.teachers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Teachers: View own teacher record
CREATE POLICY "Teachers can view own teacher record"
  ON public.teachers FOR SELECT
  USING (profile_id = auth.uid());

-- Authenticated Users: View active teachers directory
CREATE POLICY "Authenticated users can view active teachers"
  ON public.teachers FOR SELECT
  USING (
    auth.role() = 'authenticated' AND status = 'active'
  );

-- 6.3 Student Enrollments RLS
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

-- Admins: Full management
CREATE POLICY "Admins can manage student enrollments"
  ON public.student_enrollments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Students: View own enrollments history
CREATE POLICY "Students can view own enrollments"
  ON public.student_enrollments FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE profile_id = auth.uid()
    )
  );

-- Teachers: View student enrollments
CREATE POLICY "Teachers can view student enrollments"
  ON public.student_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'::public.user_role AND is_active = true
    )
  );

-- 6.4 Teacher Assignments RLS
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Admins: Full management
CREATE POLICY "Admins can manage teacher assignments"
  ON public.teacher_assignments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Teachers: View own assignments
CREATE POLICY "Teachers can view own assignments"
  ON public.teacher_assignments FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE profile_id = auth.uid()
    )
  );

-- Authenticated Users: View active assignments (e.g. knowing who teaches a batch)
CREATE POLICY "Authenticated users can view active teacher assignments"
  ON public.teacher_assignments FOR SELECT
  USING (
    auth.role() = 'authenticated' AND is_active = true
  );
