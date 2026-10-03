/**
 * EduCamp Phase 10: Communications & Notifications Domain Types
 */

export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export type AnnouncementStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'expired'
  | 'archived';

export type AnnouncementTargetRole = 'all' | 'students' | 'teachers';

export type NotificationType =
  | 'announcement'
  | 'study_material'
  | 'assignment'
  | 'assignment_due'
  | 'exam'
  | 'result'
  | 'system';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  target_role: AnnouncementTargetRole;
  published_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementTarget {
  id: string;
  announcement_id: string;
  academic_year_id: string | null;
  board_id: string | null;
  class_level_id: string | null;
  stream_id: string | null;
  batch_id: string | null;
  subject_id: string | null;
  created_at: string;
}

export interface AnnouncementTargetDetail extends AnnouncementTarget {
  board?: {
    id: string;
    code: string;
    name: string;
  } | null;
  class_level?: {
    id: string;
    class_number: number;
    display_name: string;
  } | null;
  stream?: {
    id: string;
    code: string;
    name: string;
  } | null;
  batch?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  subject?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface AnnouncementDetail extends Announcement {
  creator?: {
    id: string;
    full_name: string;
    role: string;
  } | null;
  targets?: AnnouncementTargetDetail[];
  is_read?: boolean;
  read_at?: string | null;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  announcement_id: string | null;
  notification_type: NotificationType;
  title: string;
  body: string | null;
  priority: AnnouncementPriority;
  action_url: string | null;
  read_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Unified notification item consumed by Notification Center & Bell
 */
export interface NotificationItem {
  id: string;
  source_type: 'announcement' | 'direct';
  announcement_id?: string | null;
  notification_type: NotificationType;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  published_at?: string | null;
  expires_at?: string | null;
  author_name?: string | null;
  target_summary?: string | null;
}

export interface AnnouncementFilters {
  status?: AnnouncementStatus | 'all';
  priority?: AnnouncementPriority | 'all';
  target_role?: AnnouncementTargetRole | 'all';
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface NotificationFilters {
  read_status?: 'all' | 'unread' | 'read';
  priority?: AnnouncementPriority | 'all';
  notification_type?: NotificationType | 'all';
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateAnnouncementPayload {
  title: string;
  body: string;
  priority: AnnouncementPriority;
  target_role: AnnouncementTargetRole;
  published_at?: string | null;
  expires_at?: string | null;
  status?: AnnouncementStatus;
  targets?: {
    academic_year_id?: string | null;
    board_id?: string | null;
    class_level_id?: string | null;
    stream_id?: string | null;
    batch_id?: string | null;
    subject_id?: string | null;
  }[];
}

export interface CreateNotificationPayload {
  user_id: string;
  notification_type: NotificationType;
  title: string;
  body?: string;
  priority?: AnnouncementPriority;
  action_url?: string;
  announcement_id?: string;
  expires_at?: string;
}

export const ANNOUNCEMENT_PRIORITY_OPTIONS: {
  value: AnnouncementPriority;
  label: string;
  color: string;
  badgeBg: string;
  badgeText: string;
}[] = [
  {
    value: 'normal',
    label: 'Normal',
    color: '#6B7280',
    badgeBg: '#F3F4F6',
    badgeText: '#374151',
  },
  {
    value: 'important',
    label: 'Important',
    color: '#F59E0B',
    badgeBg: '#FEF3C7',
    badgeText: '#92400E',
  },
  {
    value: 'urgent',
    label: 'Urgent Alert',
    color: '#EF4444',
    badgeBg: '#FEE2E2',
    badgeText: '#991B1B',
  },
];

export const ANNOUNCEMENT_STATUS_OPTIONS: {
  value: AnnouncementStatus;
  label: string;
  color: string;
}[] = [
  { value: 'draft', label: 'Draft', color: '#F59E0B' },
  { value: 'scheduled', label: 'Scheduled', color: '#3B82F6' },
  { value: 'published', label: 'Published', color: '#10B981' },
  { value: 'expired', label: 'Expired', color: '#9CA3AF' },
  { value: 'archived', label: 'Archived', color: '#6B7280' },
];

export const NOTIFICATION_TYPE_OPTIONS: {
  value: NotificationType;
  label: string;
}[] = [
  { value: 'announcement', label: 'Official Announcement' },
  { value: 'study_material', label: 'Study Material' },
  { value: 'assignment', label: 'Homework / Assignment' },
  { value: 'assignment_due', label: 'Submission Due Reminder' },
  { value: 'exam', label: 'Exam Scheduled' },
  { value: 'result', label: 'Exam Result Published' },
  { value: 'system', label: 'System Notice' },
];

export const DEFAULT_PAGE_SIZE = 20;
