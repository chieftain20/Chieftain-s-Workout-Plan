-- =============================================================================
-- Account-scoped cloud data migration
-- =============================================================================
-- Status:      STEP 1 DESIGN ARTIFACT. NOT APPLIED. DO NOT RUN YET.
-- File:        supabase/migrations/20261008000000_account_scoped_cloud_data.sql
-- Baseline:    9f2a133d00e5cb9e74e5e12ca7690cf3454bdd05
-- Docs:        docs/account-scope/00_OVERVIEW.md .. 05_MIGRATION_PLAN.md
--
-- Properties:
--   * additive       -- only CREATE TABLE / ADD COLUMN / CREATE INDEX / CREATE FUNCTION,
--                       plus policy replacement and grant/revoke adjustment
--   * idempotent     -- every statement is guarded by IF NOT EXISTS or a catalog check,
--                       so re-running the file is a no-op
--   * non-destructive-- contains NO unqualified DROP / TRUNCATE / DELETE
--   * historical     -- pre-existing rows are never UPDATEd by this file
--   * reversible     -- see the ROLLBACK section at the end of this file
--
-- ############################################################
-- #  GATE G0: DO NOT APPLY TO PRODUCTION BEFORE THE STEP 2   #
-- #  FRONTEND IS DEPLOYED. This migration revokes INSERT /   #
-- #  UPDATE / DELETE on the existing data tables; the        #
-- #  currently deployed client performs direct inserts and   #
-- #  WILL BREAK. Staging first. Always.                      #
-- ############################################################
--
-- Preserved surfaces:
--   * admin authentication (Edge Function, secrets, magiclink, offline gym/haji) -- untouched
--   * scientific volume model (1.0 / 0.5 accounting, RIR as quality)             -- untouched
--   * public.profiles grants, policies and the role-escalation trigger           -- untouched
-- =============================================================================

begin;

-- =============================================================================
-- SECTION 1. New tables
-- =============================================================================

-- Account-scoped (no profile_key) per decision A9: the client derives the owner of a
-- custom exercise from the account identity, never from the active profile.
create table if not exists public.user_custom_exercises (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  client_record_id  uuid not null,
  exercise_data     jsonb not null,
  revision          bigint not null default 1,
  created_at        timestamptz not null default timezone('utc'::text, now()),
  updated_at        timestamptz not null default timezone('utc'::text, now()),
  deleted_at        timestamptz
);

-- Profile + week scoped per decisions A2 / A14.
create table if not exists public.workout_set_states (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  profile_key       text not null,
  week_key          text not null,
  state_data        jsonb not null,
  revision          bigint not null default 1,
  created_at        timestamptz not null default timezone('utc'::text, now()),
  updated_at        timestamptz not null default timezone('utc'::text, now()),
  deleted_at        timestamptz
);

-- =============================================================================
-- SECTION 2. Additive columns on the existing baseline tables
-- =============================================================================

alter table public.user_routines add column if not exists profile_data jsonb;
alter table public.user_routines add column if not exists revision     bigint not null default 1;
alter table public.user_routines add column if not exists created_at   timestamptz not null default timezone('utc'::text, now());
alter table public.user_routines add column if not exists deleted_at   timestamptz;

alter table public.workout_logs add column if not exists client_record_id uuid;
alter table public.workout_logs add column if not exists profile_key      text;
alter table public.workout_logs add column if not exists revision         bigint not null default 1;
alter table public.workout_logs add column if not exists deleted_at       timestamptz;

alter table public.body_metrics add column if not exists client_record_id uuid;
alter table public.body_metrics add column if not exists profile_key      text;
alter table public.body_metrics add column if not exists revision         bigint not null default 1;
alter table public.body_metrics add column if not exists deleted_at       timestamptz;

-- =============================================================================
-- SECTION 3. Indexes
-- =============================================================================

-- FK target: non-partial unique index on the ownership key, independent of the
-- existing constraint's name (baseline names it differently across setups).
create unique index if not exists ux_user_routines_owner_profile
  on public.user_routines (user_id, profile_key);

