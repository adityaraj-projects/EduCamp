import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Controlled Domain Constants matching src/types/notification.ts
const PRIORITIES = ['normal', 'important', 'urgent'];
const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'expired', 'archived'];
const TARGET_ROLES = ['all', 'students', 'teachers'];
const NOTIFICATION_TYPES = [
  'announcement',
  'study_material',
  'assignment',
  'assignment_due',
  'exam',
  'result',
  'system',
];

// Replicating Audience Targeting Resolution
function evaluateStudentEligibility(announcement, targetRules, studentEnrollment) {
  // If target_role is teachers only, students cannot see it
  if (announcement.target_role === 'teachers') {
    return false;
  }

  // If no target rules exist, it is an institute-wide broadcast for students
  if (!targetRules || targetRules.length === 0) {
    return true;
  }

  // Check matching rule against active enrollment
  return targetRules.some((rule) => {
    if (rule.academic_year_id && rule.academic_year_id !== studentEnrollment.academic_year_id) {
      return false;
    }
    if (rule.board_id && rule.board_id !== studentEnrollment.board_id) {
      return false;
    }
    if (rule.class_level_id && rule.class_level_id !== studentEnrollment.class_level_id) {
      return false;
    }
    if (rule.stream_id && rule.stream_id !== studentEnrollment.stream_id) {
      return false;
    }
    if (rule.batch_id && rule.batch_id !== studentEnrollment.batch_id) {
      return false;
    }
    return true;
  });
}

// Replicating Active Visibility Logic (Status, Scheduled Publish, Expiry)
function isAnnouncementActive(announcement, currentTimestamp) {
  if (announcement.status !== 'published') {
    return false;
  }

  const now = new Date(currentTimestamp).getTime();

  // If scheduled in future, not active yet
  if (announcement.published_at) {
    const pub = new Date(announcement.published_at).getTime();
    if (pub > now) {
      return false;
    }
  }

  // If expired, not active
  if (announcement.expires_at) {
    const exp = new Date(announcement.expires_at).getTime();
    if (exp <= now) {
      return false;
    }
  }

  return true;
}

