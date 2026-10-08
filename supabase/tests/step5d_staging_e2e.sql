-- =============================================================================
-- STEP 5D — Two-account end-to-end verification   (STAGING ONLY)
-- =============================================================================
-- Safety class: STAGING WRITE, FULLY REVERTED.
--   * The entire script runs inside ONE transaction that ends with ROLLBACK.
--   * Two throwaway auth.users rows are seeded INSIDE that transaction, so they
--     vanish on rollback. No password, token or secret is created or printed.
--   * Writes only test rows owned by those two throwaway users.
--   * NO DDL. NO DROP. NO TRUNCATE. NO DELETE. Nothing survives the rollback.
--
-- PREREQUISITE
--   The account-scope migration must already be applied (verified by 5C).
--   Run this in the Chieftain-Staging SQL Editor, project ref
--   nyeqrujaicdcwicywgu. NEVER run against production.
--
-- HOW TO READ THE OUTPUT  (Results panel — RAISE NOTICE is not shown by the UI)
--   The last statement before ROLLBACK is a SELECT, so the Results grid shows
--   ONE ROW PER CHECK plus a SUMMARY row:
--       seq | check_id | status | message | checks_passed | checks_total
--   On success you will see 17 rows with status 'PASS' and a final SUMMARY row
--   with checks_passed = 17 / checks_total = 17.
--
--   WHY A STATIC PASS LIST IS TRUSTWORTHY
--   Every check is written as "assertion fails -> RAISE EXCEPTION". A single
--   failure aborts the transaction, so the final SELECT never runs and the
--   editor shows the red ERROR naming the exact check that failed instead.
--   Reaching the SELECT therefore proves that all 17 checks passed.
--   The RAISE NOTICE lines are kept as well, for anyone running this through
--   psql where notices are visible.
--
-- WHY set_config('role', ...) INSTEAD OF SET LOCAL ROLE
--   Role switching happens inside a plpgsql DO block, where set_config() is the
--   unambiguous form. 'none' reverts to the session role.
--
-- TWO DISTINCT FAILURE MODES — do not confuse them
--   * A non-owned profile_key makes the three profile-scoped UPSERTS raise
--     42501 'profile not owned'. They never return NULL in that case.
--       upsert_routine / upsert_workout_log / upsert_body_metric / upsert_set_state
--       (upsert_routine has no profile check; the other three do)
--   * A CAS conflict, or a tombstone hit, or a row owned by somebody else,
--     returns NULL. That covers tombstone_*, update_*, and the RLS-filtered
--     WHERE clauses.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Seed: two throwaway staging auth users, removed by the final ROLLBACK.
-- Fixed UUIDs keep the run deterministic. No credentials are involved.
-- -----------------------------------------------------------------------------
do $seed$
declare
  inst uuid;