-- Idempotency keys. Partial, so the many historical NULL rows cannot collide.
create unique index if not exists ux_workout_logs_client_record
  on public.workout_logs (user_id, client_record_id) where client_record_id is not null;
create unique index if not exists ux_body_metrics_client_record
  on public.body_metrics (user_id, client_record_id) where client_record_id is not null;
create unique index if not exists ux_custom_exercises_client_record
  on public.user_custom_exercises (user_id, client_record_id);
create unique index if not exists ux_set_states_owner_profile_week
  on public.workout_set_states (user_id, profile_key, week_key);

-- Ownership joins and tombstone filtering.
create index if not exists idx_workout_logs_owner_profile   on public.workout_logs (user_id, profile_key);
create index if not exists idx_body_metrics_owner_profile   on public.body_metrics (user_id, profile_key);
create index if not exists idx_set_states_owner_profile     on public.workout_set_states (user_id, profile_key);
create index if not exists idx_workout_logs_deleted_at      on public.workout_logs (deleted_at);
create index if not exists idx_body_metrics_deleted_at      on public.body_metrics (deleted_at);
create index if not exists idx_user_routines_deleted_at     on public.user_routines (deleted_at);

-- =============================================================================
-- SECTION 4. profile_key domain checks (added NOT VALID so historical rows can
--            never block the migration; new and updated rows are still checked)
-- =============================================================================

do $mig$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_profile_key_format'
      and conrelid = 'public.user_routines'::regclass
  ) then
    alter table public.user_routines
      add constraint chk_profile_key_format
      check (profile_key ~ '^[a-z0-9_]{1,64}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_profile_key_format'
      and conrelid = 'public.workout_logs'::regclass
  ) then
    alter table public.workout_logs
      add constraint chk_profile_key_format
      check (profile_key ~ '^[a-z0-9_]{1,64}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_profile_key_format'
      and conrelid = 'public.body_metrics'::regclass
  ) then
    alter table public.body_metrics
      add constraint chk_profile_key_format
      check (profile_key ~ '^[a-z0-9_]{1,64}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_profile_key_format'
      and conrelid = 'public.workout_set_states'::regclass
  ) then
    alter table public.workout_set_states
      add constraint chk_profile_key_format
      check (profile_key ~ '^[a-z0-9_]{1,64}$') not valid;
  end if;
end
$mig$;

-- =============================================================================
-- SECTION 5. Composite ownership foreign keys
--   MATCH SIMPLE: a NULL component disables the check, which is exactly why
--   profile deletion NULLs profile_key instead of cascading a delete (A3).
--   on delete restrict is a safety net: routines are tombstoned, never deleted.
--   Added NOT VALID; VALIDATE CONSTRAINT is a later, separate step (gate G6).
-- =============================================================================

do $mig$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_workout_logs_owner_profile'
      and conrelid = 'public.workout_logs'::regclass
  ) then
    alter table public.workout_logs
      add constraint fk_workout_logs_owner_profile
      foreign key (user_id, profile_key)
      references public.user_routines (user_id, profile_key)
      on update cascade on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_body_metrics_owner_profile'
      and conrelid = 'public.body_metrics'::regclass
  ) then
    alter table public.body_metrics
      add constraint fk_body_metrics_owner_profile
      foreign key (user_id, profile_key)
      references public.user_routines (user_id, profile_key)
      on update cascade on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_set_states_owner_profile'
      and conrelid = 'public.workout_set_states'::regclass
  ) then
    alter table public.workout_set_states
      add constraint fk_set_states_owner_profile
      foreign key (user_id, profile_key)
      references public.user_routines (user_id, profile_key)
      on update cascade on delete restrict
      not valid;
  end if;
end
$mig$;

-- =============================================================================
-- SECTION 6. Row level security
-- =============================================================================

alter table public.user_custom_exercises enable row level security;
alter table public.workout_set_states    enable row level security;

