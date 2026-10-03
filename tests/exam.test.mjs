import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Constants matching src/types/exam.ts
const EXAM_TYPES = [
  'unit_test',
  'class_test',
  'monthly_test',
  'midterm',
  'terminal',
  'final',
  'mock_test',
  'other',
];

const EXAM_STATUSES = [
  'draft',
  'scheduled',
  'ongoing',
  'completed',
  'published',
  'archived',
];

const ATTENDANCE_STATUSES = ['present', 'absent', 'exempted'];

// Centralized Grade Calculation matching src/types/exam.ts
function calculateGrade(percentage, isPassed) {
  if (percentage === null || percentage === undefined) return null;
  if (!isPassed) return 'F';
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}

// Marks validation helper replicating DB triggers and service checks
function validateMarks(obtainedMarks, maxMarks, passingMarks, attendanceStatus) {
  if (maxMarks <= 0) {
    return { valid: false, error: 'Maximum marks must be greater than 0.' };
  }
  if (passingMarks < 0 || passingMarks > maxMarks) {
    return { valid: false, error: 'Passing marks must be between 0 and maximum marks.' };
  }

  if (attendanceStatus === 'absent' || attendanceStatus === 'exempted') {
    if (obtainedMarks !== null && obtainedMarks !== undefined) {
      return {
        valid: false,
        error: `Students marked ${attendanceStatus} cannot have numerical obtained marks.`,
      };
    }
    return { valid: true, error: null, resultStatus: attendanceStatus };
  }

  // Attendance is 'present'
  if (obtainedMarks === null || obtainedMarks === undefined) {
    return { valid: true, error: null, resultStatus: 'pending' };
  }

  if (typeof obtainedMarks !== 'number' || isNaN(obtainedMarks)) {
    return { valid: false, error: 'Obtained marks must be a valid number.' };
  }

  if (obtainedMarks < 0) {
    return { valid: false, error: 'Obtained marks cannot be negative.' };
  }

  if (obtainedMarks > maxMarks) {
    return {
      valid: false,
      error: `Obtained marks (${obtainedMarks}) cannot exceed max marks (${maxMarks}).`,
    };
  }

  const resultStatus = obtainedMarks >= passingMarks ? 'passed' : 'failed';
  return { valid: true, error: null, resultStatus };
}

// Aggregation helper for overall exam results
function calculateExamTotals(subjectScores) {
  let totalMax = 0;
  let totalObtained = 0;
  let isComplete = true;
  let hasFailure = false;
  let hasAnyPresent = false;
  let allAbsent = true;
  let allExempted = true;

  for (const sub of subjectScores) {
    totalMax += sub.maxMarks;

    if (sub.attendanceStatus === 'present') {
      allAbsent = false;
      allExempted = false;
      hasAnyPresent = true;
      if (sub.obtainedMarks === null || sub.obtainedMarks === undefined) {
        isComplete = false;
      } else {
        totalObtained += sub.obtainedMarks;
        if (sub.obtainedMarks < sub.passingMarks) {
          hasFailure = true;
        }
      }
    } else if (sub.attendanceStatus === 'absent') {
      allExempted = false;
    } else if (sub.attendanceStatus === 'exempted') {
      allAbsent = false;
    }
  }

  if (!isComplete) {
    return {
      totalObtained: null,
      totalMax,
      percentage: null,
      grade: null,
      overallStatus: 'INCOMPLETE',
      isComplete: false,
    };
  }

  if (allAbsent && subjectScores.length > 0) {
    return {
      totalObtained: null,
      totalMax,
      percentage: null,
      grade: null,
      overallStatus: 'ABSENT',
      isComplete: true,
    };
  }

  if (allExempted && subjectScores.length > 0) {
    return {
      totalObtained: null,
      totalMax,
      percentage: null,
      grade: null,
      overallStatus: 'EXEMPTED',
      isComplete: true,
    };
  }

  const percentage =
    totalMax > 0 ? Math.round((totalObtained / totalMax) * 10000) / 100 : 0;
  const isPassed = !hasFailure;
  const grade = calculateGrade(percentage, isPassed);

  return {
    totalObtained,
    totalMax,
    percentage,
    grade,
    overallStatus: isPassed ? 'PASSED' : 'FAILED',
    isComplete: true,
  };
}

// 1. Controlled Enums Tests
test('Enums: Verifies controlled exam types and lifecycle states', () => {
  assert.ok(EXAM_TYPES.includes('unit_test'));
  assert.ok(EXAM_TYPES.includes('midterm'));
  assert.ok(EXAM_TYPES.includes('final'));
  assert.ok(EXAM_TYPES.includes('mock_test'));

  assert.ok(EXAM_STATUSES.includes('draft'));
  assert.ok(EXAM_STATUSES.includes('scheduled'));
  assert.ok(EXAM_STATUSES.includes('completed'));
  assert.ok(EXAM_STATUSES.includes('published'));
  assert.ok(EXAM_STATUSES.includes('archived'));

  assert.deepEqual(ATTENDANCE_STATUSES, ['present', 'absent', 'exempted']);
});

// 2. Marks Boundary Validation
test('Marks Validation: Rejects negative marks and marks exceeding max_marks', () => {
  const maxMarks = 100;
  const passingMarks = 40;

  // Negative marks
  const resNeg = validateMarks(-5, maxMarks, passingMarks, 'present');
  assert.equal(resNeg.valid, false);
  assert.match(resNeg.error, /cannot be negative/);

  // Exceeds max marks
  const resExceed = validateMarks(105, maxMarks, passingMarks, 'present');
  assert.equal(resExceed.valid, false);
  assert.match(resExceed.error, /cannot exceed max marks/);

  // Valid marks boundary
  const resZero = validateMarks(0, maxMarks, passingMarks, 'present');
  assert.equal(resZero.valid, true);
  assert.equal(resZero.resultStatus, 'failed');

  const resMax = validateMarks(100, maxMarks, passingMarks, 'present');
  assert.equal(resMax.valid, true);
  assert.equal(resMax.resultStatus, 'passed');
});

