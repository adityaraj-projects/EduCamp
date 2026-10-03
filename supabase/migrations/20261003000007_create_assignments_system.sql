-- ====================================================================
-- EduCamp Phase 8 Migration: Production-Grade Assignments & Homework System
-- ====================================================================

-- 1. Configure Supabase Storage Bucket for Assignment Files
-- Private bucket for teacher assignment briefs and student submission attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assignment-files',
  'assignment-files',
  false,
  26214400, -- 25 MB max limit (25 * 1024 * 1024)
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- ====================================================================
-- 2. Assignments Master Table
-- Stores assignment metadata, deadlines, target academic context, and optional briefs
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE RESTRICT,
  class_level_id UUID NOT NULL REFERENCES public.class_levels(id) ON DELETE RESTRICT,
  stream_id UUID REFERENCES public.streams(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.batches(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'published', 'closed', 'archived')
  ),
  due_at TIMESTAMPTZ NOT NULL,
  max_marks NUMERIC(5, 2) CHECK (max_marks IS NULL OR max_marks > 0),
  allow_late_submission BOOLEAN NOT NULL DEFAULT false,
  attachment_path TEXT,
  attachment_file_name VARCHAR(255),
  attachment_file_size BIGINT CHECK (attachment_file_size IS NULL OR attachment_file_size > 0),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure board and class match an active board_classes relationship
  CONSTRAINT fk_assignments_board_class
    FOREIGN KEY (board_id, class_level_id)
    REFERENCES public.board_classes(board_id, class_level_id)
    ON DELETE RESTRICT
);

-- Indexes for high-performance assignment lookups and server-side filtering
CREATE INDEX IF NOT EXISTS idx_assignments_academic_year ON public.assignments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_assignments_board_class ON public.assignments(board_id, class_level_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON public.assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_batch ON public.assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON public.assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_at ON public.assignments(due_at);
CREATE INDEX IF NOT EXISTS idx_assignments_created_at ON public.assignments(created_at DESC);

-- Trigger for assignments updated_at
CREATE TRIGGER set_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 3. Assignment Submissions Table
-- One active submission per student per assignment with grading & feedback
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  enrollment_id UUID REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('pending', 'submitted', 'reviewed', 'late')
  ),
  text_response TEXT,
  attachment_path TEXT,
  attachment_file_name VARCHAR(255),
  attachment_file_size BIGINT CHECK (attachment_file_size IS NULL OR attachment_file_size > 0),
  marks NUMERIC(5, 2) CHECK (marks IS NULL OR marks >= 0),
  feedback TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Enforce exactly one submission record per student per assignment
  CONSTRAINT uq_student_assignment_submission UNIQUE (assignment_id, student_id)
);

-- Performance indexes for submissions
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.assignment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON public.assignment_submissions(submitted_at DESC);

-- Trigger for submissions updated_at
CREATE TRIGGER set_assignment_submissions_updated_at
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 4. Helper Authorization Functions
-- ====================================================================

