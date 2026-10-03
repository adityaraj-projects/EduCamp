# Phase 8 — Production-Grade Assignments / Homework & Submission System Architecture

## 1. Executive Summary & Design Principles

EduCamp Phase 8 introduces the production-grade coursework management framework, allowing faculty to create, schedule, target, and evaluate homework and assignments, while enabling enrolled students across multiple boards (CBSE, ICSE, BSEB) and classes (1–12) to review instructions, download assignment briefs, submit coursework (written text and PDF documents), and receive faculty marks and constructive feedback.

### Architectural Core Principles:
1. **Normalized Entity Structure**: Clear separation between master assignments (`assignments`), student responses (`assignment_submissions`), and attachments.
2. **Double-Layer Authorization**: Enforced both in PostgreSQL Row Level Security (RLS) and Supabase Storage private object policies. Students can only see published assignments for their enrolled board, class, and batch. Teachers can only create and evaluate assignments for subjects they are assigned to teach (`teacher_assignments`).
3. **Private Document Storage with Zero Public Access**: Assignment briefs and student homework PDFs live in a dedicated private Supabase Storage bucket (`assignment-files`). Direct public URLs are prohibited; access occurs solely through short-lived (5-minute TTL) cryptographic signed URLs.
4. **Draft vs Published Lifecycle**: Teachers prepare coursework in `draft` mode. Coursework only becomes visible to enrolled students once explicitly transitioned to `published`.
5. **Mobile-First & Performance-Optimized**: Browsing assignments loads strictly summary relational metadata. Heavy binaries and signed URLs are generated strictly on demand when a user clicks "Open Attachment" or "Review Submission", maintaining light network usage for ~500 students.
6. **Upload Atomicity & Orphan File Protection**: Uploading briefs or homework submissions follows a safe two-step pattern: file upload to private storage, followed by database insert/update. If database validation fails, the uploaded storage file is immediately cleaned up.
7. **PWA Offline Safety**: The Service Worker workbox caching strategy explicitly avoids caching Supabase Storage signed URLs or student submissions, preventing unauthorized offline data leakage on shared mobile devices.

---

## 2. Entity Relationship Diagram (ERD) & Conceptual Flow

```text
+-----------------------+
|        Teacher        |
|       (teachers)      |
+-----------+-----------+
            |
            | 1-to-Many
            v
+-----------+-----------+          +-----------------------+
|      Assignment       | <------+ |   Board / Class /     |
|     (assignments)     |          |   Subject / Batch     |
+-----------+-----------+          +-----------------------+
      |           |
      | Brief     | Targets
      v           v
+-----------+   +-----------------------+
|  Storage  |   |  Student Enrollment   |
| Attachment|   | (student_enrollments) |
+-----------+   +-----------+-----------+
                            |
                            | 1-to-1 per assignment
                            v
                +-----------+-----------+
                |      Submission       |
                |(assignment_submissions|
                +-----------+-----------+
                      |           |
                      | Work      | Evaluated by Teacher
                      v           v
                +-----------+   +-----------------------+
                |  Storage  |   |    Faculty Review     |
                | Attachment|   | - Marks (0..max_marks)|
                +-----------+   | - Constructive Notes  |
                                | - Reviewed At/By      |
                                +-----------------------+
```

---

## 3. Academic Targeting & Teacher Authorization

1. **Academic Targeting**:
   - Every assignment references:
     - `academic_year_id` (Academic Year)
     - `board_id` and `class_level_id` (Composite foreign key to `board_classes`)
     - `subject_id` (Subject, verified against `board_class_subjects`)
     - `stream_id` (Optional, for higher secondary streams)
     - `batch_id` (Optional: NULL indicates the task applies to all batches of that class; populated restricts to that specific section).
2. **Teacher Authorization Enforcement**:
   - Enforced at database trigger level (`validate_assignment_consistency`) and helper function `is_teacher_authorized_for_assignment`:
     A faculty member can only publish assignments for classes, subjects, and batches where they hold an active assignment in `teacher_assignments`. A Mathematics teacher cannot create Physics homework.

---

## 4. Student Visibility Model

- **Visibility Criteria**:
  Students only receive an assignment if:
  1. `assignments.status IN ('published', 'closed')` (Draft and archived tasks are invisible to students).
  2. The student has an active current enrollment (`is_current = true`, `status = 'enrolled'`) matching `academic_year_id`, `board_id`, and `class_level_id`.
  3. If `stream_id` is defined, it matches the student's enrollment stream.
  4. If `batch_id` is defined, it matches the student's enrolled batch. If `batch_id IS NULL`, all students in that class level see the task.

---

## 5. Controlled Statuses

### Assignment Statuses:
- `draft`: Teacher is preparing the questions or worksheet; students cannot access.
- `published`: Active coursework visible to students; submissions accepted.
- `closed`: Deadline passed or submissions closed; students can no longer submit unless late submission is permitted.
- `archived`: Retired coursework hidden from normal active listings while preserving historical submissions.

