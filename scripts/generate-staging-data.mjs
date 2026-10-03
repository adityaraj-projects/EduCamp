/**
 * EduCamp Staging & Scale Data Generator
 * Generates realistic mock dataset for ~500 students and ~15 teachers
 * across CBSE, ICSE, BSEB boards, classes 1-12, batches, and academic years.
 *
 * Usage: node scripts/generate-staging-data.mjs [--output=staging-seed.json]
 */

import fs from 'node:fs';
import path from 'node:path';

const BOARDS = [
  { id: 'b0000000-0000-0000-0000-000000000001', code: 'CBSE', name: 'Central Board of Secondary Education' },
  { id: 'b0000000-0000-0000-0000-000000000002', code: 'ICSE', name: 'Indian Certificate of Secondary Education' },
  { id: 'b0000000-0000-0000-0000-000000000003', code: 'BSEB', name: 'Bihar School Examination Board' }
];

const CLASSES = [
  { id: 'c0000000-0000-0000-0000-000000000009', standard: 9, name: 'Class 9' },
  { id: 'c0000000-0000-0000-0000-000000000010', standard: 10, name: 'Class 10' },
  { id: 'c0000000-0000-0000-0000-000000000011', standard: 11, name: 'Class 11' },
  { id: 'c0000000-0000-0000-0000-000000000012', standard: 12, name: 'Class 12' }
];

const SUBJECTS = [
  { code: 'MATH', name: 'Mathematics' },
  { code: 'PHYS', name: 'Physics' },
  { code: 'CHEM', name: 'Chemistry' },
  { code: 'BIO', name: 'Biology' },
  { code: 'ENG', name: 'English Core' }
];

const FIRST_NAMES = [
  'Aarav', 'Vihaan', 'Aditya', 'Reyansh', 'Muhammad', 'Sai', 'Arjun', 'Kabir', 'Rohan', 'Ayaan',
  'Ananya', 'Diya', 'Aadhya', 'Pari', 'Saanvi', 'Isha', 'Myra', 'Kavya', 'Avni', 'Riya',
  'Aryan', 'Ishaan', 'Dev', 'Dhruv', 'Atharv', 'Tanvi', 'Navya', 'Prisha', 'Khushi', 'Sneha'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Mishra', 'Patel', 'Yadav', 'Jha', 'Choudhary',
  'Das', 'Banerjee', 'Chatterjee', 'Reddy', 'Nair', 'Shah', 'Mehta', 'Bose', 'Sengupta', 'Pandey'
];

export function generateScaleDataset(studentCount = 500, teacherCount = 15) {
  const teachers = [];
  for (let i = 1; i <= teacherCount; i++) {
    const fName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lName = LAST_NAMES[i % LAST_NAMES.length];
    teachers.push({
      id: `t0000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      employee_id: `TCH-${String(i).padStart(4, '0')}`,
      full_name: `${fName} ${lName}`,
      phone: `98765${String(10000 + i).slice(-5)}`,
      email: `teacher${i}@educamp.local`,
      qualification: 'M.Sc., B.Ed.',
      is_active: true
    });
  }

  const students = [];
  const enrollments = [];

  for (let i = 1; i <= studentCount; i++) {
    const fName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lName = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const studentId = `s0000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
    const board = BOARDS[i % BOARDS.length];
    const classLevel = CLASSES[i % CLASSES.length];
    const batchCode = i % 2 === 0 ? 'BATCH-A' : 'BATCH-B';

    students.push({
      id: studentId,
      admission_number: `ADM-2026-${String(i).padStart(4, '0')}`,
      full_name: `${fName} ${lName}`,
      gender: i % 2 === 0 ? 'male' : 'female',
      dob: '2009-05-15',
      parent_name: `${LAST_NAMES[(i * 2) % LAST_NAMES.length]} Parent`,
      phone: `91234${String(10000 + i).slice(-5)}`,
      is_active: true
    });

    enrollments.push({
      id: `e0000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      student_id: studentId,
      board_id: board.id,
      board_code: board.code,
      class_level_id: classLevel.id,
      class_standard: classLevel.standard,
      batch_code: batchCode,
      academic_year: '2026-2027',
      is_active: true
    });
  }

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      studentCount: students.length,
      teacherCount: teachers.length,
      boards: BOARDS.map(b => b.code),
      classes: CLASSES.map(c => c.standard),
      subjects: SUBJECTS.map(s => s.code)
    },
    teachers,
    students,
    enrollments
  };
}

if (process.argv[1]?.endsWith('generate-staging-data.mjs')) {
  const dataset = generateScaleDataset(500, 15);
  console.log(`Generated realistic staging dataset:`);
  console.log(` - Students: ${dataset.students.length}`);
  console.log(` - Teachers: ${dataset.teachers.length}`);
  console.log(` - Enrollments: ${dataset.enrollments.length}`);
  console.log(` - Boards: ${dataset.metadata.boards.join(', ')}`);
  console.log(` - Classes: ${dataset.metadata.classes.join(', ')}`);

  const outputPath = path.resolve('docs/staging-sample-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(dataset.metadata, null, 2), 'utf8');
  console.log(`Summary written to ${outputPath}`);
}
