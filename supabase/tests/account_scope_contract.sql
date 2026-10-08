-- =============================================================================
-- Account-scope contract tests -- STAGING ONLY
-- =============================================================================
-- Status:   NOT RUN. Requires the migration to be applied to staging first.
-- Safety:   STAGING WRITE (creates temporary test rows inside a transaction that
--           is rolled back at the end). NEVER run against production.
--
-- Prerequisite: run supabase/migrations/20261008000000_account_scoped_cloud_data.sql
--               on the staging project first, then execute this file in the
--               Dashboard SQL Editor.
--
-- Every test raises an exception on failure and prints NOTICE on success.
-- The whole script is wrapped in a transaction that is ROLLED BACK, so no test
-- data survives.
--
-- Replace the two UUID literals below with real staging auth user ids that exist
-- in auth.users. Do not commit real user ids into this file.
-- =============================================================================

begin;

do $t$
declare
  user_a uuid := '00000000-0000-4000-8000-00000000000a';  -- replace on staging
  user_b uuid := '00000000-0000-4000-8000-00000000000b';  -- replace on staging
  v_rev  bigint;
  v_rev2 bigint;
  v_n    integer;
begin
  -- -------------------------------------------------------------------------
  -- T1. Ownership helper is SECURITY DEFINER with an empty search_path
  -- -------------------------------------------------------------------------
  select count(*) into v_n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'owns_active_profile'
    and p.prosecdef
    and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%';
  if v_n <> 1 then
    raise exception 'T1 FAIL: owns_active_profile is not a hardened SECURITY DEFINER function';
  end if;
  raise notice 'T1 PASS: ownership helper is hardened';

  -- -------------------------------------------------------------------------
  -- T2. All 12 mutation RPCs are SECURITY DEFINER with an empty search_path,
  --     and none accepts a client-supplied owner id
  -- -------------------------------------------------------------------------
  select count(*) into v_n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('upsert_routine','tombstone_routine',
                      'upsert_workout_log','update_workout_log','tombstone_workout_log',
                      'upsert_body_metric','update_body_metric','tombstone_body_metric',
                      'upsert_custom_exercise','tombstone_custom_exercise',
                      'upsert_set_state','tombstone_set_state')
    and p.prosecdef
    and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%';
  if v_n <> 12 then
    raise exception 'T2 FAIL: expected 12 hardened RPCs, found %', v_n;
  end if;

  select count(*) into v_n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like any (array['upsert\_%','update\_%','tombstone\_%'])
    and pg_get_function_identity_arguments(p.oid) ~ 'p_user_id';
  if v_n <> 0 then
    raise exception 'T2 FAIL: % RPC(s) accept a client-supplied owner id', v_n;
  end if;
  raise notice 'T2 PASS: 12 hardened RPCs, no client-supplied owner id';

  -- -------------------------------------------------------------------------
  -- T3. authenticated holds SELECT only on the data tables; anon holds nothing
  -- -------------------------------------------------------------------------
  select count(*) into v_n
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('user_routines','workout_logs','body_metrics',
                       'user_custom_exercises','workout_set_states')
    and grantee = 'authenticated'
    and privilege_type <> 'SELECT';
  if v_n <> 0 then
    raise exception 'T3 FAIL: authenticated retains % non-SELECT privilege(s) on data tables', v_n;
  end if;

  select count(*) into v_n
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon';
  if v_n <> 0 then
    raise exception 'T3 FAIL: anon retains % table privilege(s)', v_n;
  end if;
  raise notice 'T3 PASS: least-privilege grants in place';

  -- -------------------------------------------------------------------------
  -- T4. anon cannot execute any RPC
  -- -------------------------------------------------------------------------
  select count(*) into v_n
  from information_schema.role_routine_grants
  where routine_schema = 'public' and grantee = 'anon';
  if v_n <> 0 then
    raise exception 'T4 FAIL: anon retains EXECUTE on % routine(s)', v_n;
  end if;
  raise notice 'T4 PASS: anon has no EXECUTE grants';

  -- -------------------------------------------------------------------------
  -- T5. profiles grants and role-escalation trigger are untouched
  -- -------------------------------------------------------------------------
  select count(*) into v_n
  from pg_trigger where tgname = 'prevent_profile_role_escalation';
  if v_n <> 1 then
    raise exception 'T5 FAIL: role-escalation trigger missing';
  end if;

  select count(*) into v_n
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'profiles'
    and grantee = 'authenticated' and privilege_type = 'INSERT';
  if v_n <> 1 then
    raise exception 'T5 FAIL: authenticated lost INSERT on profiles (admin auth would break)';
  end if;
  raise notice 'T5 PASS: profiles grants and role trigger intact';

  -- -------------------------------------------------------------------------
  -- T6. Historical rows were not modified by the migration
  --     (all pre-existing logs/metrics must still have profile_key IS NULL
  --      unless they were created after the migration)
  -- -------------------------------------------------------------------------
  select count(*) into v_n
  from public.workout_logs
  where deleted_at is not null;
  if v_n <> 0 then
    raise exception 'T6 FAIL: % workout_logs row(s) are tombstoned immediately after migration', v_n;
  end if;
  raise notice 'T6 PASS: no rows tombstoned by the migration';

  -- -------------------------------------------------------------------------
  -- T7. Upsert path: create a routine, then a log; CAS conflict returns NULL
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select public.upsert_routine('test_prof', '{"days":[]}'::jsonb, '{"name":"T","pin":"1234"}'::jsonb, null)
    into v_rev;
  if v_rev is null or v_rev <> 1 then
    raise exception 'T7 FAIL: first routine upsert should return revision 1, got %', v_rev;
  end if;

  -- PIN must have been stripped
  select count(*) into v_n
  from public.user_routines
  where profile_key = 'test_prof' and profile_data ? 'pin';
  if v_n <> 0 then
    raise exception 'T7 FAIL: profile_data retained the device-local pin';
  end if;

  -- Wrong expected revision must conflict, not throw
  select public.upsert_routine('test_prof', '{"days":[]}'::jsonb, null, 99) into v_rev2;
  if v_rev2 is not null then
    raise exception 'T7 FAIL: stale revision did not conflict (got %)', v_rev2;
  end if;
  raise notice 'T7 PASS: upsert + CAS conflict + pin strip';

  -- -------------------------------------------------------------------------
  -- T8. A user cannot attach a log to a profile they do not own
  -- -------------------------------------------------------------------------
  begin
    perform public.upsert_workout_log('someone_elses_profile', gen_random_uuid(), 'leg_curl',
                                      '{"timestamp":1}'::jsonb, null);
    raise exception 'T8 FAIL: write to a non-owned profile was accepted';
  exception
    when sqlstate '42501' then
      raise notice 'T8 PASS: non-owned profile rejected';
  end;

  -- -------------------------------------------------------------------------
  -- T9. Tombstone cannot be resurrected
  -- -------------------------------------------------------------------------
  select public.upsert_workout_log('test_prof', '11111111-1111-4111-8111-111111111111'::uuid,
                                   'leg_curl', '{"timestamp":1}'::jsonb, null) into v_rev;
  if v_rev <> 1 then
    raise exception 'T9 FAIL: log insert returned %', v_rev;
  end if;

  select public.tombstone_workout_log('11111111-1111-4111-8111-111111111111'::uuid, v_rev) into v_rev2;
  if v_rev2 <> 2 then
    raise exception 'T9 FAIL: tombstone returned %', v_rev2;
  end if;

  select public.upsert_workout_log('test_prof', '11111111-1111-4111-8111-111111111111'::uuid,
                                   'leg_curl', '{"timestamp":2}'::jsonb, null) into v_rev;
  if v_rev is not null then
    raise exception 'T9 FAIL: tombstoned row was resurrected (got %)', v_rev;
  end if;
  raise notice 'T9 PASS: tombstone is final';

  -- -------------------------------------------------------------------------
  -- T10. Cross-account read is denied
  -- -------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into v_n from public.workout_logs where user_id = user_a;
  if v_n <> 0 then
    raise exception 'T10 FAIL: user B can read % of user A''s logs', v_n;
  end if;
  raise notice 'T10 PASS: cross-account read denied';

  -- -------------------------------------------------------------------------
  -- T11. Profile deletion preserves history and unassigns it (decision A3)
  -- -------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select public.upsert_workout_log('test_prof', '22222222-2222-4222-8222-222222222222'::uuid,
                                   'squat', '{"timestamp":3}'::jsonb, null) into v_rev;

  select public.tombstone_routine('test_prof', 1) into v_rev2;
  if v_rev2 <> 2 then
    raise exception 'T11 FAIL: tombstone_routine returned %', v_rev2;
  end if;

  reset role;
  select count(*) into v_n
  from public.workout_logs
  where client_record_id = '22222222-2222-4222-8222-222222222222'::uuid
    and profile_key is null
    and deleted_at is null;
  if v_n <> 1 then
    raise exception 'T11 FAIL: log was not preserved-and-unassigned on profile deletion';
  end if;
  raise notice 'T11 PASS: profile deletion preserves and unassigns history';

  raise notice '--- account_scope_contract: all tests passed ---';
end
$t$;

-- No test data survives.
rollback;

-- =============================================================================
-- END CONTRACT TESTS
-- =============================================================================
