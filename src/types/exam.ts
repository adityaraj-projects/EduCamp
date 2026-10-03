/**
 * EduCamp Phase 9: Exam / Test & Result Management Domain Types
 */

export type ExamType =
  | 'unit_test'
  | 'class_test'
  | 'monthly_test'
  | 'midterm'
  | 'terminal'
  | 'final'
  | 'mock_test'
  | 'other';

export type ExamStatus =
  | 'draft'
  | 'scheduled'
  | 'ongoing'
  | 'completed'
  | 'published'
  | 'archived';

export type ExamAttendanceStatus = 'present' | 'absent' | 'exempted';

export type ExamResultStatus =
  | 'pending'
  | 'evaluated'
  | 'passed'
  | 'failed'
  | 'absent'
  | 'exempted';

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  exam_type: ExamType;
  academic_year_id: string;
  board_id: string;
  class_level_id: string;
  stream_id: string | null;
  batch_id: string | null;
  exam_date: string;
  start_time: string | null;
  end_time: string | null;
  status: ExamStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExamSubject {
  id: string;
  exam_id: string;
  subject_id: string;
  max_marks: number;
  passing_marks: number;
  subject_date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamSubjectDetail extends ExamSubject {
  subject?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface ExamDetail extends Exam {
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
  batch?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  exam_subjects?: ExamSubjectDetail[];
}

export interface ExamResult {
  id: string;
  exam_id: string;
  exam_subject_id: string;
  student_id: string;
  enrollment_id: string | null;
  attendance_status: ExamAttendanceStatus;
  obtained_marks: number | null;
  result_status: ExamResultStatus;
  remarks: string | null;
  evaluated_by: string | null;
  evaluated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamResultDetail extends ExamResult {
  student?: {
    id: string;
    admission_number: string;
    profile?: {
      id: string;
      full_name: string;
      email?: string | null;
    };
  };
  exam_subject?: ExamSubjectDetail;
}

export interface StudentSubjectScore {
  exam_subject_id: string;
  subject_name: string;
  subject_code: string;
  max_marks: number;
  passing_marks: number;
  attendance_status: ExamAttendanceStatus;
  obtained_marks: number | null;
  result_status: ExamResultStatus;
  remarks: string | null;
}

export interface StudentExamReport {
  exam_id: string;
  exam_title: string;
  exam_type: ExamType;
  exam_date: string;
  status: ExamStatus;
  board_name?: string;
  class_name?: string;
  batch_name?: string;
  subject_scores: StudentSubjectScore[];
  total_obtained: number | null;
  total_max: number;
  percentage: number | null;
  overall_grade: string | null;
  overall_status: 'PASSED' | 'FAILED' | 'INCOMPLETE' | 'ABSENT' | 'EXEMPTED';
  is_complete: boolean;
}

export interface ExamFilters {
  status?: ExamStatus | 'all';
  exam_type?: ExamType | 'all';
  academic_year_id?: string;
  board_id?: string;
  class_level_id?: string;
  batch_id?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateExamPayload {
  title: string;
  description?: string;
  exam_type: ExamType;
  academic_year_id: string;
  board_id: string;
  class_level_id: string;
  stream_id?: string | null;
  batch_id?: string | null;
  exam_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status?: ExamStatus;
  subjects: {
    subject_id: string;
    max_marks: number;
    passing_marks: number;
    subject_date?: string;
    start_time?: string;
    end_time?: string;
  }[];
}

export interface SaveMarksRowPayload {
  exam_id: string;
  exam_subject_id: string;
  student_id: string;
  enrollment_id?: string | null;
  attendance_status: ExamAttendanceStatus;
  obtained_marks: number | null;
  remarks?: string;
}

export interface ExamTypeOption {
  value: ExamType;
  label: string;
  description: string;
}

export const EXAM_TYPE_OPTIONS: ExamTypeOption[] = [
  { value: 'unit_test', label: 'Unit Test', description: 'Chapter or topic evaluation' },
  { value: 'class_test', label: 'Class Test', description: 'Short periodic classroom assessment' },
  { value: 'monthly_test', label: 'Monthly Test', description: 'End-of-month progress evaluation' },
  { value: 'midterm', label: 'Midterm Examination', description: 'Mid-session comprehensive exam' },
  { value: 'terminal', label: 'Terminal Exam', description: 'Term assessment' },
  { value: 'final', label: 'Final Annual Exam', description: 'Session-ending cumulative examination' },
  { value: 'mock_test', label: 'Mock Board Test', description: 'Simulated board practice examination' },
  { value: 'other', label: 'Other Assessment', description: 'Special or diagnostic test' },
];

export const EXAM_STATUS_OPTIONS: { value: ExamStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: '#F59E0B' },
  { value: 'scheduled', label: 'Scheduled', color: '#3B82F6' },
  { value: 'ongoing', label: 'Ongoing', color: '#8B5CF6' },
  { value: 'completed', label: 'Completed', color: '#6366F1' },
  { value: 'published', label: 'Published', color: '#10B981' },
  { value: 'archived', label: 'Archived', color: '#6B7280' },
];

/**
 * Standard centralized grade calculation
 */
export function calculateGrade(percentage: number | null, isPassed: boolean): string | null {
  if (percentage === null) return null;
  if (!isPassed) return 'F';
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}

export const DEFAULT_PAGE_SIZE = 20;
