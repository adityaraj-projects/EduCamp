# EduCamp — Phase 2: Supabase Authentication, Profile & Role Security Foundation

## 1. Overview
Phase 2 establishes the production authentication, user profile foundation, and database-enforced role-based access control (RBAC) for EduCamp. It integrates Supabase Auth, PostgreSQL Row Level Security (RLS), and secure session management into the React PWA frontend without compromising existing UI tokens or introducing premature academic business tables.

---

## 2. Environment Variables & Client Configuration

### Safe Environment Template (`.env.example`)
```env
# Public Supabase API Configuration (Browser Safe — Anon Key + RLS Enforced)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Application Configuration
VITE_APP_NAME=EduCamp
VITE_APP_ENV=development
```

### Security Guarantees:
- **No Private Keys in Client:** `SUPABASE_SERVICE_ROLE_KEY`, database passwords, and administrative tokens are NEVER included in `.env`, `.env.example`, or client bundles.
- **Git Exclusions:** The local `.env` containing project credentials is explicitly ignored in `.gitignore`.
- **Public Client:** The browser singleton in `src/lib/supabaseClient.ts` operates strictly under the public `anon` role, meaning every database interaction is mediated by PostgreSQL Row Level Security.

---

## 3. Database Schema & Migration

The SQL migration is codified in `supabase/migrations/20261003000000_create_profiles_and_auth.sql`.

### Profiles Table
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  role public.user_role NOT NULL DEFAULT 'student'::public.user_role,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### Role Model & Client Escalation Prevention
- **Supported Roles:** `student`, `teacher`, `admin`, `parent` (custom PostgreSQL ENUM `user_role`).
- **Default Public Role:** All self-registered users receive the `student` role by default via the database trigger `handle_new_user()`.
- **Role Escalation Defense:** A database trigger (`prevent_role_escalation`) rejects any direct update to the `role` column initiated through client JWTs:
```sql
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
      RAISE EXCEPTION 'Direct role escalation is strictly forbidden';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Row Level Security (RLS) Policies
- **Read:** `CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);`
- **Update:** `CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);`
- **Insert:** Managed by the PostgreSQL trigger `on_auth_user_created` executing with `SECURITY DEFINER` privileges.

---

## 4. Authentication Architecture & Routes

### A. Routes
| Path | Component | Guard Type | Purpose |
|---|---|---|---|
| `/` | `SplashScreen` | Public | Brand launch screen with auto-redirect to `/login` |
| `/login` | `LoginScreen` | `PublicOnlyRoute` | Email/mobile & Google login entry (redirects to `/dashboard` if logged in) |
| `/signup` | `SignupScreen` | `PublicOnlyRoute` | Registration with client validations |
| `/forgot-password` | `ForgotPasswordScreen` | `PublicOnlyRoute` | Password reset link dispatcher |
| `/reset-password` | `ResetPasswordScreen` | Public | Sets new password via Supabase recovery token |
| `/auth/callback` | `AuthCallback` | Public | Processes Google OAuth and recovery callbacks |
| `/dashboard` | `AuthenticatedPlaceholder` | `ProtectedRoute` | Protected application shell (redirects to `/login` if unauthenticated) |

### B. Authentication State Management (`AuthContext`)
- **Single Source of Truth:** `src/features/auth/AuthContext.tsx` wraps the router hierarchy.
- **Session Lifecycle:** Automatically restores sessions via `supabase.auth.getSession()` on app launch and subscribes to `supabase.auth.onAuthStateChange()`.
- **Cached Profiles:** Loads the user's profile once per session and caches it in memory, avoiding redundant database queries on page re-renders.

---

## 5. Google OAuth & Manual Supabase Dashboard Configuration

### Client Implementation
The "Continue with Google" button executes:
```typescript
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: { access_type: 'offline', prompt: 'consent' }
  }
});
```

### Manual Supabase Dashboard Setup Required:
To enable Google OAuth for production:
1. **Google Cloud Console:**
   - Create an OAuth 2.0 Web Application Client ID.
   - Set Authorized redirect URI to: `https://<YOUR-PROJECT-ID>.supabase.co/auth/v1/callback`
2. **Supabase Dashboard:**
   - Go to **Authentication -> Providers -> Google**.
   - Enable Google provider and paste the **Google Client ID** and **Google Client Secret**.
3. **Redirect URL Allowlist:**
   - Go to **Authentication -> URL Configuration -> Redirect URLs**.
   - Add:
     - `http://localhost:3000/auth/callback` (Local development)
     - `http://localhost:4173/auth/callback` (Vite preview)
     - `https://<YOUR-NETLIFY-APP>.netlify.app/auth/callback` (Production Netlify)
     - `https://<YOUR-NETLIFY-APP>.netlify.app/reset-password` (Password recovery)

---

## 6. How to Run the Database Migration

In your Supabase Dashboard:
1. Open the **SQL Editor**.
2. Paste the contents of [supabase/migrations/20261003000000_create_profiles_and_auth.sql](file:///c:/Users/LALIT/Desktop/Desktop%20Data/Edu%20Camp%20PWA%20Web%20App/supabase/migrations/20261003000000_create_profiles_and_auth.sql).
3. Click **Run**.
4. The `profiles` table, `user_role` type, automated profile creation trigger, anti-role-escalation trigger, and RLS policies are immediately active.
