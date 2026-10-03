import type { AcademicYear, Batch, Subject } from './academic';
import type { StudentWithProfile } from './student';
import type { TeacherWithProfile } from './teacher';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export interface AttendanceSession {
  id: string;
  academic_year_id: string;
  batch_id: string;
  teacher_id: string;
  subject_id: string | null;
  attendance_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSessionDetail extends AttendanceSession {
  batch?: Pick<Batch, 'id' | 'name' | 'code'>;
  subject?: Pick<Subject, 'id' | 'code' | 'name'> | null;
  academic_year?: Pick<AcademicYear, 'id' | 'name' | 'is_active'>;
  teacher?: TeacherWithProfile;
}

export interface AttendanceRecord {
  id: string;
  attendance_session_id: string;
  enrollment_id: string;
  student_id: string;
  status: AttendanceStatus;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecordDetail extends AttendanceRecord {
  student?: StudentWithProfile;
  session?: AttendanceSessionDetail;
}

export interface BatchStudentRosterItem {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  roll_number: string | null;
  status: AttendanceStatus | 'unmarked';
  remarks: string;
}

export interface BatchAttendanceSubmissionPayload {
  academic_year_id: string;
  batch_id: string;
  attendance_date: string;
  subject_id?: string | null;
  records: Array<{
    enrollment_id: string;
    student_id: string;
    status: AttendanceStatus;
    remarks?: string | null;
  }>;
  notes?: string | null;
}

export interface StudentAttendanceSummary {
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  attendance_percentage: number;
}

export interface AttendanceFilters {
  batchId?: string;
  subjectId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  studentId?: string;
  academicYearId?: string;
  limit?: number;
  offset?: number;
}
