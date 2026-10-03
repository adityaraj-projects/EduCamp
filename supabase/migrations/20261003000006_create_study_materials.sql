-- ====================================================================
-- EduCamp Phase 7 Migration: Production-Grade Study Materials System
-- ====================================================================

-- 1. Configure Supabase Storage Bucket for Study Materials
-- Private bucket with 25MB file size limit and PDF-only restriction
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'study-materials',
  'study-materials',
  false,
  26214400, -- 25 MB max limit (25 * 1024 * 1024)
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- ====================================================================
-- 2. Study Materials Master Table
-- Stores metadata and relational links; binary documents live in Storage
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  material_type VARCHAR(50) NOT NULL CHECK (
    material_type IN ('notes', 'chapter', 'worksheet', 'question_paper', 'practice', 'other')
  ),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE RESTRICT,
  class_level_id UUID NOT NULL REFERENCES public.class_levels(id) ON DELETE RESTRICT,
  stream_id UUID REFERENCES public.streams(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.batches(id) ON DELETE RESTRICT,
  file_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf' CHECK (mime_type = 'application/pdf'),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),
  uploader_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure board and class match an active board_classes relationship
  CONSTRAINT fk_study_materials_board_class
    FOREIGN KEY (board_id, class_level_id)
    REFERENCES public.board_classes(board_id, class_level_id)
    ON DELETE RESTRICT
);

-- ====================================================================
-- 3. Duplicate Prevention & Performance Indexes
-- ====================================================================

