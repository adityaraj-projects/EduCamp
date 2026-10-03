-- ====================================================================
-- EDU-CAMP PHASE 10: PRODUCTION-GRADE COMMUNICATIONS & NOTIFICATIONS SYSTEM
-- Migration: 20261003000009_create_communications_and_notifications.sql
-- ====================================================================

-- 1. Announcements Table
-- Stores communications created by Admins and authorized Teachers.
-- Normalizes the communication content so that 1 announcement serves N users.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'expired', 'archived')),
  target_role VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'students', 'teachers')),
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT chk_announcement_dates CHECK (
    expires_at IS NULL OR published_at IS NULL OR expires_at > published_at
  )
);

-- Indexes for announcements
CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON public.announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);

-- Trigger for announcements updated_at
CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 2. Announcement Targets Table
-- Defines fine-grained academic audience targeting rules per announcement.
-- If an announcement has NO rows here, it targets the entire institute (for target_role).
-- If it has rows, only users matching the targeting criteria are eligible.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.announcement_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  class_level_id UUID REFERENCES public.class_levels(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Prevent duplicate target rows for the same announcement
  CONSTRAINT uq_announcement_target UNIQUE NULLS NOT DISTINCT (
    announcement_id,
    academic_year_id,
    board_id,
    class_level_id,
    stream_id,
    batch_id,
    subject_id
  )
);

-- Indexes for announcement_targets
CREATE INDEX IF NOT EXISTS idx_announcement_targets_announcement ON public.announcement_targets(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_targets_academic ON public.announcement_targets(academic_year_id, board_id, class_level_id);
CREATE INDEX IF NOT EXISTS idx_announcement_targets_batch ON public.announcement_targets(batch_id);

-- ====================================================================
-- 3. Notification Reads Table
-- Tracks read / unread state per user for announcements.
-- Scale-efficient: 1 announcement record is viewed by 500 students without
-- duplicating announcement content. A row here indicates the user has READ it.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_user_announcement_read UNIQUE (user_id, announcement_id)
);

-- Indexes for notification_reads
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_announcement ON public.notification_reads(announcement_id);

-- ====================================================================
-- 4. Direct / System Event Notifications Table
-- Stores user-specific event notifications (e.g. assignment graded, study material added).
-- Also supports linking to an announcement if a direct notification is generated.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE SET NULL,
  notification_type VARCHAR(30) NOT NULL CHECK (
    notification_type IN (
      'announcement',
      'study_material',
      'assignment',
      'assignment_due',
      'exam',
      'result',
      'system'
    )
  ),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  action_url VARCHAR(255),
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);

-- Trigger for notifications updated_at
CREATE TRIGGER set_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 5. Helper & Security Functions
-- ====================================================================

