import type { Profile } from './auth';
import type { AcademicYear, Batch, Subject } from './academic';

export type TeacherStatus = 'active' | 'inactive' | 'left';
export type TeacherAssignmentRole = 'primary_teacher' | 'assistant_teacher' | 'substitute';

export interface Teacher {
  id: string;
  profile_id: string;
  employee_code: string;
  joining_date: string | null;
  designation: string | null;
  qualification: string | null;
  specialization: string | null;
  status: TeacherStatus;
  created_at: string;
  updated_at: string;
}

export interface TeacherWithProfile extends Teacher {
  profile: Pick<Profile, 'full_name' | 'email' | 'phone_number' | 'avatar_url' | 'role' | 'is_active'>;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  academic_year_id: string;
  batch_id: string;
  subject_id: string;
  role: TeacherAssignmentRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeacherAssignmentDetail extends TeacherAssignment {
  academic_year?: Pick<AcademicYear, 'id' | 'name' | 'is_active'>;
  batch?: Pick<Batch, 'id' | 'name' | 'code'>;
  subject?: Pick<Subject, 'id' | 'code' | 'name'>;
}

export interface TeacherFilters {
  status?: TeacherStatus;
  search?: string;
  batchId?: string;
  subjectId?: string;
  academicYearId?: string;
  limit?: number;
  offset?: number;
}
