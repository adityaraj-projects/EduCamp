import { supabase } from '../lib/supabaseClient';
import type {
  FeeCategory,
  FeeStructure,
  FeeObligationDetail,
  PaymentDetail,
  StudentFeeSummary,
  RecordPaymentPayload,
  CreateObligationPayload,
} from '../types/fee';

/**
 * Production Fee & Financial Management Service
 * Encapsulates fee structures, student obligations, immutable payment ledger, and receipts
 */
export const feeService = {
  /**
   * Fetch all active fee categories (Tuition, Admission, Exam, etc.)
   */
  async getFeeCategories(): Promise<FeeCategory[]> {
    const { data, error } = await supabase
      .from('fee_categories')
      .select('id, code, name, description, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('[EduCamp FeeService] Error fetching fee categories:', error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Fetch master fee structures with breakdown items
   */
  async getFeeStructures(academicYearId?: string, boardClassId?: string): Promise<FeeStructure[]> {
    let query = supabase
      .from('fee_structures')
      .select(`
        id, academic_year_id, board_class_id, stream_id, name, description, is_active, created_at, updated_at,
        items:fee_structure_items (
          id, fee_structure_id, fee_category_id, amount, frequency, is_optional, created_at, updated_at,
          category:fee_categories (id, code, name)
        )
      `)
      .eq('is_active', true);

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }

    if (boardClassId) {
      query = query.eq('board_class_id', boardClassId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[EduCamp FeeService] Error fetching fee structures:', error.message);
      return [];
    }
    return (data || []) as unknown as FeeStructure[];
  },

  /**
   * Fetch fee obligations for an individual student
   */
  async getStudentFeeObligations(studentId: string, academicYearId?: string): Promise<FeeObligationDetail[]> {
    let query = supabase
      .from('fee_obligations')
      .select(`
        id, enrollment_id, student_id, fee_category_id, academic_year_id, fee_assignment_id,
        title, amount_due, amount_paid, due_date, billing_period_start, billing_period_end,
        status, remarks, created_at, updated_at,
        category:fee_categories (id, code, name)
      `)
      .eq('student_id', studentId)
      .order('due_date', { ascending: false });

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[EduCamp FeeService] Error fetching student fee obligations:', error.message);
      return [];
    }

    return (data || []).map((ob: any) => ({
      ...ob,
      remaining_balance: Number((ob.amount_due - ob.amount_paid).toFixed(2)),
    })) as FeeObligationDetail[];
  },

  /**
   * Fetch payment and receipt history for an individual student
   */
  async getStudentPaymentHistory(studentId: string): Promise<PaymentDetail[]> {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id, obligation_id, student_id, amount, payment_date, payment_method,
        reference_number, receipt_number, receipt_metadata, notes, created_by,
        created_at, updated_at,
        obligation:fee_obligations (id, title, amount_due, amount_paid, status)
      `)
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false });

    if (error) {
      console.warn('[EduCamp FeeService] Error fetching payment history:', error.message);
      return [];
    }

    return (data || []) as unknown as PaymentDetail[];
  },

  /**
   * Record fee payment atomically via database RPC (Admins only)
   */
  async recordPayment(payload: RecordPaymentPayload): Promise<{
    success: boolean;
    paymentId?: string;
    receiptNumber?: string;
    remainingBalance?: number;
    newStatus?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('record_fee_payment', {
        p_obligation_id: payload.obligation_id,
        p_amount: payload.amount,
        p_payment_method: payload.payment_method,
        p_reference_number: payload.reference_number || null,
        p_notes: payload.notes || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as any;
      return {
        success: true,
        paymentId: res?.payment_id,
        receiptNumber: res?.receipt_number,
        remainingBalance: res?.remaining_balance,
        newStatus: res?.new_status,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Payment recording failed' };
    }
  },

  /**
   * Fetch student fee summary on-the-fly via database RPC
   */
  async getStudentFeeSummary(studentId: string, academicYearId?: string): Promise<StudentFeeSummary | null> {
    try {
      const { data, error } = await supabase.rpc('get_student_fee_summary', {
        p_student_id: studentId,
        p_academic_year_id: academicYearId || null,
      });

      if (error) {
        console.warn('[EduCamp FeeService] Error calculating fee summary:', error.message);
        return null;
      }

      return data as unknown as StudentFeeSummary;
    } catch (err: any) {
      console.error('[EduCamp FeeService] getStudentFeeSummary failed:', err);
      return null;
    }
  },

  /**
   * Fetch all pending obligations across students (for Admin cash collection / test workflow)
   */
  async getPendingObligations(limit = 50): Promise<FeeObligationDetail[]> {
    const { data, error } = await supabase
      .from('fee_obligations')
      .select(`
        id, enrollment_id, student_id, fee_category_id, academic_year_id, fee_assignment_id,
        title, amount_due, amount_paid, due_date, billing_period_start, billing_period_end,
        status, remarks, created_at, updated_at,
        category:fee_categories (id, code, name),
        student:students!fee_obligations_student_id_fkey (
          id, admission_number,
          profile:profiles!students_profile_id_fkey (full_name)
        )
      `)
      .in('status', ['unpaid', 'partial'])
      .order('due_date', { ascending: true })
      .limit(limit);

    if (error) {
      console.warn('[EduCamp FeeService] Error fetching pending obligations:', error.message);
      return [];
    }

    return (data || []).map((ob: any) => ({
      ...ob,
      remaining_balance: Number((ob.amount_due - ob.amount_paid).toFixed(2)),
    })) as FeeObligationDetail[];
  },

  /**
   * Create a new fee obligation for a student (Admins only)
   */
  async createFeeObligation(payload: CreateObligationPayload): Promise<{
    data: any;
    error: Error | null;
  }> {
    const { data, error } = await supabase
      .from('fee_obligations')
      .insert({
        enrollment_id: payload.enrollment_id,
        student_id: payload.student_id,
        fee_category_id: payload.fee_category_id,
        academic_year_id: payload.academic_year_id,
        title: payload.title,
        amount_due: payload.amount_due,
        due_date: payload.due_date,
        billing_period_start: payload.billing_period_start || null,
        billing_period_end: payload.billing_period_end || null,
        remarks: payload.remarks || null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data, error: null };
  },
};