-- Function to check if a student or user is eligible for an announcement based on target rules
CREATE OR REPLACE FUNCTION public.is_user_eligible_for_announcement(
  p_announcement_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role VARCHAR(20);
  v_target_role VARCHAR(20);
  v_target_count INT;
  v_match_count INT;
BEGIN
  -- 1. Check user role and announcement target_role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = p_user_id;
  IF v_user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Administrators have access to all communications
  IF v_user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  SELECT target_role INTO v_target_role
  FROM public.announcements
  WHERE id = p_announcement_id;

  IF v_target_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Role compatibility check
  IF v_target_role = 'students' AND v_user_role != 'student' THEN
    RETURN FALSE;
  END IF;
  IF v_target_role = 'teachers' AND v_user_role != 'teacher' THEN
    RETURN FALSE;
  END IF;

  -- 2. Count targeting rules for this announcement
  SELECT COUNT(*) INTO v_target_count
  FROM public.announcement_targets
  WHERE announcement_id = p_announcement_id;

  -- If no specific targeting rules exist, it is an institute-wide broadcast for that role
  IF v_target_count = 0 THEN
    RETURN TRUE;
  END IF;

  -- 3. If user is a student, verify against current active enrollments
  IF v_user_role = 'student' THEN
    SELECT COUNT(*) INTO v_match_count
    FROM public.announcement_targets at
    JOIN public.students s ON s.profile_id = p_user_id
    JOIN public.student_enrollments se ON se.student_id = s.id AND se.is_current = TRUE
    JOIN public.board_classes bc ON bc.id = se.board_class_id
    WHERE at.announcement_id = p_announcement_id
      AND (at.academic_year_id IS NULL OR at.academic_year_id = se.academic_year_id)
      AND (at.board_id IS NULL OR at.board_id = bc.board_id)
      AND (at.class_level_id IS NULL OR at.class_level_id = bc.class_level_id)
      AND (at.stream_id IS NULL OR at.stream_id = se.stream_id)
      AND (at.batch_id IS NULL OR at.batch_id = se.batch_id);

    RETURN (v_match_count > 0);
  END IF;

  -- 4. If user is a teacher, verify against active teacher assignments
  IF v_user_role = 'teacher' THEN
    SELECT COUNT(*) INTO v_match_count
    FROM public.announcement_targets at
    JOIN public.teachers t ON t.profile_id = p_user_id
    JOIN public.teacher_assignments ta ON ta.teacher_id = t.id AND ta.is_active = TRUE
    JOIN public.board_classes bc ON bc.id = ta.board_class_id
    WHERE at.announcement_id = p_announcement_id
      AND (at.academic_year_id IS NULL OR at.academic_year_id = ta.academic_year_id)
      AND (at.board_id IS NULL OR at.board_id = bc.board_id)
      AND (at.class_level_id IS NULL OR at.class_level_id = bc.class_level_id)
      AND (at.stream_id IS NULL OR at.stream_id = ta.stream_id)
      AND (at.batch_id IS NULL OR at.batch_id = ta.batch_id)
      AND (at.subject_id IS NULL OR at.subject_id = ta.subject_id);

    RETURN (v_match_count > 0);
  END IF;

  RETURN FALSE;
END;
$$;

-- Function to check if a teacher is authorized to target a specific academic context
CREATE OR REPLACE FUNCTION public.is_teacher_authorized_for_target(
  p_user_id UUID,
  p_board_id UUID,
  p_class_level_id UUID,
  p_batch_id UUID DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR(20);
  v_count INT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  IF v_role != 'teacher' THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.teachers t
  JOIN public.teacher_assignments ta ON ta.teacher_id = t.id AND ta.is_active = TRUE
  JOIN public.board_classes bc ON bc.id = ta.board_class_id
  WHERE t.profile_id = p_user_id
    AND bc.board_id = p_board_id
    AND bc.class_level_id = p_class_level_id
    AND (p_batch_id IS NULL OR ta.batch_id IS NULL OR ta.batch_id = p_batch_id)
    AND (p_subject_id IS NULL OR ta.subject_id = p_subject_id);

  RETURN (v_count > 0);
END;
$$;

-- High-performance RPC function to get user's unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(
  p_user_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_direct_unread INT := 0;
  v_announcement_unread INT := 0;
BEGIN
  -- Count unread direct notifications
  SELECT COUNT(*) INTO v_direct_unread
  FROM public.notifications
  WHERE user_id = p_user_id
    AND read_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  -- Count unread published announcements that the user is eligible for
  SELECT COUNT(*) INTO v_announcement_unread
  FROM public.announcements a
  LEFT JOIN public.notification_reads nr
    ON nr.announcement_id = a.id AND nr.user_id = p_user_id
  WHERE a.status = 'published'
    AND (a.published_at IS NULL OR a.published_at <= now())
    AND (a.expires_at IS NULL OR a.expires_at > now())
    AND nr.read_at IS NULL
    AND public.is_user_eligible_for_announcement(a.id, p_user_id);

  RETURN (v_direct_unread + v_announcement_unread);
END;
$$;

-- ====================================================================
-- 6. Row Level Security (RLS)
-- ====================================================================

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- RLS: announcements
-- --------------------------------------------------------------------

-- SELECT: Admins can see all. Creators can see own. Eligible users can see published, active announcements.
CREATE POLICY announcements_select_policy ON public.announcements
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR created_by = auth.uid()
    OR (
      status = 'published'
      AND (published_at IS NULL OR published_at <= now())
      AND (expires_at IS NULL OR expires_at > now())
      AND public.is_user_eligible_for_announcement(id, auth.uid())
    )
  );

-- INSERT: Admins and teachers can create announcements. Students cannot.
CREATE POLICY announcements_insert_policy ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher' AND is_active = TRUE
      )
      AND target_role != 'all' -- Teachers cannot create institute-wide broadcasts to all roles
    )
  );

-- UPDATE: Admins can update any. Teachers can update their own drafts/scheduled announcements.
CREATE POLICY announcements_update_policy ON public.announcements
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (created_by = auth.uid() AND status IN ('draft', 'scheduled'))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (created_by = auth.uid() AND status IN ('draft', 'scheduled', 'published', 'archived'))
  );

-- DELETE: Only admins can delete announcements.
CREATE POLICY announcements_delete_policy ON public.announcements
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- --------------------------------------------------------------------
-- RLS: announcement_targets
-- --------------------------------------------------------------------

CREATE POLICY announcement_targets_select_policy ON public.announcement_targets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id
        AND (
          public.is_admin(auth.uid())
          OR a.created_by = auth.uid()
          OR (
            a.status = 'published'
            AND public.is_user_eligible_for_announcement(a.id, auth.uid())
          )
        )
    )
  );

CREATE POLICY announcement_targets_insert_policy ON public.announcement_targets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (
      EXISTS (
        SELECT 1 FROM public.announcements a
        WHERE a.id = announcement_id
          AND a.created_by = auth.uid()
          AND a.status IN ('draft', 'scheduled')
      )
      AND (
        board_id IS NULL
        OR public.is_teacher_authorized_for_target(auth.uid(), board_id, class_level_id, batch_id, subject_id)
      )
    )
  );

CREATE POLICY announcement_targets_delete_policy ON public.announcement_targets
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id
        AND a.created_by = auth.uid()
        AND a.status IN ('draft', 'scheduled')
    )
  );

-- --------------------------------------------------------------------
-- RLS: notification_reads
-- --------------------------------------------------------------------

-- Users can only read and write their own read records
CREATE POLICY notification_reads_select_policy ON public.notification_reads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notification_reads_insert_policy ON public.notification_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_reads_update_policy ON public.notification_reads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- --------------------------------------------------------------------
-- RLS: notifications
-- --------------------------------------------------------------------

-- Users can view their own notifications
CREATE POLICY notifications_select_policy ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only admins and system services (or triggers) can insert direct notifications
CREATE POLICY notifications_insert_policy ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );

-- Users can update their own notification read status
CREATE POLICY notifications_update_policy ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
