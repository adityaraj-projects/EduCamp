import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Constants matching src/types/assignment.ts
const MAX_ASSIGNMENT_FILE_SIZE_BYTES = 26214400; // 25 MB
const ALLOWED_ASSIGNMENT_MIME_TYPES = ['application/pdf'];
const ASSIGNMENT_STATUSES = ['draft', 'published', 'closed', 'archived'];
const SUBMISSION_STATUSES = ['pending', 'submitted', 'reviewed', 'late'];

// File validation helper replicating client & database validation
function validateAssignmentFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }
  if (!ALLOWED_ASSIGNMENT_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type (${file.type}). Only PDF files (.pdf) are permitted.` };
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'File must have a valid .pdf extension.' };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'File is empty.' };
  }
  if (file.size > MAX_ASSIGNMENT_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File size (${sizeMB} MB) exceeds 25 MB limit.` };
  }
  return { valid: true, error: null };
}

// Marks validation helper
function validateMarks(marks, maxMarks) {
  if (marks === null || marks === undefined) {
    return { valid: true, error: null };
  }
  if (typeof marks !== 'number' || isNaN(marks)) {
    return { valid: false, error: 'Marks must be a valid number' };
  }
  if (marks < 0) {
    return { valid: false, error: 'Marks cannot be negative' };
  }
  if (maxMarks !== null && maxMarks !== undefined && marks > maxMarks) {
    return { valid: false, error: `Marks (${marks}) cannot exceed maximum allowed marks (${maxMarks})` };
  }
  return { valid: true, error: null };
}

// Overdue status derivation helper
function deriveSubmissionStatus(submittedAt, dueAt, allowLate) {
  const isLate = new Date(submittedAt) > new Date(dueAt);
  if (isLate) {
    if (!allowLate) {
      throw new Error('Late submissions are not accepted for this assignment');
    }
    return 'late';
  }
  return 'submitted';
}

// Storage path builders
function generateBriefStoragePath(academicYearId, assignmentId, rawFileName) {
  const sanitized = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
  return `assignments/${academicYearId}/${assignmentId}/brief/${sanitized}`;
}

function generateSubmissionStoragePath(academicYearId, assignmentId, studentId, rawFileName) {
  const sanitized = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
  return `assignments/${academicYearId}/${assignmentId}/submissions/${studentId}/${sanitized}`;
}