-- 4.1 Check if teacher or admin is authorized to manage assignment for given academic context
CREATE OR REPLACE FUNCTION public.is_teacher_authorized_for_assignment(
  p_academic_year_id UUID,
  p_board_id UUID,
  p_class_level_id UUID,
  p_subject_id UUID,
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
      AND ta.subject_id = p_subject_id
      AND bc.board_id = p_board_id
      AND bc.class_level_id = p_class_level_id
      AND (p_batch_id IS NULL OR ta.batch_id = p_batch_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4.2 Check if student is actively enrolled and authorized to view given assignment
CREATE OR REPLACE FUNCTION public.can_student_access_assignment(p_assignment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_asgn RECORD;
BEGIN
  SELECT academic_year_id, board_id, class_level_id, stream_id, batch_id, status
  INTO v_asgn
  FROM public.assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND OR v_asgn.status NOT IN ('published', 'closed') THEN
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
      AND se.academic_year_id = v_asgn.academic_year_id
      AND bc.board_id = v_asgn.board_id
      AND bc.class_level_id = v_asgn.class_level_id
      AND (v_asgn.stream_id IS NULL OR se.stream_id = v_asgn.stream_id)
      AND (v_asgn.batch_id IS NULL OR se.batch_id = v_asgn.batch_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ====================================================================
-- 5. Academic Consistency & Assignment Validation Triggers
-- ====================================================================

-- 5.1 Assignment Consistency Validation Trigger
CREATE OR REPLACE FUNCTION public.validate_assignment_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_batch RECORD;
  v_board_class_id UUID;
  v_subject_valid BOOLEAN;
  v_user_role public.user_role;
BEGIN
  -- 1. Validate board_class existence
  SELECT id INTO v_board_class_id
  FROM public.board_classes
  WHERE board_id = NEW.board_id AND class_level_id = NEW.class_level_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board and Class combination does not exist in board_classes master';
  END IF;

  -- 2. Validate subject belongs to this board_class
  SELECT EXISTS (
    SELECT 1
    FROM public.board_class_subjects bcs
    WHERE bcs.board_class_id = v_board_class_id
      AND bcs.subject_id = NEW.subject_id
      AND (NEW.stream_id IS NULL OR bcs.stream_id IS NULL OR bcs.stream_id = NEW.stream_id)
  ) INTO v_subject_valid;

  IF NOT v_subject_valid THEN
    RAISE EXCEPTION 'Subject % is not registered for Board % and Class %',
      NEW.subject_id, NEW.board_id, NEW.class_level_id;
  END IF;

  -- 3. If batch_id is specified, validate batch relationships
  IF NEW.batch_id IS NOT NULL THEN
    SELECT academic_year_id, board_class_id, stream_id
    INTO v_batch
    FROM public.batches
    WHERE id = NEW.batch_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced batch % does not exist', NEW.batch_id;
    END IF;

    IF v_batch.academic_year_id != NEW.academic_year_id THEN
      RAISE EXCEPTION 'Batch academic year does not match assignment academic year';
    END IF;

    IF v_batch.board_class_id != v_board_class_id THEN
      RAISE EXCEPTION 'Batch board_class does not match assignment board and class';
    END IF;

    IF (v_batch.stream_id IS DISTINCT FROM NEW.stream_id) THEN
      RAISE EXCEPTION 'Batch stream does not match assignment stream';
    END IF;
  END IF;

  -- 4. Attachment validation
  IF NEW.attachment_file_name IS NOT NULL THEN
    IF lower(right(NEW.attachment_file_name, 4)) != '.pdf' THEN
      RAISE EXCEPTION 'Assignment attachment must be a PDF document (.pdf)';
    END IF;
  END IF;

  -- 5. Role-specific validation during insert
  IF TG_OP = 'INSERT' THEN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    
    IF v_user_role = 'teacher' THEN
      IF NOT public.is_teacher_authorized_for_assignment(
        NEW.academic_year_id,
        NEW.board_id,
        NEW.class_level_id,
        NEW.subject_id,
        NEW.batch_id
      ) THEN
        RAISE EXCEPTION 'Teacher is not authorized to create assignments for this academic context';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_assignment_consistency ON public.assignments;
CREATE TRIGGER trg_validate_assignment_consistency
  BEFORE INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_assignment_consistency();

-- 5.2 Submission Consistency & Marks Validation Trigger
CREATE OR REPLACE FUNCTION public.validate_submission_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_asgn RECORD;
  v_student_profile_id UUID;
  v_user_role public.user_role;
BEGIN
  -- Fetch parent assignment details
  SELECT id, status, due_at, max_marks, allow_late_submission
  INTO v_asgn
  FROM public.assignments
  WHERE id = NEW.assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced assignment does not exist';
  END IF;

  -- Fetch submitting student's profile_id
  SELECT profile_id INTO v_student_profile_id
  FROM public.students
  WHERE id = NEW.student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced student does not exist';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

  -- Handling Student Submission (INSERT or student update)
  IF v_user_role = 'student' OR (auth.uid() = v_student_profile_id) THEN
    -- Verify student cannot submit for another student
    IF auth.uid() != v_student_profile_id THEN
      RAISE EXCEPTION 'Unauthorized: Student can only submit for their own account';
    END IF;

    -- Verify assignment is in published state
    IF v_asgn.status = 'draft' OR v_asgn.status = 'archived' THEN
      RAISE EXCEPTION 'Cannot submit to an un-published or archived assignment';
    END IF;

    -- Check deadline / late submission rules
    IF now() > v_asgn.due_at THEN
      IF NOT v_asgn.allow_late_submission THEN
        RAISE EXCEPTION 'Assignment deadline has passed and late submissions are not permitted';
      ELSE
        NEW.status := 'late';
      END IF;
    ELSE
      IF NEW.status != 'late' THEN
        NEW.status := 'submitted';
      END IF;
    END IF;

    -- Students are strictly prohibited from manipulating grading and feedback
    IF TG_OP = 'INSERT' THEN
      NEW.marks := NULL;
      NEW.feedback := NULL;
      NEW.reviewed_at := NULL;
      NEW.reviewed_by := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.marks := OLD.marks;
      NEW.feedback := OLD.feedback;
      NEW.reviewed_at := OLD.reviewed_at;
      NEW.reviewed_by := OLD.reviewed_by;
    END IF;

    -- Attachment validation
    IF NEW.attachment_file_name IS NOT NULL THEN
      IF lower(right(NEW.attachment_file_name, 4)) != '.pdf' THEN
        RAISE EXCEPTION 'Submission attachment must be a PDF document (.pdf)';
      END IF;
    END IF;
  END IF;

  -- Handling Teacher / Admin Review (Grading & Feedback)
  IF NEW.marks IS NOT NULL OR NEW.feedback IS NOT NULL THEN
    IF v_user_role NOT IN ('teacher', 'admin') THEN
      RAISE EXCEPTION 'Only faculty members or administrators can evaluate submissions';
    END IF;

    -- Validate marks boundaries
    IF NEW.marks < 0 THEN
      RAISE EXCEPTION 'Marks cannot be negative';
    END IF;

    IF v_asgn.max_marks IS NOT NULL AND NEW.marks > v_asgn.max_marks THEN
      RAISE EXCEPTION 'Assigned marks (%) exceed maximum allowed marks (%)',
        NEW.marks, v_asgn.max_marks;
    END IF;

    NEW.reviewed_at := timezone('utc'::text, now());
    NEW.reviewed_by := auth.uid();
    NEW.status := 'reviewed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_submission_consistency ON public.assignment_submissions;
CREATE TRIGGER trg_validate_submission_consistency
  BEFORE INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_submission_consistency();

-- ====================================================================
-- 6. Row Level Security (RLS) on assignments
-- ====================================================================

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- 6.1 SELECT Policy on assignments
CREATE POLICY "assignments_select_policy"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      -- Teacher who created it or teaches that context
      created_by = auth.uid()
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.teachers t
        JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
        JOIN public.batches b ON b.id = ta.batch_id
        JOIN public.board_classes bc ON bc.id = b.board_class_id
        WHERE t.profile_id = auth.uid()
          AND ta.is_active = true
          AND ta.academic_year_id = assignments.academic_year_id
          AND ta.subject_id = assignments.subject_id
          AND bc.board_id = assignments.board_id
          AND bc.class_level_id = assignments.class_level_id
          AND (assignments.batch_id IS NULL OR ta.batch_id = assignments.batch_id)
      )
    )
    OR (
      -- Active student enrolled in matching academic context
      status IN ('published', 'closed')
      AND EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.student_enrollments se ON se.student_id = s.id
        JOIN public.board_classes bc ON bc.id = se.board_class_id
        WHERE s.profile_id = auth.uid()
          AND se.is_current = true
          AND se.status = 'enrolled'
          AND se.academic_year_id = assignments.academic_year_id
          AND bc.board_id = assignments.board_id
          AND bc.class_level_id = assignments.class_level_id
          AND (assignments.stream_id IS NULL OR se.stream_id = assignments.stream_id)
          AND (assignments.batch_id IS NULL OR se.batch_id = assignments.batch_id)
      )
    )
  );

