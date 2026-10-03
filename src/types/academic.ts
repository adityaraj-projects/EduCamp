/**
 * Academic Master Data Domain Models
 * Represents normalized relational entities for EduCamp
 */

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassLevel {
  id: string;
  class_number: number;
  display_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stream {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardClass {
  id: string;
  board_id: string;
  class_level_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Optional join expansions
  board?: Board;
  class_level?: ClassLevel;
}

export interface Batch {
  id: string;
  academic_year_id: string;
  board_class_id: string;
  stream_id: string | null;
  name: string;
  code: string | null;
  max_capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Optional join expansions
  academic_year?: AcademicYear;
  board_class?: BoardClass;
  stream?: Stream | null;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardClassSubject {
  id: string;
  board_class_id: string;
  subject_id: string;
  stream_id: string | null;
  is_core: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Optional join expansions
  subject?: Subject;
  stream?: Stream | null;
}