-- Re-assert on the baseline tables (idempotent).
alter table public.profiles      enable row level security;
alter table public.user_routines enable row level security;
alter table public.workout_logs  enable row level security;
alter table public.body_metrics  enable row level security;

-- NOTE: FORCE ROW LEVEL SECURITY is deliberately NOT set. The RPCs are SECURITY
-- DEFINER and run as the table owner; forcing RLS would break them. Ownership is
-- enforced explicitly inside every RPC instead (see docs/account-scope/02_RLS_GRANTS.md).

-- =============================================================================
-- SECTION 7. Policies
--   public.profiles policies are intentionally NOT touched.
--   The broad FOR ALL owner policies on the data tables are narrowed to SELECT,
--   matching the SELECT-only grants. All drops are fully qualified.
-- =============================================================================

drop policy if exists "Users can manage own routines" on public.user_routines;
drop policy if exists "Users can read own routines"   on public.user_routines;
create policy "Users can read own routines"
  on public.user_routines for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own logs"         on public.workout_logs;
drop policy if exists "Users can manage own workout logs" on public.workout_logs;
drop policy if exists "Users can read own workout logs"   on public.workout_logs;
create policy "Users can read own workout logs"
  on public.workout_logs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own metrics"      on public.body_metrics;
drop policy if exists "Users can manage own body metrics" on public.body_metrics;
drop policy if exists "Users can read own body metrics"   on public.body_metrics;
create policy "Users can read own body metrics"
  on public.body_metrics for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own custom exercises" on public.user_custom_exercises;
create policy "Users can read own custom exercises"
  on public.user_custom_exercises for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own set states" on public.workout_set_states;
