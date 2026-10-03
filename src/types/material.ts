/**
 * EduCamp Phase 7: Study Materials & Document Management Domain Types
 */

export type MaterialType =
  | 'notes'
  | 'chapter'
  | 'worksheet'
  | 'question_paper'
  | 'practice'
  | 'other';

export type MaterialStatus = 'active' | 'archived';

export interface StudyMaterial {
  id: string;
  title: string;
  description: string | null;
  material_type: MaterialType;
  academic_year_id: string;
  board_id: string;
  class_level_id: string;
  stream_id: string | null;
  subject_id: string;
  batch_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  uploader_profile_id: string;
  status: MaterialStatus;
  created_at: string;
  updated_at: string;
}

export interface StudyMaterialDetail extends StudyMaterial {
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
  uploader?: {
    id: string;
    full_name: string;
  };
}

export interface MaterialFilters {
  academic_year_id?: string;
  board_id?: string;
  class_level_id?: string;
  subject_id?: string;
  batch_id?: string;
  material_type?: MaterialType | 'all';
  searchQuery?: string;
  status?: MaterialStatus;
  page?: number;
  pageSize?: number;
}

export interface UploadMaterialPayload {
  title: string;
  description?: string;
  material_type: MaterialType;
  academic_year_id: string;
  board_id: string;
  class_level_id: string;
  stream_id?: string | null;
  subject_id: string;
  batch_id?: string | null;
}

export interface MaterialTypeConfig {
  value: MaterialType;
  label: string;
  description: string;
  color: string;
}

export const MATERIAL_TYPE_CONFIGS: MaterialTypeConfig[] = [
  {
    value: 'notes',
    label: 'Lecture Notes',
    description: 'Faculty classroom notes and revision summaries',
    color: '#3B82F6',
  },
  {
    value: 'chapter',
    label: 'Chapter PDF',
    description: 'Complete textbook chapters and module booklets',
    color: '#10B981',
  },
  {
    value: 'worksheet',
    label: 'Worksheet',
    description: 'Graded problem sets and in-class practice exercises',
    color: '#8B5CF6',
  },
  {
    value: 'question_paper',
    label: 'Question Paper',
    description: 'Previous year board exams and sample question banks',
    color: '#F59E0B',
  },
  {
    value: 'practice',
    label: 'Practice Material',
    description: 'Daily practice problems (DPP) and reference drills',
    color: '#EC4899',
  },
  {
    value: 'other',
    label: 'Other Academic Resource',
    description: 'Syllabus guidelines, formula sheets, and reference docs',
    color: '#6B7280',
  },
];

export const MAX_MATERIAL_FILE_SIZE_BYTES = 26214400; // 25 MB
export const ALLOWED_MATERIAL_MIME_TYPES = ['application/pdf'];
export const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes
export const DEFAULT_PAGE_SIZE = 20;