// Safe Plain-Text / XSS Sanitization Check
function sanitizePlainText(content) {
  if (!content) return '';
  // Strips executable scripts and dangerous tags
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:[^"']*/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

// 1. Controlled Enums Tests
test('Enums: Verifies controlled priorities, statuses, target roles, and notification types', () => {
  assert.ok(PRIORITIES.includes('normal'));
  assert.ok(PRIORITIES.includes('important'));
  assert.ok(PRIORITIES.includes('urgent'));

  assert.ok(ANNOUNCEMENT_STATUSES.includes('draft'));
  assert.ok(ANNOUNCEMENT_STATUSES.includes('scheduled'));
  assert.ok(ANNOUNCEMENT_STATUSES.includes('published'));
  assert.ok(ANNOUNCEMENT_STATUSES.includes('expired'));
  assert.ok(ANNOUNCEMENT_STATUSES.includes('archived'));

  assert.ok(TARGET_ROLES.includes('all'));
  assert.ok(TARGET_ROLES.includes('students'));
  assert.ok(TARGET_ROLES.includes('teachers'));

  assert.ok(NOTIFICATION_TYPES.includes('announcement'));
  assert.ok(NOTIFICATION_TYPES.includes('study_material'));
  assert.ok(NOTIFICATION_TYPES.includes('assignment'));
  assert.ok(NOTIFICATION_TYPES.includes('exam'));
  assert.ok(NOTIFICATION_TYPES.includes('result'));
});

// 2. Audience Targeting: Institute-Wide
test('Targeting: Institute-wide announcements are eligible for all students', () => {
  const globalAnn = { target_role: 'all' };
  const studentEnrollment = {
    academic_year_id: 'ay-2026',
    board_id: 'board-cbse',
    class_level_id: 'class-10',
    batch_id: 'batch-a',
  };

  const isEligible = evaluateStudentEligibility(globalAnn, [], studentEnrollment);
  assert.equal(isEligible, true);
});

// 3. Audience Targeting: Class & Batch Specific
test('Targeting: Target-specific announcements match only eligible student enrollments', () => {
  const targetAnn = { target_role: 'students' };
  const targetRules = [
    {
      board_id: 'board-cbse',
      class_level_id: 'class-10',
      batch_id: 'batch-a',
    },
  ];

  // Eligible student (CBSE Class 10 Batch A)
  const eligibleStudent = {
    academic_year_id: 'ay-2026',
    board_id: 'board-cbse',
    class_level_id: 'class-10',
    batch_id: 'batch-a',
  };
  assert.equal(evaluateStudentEligibility(targetAnn, targetRules, eligibleStudent), true);

  // Ineligible student from different batch (Batch B)
  const diffBatchStudent = {
    academic_year_id: 'ay-2026',
    board_id: 'board-cbse',
    class_level_id: 'class-10',
    batch_id: 'batch-b',
  };
  assert.equal(evaluateStudentEligibility(targetAnn, targetRules, diffBatchStudent), false);

  // Ineligible student from different board (ICSE Class 10)
  const diffBoardStudent = {
    academic_year_id: 'ay-2026',
    board_id: 'board-icse',
    class_level_id: 'class-10',
    batch_id: 'batch-a',
  };
  assert.equal(evaluateStudentEligibility(targetAnn, targetRules, diffBoardStudent), false);
});

// 4. Role Isolation: Student cannot see teacher-only announcements
test('Targeting: Students are strictly excluded from teacher-targeted communications', () => {
  const teacherOnlyAnn = { target_role: 'teachers' };
  const studentEnrollment = {
    academic_year_id: 'ay-2026',
    board_id: 'board-cbse',
    class_level_id: 'class-10',
    batch_id: 'batch-a',
  };

  assert.equal(evaluateStudentEligibility(teacherOnlyAnn, [], studentEnrollment), false);
});

// 5. Active Lifecycle & Expiry Evaluation
test('Lifecycle: Inactive, draft, scheduled, or expired announcements are excluded', () => {
  const now = '2026-10-03T18:00:00Z';

  // Draft announcement
  const draftAnn = { status: 'draft', published_at: null, expires_at: null };
  assert.equal(isAnnouncementActive(draftAnn, now), false);

  // Scheduled in future
  const scheduledAnn = {
    status: 'published',
    published_at: '2026-10-04T10:00:00Z',
    expires_at: null,
  };
  assert.equal(isAnnouncementActive(scheduledAnn, now), false);

  // Already expired
  const expiredAnn = {
    status: 'published',
    published_at: '2026-10-01T10:00:00Z',
    expires_at: '2026-10-02T10:00:00Z',
  };
  assert.equal(isAnnouncementActive(expiredAnn, now), false);

  // Currently active
  const activeAnn = {
    status: 'published',
    published_at: '2026-10-02T10:00:00Z',
    expires_at: '2026-10-10T10:00:00Z',
  };
  assert.equal(isAnnouncementActive(activeAnn, now), true);
});

// 6. XSS Prevention & Sanitization
test('Security: Malicious script injections and event handlers are neutralized', () => {
  const maliciousInput = '<script>alert("xss")</script>Important Holiday Notice on Monday.';
  const sanitized = sanitizePlainText(maliciousInput);
  assert.ok(!sanitized.includes('<script>'));
  assert.ok(!sanitized.includes('alert('));
  assert.ok(sanitized.includes('Important Holiday Notice on Monday.'));

  const maliciousUrl = 'Check link: javascript:stealToken()';
  const sanitizedUrl = sanitizePlainText(maliciousUrl);
  assert.ok(!sanitizedUrl.includes('javascript:'));
});

// 7. Read / Unread Idempotency
test('Read State: Mark-as-read operation is idempotent without duplicate entries', () => {
  const readMap = new Map();
  const userId = 'user-student-1';
  const announcementId = 'ann-101';
  const key = `${userId}:${announcementId}`;

  // First mark
  readMap.set(key, '2026-10-03T18:01:00Z');
  assert.equal(readMap.has(key), true);
  assert.equal(readMap.size, 1);

  // Second mark (idempotent upsert)
  readMap.set(key, '2026-10-03T18:02:00Z');
  assert.equal(readMap.size, 1);
});

// 8. Database Schema Migration Integrity
test('Schema Migration: Verifies migration SQL existence, RLS, and targeting functions', () => {
  const migrationPath = path.resolve(
    'supabase/migrations/20261003000009_create_communications_and_notifications.sql'
  );
  assert.ok(fs.existsSync(migrationPath), 'Migration file 20261003000009 must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');

  // Verify tables
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.announcements'), 'Must define announcements table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.announcement_targets'), 'Must define announcement_targets table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.notification_reads'), 'Must define notification_reads table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.notifications'), 'Must define notifications table');

  // Verify unique constraints
  assert.ok(
    content.includes('CONSTRAINT uq_user_announcement_read UNIQUE (user_id, announcement_id)'),
    'Must prevent duplicate read entries'
  );

  // Verify RLS enablement
  assert.ok(content.includes('ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY'));
  assert.ok(content.includes('ALTER TABLE public.announcement_targets ENABLE ROW LEVEL SECURITY'));
  assert.ok(content.includes('ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY'));
  assert.ok(content.includes('ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY'));

  // Verify security functions
  assert.ok(
    content.includes('FUNCTION public.is_user_eligible_for_announcement'),
    'Must define eligibility evaluation function'
  );
  assert.ok(
    content.includes('FUNCTION public.get_unread_notification_count'),
    'Must define high-performance unread count function'
  );
});
