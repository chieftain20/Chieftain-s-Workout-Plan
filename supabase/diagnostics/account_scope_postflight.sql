-- =============================================================================
-- Account-scope migration — POSTFLIGHT  (READ-ONLY, SELF-VERIFYING)
-- =============================================================================
-- Safety class: READ-ONLY.
--   * Only SELECT / catalog reads, plus one DO block that only RAISE NOTICEs.
--   * NO DDL. NO DML. No INSERT / UPDATE / DELETE. No destructive statements.
--   * Produces ONE result grid, so nothing is hidden by the SQL Editor only
--     showing the last statement's result set.
--
-- HOW TO READ THE OUTPUT
--   PART B returns a single grid:  check_id | area | item | detail | value |
--   expected | status.  Every row that is not 'OK' is a mismatch.
--   PART A emits exact row counts to the Notices panel.
--
-- CATALOG CHECKS — why they are written the way they are (v2, after false positives)
--   1. search_path is read from the proconfig ARRAY, never from proconfig::text.
--      An array element containing a double quote is emitted quoted AND escaped
--      ({"search_path=\"\""}), so LIKE '%search_path=""%' silently matches nothing.
--      Correct form:  proconfig && array['search_path=""','search_path=']
--   2. PUBLIC EXECUTE is detected from the aclitem array, never from a text LIKE.
--      aclitem text is <grantee>=<privs>/<grantor>, so '%=X/%' also matches
--      'authenticated=X/...' - a false positive. A PUBLIC entry is the one with an
--      EMPTY grantee, i.e. it starts with '='.
--   3. profiles has its OWN expected ACL (SELECT + INSERT + column-level UPDATE).
--      It is not a SELECT-only data table.
--   4. Only the three migration FKs are expected to target user_routines; the
--      baseline auth.users FKs are correct and reported as preserved.
--   5. Only the four profile_key CHECKs and the three migration FKs are expected
--      to be NOT VALID. Baseline FKs are never judged against that expectation.
--
-- Target: STAGING ONLY (nyeqrujaicdcwicywgu). Never production.
-- =============================================================================


-- =============================================================================
-- PART A — existence notices + exact row counts (Notices panel)
--   Never fails: missing tables are reported, not referenced.
-- =============================================================================
do $post_a$
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
      raise notice 'POSTFLIGHT % = TABLE MISSING', t;
    else
      begin
        execute format('select count(*) from public.%I', t) into n;
        raise notice 'POSTFLIGHT % rows = %', t, n;
      exception when others then
        raise notice 'POSTFLIGHT % rows = UNREADABLE (%)', t, sqlerrm;
      end;
    end if;
  end loop;
end
$post_a$;


