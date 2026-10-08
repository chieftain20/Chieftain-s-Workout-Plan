-- =============================================================================
-- Account-scope migration — G0 PREFLIGHT  (READ-ONLY, EXISTENCE-AWARE)
-- =============================================================================
-- Safety class: READ-ONLY.
--   * Contains ONLY SELECT / catalog reads and DO blocks that only RAISE NOTICE.
--   * NO DDL. NO DML. Nothing is created, altered, dropped or deleted.
--   * NO statement references a baseline table directly, so a missing table can
--     never raise an error. Absent objects are reported as MISSING / absent.
--   * Every dynamic statement is wrapped in an exception handler, so even a
--     permission problem degrades to a NOTICE instead of aborting the script.
--
-- Safe to run against a COMPLETELY FRESH staging database.
--
-- HOW TO READ THE OUTPUT
--   The Supabase SQL Editor shows the LAST statement's result grid, plus all
--   NOTICEs. This file is ordered so that:
--     PART A + PART B  -> NOTICE output (exact counts + data diagnostics)
--     PART C           -> the final result grid (the full catalog report)
--   Run the whole file once. Read the grid, then check the Notices panel.
--
-- Target: STAGING ONLY (nyeqrujaicdcwicywgu). Never production.
-- =============================================================================


-- =============================================================================
-- PART A — EXACT ROW COUNTS, for tables that actually exist
--   Absent tables -> MISSING. Unreadable tables -> UNREADABLE. Never fails.
-- =============================================================================
do $pre_a$
declare
  t text;
  n bigint;
begin
  foreach t in array array[
    'profiles', 'user_routines', 'workout_logs', 'body_metrics',
    'user_custom_exercises', 'workout_set_states'
  ]::text[]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'ROWCOUNT  % = MISSING (table does not exist)', t;
    else
      begin
        execute format('select count(*) from public.%I', t) into n;
        raise notice 'ROWCOUNT  % = % row(s)', t, n;
      exception when others then
        raise notice 'ROWCOUNT  % = UNREADABLE (%)', t, sqlerrm;
      end;
    end if;
  end loop;
end
$pre_a$;


-- =============================================================================
-- PART B — DATA DIAGNOSTICS relevant to the migration
--   Each check is guarded by table AND column existence, and wrapped in an
--   exception handler. On a fresh database everything reports MISSING.
-- =============================================================================
do $pre_b$
declare
  n    bigint;
  keys text;
  tbl  text;