### Submission Statuses:
- `pending`: Default state before student submits work.
- `submitted`: Student has submitted written text or PDF before the deadline.
- `late`: Student submitted work after the `due_at` deadline (only permitted if `allow_late_submission = true`).
- `reviewed`: Faculty member has evaluated the submission, awarded marks, and provided feedback.

---

## 6. Deadlines, Late Submissions & Overdue Logic

1. **Timezone-Safe Deadlines**: Stored as `TIMESTAMPTZ` (`due_at`). Comparisons in database triggers use UTC (`now()`).
2. **Late Submission Policy**:
   - `allow_late_submission = false` (default): Database trigger rejects any insert/update attempt after `due_at` with: `'Assignment deadline has passed and late submissions are not permitted'`.
   - `allow_late_submission = true`: Work submitted after `due_at` is accepted and tagged with `status = 'late'`.
3. **Overdue Derivation**: If `now() > due_at` and the student has no submission record, the system dynamically treats the task as Overdue without creating redundant database records.

---

## 7. Submission Architecture & Single Active Submission

- **Database Entity**: `assignment_submissions`
- **Constraint**: `CONSTRAINT uq_student_assignment_submission UNIQUE (assignment_id, student_id)`
  Guarantees that a student has exactly one submission row per assignment. Network retries, rapid double-clicks, or browser refreshes will not create duplicated records.
- **Resubmission Support**: If a student resubmits before grading, the service updates the existing record (`text_response`, `attachment_path`, `submitted_at`), cleanly replacing prior work without breaking referential integrity.

---

## 8. Faculty Evaluation & Marks Validation

1. **Review Fields**:
   - `marks NUMERIC(5, 2)`: Numerical score.
   - `feedback TEXT`: Qualitative notes and guidance.
   - `reviewed_at TIMESTAMPTZ`: Timestamp when review was saved.
   - `reviewed_by UUID`: Profile ID of the faculty reviewer.
2. **Integrity Validation**:
   - Submitting students are blocked from writing or altering `marks`, `feedback`, `reviewed_at`, or `reviewed_by`. Triggers reset these fields to NULL or keep prior values if a student updates their response.
   - Triggers strictly enforce: `marks >= 0`. If `assignments.max_marks` is set, `marks <= max_marks`.

---

## 9. Private Storage & Attachment Strategy

- **Storage Bucket**: `assignment-files` (`public = false`, 25 MB max limit, whitelisted to `application/pdf`).
- **Path Conventions**:
  - Teacher Briefs:
    `assignments/{academic_year_id}/{assignment_id}/brief/{sanitized_filename}.pdf`
  - Student Submissions:
    `assignments/{academic_year_id}/{assignment_id}/submissions/{student_id}/{sanitized_filename}.pdf`
- **PII Protection**: File paths use only stable UUIDs. Zero student names, phone numbers, or email addresses appear in storage keys.
- **Signed URLs**: Generated on demand via `assignmentService.getAttachmentDownloadUrl(storagePath)` with a 300-second (5-minute) TTL. Never stored in PostgreSQL.

---

## 10. Database Row Level Security (RLS)

- **`assignments` Table**:
  - `SELECT`: Admins, assigned teachers, or enrolled students for published tasks.
  - `INSERT`: Admins or authorized teachers (`is_teacher_authorized_for_assignment`).
  - `UPDATE`: Admins or authoring teacher.
  - `DELETE`: Admins only.
- **`assignment_submissions` Table**:
  - `SELECT`: Admins, assigned teachers, or the specific student owner (`student.profile_id = auth.uid()`).
  - `INSERT`: Enrolled student for their own record (`auth.uid() = student.profile_id`) on published assignments.
  - `UPDATE`: Student for own resubmission, or assigned teacher/admin for grading.
  - `DELETE`: Admins only.

---

## 11. Storage Policies (`assignment-files`)

- `SELECT`: Verified against parent `assignments` and `assignment_submissions` records. Unauthorized users receive 403 Forbidden from Supabase Storage.
- `INSERT`: Permitted for active teachers (briefs) and enrolled students (submissions).
- `DELETE`: Admins or the object owner (enabling rollback on failure).

---

## 12. Query Performance & Pagination

- **Selective Column Queries**: List queries select only lightweight metadata (`title`, `status`, `due_at`, `max_marks`, joined subject names).
- **Server-Side Pagination**: Uses `.range(from, to)` with default page size of 20 items.
- **Zero Bulk Downloads**: Attachment signed URLs are never generated en masse for 500 students; they are only produced when a specific document is requested.

---

## 13. PWA Caching Decision

- Service Worker Workbox runtime caching is restricted to Google Web Fonts.
- Private assignment files and signed URLs are explicitly excluded from PWA caching, ensuring copyright curriculum materials and student responses are never cached unencrypted on mobile storage.
