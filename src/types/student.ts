import type { Profile } from './auth';
import type { AcademicYear, Batch, BoardClass, Stream } from './academic';

export type StudentStatus = 'active' | 'inactive' | 'transferred' | 'completed';
export type Gender = 'male' | 'female' | 'other';
export type EnrollmentStatus = 'enrolled' | 'promoted' | 'transferred' | 'dropped' | 'completed';

export interface Student {
  id: string;
  profile_id: string;
  admission_number: string;
  date_of_birth: string | null;
  gender: Gender | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relation: string | null;
  emergency_contact: string | null;
  address: string | null;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
}

export interface StudentWithProfile extends Student {
  profile: Pick<Profile, 'full_name' | 'email' | 'phone_number' | 'avatar_url' | 'role' | 'is_active'>;
}

export interface StudentEnrollment {
  id: string;
  student_id: string;
  academic_year_id: string;
  board_class_id: string;
  stream_id: string | null;
  batch_id: string;
  roll_number: string | null;
  enrollment_date: string;
  status: EnrollmentStatus;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentEnrollmentDetail extends StudentEnrollment {
  academic_year?: Pick<AcademicYear, 'id' | 'name' | 'is_active'>;
  board_class?: BoardClass;
  batch?: Pick<Batch, 'id' | 'name' | 'code'>;
  stream?: Pick<Stream, 'id' | 'code' | 'name'> | null;
}

export interface StudentFilters {
  status?: StudentStatus;
  search?: string;
  batchId?: string;
  boardClassId?: string;
  academicYearId?: string;
  limit?: number;
  offset?: number;
}
