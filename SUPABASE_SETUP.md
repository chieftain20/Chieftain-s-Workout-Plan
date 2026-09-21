# 🔒 Supabase Architecture & Row-Level Security (RLS) Guide

This document outlines the database schema, table definitions, and security policies for **Chieftain Pro Workout System**.

---

## 1. Database Schema

Execute the following SQL statements in the **SQL Editor** of your Supabase Dashboard (`https://supabase.com/dashboard/project/<your-project-id>/sql`):

```sql
-- 1. Table: user_routines
-- Stores user-specific routines, custom days, and supersets
CREATE TABLE IF NOT EXISTS public.user_routines (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL,
  routine_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_profile UNIQUE (user_id, profile_key)
);

-- 2. Table: workout_logs
-- Stores granular workout records (weights, reps, RIR, volume) per exercise
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  log_entry JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: body_metrics
-- Stores user anthropometric measurements (circumferences, weight, body fat)
CREATE TABLE IF NOT EXISTS public.body_metrics (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_record JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_routines_user_id ON public.user_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON public.workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise_id ON public.workout_logs(exercise_id);
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_id ON public.body_metrics(user_id);
```

---

## 2. Row Level Security (RLS) Policies

Row Level Security guarantees that **no user can read, insert, update, or delete data belonging to another user**, even if requests are made directly with the public `anon` key.

Execute the following SQL in the **SQL Editor**:

```sql
-- Step 1: Enable RLS on all tables
ALTER TABLE public.user_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- Step 2: Policy for user_routines
CREATE POLICY "Users can manage own routines"
ON public.user_routines
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 3: Policy for workout_logs
CREATE POLICY "Users can manage own workout logs"
ON public.workout_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 4: Policy for body_metrics
CREATE POLICY "Users can manage own body metrics"
ON public.body_metrics
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 3. Security Verification

To verify that the isolation works:
1. Log in as **User A** (e.g. `userA@test.com`) and log a workout.
2. In another browser / private tab, log in as **User B** (e.g. `userB@test.com`).
3. User B will see only their own logs and routines. Any direct API query attempting to access User A's `user_id` will return an empty set (`[]`) or `403 Forbidden` due to PostgreSQL RLS enforcement.