-- 6.2 INSERT Policy on assignments
CREATE POLICY "assignments_insert_policy"
  ON public.assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_admin() AND created_by = auth.uid())
    OR (
      created_by = auth.uid()
      AND public.is_teacher_authorized_for_assignment(
        academic_year_id,
        board_id,
        class_level_id,
        subject_id,
        batch_id
      )
    )
  );

-- 6.3 UPDATE Policy on assignments
CREATE POLICY "assignments_update_policy"
  ON public.assignments
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      created_by = auth.uid()
      AND public.is_teacher_authorized_for_assignment(
        academic_year_id,
        board_id,
        class_level_id,
        subject_id,
        batch_id
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      created_by = auth.uid()
      AND public.is_teacher_authorized_for_assignment(
        academic_year_id,
        board_id,
        class_level_id,
        subject_id,
        batch_id
      )
    )
  );

-- 6.4 DELETE Policy on assignments
CREATE POLICY "assignments_delete_policy"
  ON public.assignments
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ====================================================================
-- 7. Row Level Security (RLS) on assignment_submissions
-- ====================================================================

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- 7.1 SELECT Policy on assignment_submissions
CREATE POLICY "submissions_select_policy"
  ON public.assignment_submissions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      -- Student can only read their own submission
      EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = assignment_submissions.student_id AND s.profile_id = auth.uid()
      )
    )
    OR (
      -- Authorized teacher reviewing assignment
      EXISTS (
        SELECT 1 FROM public.assignments a
        JOIN public.teachers t ON t.profile_id = auth.uid()
        JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
        JOIN public.batches b ON b.id = ta.batch_id
        JOIN public.board_classes bc ON bc.id = b.board_class_id
        WHERE a.id = assignment_submissions.assignment_id
          AND ta.is_active = true
          AND ta.academic_year_id = a.academic_year_id
          AND ta.subject_id = a.subject_id
          AND bc.board_id = a.board_id
          AND bc.class_level_id = a.class_level_id
          AND (a.batch_id IS NULL OR ta.batch_id = a.batch_id)
      )
    )
  );

