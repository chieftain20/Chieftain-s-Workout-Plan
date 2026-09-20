-- ==============================================================================
-- 🏋️ Chieftain Workout Plan - Supabase Database Schema & Row-Level Security (RLS)
-- ==============================================================================

-- 1. جدول پروفایل کاربران
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. جدول برنامه‌های تمرینی اختصاصی هر کاربر
create table if not exists public.user_routines (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  profile_key text not null default 'default',
  routine_data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, profile_key)
);

-- 3. جدول لاگ‌های حرکات (وزنه‌ها، تکرارها و RIR)
create table if not exists public.workout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  exercise_id text not null,
  log_entry jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. جدول اندازه‌گیری‌های بدنی (آنتروپومتری و سایزها)
create table if not exists public.body_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  metric_record jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- 🔒 فعال‌سازی امنیت سطح سطر (Row-Level Security - RLS)
-- تضمین می‌کند هیچ کاربری نمی‌تواند به داده‌های کاربر دیگر دسترسی داشته باشد.
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.user_routines enable row level security;
alter table public.workout_logs enable row level security;
alter table public.body_metrics enable row level security;

-- سیاست‌های دسترسی امن (فقط خود کاربر مالک سطر)
drop policy if exists "Users can manage own profile" on public.profiles;
create policy "Users can manage own profile" on public.profiles for all using (auth.uid() = id);

drop policy if exists "Users can manage own routines" on public.user_routines;
create policy "Users can manage own routines" on public.user_routines for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own logs" on public.workout_logs;
create policy "Users can manage own logs" on public.workout_logs for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own metrics" on public.body_metrics;
create policy "Users can manage own metrics" on public.body_metrics for all using (auth.uid() = user_id);
