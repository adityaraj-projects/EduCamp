# PHASE 10 — PRODUCTION-GRADE COMMUNICATIONS & NOTIFICATION SYSTEM

## Architecture & Engineering Specification

---

### 1. Executive Summary & Core Objective

Phase 10 establishes the production-grade **Communications and Notification System** for **EduCamp**, built specifically for coaching institutes to communicate institutional announcements and operational notices to relevant users without exposing communications across unrelated boards, classes, batches, subjects, or students.

> [!IMPORTANT]
> **Strict Phase Boundary Notice**:
> This module manages in-app communications: announcements, audience targeting, lifecycle states, in-app notification center, read/unread states, priority levels, scheduled release, expiry, and automated event notification foundations.
> **It does NOT implement**: WhatsApp API, SMS gateways, email marketing, chat/instant messaging, social feeds, comment sections, AI messaging, or third-party push networks (Firebase/OneSignal).

---

### 2. Entity Relationship & Workflow Model

```
                    ANNOUNCEMENT
             (Title, Body, Priority, Status,
              Target Role, Dates, Creator)
                         │
                  ┌──────┴──────┐
                  ↓             ↓
             TARGET RULES     CREATOR
       (Board, Class, Batch)  (Admin / Faculty)
                  │
                  ↓
           ELIGIBLE USERS
      (Derived via Enrollments &
       Teacher Assignments)
                  │
                  ↓
             NOTIFICATION
      (Unified Feed: Announcements +
       Direct Event Notifications)
                  │
                  ↓
             READ / UNREAD
      (notification_reads table:
       1 row per user per read item)
```

---

### 3. Detailed Architectural Specifications

#### 1. Communication Architecture
- Two complementary entities:
  - **`announcements`**: Content created once by an administrator or authorized teacher. Broadcasts to many eligible users without duplicating content 500 times.
  - **`notifications`**: User-specific actionable records representing direct academic events (e.g. assignments graded, materials published, exam scheduled, system alerts).
- Read state for announcements is decoupled into **`notification_reads`** `(user_id, announcement_id, read_at)`.

#### 2. Announcement Model
- Normalized table: `announcements`.
- Primary fields: `id`, `title`, `body`, `priority`, `status`, `target_role`, `published_at`, `expires_at`, `created_by`, `created_at`, `updated_at`.
- Plain-text bodies with zero arbitrary HTML execution (XSS-proof).

#### 3. Notification Model
- Table: `notifications`.
- Stored fields: `id`, `user_id`, `announcement_id`, `notification_type`, `title`, `body`, `priority`, `action_url`, `read_at`, `expires_at`, `created_at`, `updated_at`.
- Direct action link `action_url` provides 1-click navigation to relevant resources (e.g. `/materials`, `/assignments`, `/exams`).

#### 4. Targeting Model
- Normalized table: `announcement_targets`.
- Cascading academic targeting rules:
  $$\text{Academic Year} \longrightarrow \text{Board} \longrightarrow \text{Class Level} \longrightarrow \text{Stream (optional)} \longrightarrow \text{Batch (optional)}$$
- **Institute-Wide Broadcast**: When an announcement has zero rows in `announcement_targets`, it targets all users matching `target_role` (`all`, `students`, `teachers`).
- **Targeted Broadcast**: Only students whose active enrollment (`is_current = true`) matches the criteria, and teachers assigned to that academic context, are eligible.

#### 5. Teacher Authorization
- Enforced at both database RLS and database function levels:
  - `public.is_teacher_authorized_for_target(user_id, board_id, class_level_id, batch_id, subject_id)`
- Faculty can only create and target announcements for boards, classes, and batches they are assigned to teach in `teacher_assignments`.
- Teachers cannot issue institute-wide broadcasts to `all` roles (reserved for administrators).

#### 6. Admin Authorization
- Administrators possess institution-wide communication authority.
- Can broadcast to `all`, `students`, or `teachers`, or target any specific board/class/batch.

#### 7. Student Visibility
Enforced via database RLS policy `announcements_select_policy`:
- Student must be authenticated.
- Announcement must have `status = 'published'`.
- Database time must satisfy: `published_at <= now()`.
- Database time must satisfy: `expires_at IS NULL OR expires_at > now()`.
- Student's current active enrollment must match the targeting rules via `public.is_user_eligible_for_announcement(id, auth.uid())`.

#### 8. Announcement Lifecycle
Controlled state machine:
$$\text{draft} \longrightarrow \text{scheduled} \longrightarrow \text{published} \longrightarrow \text{expired} \longrightarrow \text{archived}$$
- **draft**: Content being prepared; invisible to audience.
- **scheduled**: Finalized with future `published_at`; invisible until release timestamp.
- **published**: Active and readable in notification center.
- **expired**: Past `expires_at`; automatically excluded from active notification feeds.
- **archived**: Removed from active management while preserved in historical records.

#### 9. Notification Lifecycle
$$\text{created} \longrightarrow \text{unread} \longrightarrow \text{read} \longrightarrow \text{expired}$$
- Marked as read individually or via "Mark All Read".