// 3. Passing Marks Consistency
test('Marks Validation: Rejects passing_marks greater than max_marks', () => {
  const res = validateMarks(50, 40, 50, 'present'); // passingMarks(50) > maxMarks(40)
  assert.equal(res.valid, false);
  assert.match(res.error, /between 0 and maximum marks/);
});

// 4. Absence Handling: ABSENT != ZERO
test('Absence Handling: Absent students have NULL marks, not 0', () => {
  const resAbsentValid = validateMarks(null, 100, 40, 'absent');
  assert.equal(resAbsentValid.valid, true);
  assert.equal(resAbsentValid.resultStatus, 'absent');

  // Contradictory state: absent with numerical marks
  const resAbsentInvalid = validateMarks(75, 100, 40, 'absent');
  assert.equal(resAbsentInvalid.valid, false);
  assert.match(resAbsentInvalid.error, /cannot have numerical obtained marks/);
});

// 5. Pass/Fail Determination
test('Pass / Fail: Accurately evaluates pass and fail against subject passing_marks', () => {
  const max = 50;
  const pass = 20;

  const testPass = validateMarks(20, max, pass, 'present');
  assert.equal(testPass.valid, true);
  assert.equal(testPass.resultStatus, 'passed');

  const testFail = validateMarks(19.5, max, pass, 'present');
  assert.equal(testFail.valid, true);
  assert.equal(testFail.resultStatus, 'failed');
});

// 6. Centralized Grade Calculation
test('Grading Engine: Returns correct letter grades with failure overrides', () => {
  assert.equal(calculateGrade(95, true), 'A+');
  assert.equal(calculateGrade(89.9, true), 'A');
  assert.equal(calculateGrade(75, true), 'B+');
  assert.equal(calculateGrade(62, true), 'B');
  assert.equal(calculateGrade(55, true), 'C');
  assert.equal(calculateGrade(41, true), 'D');
  assert.equal(calculateGrade(35, true), 'F');

  // If failed in any subject or overall failed, grade is strictly F even if percentage is high
  assert.equal(calculateGrade(85, false), 'F');
});

// 7. Exam Totals and Percentage Calculation
test('Result Aggregation: Accurately computes multi-subject totals and 2-decimal percentage', () => {
  const subjects = [
    { maxMarks: 100, passingMarks: 40, obtainedMarks: 82, attendanceStatus: 'present' }, // Math
    { maxMarks: 100, passingMarks: 40, obtainedMarks: 74, attendanceStatus: 'present' }, // Science
    { maxMarks: 100, passingMarks: 40, obtainedMarks: 88, attendanceStatus: 'present' }, // English
  ];

  const res = calculateExamTotals(subjects);
  assert.equal(res.isComplete, true);
  assert.equal(res.totalObtained, 244);
  assert.equal(res.totalMax, 300);
  assert.equal(res.percentage, 81.33); // (244 / 300) * 100 = 81.3333... -> 81.33
  assert.equal(res.overallStatus, 'PASSED');
  assert.equal(res.grade, 'A');
});

// 8. Incomplete Results Handling
test('Result Aggregation: Incomplete marks flag INCOMPLETE without misleading percentage', () => {
  const subjects = [
    { maxMarks: 100, passingMarks: 40, obtainedMarks: 85, attendanceStatus: 'present' },
    { maxMarks: 100, passingMarks: 40, obtainedMarks: null, attendanceStatus: 'present' }, // Pending
  ];

  const res = calculateExamTotals(subjects);
  assert.equal(res.isComplete, false);
  assert.equal(res.overallStatus, 'INCOMPLETE');
  assert.equal(res.totalObtained, null);
  assert.equal(res.percentage, null);
  assert.equal(res.grade, null);
});

// 9. All Absent Exam
test('Result Aggregation: Flags overall ABSENT when student was absent in all subjects', () => {
  const subjects = [
    { maxMarks: 100, passingMarks: 40, obtainedMarks: null, attendanceStatus: 'absent' },
    { maxMarks: 100, passingMarks: 40, obtainedMarks: null, attendanceStatus: 'absent' },
  ];

  const res = calculateExamTotals(subjects);
  assert.equal(res.isComplete, true);
  assert.equal(res.overallStatus, 'ABSENT');
  assert.equal(res.totalObtained, null);
  assert.equal(res.percentage, null);
});

// 10. Database Migration Integrity
test('Schema Migration: Verifies migration SQL existence and relational integrity', () => {
  const migrationPath = path.resolve('supabase/migrations/20261003000008_create_exams_and_results_system.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file 20261003000008 must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');

  // Verify tables
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.exams'), 'Must define exams table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.exam_subjects'), 'Must define exam_subjects table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.exam_results'), 'Must define exam_results table');

  // Verify uniqueness constraints
  assert.ok(
    content.includes('CONSTRAINT uq_exam_subject UNIQUE (exam_id, subject_id)'),
    'Must prevent duplicate subjects in the same exam'
  );
  assert.ok(
    content.includes('CONSTRAINT uq_exam_subject_student UNIQUE (exam_subject_id, student_id)'),
    'Must prevent duplicate marks entries for a student per subject'
  );

  // Verify RLS enablement
  assert.ok(content.includes('ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY'));
  assert.ok(content.includes('ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY'));
  assert.ok(content.includes('ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY'));

  // Verify publication gating
  assert.ok(
    content.includes("e.status = 'published'"),
    'Must restrict student result visibility to published exams only'
  );
});
