# EduCamp — Production Deployment Guide
**Phase 11: Production Hardening, Security, Performance & Deployment Readiness**

This guide provides instructions for deploying EduCamp to production using **Supabase** (Database, Auth, Storage) and **Netlify** (Static PWA Hosting & Edge CDN).

---

## 1. Supabase Project Setup
1. Log in to [Supabase](https://supabase.com) and click **New project**.
2. Select your organization, choose a project name (e.g., `educamp-production`), and set a strong database password.
3. Select the region closest to your primary user base (e.g., `ap-south-1` Mumbai for India).
4. Note down your project reference ID, Project URL, and API Anon Key from **Project Settings > API**.
   - **CRITICAL**: Never expose or commit the `service_role` key. Only use the public `anon` key in the frontend.

---

## 2. Environment Variables Configuration
In your production hosting environment (Netlify) and local development `.env` (git-ignored), set:

```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...<your-public-anon-key>
```

> **Security Note**: Never add service-role or database superuser credentials to frontend environment variables.

---

## 3. Database Migrations
Apply the migrations in sequential order using the Supabase CLI or SQL Editor:

```bash
# Using Supabase CLI:
supabase db push

# Or apply sequentially in SQL Editor:
1. supabase/migrations/20261003000000_create_profiles_and_roles.sql
2. supabase/migrations/20261003000001_create_academic_structure.sql
3. supabase/migrations/20261003000002_create_students_and_teachers.sql
4. supabase/migrations/20261003000003_create_student_enrollments.sql
5. supabase/migrations/20261003000004_create_attendance_system.sql
6. supabase/migrations/20261003000005_create_fee_management_system.sql
7. supabase/migrations/20261003000006_create_study_materials.sql
8. supabase/migrations/20261003000007_create_assignments_system.sql
9. supabase/migrations/20261003000008_create_exams_and_results_system.sql
10. supabase/migrations/20261003000009_create_communications_and_notifications.sql
```

---

## 4. Storage Buckets Configuration
Verify that the following storage buckets are created and marked as **Private** (`public = false`):

| Bucket Name | Privacy | Allowed MIME Types | Max File Size | Access Policy |
|-------------|---------|---------------------|---------------|---------------|
| `study-materials` | **Private** | `application/pdf` | 25 MB | Admin/Teacher manage; enrolled students read |
| `assignment-files` | **Private** | `application/pdf` | 25 MB | Teacher uploads brief; student uploads to `submissions/{studentId}/` |

> In production, files must only be accessed through signed URLs or authenticated Supabase Storage download sessions.

---

## 5. RLS Verification
Verify that every table in the `public` schema has Row Level Security active:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```
Ensure all 31 tables return `rowsecurity = true`.

---

## 6. Netlify Hosting Setup
1. Log in to [Netlify](https://app.netlify.com) and click **Add new site > Import an existing project**.
2. Connect your Git repository provider (e.g., GitHub / GitLab).
3. Set the following build settings:
   - **Base directory**: `.` (root)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Under **Site configuration > Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy site**.

---

## 7. SPA Redirect & Routing Verification
Deep routes such as `/attendance`, `/fees`, `/materials`, `/assignments`, `/exams`, and `/notifications` are configured in `netlify.toml` and `public/_redirects`:
```
/*    /index.html   200
```
This ensures direct browser navigation, bookmarks, and mobile PWA deep links load `/index.html` without returning HTTP 404.

---

## 8. HTTPS & Security Headers
Netlify provisions automatic TLS/HTTPS certificates via Let's Encrypt.
The repository configuration in `netlify.toml` automatically sends:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-XSS-Protection: 1; mode=block`

---

## 9. PWA & Service Worker Verification
1. Open the deployed application in Google Chrome / Chromium.
2. Open DevTools > **Application** tab.
3. Check **Manifest**: Verify theme color `#16113A`, name "EduCamp - Coaching Platform", and 192x192 / 512x512 icons.
4. Check **Service Workers**: Verify `sw.js` is active and running.
5. In the address bar, confirm the PWA install icon ("Install EduCamp") appears.

---

## 10. Production Smoke Test Checklist
Perform an end-to-end smoke test on the live production URL:
1. **Admin flow**: Log in as admin, check dashboard stats, view student/teacher rosters, review attendance logs, verify fee structures, publish an announcement.
2. **Teacher flow**: Log in as teacher, view assigned classes, mark batch attendance, upload study notes PDF, create an assignment, input exam marks.
3. **Student flow**: Log in as student, view attendance percentage, check fee dues and receipts, view study materials, submit homework PDF, view published exam report card, check announcements.
4. **Security verification**: Confirm student cannot view teacher or admin routes; confirm unauthenticated users are redirected to `/login`.

---

## 11. Rollback Procedure
If an issue occurs in production:
1. In Netlify dashboard, navigate to **Deploys**.
2. Find the previous stable deployment and click **Publish deploy**.
3. Traffic will instantly route to the previous static bundle within seconds.
4. If a database rollback is required, run targeted down-scripts or restore from the Supabase point-in-time snapshot.
