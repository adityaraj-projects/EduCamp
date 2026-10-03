# PHASE 9 — PRODUCTION-GRADE EXAM / TEST & RESULT MANAGEMENT SYSTEM

## Architecture & Engineering Specification

---

### 1. Executive Summary & Core Objective

Phase 9 establishes the production-grade **Exam / Test and Result Management System** for **EduCamp**, built specifically for coaching institutes conducting offline or hybrid evaluations for ~500 students, 15 teachers, across multiple educational boards (CBSE, ICSE, BSEB), classes 1–12, multiple academic years, and batches.

> [!IMPORTANT]
> **Strict Phase Boundary Notice**:
> This module manages offline-conducted exams: exam scheduling, academic targeting, multi-subject marks recording, validation, status derivation, grading, publication gating, and student result viewing.
> **It is NOT an online examination engine.** (No online MCQ engines, question banks, timers, browser proctoring, AI evaluators, or PDF generation were built in this phase).

---

### 2. Entity Relationship & Workflow Model

```
Academic Context (Year → Board → Class → Stream → Batch)
              │
              ▼
             Exam (Title, Type, Date, Lifecycle Status, Targeting)
              │
        ┌─────┴────────────────────────────────┐
        │                                      │
        ▼                                      ▼
   Exam Subjects                       Eligible Students
(Max Marks, Passing Marks,             (Active Enrollments in
 Schedule Date/Time)                    Academic Context)
        │                                      │
        └──────────────────┬───────────────────┘
                           │
                           ▼
                     Exam Results
             (Student Marks per Subject)
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
       Obtained Marks   Status        Remarks
       (Present/Absent) (Pass/Fail)   (Teacher Notes)
                           │
                           ▼
                    Result Aggregation
            (Total Obtained / Total Max)
            (2-Decimal Percentage & Letter Grade)
                           │
                           ▼
                  Publication Gate
                 (status = 'published')
                           │
                           ▼
                  Student Access
            (Enrolled Student Views Own Verified Report Card)
```

---

### 3. Detailed Architectural Specifications

#### 1. Exam Architecture
- Master entity: `exams`.
- An assessment is an academic event tied to an `academic_year_id`, `board_id`, and `class_level_id`.
- Composite foreign key references `board_classes(board_id, class_level_id)` ensuring strict class-board consistency.
- Metadata includes: `title`, `description`, `exam_type`, `exam_date`, optional `start_time` / `end_time`, `status`, and `created_by`.

#### 2. Controlled Exam Types
Exams adhere to a controlled set of academic categories (no arbitrary free-text types):
- `unit_test`: Chapter or topical modular assessment.
- `class_test`: Short periodic classroom evaluation.
- `monthly_test`: Monthly cumulative assessment.
- `midterm`: Mid-session comprehensive examination.
- `terminal`: Term-ending examination.
- `final`: Annual cumulative examination.
- `mock_test`: Simulated board examination.
- `other`: Special or diagnostic evaluation.

#### 3. Controlled Exam Lifecycle
State machine transitions:
`draft` ➔ `scheduled` ➔ `ongoing` ➔ `completed` ➔ `published` ➔ `archived`
- **draft**: Exam is being configured; invisible to students.
- **scheduled**: Exam details and dates are finalized.
- **ongoing**: Offline examination is in progress.
- **completed**: Offline exam has finished; teachers enter and review marks.
- **published**: Marks are verified and officially published; results become visible to enrolled students.
- **archived**: Historical exam removed from default active lists, preserving student result records permanently.

#### 4. Academic Targeting
Targeting parameters enforce strict scoping:
- `academic_year_id` (UUID)
- `board_id` (UUID)
- `class_level_id` (UUID)
- `stream_id` (UUID, nullable, e.g. Science / Commerce for Classes 11–12)
- `batch_id` (UUID, nullable)

#### 5. Batch Targeting Semantics
- `batch_id IS NULL`: Exam applies to all active students enrolled in that class context across all batches.
- `batch_id IS NOT NULL`: Exam targets only students enrolled in that specific batch.

#### 6. Teacher Authorization
Enforced at both database RLS and service levels:
- Teachers can only manage exams and marks for boards, classes, and subjects they are actively assigned to teach in `teacher_assignments`.
- Unauthorized teachers cannot view unassigned mark rosters or alter results.
- Administrators possess institution-wide management access.

#### 7. Exam Subject Mapping
- Normalized entity: `exam_subjects`.
- Allows an exam to encompass a single subject (e.g. Unit Test in Physics) or multiple subjects (e.g. Midterm covering Math, Science, and English).
- Unique constraint `CONSTRAINT uq_exam_subject UNIQUE (exam_id, subject_id)` prevents duplicate subject entries in the same exam.
- Each subject defines its own `max_marks` and `passing_marks`.

#### 8. Marks Model & Precision
- Normalized entity: `exam_results`.
- Stores student scores per subject: `(exam_id, exam_subject_id, student_id)`.
- Numeric precision: `NUMERIC(5, 2)` allowing safe fractional marking (e.g. `84.50`) without floating-point inaccuracies.
- Unique constraint `CONSTRAINT uq_exam_subject_student UNIQUE (exam_subject_id, student_id)` prevents duplicate records.

