-- ====================================================================
-- EduCamp Phase 6 Migration: Production-Grade Fee Management System
-- ====================================================================

-- 1. Helper Function: Generate sequential receipt numbers (e.g. RCP-2026-0001)
CREATE OR REPLACE FUNCTION public.generate_receipt_number(p_prefix TEXT DEFAULT 'RCP')
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_code TEXT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT count(*) + 1 INTO v_count
  FROM public.payments
  WHERE receipt_number LIKE p_prefix || '-' || v_year || '-%';
  
  v_code := p_prefix || '-' || v_year || '-' || lpad(v_count::text, 4, '0');
  RETURN v_code;
END;
$$ LANGUAGE plpgsql STABLE;

-- ====================================================================
-- 2. Fee Categories Master Table
-- Configurable fee components (Tuition, Admission, Exam, etc.)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.fee_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fee_categories_code ON public.fee_categories(code);
CREATE INDEX IF NOT EXISTS idx_fee_categories_active ON public.fee_categories(is_active);

CREATE TRIGGER set_fee_categories_updated_at
  BEFORE UPDATE ON public.fee_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 3. Fee Structures Master Table
-- Master templates applicable to Academic Year + Board + Class + Stream
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  board_class_id UUID NOT NULL REFERENCES public.board_classes(id) ON DELETE RESTRICT,
  stream_id UUID REFERENCES public.streams(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_structures_with_stream
  ON public.fee_structures (academic_year_id, board_class_id, stream_id, name)
  WHERE stream_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_structures_without_stream
  ON public.fee_structures (academic_year_id, board_class_id, name)
  WHERE stream_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_fee_structures_year ON public.fee_structures(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_board_class ON public.fee_structures(board_class_id);

CREATE TRIGGER set_fee_structures_updated_at
  BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 4. Fee Structure Items Table
-- Individual category amounts & payment frequency within a structure
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.fee_structure_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_structure_id UUID NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  fee_category_id UUID NOT NULL REFERENCES public.fee_categories(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  frequency VARCHAR(30) NOT NULL CHECK (frequency IN ('one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_fee_structure_category UNIQUE (fee_structure_id, fee_category_id)
);

CREATE INDEX IF NOT EXISTS idx_fsi_structure ON public.fee_structure_items(fee_structure_id);
CREATE INDEX IF NOT EXISTS idx_fsi_category ON public.fee_structure_items(fee_category_id);

CREATE TRIGGER set_fee_structure_items_updated_at
  BEFORE UPDATE ON public.fee_structure_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 5. Student Fee Assignments Table
-- Links an enrolled student to a fee structure with optional discount
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.student_fee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  fee_structure_id UUID NOT NULL REFERENCES public.fee_structures(id) ON DELETE RESTRICT,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  discount_reason TEXT,
  custom_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_enrollment_fee_structure UNIQUE (enrollment_id, fee_structure_id)
);

CREATE INDEX IF NOT EXISTS idx_sfa_enrollment ON public.student_fee_assignments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_sfa_structure ON public.student_fee_assignments(fee_structure_id);

CREATE TRIGGER set_student_fee_assignments_updated_at
  BEFORE UPDATE ON public.student_fee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 6. Fee Obligations Table
-- Represents expected student payments with due dates and billing periods
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.fee_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  fee_category_id UUID NOT NULL REFERENCES public.fee_categories(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  fee_assignment_id UUID REFERENCES public.student_fee_assignments(id) ON DELETE SET NULL,
  title VARCHAR(150) NOT NULL,
  amount_due NUMERIC(10, 2) NOT NULL CHECK (amount_due > 0),
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
  due_date DATE NOT NULL,
  billing_period_start DATE,
  billing_period_end DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'waived', 'overdue')),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_obligation_paid_not_exceed_due CHECK (amount_paid <= amount_due)
);

-- Unique index preventing duplicate periodic billing for same student + category + period
CREATE UNIQUE INDEX IF NOT EXISTS idx_obligations_periodic_unique
  ON public.fee_obligations (enrollment_id, fee_category_id, billing_period_start)
  WHERE billing_period_start IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_obligations_enrollment ON public.fee_obligations(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_obligations_student ON public.fee_obligations(student_id);
CREATE INDEX IF NOT EXISTS idx_obligations_due_date ON public.fee_obligations(due_date);
CREATE INDEX IF NOT EXISTS idx_obligations_status ON public.fee_obligations(status);
CREATE INDEX IF NOT EXISTS idx_obligations_year ON public.fee_obligations(academic_year_id);

CREATE TRIGGER set_fee_obligations_updated_at
  BEFORE UPDATE ON public.fee_obligations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 7. Payments Table
-- Immutable financial ledger records capturing payments & receipt numbers
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL REFERENCES public.fee_obligations(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other')),
  reference_number VARCHAR(100),
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  receipt_metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_obligation ON public.payments(obligation_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_receipt ON public.payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(reference_number);

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 8. Atomic Payment Recording RPC
-- Safely records partial or full payment, generates receipt, updates obligation balance
-- ====================================================================

CREATE OR REPLACE FUNCTION public.record_fee_payment(
  p_obligation_id UUID,
  p_amount NUMERIC,
  p_payment_method VARCHAR,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_obligation RECORD;
  v_student RECORD;
  v_profile RECORD;
  v_remaining NUMERIC;
  v_new_paid NUMERIC;
  v_new_status VARCHAR;
  v_receipt_number TEXT;
  v_payment_id UUID;
  v_meta JSONB;
BEGIN
  -- 1. Authorization: Only administrative users can record fee payments
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can record payments';
  END IF;

  -- 2. Input validation
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- 3. Lock obligation row FOR UPDATE to prevent concurrency race conditions
  SELECT *
  INTO v_obligation
  FROM public.fee_obligations
  WHERE id = p_obligation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fee obligation % not found', p_obligation_id;
  END IF;

  IF v_obligation.status = 'paid' THEN
    RAISE EXCEPTION 'This fee obligation has already been fully paid';
  END IF;

  IF v_obligation.status = 'waived' THEN
    RAISE EXCEPTION 'Cannot record payment for a waived fee obligation';
  END IF;

  -- 4. Overpayment check
  v_remaining := v_obligation.amount_due - v_obligation.amount_paid;
  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'Payment amount (₹%) exceeds remaining balance (₹%)', p_amount, v_remaining;
  END IF;

  -- 5. Fetch student and profile details for receipt metadata snapshot
  SELECT s.id, s.admission_number, s.profile_id
  INTO v_student
  FROM public.students s
  WHERE s.id = v_obligation.student_id;

  SELECT p.full_name, p.email, p.phone_number
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_student.profile_id;

  -- 6. Generate sequential receipt number
  v_receipt_number := public.generate_receipt_number('RCP');

  -- 7. Calculate new obligation status
  v_new_paid := v_obligation.amount_paid + p_amount;
  IF v_new_paid >= v_obligation.amount_due THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- 8. Prepare receipt metadata JSON snapshot
  v_meta := jsonb_build_object(
    'student_name', COALESCE(v_profile.full_name, 'Student'),
    'admission_number', v_student.admission_number,
    'obligation_title', v_obligation.title,
    'amount_due', v_obligation.amount_due,
    'payment_amount', p_amount,
    'remaining_balance', v_obligation.amount_due - v_new_paid,
    'payment_method', p_payment_method,
    'reference_number', p_reference_number,
    'receipt_number', v_receipt_number,
    'payment_date', CURRENT_DATE,
    'recorded_by', auth.uid()
  );

  -- 9. Insert payment record into immutable ledger
  INSERT INTO public.payments (
    obligation_id,
    student_id,
    amount,
    payment_date,
    payment_method,
    reference_number,
    receipt_number,
    receipt_metadata,
    notes,
    created_by
  ) VALUES (
    p_obligation_id,
    v_obligation.student_id,
    p_amount,
    CURRENT_DATE,
    p_payment_method,
    p_reference_number,
    v_receipt_number,
    v_meta,
    p_notes,
    auth.uid()
  ) RETURNING id INTO v_payment_id;

  -- 10. Update obligation record
  UPDATE public.fee_obligations
  SET
    amount_paid = v_new_paid,
    status = v_new_status,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_obligation_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'receipt_number', v_receipt_number,
    'amount_paid', p_amount,
    'remaining_balance', v_obligation.amount_due - v_new_paid,
    'new_status', v_new_status,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 9. Student Fee Summary RPC
-- Computes aggregated financial totals for a student on-the-fly
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_student_fee_summary(
  p_student_id UUID,
  p_academic_year_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_total_obligations INT := 0;
  v_total_due NUMERIC(10, 2) := 0.00;
  v_total_paid NUMERIC(10, 2) := 0.00;
  v_outstanding NUMERIC(10, 2) := 0.00;
  v_unpaid_count INT := 0;
  v_partial_count INT := 0;
  v_paid_count INT := 0;
BEGIN
  -- Security check: Caller must be admin or the student themselves
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND profile_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied to financial records';
  END IF;

  SELECT
    count(*),
    COALESCE(sum(amount_due), 0.00),
    COALESCE(sum(amount_paid), 0.00),
    count(*) FILTER (WHERE status = 'unpaid'),
    count(*) FILTER (WHERE status = 'partial'),
    count(*) FILTER (WHERE status = 'paid')
  INTO
    v_total_obligations,
    v_total_due,
    v_total_paid,
    v_unpaid_count,
    v_partial_count,
    v_paid_count
  FROM public.fee_obligations
  WHERE student_id = p_student_id
    AND status != 'waived'
    AND (p_academic_year_id IS NULL OR academic_year_id = p_academic_year_id);

  v_outstanding := v_total_due - v_total_paid;

  RETURN jsonb_build_object(
    'total_obligations', v_total_obligations,
    'total_due', v_total_due,
    'total_paid', v_total_paid,
    'outstanding_amount', v_outstanding,
    'unpaid_count', v_unpaid_count,
    'partial_count', v_partial_count,
    'paid_count', v_paid_count
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ====================================================================
-- 10. Row Level Security (RLS) Policies
-- Enforce financial confidentiality and strict admin-only writes
-- ====================================================================

-- 10.1 Fee Categories RLS
ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fee categories"
  ON public.fee_categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage fee categories"
  ON public.fee_categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 10.2 Fee Structures RLS
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fee structures"
  ON public.fee_structures FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage fee structures"
  ON public.fee_structures FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 10.3 Fee Structure Items RLS
ALTER TABLE public.fee_structure_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fee structure items"
  ON public.fee_structure_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage fee structure items"
  ON public.fee_structure_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 10.4 Student Fee Assignments RLS
ALTER TABLE public.student_fee_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fee assignments"
  ON public.student_fee_assignments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students can view own fee assignments"
  ON public.student_fee_assignments FOR SELECT
  USING (
    enrollment_id IN (
      SELECT se.id FROM public.student_enrollments se
      JOIN public.students s ON s.id = se.student_id
      WHERE s.profile_id = auth.uid()
    )
  );

-- 10.5 Fee Obligations RLS (Strict Financial Privacy: Teachers have 0 access)
ALTER TABLE public.fee_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fee obligations"
  ON public.fee_obligations FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students can view own fee obligations"
  ON public.fee_obligations FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE profile_id = auth.uid()
    )
  );

-- 10.6 Payments RLS (Strict Ledger Privacy: Teachers have 0 access)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view and manage payments"
  ON public.payments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students can view own payment receipts"
  ON public.payments FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE profile_id = auth.uid()
    )
  );

-- ====================================================================
-- 11. Initial Seed Master Data (Fee Categories & Sample Structure)
-- ====================================================================

INSERT INTO public.fee_categories (code, name, description, is_active)
VALUES
  ('TUITION', 'Tuition Fee', 'Regular academic instruction and classroom teaching fees', true),
  ('ADMISSION', 'Admission Fee', 'One-time admission and registration processing charge', true),
  ('REGISTRATION', 'Registration Fee', 'Board exam or annual session registration charge', true),
  ('EXAM', 'Examination Fee', 'Periodic test series, mock exams, and term evaluation charges', true),
  ('STUDY_MATERIAL', 'Study Material Fee', 'Printed books, formula sheets, modules, and test papers', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Sample Fee Structure for CBSE Class 10
DO $$
DECLARE
  v_year_id UUID;
  v_board_class_id UUID;
  v_struct_id UUID;
  v_tuition_id UUID;
  v_mat_id UUID;
  v_exam_id UUID;
BEGIN
  SELECT id INTO v_year_id FROM public.academic_years WHERE is_active = true LIMIT 1;
  
  SELECT bc.id INTO v_board_class_id
  FROM public.board_classes bc
  JOIN public.boards b ON b.id = bc.board_id
  JOIN public.class_levels cl ON cl.id = bc.class_level_id
  WHERE b.code = 'CBSE' AND cl.class_number = 10
  LIMIT 1;

  IF v_year_id IS NOT NULL AND v_board_class_id IS NOT NULL THEN
    INSERT INTO public.fee_structures (
      academic_year_id,
      board_class_id,
      name,
      description,
      is_active
    ) VALUES (
      v_year_id,
      v_board_class_id,
      'CBSE Class 10 Standard Coaching Fee',
      'Standard tuition, study material, and exam series fee structure for Class 10 CBSE',
      true
    )
    ON CONFLICT (academic_year_id, board_class_id, name) DO NOTHING
    RETURNING id INTO v_struct_id;

    IF v_struct_id IS NULL THEN
      SELECT id INTO v_struct_id FROM public.fee_structures
      WHERE academic_year_id = v_year_id AND board_class_id = v_board_class_id AND name = 'CBSE Class 10 Standard Coaching Fee';
    END IF;

    -- Fetch categories
    SELECT id INTO v_tuition_id FROM public.fee_categories WHERE code = 'TUITION';
    SELECT id INTO v_mat_id FROM public.fee_categories WHERE code = 'STUDY_MATERIAL';
    SELECT id INTO v_exam_id FROM public.fee_categories WHERE code = 'EXAM';

    IF v_struct_id IS NOT NULL AND v_tuition_id IS NOT NULL THEN
      INSERT INTO public.fee_structure_items (fee_structure_id, fee_category_id, amount, frequency)
      VALUES (v_struct_id, v_tuition_id, 2000.00, 'monthly')
      ON CONFLICT (fee_structure_id, fee_category_id) DO NOTHING;
    END IF;

    IF v_struct_id IS NOT NULL AND v_mat_id IS NOT NULL THEN
      INSERT INTO public.fee_structure_items (fee_structure_id, fee_category_id, amount, frequency)
      VALUES (v_struct_id, v_mat_id, 500.00, 'one_time')
      ON CONFLICT (fee_structure_id, fee_category_id) DO NOTHING;
    END IF;

    IF v_struct_id IS NOT NULL AND v_exam_id IS NOT NULL THEN
      INSERT INTO public.fee_structure_items (fee_structure_id, fee_category_id, amount, frequency)
      VALUES (v_struct_id, v_exam_id, 300.00, 'quarterly')
      ON CONFLICT (fee_structure_id, fee_category_id) DO NOTHING;
    END IF;
  END IF;
END $$;
