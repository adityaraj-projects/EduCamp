# EduCamp — Production Environment Setup Guide
**Phase 13: Real Production Environment Setup & Final Validation**

---

## 1. Environment Architecture & Configuration
EduCamp uses a decoupled serverless JAMstack & BaaS architecture:
- **Frontend / PWA**: React 18, Vite 6, TypeScript, VitePWA (Workbox).
- **Backend / BaaS**: Supabase (PostgreSQL 15, PostgREST, GoTrue Auth, Supabase Storage).
- **Hosting & Edge Delivery**: Netlify (Edge CDN, SSL/TLS, SPA rewrites, Edge security headers).

### Environment Variables Matrix
| Variable | Environment | Browser Exposed | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Staging & Production | **Yes** (Public) | Supabase project API endpoint |
| `VITE_SUPABASE_ANON_KEY` | Staging & Production | **Yes** (Public) | Anon role public JWT (enforces RLS) |
| `VITE_APP_NAME` | Staging & Production | **Yes** (Public) | Application brand label (`EduCamp`) |
| `VITE_APP_ENV` | Staging & Production | **Yes** (Public) | `production` / `staging` mode flag |
| `SUPABASE_SERVICE_ROLE_KEY` | CI/CD / Backend Only | **NEVER** | Master key; strictly forbidden in client code |

---

## 2. Supabase Production Setup Procedure
1. Create a new Supabase project at [https://app.supabase.com](https://app.supabase.com) (e.g. `educamp-production`).
2. Region: Choose `ap-south-1` (Mumbai, India) for minimal latency for Indian coaching institutes.
3. Database Password: Generate a 32-character high-entropy secret and store securely in institute vault.
4. Retrieve Public API Keys:
   - Go to **Project Settings > API**.
   - Copy **Project URL** (`https://<project-ref>.supabase.co`).
   - Copy **anon public API Key** (`eyJhbGciOi...`).

---

## 3. Database Migration Execution Plan
Execute the 10 migrations sequentially in the Supabase SQL Editor or via Supabase CLI (`supabase db push`):

```bash
# Sequential migration execution order:
1. supabase/migrations/20261003000000_create_profiles_and_auth.sql
2. supabase/migrations/20261003000001_create_academic_master_data.sql
3. supabase/migrations/20261003000002_seed_academic_master_data.sql
4. supabase/migrations/20261003000003_create_students_teachers_enrollments.sql
5. supabase/migrations/20261003000004_create_attendance_system.sql
6. supabase/migrations/20261003000005_create_fee_management_system.sql
7. supabase/migrations/20261003000006_create_study_materials.sql
8. supabase/migrations/20261003000007_create_assignments_system.sql
9. supabase/migrations/20261003000008_create_exams_and_results_system.sql
10. supabase/migrations/20261003000009_create_communications_and_notifications.sql
```

---

## 4. Row Level Security (RLS) Verification
Verify that every table in the `public` schema has `rowsecurity = true`:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```
Ensure all 31 tables confirm active RLS.

---

## 5. Storage Buckets Setup
Ensure the two required buckets are set up with strict privacy and file constraints:

| Bucket ID | Public Status | Max File Size | Allowed MIME Types | Folder Hierarchy |
| :--- | :--- | :--- | :--- | :--- |
| `study-materials` | **Private** (`false`) | 25 MB | `application/pdf` | `materials/{board}/{class}/{subject}/` |
| `assignment-files` | **Private** (`false`) | 25 MB | `application/pdf` | `brief/` (teachers) & `submissions/{studentId}/` |

---

## 6. Authentication Setup
- Ensure **Email Auth** is enabled in Supabase Auth Settings.
- Configure institute redirect URLs in **Auth > URL Configuration**:
  - Site URL: `https://educamp.netlify.app` (or custom domain)
  - Redirect URLs: `https://educamp.netlify.app/auth/callback`, `https://educamp.netlify.app/reset-password`
- Seed initial administrative account using Supabase Auth dashboard.

---

## 7. Netlify Deployment Procedure
1. Create a remote GitHub repository:
   ```bash
   git remote add origin https://github.com/<institute-org>/educamp-pwa.git
   git branch -M master
   git push -u origin master
   ```
2. In Netlify Dashboard:
   - Click **Add new site > Import an existing project > GitHub**.
   - Select `educamp-pwa`.
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Under **Site configuration > Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_NAME` = `EduCamp`
   - `VITE_APP_ENV` = `production`
4. Click **Deploy Site**.

---

## 8. PWA & Service Worker Verification
- Verify `manifest.webmanifest` and service worker precaching `dist/sw.js`.
- Confirm installation prompt appears on Chrome Android and Safari iOS ("Add to Home Screen").

---

## 9. Mobile Responsiveness Checks
- Confirm fluid layout down to 360px viewport without horizontal scroll.
- Confirm touch buttons have min 40px hit area.

---

## 10. Controlled Staging Data & Load Testing
- For staging verification, use `node scripts/generate-staging-data.mjs` to generate realistic scale data (~500 students, 15 teachers, multiple boards).
- Run `node tests/load-test.mjs` to benchmark local response times.
- Before full institute enrollment, perform progressive remote load tests (25, 50, 100, 250, 500 users) using k6 or Artillery against the staging Supabase instance.

---

## 11. Backup & Recovery Plan
- Subscribe to Supabase Pro for automated Point-In-Time-Recovery (PITR).
- Schedule daily automated `pg_dump` backups stored in encrypted cold storage (e.g. AWS S3 / Cloudflare R2).

---

## 12. Rollback Procedures
- **Frontend Rollback**: Go to Netlify **Deploys** tab, select the previous stable deployment, and click **Publish deploy** (instant zero-downtime rollback).
- **Database Rollback**: Point-in-time restore from Supabase snapshot or execute down-migration scripts.
