-- ==============================================================================
-- 🏋️ Chieftain Workout Plan - Supabase Database Schema & Row-Level Security (RLS)
-- ==============================================================================

-- 1. جدول پروفایل کاربران
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
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

-- ایندکس‌ها جهت افزایش سرعت کوئری‌ها
create index if not exists idx_user_routines_user_id on public.user_routines(user_id);
create index if not exists idx_workout_logs_user_id on public.workout_logs(user_id);
create index if not exists idx_workout_logs_exercise_id on public.workout_logs(exercise_id);
create index if not exists idx_body_metrics_user_id on public.body_metrics(user_id);

-- ==============================================================================
-- 🔒 فعال‌سازی امنیت سطح سطر (Row-Level Security - RLS)
-- تضمین می‌کند هیچ کاربری نمی‌تواند به داده‌های کاربر دیگر دسترسی داشته باشد.
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.user_routines enable row level security;
alter table public.workout_logs enable row level security;
alter table public.body_metrics enable row level security;

-- سیاست‌های دسترسی امن جدول profiles (ساده، سریع و غیر‌بازگشتی)
drop policy if exists "Users can manage own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ==============================================================================
-- 🛡️ تریگر حفاظتی ضد دستکاری سطح دسترسی (Role Escalation Protection Trigger)
-- مرجع اصلی جلوگیری از ارتقای خودکار سطح دسترسی به ادمین در سطح دیتابیس
-- ==============================================================================
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if current_user = 'authenticated' then
        -- جلوگیری از درج پروفایل با نقشی غیر از user
        if tg_op = 'INSERT' and new.role is distinct from 'user' then
            raise exception 'Cannot create profile with elevated role';
        end if;

        -- جلوگیری از هرگونه تغییر در ستون role توسط کاربر
        if tg_op = 'UPDATE' and old.role is distinct from new.role then
            raise exception 'Cannot change profile role';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
before insert or update on public.profiles
for each row
execute function public.prevent_profile_role_escalation();

-- ==============================================================================
-- سیاست‌های دسترسی سایر جداول داده‌های کاربران
-- ==============================================================================
drop policy if exists "Users can manage own routines" on public.user_routines;
create policy "Users can manage own routines" on public.user_routines for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own logs" on public.workout_logs;
drop policy if exists "Users can manage own workout logs" on public.workout_logs;
create policy "Users can manage own workout logs" on public.workout_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own metrics" on public.body_metrics;
drop policy if exists "Users can manage own body metrics" on public.body_metrics for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
