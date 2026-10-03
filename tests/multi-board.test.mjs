import test from 'node:test';
import assert from 'node:assert/strict';

// Multi-Board Academic Test Matrix
const BOARDS = {
  CBSE: 'b0000000-0000-0000-0000-000000000001',
  ICSE: 'b0000000-0000-0000-0000-000000000002',
  BSEB: 'b0000000-0000-0000-0000-000000000003',
};

const CLASSES = {
  CLASS_9: 'c0000000-0000-0000-0000-000000000009',
  CLASS_10: 'c0000000-0000-0000-0000-000000000010',
  CLASS_11: 'c0000000-0000-0000-0000-000000000011',
  CLASS_12: 'c0000000-0000-0000-0000-000000000012',
};

// Simulated academic context filtering matching RLS & service logic
function canStudentAccessAcademicItem(studentEnrollment, itemTarget) {
  // If target board is specified, must match student's board
  if (itemTarget.board_id && itemTarget.board_id !== studentEnrollment.board_id) {
    return false;
  }
  // If target class is specified, must match student's class
  if (itemTarget.class_level_id && itemTarget.class_level_id !== studentEnrollment.class_level_id) {
    return false;
  }
  // If target batch is specified, must match student's batch
  if (itemTarget.batch_id && itemTarget.batch_id !== studentEnrollment.batch_id) {
    return false;
  }
  return true;
}

function canTeacherManageContext(teacherAssignments, targetContext) {
  return teacherAssignments.some((assignment) => {
    const boardMatch = !assignment.board_id || assignment.board_id === targetContext.board_id;
    const classMatch = !assignment.class_level_id || assignment.class_level_id === targetContext.class_level_id;
    const batchMatch = !assignment.batch_id || assignment.batch_id === targetContext.batch_id;
    const subjectMatch = !assignment.subject_id || assignment.subject_id === targetContext.subject_id;
    return boardMatch && classMatch && batchMatch && subjectMatch;
  });
}

test('1. Multi-Board Isolation: CBSE student cannot access ICSE or BSEB materials', () => {
  const cbseStudent = {
    student_id: 's-cbse-01',
    board_id: BOARDS.CBSE,
    class_level_id: CLASSES.CLASS_10,
    batch_id: 'batch-cbse-10a',
  };

  const icseMaterial = { id: 'mat-icse-01', board_id: BOARDS.ICSE, class_level_id: CLASSES.CLASS_10 };
  const bsebMaterial = { id: 'mat-bseb-01', board_id: BOARDS.BSEB, class_level_id: CLASSES.CLASS_10 };
  const cbseMaterial = { id: 'mat-cbse-01', board_id: BOARDS.CBSE, class_level_id: CLASSES.CLASS_10 };

  assert.equal(canStudentAccessAcademicItem(cbseStudent, icseMaterial), false);
  assert.equal(canStudentAccessAcademicItem(cbseStudent, bsebMaterial), false);
  assert.equal(canStudentAccessAcademicItem(cbseStudent, cbseMaterial), true);
});

test('2. Multi-Board Isolation: ICSE student cannot access BSEB or CBSE announcements', () => {
  const icseStudent = {
    student_id: 's-icse-01',
    board_id: BOARDS.ICSE,
    class_level_id: CLASSES.CLASS_12,
    batch_id: 'batch-icse-12',
  };

  const bsebAnnouncement = { id: 'ann-bseb-01', board_id: BOARDS.BSEB, class_level_id: CLASSES.CLASS_12 };
  const cbseAnnouncement = { id: 'ann-cbse-01', board_id: BOARDS.CBSE, class_level_id: CLASSES.CLASS_12 };
  const icseAnnouncement = { id: 'ann-icse-01', board_id: BOARDS.ICSE, class_level_id: CLASSES.CLASS_12 };

  assert.equal(canStudentAccessAcademicItem(icseStudent, bsebAnnouncement), false);
  assert.equal(canStudentAccessAcademicItem(icseStudent, cbseAnnouncement), false);
  assert.equal(canStudentAccessAcademicItem(icseStudent, icseAnnouncement), true);
});

