import { supabase } from '../lib/supabaseClient';
import type {
  StudyMaterial,
  StudyMaterialDetail,
  MaterialFilters,
  UploadMaterialPayload,
} from '../types/material';
import {
  MAX_MATERIAL_FILE_SIZE_BYTES,
  ALLOWED_MATERIAL_MIME_TYPES,
  SIGNED_URL_TTL_SECONDS,
  DEFAULT_PAGE_SIZE,
} from '../types/material';

export interface PaginatedMaterialsResult {
  data: StudyMaterialDetail[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TeacherAssignmentContext {
  id: string;
  academic_year_id: string;
  batch_id: string;
  subject_id: string;
  academic_year_name: string;
  board_id: string;
  board_name: string;
  class_level_id: string;
  class_name: string;
  stream_id: string | null;
  stream_name: string | null;
  batch_name: string;
  subject_name: string;
}

export interface StudentEnrollmentContext {
  academic_year_id: string;
  board_id: string;
  board_name: string;
  class_level_id: string;
  class_name: string;
  stream_id: string | null;
  batch_id: string;
  batch_name: string;
}

/**
 * Production Study Materials & Document Management Service
 * Strict validation, private bucket signed URLs, and selective relational querying
 */
export const materialService = {
  /**
   * Fetch paginated list of study materials with server-side filtering
   * NOTE: Loads only metadata; binary PDFs are NEVER downloaded here.
   */
  async getMaterials(filters: MaterialFilters = {}): Promise<PaginatedMaterialsResult> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize || DEFAULT_PAGE_SIZE));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase
        .from('study_materials')
        .select(
          `
          id,
          title,
          description,
          material_type,
          file_name,
          storage_path,
          mime_type,
          file_size_bytes,
          status,
          created_at,
          updated_at,
          academic_year_id,
          board_id,
          class_level_id,
          stream_id,
          subject_id,
          batch_id,
          uploader_profile_id,
          board:boards(id, code, name),
          class_level:class_levels(id, class_number, display_name),
          subject:subjects(id, code, name),
          batch:batches(id, name, code),
          stream:streams(id, code, name),
          uploader:profiles!study_materials_uploader_profile_id_fkey(id, full_name)
        `,
          { count: 'exact' }
        );

      // Filtering criteria
      if (filters.status) {
        query = query.eq('status', filters.status);
      } else {
        // Default to active materials
        query = query.eq('status', 'active');
      }

      if (filters.academic_year_id) {
        query = query.eq('academic_year_id', filters.academic_year_id);
      }

      if (filters.board_id) {
        query = query.eq('board_id', filters.board_id);
      }

      if (filters.class_level_id) {
        query = query.eq('class_level_id', filters.class_level_id);
      }

      if (filters.subject_id) {
        query = query.eq('subject_id', filters.subject_id);
      }

      if (filters.batch_id) {
        // Fetch materials specifically for this batch OR materials marked for all batches (batch_id is null)
        query = query.or(`batch_id.eq.${filters.batch_id},batch_id.is.null`);
      }

      if (filters.material_type && filters.material_type !== 'all') {
        query = query.eq('material_type', filters.material_type);
      }

