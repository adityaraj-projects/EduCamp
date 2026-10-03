-- ====================================================================
-- EduCamp Phase 9 Migration: Production-Grade Exam & Result System
-- ====================================================================

-- 1. Exams Master Table
-- Represents an academic examination/test event
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  exam_type VARCHAR(50) NOT NULL CHECK (
    exam_type IN ('unit_test', 'class_test', 'monthly_test', 'midterm', 'terminal', 'final', 'mock_test', 'other')
  ),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE RESTRICT,
  class_level_id UUID NOT NULL REFERENCES public.class_levels(id) ON DELETE RESTRICT,
  stream_id UUID REFERENCES public.streams(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.batches(id) ON DELETE RESTRICT,
  exam_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'scheduled', 'ongoing', 'completed', 'published', 'archived')
  ),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure board and class match an active board_classes relationship
  CONSTRAINT fk_exams_board_class
    FOREIGN KEY (board_id, class_level_id)
    REFERENCES public.board_classes(board_id, class_level_id)
    ON DELETE RESTRICT
);

-- Performance indexes on exams
CREATE INDEX IF NOT EXISTS idx_exams_academic_year ON public.exams(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_exams_board_class ON public.exams(board_id, class_level_id);
CREATE INDEX IF NOT EXISTS idx_exams_batch ON public.exams(batch_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams(status);
CREATE INDEX IF NOT EXISTS idx_exams_exam_date ON public.exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_exams_created_at ON public.exams(created_at DESC);

-- Trigger for exams updated_at
CREATE TRIGGER set_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 2. Exam Subjects Table
-- Defines subjects, maximum marks, passing marks, and schedule per exam
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  max_marks NUMERIC(5, 2) NOT NULL CHECK (max_marks > 0),
  passing_marks NUMERIC(5, 2) NOT NULL CHECK (passing_marks >= 0 AND passing_marks <= max_marks),
  subject_date DATE,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_exam_subject UNIQUE (exam_id, subject_id)
);

-- Indexes on exam_subjects
CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON public.exam_subjects(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_subject ON public.exam_subjects(subject_id);

-- Trigger for exam_subjects updated_at
CREATE TRIGGER set_exam_subjects_updated_at
  BEFORE UPDATE ON public.exam_subjects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 3. Student Exam Results Table
-- Stores individual student subject marks, attendance, remarks, and status
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  exam_subject_id UUID NOT NULL REFERENCES public.exam_subjects(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  enrollment_id UUID REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  attendance_status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (
    attendance_status IN ('present', 'absent', 'exempted')
  ),
  obtained_marks NUMERIC(5, 2) CHECK (obtained_marks IS NULL OR obtained_marks >= 0),
  result_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    result_status IN ('pending', 'evaluated', 'passed', 'failed', 'absent', 'exempted')
  ),
  remarks TEXT,
  evaluated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_exam_subject_student UNIQUE (exam_subject_id, student_id)
);

-- Indexes on exam_results
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON public.exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_subject ON public.exam_results(exam_subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON public.exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_status ON public.exam_results(result_status);

-- Trigger for exam_results updated_at
CREATE TRIGGER set_exam_results_updated_at
  BEFORE UPDATE ON public.exam_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 4. Helper Authorization Functions
-- ====================================================================

-- 4.1 Check if teacher or admin is authorized for an exam academic context
CREATE OR REPLACE FUNCTION public.is_teacher_authorized_for_exam(
  p_academic_year_id UUID,
  p_board_id UUID,
  p_class_level_id UUID,
  p_batch_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.teachers t
    JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
    JOIN public.batches b ON b.id = ta.batch_id
    JOIN public.board_classes bc ON bc.id = b.board_class_id
    WHERE t.profile_id = auth.uid()
      AND ta.is_active = true
      AND ta.academic_year_id = p_academic_year_id
      AND bc.board_id = p_board_id
      AND bc.class_level_id = p_class_level_id
      AND (p_batch_id IS NULL OR ta.batch_id = p_batch_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4.2 Check if student is actively enrolled and eligible for an exam
CREATE OR REPLACE FUNCTION public.can_student_access_exam(p_exam_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_exam RECORD;
BEGIN
  SELECT academic_year_id, board_id, class_level_id, stream_id, batch_id, status
  INTO v_exam
  FROM public.exams
  WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Only published or completed exams are visible to students
  IF v_exam.status NOT IN ('published', 'completed') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.student_enrollments se ON se.student_id = s.id
    JOIN public.board_classes bc ON bc.id = se.board_class_id
    WHERE s.profile_id = auth.uid()
      AND se.is_current = true
      AND se.status = 'enrolled'
      AND se.academic_year_id = v_exam.academic_year_id
      AND bc.board_id = v_exam.board_id
      AND bc.class_level_id = v_exam.class_level_id
      AND (v_exam.stream_id IS NULL OR se.stream_id = v_exam.stream_id)
      AND (v_exam.batch_id IS NULL OR se.batch_id = v_exam.batch_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ====================================================================
-- 5. Consistency & Validation Triggers
-- ====================================================================

-- 5.1 Exam Consistency Trigger
CREATE OR REPLACE FUNCTION public.validate_exam_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_batch RECORD;
  v_board_class_id UUID;
  v_user_role public.user_role;
BEGIN
  -- 1. Validate board_class existence
  SELECT id INTO v_board_class_id
  FROM public.board_classes
  WHERE board_id = NEW.board_id AND class_level_id = NEW.class_level_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board and Class combination does not exist in board_classes master';
  END IF;

  -- 2. If batch_id is specified, validate batch relationships
  IF NEW.batch_id IS NOT NULL THEN
    SELECT academic_year_id, board_class_id, stream_id
    INTO v_batch
    FROM public.batches
    WHERE id = NEW.batch_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced batch % does not exist', NEW.batch_id;
    END IF;

    IF v_batch.academic_year_id != NEW.academic_year_id THEN
      RAISE EXCEPTION 'Batch academic year does not match exam academic year';
    END IF;

    IF v_batch.board_class_id != v_board_class_id THEN
      RAISE EXCEPTION 'Batch board_class does not match exam board and class';
    END IF;

    IF (v_batch.stream_id IS DISTINCT FROM NEW.stream_id) THEN
      RAISE EXCEPTION 'Batch stream does not match exam stream';
    END IF;
  END IF;

  -- 3. Teacher authorization check during insert
  IF TG_OP = 'INSERT' THEN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    IF v_user_role = 'teacher' THEN
      IF NOT public.is_teacher_authorized_for_exam(
        NEW.academic_year_id,
        NEW.board_id,
        NEW.class_level_id,
        NEW.batch_id
      ) THEN
        RAISE EXCEPTION 'Teacher is not authorized to create exams for this academic context';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_exam_consistency ON public.exams;
CREATE TRIGGER trg_validate_exam_consistency
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.validate_exam_consistency();

-- 5.2 Exam Subject Consistency Trigger
CREATE OR REPLACE FUNCTION public.validate_exam_subject_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_exam RECORD;
  v_board_class_id UUID;
  v_subject_valid BOOLEAN;
BEGIN
  -- 1. Fetch exam context
  SELECT board_id, class_level_id, stream_id INTO v_exam
  FROM public.exams
  WHERE id = NEW.exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced exam does not exist';
  END IF;

  SELECT id INTO v_board_class_id
  FROM public.board_classes
  WHERE board_id = v_exam.board_id AND class_level_id = v_exam.class_level_id;

  -- 2. Verify subject belongs to this board_class
  SELECT EXISTS (
    SELECT 1
    FROM public.board_class_subjects bcs
    WHERE bcs.board_class_id = v_board_class_id
      AND bcs.subject_id = NEW.subject_id
      AND (v_exam.stream_id IS NULL OR bcs.stream_id IS NULL OR bcs.stream_id = v_exam.stream_id)
  ) INTO v_subject_valid;

  IF NOT v_subject_valid THEN
    RAISE EXCEPTION 'Subject % is not registered for this Board and Class', NEW.subject_id;
  END IF;

  -- 3. Validate passing marks <= max marks
  IF NEW.passing_marks > NEW.max_marks THEN
    RAISE EXCEPTION 'Passing marks (%) cannot exceed maximum marks (%)',
      NEW.passing_marks, NEW.max_marks;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_exam_subject_consistency ON public.exam_subjects;
CREATE TRIGGER trg_validate_exam_subject_consistency
  BEFORE INSERT OR UPDATE ON public.exam_subjects
  FOR EACH ROW EXECUTE FUNCTION public.validate_exam_subject_consistency();

-- 5.3 Exam Result Marks & Status Consistency Trigger
CREATE OR REPLACE FUNCTION public.validate_exam_result_marks()
RETURNS TRIGGER AS $$
DECLARE
  v_sub RECORD;
  v_user_role public.user_role;
BEGIN
  -- 1. Fetch exam subject configuration
  SELECT max_marks, passing_marks INTO v_sub
  FROM public.exam_subjects
  WHERE id = NEW.exam_subject_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced exam subject configuration does not exist';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Only faculty members or administrators can enter/evaluate exam marks';
  END IF;

  -- 2. Absence & Exemption Handling
  IF NEW.attendance_status = 'absent' THEN
    IF NEW.obtained_marks IS NOT NULL THEN
      RAISE EXCEPTION 'Absent student cannot be assigned obtained marks';
    END IF;
    NEW.result_status := 'absent';
  ELSIF NEW.attendance_status = 'exempted' THEN
    IF NEW.obtained_marks IS NOT NULL THEN
      RAISE EXCEPTION 'Exempted student cannot be assigned obtained marks';
    END IF;
    NEW.result_status := 'exempted';
  ELSE
    -- Present
    IF NEW.obtained_marks IS NULL THEN
      NEW.result_status := 'pending';
    ELSE
      -- Bounds validation
      IF NEW.obtained_marks < 0 THEN
        RAISE EXCEPTION 'Obtained marks cannot be negative';
      END IF;

      IF NEW.obtained_marks > v_sub.max_marks THEN
        RAISE EXCEPTION 'Obtained marks (%) exceed maximum marks (%)',
          NEW.obtained_marks, v_sub.max_marks;
      END IF;

      -- Calculate pass/fail status
      IF NEW.obtained_marks >= v_sub.passing_marks THEN
        NEW.result_status := 'passed';
      ELSE
        NEW.result_status := 'failed';
      END IF;

      NEW.evaluated_at := timezone('utc'::text, now());
      NEW.evaluated_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_exam_result_marks ON public.exam_results;
CREATE TRIGGER trg_validate_exam_result_marks
  BEFORE INSERT OR UPDATE ON public.exam_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_exam_result_marks();

-- ====================================================================
-- 6. Row Level Security (RLS) on exams
-- ====================================================================

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- 6.1 SELECT Policy on exams
CREATE POLICY "exams_select_policy"
  ON public.exams
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      -- Teacher who created it or is assigned to the academic context
      created_by = auth.uid()
      OR public.is_teacher_authorized_for_exam(academic_year_id, board_id, class_level_id, batch_id)
    )
    OR (
      -- Student enrolled in academic context for published/completed exams
      public.can_student_access_exam(id)
    )
  );

-- 6.2 INSERT Policy on exams
CREATE POLICY "exams_insert_policy"
  ON public.exams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_admin() AND created_by = auth.uid())
    OR (
      created_by = auth.uid()
      AND public.is_teacher_authorized_for_exam(academic_year_id, board_id, class_level_id, batch_id)
    )
  );

-- 6.3 UPDATE Policy on exams
CREATE POLICY "exams_update_policy"
  ON public.exams
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      created_by = auth.uid()
      OR public.is_teacher_authorized_for_exam(academic_year_id, board_id, class_level_id, batch_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      created_by = auth.uid()
      OR public.is_teacher_authorized_for_exam(academic_year_id, board_id, class_level_id, batch_id)
    )
  );

-- 6.4 DELETE Policy on exams
CREATE POLICY "exams_delete_policy"
  ON public.exams
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ====================================================================
-- 7. Row Level Security (RLS) on exam_subjects
-- ====================================================================

ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_subjects_select_policy"
  ON public.exam_subjects
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_subjects.exam_id
        AND (
          e.created_by = auth.uid()
          OR public.is_teacher_authorized_for_exam(e.academic_year_id, e.board_id, e.class_level_id, e.batch_id)
          OR public.can_student_access_exam(e.id)
        )
    )
  );