begin
  select id into inst from auth.instances limit 1;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data)
  values
    ('00000000-0000-4000-a000-00000000000a', inst, 'authenticated', 'authenticated',
     'e2e-a@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    ('00000000-0000-4000-a000-00000000000b', inst, 'authenticated', 'authenticated',
     'e2e-b@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  raise notice 'SEED OK: two throwaway auth users created inside the transaction';
exception
  when unique_violation then
    raise notice 'SEED: throwaway users already present in this transaction (fine)';
end
$seed$;


-- -----------------------------------------------------------------------------
-- The 17 checks. Unchanged logic: NOTICE on success, EXCEPTION on failure.
-- -----------------------------------------------------------------------------
do $e2e$
declare
  ua uuid := '00000000-0000-4000-a000-00000000000a';
  ub uuid := '00000000-0000-4000-a000-00000000000b';

  c_log   uuid := '11111111-1111-4111-8111-111111111111';
  c_met   uuid := '22222222-2222-4222-8222-222222222222';
  c_cust  uuid := '33333333-3333-4333-8333-333333333333';
  c_log3  uuid := '44444444-4444-4444-8444-444444444444';
  c_logb  uuid := '55555555-5555-4555-8555-555555555555';
  c_esc   uuid := '66666666-6666-4666-8666-666666666666';

  v_rev    bigint;
  v_rev2   bigint;
  v_n      integer;
  v_uid    uuid;
  v_txt    text;
  v_bool   boolean;
  v_uid_a  uuid;
begin
  -- =========================================================================
  -- T01  Two distinct accounts, each with its own auth.uid()
  -- =========================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_uid_a := auth.uid();
  perform set_config('role', 'none', true);

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_uid := auth.uid();
  perform set_config('role', 'none', true);

  if v_uid_a is null or v_uid is null then
    raise exception 'T01 FAIL: auth.uid() returned NULL';
  end if;
  if v_uid_a <> ua then
    raise exception 'T01 FAIL: account A auth.uid()=% expected %', v_uid_a, ua;
  end if;
  if v_uid <> ub then
    raise exception 'T01 FAIL: account B auth.uid()=% expected %', v_uid, ub;
  end if;
  if v_uid_a = v_uid then
    raise exception 'T01 FAIL: accounts are not distinct';
  end if;
  raise notice 'T01 PASS: two distinct accounts with distinct auth.uid()';

  -- =========================================================================
  -- T02  Account A creates its own profile-scoped data through the RPC contract
  -- =========================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select public.upsert_routine('e2e_prof_a', '{"days":[{"id":"d1"}]}'::jsonb,
                               '{"name":"A plan"}'::jsonb, null) into v_rev;
  if v_rev <> 1 then raise exception 'T02 FAIL: routine create returned %', v_rev; end if;

  select public.upsert_workout_log('e2e_prof_a', c_log, 'leg_curl',
                                   '{"timestamp":1000}'::jsonb, null) into v_rev;
  if v_rev <> 1 then raise exception 'T02 FAIL: log create returned %', v_rev; end if;

  select public.upsert_body_metric('e2e_prof_a', c_met, '{"id":"m_1","timestamp":2000}'::jsonb, null) into v_rev;
  if v_rev <> 1 then raise exception 'T02 FAIL: metric create returned %', v_rev; end if;

  select public.upsert_set_state('e2e_prof_a', 'IR_WEEK_E2E', '{"sets":{}}'::jsonb, null) into v_rev;
  if v_rev <> 1 then raise exception 'T02 FAIL: set-state create returned %', v_rev; end if;

  select public.upsert_custom_exercise(c_cust, '{"id":"cust_e2e"}'::jsonb, null) into v_rev;
  if v_rev <> 1 then raise exception 'T02 FAIL: custom-exercise create returned %', v_rev; end if;

  raise notice 'T02 PASS: A created routine/log/metric/set-state/custom-exercise via RPCs (rev 1 each)';

  -- =========================================================================
  -- T03  Account A reads back its own five record families
  -- =========================================================================
  select count(*) into v_n from public.user_routines where profile_key = 'e2e_prof_a';
  if v_n <> 1 then raise exception 'T03 FAIL: own routine not readable (%)', v_n; end if;
  select count(*) into v_n from public.workout_logs where client_record_id = c_log;
  if v_n <> 1 then raise exception 'T03 FAIL: own log not readable (%)', v_n; end if;
  select count(*) into v_n from public.body_metrics where client_record_id = c_met;
  if v_n <> 1 then raise exception 'T03 FAIL: own metric not readable (%)', v_n; end if;
  select count(*) into v_n from public.workout_set_states where week_key = 'IR_WEEK_E2E';
  if v_n <> 1 then raise exception 'T03 FAIL: own set state not readable (%)', v_n; end if;
  select count(*) into v_n from public.user_custom_exercises where client_record_id = c_cust;
  if v_n <> 1 then raise exception 'T03 FAIL: own custom exercise not readable (%)', v_n; end if;
  raise notice 'T03 PASS: A reads back all five of its own record families';

  -- =========================================================================
  -- T04  Correct expected_revision performs the update and increments revision
  -- =========================================================================
  select public.upsert_routine('e2e_prof_a', '{"days":[]}'::jsonb,
                               '{"name":"A plan v2"}'::jsonb, 1) into v_rev;
  if v_rev <> 2 then raise exception 'T04 FAIL: update returned % expected 2', v_rev; end if;
  raise notice 'T04 PASS: correct expected_revision updates and increments (1 -> 2)';

  -- =========================================================================
  -- T05  CAS: NULL creates, correct revision updates, stale conflicts w/o write
  -- =========================================================================
  select public.upsert_routine('e2e_prof_a', '{"days":[{"id":"STALE"}]}'::jsonb, null, 1) into v_rev2;
  if v_rev2 is not null then
    raise exception 'T05 FAIL: stale revision was accepted (returned %)', v_rev2;
  end if;
  select routine_data::text into v_txt from public.user_routines where profile_key = 'e2e_prof_a';
  if v_txt like '%STALE%' then
    raise exception 'T05 FAIL: stale write overwrote the stored row';
  end if;

  select public.upsert_routine('e2e_prof_a', '{}'::jsonb, null, null) into v_rev2;
  if v_rev2 is not null then
    raise exception 'T05 FAIL: NULL revision against an existing row was accepted (%)', v_rev2;
  end if;
  raise notice 'T05 PASS: NULL creates, correct revision updates, stale revision conflicts without overwriting';

  -- =========================================================================
  -- T06  Direct INSERT / UPDATE / DELETE on data tables are denied
  -- =========================================================================
  begin
    insert into public.user_routines (user_id, profile_key, routine_data)
    values (ua, 'direct_write', '{}'::jsonb);
    raise exception 'T06 FAIL: direct INSERT was accepted';
  exception when insufficient_privilege then
    raise notice 'T06a PASS: direct INSERT denied (insufficient_privilege)';
  end;

  begin
    update public.user_routines set routine_data = '{"hacked":true}'::jsonb where profile_key = 'e2e_prof_a';
    raise exception 'T06 FAIL: direct UPDATE was accepted';
  exception when insufficient_privilege then
    raise notice 'T06b PASS: direct UPDATE denied (insufficient_privilege)';
  end;

  begin
    delete from public.workout_logs where client_record_id = c_log;
    raise exception 'T06 FAIL: direct DELETE was accepted';
  exception when insufficient_privilege then
    raise notice 'T06c PASS: direct DELETE denied (insufficient_privilege)';
  end;

  -- =========================================================================
  -- T07  RPC ownership is derived from auth.uid(), never from the client
  -- =========================================================================
  begin
    perform public.upsert_workout_log('not_my_profile', c_log3, 'squat',
                                      '{"timestamp":3000}'::jsonb, null);
    raise exception 'T07 FAIL: write to a non-owned profile was accepted';
  exception when sqlstate '42501' then
    raise notice 'T07 PASS: ownership comes from auth.uid(); non-owned profile rejected';
  end;

  -- =========================================================================
  -- T08  profile_key isolation inside a single account
  -- =========================================================================
  select public.upsert_routine('e2e_prof_a2', '{"days":[]}'::jsonb, null, null) into v_rev;
  if v_rev <> 1 then raise exception 'T08 FAIL: second profile create returned %', v_rev; end if;
  select public.upsert_workout_log('e2e_prof_a2', c_log3, 'squat',
                                   '{"timestamp":4000}'::jsonb, null) into v_rev;
  if v_rev <> 1 then raise exception 'T08 FAIL: second profile log returned %', v_rev; end if;

  select count(*) into v_n from public.workout_logs
   where client_record_id = c_log3 and profile_key = 'e2e_prof_a2';
  if v_n <> 1 then raise exception 'T08 FAIL: log not attached to its own profile_key (%)', v_n; end if;
  select count(*) into v_n from public.workout_logs
   where client_record_id = c_log and profile_key = 'e2e_prof_a';
  if v_n <> 1 then raise exception 'T08 FAIL: first profile log was disturbed (%)', v_n; end if;
  raise notice 'T08 PASS: profile_key isolation within one account';

  -- =========================================================================
  -- T09  Account B cannot read account A's rows
  -- =========================================================================
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select (select count(*) from public.user_routines)
       + (select count(*) from public.workout_logs)
       + (select count(*) from public.body_metrics)
       + (select count(*) from public.workout_set_states)
       + (select count(*) from public.user_custom_exercises) into v_n;
  if v_n <> 0 then raise exception 'T09 FAIL: B can read % row(s) belonging to A', v_n; end if;
  raise notice 'T09 PASS: B reads 0 of A''s rows across all five tables (RLS)';

  -- =========================================================================
  -- T10  Account B creates its own data; account A cannot mutate it
  -- =========================================================================
  select public.upsert_routine('e2e_prof_b', '{"days":[]}'::jsonb, null, null) into v_rev;
  if v_rev <> 1 then raise exception 'T10 FAIL: B routine create returned %', v_rev; end if;
  select public.upsert_workout_log('e2e_prof_b', c_logb, 'row',
                                   '{"timestamp":5000}'::jsonb, null) into v_rev;
  if v_rev <> 1 then raise exception 'T10 FAIL: B log create returned %', v_rev; end if;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select public.tombstone_workout_log(c_logb, 1) into v_rev;
  if v_rev is not null then
    raise exception 'T10 FAIL: A mutated B''s row (returned %)', v_rev;
  end if;

  -- A cannot write into B's profile. By contract the three profile-scoped
  -- upserts RAISE 42501 for a non-owned profile; they do NOT return NULL.
  begin
    perform public.upsert_body_metric('e2e_prof_b', c_logb, '{"id":"x"}'::jsonb, null);
    raise exception 'T10 FAIL: A wrote into B''s profile';
  exception when sqlstate '42501' then
    raise notice 'T10b PASS: A cannot write into B''s profile (42501 profile not owned)';
  end;
  raise notice 'T10 PASS: A cannot mutate B''s data through the RPCs';

  -- =========================================================================
  -- T11  Tombstone is final — no resurrection
  -- =========================================================================
  select public.tombstone_workout_log(c_log, 1) into v_rev;
  if v_rev <> 2 then raise exception 'T11 FAIL: tombstone returned % expected 2', v_rev; end if;

  select public.upsert_workout_log('e2e_prof_a', c_log, 'leg_curl',
                                   '{"timestamp":9999}'::jsonb, null) into v_rev2;
  if v_rev2 is not null then
    raise exception 'T11 FAIL: tombstoned row was resurrected (returned %)', v_rev2;
  end if;
  select public.upsert_workout_log('e2e_prof_a', c_log, 'leg_curl',
                                   '{"timestamp":9999}'::jsonb, 2) into v_rev2;
  if v_rev2 is not null then
    raise exception 'T11 FAIL: tombstoned row updated with a valid revision (%)', v_rev2;
  end if;
  raise notice 'T11 PASS: tombstone is final; no resurrection by insert or update';

  -- =========================================================================
  -- T12  Routine tombstone cascades set states and unassigns (preserves) rows
  -- =========================================================================
  select public.upsert_routine('e2e_cascade', '{"days":[]}'::jsonb, null, null) into v_rev;
  select public.upsert_workout_log('e2e_cascade', c_esc, 'row',
                                   '{"timestamp":6000}'::jsonb, null) into v_rev;
  select public.upsert_set_state('e2e_cascade', 'IR_WEEK_C', '{"sets":{}}'::jsonb, null) into v_rev;

  select public.tombstone_routine('e2e_cascade', 1) into v_rev2;
  if v_rev2 <> 2 then raise exception 'T12 FAIL: tombstone_routine returned %', v_rev2; end if;

  select count(*) into v_n from public.workout_set_states
   where profile_key = 'e2e_cascade' and deleted_at is not null;
  if v_n <> 1 then raise exception 'T12 FAIL: set state was not tombstoned (%)', v_n; end if;

  select count(*) into v_n from public.workout_logs
   where client_record_id = c_esc and profile_key is null and deleted_at is null;
  if v_n <> 1 then raise exception 'T12 FAIL: log was not preserved-and-unassigned (%)', v_n; end if;

  select count(*) into v_n from public.user_routines
   where profile_key = 'e2e_cascade' and deleted_at is not null;
  if v_n <> 1 then raise exception 'T12 FAIL: routine was not tombstoned (%)', v_n; end if;
  raise notice 'T12 PASS: routine tombstone cascades set states and preserves+unassigns logs';

  -- =========================================================================
  -- T13  Custom exercise cannot escalate ownerId
  -- =========================================================================
  select public.upsert_custom_exercise(c_esc, json_build_object('id','cust_esc','ownerId', ub::text)::jsonb, null)
    into v_rev;
  if v_rev <> 1 then raise exception 'T13 FAIL: create returned %', v_rev; end if;

  select count(*) into v_n from public.user_custom_exercises
   where client_record_id = c_esc and user_id = ua and not (exercise_data ? 'ownerId');
  if v_n <> 1 then
    raise exception 'T13 FAIL: ownerId not stripped, or owner is not auth.uid() (%)', v_n;
  end if;
  raise notice 'T13 PASS: custom exercise ownerId is stripped; owner is auth.uid()';

  -- =========================================================================
  -- T14  upsert_routine never persists the device-local PIN
  -- =========================================================================
  select public.upsert_routine('e2e_pin', '{"days":[]}'::jsonb,
                               '{"name":"p","pin":"1234"}'::jsonb, null) into v_rev;
  if v_rev <> 1 then raise exception 'T14 FAIL: create returned %', v_rev; end if;
  select count(*) into v_n from public.user_routines
   where profile_key = 'e2e_pin' and profile_data ? 'pin';
  if v_n <> 0 then raise exception 'T14 FAIL: PIN was persisted into profile_data'; end if;
  raise notice 'T14 PASS: upsert_routine never persists the PIN';

  -- =========================================================================
  -- T15  client_record_id is the idempotency key
  -- =========================================================================
  select public.upsert_workout_log('e2e_prof_a2', c_log3, 'squat',
                                   '{"timestamp":7000}'::jsonb, 1) into v_rev;
  if v_rev <> 2 then raise exception 'T15 FAIL: update returned % expected 2', v_rev; end if;
  select count(*) into v_n from public.workout_logs
   where user_id = ua and client_record_id = c_log3;
  if v_n <> 1 then
    raise exception 'T15 FAIL: % rows exist for one client_record_id (not idempotent)', v_n;
  end if;
  raise notice 'T15 PASS: repeating a client_record_id updates one row, never duplicates';

  -- =========================================================================
  -- T16  Admin / role escalation is not reachable by a normal user
  -- =========================================================================
  v_bool := false;
  v_txt  := null;
  begin
    insert into public.profiles (id, display_name, role) values (ua, 'escalate', 'admin');
    v_bool := true;
  exception when others then
    v_txt := sqlerrm;
  end;
  if v_bool then raise exception 'T16 FAIL: a normal user created an admin profile'; end if;
  if v_txt not like '%elevated role%' then
    raise exception 'T16 FAIL: expected the role-escalation trigger, got: %', v_txt;
  end if;
  raise notice 'T16a PASS: role escalation blocked by the trigger';

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  v_bool := false;
  begin
    perform public.upsert_routine('anon_attempt', '{}'::jsonb, null, null);
  exception when others then
    v_bool := true;
  end;
  perform set_config('role', 'none', true);
  if not v_bool then raise exception 'T16 FAIL: anon executed an RPC'; end if;
  raise notice 'T16b PASS: anon cannot execute the RPCs';

  -- =========================================================================
  -- T17  Pull surface is scoped: B sees nothing of A, A sees its own rows
  -- =========================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select (select count(*) from public.user_routines)
       + (select count(*) from public.workout_logs)
       + (select count(*) from public.body_metrics)
       + (select count(*) from public.workout_set_states)
       + (select count(*) from public.user_custom_exercises) into v_n;
  if v_n = 0 then
    raise exception 'T17 FAIL: B''s pull returned 0 rows, but B created data in T10 — test is not meaningful';
  end if;
  if exists (select 1 from public.workout_logs where client_record_id = c_esc)
     or exists (select 1 from public.user_routines where profile_key like 'e2e_prof_a%') then
    raise exception 'T17 FAIL: A''s rows leaked into B''s pull';
  end if;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_n from public.user_routines where profile_key like 'e2e_prof_a%';
  if v_n < 2 then raise exception 'T17 FAIL: A cannot see its own routines (%)', v_n; end if;
  select count(*) into v_n from public.user_routines where profile_key = 'e2e_prof_b';
  if v_n <> 0 then raise exception 'T17 FAIL: A can see B''s routine'; end if;
  perform set_config('role', 'none', true);
  raise notice 'T17 PASS: pull results are scoped to the authenticated account, both directions';

  raise notice '=== STEP 5D E2E: all 17 checks passed ===';
end
$e2e$;


-- -----------------------------------------------------------------------------
-- Results panel output.
-- Reaching this SELECT proves that all 17 checks passed: any failure above
-- raises an exception, which aborts the transaction, so this statement would
-- never run and the editor would show the red ERROR naming the failed check.
-- -----------------------------------------------------------------------------
select seq, check_id, status, message, checks_passed, checks_total
from (values
  ( 1, 'T01', 'PASS', 'two distinct accounts, each with its own auth.uid()',                                  null::int, null::int),
  ( 2, 'T02', 'PASS', 'account A created routine/log/metric/set-state/custom-exercise through the RPCs',      null::int, null::int),
  ( 3, 'T03', 'PASS', 'account A read back all five of its own record families',                              null::int, null::int),
  ( 4, 'T04', 'PASS', 'correct expected_revision updates and increments the revision',                        null::int, null::int),
  ( 5, 'T05', 'PASS', 'CAS: NULL creates, correct revision updates, stale revision conflicts without write',  null::int, null::int),
  ( 6, 'T06', 'PASS', 'direct INSERT / UPDATE / DELETE denied for authenticated',                             null::int, null::int),
  ( 7, 'T07', 'PASS', 'ownership derived from auth.uid(); non-owned profile rejected (42501)',                null::int, null::int),
  ( 8, 'T08', 'PASS', 'profile_key isolation inside a single account',                                        null::int, null::int),
  ( 9, 'T09', 'PASS', 'account B reads 0 of account A''s rows across all five tables (RLS)',                  null::int, null::int),
  (10, 'T10', 'PASS', 'account A cannot mutate account B''s data through the RPCs',                           null::int, null::int),
  (11, 'T11', 'PASS', 'tombstone is final; no resurrection by insert or update',                              null::int, null::int),
  (12, 'T12', 'PASS', 'routine tombstone cascades set states and preserves+unassigns logs',                   null::int, null::int),
  (13, 'T13', 'PASS', 'custom exercise ownerId stripped; owner is auth.uid()',                                null::int, null::int),
  (14, 'T14', 'PASS', 'upsert_routine never persists the device-local PIN',                                   null::int, null::int),
  (15, 'T15', 'PASS', 'repeating a client_record_id updates one row, never duplicates',                       null::int, null::int),
  (16, 'T16', 'PASS', 'role escalation blocked by the trigger; anon cannot execute the RPCs',                 null::int, null::int),
  (17, 'T17', 'PASS', 'pull results are scoped to the authenticated account, both directions',                null::int, null::int),
  (18, 'SUMMARY', 'PASS', '=== STEP 5D E2E: all 17 checks passed ===',                                        17,          17)
) as r(seq, check_id, status, message, checks_passed, checks_total)
order by seq;

-- Nothing survives: the two throwaway auth users and every test row are removed.
rollback;

-- =============================================================================
-- END STEP 5D E2E
-- =============================================================================
