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

Row Level Security guarantees that **no user can read, insert, update, or delete data belonging to another user**, even if requests are made directly with the public `anon` key.

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
-- Prevents users from elevating themselves to 'admin' during INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF current_user = 'authenticated' THEN
        -- Prevent INSERT with any role other than 'user'
        IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'user' THEN
            RAISE EXCEPTION 'Cannot create profile with elevated role';
        END IF;

        -- Prevent UPDATE of role column by authenticated client
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

-- Step 4: Policy for user_routines
DROP POLICY IF EXISTS "Users can manage own routines" ON public.user_routines;
CREATE POLICY "Users can manage own routines"
ON public.user_routines
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 5: Policy for workout_logs
DROP POLICY IF EXISTS "Users can manage own logs" ON public.workout_logs;
DROP POLICY IF EXISTS "Users can manage own workout logs" ON public.workout_logs;
CREATE POLICY "Users can manage own workout logs"
ON public.workout_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 6: Policy for body_metrics
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

The application enforces a dual-source role verification:
- `public.profiles.role`: Database metadata for display and profile information.
- `user.app_metadata.role`: Trusted, tamper-proof server-side authorization claim. If there is any discrepancy, `app_metadata` is the authoritative source.

### How to Promote a User to Admin:
Only trusted administrators with Supabase dashboard/service-role access can promote users:

1. **Option A (SQL Editor in Supabase Dashboard):**
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE id = '<USER_UUID>';
   ```
   *(Runs as superuser `postgres`, so it bypasses the `authenticated` trigger).*

2. **Option B (Supabase Auth Admin API):**
   Assign `role = 'admin'` to `app_metadata` using the service role key.

---

## 4. Security Verification Plan (5 Critical Tests)

To verify database security and isolation:

### Test A — Normal user attempts self-promotion via UPDATE:
```sql
-- Executed with an authenticated user's JWT / session:
UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
-- Expected result: ❌ Fails with exception: "Cannot change profile role"
```

### Test B — Normal user attempts admin injection via INSERT:
```sql
-- Executed with an authenticated user's JWT / session:
INSERT INTO public.profiles (id, display_name, role) VALUES (auth.uid(), 'Hacker', 'admin');
-- Expected result: ❌ Fails with exception: "Cannot create profile with elevated role"
```

### Test C — User A attempts to edit User B's profile:
```sql
-- Executed as User A:
UPDATE public.profiles SET display_name = 'Hacked' WHERE id = '<USER_B_UUID>';
-- Expected result: ❌ 0 rows affected / RLS violation
```

### Test D — User A attempts to read User B's workout logs:
```sql
-- Executed as User A:
SELECT * FROM public.workout_logs WHERE user_id = '<USER_B_UUID>';
-- Expected result: 0 rows returned
```

### Test E — User A attempts to overwrite User B's workout logs:
```sql
-- Executed as User A:
UPDATE public.workout_logs SET log_entry = '{"tampered":true}'::jsonb WHERE user_id = '<USER_B_UUID>';
-- Expected result: ❌ 0 rows affected / RLS violation
```

---

## 5. Client Session Isolation (Logout / Switch User)

To prevent cross-account data leakage in the browser:
- When a user logs out (`handleSupabaseLogout`), all user-specific localStorage entries (`chieftain_logs_*`, `chieftain_metrics_*`, `chieftain_sets_*`) are wiped via `clearLocalUserData()`, and workout routines are reset to the standard templates (`TEMPLATE_MALE_PROFILE`, `TEMPLATE_FEMALE_PROFILE`).
- When a new user logs in (`user.id !== lastAuthUserId`), the previous user's local state is automatically purged before loading the new user's remote cloud data.
