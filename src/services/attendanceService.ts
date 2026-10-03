import { supabase } from '../lib/supabaseClient';
import type {
  AttendanceSession,
  AttendanceSessionDetail,
  AttendanceRecordDetail,
  BatchStudentRosterItem,
  BatchAttendanceSubmissionPayload,
  StudentAttendanceSummary,
  AttendanceFilters,
} from '../types/attendance';

/**
 * Production Attendance Service
 * Encapsulates transactional batch marking, student history, and aggregation
 */
export const attendanceService = {
  /**
   * Fetch batch student roster for a specific date, merging any already-marked records
   */
  async getBatchRosterForDate(
    batchId: string,
    attendanceDate: string,
    subjectId?: string | null
  ): Promise<{
    session: AttendanceSession | null;
    roster: BatchStudentRosterItem[];
  }> {
    try {
      // 1. Fetch existing session if already created
      let sessionQuery = supabase
        .from('attendance_sessions')
        .select('id, academic_year_id, batch_id, teacher_id, subject_id, attendance_date, notes, created_at, updated_at')
        .eq('batch_id', batchId)
        .eq('attendance_date', attendanceDate);

      if (subjectId) {
        sessionQuery = sessionQuery.eq('subject_id', subjectId);
      } else {
        sessionQuery = sessionQuery.is('subject_id', null);
      }

      const { data: sessionData, error: sessionError } = await sessionQuery.maybeSingle();

      if (sessionError) {
        console.warn('[EduCamp AttendanceService] Error fetching session:', sessionError.message);
      }

      const existingSession = sessionData as AttendanceSession | null;

      // 2. Fetch all active enrollments for this batch
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('student_enrollments')
        .select(`
          id, student_id, roll_number,
          student:students!student_enrollments_student_id_fkey (
            id, admission_number, status,
            profile:profiles!students_profile_id_fkey (full_name)
          )
        `)
        .eq('batch_id', batchId)
        .eq('is_current', true)
        .order('roll_number', { ascending: true });

      if (enrollmentsError) {
        throw new Error(enrollmentsError.message);
      }

      // 3. If session exists, fetch existing records to pre-fill marked statuses
      const recordsMap = new Map<string, { status: string; remarks: string | null }>();
      if (existingSession?.id) {
        const { data: existingRecords } = await supabase
          .from('attendance_records')
          .select('enrollment_id, status, remarks')
          .eq('attendance_session_id', existingSession.id);

        if (existingRecords) {
          for (const rec of existingRecords) {
            recordsMap.set(rec.enrollment_id, {
              status: rec.status,
              remarks: rec.remarks,
            });
          }
        }
      }

      // 4. Construct unified roster items
      const roster: BatchStudentRosterItem[] = (enrollments || []).map((enr: any) => {
        const existing = recordsMap.get(enr.id);
        return {
          enrollment_id: enr.id,
          student_id: enr.student_id,
          student_name: enr.student?.profile?.full_name || 'Enrolled Student',
          admission_number: enr.student?.admission_number || 'N/A',
          roll_number: enr.roll_number,
          status: (existing?.status as any) || 'unmarked',
          remarks: existing?.remarks || '',
        };
      });

      return {
        session: existingSession,
        roster,
      };
    } catch (err: any) {
      console.error('[EduCamp AttendanceService] getBatchRosterForDate failed:', err);
      return { session: null, roster: [] };
    }
  },

  /**
   * Submit or update entire batch attendance atomically via database RPC
   */
  async submitBatchAttendance(
    payload: BatchAttendanceSubmissionPayload
  ): Promise<{ success: boolean; sessionId?: string; recordsMarked?: number; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('submit_batch_attendance', {
        p_academic_year_id: payload.academic_year_id,
        p_batch_id: payload.batch_id,
        p_attendance_date: payload.attendance_date,
        p_subject_id: payload.subject_id || null,
        p_records: payload.records as any,
        p_notes: payload.notes || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as any;
      return {
        success: true,
        sessionId: res?.session_id,
        recordsMarked: res?.records_marked,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to submit batch attendance' };
    }
  },

  /**
   * Fetch attendance history for an individual student (paginated)
   */
  async getStudentAttendanceHistory(
    studentId: string,
    filters?: AttendanceFilters
  ): Promise<AttendanceRecordDetail[]> {
    try {
      let query = supabase
        .from('attendance_records')
        .select(`
          id, attendance_session_id, enrollment_id, student_id, status, remarks, created_at, updated_at,
          session:attendance_sessions!attendance_records_attendance_session_id_fkey (
            id, academic_year_id, batch_id, teacher_id, subject_id, attendance_date, notes, created_at, updated_at,
            batch:batches!attendance_sessions_batch_id_fkey (id, name, code),
            subject:subjects!attendance_sessions_subject_id_fkey (id, code, name),
            academic_year:academic_years!attendance_sessions_academic_year_id_fkey (id, name, is_active)
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(50);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[EduCamp AttendanceService] Error fetching student history:', error.message);
        return [];
      }

      return (data || []) as unknown as AttendanceRecordDetail[];
    } catch (err: any) {
      console.error('[EduCamp AttendanceService] getStudentAttendanceHistory failed:', err);
      return [];
    }
  },

  /**
   * Fetch aggregated summary stats for a student
   */
  async getStudentAttendanceSummary(
    studentId: string,
    academicYearId?: string | null
  ): Promise<StudentAttendanceSummary | null> {
    try {
      const { data, error } = await supabase.rpc('get_student_attendance_summary', {
        p_student_id: studentId,
        p_academic_year_id: academicYearId || null,
      });

      if (error) {
        console.warn('[EduCamp AttendanceService] Error calculating summary:', error.message);
        return null;
      }

      return data as unknown as StudentAttendanceSummary;
    } catch (err: any) {
      console.error('[EduCamp AttendanceService] getStudentAttendanceSummary failed:', err);
      return null;
    }
  },

  /**
   * Fetch recent attendance sessions marked by a teacher
   */
  async getTeacherSessions(
    teacherId: string,
    academicYearId?: string
  ): Promise<AttendanceSessionDetail[]> {
    try {
      let query = supabase
        .from('attendance_sessions')
        .select(`
          id, academic_year_id, batch_id, teacher_id, subject_id, attendance_date, notes, created_at, updated_at,
          batch:batches!attendance_sessions_batch_id_fkey (id, name, code),
          subject:subjects!attendance_sessions_subject_id_fkey (id, code, name),
          academic_year:academic_years!attendance_sessions_academic_year_id_fkey (id, name, is_active)
        `)
        .eq('teacher_id', teacherId)
        .order('attendance_date', { ascending: false })
        .limit(20);

      if (academicYearId) {
        query = query.eq('academic_year_id', academicYearId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[EduCamp AttendanceService] Error fetching teacher sessions:', error.message);
        return [];
      }

      return (data || []) as unknown as AttendanceSessionDetail[];
    } catch (err: any) {
      console.error('[EduCamp AttendanceService] getTeacherSessions failed:', err);
      return [];
    }
  },
};
