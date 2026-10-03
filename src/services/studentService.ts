import { supabase } from '../lib/supabaseClient';
import type { Student, StudentWithProfile, StudentFilters } from '../types/student';
import type { Database } from '../types/database.types';

type StudentInsert = Database['public']['Tables']['students']['Insert'];
type StudentUpdate = Database['public']['Tables']['students']['Update'];

/**
 * Student Master Data Service
 * Provides queries and administrative mutations for student management
 */
export const studentService = {
  /**
   * Fetch student details by authenticated profile ID
   */
  async getStudentByProfileId(profileId: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select('id, profile_id, admission_number, date_of_birth, gender, guardian_name, guardian_phone, guardian_relation, emergency_contact, address, status, created_at, updated_at')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) {
      console.warn('[EduCamp StudentService] Error fetching student by profile:', error.message);
      return null;
    }
    return data as Student | null;
  },

  /**
   * Fetch student details by student ID
   */
  async getStudentById(id: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select('id, profile_id, admission_number, date_of_birth, gender, guardian_name, guardian_phone, guardian_relation, emergency_contact, address, status, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn('[EduCamp StudentService] Error fetching student by ID:', error.message);
      return null;
    }
    return data as Student | null;
  },

  /**
   * Fetch paginated students with profile information and search filters
   */
  async getStudents(filters?: StudentFilters): Promise<StudentWithProfile[]> {
    let query = supabase
      .from('students')
      .select(`
        id, profile_id, admission_number, date_of_birth, gender, guardian_name, 
        guardian_phone, guardian_relation, emergency_contact, address, status, created_at, updated_at,
        profile:profiles!students_profile_id_fkey (
          full_name, email, phone_number, avatar_url, role, is_active
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.ilike('admission_number', `%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[EduCamp StudentService] Error fetching students:', error.message);
      return [];
    }

    return (data || []) as unknown as StudentWithProfile[];
  },

  /**
   * Suggest next human-facing admission number
   */
  async getNextAdmissionNumber(prefix = 'ADM'): Promise<string | null> {
    const { data, error } = await supabase.rpc('generate_admission_number', {
      p_prefix: prefix,
    });

    if (error) {
      console.warn('[EduCamp StudentService] Error generating admission number:', error.message);
      return null;
    }
    return data;
  },

  /**
   * Create a student record (Admins only)
   */
  async createStudent(payload: StudentInsert): Promise<{ data: Student | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('students')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as Student, error: null };
  },

  /**
   * Update student details (Admins only)
   */
  async updateStudent(id: string, payload: StudentUpdate): Promise<{ data: Student | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('students')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as Student, error: null };
  },
};