begin
  -- ---- B1. client_record_id diagnostics (post-migration columns) ----------
  foreach tbl in array array['workout_logs', 'body_metrics']::text[]
  loop
    if to_regclass('public.' || tbl) is null then
      raise notice 'DIAG  %.client_record_id : table MISSING', tbl;
      continue;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'client_record_id'
    ) then
      raise notice 'DIAG  %.client_record_id : column MISSING (pre-migration)', tbl;
      continue;
    end if;

    begin
      execute format(
        'select count(*) from public.%I where client_record_id is null', tbl) into n;
      raise notice 'DIAG  % rows with NULL client_record_id (historical, must be preserved) = %', tbl, n;

      execute format(
        'select count(*) from (select user_id, client_record_id from public.%I '
        'where client_record_id is not null group by 1, 2 having count(*) > 1) d', tbl) into n;
      raise notice 'DIAG  % duplicate (user_id, client_record_id) groups (must be 0 before backfill) = %', tbl, n;
    exception when others then
      raise notice 'DIAG  %.client_record_id : could not be evaluated (%)', tbl, sqlerrm;
    end;
  end loop;

  -- ---- B2. profile_key diagnostics on user_routines ----------------------
  if to_regclass('public.user_routines') is null then
    raise notice 'DIAG  user_routines.profile_key : table MISSING';
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_routines' and column_name = 'profile_key'
  ) then
    raise notice 'DIAG  user_routines.profile_key : column MISSING';
  else
    begin
      execute $q$select count(*) from public.user_routines$q$ into n;
      raise notice 'DIAG  user_routines rows = %', n;

      execute $q$select count(*) from public.user_routines where profile_key is null$q$ into n;
      raise notice 'DIAG  user_routines rows with NULL profile_key = %', n;

      execute $q$select count(*) from public.user_routines
                   where profile_key is not null
                     and profile_key !~ '^[a-z0-9_]{1,64}$'$q$ into n;
      raise notice 'DIAG  user_routines non-conforming profile_key (would block VALIDATE CONSTRAINT) = %', n;

      execute $q$select coalesce(string_agg(distinct profile_key, ', ' order by profile_key), '(none)')
                   from public.user_routines$q$ into keys;
      raise notice 'DIAG  user_routines distinct profile_key values = %', keys;

      execute $q$select count(*) from public.user_routines where user_id is null$q$ into n;
      raise notice 'DIAG  user_routines rows with NULL user_id (would block composite FK) = %', n;
    exception when others then
      raise notice 'DIAG  user_routines.profile_key : could not be evaluated (%)', sqlerrm;
    end;
  end if;

  -- ---- B3. historical-row shape on the log/metric tables ------------------
  foreach tbl in array array['workout_logs', 'body_metrics']::text[]
  loop
    if to_regclass('public.' || tbl) is null then
      raise notice 'DIAG  %.profile_key : table MISSING', tbl;
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'profile_key'
    ) then
      raise notice 'DIAG  %.profile_key : column MISSING (pre-migration)', tbl;
      continue;
    end if;
    begin
      execute format('select count(*) from public.%I where profile_key is null', tbl) into n;
      raise notice 'DIAG  % rows with NULL profile_key (unassigned historical) = %', tbl, n;
    exception when others then
      raise notice 'DIAG  %.profile_key : could not be evaluated (%)', tbl, sqlerrm;
    end;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'deleted_at'
    ) then
      raise notice 'DIAG  %.deleted_at : column MISSING (pre-migration)', tbl;
    else
      begin
        execute format('select count(*) from public.%I where deleted_at is not null', tbl) into n;
        raise notice 'DIAG  % tombstoned rows = %', tbl, n;
      exception when others then
        raise notice 'DIAG  %.deleted_at : could not be evaluated (%)', tbl, sqlerrm;
      end;
    end if;
  end loop;
end
$pre_b$;