-- =============================================================================
-- PART B — SINGLE VERIFICATION GRID
--   status is computed wherever the expectation is checkable.
-- =============================================================================
with
t(name) as (
  values ('profiles'), ('user_routines'), ('workout_logs'), ('body_metrics'),
         ('user_custom_exercises'), ('workout_set_states')
),
ix(name) as (
  values ('ux_user_routines_owner_profile'), ('ux_workout_logs_client_record'),
         ('ux_body_metrics_client_record'), ('ux_custom_exercises_client_record'),
         ('ux_set_states_owner_profile_week'), ('idx_workout_logs_owner_profile'),
         ('idx_body_metrics_owner_profile'), ('idx_set_states_owner_profile'),
         ('idx_workout_logs_deleted_at'), ('idx_body_metrics_deleted_at'),
         ('idx_user_routines_deleted_at')
),
rp(name) as (
  values ('owns_active_profile'),
         ('upsert_routine'), ('tombstone_routine'),
         ('upsert_workout_log'), ('update_workout_log'), ('tombstone_workout_log'),
         ('upsert_body_metric'), ('update_body_metric'), ('tombstone_body_metric'),
         ('upsert_custom_exercise'), ('tombstone_custom_exercise'),
         ('upsert_set_state'), ('tombstone_set_state')
),
mig_fk(name) as (
  values ('fk_workout_logs_owner_profile'), ('fk_body_metrics_owner_profile'),
         ('fk_set_states_owner_profile')
),
ac(tbl, col) as (
  values ('user_routines', 'profile_data'), ('user_routines', 'revision'),
         ('user_routines', 'created_at'),   ('user_routines', 'deleted_at'),
         ('workout_logs',  'client_record_id'), ('workout_logs', 'profile_key'),
         ('workout_logs',  'revision'),     ('workout_logs', 'deleted_at'),
         ('body_metrics',  'client_record_id'), ('body_metrics', 'profile_key'),
         ('body_metrics',  'revision'),     ('body_metrics', 'deleted_at')
),
m as (
  select
    (select count(*) from information_schema.tables
      where table_schema='public' and table_name in ('user_custom_exercises','workout_set_states')) as new_tables,
    (select count(*) from information_schema.columns c
      where c.table_schema='public' and exists (select 1 from ac where ac.tbl=c.table_name and ac.col=c.column_name)) as added_cols,
    (select count(*) from pg_indexes where schemaname='public' and indexname in (select name from ix)) as mig_indexes,
    (select count(*) from pg_constraint where connamespace='public'::regnamespace
       and conname in ('chk_profile_key_format','fk_workout_logs_owner_profile',
                       'fk_body_metrics_owner_profile','fk_set_states_owner_profile')) as mig_constraints,
    (select count(*) from pg_constraint where connamespace='public'::regnamespace
       and conname='chk_profile_key_format') as chk_count,
    (select count(*) from pg_constraint where connamespace='public'::regnamespace
       and conname in (select name from mig_fk) and contype='f') as fk_count,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relname in (select name from t) and c.relrowsecurity) as rls_on,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relname in (select name from t) and c.relforcerowsecurity) as rls_forced,
    (select count(*) from pg_policies where schemaname='public') as policies_total,
    (select count(*) from pg_policies where schemaname='public' and tablename='profiles') as policies_profiles,
    (select count(*) from pg_policies where schemaname='public' and tablename<>'profiles' and cmd='SELECT') as policies_data_select,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (select name from rp)) as rpcs_present,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (select name from rp) and p.prosecdef) as rpcs_secdef,
    -- empty search_path read from the proconfig ARRAY (never from ::text)
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (select name from rp)
        and coalesce(p.proconfig,'{}'::text[]) && array['search_path=""','search_path=']::text[]) as rpcs_empty_sp,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (select name from rp)
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')) as rpcs_auth_exec,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (select name from rp)
        and has_function_privilege('anon', p.oid, 'EXECUTE')) as rpcs_anon_exec,
    -- PUBLIC EXECUTE detected from the aclitem array: a PUBLIC entry has an EMPTY grantee
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (select name from rp)
        and (p.proacl is null
             or exists (select 1 from unnest(p.proacl) as u(item) where u.item::text like '=X/%'))) as rpcs_public_exec,
    (select count(*) from information_schema.role_table_grants
      where table_schema='public' and grantee='authenticated'
        and table_name in ('user_routines','workout_logs','body_metrics',
                           'user_custom_exercises','workout_set_states')
        and privilege_type <> 'SELECT') as auth_extra_privs,
    (select count(*) from information_schema.role_table_grants
      where table_schema='public' and grantee='anon' and table_name in (select name from t)) as anon_privs,
    (select count(*) from information_schema.role_table_grants
      where table_schema='public' and grantee='service_role' and table_name in (select name from t)) as svc_privs,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r') as public_tables,
    (select count(*) from pg_trigger where tgname='prevent_profile_role_escalation') as trig_present,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='prevent_profile_role_escalation'
        and p.prosecdef
        and coalesce(p.proconfig,'{}'::text[]) && array['search_path=""','search_path=']::text[]) as trig_fn_ok,
    (select count(*) from information_schema.role_column_grants
      where table_schema='public' and table_name='profiles'
        and grantee='authenticated' and privilege_type='UPDATE') as prof_col_update,
    -- every public SECURITY DEFINER function must pin an empty search_path
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef and p.prokind='f'
        and not (coalesce(p.proconfig,'{}'::text[]) && array['search_path=""','search_path=']::text[])) as secdef_bad_sp,
    (select count(*) from public.user_routines) + (select count(*) from public.workout_logs)
      + (select count(*) from public.body_metrics) + (select count(*) from public.profiles)
      + (select count(*) from public.user_custom_exercises)
      + (select count(*) from public.workout_set_states) as rows_total
)
select check_id, area, item, detail, value, expected, status
from (

  -- ---- 01. SUMMARY (computed) ---------------------------------------------
  select '01' as check_id, 'SUMMARY' as area, 'account-scope tables present' as item,
         null as detail, m.new_tables::text as value, '2' as expected,
         case when m.new_tables = 2 then 'OK' else 'MISMATCH' end as status from m
  union all select '01','SUMMARY','added columns', null, m.added_cols::text, '12',
         case when m.added_cols = 12 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','migration indexes', null, m.mig_indexes::text, '11',
         case when m.mig_indexes = 11 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','migration constraints', null, m.mig_constraints::text, '7',
         case when m.mig_constraints = 7 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','profile_key CHECK constraints', null, m.chk_count::text, '4',
         case when m.chk_count = 4 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','composite ownership FKs', null, m.fk_count::text, '3',
         case when m.fk_count = 3 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','tables with RLS enabled', null, m.rls_on::text, '6',
         case when m.rls_on = 6 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','tables with FORCE RLS (must be 0)', null, m.rls_forced::text, '0',
         case when m.rls_forced = 0 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','total policies', null, m.policies_total::text, '8',
         case when m.policies_total = 8 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','profiles policies (untouched)', null, m.policies_profiles::text, '3',
         case when m.policies_profiles = 3 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','data-table SELECT policies', null, m.policies_data_select::text, '5',
         case when m.policies_data_select = 5 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','migration RPCs present', null, m.rpcs_present::text, '13',
         case when m.rpcs_present = 13 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','RPCs SECURITY DEFINER', null, m.rpcs_secdef::text, '13',
         case when m.rpcs_secdef = 13 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','RPCs with empty search_path', null, m.rpcs_empty_sp::text, '13',
         case when m.rpcs_empty_sp = 13 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','RPCs executable by authenticated', null, m.rpcs_auth_exec::text, '13',
         case when m.rpcs_auth_exec = 13 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','RPCs executable by anon (must be 0)', null, m.rpcs_anon_exec::text, '0',
         case when m.rpcs_anon_exec = 0 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','RPCs executable by PUBLIC (must be 0)', null, m.rpcs_public_exec::text, '0',
         case when m.rpcs_public_exec = 0 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','authenticated non-SELECT privs on data tables', null, m.auth_extra_privs::text, '0',
         case when m.auth_extra_privs = 0 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','anon privileges on the six tables', null, m.anon_privs::text, '0',
         case when m.anon_privs = 0 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','service_role privileges retained', null, m.svc_privs::text, '>= 42',
         case when m.svc_privs >= 42 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','tables in public schema', null, m.public_tables::text, '6',
         case when m.public_tables = 6 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','role-escalation trigger present', null, m.trig_present::text, '1',
         case when m.trig_present = 1 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','trigger fn secdef + empty search_path', null, m.trig_fn_ok::text, '1',
         case when m.trig_fn_ok = 1 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','profiles column-level UPDATE grants', null, m.prof_col_update::text, '3',
         case when m.prof_col_update = 3 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','secdef fns WITHOUT empty search_path (must be 0)', null, m.secdef_bad_sp::text, '0',
         case when m.secdef_bad_sp = 0 then 'OK' else 'MISMATCH' end from m
  union all select '01','SUMMARY','TOTAL ROWS across the six tables', null, m.rows_total::text, '0',
         case when m.rows_total = 0 then 'OK' else 'MISMATCH' end from m

  -- ---- 02. TABLE existence ------------------------------------------------
  union all
  select '02','TABLE', t.name,
         case when to_regclass('public.' || t.name) is null then 'MISSING' else 'present' end,
         coalesce(to_regclass('public.' || t.name)::text, '-'),
         'present',
         case when to_regclass('public.' || t.name) is null then 'MISMATCH' else 'OK' end
  from t

  -- ---- 03. Added columns --------------------------------------------------
  union all
  select '03','COLUMN', ac.tbl || '.' || ac.col,
         coalesce(c.data_type, 'MISSING') || coalesce(' | default=' || c.column_default, ''),
         case when c.column_name is null then 'absent' else 'present' end,
         'present',
         case when c.column_name is null then 'MISMATCH' else 'OK' end
  from ac
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name=ac.tbl and c.column_name=ac.col

  -- ---- 04. Indexes --------------------------------------------------------
  union all
  select '04','INDEX', ix.name,
         coalesce(i.indexdef, 'MISSING'),
         case when i.indexname is null then 'absent' else 'present' end,
         'present',
         case when i.indexname is null then 'MISMATCH' else 'OK' end
  from ix
  left join pg_indexes i on i.schemaname='public' and i.indexname=ix.name

  -- ---- 05a. Migration constraints (4 CHECKs + 3 FKs) ---------------------
  union all
  select '05','CONSTRAINT', con.conname || ' on ' || con.conrelid::regclass::text,
         pg_get_constraintdef(con.oid),
         'validated=' || con.convalidated::text,
         'validated=false (added NOT VALID)',
         case when con.convalidated then 'REVIEW' else 'OK' end
  from pg_constraint con
  where con.connamespace='public'::regnamespace
    and (con.conname='chk_profile_key_format' or con.conname in (select name from mig_fk))

  -- ---- 05b. FK targets (migration FKs only) ------------------------------
  union all
  select '05','FK TARGET', con.conname,
         'references ' || con.confrelid::regclass::text,
         pg_get_constraintdef(con.oid),
         'references public.user_routines(user_id, profile_key)',
         case when con.confrelid = 'public.user_routines'::regclass then 'OK' else 'MISMATCH' end
  from pg_constraint con
  where con.connamespace='public'::regnamespace and con.contype='f'
    and con.conname in (select name from mig_fk)

  -- ---- 05c. Baseline FKs — preserved, judged only on existence -----------
  union all
  select '05','FK BASELINE', con.conname,
         'references ' || con.confrelid::regclass::text,
         pg_get_constraintdef(con.oid),
         'preserved baseline FK (not judged for NOT VALID)',
         'OK'
  from pg_constraint con
  where con.connamespace='public'::regnamespace and con.contype='f'
    and con.conname not in (select name from mig_fk)

  -- ---- 06. RLS ------------------------------------------------------------
  union all
  select '06','RLS', c.relname,
         'rls=' || c.relrowsecurity::text || ' | force=' || c.relforcerowsecurity::text,
         null, 'rls=true | force=false',
         case when c.relrowsecurity and not c.relforcerowsecurity then 'OK' else 'MISMATCH' end
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname in (select name from t)

  -- ---- 07. Policies -------------------------------------------------------
  union all
  select '07','POLICY', p.tablename,
         p.policyname || ' | ' || p.cmd || ' | roles=' || coalesce(array_to_string(p.roles, ','), '-'),
         null,
         case when p.tablename='profiles' then 'one of 3 profiles policies'
              else 'single SELECT policy' end,
         case when p.tablename<>'profiles' and p.cmd='SELECT' then 'OK'
              when p.tablename='profiles' then 'OK'
              else 'MISMATCH' end
  from pg_policies p
  where p.schemaname='public'

  -- ---- 08. ACLs — profiles has its own expected shape --------------------
  union all
  select '08','ACL', g.table_name,
         g.grantee || ' -> ' || g.privilege_type,
         null,
         case when g.grantee='anon' then 'none (anywhere)'
              when g.grantee='service_role' then 'retained'
              when g.table_name='profiles' then 'SELECT or INSERT (profiles exception)'
              else 'SELECT only' end,
         case when g.grantee='anon' then 'MISMATCH'
              when g.grantee='service_role' then 'OK'
              when g.grantee='authenticated' and g.table_name='profiles'
                   then case when g.privilege_type in ('SELECT','INSERT') then 'OK' else 'MISMATCH' end
              when g.grantee='authenticated' and g.privilege_type='SELECT' then 'OK'
              else 'MISMATCH' end
  from information_schema.role_table_grants g
  where g.table_schema='public'
    and g.grantee in ('anon','authenticated','service_role')
    and g.table_name in (select name from t)

  -- ---- 09. RPCs -----------------------------------------------------------
  union all
  select '09','RPC', p.proname,
         pg_get_function_identity_arguments(p.oid) || ' -> ' || pg_get_function_result(p.oid),
         'secdef=' || p.prosecdef::text || ' | cfg=' || coalesce(array_to_string(p.proconfig,','),'(none)'),
         'secdef=true | cfg=search_path=""',
         case when p.prosecdef
               and coalesce(p.proconfig,'{}'::text[]) && array['search_path=""','search_path=']::text[]
              then 'OK' else 'MISMATCH' end
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (select name from rp)

  -- ---- 10. RPC EXECUTE grants --------------------------------------------
  union all
  select '10','EXECGRANT', p.proname,
         'authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
         || ' | anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text,
         'public_execute=' || (p.proacl is null
              or exists (select 1 from unnest(p.proacl) as u(item) where u.item::text like '=X/%'))::text,
         'authenticated=true | anon=false | public_execute=false',
         case when has_function_privilege('authenticated', p.oid, 'EXECUTE')
               and not has_function_privilege('anon', p.oid, 'EXECUTE')
               and p.proacl is not null
               and not exists (select 1 from unnest(p.proacl) as u(item) where u.item::text like '=X/%')
              then 'OK' else 'MISMATCH' end
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (select name from rp)

  -- ---- 11. Admin / profile protections -----------------------------------
  union all
  select '11','ADMIN', 'role-escalation trigger',
         coalesce((select tgname from pg_trigger where tgname='prevent_profile_role_escalation'), 'MISSING'),
         null, 'present',
         case when exists (select 1 from pg_trigger where tgname='prevent_profile_role_escalation')
              then 'OK' else 'MISMATCH' end
  union all
  select '11','ADMIN', 'trigger function hardening',
         'secdef=' || p.prosecdef::text || ' | cfg=' || coalesce(array_to_string(p.proconfig,','),'(none)'),
         null, 'secdef=true | cfg=search_path=""',
         case when p.prosecdef
               and coalesce(p.proconfig,'{}'::text[]) && array['search_path=""','search_path=']::text[]
              then 'OK' else 'MISMATCH' end
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='prevent_profile_role_escalation'
  union all
  select '11','ADMIN', 'profiles column-level UPDATE',
         coalesce(string_agg(distinct cg.column_name, ', ' order by cg.column_name), '(none)'),
         null, 'avatar_url, display_name, updated_at',
         case when count(distinct cg.column_name) = 3 then 'OK' else 'MISMATCH' end
  from information_schema.role_column_grants cg
  where cg.table_schema='public' and cg.table_name='profiles'
    and cg.grantee='authenticated' and cg.privilege_type='UPDATE'

  -- ---- 12. Row counts (exact) --------------------------------------------
  union all select '12','ROWCOUNT','profiles', null,
         (select count(*)::text from public.profiles), '0',
         case when (select count(*) from public.profiles)=0 then 'OK' else 'MISMATCH' end
  union all select '12','ROWCOUNT','user_routines', null,
         (select count(*)::text from public.user_routines), '0',
         case when (select count(*) from public.user_routines)=0 then 'OK' else 'MISMATCH' end
  union all select '12','ROWCOUNT','workout_logs', null,
         (select count(*)::text from public.workout_logs), '0',
         case when (select count(*) from public.workout_logs)=0 then 'OK' else 'MISMATCH' end
  union all select '12','ROWCOUNT','body_metrics', null,
         (select count(*)::text from public.body_metrics), '0',
         case when (select count(*) from public.body_metrics)=0 then 'OK' else 'MISMATCH' end
  union all select '12','ROWCOUNT','user_custom_exercises', null,
         (select count(*)::text from public.user_custom_exercises), '0',
         case when (select count(*) from public.user_custom_exercises)=0 then 'OK' else 'MISMATCH' end
  union all select '12','ROWCOUNT','workout_set_states', null,
         (select count(*)::text from public.workout_set_states), '0',
         case when (select count(*) from public.workout_set_states)=0 then 'OK' else 'MISMATCH' end

  -- ---- 13. Unexpected / unsafe objects -----------------------------------
  union all
  select '13','UNEXPECTED', 'public table: ' || c.relname,
         'not part of the expected six',
         null, 'none',
         'MISMATCH'
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname not in (select name from t)
  union all
  select '13','UNEXPECTED', 'FORCE RLS on ' || c.relname, 'force=true', null, 'none', 'MISMATCH'
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relforcerowsecurity
  union all
  select '13','UNEXPECTED', 'secdef fn without empty search_path: ' || p.proname,
         'cfg=' || coalesce(array_to_string(p.proconfig,','),'(none)'), null,
         'none', 'MISMATCH'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and p.prokind='f'
    and not (coalesce(p.proconfig,'{}'::text[]) && array['search_path=""','search_path=']::text[])

) report
order by check_id, area, item, detail nulls first;

-- =============================================================================
-- END POSTFLIGHT (read-only)
-- =============================================================================
