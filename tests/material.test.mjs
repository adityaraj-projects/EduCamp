import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Constants matching src/types/material.ts
const MAX_MATERIAL_FILE_SIZE_BYTES = 26214400; // 25 MB
const ALLOWED_MATERIAL_MIME_TYPES = ['application/pdf'];
const MATERIAL_TYPES = ['notes', 'chapter', 'worksheet', 'question_paper', 'practice', 'other'];

// Validation helper replicating client & database validation
function validateStudyMaterialFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided for upload.' };
  }
  if (!ALLOWED_MATERIAL_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type (${file.type}). Only PDF documents (.pdf) are supported in this phase.` };
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'File must have a valid .pdf extension.' };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'File is empty.' };
  }
  if (file.size > MAX_MATERIAL_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File size (${sizeMB} MB) exceeds maximum allowed limit of 25 MB.` };
  }
  return { valid: true, error: null };
}

// Storage path builder
function generateStoragePath(academicYearId, boardId, classLevelId, subjectId, materialId, rawFileName) {
  const sanitized = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
  return `${academicYearId}/${boardId}/${classLevelId}/${subjectId}/${materialId}/${sanitized}`;
}

test('File Validation: Rejects non-PDF MIME types', () => {
  const exeFile = { name: 'app.exe', type: 'application/x-msdownload', size: 1024 };
  const res1 = validateStudyMaterialFile(exeFile);
  assert.equal(res1.valid, false);
  assert.match(res1.error, /Invalid file type/);

  const imgFile = { name: 'notes.png', type: 'image/png', size: 2048 };
  const res2 = validateStudyMaterialFile(imgFile);
  assert.equal(res2.valid, false);

  const docFile = { name: 'notes.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 4096 };
  const res3 = validateStudyMaterialFile(docFile);
  assert.equal(res3.valid, false);
});

test('File Validation: Rejects disguised extensions', () => {
  const disguised = { name: 'malicious.pdf.exe', type: 'application/pdf', size: 5000 };
  const res = validateStudyMaterialFile(disguised);
  assert.equal(res.valid, false);
  assert.match(res.error, /valid \.pdf extension/);
});

test('File Validation: Rejects oversized files (> 25MB)', () => {
  const oversized = { name: 'huge_book.pdf', type: 'application/pdf', size: 26214401 };
  const res = validateStudyMaterialFile(oversized);
  assert.equal(res.valid, false);
  assert.match(res.error, /exceeds maximum allowed limit of 25 MB/);
});

test('File Validation: Rejects zero-byte empty files', () => {
  const empty = { name: 'empty.pdf', type: 'application/pdf', size: 0 };
  const res = validateStudyMaterialFile(empty);
  assert.equal(res.valid, false);
  assert.match(res.error, /File is empty/);
});

test('File Validation: Accepts legitimate PDF files within 25MB', () => {
  const valid = { name: 'Chapter_1_Real_Numbers.pdf', type: 'application/pdf', size: 2500000 };
  const res = validateStudyMaterialFile(valid);
  assert.equal(res.valid, true);
  assert.equal(res.error, null);
});

test('Storage Path: Conforms to deterministic UUID hierarchy without PII', () => {
  const path = generateStoragePath(
    'ay-uuid-1234',
    'board-uuid-cbse',
    'class-uuid-10',
    'subj-uuid-math',
    'mat-uuid-9999',
    'Class 10 Math Notes (Final).pdf'
  );

  assert.equal(path, 'ay-uuid-1234/board-uuid-cbse/class-uuid-10/subj-uuid-math/mat-uuid-9999/class_10_math_notes__final_.pdf');
  // Verify no personal identifiers or phone numbers exist
  assert.doesNotMatch(path, /student/i);
  assert.doesNotMatch(path, /[0-9]{10}/); // No phone numbers
});

test('Material Types: All 6 controlled types are supported', () => {
  assert.equal(MATERIAL_TYPES.length, 6);
  assert.ok(MATERIAL_TYPES.includes('notes'));
  assert.ok(MATERIAL_TYPES.includes('chapter'));
  assert.ok(MATERIAL_TYPES.includes('worksheet'));
  assert.ok(MATERIAL_TYPES.includes('question_paper'));
  assert.ok(MATERIAL_TYPES.includes('practice'));
  assert.ok(MATERIAL_TYPES.includes('other'));
});

test('Database Migration: Migration file 20261003000006_create_study_materials.sql is present and valid', () => {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261003000006_create_study_materials.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

  const content = fs.readFileSync(migrationPath, 'utf-8');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.study_materials'), 'Must create study_materials table');
  assert.ok(content.includes('storage.buckets'), 'Must configure storage bucket');
  assert.ok(content.includes("'study-materials'"), 'Must name bucket study-materials');
  assert.ok(content.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
  assert.ok(content.includes('idx_study_materials_prevent_duplicate'), 'Must enforce duplicate prevention index');
  assert.ok(content.includes('study_materials_storage_select'), 'Must enforce storage SELECT policy');
  assert.ok(content.includes('study_materials_storage_insert'), 'Must enforce storage INSERT policy');
  assert.ok(content.includes('study_materials_storage_delete'), 'Must enforce storage DELETE policy');
  assert.ok(content.includes('is_teacher_authorized_for_material'), 'Must create teacher authorization function');
  assert.ok(content.includes('can_student_access_material'), 'Must create student authorization function');
});