-- =============================================================================
-- PART C — CATALOG REPORT  (single result grid; safe on an empty database)
--   section 1  ENV
--   section 2  TABLE      baseline table existence
--   section 3  COLUMNS    columns of existing baseline tables
--   section 4  RLS        RLS status per baseline table
--   section 5  POLICY     policies on public tables
--   section 6  GRANT      table ACLs (incl. TRUNCATE/TRIGGER/REFERENCES/MAINTAIN extras)
--   section 7  FUNCTION   public functions
--   section 8  SCOPEOBJ   account-scope migration objects (tables/columns/RPCs)
--   section 9  ROWCOUNT   approximate live rows (pg_stat) for existing tables
-- =============================================================================
with expected(name) as (
  values ('profiles'), ('user_routines'), ('workout_logs'), ('body_metrics')
),
tbl as (
  select e.name                              as name,
         to_regclass('public.' || e.name)    as reg,
         c.oid                               as relid,
         c.relrowsecurity                    as rls,
         c.relforcerowsecurity               as forced
  from expected e
  left join pg_class c on c.oid = to_regclass('public.' || e.name)
)
select section, item, detail, value
from (

  -- ---- 1. ENV -------------------------------------------------------------
  select '1. ENV' as section,
         'database' as item,
         current_database() as detail,
         current_setting('server_version') as value
  union all
  select '1. ENV', 'current role', current_user, null
  union all
  select '1. ENV', 'search_path', current_setting('search_path'), null
  union all
  select '1. ENV', 'auth schema present',
         case when to_regclass('auth.users') is null then 'MISSING' else 'present' end,
         coalesce(to_regclass('auth.users')::text, '-')
  union all
  select '1. ENV', 'public base tables',
         count(*)::text, null
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'

  -- ---- 2. TABLE existence -------------------------------------------------
  union all
  select '2. TABLE', t.name,
         case when t.reg is null then 'MISSING' else 'present' end,
         coalesce(t.reg::text, '-')
  from tbl t

  -- ---- 3. COLUMNS of existing baseline tables -----------------------------
  union all
  select '3. COLUMNS', c.table_name, c.column_name,
         c.data_type || ' | null=' || c.is_nullable
         || ' | default=' || coalesce(c.column_default, '-')
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name in (select name from expected)
  union all
  select '3. COLUMNS', e.name, 'MISSING', 'table does not exist'
  from expected e
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = e.name
  )

  -- ---- 4. RLS status ------------------------------------------------------
  union all
  select '4. RLS', t.name,
         case when t.reg is null then 'MISSING'
              when t.rls then 'enabled'
              else 'DISABLED' end,
         case when t.reg is null then null
              else 'force_row_level_security=' || t.forced::text end
  from tbl t

  -- ---- 5. POLICIES --------------------------------------------------------
  union all
  select '5. POLICY', p.tablename, p.policyname,
         p.cmd || ' | roles=' || coalesce(array_to_string(p.roles, ','), '-')
  from pg_policies p
  where p.schemaname = 'public'
  union all
  select '5. POLICY', e.name, '(no policies)', 'MISSING'
  from expected e
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = e.name
  )

  -- ---- 6. GRANTS / ACLs (surfaces TRUNCATE, TRIGGER, REFERENCES, MAINTAIN) -
  union all
  select '6. GRANT', g.table_name,
         g.grantee || ' -> ' || g.privilege_type,
         null
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')

  -- ---- 7. PUBLIC FUNCTIONS ------------------------------------------------
  union all
  select '7. FUNCTION', p.proname,
         pg_get_function_identity_arguments(p.oid),
         'secdef=' || p.prosecdef::text
         || ' | cfg=' || coalesce(array_to_string(p.proconfig, ','), '(none)')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'

  -- ---- 8. ACCOUNT-SCOPE OBJECTS -------------------------------------------
  union all
  select '8. SCOPEOBJ', 'table ' || v.name,
         case when to_regclass('public.' || v.name) is null then 'absent' else 'present' end,
         null
  from (values ('user_custom_exercises'), ('workout_set_states')) v(name)
  union all
  select '8. SCOPEOBJ', 'column ' || v.tbl || '.' || v.col,
         case when exists (
                select 1 from information_schema.columns c
                where c.table_schema = 'public'
                  and c.table_name = v.tbl and c.column_name = v.col
              ) then 'present' else 'absent' end,
         null
  from (values
    ('user_routines', 'profile_data'), ('user_routines', 'revision'),
    ('user_routines', 'created_at'),   ('user_routines', 'deleted_at'),
    ('workout_logs',  'client_record_id'), ('workout_logs', 'profile_key'),
    ('workout_logs',  'revision'),     ('workout_logs', 'deleted_at'),
    ('body_metrics',  'client_record_id'), ('body_metrics', 'profile_key'),
    ('body_metrics',  'revision'),     ('body_metrics', 'deleted_at')
  ) v(tbl, col)
  union all
  select '8. SCOPEOBJ', 'function ' || v.name,
         case when exists (
                select 1 from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = v.name
              ) then 'present' else 'absent' end,
         null
  from (values
    ('owns_active_profile'),
    ('upsert_routine'), ('tombstone_routine'),
    ('upsert_workout_log'), ('update_workout_log'), ('tombstone_workout_log'),
    ('upsert_body_metric'), ('update_body_metric'), ('tombstone_body_metric'),
    ('upsert_custom_exercise'), ('tombstone_custom_exercise'),
    ('upsert_set_state'), ('tombstone_set_state')
  ) v(name)

  -- ---- 9. ROW COUNTS (approximate, never fails) ---------------------------
  union all
  select '9. ROWCOUNT', e.name,
         case when to_regclass('public.' || e.name) is null then 'MISSING'
              else coalesce(s.n_live_tup::text, '0') || ' (approx; exact value in Notices)'
         end,
         null
  from expected e
  left join pg_stat_user_tables s
    on s.schemaname = 'public' and s.relname = e.name

) report
order by section, item, detail;

-- =============================================================================
-- END PREFLIGHT (read-only)
-- =============================================================================