test('3. Multi-Board Isolation: BSEB student cannot access CBSE or ICSE exams', () => {
  const bsebStudent = {
    student_id: 's-bseb-01',
    board_id: BOARDS.BSEB,
    class_level_id: CLASSES.CLASS_9,
    batch_id: 'batch-bseb-9',
  };

  const cbseExam = { id: 'exam-cbse-01', board_id: BOARDS.CBSE, class_level_id: CLASSES.CLASS_9 };
  const icseExam = { id: 'exam-icse-01', board_id: BOARDS.ICSE, class_level_id: CLASSES.CLASS_9 };
  const bsebExam = { id: 'exam-bseb-01', board_id: BOARDS.BSEB, class_level_id: CLASSES.CLASS_9 };

  assert.equal(canStudentAccessAcademicItem(bsebStudent, cbseExam), false);
  assert.equal(canStudentAccessAcademicItem(bsebStudent, icseExam), false);
  assert.equal(canStudentAccessAcademicItem(bsebStudent, bsebExam), true);
});

test('4. Class Hierarchy Isolation: Class 9 student cannot access Class 10/11/12 tests or assignments', () => {
  const class9Student = {
    student_id: 's-c9-01',
    board_id: BOARDS.CBSE,
    class_level_id: CLASSES.CLASS_9,
    batch_id: 'batch-9',
  };

  const class10Assignment = { id: 'assign-c10', board_id: BOARDS.CBSE, class_level_id: CLASSES.CLASS_10 };
  const class11Assignment = { id: 'assign-c11', board_id: BOARDS.CBSE, class_level_id: CLASSES.CLASS_11 };
  const class12Assignment = { id: 'assign-c12', board_id: BOARDS.CBSE, class_level_id: CLASSES.CLASS_12 };
  const class9Assignment = { id: 'assign-c9', board_id: BOARDS.CBSE, class_level_id: CLASSES.CLASS_9 };

  assert.equal(canStudentAccessAcademicItem(class9Student, class10Assignment), false);
  assert.equal(canStudentAccessAcademicItem(class9Student, class11Assignment), false);
  assert.equal(canStudentAccessAcademicItem(class9Student, class12Assignment), false);
  assert.equal(canStudentAccessAcademicItem(class9Student, class9Assignment), true);
});

test('5. Teacher Academic Assignment Scoping: Teacher restricted to assigned boards and classes', () => {
  const teacherAssignments = [
    {
      board_id: BOARDS.CBSE,
      class_level_id: CLASSES.CLASS_10,
      batch_id: 'batch-cbse-10a',
      subject_id: 'subj-math',
    },
    {
      board_id: BOARDS.CBSE,
      class_level_id: CLASSES.CLASS_10,
      batch_id: 'batch-cbse-10b',
      subject_id: 'subj-math',
    },
  ];

  // Authorized target
  const assignedContext = {
    board_id: BOARDS.CBSE,
    class_level_id: CLASSES.CLASS_10,
    batch_id: 'batch-cbse-10a',
    subject_id: 'subj-math',
  };
  assert.equal(canTeacherManageContext(teacherAssignments, assignedContext), true);

  // Unauthorized board (ICSE)
  const icseContext = {
    board_id: BOARDS.ICSE,
    class_level_id: CLASSES.CLASS_10,
    batch_id: 'batch-icse-10',
    subject_id: 'subj-math',
  };
  assert.equal(canTeacherManageContext(teacherAssignments, icseContext), false);

  // Unauthorized class (Class 12)
  const class12Context = {
    board_id: BOARDS.CBSE,
    class_level_id: CLASSES.CLASS_12,
    batch_id: 'batch-cbse-12',
    subject_id: 'subj-math',
  };
  assert.equal(canTeacherManageContext(teacherAssignments, class12Context), false);

  // Unauthorized subject (Physics)
  const physicsContext = {
    board_id: BOARDS.CBSE,
    class_level_id: CLASSES.CLASS_10,
    batch_id: 'batch-cbse-10a',
    subject_id: 'subj-phys',
  };
  assert.equal(canTeacherManageContext(teacherAssignments, physicsContext), false);
});