#### 9. Absence Model: ABSENT ≠ ZERO
- Attendance status: `present` | `absent` | `exempted`.
- When `attendance_status = 'absent'`:
  - `obtained_marks` is strictly `NULL`.
  - `result_status = 'absent'`.
  - Absence is never conflated with genuine zero marks (`0.00`).
- Trigger `validate_exam_result_marks` rejects contradictory rows (e.g. `absent` with numerical marks).

#### 10. Pass / Fail Calculation
- Dynamically evaluated per subject:
  - If `obtained_marks >= passing_marks`: `passed`
  - If `obtained_marks < passing_marks`: `failed`
- Allows varying passing benchmarks across different exams and subjects without hard-coded percentages.

#### 11. Percentage Calculation
- Reusable formula implemented in `examService.ts`:
  $$\text{Percentage} = \operatorname{round}\left(\frac{\sum \text{obtained\_marks}}{\sum \text{max\_marks}} \times 100, 2\right)$$
- If an exam has unevaluated pending subjects, percentage calculation is suppressed (`null`) and the status is flagged as `INCOMPLETE` to prevent misleading partial scores.

#### 12. Centralized Grade Calculation
Configurable grading engine implemented in `src/types/exam.ts`:
| Percentage Range | Pass / Fail Condition | Letter Grade |
| :--- | :--- | :--- |
| $\ge 90.00\%$ | All subjects passed | **A+** |
| $80.00\% - 89.99\%$ | All subjects passed | **A** |
| $70.00\% - 79.99\%$ | All subjects passed | **B+** |
| $60.00\% - 69.99\%$ | All subjects passed | **B** |
| $50.00\% - 59.99\%$ | All subjects passed | **C** |
| $40.00\% - 49.99\%$ | All subjects passed | **D** |
| $< 40.00\%$ | Or failed in any subject | **F** |

#### 13. Result Publication Gating
- Entering marks does NOT immediately expose them to students.
- Only when an administrator or authorized teacher transitions `exams.status = 'published'` do rows in `exam_results` become accessible to students under PostgreSQL Row Level Security.

#### 14. Database Row Level Security (RLS)
- **Unauthenticated**: Zero access to exams or results.
- **Students**:
  - `exams`: Can only SELECT published exams matching their current enrollment.
  - `exam_subjects`: Can only SELECT subjects of published exams.
  - `exam_results`: Can only SELECT their own result rows (`student_id = auth_student_id`) when `exams.status = 'published'`. No write access.
- **Teachers**:
  - `exams` / `exam_subjects`: Can SELECT and manage exams for assigned academic contexts.
  - `exam_results`: Can INSERT, UPDATE, and SELECT marks for students in their assigned classes.
- **Admins**: Full CRUD access across exams, subjects, and results.

#### 15. Database Constraints & Integrity
1. `max_marks > 0`
2. `passing_marks >= 0 AND passing_marks <= max_marks`
3. `obtained_marks >= 0 AND obtained_marks <= max_marks` (enforced via database trigger)
4. Foreign key integrity: `ON DELETE CASCADE` from exams to exam_subjects and exam_results; `ON DELETE RESTRICT` on master subjects and students to preserve historical records.

#### 16. Database Indexing
- `idx_exams_academic`: `(academic_year_id, board_id, class_level_id)`
- `idx_exams_batch`: `(batch_id)`
- `idx_exams_status`: `(status)`
- `idx_exams_date`: `(exam_date DESC)`
- `idx_exam_subjects_exam`: `(exam_id)`
- `idx_exam_subjects_subject`: `(subject_id)`
- `idx_exam_results_exam`: `(exam_id)`
- `idx_exam_results_subject`: `(exam_subject_id)`
- `idx_exam_results_student`: `(student_id)`
- `idx_exam_results_status`: `(result_status)`

#### 17. Pagination & Efficiency
- Exam lists support server-side pagination with `DEFAULT_PAGE_SIZE = 20`.
- Mark entry loads only the enrolled students for the specific exam subject and batch, avoiding massive full-school data dumps.

#### 18. Concurrency & Data Safety
- Marks upsert uses `onConflict: 'exam_subject_id,student_id'` to guarantee idempotent updates without phantom duplicate rows.
- Atomic verification ensures exams cannot be published with zero subjects or broken references.

#### 19. Safe Delete / Archive Strategy
- Hard deletions are blocked once results are recorded.
- Archiving an exam (`status = 'archived'`) hides it from active teacher and student lists while permanently preserving academic history.

#### 20. Audit Foundation
- All modifications preserve `created_by`, `created_at`, `updated_at`, `evaluated_by`, and `evaluated_at` (populated with authenticated user profile IDs).

#### 21. Future Online-Exam Separation
- Schema is strictly decoupled from question banks, MCQ answer keys, and timers.
- A future online test engine can simply link to `exam_subjects` as a test runner without altering the underlying grade and result calculation architecture.

---

### 4. Verification & Testing Summary

1. **Automated Unit & Property Tests**:
   - `tests/exam.test.mjs` executes 10 test suites covering boundary validation, absence semantics, percentage computation, letter grading, and schema integrity.
   - Combined test run (`material.test.mjs`, `assignment.test.mjs`, `exam.test.mjs`) passes 27/27 tests.
2. **Type Safety & Build**:
   - `tsc` completed with 0 errors.
   - `vite build` produced optimized production bundle with service worker and PWA manifests.