create policy "Users can read own set states"
  on public.workout_set_states for select to authenticated
  using (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies exist for any data table. Writes are RPC-only.

-- =============================================================================
-- SECTION 8. Grants and revokes (least privilege)
-- =============================================================================

-- Supabase's default privileges grant ALL on new public tables to anon,
-- authenticated and service_role. The baseline therefore carries privileges the
-- application does not need: TRUNCATE, TRIGGER and REFERENCES (which are not
-- subject to RLS), plus write access that RLS then denies anyway. The revokes
-- below reduce each role to its documented target.
--
-- service_role is deliberately NOT revoked from: it is the server-side role and
-- must retain full access. RLS policies, RPC definitions, CAS/tombstone/FK
-- semantics and the admin-auth mechanism are all untouched by this section.

-- anon: no access at all to any of the six tables
revoke all on table public.profiles              from anon;
revoke all on table public.user_routines         from anon;
revoke all on table public.workout_logs          from anon;
revoke all on table public.body_metrics          from anon;
revoke all on table public.user_custom_exercises from anon;
revoke all on table public.workout_set_states    from anon;

-- authenticated: SELECT only on the five data tables (writes are RPC-only)
revoke insert, update, delete, truncate, trigger, references on table public.user_routines         from authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.workout_logs          from authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.body_metrics          from authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.user_custom_exercises from authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.workout_set_states    from authenticated;

-- profiles: keep SELECT + INSERT + the baseline's column-level UPDATE grant;
-- drop the schema-level extras. Table-level UPDATE/DELETE were already revoked
-- by the baseline, and RLS plus the role-escalation trigger remain in force.
revoke truncate, trigger, references on table public.profiles from authenticated;

grant select on table public.user_custom_exercises to authenticated;
grant select on table public.workout_set_states    to authenticated;

grant select on table public.user_routines to authenticated;
grant select on table public.workout_logs  to authenticated;
grant select on table public.body_metrics  to authenticated;

-- MAINTAIN exists only on PostgreSQL 17+. Guarded so this file also runs on 15/16.
do $mig$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on table public.profiles, public.user_routines, public.workout_logs, '
         || 'public.body_metrics, public.user_custom_exercises, public.workout_set_states '
         || 'from authenticated, anon';
  end if;
exception
  when others then
    raise notice 'MAINTAIN revoke skipped: %', sqlerrm;
end
$mig$;

-- =============================================================================
-- SECTION 9. Ownership helper
-- =============================================================================

create or replace function public.owns_active_profile(p_profile_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.user_routines r
    where r.user_id = auth.uid()
      and r.profile_key = p_profile_key
      and r.deleted_at is null
  );
$fn$;

comment on function public.owns_active_profile(text) is
  'True iff a live user_routines row exists for (auth.uid(), p_profile_key). Ownership predicate shared by all RPCs.';

revoke all on function public.owns_active_profile(text) from public;
revoke all on function public.owns_active_profile(text) from anon;
grant execute on function public.owns_active_profile(text) to authenticated;

-- =============================================================================
-- SECTION 10. RPCs
--   Every RPC: SECURITY DEFINER, search_path = '', ownership from auth.uid() only,
--   returns the new revision on success and NULL on CAS conflict or tombstone hit.
-- =============================================================================

-- ---------- 10.1 routines (the profile registry) ----------

create or replace function public.upsert_routine(
  p_profile_key       text,
  p_routine_data      jsonb,
  p_profile_data      jsonb default null,
  p_expected_revision bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_row          public.user_routines%rowtype;
  v_new_revision bigint;
  v_profile_data jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_profile_key is null or p_profile_key !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'invalid profile key' using errcode = '22023';
  end if;
  if p_routine_data is null or jsonb_typeof(p_routine_data) <> 'object' then
    raise exception 'invalid routine data' using errcode = '22023';
  end if;

  -- B3: the device-local profile PIN must never reach the cloud.
  v_profile_data := p_profile_data;
  if v_profile_data is not null and jsonb_typeof(v_profile_data) = 'object' then
    v_profile_data := v_profile_data - 'pin';
  end if;

  select * into v_row
  from public.user_routines r
  where r.user_id = v_uid and r.profile_key = p_profile_key;

  if found then
    if v_row.deleted_at is not null then
      return null;                                    -- tombstoned: never resurrect
    end if;
    if p_expected_revision is null or v_row.revision <> p_expected_revision then
      return null;                                    -- CAS conflict
    end if;
    update public.user_routines
       set routine_data = p_routine_data,
           profile_data = v_profile_data,
           updated_at   = now(),
           revision     = v_row.revision + 1
     where id = v_row.id
     returning revision into v_new_revision;
    return v_new_revision;
  end if;

  insert into public.user_routines (user_id, profile_key, routine_data, profile_data, updated_at)
  values (v_uid, p_profile_key, p_routine_data, v_profile_data, now())
  returning revision into v_new_revision;

  return v_new_revision;
exception
  when unique_violation then
    return null;                                      -- concurrent insert race
end;
$fn$;

comment on function public.upsert_routine(text, jsonb, jsonb, bigint) is
  'Creates or CAS-updates the registry row for a profile. Strips profile_data.pin. Returns new revision or NULL.';

revoke all on function public.upsert_routine(text, jsonb, jsonb, bigint) from public;
revoke all on function public.upsert_routine(text, jsonb, jsonb, bigint) from anon;
grant execute on function public.upsert_routine(text, jsonb, jsonb, bigint) to authenticated;

create or replace function public.tombstone_routine(
  p_profile_key       text,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.user_routines
     set deleted_at = now(),
         updated_at = now(),
         revision   = revision + 1
   where user_id    = v_uid
     and profile_key = p_profile_key
     and deleted_at is null
     and revision   = p_expected_revision
  returning revision into v_new_revision;

  if v_new_revision is null then
    return null;              -- CAS failed: nothing else in this function runs
  end if;

  -- Decision A3: tombstone this profile's set states ...
  update public.workout_set_states
     set deleted_at = now(),
         updated_at = now(),
         revision   = revision + 1
   where user_id     = v_uid
     and profile_key = p_profile_key
     and deleted_at is null;

  -- ... and unassign (never delete) its logs and metrics. The rows survive; only
  -- the association is dropped, which keeps the composite FK satisfiable.
  update public.workout_logs
     set profile_key = null
   where user_id     = v_uid
     and profile_key = p_profile_key;

  update public.body_metrics
     set profile_key = null
   where user_id     = v_uid
     and profile_key = p_profile_key;

  return v_new_revision;
end;
$fn$;

comment on function public.tombstone_routine(text, bigint) is
  'Tombstones a profile routine and its set states, and unassigns its logs and metrics (preserved, profile_key set NULL). Returns new revision or NULL.';

revoke all on function public.tombstone_routine(text, bigint) from public;
revoke all on function public.tombstone_routine(text, bigint) from anon;
grant execute on function public.tombstone_routine(text, bigint) to authenticated;

-- ---------- 10.2 workout logs ----------

create or replace function public.upsert_workout_log(
  p_profile_key       text,
  p_client_record_id  uuid,
  p_exercise_id       text,
  p_log_entry         jsonb,
  p_expected_revision bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_row          public.workout_logs%rowtype;
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_profile_key is null or p_profile_key !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'invalid profile key' using errcode = '22023';
  end if;
  if p_client_record_id is null then
    raise exception 'invalid client record id' using errcode = '22023';
  end if;
  if not public.owns_active_profile(p_profile_key) then
    raise exception 'profile not owned' using errcode = '42501';
  end if;

  select * into v_row
  from public.workout_logs l
  where l.user_id = v_uid and l.client_record_id = p_client_record_id;

  if found then
    if v_row.deleted_at is not null then
      return null;
    end if;
    if p_expected_revision is null or v_row.revision <> p_expected_revision then
      return null;
    end if;
    update public.workout_logs
       set log_entry   = p_log_entry,
           exercise_id = p_exercise_id,
           profile_key = p_profile_key,
           revision    = v_row.revision + 1
     where id = v_row.id
     returning revision into v_new_revision;
    return v_new_revision;
  end if;

  insert into public.workout_logs (user_id, client_record_id, profile_key, exercise_id, log_entry)
  values (v_uid, p_client_record_id, p_profile_key, p_exercise_id, p_log_entry)
  returning revision into v_new_revision;

  return v_new_revision;
exception
  when unique_violation then
    return null;
end;
$fn$;

comment on function public.upsert_workout_log(text, uuid, text, jsonb, bigint) is
  'Idempotent insert-or-CAS-update of a workout log keyed by (user_id, client_record_id). Returns new revision or NULL.';

revoke all on function public.upsert_workout_log(text, uuid, text, jsonb, bigint) from public;
revoke all on function public.upsert_workout_log(text, uuid, text, jsonb, bigint) from anon;
grant execute on function public.upsert_workout_log(text, uuid, text, jsonb, bigint) to authenticated;

create or replace function public.update_workout_log(
  p_client_record_id  uuid,
  p_log_entry         jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.workout_logs
     set log_entry = p_log_entry,
         revision  = revision + 1
   where user_id          = v_uid
     and client_record_id = p_client_record_id
     and deleted_at is null
     and revision         = p_expected_revision
  returning revision into v_new_revision;

  return v_new_revision;
end;
$fn$;

comment on function public.update_workout_log(uuid, jsonb, bigint) is
  'CAS update of a live workout log. Returns new revision or NULL.';

revoke all on function public.update_workout_log(uuid, jsonb, bigint) from public;
revoke all on function public.update_workout_log(uuid, jsonb, bigint) from anon;
grant execute on function public.update_workout_log(uuid, jsonb, bigint) to authenticated;

create or replace function public.tombstone_workout_log(
  p_client_record_id  uuid,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.workout_logs
     set deleted_at = now(),
         revision   = revision + 1
   where user_id          = v_uid
     and client_record_id = p_client_record_id
     and deleted_at is null
     and revision         = p_expected_revision
  returning revision into v_new_revision;

  return v_new_revision;
end;
$fn$;

comment on function public.tombstone_workout_log(uuid, bigint) is
  'CAS soft-delete of a workout log. Returns new revision or NULL.';

revoke all on function public.tombstone_workout_log(uuid, bigint) from public;
revoke all on function public.tombstone_workout_log(uuid, bigint) from anon;
grant execute on function public.tombstone_workout_log(uuid, bigint) to authenticated;

-- ---------- 10.3 body metrics ----------

create or replace function public.upsert_body_metric(
  p_profile_key       text,
  p_client_record_id  uuid,
  p_metric_record     jsonb,
  p_expected_revision bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_row          public.body_metrics%rowtype;
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_profile_key is null or p_profile_key !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'invalid profile key' using errcode = '22023';
  end if;
  if p_client_record_id is null then
    raise exception 'invalid client record id' using errcode = '22023';
  end if;
  if not public.owns_active_profile(p_profile_key) then
    raise exception 'profile not owned' using errcode = '42501';
  end if;

  select * into v_row
  from public.body_metrics m
  where m.user_id = v_uid and m.client_record_id = p_client_record_id;

  if found then
    if v_row.deleted_at is not null then
      return null;
    end if;
    if p_expected_revision is null or v_row.revision <> p_expected_revision then
      return null;
    end if;
    update public.body_metrics
       set metric_record = p_metric_record,
           profile_key   = p_profile_key,
           revision      = v_row.revision + 1
     where id = v_row.id
     returning revision into v_new_revision;
    return v_new_revision;
  end if;

  insert into public.body_metrics (user_id, client_record_id, profile_key, metric_record)
  values (v_uid, p_client_record_id, p_profile_key, p_metric_record)
  returning revision into v_new_revision;

  return v_new_revision;
exception
  when unique_violation then
    return null;
end;
$fn$;

comment on function public.upsert_body_metric(text, uuid, jsonb, bigint) is
  'Idempotent insert-or-CAS-update of a body metric keyed by (user_id, client_record_id). Returns new revision or NULL.';

revoke all on function public.upsert_body_metric(text, uuid, jsonb, bigint) from public;
revoke all on function public.upsert_body_metric(text, uuid, jsonb, bigint) from anon;
grant execute on function public.upsert_body_metric(text, uuid, jsonb, bigint) to authenticated;

create or replace function public.update_body_metric(
  p_client_record_id  uuid,
  p_metric_record     jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.body_metrics
     set metric_record = p_metric_record,
         revision      = revision + 1
   where user_id          = v_uid
     and client_record_id = p_client_record_id
     and deleted_at is null
     and revision         = p_expected_revision
  returning revision into v_new_revision;

  return v_new_revision;
end;
$fn$;

comment on function public.update_body_metric(uuid, jsonb, bigint) is
  'CAS update of a live body metric. Returns new revision or NULL.';

revoke all on function public.update_body_metric(uuid, jsonb, bigint) from public;
revoke all on function public.update_body_metric(uuid, jsonb, bigint) from anon;
grant execute on function public.update_body_metric(uuid, jsonb, bigint) to authenticated;

create or replace function public.tombstone_body_metric(
  p_client_record_id  uuid,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.body_metrics
     set deleted_at = now(),
         revision   = revision + 1
   where user_id          = v_uid
     and client_record_id = p_client_record_id
     and deleted_at is null
     and revision         = p_expected_revision
  returning revision into v_new_revision;

  return v_new_revision;
end;
$fn$;

comment on function public.tombstone_body_metric(uuid, bigint) is
  'CAS soft-delete of a body metric. Returns new revision or NULL.';

revoke all on function public.tombstone_body_metric(uuid, bigint) from public;
revoke all on function public.tombstone_body_metric(uuid, bigint) from anon;
grant execute on function public.tombstone_body_metric(uuid, bigint) to authenticated;

-- ---------- 10.4 custom exercises (account-scoped, no profile check) ----------

create or replace function public.upsert_custom_exercise(
  p_client_record_id  uuid,
  p_exercise_data     jsonb,
  p_expected_revision bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_row          public.user_custom_exercises%rowtype;
  v_new_revision bigint;
  v_data         jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_client_record_id is null then
    raise exception 'invalid client record id' using errcode = '22023';
  end if;
  if p_exercise_data is null or jsonb_typeof(p_exercise_data) <> 'object' then
    raise exception 'invalid exercise data' using errcode = '22023';
  end if;

  -- Ownership is server-side only: never trust a client-supplied ownerId.
  v_data := p_exercise_data - 'ownerId';

  select * into v_row
  from public.user_custom_exercises c
  where c.user_id = v_uid and c.client_record_id = p_client_record_id;

  if found then
    if v_row.deleted_at is not null then
      return null;
    end if;
    if p_expected_revision is null or v_row.revision <> p_expected_revision then
      return null;
    end if;
    update public.user_custom_exercises
       set exercise_data = v_data,
           updated_at    = now(),
           revision      = v_row.revision + 1
     where id = v_row.id
     returning revision into v_new_revision;
    return v_new_revision;
  end if;

  insert into public.user_custom_exercises (user_id, client_record_id, exercise_data)
  values (v_uid, p_client_record_id, v_data)
  returning revision into v_new_revision;

  return v_new_revision;
exception
  when unique_violation then
    return null;
end;
$fn$;

comment on function public.upsert_custom_exercise(uuid, jsonb, bigint) is
  'Account-scoped idempotent upsert of a custom exercise. Strips ownerId. Returns new revision or NULL.';

revoke all on function public.upsert_custom_exercise(uuid, jsonb, bigint) from public;
revoke all on function public.upsert_custom_exercise(uuid, jsonb, bigint) from anon;
grant execute on function public.upsert_custom_exercise(uuid, jsonb, bigint) to authenticated;

create or replace function public.tombstone_custom_exercise(
  p_client_record_id  uuid,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.user_custom_exercises
     set deleted_at = now(),
         updated_at = now(),
         revision   = revision + 1
   where user_id          = v_uid
     and client_record_id = p_client_record_id
     and deleted_at is null
     and revision         = p_expected_revision
  returning revision into v_new_revision;

  return v_new_revision;
end;
$fn$;

comment on function public.tombstone_custom_exercise(uuid, bigint) is
  'CAS soft-delete of a custom exercise. Returns new revision or NULL.';

revoke all on function public.tombstone_custom_exercise(uuid, bigint) from public;
revoke all on function public.tombstone_custom_exercise(uuid, bigint) from anon;
grant execute on function public.tombstone_custom_exercise(uuid, bigint) to authenticated;

-- ---------- 10.5 workout set states (profile + week scoped) ----------

create or replace function public.upsert_set_state(
  p_profile_key       text,
  p_week_key          text,
  p_state_data        jsonb,
  p_expected_revision bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_row          public.workout_set_states%rowtype;
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_profile_key is null or p_profile_key !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'invalid profile key' using errcode = '22023';
  end if;
  if p_week_key is null or length(p_week_key) = 0 then
    raise exception 'invalid week key' using errcode = '22023';
  end if;
  if not public.owns_active_profile(p_profile_key) then
    raise exception 'profile not owned' using errcode = '42501';
  end if;

  select * into v_row
  from public.workout_set_states s
  where s.user_id = v_uid and s.profile_key = p_profile_key and s.week_key = p_week_key;

  if found then
    if v_row.deleted_at is not null then
      return null;
    end if;
    if p_expected_revision is null or v_row.revision <> p_expected_revision then
      return null;
    end if;
    update public.workout_set_states
       set state_data = p_state_data,
           updated_at = now(),
           revision   = v_row.revision + 1
     where id = v_row.id
     returning revision into v_new_revision;
    return v_new_revision;
  end if;

  insert into public.workout_set_states (user_id, profile_key, week_key, state_data)
  values (v_uid, p_profile_key, p_week_key, p_state_data)
  returning revision into v_new_revision;

  return v_new_revision;
exception
  when unique_violation then
    return null;
end;
$fn$;

comment on function public.upsert_set_state(text, text, jsonb, bigint) is
  'Idempotent upsert of a weekly set state keyed by (user_id, profile_key, week_key). Returns new revision or NULL.';

revoke all on function public.upsert_set_state(text, text, jsonb, bigint) from public;
revoke all on function public.upsert_set_state(text, text, jsonb, bigint) from anon;
grant execute on function public.upsert_set_state(text, text, jsonb, bigint) to authenticated;

create or replace function public.tombstone_set_state(
  p_profile_key       text,
  p_week_key          text,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_new_revision bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.workout_set_states
     set deleted_at = now(),
         updated_at = now(),
         revision   = revision + 1
   where user_id     = v_uid
     and profile_key = p_profile_key
     and week_key    = p_week_key
     and deleted_at is null
     and revision    = p_expected_revision
  returning revision into v_new_revision;

  return v_new_revision;
end;
$fn$;

comment on function public.tombstone_set_state(text, text, bigint) is
  'CAS soft-delete of a weekly set state. Returns new revision or NULL.';

revoke all on function public.tombstone_set_state(text, text, bigint) from public;
revoke all on function public.tombstone_set_state(text, text, bigint) from anon;
grant execute on function public.tombstone_set_state(text, text, bigint) to authenticated;

commit;

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- PRIMARY (non-destructive, preferred):
--   1. Restore the pre-migration table grants:
--        grant select, insert, update, delete on table public.user_routines to authenticated;
--        grant select, insert, update, delete on table public.workout_logs  to authenticated;
--        grant select, insert, update, delete on table public.body_metrics  to authenticated;
--   2. Restore the original broad owner policies (optional; SELECT-only is stricter):
--        drop policy if exists "Users can read own routines" on public.user_routines;
--        create policy "Users can manage own routines" on public.user_routines
--          for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
--        -- ... equivalently for workout_logs and body_metrics
--   3. Revert the frontend. New tables, columns and indexes are additive and may
--      simply be left in place -- the pre-migration client ignores them.
--
-- SECONDARY (destructive; only if the new columns/tables must be removed):
--   All statements below are fully qualified and touch ONLY new-format data.
--   They never affect baseline rows.
--        drop function if exists public.tombstone_set_state(text, text, bigint);
--        drop function if exists public.upsert_set_state(text, text, bigint);
--        drop function if exists public.tombstone_custom_exercise(uuid, bigint);
--        drop function if exists public.upsert_custom_exercise(uuid, jsonb, bigint);
--        drop function if exists public.tombstone_body_metric(uuid, bigint);
--        drop function if exists public.update_body_metric(uuid, jsonb, bigint);
--        drop function if exists public.upsert_body_metric(text, uuid, jsonb, bigint);
--        drop function if exists public.tombstone_workout_log(uuid, bigint);
--        drop function if exists public.update_workout_log(uuid, jsonb, bigint);
--        drop function if exists public.upsert_workout_log(text, uuid, text, jsonb, bigint);
--        drop function if exists public.tombstone_routine(text, bigint);
--        drop function if exists public.upsert_routine(text, jsonb, jsonb, bigint);
--        drop function if exists public.owns_active_profile(text);
--        drop table if exists public.workout_set_states;
--        drop table if exists public.user_custom_exercises;
--        alter table public.user_routines drop column if exists deleted_at;
--        alter table public.user_routines drop column if exists created_at;
--        alter table public.user_routines drop column if exists revision;
--        alter table public.user_routines drop column if exists profile_data;
--        alter table public.workout_logs drop column if exists deleted_at;
--        alter table public.workout_logs drop column if exists revision;
--        alter table public.workout_logs drop column if exists profile_key;
--        alter table public.workout_logs drop column if exists client_record_id;
--        alter table public.body_metrics drop column if exists deleted_at;
--        alter table public.body_metrics drop column if exists revision;
--        alter table public.body_metrics drop column if exists profile_key;
--        alter table public.body_metrics drop column if exists client_record_id;
-- =============================================================================
