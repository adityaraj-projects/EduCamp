# EduCamp — Known Limitations & Operational Considerations
**Phase 11: Production Hardening, Security, Performance & Deployment Readiness**

---

### 1. Production Scale & Load Testing
- **Status**: The application architecture, database schemas, foreign key relationships, indexes, and queries have been reviewed and prepared for the target scale of ~500 students, ~15 teachers, multiple boards (CBSE, ICSE, BSEB), classes 1–12, multiple batches, and academic years.
- **Limitation**: *Architecture has been reviewed/prepared for the expected scale, but production load testing is still required.*
- **Recommendation**: Prior to full institute rollout during peak admission or examination result days, conduct simulated load testing using tools such as k6 or Artillery against the staging Supabase instance to verify connection pool limits.

---

### 2. Push Notifications & External Delivery Gateway
- **Status**: In-app Notification Center, Announcement broadcast engine, role targeting, academic context filtering, and read status tracking are fully operational.
- **Limitation**: Native OS-level Web Push notifications (background push notifications when the PWA browser tab is completely closed) require an external VAPID key configuration and an active push delivery service worker pipeline.
- **Recommendation**: In Phase 12 or subsequent communications rollout, configure standard Web Push API credentials in the Supabase Edge Functions or Netlify Functions environment to dispatch background OS notifications.

---

### 3. Automated Database Backups & Point-in-Time Recovery (PITR)
- **Status**: Database schema, RLS policies, and data integrity triggers are committed in git under `supabase/migrations/`.
- **Limitation**: Automated hourly Point-In-Time-Recovery (PITR) is a Supabase Pro tier capability. On the Supabase Free tier, daily backups are retained for 7 days without PITR.
- **Recommendation**: For production coaching institute operations with financial records and student transcripts, subscribe to the Supabase Pro tier or schedule periodic automated `pg_dump` backups via GitHub Actions / external cron into an encrypted cold storage bucket (e.g., AWS S3 or Cloudflare R2).

---

### 4. Institute Grading Scheme Customization
- **Status**: The exam grading engine calculates percentage to 2 decimal places and maps marks to standard educational letter grades (`A+` >= 90%, `A` >= 80%, `B+` >= 70%, `B` >= 60%, `C` >= 50%, `D` >= 35%, `F` < 35%).
- **Limitation**: Specific boards or classes may adopt proprietary grading scales (e.g., 9-point CGPA or CBSE positional grading).
- **Recommendation**: The grading function is centralized in `src/services/examService.ts` and can be adjusted to match custom institute rules upon administrative request.

---

### 5. Production Domain & DNS
- **Status**: The build and deployment configuration (`netlify.toml`, `public/_redirects`) is completely configured for Netlify hosting with TLS/HTTPS.
- **Limitation**: The initial deployment will run on a `.netlify.app` subdomain until the institute links its custom domain (e.g., `portal.educamp.in`).
- **Recommendation**: Add the custom domain in Netlify DNS settings and configure the CNAME / ALIAS records at the domain registrar.

---

### 6. Offline Data Mutability
- **Status**: The PWA service worker precaches static assets, HTML shell, and styles for immediate load even on slow 2G/3G mobile networks.
- **Limitation**: Private financial records, attendance submissions, and exam marks are intentionally server-authoritative and require network connectivity to write.
- **Recommendation**: This is a deliberate security and data-integrity design decision to prevent split-brain conflicts and fraudulent offline adjustments.
