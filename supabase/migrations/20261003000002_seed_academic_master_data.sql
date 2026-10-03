-- ====================================================================
-- EduCamp Phase 3 Seed Data: Academic Master Records
-- ====================================================================

-- 1. Seed Academic Years (One active session enforced)
INSERT INTO public.academic_years (name, start_date, end_date, is_active)
VALUES
  ('2025-2026', '2025-04-01', '2026-03-31', false),
  ('2026-2027', '2026-04-01', '2027-03-31', true),
  ('2027-2028', '2027-04-01', '2028-03-31', false)
ON CONFLICT (name) DO UPDATE
SET
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  is_active = EXCLUDED.is_active;

-- 2. Seed Educational Boards
INSERT INTO public.boards (code, name, description, is_active)
VALUES
  ('CBSE', 'Central Board of Secondary Education', 'National curriculum board under Government of India', true),
  ('ICSE', 'Indian Certificate of Secondary Education', 'Council for the Indian School Certificate Examinations', true),
  ('BSEB', 'Bihar School Examination Board', 'State educational board for secondary and senior secondary education in Bihar', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 3. Seed Class Levels (Class 1 through Class 12)
INSERT INTO public.class_levels (class_number, display_name, sort_order, is_active)
VALUES
  (1, 'Class 1', 1, true),
  (2, 'Class 2', 2, true),
  (3, 'Class 3', 3, true),
  (4, 'Class 4', 4, true),
  (5, 'Class 5', 5, true),
  (6, 'Class 6', 6, true),
  (7, 'Class 7', 7, true),
  (8, 'Class 8', 8, true),
  (9, 'Class 9', 9, true),
  (10, 'Class 10', 10, true),
  (11, 'Class 11', 11, true),
  (12, 'Class 12', 12, true)
ON CONFLICT (class_number) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- 4. Seed Senior Secondary Streams (Classes 11 & 12)
INSERT INTO public.streams (code, name, description, is_active)
VALUES
  ('SCIENCE', 'Science (PCM / PCB)', 'Physics, Chemistry, Mathematics, Biology, and Computer Science', true),
  ('COMMERCE', 'Commerce', 'Accountancy, Business Studies, Economics, and Applied Mathematics', true),
  ('ARTS', 'Arts / Humanities', 'History, Political Science, Geography, Economics, and Languages', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 5. Seed Core Master Subjects
INSERT INTO public.subjects (code, name, description, is_active)
VALUES
  ('MATH', 'Mathematics', 'Core mathematical concepts, geometry, algebra, and calculus', true),
  ('SCI', 'Science', 'Integrated general science for middle and secondary school', true),
  ('PHYS', 'Physics', 'Senior secondary mechanics, optics, thermodynamics, and electromagnetism', true),
  ('CHEM', 'Chemistry', 'Organic, inorganic, and physical chemistry', true),
  ('BIO', 'Biology', 'Botany, zoology, genetics, and ecology', true),
  ('ENG', 'English', 'English language, literature, comprehension, and grammar', true),
  ('HIN', 'Hindi', 'Hindi literature, prose, poetry, and grammar', true),
  ('SST', 'Social Science', 'History, geography, democratic politics, and economics', true),
  ('CS', 'Computer Science', 'Programming, data structures, and computer applications', true),
  ('ACCT', 'Accountancy', 'Financial accounting and company accounts', true),
  ('BST', 'Business Studies', 'Principles and functions of management and business finance', true),
  ('ECON', 'Economics', 'Microeconomics, macroeconomics, and Indian economic development', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 6. Seed Board Classes (Generate offerings for CBSE, ICSE, BSEB across Classes 1-12)
INSERT INTO public.board_classes (board_id, class_level_id, is_active)
SELECT b.id, cl.id, true
FROM public.boards b
CROSS JOIN public.class_levels cl
ON CONFLICT (board_id, class_level_id) DO NOTHING;

-- 7. Seed Sample Coaching Batches for Current Academic Year
DO $$
DECLARE
  v_year_id UUID;
  v_cbse_10_id UUID;
  v_bseb_10_id UUID;
  v_cbse_11_id UUID;
  v_science_id UUID;
BEGIN
  SELECT id INTO v_year_id FROM public.academic_years WHERE is_active = true LIMIT 1;
  
  SELECT bc.id INTO v_cbse_10_id
  FROM public.board_classes bc
  JOIN public.boards b ON b.id = bc.board_id
  JOIN public.class_levels cl ON cl.id = bc.class_level_id
  WHERE b.code = 'CBSE' AND cl.class_number = 10;

  SELECT bc.id INTO v_bseb_10_id
  FROM public.board_classes bc
  JOIN public.boards b ON b.id = bc.board_id
  JOIN public.class_levels cl ON cl.id = bc.class_level_id
  WHERE b.code = 'BSEB' AND cl.class_number = 10;

  SELECT bc.id INTO v_cbse_11_id
  FROM public.board_classes bc
  JOIN public.boards b ON b.id = bc.board_id
  JOIN public.class_levels cl ON cl.id = bc.class_level_id
  WHERE b.code = 'CBSE' AND cl.class_number = 11;

  SELECT id INTO v_science_id FROM public.streams WHERE code = 'SCIENCE';

  IF v_year_id IS NOT NULL AND v_cbse_10_id IS NOT NULL THEN
    INSERT INTO public.batches (academic_year_id, board_class_id, name, code, max_capacity)
    VALUES
      (v_year_id, v_cbse_10_id, 'Morning Batch (CBSE-10)', '26-CBSE10-MORN', 50),
      (v_year_id, v_cbse_10_id, 'Evening Batch (CBSE-10)', '26-CBSE10-EVE', 50)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_year_id IS NOT NULL AND v_bseb_10_id IS NOT NULL THEN
    INSERT INTO public.batches (academic_year_id, board_class_id, name, code, max_capacity)
    VALUES
      (v_year_id, v_bseb_10_id, 'Main Batch (BSEB-10)', '26-BSEB10-MAIN', 60)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_year_id IS NOT NULL AND v_cbse_11_id IS NOT NULL AND v_science_id IS NOT NULL THEN
    INSERT INTO public.batches (academic_year_id, board_class_id, stream_id, name, code, max_capacity)
    VALUES
      (v_year_id, v_cbse_11_id, v_science_id, 'IIT/NEET Foundation Batch', '26-CBSE11-SCI', 45)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 8. Seed Representative Curriculum Mapping (CBSE Class 10 Core Subjects)
DO $$
DECLARE
  v_cbse_10_id UUID;
  v_math_id UUID;
  v_sci_id UUID;
  v_eng_id UUID;
  v_hin_id UUID;
  v_sst_id UUID;
BEGIN
  SELECT bc.id INTO v_cbse_10_id
  FROM public.board_classes bc
  JOIN public.boards b ON b.id = bc.board_id
  JOIN public.class_levels cl ON cl.id = bc.class_level_id
  WHERE b.code = 'CBSE' AND cl.class_number = 10;

  SELECT id INTO v_math_id FROM public.subjects WHERE code = 'MATH';
  SELECT id INTO v_sci_id FROM public.subjects WHERE code = 'SCI';
  SELECT id INTO v_eng_id FROM public.subjects WHERE code = 'ENG';
  SELECT id INTO v_hin_id FROM public.subjects WHERE code = 'HIN';
  SELECT id INTO v_sst_id FROM public.subjects WHERE code = 'SST';

  IF v_cbse_10_id IS NOT NULL AND v_math_id IS NOT NULL THEN
    INSERT INTO public.board_class_subjects (board_class_id, subject_id, is_core, sort_order)
    VALUES
      (v_cbse_10_id, v_math_id, true, 1),
      (v_cbse_10_id, v_sci_id, true, 2),
      (v_cbse_10_id, v_eng_id, true, 3),
      (v_cbse_10_id, v_hin_id, true, 4),
      (v_cbse_10_id, v_sst_id, true, 5)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
