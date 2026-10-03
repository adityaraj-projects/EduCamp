import { supabase } from '../lib/supabaseClient';
import type { Teacher, TeacherWithProfile, TeacherAssignmentDetail, TeacherFilters } from '../types/teacher';
import type { Database } from '../types/database.types';

type TeacherInsert = Database['public']['Tables']['teachers']['Insert'];
type TeacherUpdate = Database['public']['Tables']['teachers']['Update'];
type TeacherAssignmentInsert = Database['public']['Tables']['teacher_assignments']['Insert'];

/**
 * Teacher Master Data Service
 * Provides queries and administrative mutations for teacher management & assignments
 */
export const teacherService = {
  /**
   * Fetch teacher details by authenticated profile ID
   */
  async getTeacherByProfileId(profileId: string): Promise<Teacher | null> {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, profile_id, employee_code, joining_date, designation, qualification, specialization, status, created_at, updated_at')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) {
      console.warn('[EduCamp TeacherService] Error fetching teacher by profile:', error.message);
      return null;
    }
    return data as Teacher | null;
  },

  /**
   * Fetch teacher details by teacher ID
   */
  async getTeacherById(id: string): Promise<Teacher | null> {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, profile_id, employee_code, joining_date, designation, qualification, specialization, status, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn('[EduCamp TeacherService] Error fetching teacher by ID:', error.message);
      return null;
    }
    return data as Teacher | null;
  },

  /**
   * Fetch teachers with profile information and filters
   */
  async getTeachers(filters?: TeacherFilters): Promise<TeacherWithProfile[]> {
    let query = supabase
      .from('teachers')
      .select(`
        id, profile_id, employee_code, joining_date, designation, qualification, specialization, status, created_at, updated_at,
        profile:profiles!teachers_profile_id_fkey (
          full_name, email, phone_number, avatar_url, role, is_active
        )
      `)
      .order('employee_code', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.ilike('employee_code', `%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[EduCamp TeacherService] Error fetching teachers:', error.message);
      return [];
    }

    return (data || []) as unknown as TeacherWithProfile[];
  },

  /**
   * Fetch teacher assignments for an academic year
   */
  async getTeacherAssignments(teacherId: string, academicYearId?: string): Promise<TeacherAssignmentDetail[]> {
    let query = supabase
      .from('teacher_assignments')
      .select(`
        id, teacher_id, academic_year_id, batch_id, subject_id, role, is_active, created_at, updated_at,
        academic_year:academic_years!teacher_assignments_academic_year_id_fkey (id, name, is_active),
        batch:batches!teacher_assignments_batch_id_fkey (id, name, code),
        subject:subjects!teacher_assignments_subject_id_fkey (id, code, name)
      `)
      .eq('teacher_id', teacherId)
      .eq('is_active', true);

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[EduCamp TeacherService] Error fetching teacher assignments:', error.message);
      return [];
    }

    return (data || []) as unknown as TeacherAssignmentDetail[];
  },

  /**
   * Suggest next human-facing employee code
   */
  async getNextEmployeeCode(prefix = 'TCH'): Promise<string | null> {
    const { data, error } = await supabase.rpc('generate_employee_code', {
      p_prefix: prefix,
    });

    if (error) {
      console.warn('[EduCamp TeacherService] Error generating employee code:', error.message);
      return null;
    }
    return data;
  },

  /**
   * Create a teacher record (Admins only)
   */
  async createTeacher(payload: TeacherInsert): Promise<{ data: Teacher | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('teachers')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as Teacher, error: null };
  },

  /**
   * Update teacher details (Admins only)
   */
  async updateTeacher(id: string, payload: TeacherUpdate): Promise<{ data: Teacher | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('teachers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as Teacher, error: null };
  },

  /**
   * Assign a teacher to a batch and subject (Admins only)
   */
  async assignTeacher(payload: TeacherAssignmentInsert): Promise<{ data: TeacherAssignmentDetail | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('teacher_assignments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as unknown as TeacherAssignmentDetail, error: null };
  },

  /**
   * Deactivate a teacher assignment (Admins only)
   */
  async removeTeacherAssignment(assignmentId: string): Promise<{ success: boolean; error: Error | null }> {
    const { error } = await supabase
      .from('teacher_assignments')
      .update({ is_active: false })
      .eq('id', assignmentId);

    if (error) {
      return { success: false, error: new Error(error.message) };
    }
    return { success: true, error: null };
  },
};