CREATE POLICY "exam_subjects_insert_policy"
  ON public.exam_subjects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_subjects.exam_id
        AND (
          e.created_by = auth.uid()
          OR public.is_teacher_authorized_for_exam(e.academic_year_id, e.board_id, e.class_level_id, e.batch_id)
        )
    )
  );

CREATE POLICY "exam_subjects_update_policy"
  ON public.exam_subjects
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_subjects.exam_id
        AND (
          e.created_by = auth.uid()
          OR public.is_teacher_authorized_for_exam(e.academic_year_id, e.board_id, e.class_level_id, e.batch_id)
        )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_subjects.exam_id
        AND (
          e.created_by = auth.uid()
          OR public.is_teacher_authorized_for_exam(e.academic_year_id, e.board_id, e.class_level_id, e.batch_id)
        )
    )
  );

CREATE POLICY "exam_subjects_delete_policy"
  ON public.exam_subjects
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ====================================================================
-- 8. Row Level Security (RLS) on exam_results
-- ====================================================================

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- 8.1 SELECT Policy:
-- Students can only see their own results IF the exam is published!
-- Teachers can view results for authorized exams.
-- Admins can view all.
CREATE POLICY "exam_results_select_policy"
  ON public.exam_results
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      -- Student reading own result ONLY when exam is published
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.exams e ON e.id = exam_results.exam_id
        WHERE s.id = exam_results.student_id
          AND s.profile_id = auth.uid()
          AND e.status = 'published'
      )
    )
    OR (
      -- Authorized Teacher managing the exam/results
      EXISTS (
        SELECT 1 FROM public.exams e
        WHERE e.id = exam_results.exam_id
          AND (
            e.created_by = auth.uid()
            OR public.is_teacher_authorized_for_exam(e.academic_year_id, e.board_id, e.class_level_id, e.batch_id)
          )
      )
    )
  );

-- 8.2 INSERT Policy on exam_results (Teachers & Admins only)
CREATE POLICY "exam_results_insert_policy"
  ON public.exam_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_results.exam_id
        AND (
          e.created_by = auth.uid()
          OR public.is_teacher_authorized_for_exam(e.academic_year_id, e.board_id, e.class_level_id, e.batch_id)
        )
    )
  );

-- 8.3 UPDATE Policy on exam_results (Teachers & Admins only)
CREATE POLICY "exam_results_update_policy"
  ON public.exam_results
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_results.exam_id
        AND (
          e.created_by = auth.uid()
          OR public.is_teacher_authorized_for_exam(e.academic_year_id, e.board_id, e.class_level_id, e.batch_id)
        )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_results.exam_id
        AND (
          e.created_by = auth.uid()
          OR public.is_teacher_authorized_for_exam(e.academic_year_id, e.board_id, e.class_level_id, e.batch_id)
        )
    )
  );

-- 8.4 DELETE Policy on exam_results (Admins only)
CREATE POLICY "exam_results_delete_policy"
  ON public.exam_results
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );
