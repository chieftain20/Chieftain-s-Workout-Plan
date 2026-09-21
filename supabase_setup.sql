-- ==============================================================================
-- 🏋️ Chieftain Workout Plan - Supabase Database Migration & Row-Level Security
-- کاملاً امن و غیرمخرب (بدون هیچ دستور DROP TABLE، DELETE یا از دست رفتن داده)
-- ==============================================================================

-- ۱. ایجاد جداول در صورت عدم وجود (Safe Table Creation)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.user_routines (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  profile_key text not null default 'default',
  routine_data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, profile_key)
);

create table if not exists public.workout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  exercise_id text not null,
  log_entry jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.body_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  metric_record jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ۲. ارتقای امن ستون‌های جدول profiles در صورت وجود از قبل (Non-Destructive Column Migration)
alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user', 'admin'));
alter table public.profiles add column if not exists avatar_url text;

-- ۳. ایجاد ایندکس‌های کارایی در صورت عدم وجود
create index if not exists idx_user_routines_user_id on public.user_routines(user_id);
create index if not exists idx_workout_logs_user_id on public.workout_logs(user_id);
create index if not exists idx_workout_logs_exercise_id on public.workout_logs(exercise_id);
create index if not exists idx_body_metrics_user_id on public.body_metrics(user_id);

-- ۴. فعال‌سازی امنیت سطح سطر (RLS) روی تمام جداول
alter table public.profiles enable row level security;
alter table public.user_routines enable row level security;
alter table public.workout_logs enable row level security;
alter table public.body_metrics enable row level security;

-- ۵. سیاست‌های دسترسی امن جدول profiles (غیر‌بازگشتی و مجزا)
drop policy if exists "Users can manage own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ۶. تریگر ضد دستکاری نقش با search_path مسدود (Defense-in-Depth Trigger)
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_role text;
begin
    caller_role := pg_catalog.coalesce(
        (pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        (pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '')),
        ''
    );

    if caller_role in ('authenticated', 'anon') then
        if tg_op = 'INSERT' and new.role is distinct from 'user' then
            raise exception 'Cannot create profile with elevated role';
        end if;

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

-- ۷. تنظیم دقیق مجوزهای جداول برای نقش authenticated
grant select, insert, update, delete on table public.user_routines to authenticated;
grant select, insert, update, delete on table public.workout_logs to authenticated;
grant select, insert, update, delete on table public.body_metrics to authenticated;
grant select, insert on table public.profiles to authenticated;

-- سلب دسترسی ویرایش و حذف کلی از جدول profiles و اعطای انحصاری روی ستون‌های غیرحساس
revoke update, delete on table public.profiles from authenticated;
grant update (display_name, avatar_url, updated_at) on table public.profiles to authenticated;

-- ۸. سیاست‌های دسترسی RLS سایر جداول داده‌های کاربران
drop policy if exists "Users can manage own routines" on public.user_routines;
create policy "Users can manage own routines" on public.user_routines for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own logs" on public.workout_logs;
drop policy if exists "Users can manage own workout logs" on public.workout_logs;
create policy "Users can manage own workout logs" on public.workout_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own metrics" on public.body_metrics;
drop policy if exists "Users can manage own body metrics" on public.body_metrics;
create policy "Users can manage own body metrics" on public.body_metrics for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
