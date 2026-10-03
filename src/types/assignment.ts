/**
 * EduCamp Phase 8: Assignments / Homework & Submission Domain Types
 */

export type AssignmentStatus = 'draft' | 'published' | 'closed' | 'archived';

export type SubmissionStatus = 'pending' | 'submitted' | 'reviewed' | 'late';

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  academic_year_id: string;
  board_id: string;
  class_level_id: string;
  stream_id: string | null;
  subject_id: string;
  batch_id: string | null;
  teacher_id: string;
  status: AssignmentStatus;
  due_at: string;
  max_marks: number | null;
  allow_late_submission: boolean;
  attachment_path: string | null;
  attachment_file_name: string | null;
  attachment_file_size: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AssignmentDetail extends Assignment {
  board?: {
    id: string;
    code: string;
    name: string;
  };
  class_level?: {
    id: string;
    class_number: number;
    display_name: string;
  };
  stream?: {
    id: string;
    code: string;
    name: string;
  } | null;
  subject?: {
    id: string;
    code: string;
    name: string;
  };
  batch?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  teacher?: {
    id: string;
    employee_code: string;
    profile?: {
      id: string;
      full_name: string;
    };
  };
  // Optional summary metrics for teacher view
  submissions_count?: number;
  reviewed_count?: number;
  // Student's own submission if queried in student context
  student_submission?: AssignmentSubmission | null;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  enrollment_id: string | null;
  submitted_at: string;
  status: SubmissionStatus;
  text_response: string | null;
  attachment_path: string | null;
  attachment_file_name: string | null;
  attachment_file_size: number | null;
  marks: number | null;
  feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentSubmissionDetail extends AssignmentSubmission {
  student?: {
    id: string;
    admission_number: string;
    profile?: {
      id: string;
      full_name: string;
      email?: string | null;
    };
  };
  reviewer?: {
    id: string;
    full_name: string;
  } | null;
}

export interface AssignmentFilters {
  status?: AssignmentStatus | 'all';
  subject_id?: string;
  academic_year_id?: string;
  board_id?: string;
  class_level_id?: string;
  batch_id?: string;
  due_status?: 'all' | 'pending' | 'submitted' | 'overdue';
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateAssignmentPayload {
  title: string;
  description?: string;
  academic_year_id: string;
  board_id: string;
  class_level_id: string;
  stream_id?: string | null;
  subject_id: string;
  batch_id?: string | null;
  due_at: string; // ISO 8601 string
  max_marks?: number | null;
  allow_late_submission?: boolean;
  status?: AssignmentStatus;
}

export interface SubmitAssignmentPayload {
  assignment_id: string;
  text_response?: string;
}

export interface ReviewSubmissionPayload {
  submission_id: string;
  marks?: number | null;
  feedback?: string;
}

export const MAX_ASSIGNMENT_FILE_SIZE_BYTES = 26214400; // 25 MB
export const ALLOWED_ASSIGNMENT_MIME_TYPES = ['application/pdf'];
export const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes
export const DEFAULT_PAGE_SIZE = 20;