      if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const sanitizedTerm = filters.searchQuery.trim().replace(/[%_]/g, '');
        query = query.or(
          `title.ilike.%${sanitizedTerm}%,description.ilike.%${sanitizedTerm}%`
        );
      }

      // Order by latest created first
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error('[EduCamp MaterialService] getMaterials error:', error.message);
        throw new Error(`Failed to load study materials: ${error.message}`);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: (data as unknown as StudyMaterialDetail[]) || [],
        count: totalCount,
        page,
        pageSize,
        totalPages,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error loading materials';
      console.error('[EduCamp MaterialService] Exception in getMaterials:', msg);
      throw new Error(msg);
    }
  },

  /**
   * Fetch a single study material by ID
   */
  async getMaterialById(id: string): Promise<StudyMaterialDetail | null> {
    try {
      const { data, error } = await supabase
        .from('study_materials')
        .select(
          `
          id,
          title,
          description,
          material_type,
          file_name,
          storage_path,
          mime_type,
          file_size_bytes,
          status,
          created_at,
          updated_at,
          academic_year_id,
          board_id,
          class_level_id,
          stream_id,
          subject_id,
          batch_id,
          uploader_profile_id,
          board:boards(id, code, name),
          class_level:class_levels(id, class_number, display_name),
          subject:subjects(id, code, name),
          batch:batches(id, name, code),
          stream:streams(id, code, name),
          uploader:profiles!study_materials_uploader_profile_id_fkey(id, full_name)
        `
        )
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return (data as unknown as StudyMaterialDetail) || null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve material';
      console.error('[EduCamp MaterialService] getMaterialById error:', msg);
      throw new Error(msg);
    }
  },

  /**
   * Generate a short-lived signed URL to securely open or download a document.
   * Signed URLs expire after 5 minutes and are NEVER stored in the database.
   */
  async getMaterialDownloadUrl(storagePath: string): Promise<string> {
    try {
      if (!storagePath) {
        throw new Error('Storage path is required to generate signed URL');
      }

      const { data, error } = await supabase.storage
        .from('study-materials')
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

      if (error) {
        console.error('[EduCamp MaterialService] createSignedUrl error:', error.message);
        throw new Error(`Authorization failed or file not accessible: ${error.message}`);
      }

      if (!data?.signedUrl) {
        throw new Error('Storage returned empty signed URL');
      }

      return data.signedUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate secure signed URL';
      console.error('[EduCamp MaterialService] getMaterialDownloadUrl exception:', msg);
      throw new Error(msg);
    }
  },

  /**
   * Validate and upload a study material PDF to private Supabase Storage and register database metadata.
   * Employs rollback cleanup if database registration fails.
   */
  async uploadStudyMaterial(
    payload: UploadMaterialPayload,
    file: File,
    uploaderProfileId: string
  ): Promise<StudyMaterial> {
    // 1. Client-side File Validation
    if (!file) {
      throw new Error('No file provided for upload.');
    }

    if (!ALLOWED_MATERIAL_MIME_TYPES.includes(file.type)) {
      throw new Error(
        `Invalid file type (${file.type}). Only PDF documents (.pdf) are supported in this phase.`
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('File must have a valid .pdf extension.');
    }

    if (file.size <= 0) {
      throw new Error('File is empty.');
    }

    if (file.size > MAX_MATERIAL_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(
        `File size (${sizeMB} MB) exceeds maximum allowed limit of 25 MB.`
      );
    }

    // 2. Prepare hierarchical stable storage path
    const materialId = crypto.randomUUID();
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase();

    // Storage path: {academic_year_id}/{board_id}/{class_level_id}/{subject_id}/{material_id}/{filename}
    const storagePath = `${payload.academic_year_id}/${payload.board_id}/${payload.class_level_id}/${payload.subject_id}/${materialId}/${sanitizedFileName}`;

    // 3. Upload to private Supabase Storage bucket
    const { error: uploadError } = await supabase.storage
      .from('study-materials')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf',
      });

    if (uploadError) {
      console.error('[EduCamp MaterialService] Storage upload error:', uploadError.message);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // 4. Create database metadata record
    try {
      const { data: insertedData, error: dbError } = await supabase
        .from('study_materials')
        .insert({
          id: materialId,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          material_type: payload.material_type,
          academic_year_id: payload.academic_year_id,
          board_id: payload.board_id,
          class_level_id: payload.class_level_id,
          stream_id: payload.stream_id || null,
          subject_id: payload.subject_id,
          batch_id: payload.batch_id || null,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: 'application/pdf',
          file_size_bytes: file.size,
          uploader_profile_id: uploaderProfileId,
          status: 'active',
        })
        .select()
        .single();

      if (dbError) {
        // Rollback uploaded file to prevent orphan storage objects
        console.warn(
          '[EduCamp MaterialService] DB insert failed. Rolling back storage file:',
          storagePath
        );
        await supabase.storage.from('study-materials').remove([storagePath]);
        throw new Error(`Database record creation failed: ${dbError.message}`);
      }

      return insertedData as StudyMaterial;
    } catch (dbErr: unknown) {
      // In case of unexpected exception, ensure rollback attempt
      await supabase.storage.from('study-materials').remove([storagePath]).catch(() => {});
      const msg = dbErr instanceof Error ? dbErr.message : 'Failed to register material in database';
      throw new Error(msg);
    }
  },

  /**
   * Soft-archive a study material (removes from active listings while preserving historical documents)
   */
  async archiveStudyMaterial(materialId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('study_materials')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', materialId);

      if (error) {
        throw new Error(error.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive material';
      console.error('[EduCamp MaterialService] archiveStudyMaterial error:', msg);
      throw new Error(msg);
    }
  },

  /**
   * Fetch active teaching assignments for teacher/admin context selection
   */
  async getTeacherAssignments(profileId: string, isAdmin: boolean): Promise<TeacherAssignmentContext[]> {
    try {
      if (isAdmin) {
        // Admin: fetch all active batches with board_class and subjects
        const { data: batches, error } = await supabase
          .from('batches')
          .select(`
            id,
            name,
            academic_year_id,
            academic_year:academic_years(id, name),
            board_class:board_classes(
              id,
              board:boards(id, code, name),
              class_level:class_levels(id, class_number, display_name)
            ),
            stream:streams(id, code, name)
          `)
          .eq('is_active', true);

        if (error) throw new Error(error.message);

        // Fetch subjects
        const { data: subjects } = await supabase.from('subjects').select('id, name, code').eq('is_active', true);

        const list: TeacherAssignmentContext[] = [];
        for (const b of (batches || [])) {
          const bc = (b as any).board_class;
          const ay = (b as any).academic_year;
          const st = (b as any).stream;
          for (const s of (subjects || [])) {
            list.push({
              id: `${b.id}-${s.id}`,
              academic_year_id: b.academic_year_id,
              batch_id: b.id,
              subject_id: s.id,
              academic_year_name: ay?.name || 'Academic Year',
              board_id: bc?.board?.id || '',
              board_name: bc?.board?.name || 'Board',
              class_level_id: bc?.class_level?.id || '',
              class_name: bc?.class_level?.display_name || 'Class',
              stream_id: st?.id || null,
              stream_name: st?.name || null,
              batch_name: b.name,
              subject_name: s.name,
            });
          }
        }
        return list;
      }

      // Teacher: Query teacher_assignments via teacher profile
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (teacherError || !teacher) {
        return [];
      }

      const { data: assignments, error: assignError } = await supabase
        .from('teacher_assignments')
        .select(`
          id,
          academic_year_id,
          batch_id,
          subject_id,
          academic_year:academic_years(id, name),
          batch:batches(
            id,
            name,
            stream:streams(id, code, name),
            board_class:board_classes(
              id,
              board:boards(id, code, name),
              class_level:class_levels(id, class_number, display_name)
            )
          ),
          subject:subjects(id, code, name)
        `)
        .eq('teacher_id', teacher.id)
        .eq('is_active', true);

      if (assignError) throw new Error(assignError.message);

      return (assignments || []).map((a: any) => {
        const bc = a.batch?.board_class;
        return {
          id: a.id,
          academic_year_id: a.academic_year_id,
          batch_id: a.batch_id,
          subject_id: a.subject_id,
          academic_year_name: a.academic_year?.name || 'Current Year',
          board_id: bc?.board?.id || '',
          board_name: bc?.board?.name || 'Board',
          class_level_id: bc?.class_level?.id || '',
          class_name: bc?.class_level?.display_name || 'Class',
          stream_id: a.batch?.stream?.id || null,
          stream_name: a.batch?.stream?.name || null,
          batch_name: a.batch?.name || 'Batch',
          subject_name: a.subject?.name || 'Subject',
        };
      });
    } catch (err: unknown) {
      console.warn('[EduCamp MaterialService] getTeacherAssignments error:', err);
      return [];
    }
  },

  /**
   * Fetch active enrollment context for logged-in student
   */
  async getStudentEnrollment(profileId: string): Promise<StudentEnrollmentContext | null> {
    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (studentError || !student) {
        return null;
      }

      const { data: enrollment, error: enrollError } = await supabase
        .from('student_enrollments')
        .select(`
          academic_year_id,
          board_class_id,
          stream_id,
          batch_id,
          batch:batches(id, name),
          board_class:board_classes(
            board:boards(id, code, name),
            class_level:class_levels(id, class_number, display_name)
          )
        `)
        .eq('student_id', student.id)
        .eq('is_current', true)
        .eq('status', 'enrolled')
        .maybeSingle();

      if (enrollError || !enrollment) {
        return null;
      }

      const bc = (enrollment as any).board_class;
      return {
        academic_year_id: enrollment.academic_year_id,
        board_id: bc?.board?.id || '',
        board_name: bc?.board?.name || 'Board',
        class_level_id: bc?.class_level?.id || '',
        class_name: bc?.class_level?.display_name || 'Class',
        stream_id: enrollment.stream_id,
        batch_id: enrollment.batch_id,
        batch_name: (enrollment as any).batch?.name || 'Batch',
      };
    } catch (err: unknown) {
      console.warn('[EduCamp MaterialService] getStudentEnrollment error:', err);
      return null;
    }
  },
};
