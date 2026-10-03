import { supabase } from '../lib/supabaseClient';
import type {
  Assignment,
  AssignmentDetail,
  AssignmentSubmission,
  AssignmentSubmissionDetail,
  AssignmentFilters,
  CreateAssignmentPayload,
  SubmitAssignmentPayload,
  ReviewSubmissionPayload,
} from '../types/assignment';
import {
  MAX_ASSIGNMENT_FILE_SIZE_BYTES,
  ALLOWED_ASSIGNMENT_MIME_TYPES,
  SIGNED_URL_TTL_SECONDS,
  DEFAULT_PAGE_SIZE,
} from '../types/assignment';

export interface PaginatedAssignmentsResult {
  data: AssignmentDetail[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const assignmentService = {
  /**
   * Fetch paginated list of assignments with server-side filtering
   * NOTE: Only relational metadata is loaded; no binary files are downloaded.
   */
  async getAssignments(filters: AssignmentFilters = {}): Promise<PaginatedAssignmentsResult> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize || DEFAULT_PAGE_SIZE));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase
        .from('assignments')
        .select(
          `
          id,
          title,
          description,
          status,
          due_at,
          max_marks,
          allow_late_submission,
          attachment_path,
          attachment_file_name,
          attachment_file_size,
          created_at,
          updated_at,
          academic_year_id,
          board_id,
          class_level_id,
          stream_id,
          subject_id,
          batch_id,
          teacher_id,
          created_by,
          board:boards(id, code, name),
          class_level:class_levels(id, class_number, display_name),
          subject:subjects(id, code, name),
          batch:batches(id, name, code),
          stream:streams(id, code, name),
          teacher:teachers(
            id,
            employee_code,
            profile:profiles(id, full_name)
          )
        `,
          { count: 'exact' }
        );

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
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
        query = query.or(`batch_id.eq.${filters.batch_id},batch_id.is.null`);
      }

      if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const term = filters.searchQuery.trim().replace(/[%_]/g, '');
        query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error('[EduCamp AssignmentService] getAssignments error:', error.message);
        throw new Error(`Failed to load assignments: ${error.message}`);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: (data as unknown as AssignmentDetail[]) || [],
        count: totalCount,
        page,
        pageSize,
        totalPages,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error loading assignments';
      console.error('[EduCamp AssignmentService] Exception in getAssignments:', msg);
      throw new Error(msg);
    }
  },

  /**
   * Fetch single assignment details by ID
   */
  async getAssignmentById(id: string): Promise<AssignmentDetail | null> {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(
          `
          id,
          title,
          description,
          status,
          due_at,
          max_marks,
          allow_late_submission,
          attachment_path,
          attachment_file_name,
          attachment_file_size,
          created_at,
          updated_at,
          academic_year_id,
          board_id,
          class_level_id,
          stream_id,
          subject_id,
          batch_id,
          teacher_id,
          created_by,
          board:boards(id, code, name),
          class_level:class_levels(id, class_number, display_name),
          subject:subjects(id, code, name),
          batch:batches(id, name, code),
          stream:streams(id, code, name),
          teacher:teachers(
            id,
            employee_code,
            profile:profiles(id, full_name)
          )
        `
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return (data as unknown as AssignmentDetail) || null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve assignment';
      console.error('[EduCamp AssignmentService] getAssignmentById error:', msg);
      throw new Error(msg);
    }
  },

  /**
   * Create an assignment (with optional attachment and rollback on failure)
   */
  async createAssignment(
    payload: CreateAssignmentPayload,
    file: File | null,
    teacherProfileId: string
  ): Promise<Assignment> {
    // 1. Fetch teacher record for teacherProfileId
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', teacherProfileId)
      .maybeSingle();

    let teacherId = teacher?.id;
    if (!teacherId) {
      // If user is admin without teacher row, fallback or error
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', teacherProfileId).single();
      if (profile?.role === 'admin') {
        // Find any active teacher or assign admin
        const { data: firstTeacher } = await supabase.from('teachers').select('id').limit(1).maybeSingle();
        teacherId = firstTeacher?.id || '';
      } else {
        throw new Error('Authenticated user does not have a valid faculty profile.');
      }
    }

    const assignmentId = crypto.randomUUID();
    let storagePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    // 2. Validate and upload attachment if provided
    if (file) {
      if (!ALLOWED_ASSIGNMENT_MIME_TYPES.includes(file.type)) {
        throw new Error(`Invalid file type (${file.type}). Only PDF files (.pdf) are permitted.`);
      }
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File must have a valid .pdf extension.');
      }
      if (file.size <= 0) {
        throw new Error('File is empty.');
      }
      if (file.size > MAX_ASSIGNMENT_FILE_SIZE_BYTES) {
        throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 25 MB limit.`);
      }

      fileName = file.name;
      fileSize = file.size;
      const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
      storagePath = `assignments/${payload.academic_year_id}/${assignmentId}/brief/${sanitized}`;

      const { error: uploadError } = await supabase.storage
        .from('assignment-files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/pdf',
        });

      if (uploadError) {
        console.error('[EduCamp AssignmentService] Storage upload error:', uploadError.message);
        throw new Error(`Failed to upload assignment attachment: ${uploadError.message}`);
      }
    }

    // 3. Insert assignment metadata into database
    try {
      const { data, error: dbError } = await supabase
        .from('assignments')
        .insert({
          id: assignmentId,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          academic_year_id: payload.academic_year_id,
          board_id: payload.board_id,
          class_level_id: payload.class_level_id,
          stream_id: payload.stream_id || null,
          subject_id: payload.subject_id,
          batch_id: payload.batch_id || null,
          teacher_id: teacherId,
          status: payload.status || 'draft',
          due_at: payload.due_at,
          max_marks: payload.max_marks || null,
          allow_late_submission: payload.allow_late_submission || false,
          attachment_path: storagePath,
          attachment_file_name: fileName,
          attachment_file_size: fileSize,
          created_by: teacherProfileId,
        })
        .select()
        .single();

      if (dbError) {
        // Rollback uploaded file
        if (storagePath) {
          await supabase.storage.from('assignment-files').remove([storagePath]);
        }
        throw new Error(`Database error: ${dbError.message}`);
      }

      return data as Assignment;
    } catch (err: unknown) {
      if (storagePath) {
        await supabase.storage.from('assignment-files').remove([storagePath]).catch(() => {});
      }
      const msg = err instanceof Error ? err.message : 'Failed to create assignment record';
      throw new Error(msg);
    }
  },

  /**
   * Update assignment status (e.g. publish, close, archive)
   */
  async updateAssignmentStatus(assignmentId: string, status: Assignment['status']): Promise<void> {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', assignmentId);

      if (error) throw new Error(error.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update assignment status';
      console.error('[EduCamp AssignmentService] updateAssignmentStatus error:', msg);
      throw new Error(msg);
    }
  },

  /**
   * Fetch the logged-in student's existing submission for a given assignment
   */
  async getStudentSubmission(assignmentId: string, studentProfileId: string): Promise<AssignmentSubmission | null> {
    try {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', studentProfileId)
        .maybeSingle();

      if (!student) return null;

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', student.id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return (data as AssignmentSubmission) || null;
    } catch (err: unknown) {
      console.warn('[EduCamp AssignmentService] getStudentSubmission error:', err);
      return null;
    }
  },

  /**
   * Submit homework / assignment work (with optional PDF and rollback protection)
   */
  async submitAssignment(
    payload: SubmitAssignmentPayload,
    file: File | null,
    studentProfileId: string
  ): Promise<AssignmentSubmission> {
    // 1. Identify student
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', studentProfileId)
      .maybeSingle();

    if (studentError || !student) {
      throw new Error('Student profile not found.');
    }

    // 2. Fetch current enrollment
    const { data: enrollment } = await supabase
      .from('student_enrollments')
      .select('id, academic_year_id')
      .eq('student_id', student.id)
      .eq('is_current', true)
      .eq('status', 'enrolled')
      .maybeSingle();

    let storagePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    // 3. Validate and upload file if present
    if (file) {
      if (!ALLOWED_ASSIGNMENT_MIME_TYPES.includes(file.type)) {
        throw new Error(`Invalid file type (${file.type}). Only PDF files (.pdf) are permitted.`);
      }
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File must have a valid .pdf extension.');
      }
      if (file.size <= 0) {
        throw new Error('File is empty.');
      }
      if (file.size > MAX_ASSIGNMENT_FILE_SIZE_BYTES) {
        throw new Error(`File size exceeds 25 MB limit.`);
      }

      fileName = file.name;
      fileSize = file.size;
      const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
      storagePath = `assignments/${enrollment?.academic_year_id || 'general'}/${payload.assignment_id}/submissions/${student.id}/${sanitized}`;

      const { error: uploadError } = await supabase.storage
        .from('assignment-files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true, // Allow replacing student's own file on resubmission
          contentType: 'application/pdf',
        });

      if (uploadError) {
        throw new Error(`Failed to upload submission file: ${uploadError.message}`);
      }
    }

    // 4. Insert or update submission row
    try {
      // Check existing submission
      const { data: existing } = await supabase
        .from('assignment_submissions')
        .select('id, attachment_path')
        .eq('assignment_id', payload.assignment_id)
        .eq('student_id', student.id)
        .maybeSingle();

      if (existing) {
        // Resubmission update
        const { data: updated, error: updateError } = await supabase
          .from('assignment_submissions')
          .update({
            text_response: payload.text_response?.trim() || null,
            attachment_path: storagePath || existing.attachment_path,
            attachment_file_name: fileName || undefined,
            attachment_file_size: fileSize || undefined,
            submitted_at: new Date().toISOString(),
            status: 'submitted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw new Error(updateError.message);
        return updated as AssignmentSubmission;
      }

      // Fresh submission insert
      const { data: inserted, error: insertError } = await supabase
        .from('assignment_submissions')
        .insert({
          assignment_id: payload.assignment_id,
          student_id: student.id,
          enrollment_id: enrollment?.id || null,
          text_response: payload.text_response?.trim() || null,
          attachment_path: storagePath,
          attachment_file_name: fileName,
          attachment_file_size: fileSize,
          status: 'submitted',
        })
        .select()
        .single();

      if (insertError) {
        if (storagePath) {
          await supabase.storage.from('assignment-files').remove([storagePath]);
        }
        throw new Error(insertError.message);
      }

      return inserted as AssignmentSubmission;
    } catch (err: unknown) {
      if (storagePath) {
        await supabase.storage.from('assignment-files').remove([storagePath]).catch(() => {});
      }
      const msg = err instanceof Error ? err.message : 'Failed to record assignment submission';
      throw new Error(msg);
    }
  },

  /**
   * Fetch submissions list for an assignment (for teacher grading & review)
   */
  async getSubmissionsForAssignment(assignmentId: string): Promise<AssignmentSubmissionDetail[]> {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(
          `
          id,
          assignment_id,
          student_id,
          enrollment_id,
          submitted_at,
          status,
          text_response,
          attachment_path,
          attachment_file_name,
          attachment_file_size,
          marks,
          feedback,
          reviewed_at,
          reviewed_by,
          created_at,
          updated_at,
          student:students(
            id,
            admission_number,
            profile:profiles(id, full_name, email)
          ),
          reviewer:profiles!assignment_submissions_reviewed_by_fkey(
            id,
            full_name
          )
        `
        )
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: true });

      if (error) throw new Error(error.message);
      return (data as unknown as AssignmentSubmissionDetail[]) || [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load submissions';
      console.error('[EduCamp AssignmentService] getSubmissionsForAssignment error:', msg);
      throw new Error(msg);
    }
  },

  /**
   * Submit marks and feedback for a student's submission (Teacher Review)
   */
  async reviewSubmission(
    payload: ReviewSubmissionPayload,
    reviewerProfileId: string
  ): Promise<AssignmentSubmission> {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
          marks: payload.marks ?? null,
          feedback: payload.feedback?.trim() || null,
          status: 'reviewed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewerProfileId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.submission_id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as AssignmentSubmission;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save submission review';
      console.error('[EduCamp AssignmentService] reviewSubmission error:', msg);
      throw new Error(msg);
    }
  },

  /**
   * Generate short-lived signed URL for an assignment file or student submission
   */
  async getAttachmentDownloadUrl(storagePath: string): Promise<string> {
    try {
      if (!storagePath) {
        throw new Error('Attachment storage path is missing.');
      }

      const { data, error } = await supabase.storage
        .from('assignment-files')
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

      if (error) {
        throw new Error(`Failed to generate signed URL: ${error.message}`);
      }

      if (!data?.signedUrl) {
        throw new Error('Storage returned empty URL');
      }

      return data.signedUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error obtaining document access';
      console.error('[EduCamp AssignmentService] getAttachmentDownloadUrl error:', msg);
      throw new Error(msg);
    }
  },
};