#### 10. Read / Unread Architecture
- Dual-layer design:
  - For announcements: tracked via `notification_reads(user_id, announcement_id, read_at)` with composite primary key `(user_id, announcement_id)`.
  - For direct notifications: tracked via `notifications.read_at` timestamp.
- High-performance RPC `get_unread_notification_count(p_user_id)` returns the exact unread total in milliseconds without loading full message payloads.

#### 11. Expiry Strategy
- Derived filtering: active queries enforce `(expires_at IS NULL OR expires_at > now())`.
- Avoids requiring continuous background cron jobs just to hide expired notices.

#### 12. Scheduling Strategy
- Release is controlled by `published_at`.
- Client and database queries enforce `published_at <= now()`.
- Database server clock is the single authoritative source of truth.

#### 13. Row Level Security (RLS) Policies
- `announcements`:
  - `SELECT`: Admins (all), Authors (own), Eligible users (published, active notices).
  - `INSERT`: Admins & Teachers (restricted to assigned roles/targets).
  - `UPDATE`: Admins (all), Authors (own drafts/scheduled notices).
  - `DELETE`: Admins only.
- `announcement_targets`: Follows parent announcement permissions.
- `notification_reads`: Strictly scoped to `user_id = auth.uid()` for both read and write.
- `notifications`: Strictly scoped to `user_id = auth.uid()`.

#### 14. Storage & Caching Decision
- No binary files required in this phase; announcement bodies stored in PostgreSQL `TEXT`.
- PWA caches static application shell; notification payloads are network-first/server-authoritative.

#### 15. Database Indexes
- `idx_announcements_status`: `(status)`
- `idx_announcements_published`: `(published_at DESC)`
- `idx_announcements_expires`: `(expires_at)`
- `idx_announcements_priority`: `(priority)`
- `idx_announcements_created_by`: `(created_by)`
- `idx_announcements_created_at`: `(created_at DESC)`
- `idx_announcement_targets_announcement`: `(announcement_id)`
- `idx_announcement_targets_academic`: `(academic_year_id, board_id, class_level_id)`
- `idx_announcement_targets_batch`: `(batch_id)`
- `idx_notification_reads_user`: `(user_id)`
- `idx_notification_reads_announcement`: `(announcement_id)`
- `idx_notifications_user_unread`: `(user_id, read_at)`
- `idx_notifications_user_created`: `(user_id, created_at DESC)`

#### 16. Pagination
- Default page size: `DEFAULT_PAGE_SIZE = 20`.
- Applied across both Notification Center and Announcement Management screens.

#### 17. Performance Strategy for ~500 Students
- **Zero Fan-Out Bloat**: Publishing an announcement creates exactly 1 row in `announcements` and 0 to 1 rows in `announcement_targets`, never 500 duplicate rows.
- **Fast Unread Counter**: Computed via indexed database function `get_unread_notification_count()`.
- **No Polling Loops**: Data is fetched on app open, navigation, or user refresh.

#### 18. Concurrency Strategy
- Read-state recording uses `ON CONFLICT (user_id, announcement_id) DO UPDATE SET read_at = now()`.
- Simultaneous "mark as read" operations are strictly idempotent.

#### 19. Duplicate Prevention
- Unique constraint `uq_announcement_target UNIQUE NULLS NOT DISTINCT (...)` prevents duplicate targeting rules.
- Unique constraint `uq_user_announcement_read UNIQUE (user_id, announcement_id)` prevents duplicate read entries.

#### 20. XSS Protection
- All notification content rendered as plain text strings (`whitespace-pre-wrap font-sans`).
- No `dangerouslySetInnerHTML` is used.
- Script tags `<script>`, event handlers, and `javascript:` URLs are completely neutralized.

#### 21. PWA Behavior
- Service worker precaches application shell and icon assets.
- Notification feeds are never permanently cached, ensuring students cannot view revoked notices or stale read counts while offline.

#### 22. Future Push-Notification Architecture
- Built with standard Web Notification API support.
- User can opt-in via "Enable Browser Alerts".
- Clean abstraction prepared for future Web Push / VAPID background workers without restructuring the database.

#### 23. Future Automated Event Integration
- Service interfaces implemented in `notificationService.ts`:
  - `createNotification(payload)`
  - `notifyMaterialPublished(userId, title, subjectName)`
  - `notifyAssignmentPublished(userId, title, subjectName, dueAt)`
  - `notifyExamPublished(userId, title, examDate)`
  - `notifyResultPublished(userId, title)`
- Enables future phases to trigger instant alerts without circular dependencies.

---

### 4. Verification & Testing Summary

1. **Automated Unit & Property Tests**:
   - `tests/notification.test.mjs` executes 8 test suites validating controlled enums, audience targeting rules, class/batch isolation, scheduled/expired filtering, XSS neutralization, idempotent read state, and migration SQL integrity.
   - Combined test suite (`material.test.mjs`, `assignment.test.mjs`, `exam.test.mjs`, `notification.test.mjs`) passes **35/35 tests**.
2. **Type Safety & Build**:
   - `tsc` completed with 0 errors.
   - `vite build` produced optimized production bundle with service worker and PWA manifests in 13.10s.
