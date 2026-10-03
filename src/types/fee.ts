import type { StudentWithProfile } from './student';

export type FeeFrequency = 'one_time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
export type ObligationStatus = 'unpaid' | 'partial' | 'paid' | 'waived' | 'overdue';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'card' | 'other';

export interface FeeCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeeStructureItem {
  id: string;
  fee_structure_id: string;
  fee_category_id: string;
  amount: number;
  frequency: FeeFrequency;
  is_optional: boolean;
  created_at: string;
  updated_at: string;
  category?: FeeCategory;
}

export interface FeeStructure {
  id: string;
  academic_year_id: string;
  board_class_id: string;
  stream_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: FeeStructureItem[];
}

export interface StudentFeeAssignment {
  id: string;
  enrollment_id: string;
  fee_structure_id: string;
  discount_amount: number;
  discount_reason: string | null;
  custom_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  fee_structure?: FeeStructure;
}

export interface FeeObligation {
  id: string;
  enrollment_id: string;
  student_id: string;
  fee_category_id: string;
  academic_year_id: string;
  fee_assignment_id: string | null;
  title: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  status: ObligationStatus;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeeObligationDetail extends FeeObligation {
  category?: FeeCategory;
  student?: StudentWithProfile;
  remaining_balance: number;
}

export interface PaymentReceiptMetadata {
  student_name: string;
  admission_number: string;
  obligation_title: string;
  amount_due: number;
  payment_amount: number;
  remaining_balance: number;
  payment_method: string;
  reference_number: string | null;
  receipt_number: string;
  payment_date: string;
  recorded_by?: string;
}

export interface Payment {
  id: string;
  obligation_id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  receipt_number: string;
  receipt_metadata: PaymentReceiptMetadata;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentDetail extends Payment {
  obligation?: FeeObligation;
  student?: StudentWithProfile;
}

export interface StudentFeeSummary {
  total_obligations: number;
  total_due: number;
  total_paid: number;
  outstanding_amount: number;
  unpaid_count: number;
  partial_count: number;
  paid_count: number;
}

export interface RecordPaymentPayload {
  obligation_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
}

export interface CreateObligationPayload {
  enrollment_id: string;
  student_id: string;
  fee_category_id: string;
  academic_year_id: string;
  title: string;
  amount_due: number;
  due_date: string;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  remarks?: string | null;
}