-- 7.2 INSERT Policy on assignment_submissions
CREATE POLICY "submissions_insert_policy"
  ON public.assignment_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      -- Submitting student matching authenticated user
      EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = assignment_submissions.student_id AND s.profile_id = auth.uid()
      )
      AND public.can_student_access_assignment(assignment_id)
    )
  );

-- 7.3 UPDATE Policy on assignment_submissions
CREATE POLICY "submissions_update_policy"
  ON public.assignment_submissions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      -- Student updating/resubmitting their own work
      EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = assignment_submissions.student_id AND s.profile_id = auth.uid()
      )
    )
    OR (
      -- Teacher reviewing submissions
      EXISTS (
        SELECT 1 FROM public.assignments a
        JOIN public.teachers t ON t.profile_id = auth.uid()
        JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
        JOIN public.batches b ON b.id = ta.batch_id
        JOIN public.board_classes bc ON bc.id = b.board_class_id
        WHERE a.id = assignment_submissions.assignment_id
          AND ta.is_active = true
          AND ta.academic_year_id = a.academic_year_id
          AND ta.subject_id = a.subject_id
          AND bc.board_id = a.board_id
          AND bc.class_level_id = a.class_level_id
          AND (a.batch_id IS NULL OR ta.batch_id = a.batch_id)
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = assignment_submissions.student_id AND s.profile_id = auth.uid()
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.assignments a
        JOIN public.teachers t ON t.profile_id = auth.uid()
        JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
        JOIN public.batches b ON b.id = ta.batch_id
        JOIN public.board_classes bc ON bc.id = b.board_class_id
        WHERE a.id = assignment_submissions.assignment_id
          AND ta.is_active = true
          AND ta.academic_year_id = a.academic_year_id
          AND ta.subject_id = a.subject_id
          AND bc.board_id = a.board_id
          AND bc.class_level_id = a.class_level_id
          AND (a.batch_id IS NULL OR ta.batch_id = a.batch_id)
      )
    )
  );

-- 7.4 DELETE Policy on assignment_submissions
CREATE POLICY "submissions_delete_policy"
  ON public.assignment_submissions
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ====================================================================
-- 8. Supabase Storage Object Policies (Private Bucket: assignment-files)
-- ====================================================================

DROP POLICY IF EXISTS "assignment_files_storage_select" ON storage.objects;
CREATE POLICY "assignment_files_storage_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (
      public.is_admin()
      OR (
        -- Assignment Brief Attachment: visible to authorized teacher or enrolled student
        EXISTS (
          SELECT 1 FROM public.assignments a
          WHERE a.attachment_path = name
            AND (
              a.created_by = auth.uid()
              OR public.can_student_access_assignment(a.id)
              OR public.is_teacher_authorized_for_assignment(
                a.academic_year_id,
                a.board_id,
                a.class_level_id,
                a.subject_id,
                a.batch_id
              )
            )
        )
      )
      OR (
        -- Student Submission Attachment: visible to student owner or reviewing teacher
        EXISTS (
          SELECT 1 FROM public.assignment_submissions sub
          JOIN public.students s ON s.id = sub.student_id
          WHERE sub.attachment_path = name
            AND (
              s.profile_id = auth.uid()
              OR public.is_admin()
              OR EXISTS (
                SELECT 1 FROM public.assignments a
                JOIN public.teachers t ON t.profile_id = auth.uid()
                JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
                WHERE a.id = sub.assignment_id
                  AND ta.is_active = true
                  AND ta.academic_year_id = a.academic_year_id
                  AND ta.subject_id = a.subject_id
              )
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS "assignment_files_storage_insert" ON storage.objects;
CREATE POLICY "assignment_files_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assignment-files'
    AND (
      public.is_admin()
      -- Active teachers can upload assignment briefs
      OR EXISTS (
        SELECT 1 FROM public.teachers t
        JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
        WHERE t.profile_id = auth.uid() AND ta.is_active = true
      )
      -- Enrolled students can upload submission attachments
      OR EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.student_enrollments se ON se.student_id = s.id
        WHERE s.profile_id = auth.uid() AND se.is_current = true AND se.status = 'enrolled'
      )
    )
  );

DROP POLICY IF EXISTS "assignment_files_storage_delete" ON storage.objects;
CREATE POLICY "assignment_files_storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (
      public.is_admin()
      OR owner = auth.uid()
    )
  );
