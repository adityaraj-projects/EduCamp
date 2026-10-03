import { supabase } from '../lib/supabaseClient';
import type { StudentEnrollment, StudentEnrollmentDetail, EnrollmentStatus } from '../types/student';
import type { Database } from '../types/database.types';

type StudentEnrollmentInsert = Database['public']['Tables']['student_enrollments']['Insert'];
type StudentEnrollmentUpdate = Database['public']['Tables']['student_enrollments']['Update'];

/**
 * Student Enrollment Service
 * Handles multi-year academic history and batch enrollments
 */
export const enrollmentService = {
  /**
   * Fetch complete academic enrollment history for a student
   */
  async getStudentEnrollments(studentId: string): Promise<StudentEnrollmentDetail[]> {
    const { data, error } = await supabase
      .from('student_enrollments')
      .select(`
        id, student_id, academic_year_id, board_class_id, stream_id, batch_id,
        roll_number, enrollment_date, status, is_current, created_at, updated_at,
        academic_year:academic_years!student_enrollments_academic_year_id_fkey (id, name, is_active),
        batch:batches!student_enrollments_batch_id_fkey (id, name, code),
        stream:streams!student_enrollments_stream_id_fkey (id, code, name),
        board_class:board_classes!student_enrollments_board_class_id_fkey (
          id, is_active,
          board:boards!board_classes_board_id_fkey (id, code, name),
          class_level:class_levels!board_classes_class_level_id_fkey (id, class_number, display_name)
        )
      `)
      .eq('student_id', studentId)
      .order('enrollment_date', { ascending: false });

    if (error) {
      console.warn('[EduCamp EnrollmentService] Error fetching enrollments:', error.message);
      return [];
    }

    return (data || []) as unknown as StudentEnrollmentDetail[];
  },

  /**
   * Fetch the current active enrollment for a student
   */
  async getCurrentEnrollment(studentId: string): Promise<StudentEnrollmentDetail | null> {
    const { data, error } = await supabase
      .from('student_enrollments')
      .select(`
        id, student_id, academic_year_id, board_class_id, stream_id, batch_id,
        roll_number, enrollment_date, status, is_current, created_at, updated_at,
        academic_year:academic_years!student_enrollments_academic_year_id_fkey (id, name, is_active),
        batch:batches!student_enrollments_batch_id_fkey (id, name, code),
        stream:streams!student_enrollments_stream_id_fkey (id, code, name),
        board_class:board_classes!student_enrollments_board_class_id_fkey (
          id, is_active,
          board:boards!board_classes_board_id_fkey (id, code, name),
          class_level:class_levels!board_classes_class_level_id_fkey (id, class_number, display_name)
        )
      `)
      .eq('student_id', studentId)
      .eq('is_current', true)
      .maybeSingle();

    if (error) {
      console.warn('[EduCamp EnrollmentService] Error fetching current enrollment:', error.message);
      return null;
    }

    return data as unknown as StudentEnrollmentDetail | null;
  },

  /**
   * Fetch all active students enrolled in a specific batch
   */
  async getStudentsByBatch(batchId: string): Promise<StudentEnrollmentDetail[]> {
    const { data, error } = await supabase
      .from('student_enrollments')
      .select(`
        id, student_id, academic_year_id, board_class_id, stream_id, batch_id,
        roll_number, enrollment_date, status, is_current, created_at, updated_at,
        student:students!student_enrollments_student_id_fkey (
          id, admission_number, status,
          profile:profiles!students_profile_id_fkey (full_name, email, phone_number, avatar_url)
        )
      `)
      .eq('batch_id', batchId)
      .eq('is_current', true)
      .order('roll_number', { ascending: true });

    if (error) {
      console.warn('[EduCamp EnrollmentService] Error fetching batch students:', error.message);
      return [];
    }

    return (data || []) as unknown as StudentEnrollmentDetail[];
  },

  /**
   * Enroll a student into a batch (Admins only)
   */
  async enrollStudent(payload: StudentEnrollmentInsert): Promise<{ data: StudentEnrollment | null; error: Error | null }> {
    // If setting as current, deactivate any previous active enrollment for this student in this academic year
    if (payload.is_current !== false) {
      await supabase
        .from('student_enrollments')
        .update({ is_current: false })
        .eq('student_id', payload.student_id)
        .eq('academic_year_id', payload.academic_year_id)
        .eq('is_current', true);
    }

    const { data, error } = await supabase
      .from('student_enrollments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as StudentEnrollment, error: null };
  },

  /**
   * Update enrollment status (e.g. promoted, completed, transferred) (Admins only)
   */
  async updateEnrollmentStatus(
    enrollmentId: string,
    status: EnrollmentStatus,
    isCurrent?: boolean
  ): Promise<{ data: StudentEnrollment | null; error: Error | null }> {
    const updatePayload: StudentEnrollmentUpdate = { status };
    if (typeof isCurrent === 'boolean') {
      updatePayload.is_current = isCurrent;
    }

    const { data, error } = await supabase
      .from('student_enrollments')
      .update(updatePayload)
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as StudentEnrollment, error: null };
  },
};
