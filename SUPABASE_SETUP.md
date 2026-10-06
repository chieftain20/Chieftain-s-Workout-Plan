# 🔒 Supabase Architecture & Row-Level Security (RLS) Guide

This document outlines the database schema, table definitions, and security policies for **Chieftain Pro Workout System**.

---

## 1. Non-Destructive Database Migration & Setup

Execute the following SQL statements in the **SQL Editor** of your Supabase Dashboard (`https://supabase.com/dashboard/project/<your-project-id>/sql`):

```sql
-- 1. Create tables if they do not exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL DEFAULT 'default',
  routine_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_profile UNIQUE (user_id, profile_key)
);

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  log_entry JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.body_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_record JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Non-destructive column additions for existing profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_routines_user_id ON public.user_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON public.workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise_id ON public.workout_logs(exercise_id);
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_id ON public.body_metrics(user_id);

-- 4. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- 5. Non-recursive RLS policies for profiles
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 6. Defense-in-Depth Anti-Tamper Trigger (search_path = '')
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    raw_claims text;
    caller_role text := '';
BEGIN
    raw_claims := pg_catalog.current_setting('request.jwt.claims', true);
    IF raw_claims IS NOT NULL AND raw_claims <> '' THEN
        caller_role := (raw_claims::jsonb ->> 'role');
    END IF;

    IF caller_role IS NULL OR caller_role = '' THEN
        caller_role := pg_catalog.current_setting('request.jwt.claim.role', true);
    END IF;

    IF caller_role IN ('authenticated', 'anon') THEN
        IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'user' THEN
            RAISE EXCEPTION 'Cannot create profile with elevated role';
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
            RAISE EXCEPTION 'Cannot change profile role';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_role_escalation
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- 7. Explicit Table & Column Privileges for authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_routines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workout_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.body_metrics TO authenticated;
GRANT SELECT, INSERT ON TABLE public.profiles TO authenticated;

REVOKE UPDATE, DELETE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, updated_at) ON TABLE public.profiles TO authenticated;

-- 8. Policies for user data tables
DROP POLICY IF EXISTS "Users can manage own routines" ON public.user_routines;
CREATE POLICY "Users can manage own routines"
ON public.user_routines
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own logs" ON public.workout_logs;
DROP POLICY IF EXISTS "Users can manage own workout logs" ON public.workout_logs;
CREATE POLICY "Users can manage own workout logs"
ON public.workout_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own metrics" ON public.body_metrics;
DROP POLICY IF EXISTS "Users can manage own body metrics" ON public.body_metrics;
CREATE POLICY "Users can manage own body metrics"
ON public.body_metrics
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 2. Role-Based Access Control (RBAC) & Admin Promotion

The application enforces strict server-side role verification:
- `user.app_metadata.role`: **The authoritative, tamper-proof source.** `app_metadata` can ONLY be modified via the Supabase Service Role or the Supabase Dashboard. Regular authenticated clients cannot write to `app_metadata`.
- `public.profiles.role`: Display / profile metadata (protected by RLS, column privileges, and database trigger).

### How to Promote a User to Admin:
In your Supabase Dashboard:

1. **Option A (SQL Editor - Superuser):**
   ```sql
   -- 1. Grant admin role in app_metadata (Authoritative):
   UPDATE auth.users
   SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
   WHERE id = '<USER_UUID>';

   -- 2. Update profiles table:
   UPDATE public.profiles
   SET role = 'admin'
   WHERE id = '<USER_UUID>';
   ```

2. **Option B (Supabase Dashboard UI):**
   - Go to **Authentication > Users**.
   - Click on the user and edit **App Metadata**, setting `role` to `admin`.

---

## 3. Secure Cloud Admin Code Login

The gym and haji codes continue to unlock the local/offline experience. They are not Supabase accounts and cannot sync data. Cloud Admin uses the cloud-admin-login Edge Function, which validates a private code on the server and returns a one-time Supabase Auth magic-link token. The browser exchanges that token for a real Auth session; table access continues to use the existing RLS policies above.

No SQL migration is needed. Deploy the function and configure these values in the Supabase project:

- ADMIN_ACCESS_CODE: generate a long, random private code (at least 32 characters).
- ADMIN_EMAIL: the dedicated email address for the cloud admin account. The function creates this Supabase Auth user on first successful use, marks its server-owned app_metadata.role as admin, and issues a one-time sign-in token.
- SUPABASE_SERVICE_ROLE_KEY: Supabase provides this server-side secret to Edge Functions in the project environment. If it is not present, configure it as a function secret. Never put it in the repository or browser.

From a trusted terminal with the Supabase CLI linked to this project, set the private values and deploy:

    supabase secrets set ADMIN_ACCESS_CODE='replace-with-a-long-random-value' ADMIN_EMAIL='admin@example.com'
    supabase functions deploy cloud-admin-login --project-ref dtdwutbzwddindwqqgir

The function has verify_jwt = false because the user must be able to exchange the code before a session exists. It validates the code itself, limits repeated failures per running function instance, and returns only a short-lived, one-use Auth token hash. Keep the access code private and rotate it through Supabase secrets if exposed. Do not add it to index.html, app_engine.js, GitHub Actions, or any client-side configuration.

The deployed frontend and function must use the same Supabase project. Cloud login and database sync cannot work until the function is deployed and its secrets are configured. The existing email/password auth flow remains available.
