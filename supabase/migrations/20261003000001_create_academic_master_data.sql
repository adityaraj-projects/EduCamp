-- ====================================================================
-- EduCamp Phase 3 Migration: Academic Master Data Foundation
-- ====================================================================

-- 1. Helper Function: Check Admin Privilege
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'::public.user_role AND is_active = true
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Academic Years Table
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_academic_year_dates CHECK (end_date > start_date)
);

-- Enforce single active academic year via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_academic_year
  ON public.academic_years (is_active)
  WHERE is_active = true;

CREATE TRIGGER set_academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Educational Boards Master Table
CREATE TABLE IF NOT EXISTS public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER set_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Class Levels Master Table (Classes 1 through 12)
CREATE TABLE IF NOT EXISTS public.class_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_number SMALLINT NOT NULL UNIQUE,
  display_name VARCHAR(50) NOT NULL,
  sort_order SMALLINT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_class_number_range CHECK (class_number BETWEEN 1 AND 12)
);

CREATE TRIGGER set_class_levels_updated_at
  BEFORE UPDATE ON public.class_levels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Streams Master Table (Classes 11 & 12 Specializations)
CREATE TABLE IF NOT EXISTS public.streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER set_streams_updated_at
  BEFORE UPDATE ON public.streams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Board + Class Relationship (e.g. CBSE Class 10)
CREATE TABLE IF NOT EXISTS public.board_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE RESTRICT,
  class_level_id UUID NOT NULL REFERENCES public.class_levels(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_board_class UNIQUE (board_id, class_level_id)
);

CREATE INDEX IF NOT EXISTS idx_board_classes_lookup ON public.board_classes(board_id, class_level_id);

CREATE TRIGGER set_board_classes_updated_at
  BEFORE UPDATE ON public.board_classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. Coaching Sections / Batches
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  board_class_id UUID NOT NULL REFERENCES public.board_classes(id) ON DELETE RESTRICT,
  stream_id UUID REFERENCES public.streams(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50),
  max_capacity INT DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_unique_with_stream
  ON public.batches (academic_year_id, board_class_id, stream_id, name)
  WHERE stream_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_unique_without_stream
  ON public.batches (academic_year_id, board_class_id, name)
  WHERE stream_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_batches_academic_year ON public.batches(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_batches_board_class ON public.batches(board_class_id);

CREATE TRIGGER set_batches_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. Subjects Master Table
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER set_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. Curriculum Mapping: Board Class Subjects
CREATE TABLE IF NOT EXISTS public.board_class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_class_id UUID NOT NULL REFERENCES public.board_classes(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  stream_id UUID REFERENCES public.streams(id) ON DELETE RESTRICT,
  is_core BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bcs_unique_with_stream
  ON public.board_class_subjects (board_class_id, subject_id, stream_id)
  WHERE stream_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bcs_unique_without_stream
  ON public.board_class_subjects (board_class_id, subject_id)
  WHERE stream_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bcs_board_class ON public.board_class_subjects(board_class_id);
CREATE INDEX IF NOT EXISTS idx_bcs_subject ON public.board_class_subjects(subject_id);

CREATE TRIGGER set_board_class_subjects_updated_at
  BEFORE UPDATE ON public.board_class_subjects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 10. Row Level Security (RLS) Policies
-- ====================================================================

-- Academic Years RLS
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public and authenticated users can view active academic years"
  ON public.academic_years FOR SELECT
  USING (true);
CREATE POLICY "Admins can insert academic years"
  ON public.academic_years FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update academic years"
  ON public.academic_years FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete academic years"
  ON public.academic_years FOR DELETE
  USING (public.is_admin());

-- Boards RLS
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public and authenticated users can view boards"
  ON public.boards FOR SELECT
  USING (true);
CREATE POLICY "Admins can manage boards"
  ON public.boards FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Class Levels RLS
ALTER TABLE public.class_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public and authenticated users can view class levels"
  ON public.class_levels FOR SELECT
  USING (true);
CREATE POLICY "Admins can manage class levels"
  ON public.class_levels FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Streams RLS
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public and authenticated users can view streams"
  ON public.streams FOR SELECT
  USING (true);
CREATE POLICY "Admins can manage streams"
  ON public.streams FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Board Classes RLS
ALTER TABLE public.board_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public and authenticated users can view board classes"
  ON public.board_classes FOR SELECT
  USING (true);
CREATE POLICY "Admins can manage board classes"
  ON public.board_classes FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Batches RLS
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view batches"
  ON public.batches FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage batches"
  ON public.batches FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Subjects RLS
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public and authenticated users can view subjects"
  ON public.subjects FOR SELECT
  USING (true);
CREATE POLICY "Admins can manage subjects"
  ON public.subjects FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Board Class Subjects RLS
ALTER TABLE public.board_class_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public and authenticated users can view curriculum subjects"
  ON public.board_class_subjects FOR SELECT
  USING (true);
CREATE POLICY "Admins can manage curriculum subjects"
  ON public.board_class_subjects FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