-- Prevent duplicate active uploads with identical title & type in the exact same academic/batch context
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_materials_prevent_duplicate
  ON public.study_materials (
    academic_year_id,
    board_id,
    class_level_id,
    subject_id,
    COALESCE(stream_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(batch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    material_type,
    lower(trim(title))
  )
  WHERE status = 'active';

-- Optimized indexes for fast filtering and pagination
CREATE INDEX IF NOT EXISTS idx_study_materials_academic_year ON public.study_materials(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_board_class ON public.study_materials(board_id, class_level_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_subject ON public.study_materials(subject_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_batch ON public.study_materials(batch_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_type ON public.study_materials(material_type);
CREATE INDEX IF NOT EXISTS idx_study_materials_status ON public.study_materials(status);
CREATE INDEX IF NOT EXISTS idx_study_materials_uploader ON public.study_materials(uploader_profile_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_created ON public.study_materials(created_at DESC);

-- Updated_at Trigger
CREATE TRIGGER set_study_materials_updated_at
  BEFORE UPDATE ON public.study_materials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 4. Helper Authorization Functions
-- ====================================================================

-- 4.1 Check if teacher or admin is authorized to manage material for given academic context
CREATE OR REPLACE FUNCTION public.is_teacher_authorized_for_material(
  p_academic_year_id UUID,
  p_board_id UUID,
  p_class_level_id UUID,
  p_subject_id UUID,
  p_batch_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Administrators have universal authorization
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  -- Verify active teacher assignment matches subject, academic year, and board/class
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

-- 4.2 Check if student is actively enrolled and authorized to view given material
CREATE OR REPLACE FUNCTION public.can_student_access_material(p_material_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_mat RECORD;
BEGIN
  SELECT academic_year_id, board_id, class_level_id, stream_id, batch_id, status
  INTO v_mat
  FROM public.study_materials
  WHERE id = p_material_id;

  IF NOT FOUND OR v_mat.status != 'active' THEN
    RETURN false;
  END IF;

  -- Active student enrollment in the matching academic year, board, class, stream and batch
  RETURN EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.student_enrollments se ON se.student_id = s.id
    JOIN public.board_classes bc ON bc.id = se.board_class_id
    WHERE s.profile_id = auth.uid()
      AND se.is_current = true
      AND se.status = 'enrolled'
      AND se.academic_year_id = v_mat.academic_year_id
      AND bc.board_id = v_mat.board_id
      AND bc.class_level_id = v_mat.class_level_id
      AND (v_mat.stream_id IS NULL OR se.stream_id = v_mat.stream_id)
      AND (v_mat.batch_id IS NULL OR se.batch_id = v_mat.batch_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ====================================================================
-- 5. Academic Consistency Validation Trigger
-- ====================================================================

CREATE OR REPLACE FUNCTION public.validate_study_material_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_batch RECORD;
  v_board_class_id UUID;
  v_subject_valid BOOLEAN;
  v_user_role public.user_role;
BEGIN
  -- 1. Validate file extension matches PDF requirement
  IF lower(right(NEW.file_name, 4)) != '.pdf' THEN
    RAISE EXCEPTION 'File % must have a valid .pdf extension', NEW.file_name;
  END IF;

  -- 2. Validate MIME type
  IF NEW.mime_type != 'application/pdf' THEN
    RAISE EXCEPTION 'MIME type must be application/pdf';
  END IF;

  -- 3. Find corresponding board_class_id
  SELECT id INTO v_board_class_id
  FROM public.board_classes
  WHERE board_id = NEW.board_id AND class_level_id = NEW.class_level_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board and Class combination does not exist in board_classes master';
  END IF;

  -- 4. Validate subject belongs to this board_class
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

  -- 5. If batch_id is specified, validate that batch belongs to the academic year and board_class
  IF NEW.batch_id IS NOT NULL THEN
    SELECT academic_year_id, board_class_id, stream_id
    INTO v_batch
    FROM public.batches
    WHERE id = NEW.batch_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced batch % does not exist', NEW.batch_id;
    END IF;

    IF v_batch.academic_year_id != NEW.academic_year_id THEN
      RAISE EXCEPTION 'Batch academic year does not match material academic year';
    END IF;

    IF v_batch.board_class_id != v_board_class_id THEN
      RAISE EXCEPTION 'Batch board_class does not match material board and class';
    END IF;

    IF (v_batch.stream_id IS DISTINCT FROM NEW.stream_id) THEN
      RAISE EXCEPTION 'Batch stream does not match material stream';
    END IF;
  END IF;

  -- 6. Role-specific validation during insert
  IF TG_OP = 'INSERT' THEN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    
    IF v_user_role = 'teacher' THEN
      IF NOT public.is_teacher_authorized_for_material(
        NEW.academic_year_id,
        NEW.board_id,
        NEW.class_level_id,
        NEW.subject_id,
        NEW.batch_id
      ) THEN
        RAISE EXCEPTION 'Teacher is not authorized to upload materials for this academic context';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_study_material_consistency ON public.study_materials;
CREATE TRIGGER trg_validate_study_material_consistency
  BEFORE INSERT OR UPDATE ON public.study_materials
  FOR EACH ROW EXECUTE FUNCTION public.validate_study_material_consistency();

-- ====================================================================
-- 6. Database Row Level Security (RLS) on study_materials
-- ====================================================================

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

-- 6.1 SELECT Policy:
-- - Admins: see all (active + archived)
-- - Teachers: see their own uploads OR materials for subjects/batches they are assigned to
-- - Students: see only active materials matching their current active enrollment
CREATE POLICY "study_materials_select_policy"
  ON public.study_materials
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      uploader_profile_id = auth.uid()
    )
    OR (
      -- Teacher assigned to the academic context
      EXISTS (
        SELECT 1
        FROM public.teachers t
        JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
        JOIN public.batches b ON b.id = ta.batch_id
        JOIN public.board_classes bc ON bc.id = b.board_class_id
        WHERE t.profile_id = auth.uid()
          AND ta.is_active = true
          AND ta.academic_year_id = study_materials.academic_year_id
          AND ta.subject_id = study_materials.subject_id
          AND bc.board_id = study_materials.board_id
          AND bc.class_level_id = study_materials.class_level_id
          AND (study_materials.batch_id IS NULL OR ta.batch_id = study_materials.batch_id)
      )
    )
    OR (
      -- Active student enrolled in matching academic context
      status = 'active'
      AND EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.student_enrollments se ON se.student_id = s.id
        JOIN public.board_classes bc ON bc.id = se.board_class_id
        WHERE s.profile_id = auth.uid()
          AND se.is_current = true
          AND se.status = 'enrolled'
          AND se.academic_year_id = study_materials.academic_year_id
          AND bc.board_id = study_materials.board_id
          AND bc.class_level_id = study_materials.class_level_id
          AND (study_materials.stream_id IS NULL OR se.stream_id = study_materials.stream_id)
          AND (study_materials.batch_id IS NULL OR se.batch_id = study_materials.batch_id)
      )
    )
  );

-- 6.2 INSERT Policy:
-- Admins or authorized teachers can create material records
CREATE POLICY "study_materials_insert_policy"
  ON public.study_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_admin() AND uploader_profile_id = auth.uid())
    OR (
      uploader_profile_id = auth.uid()
      AND public.is_teacher_authorized_for_material(
        academic_year_id,
        board_id,
        class_level_id,
        subject_id,
        batch_id
      )
    )
  );

-- 6.3 UPDATE Policy:
-- Admins or the uploading teacher (while authorized) can update metadata / archive
CREATE POLICY "study_materials_update_policy"
  ON public.study_materials
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      uploader_profile_id = auth.uid()
      AND public.is_teacher_authorized_for_material(
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
      uploader_profile_id = auth.uid()
      AND public.is_teacher_authorized_for_material(
        academic_year_id,
        board_id,
        class_level_id,
        subject_id,
        batch_id
      )
    )
  );

-- 6.4 DELETE Policy:
-- Restricted to system administrators only (normal deletion is soft-archive via status)
CREATE POLICY "study_materials_delete_policy"
  ON public.study_materials
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ====================================================================
-- 7. Supabase Storage Object Policies (Private Bucket: study-materials)
-- ====================================================================

-- 7.1 SELECT (Read/Download) Object Policy:
-- Verifies user authorization before allowing signed URL access
DROP POLICY IF EXISTS "study_materials_storage_select" ON storage.objects;
CREATE POLICY "study_materials_storage_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'study-materials'
    AND (
      public.is_admin()
      OR (
        -- Uploader can access their uploaded object
        EXISTS (
          SELECT 1 FROM public.study_materials sm
          WHERE sm.storage_path = name AND sm.uploader_profile_id = auth.uid()
        )
      )
      OR (
        -- Authorized teacher
        EXISTS (
          SELECT 1 FROM public.study_materials sm
          JOIN public.teachers t ON t.profile_id = auth.uid()
          JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
          JOIN public.batches b ON b.id = ta.batch_id
          JOIN public.board_classes bc ON bc.id = b.board_class_id
          WHERE sm.storage_path = name
            AND ta.is_active = true
            AND ta.academic_year_id = sm.academic_year_id
            AND ta.subject_id = sm.subject_id
            AND bc.board_id = sm.board_id
            AND bc.class_level_id = sm.class_level_id
            AND (sm.batch_id IS NULL OR ta.batch_id = sm.batch_id)
        )
      )
      OR (
        -- Enrolled student for active material
        EXISTS (
          SELECT 1 FROM public.study_materials sm
          JOIN public.students s ON s.profile_id = auth.uid()
          JOIN public.student_enrollments se ON se.student_id = s.id
          JOIN public.board_classes bc ON bc.id = se.board_class_id
          WHERE sm.storage_path = name
            AND sm.status = 'active'
            AND se.is_current = true
            AND se.status = 'enrolled'
            AND se.academic_year_id = sm.academic_year_id
            AND bc.board_id = sm.board_id
            AND bc.class_level_id = sm.class_level_id
            AND (sm.stream_id IS NULL OR se.stream_id = sm.stream_id)
            AND (sm.batch_id IS NULL OR se.batch_id = sm.batch_id)
        )
      )
    )
  );

-- 7.2 INSERT (Upload) Object Policy:
-- Admins and active assigned teachers can upload objects into study-materials
DROP POLICY IF EXISTS "study_materials_storage_insert" ON storage.objects;
CREATE POLICY "study_materials_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'study-materials'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.teachers t
        JOIN public.teacher_assignments ta ON ta.teacher_id = t.id
        WHERE t.profile_id = auth.uid()
          AND ta.is_active = true
      )
    )
  );

-- 7.3 DELETE Object Policy:
-- Admins or the file owner/uploader (e.g. for orphan rollback during upload failure)
DROP POLICY IF EXISTS "study_materials_storage_delete" ON storage.objects;
CREATE POLICY "study_materials_storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'study-materials'
    AND (
      public.is_admin()
      OR owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.study_materials sm
        WHERE sm.storage_path = name AND sm.uploader_profile_id = auth.uid()
      )
    )
  );