test('File Validation: Rejects non-PDF file formats', () => {
  const exe = { name: 'virus.exe', type: 'application/x-msdownload', size: 1024 };
  const res1 = validateAssignmentFile(exe);
  assert.equal(res1.valid, false);
  assert.match(res1.error, /Invalid file type/);

  const png = { name: 'diagram.png', type: 'image/png', size: 2048 };
  const res2 = validateAssignmentFile(png);
  assert.equal(res2.valid, false);

  const docx = { name: 'homework.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 5000 };
  const res3 = validateAssignmentFile(docx);
  assert.equal(res3.valid, false);
});

test('File Validation: Rejects disguised extensions and empty files', () => {
  const disguised = { name: 'notes.pdf.sh', type: 'application/pdf', size: 500 };
  const resDisguised = validateAssignmentFile(disguised);
  assert.equal(resDisguised.valid, false);
  assert.match(resDisguised.error, /valid \.pdf extension/);

  const empty = { name: 'empty.pdf', type: 'application/pdf', size: 0 };
  const resEmpty = validateAssignmentFile(empty);
  assert.equal(resEmpty.valid, false);
  assert.match(resEmpty.error, /File is empty/);
});

test('File Validation: Rejects files exceeding 25 MB', () => {
  const oversized = { name: 'large_work.pdf', type: 'application/pdf', size: 26214401 };
  const res = validateAssignmentFile(oversized);
  assert.equal(res.valid, false);
  assert.match(res.error, /exceeds 25 MB limit/);
});

test('File Validation: Accepts legitimate PDF files within 25 MB', () => {
  const valid = { name: 'Class_10_Quadratic_Equations.pdf', type: 'application/pdf', size: 4500000 };
  const res = validateAssignmentFile(valid);
  assert.equal(res.valid, true);
  assert.equal(res.error, null);
});

test('Marks Validation: Enforces lower and upper boundaries (0 to max_marks)', () => {
  // Valid marks within bounds
  assert.equal(validateMarks(15, 20).valid, true);
  assert.equal(validateMarks(0, 20).valid, true);
  assert.equal(validateMarks(20, 20).valid, true);
  assert.equal(validateMarks(null, 20).valid, true);

  // Negative marks rejected
  const resNegative = validateMarks(-1, 20);
  assert.equal(resNegative.valid, false);
  assert.match(resNegative.error, /cannot be negative/);

  // Exceeding max marks rejected
  const resExceeding = validateMarks(21, 20);
  assert.equal(resExceeding.valid, false);
  assert.match(resExceeding.error, /cannot exceed maximum allowed marks/);
});

test('Due Date & Late Submission Logic: Flags late submissions and enforces policy', () => {
  const dueAt = '2026-10-10T12:00:00Z';
  const beforeDue = '2026-10-09T10:00:00Z';
  const afterDue = '2026-10-10T14:00:00Z';

  // On time
  assert.equal(deriveSubmissionStatus(beforeDue, dueAt, false), 'submitted');

  // Late submission allowed
  assert.equal(deriveSubmissionStatus(afterDue, dueAt, true), 'late');

  // Late submission blocked when allowLate is false
  assert.throws(
    () => deriveSubmissionStatus(afterDue, dueAt, false),
    /Late submissions are not accepted/
  );
});

test('Storage Paths: Generates non-PII paths with stable IDs', () => {
  const briefPath = generateBriefStoragePath('ay-uuid', 'asgn-uuid', 'Chapter 5 Worksheet (Final).pdf');
  assert.equal(briefPath, 'assignments/ay-uuid/asgn-uuid/brief/chapter_5_worksheet__final_.pdf');
  assert.doesNotMatch(briefPath, /student/i);
  assert.doesNotMatch(briefPath, /[0-9]{10}/);

  const subPath = generateSubmissionStoragePath('ay-uuid', 'asgn-uuid', 'student-uuid-42', 'My Homework Sol.pdf');
  assert.equal(subPath, 'assignments/ay-uuid/asgn-uuid/submissions/student-uuid-42/my_homework_sol.pdf');
  assert.doesNotMatch(subPath, /@/); // No email
  assert.doesNotMatch(subPath, /[0-9]{10}/); // No phone number
});

test('Controlled Statuses: All statuses are properly catalogued', () => {
  assert.equal(ASSIGNMENT_STATUSES.length, 4);
  assert.ok(ASSIGNMENT_STATUSES.includes('draft'));
  assert.ok(ASSIGNMENT_STATUSES.includes('published'));
  assert.ok(ASSIGNMENT_STATUSES.includes('closed'));
  assert.ok(ASSIGNMENT_STATUSES.includes('archived'));

  assert.equal(SUBMISSION_STATUSES.length, 4);
  assert.ok(SUBMISSION_STATUSES.includes('pending'));
  assert.ok(SUBMISSION_STATUSES.includes('submitted'));
  assert.ok(SUBMISSION_STATUSES.includes('reviewed'));
  assert.ok(SUBMISSION_STATUSES.includes('late'));
});

test('Database Migration: Migration file 20261003000007_create_assignments_system.sql is present and valid', () => {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261003000007_create_assignments_system.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

  const content = fs.readFileSync(migrationPath, 'utf-8');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.assignments'), 'Must create assignments table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.assignment_submissions'), 'Must create assignment_submissions table');
  assert.ok(content.includes('uq_student_assignment_submission'), 'Must enforce single submission constraint per student');
  assert.ok(content.includes('assignment-files'), 'Must configure assignment-files bucket');
  assert.ok(content.includes('assignment_files_storage_select'), 'Must enforce storage SELECT policy');
  assert.ok(content.includes('assignment_files_storage_insert'), 'Must enforce storage INSERT policy');
  assert.ok(content.includes('is_teacher_authorized_for_assignment'), 'Must have teacher authorization function');
  assert.ok(content.includes('can_student_access_assignment'), 'Must have student authorization function');
  assert.ok(content.includes('validate_assignment_consistency'), 'Must have assignment validation trigger');
  assert.ok(content.includes('validate_submission_consistency'), 'Must have submission validation trigger');
});
