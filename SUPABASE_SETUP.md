# 🔒 Supabase Architecture & Row-Level Security (RLS) Guide

This document outlines the database schema, table definitions, and security policies for **Chieftain Pro Workout System**.

---

## 1. Database Schema

Execute the following SQL statements in the **SQL Editor** of your Supabase Dashboard (`https://supabase.com/dashboard/project/<your-project-id>/sql`):

```sql
-- 1. Table: profiles (Custom user profile metadata with role constraint)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table: user_routines
-- Stores user-specific routines, custom days, and supersets
CREATE TABLE IF NOT EXISTS public.user_routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL DEFAULT 'default',
  routine_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_profile UNIQUE (user_id, profile_key)
);

-- 3. Table: workout_logs
-- Stores granular workout records (weights, reps, RIR, volume) per exercise
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  log_entry JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Table: body_metrics
-- Stores user anthropometric measurements (circumferences, weight, body fat)
CREATE TABLE IF NOT EXISTS public.body_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_record JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_routines_user_id ON public.user_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON public.workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise_id ON public.workout_logs(exercise_id);
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_id ON public.body_metrics(user_id);
```

---

## 2. Row Level Security (RLS) & Anti-Tamper Trigger

Execute the following SQL in the **SQL Editor**:

```sql
-- Step 1: Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- Step 2: Clean, non-recursive policies for profiles
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Step 3: Anti-Tamper Trigger for Role Escalation Prevention
-- Evaluates caller's JWT role claim (auth.role() / request.jwt.claims)
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role text;
BEGIN
    -- In Supabase PostgREST, extract caller's JWT role:
    caller_role := COALESCE(
        auth.role(),
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role'),
        current_setting('request.jwt.claim.role', true),
        ''
    );

    -- If caller is authenticated user or anon (calling via PostgREST / client API):
    IF caller_role IN ('authenticated', 'anon') THEN
        -- Prevent INSERT with elevated role
        IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'user' THEN
            RAISE EXCEPTION 'Cannot create profile with elevated role';
        END IF;

        -- Prevent UPDATE of role column
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

-- Step 4: Defense-in-Depth: Revoke UPDATE permission on role column from authenticated role
REVOKE UPDATE (role) ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, updated_at) ON public.profiles TO authenticated;

-- Step 5: Policy for user_routines
DROP POLICY IF EXISTS "Users can manage own routines" ON public.user_routines;
CREATE POLICY "Users can manage own routines"
ON public.user_routines
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 6: Policy for workout_logs
DROP POLICY IF EXISTS "Users can manage own logs" ON public.workout_logs;
DROP POLICY IF EXISTS "Users can manage own workout logs" ON public.workout_logs;
CREATE POLICY "Users can manage own workout logs"
ON public.workout_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 7: Policy for body_metrics
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

## 3. Role-Based Access Control (RBAC) & Admin Promotion

The application enforces strict server-side role verification:
- `user.app_metadata.role`: **The authoritative, tamper-proof source.** `app_metadata` can ONLY be modified via the Supabase Service Role or the Supabase Dashboard. Regular authenticated clients cannot write to `app_metadata`.
- `public.profiles.role`: Display / profile metadata (protected by RLS and database trigger).

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
   - Click on the user and edit **User Metadata / App Metadata**, setting `role` to `admin`.

---

## 4. Verification Tests (5 Database Isolation Tests)

You can verify all policies and triggers directly in the Supabase SQL Editor using simulated authenticated sessions:

```sql
-- Setup: Simulate User A
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Test A: User A attempts self-promotion via UPDATE
UPDATE public.profiles SET role = 'admin' WHERE id = '11111111-1111-1111-1111-111111111111';
-- Result: ❌ ERROR: Cannot change profile role (or permission denied for column role)

-- Test B: User A attempts to insert profile with role='admin'
INSERT INTO public.profiles (id, display_name, role) VALUES ('11111111-1111-1111-1111-111111111111', 'Attacker', 'admin');
-- Result: ❌ ERROR: Cannot create profile with elevated role

-- Test C: User A attempts to update User B's profile
UPDATE public.profiles SET display_name = 'Hacked' WHERE id = '22222222-2222-2222-2222-222222222222';
-- Result: ❌ 0 rows affected (RLS violation)

-- Test D: User A attempts to read User B's workout logs
SELECT * FROM public.workout_logs WHERE user_id = '22222222-2222-2222-2222-222222222222';
-- Result: 0 rows returned (RLS isolation)

-- Test E: User A attempts to update User B's workout logs
UPDATE public.workout_logs SET log_entry = '{"tampered":true}'::jsonb WHERE user_id = '22222222-2222-2222-2222-222222222222';
-- Result: ❌ 0 rows affected (RLS isolation)

RESET ROLE;
```
