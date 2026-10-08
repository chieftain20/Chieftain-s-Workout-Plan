"""One-time explicit migration of Morvarid's old offline account.

Morvarid's data lives in the OLD offline scope 'local:user_morvarid' (the "inci"
login) plus pre-v10 unscoped keys. Her new Supabase account
(movahedi.mov@gmail.com) must be able to pull that data into itself through an
explicit, confirmed, one-time flow that uses the EXISTING account-scoped storage,
outbox, CAS and allowlisted RPCs.

Covered here:

  * discovery is READ ONLY and can only ever read the ONE fixed source scope;
  * selection is a whitelist of Morvarid's profile ids, so admin_hossein /
    hossein_chieftain / template_male can never be selected;
  * ownership is never taken from ownerId alone, and the destination owner is the
    authenticated UUID (the legacy identity never becomes an owner value);
  * the routine is mapped to an account-owned profile_key with no legacy ownerId
    and no device PIN;
  * every data family migrates (routine, logs, metrics, set states, drafts,
    custom exercises) and reaches the cloud through the allowlisted RPCs;
  * a repeated run is idempotent and creates no duplicate cloud row;
  * an unconfirmed or unauthenticated run does nothing;
  * the legacy source stays byte-identical.

Static checks run alongside the behavioural ones.
"""

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import _common as c

NODE = shutil.which("node")

HARNESS = r"""
(function () {
  'use strict';

  const localStorage = {};
  Object.defineProperties(localStorage, {
    getItem: { value: function (k) { return Object.prototype.hasOwnProperty.call(localStorage, k) ? localStorage[k] : null; } },
    setItem: { value: function (k, v) { localStorage[String(k)] = String(v); } },
    removeItem: { value: function (k) { delete localStorage[String(k)]; } },
    key: { value: function (i) { return Object.keys(localStorage)[i] || null; } },
    length: { get: function () { return Object.keys(localStorage).length; } }
  });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'window', {
    value: { location: { hostname: 'chieftain20.github.io', origin: 'https://chieftain20.github.io',
                         pathname: '/Chieftain-s-Workout-Plan/', search: '', hash: '' } },
    writable: true, configurable: true
  });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'history', { value: { replaceState: function () {} }, writable: true, configurable: true });

  let currentLang = 'fa';
  let currentAuthUser = null;
  let currentLocalUser = null;
  let currentUserProfile = null;
  let serverAdminVerified = false;
  let activeProfileId = 'template_male';
  let allProfiles = [];
  let customExercises = [];
  let masterExerciseOverrides = {};
  let supabaseClient = null;
  function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || ''); }
  function showToast() {}
  function confirm() { return true; }
  function renderApp() {}
  function updateConflictBadge() {}
  function isAutoCloudSyncEnabled() { return true; }
  async function pushToCloudStorage() { scheduleOutboxFlush(); return true; }
  const TEMPLATE_MALE_PROFILE = { id: 'template_male', name: 'TM', days: [] };
  const TEMPLATE_FEMALE_PROFILE = { id: 'template_female', name: 'TF', days: [] };

  const TABLES = ['user_routines', 'workout_logs', 'body_metrics', 'user_custom_exercises', 'workout_set_states'];
  const server = {};
  TABLES.forEach(function (t) { server[t] = []; });
  const rpcCalls = [];
  const selectCalls = [];
  const KIND_TABLE = {
    upsert_routine: 'user_routines', tombstone_routine: 'user_routines',
    upsert_workout_log: 'workout_logs', update_workout_log: 'workout_logs', tombstone_workout_log: 'workout_logs',
    upsert_body_metric: 'body_metrics', update_body_metric: 'body_metrics', tombstone_body_metric: 'body_metrics',
    upsert_custom_exercise: 'user_custom_exercises', tombstone_custom_exercise: 'user_custom_exercises',
    upsert_set_state: 'workout_set_states', tombstone_set_state: 'workout_set_states'
  };
  function rowKeyOf(kind, p) {
    if (kind.indexOf('routine') >= 0) return p.p_profile_key;
    if (kind.indexOf('set_state') >= 0) return p.p_profile_key + '|' + p.p_week_key;
    return p.p_client_record_id;
  }
  function makeQuery(table, filters) {
    function rows() {
      let r = server[table].slice();
      filters.forEach(function (f) { r = r.filter(function (x) { return x[f[0]] === f[1]; }); });
      return r;
    }
    return {
      eq: function (col, val) { return makeQuery(table, filters.concat([[col, val]])); },
      maybeSingle: function () { return Promise.resolve({ data: rows()[0] || null, error: null }); },
      then: function (res, rej) { return Promise.resolve({ data: rows(), error: null }).then(res, rej); }
    };
  }
  const AUTH = '00000000-0000-4000-c000-0000000000aa';
  const OTHER_AUTH = '00000000-0000-4000-c000-0000000000cc';
  function makeClient() {
    return {
      auth: { getSession: async function () {
        return { data: { session: currentAuthUser ? { user: { id: currentAuthUser.id } } : null }, error: null };
      } },
      from: function (t) { selectCalls.push(t); return { select: function () { return makeQuery(t, []); } }; },
      rpc: async function (kind, payload) {
        rpcCalls.push({ kind: kind, payload: JSON.parse(JSON.stringify(payload || {})) });
        const table = KIND_TABLE[kind];
        const key = rowKeyOf(kind, payload);
        const row = server[table].find(function (r) {
          return (r.profile_key === key) || (r.client_record_id === key) ||
                 ((r.profile_key + '|' + r.week_key) === key);
        });
        const isTomb = kind.indexOf('tombstone_') === 0;
        if (row) {
          if (row.deleted_at) return { data: null, error: null };
          if (payload.p_expected_revision === null || payload.p_expected_revision === undefined ||
              payload.p_expected_revision !== row.revision) return { data: null, error: null };
          row.revision += 1;
          return { data: row.revision, error: null };
        }
        if (isTomb) return { data: null, error: null };
        // Ownership is server-side: the row is written under auth.uid().
        const fresh = { user_id: currentAuthUser.id, revision: 1, deleted_at: null };
        if (kind.indexOf('routine') >= 0) {
          fresh.profile_key = key;
          fresh.routine_data = payload.p_routine_data || null;
          fresh.profile_data = payload.p_profile_data || null;
        } else if (kind === 'upsert_set_state') {
          fresh.profile_key = payload.p_profile_key; fresh.week_key = payload.p_week_key;
          fresh.state_data = payload.p_state_data;
        } else if (kind === 'upsert_workout_log') {
          fresh.client_record_id = key; fresh.profile_key = payload.p_profile_key;
          fresh.exercise_id = payload.p_exercise_id; fresh.log_entry = payload.p_log_entry;
        } else if (kind === 'upsert_body_metric') {
          fresh.client_record_id = key; fresh.profile_key = payload.p_profile_key;
          fresh.metric_record = payload.p_metric_record;
        } else if (kind.indexOf('custom_exercise') >= 0) {
          const d = Object.assign({}, payload.p_exercise_data || {});
          delete d.ownerId;                              // server-side strip
          fresh.client_record_id = key; fresh.exercise_data = d;
        } else { fresh.client_record_id = key; }
        server[table].push(fresh);
        return { data: 1, error: null };
      }
    };
  }

/*__BLOCKS__*/

/*__FNS__*/

  supabaseClient = makeClient();

  const MOR_PROFILE = { id: 'morvarid', name: 'مروارید', pin: 'inci', days: [
    { id: 'd1', title: 'شنبه', type: 'gym',
      supersets: [{ exercises: [{ exId: 'cust_111' }, { exId: 'bench' }] }], singles: [] }
  ] };
  const HOSSEIN_PROFILE = { id: 'hossein_chieftain', name: 'Hossein Chieftain',
                            days: [{ id: 'h1', singles: [{ exId: 'squat' }] }] };
  const HOSSEIN_OFFLINE_PROFILE = { id: 'admin_hossein', name: 'Hossein',
                                    days: [{ id: 'h2', singles: [{ exId: 'deadlift' }] }] };

  function srcKey(name, sub) {
    return 'chieftain_v10:local:user_morvarid:' + name + (sub === undefined ? '' : ':' + sub);
  }
  function hosseinKey(name, sub) {
    return 'chieftain_v10:local:admin_hossein:' + name + (sub === undefined ? '' : ':' + sub);
  }

  function seedSource() {
    // ---- Morvarid's v10 offline scope (the "inci" account) ----
    localStorage[srcKey('profiles')] = JSON.stringify([
      MOR_PROFILE, HOSSEIN_PROFILE, { id: 'template_male', name: 'TM', days: [] },
      { id: 'template_female', name: 'TF', days: [] }
    ]);
    localStorage[srcKey('active_profile_id')] = 'morvarid';
    localStorage[srcKey('logs', 'morvarid:bench')] = JSON.stringify([{ timestamp: 1000, reps: 10 }]);
    localStorage[srcKey('logs', 'template_female:squat')] = JSON.stringify([{ timestamp: 2000, reps: 8 }]);
    localStorage[srcKey('logs', 'template_male:leg_curl')] = JSON.stringify([{ timestamp: 2500, reps: 5 }]);
    localStorage[srcKey('metrics', 'morvarid')] = JSON.stringify([{ id: 'm_1', timestamp: 3000, weight: 60 }]);
    localStorage[srcKey('metrics', 'hossein_chieftain')] = JSON.stringify([{ id: 'hm_1', timestamp: 8888 }]);
    localStorage[srcKey('sets', 'morvarid')] = JSON.stringify({ weekKey: 'IR_WEEK_1', updatedAt: 500, sets: { bench: [true] } });
    localStorage[srcKey('sets', 'template_male')] = JSON.stringify({ weekKey: 'IR_WEEK_M' });
    localStorage[srcKey('draft', 'morvarid:bench')] = JSON.stringify({ reps: 9 });
    localStorage[srcKey('custom_exercises')] = JSON.stringify([
      { id: 'cust_111', fa: 'حرکت من', en: 'Mine', ownerId: 'user_morvarid', isCustom: true }
    ]);
    localStorage[srcKey('master_overrides')] = JSON.stringify({ bench: { fa: 'x' } });

    // ---- a DIFFERENT offline identity's scope (must never be read) ----
    localStorage[hosseinKey('profiles')] = JSON.stringify([HOSSEIN_OFFLINE_PROFILE]);
    localStorage[hosseinKey('logs', 'hossein_chieftain:squat')] = JSON.stringify([{ timestamp: 9999 }]);
    localStorage[hosseinKey('metrics', 'hossein_chieftain')] = JSON.stringify([{ id: 'hm_9', timestamp: 8888 }]);
    localStorage[hosseinKey('sets', 'hossein_chieftain')] = JSON.stringify({ weekKey: 'IR_WEEK_X' });
    localStorage[hosseinKey('custom_exercises')] = JSON.stringify([
      { id: 'cust_his', fa: 'حرکت حسین', en: 'His', ownerId: 'admin_hossein', isCustom: true }
    ]);

    // ---- pre-v10 unscoped keys: hers and his ----
    localStorage['chieftain_profiles_v9'] = JSON.stringify([MOR_PROFILE, HOSSEIN_PROFILE]);
    localStorage['chieftain_active_profile_id'] = 'morvarid';
    localStorage['chieftain_logs_morvarid_bench'] = JSON.stringify([
      { timestamp: 1000, reps: 10 }, { timestamp: 1100, reps: 12 }
    ]);
    localStorage['chieftain_logs_hossein_chieftain_squat'] = JSON.stringify([{ timestamp: 7777 }]);
    localStorage['chieftain_metrics_morvarid'] = JSON.stringify([
      { id: 'm_1', timestamp: 3000, weight: 60 }, { id: 'm_2', timestamp: 3100, weight: 61 }
    ]);
    localStorage['chieftain_metrics_hossein_chieftain'] = JSON.stringify([{ id: 'hm_9', timestamp: 6666 }]);
    localStorage['chieftain_sets_morvarid'] = JSON.stringify({ weekKey: 'IR_WEEK_1', updatedAt: 900, sets: { bench: [true, true] } });
    localStorage['chieftain_sets_hossein_chieftain'] = JSON.stringify({ weekKey: 'IR_WEEK_X' });
    localStorage['chieftain_custom_exercises'] = JSON.stringify([
      { id: 'cust_111', fa: 'حرکت من', en: 'Mine', ownerId: 'user_morvarid', isCustom: true },
      { id: 'cust_his', fa: 'حرکت حسین', en: 'His', ownerId: 'admin_hossein', isCustom: true }
    ]);
    localStorage['chieftain_master_overrides'] = JSON.stringify({ bench: { fa: 'legacy' } });
  }

  // Every key that belongs to the SOURCE or to another identity. The destination
  // scope (uuid:...) is deliberately excluded - it is supposed to change.
  function sourceSnapshot() {
    const snap = {};
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf('chieftain_v10:local:user_morvarid:') === 0 ||
          k.indexOf('chieftain_v10:local:admin_hossein:') === 0 ||
          (k.indexOf('chieftain_') === 0 && k.indexOf('chieftain_v10:') !== 0)) {
        snap[k] = localStorage[k];
      }
    });
    return snap;
  }

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }
  function cloudText() { return JSON.stringify(server); }
  function rpcKinds() { return rpcCalls.map(function (x) { return x.kind; }); }

  async function signInAsNewMorvaridAccount() {
    currentAuthUser = { id: AUTH, email: 'movahedi.mov@gmail.com' };
    currentLocalUser = null;
    activeProfileId = 'template_male';
    allProfiles = [
      { id: 'template_male', name: 'TM', days: [] },
      { id: 'template_female', name: 'TF', days: [] }
    ];
    customExercises = [];
    scopedSetJSON('profiles', null, allProfiles);
  }

  (async function () {
    seedSource();
    const before = JSON.stringify(sourceSnapshot());

    // =====================================================================
    // preview: read-only, identity-filtered, names the destination account
    // =====================================================================
    await signInAsNewMorvaridAccount();
    const plan = planMorvaridMigration();
    check('preview names the detected old profile', plan.source.detectedProfileName === 'مروارید');
    check('preview names the destination account email',
      plan.destinationEmail === 'movahedi.mov@gmail.com');
    check('preview requires an authenticated scope', plan.authenticated === true);
    check('preview counts only HER routine', plan.counts.routine === 1);
    check('preview counts only HER logs (his excluded)',
      plan.counts.logs === 3);            // morvarid:bench x2 + template_female:squat x1
    check('preview counts only HER metrics (his excluded)', plan.counts.metrics === 2);
    check('preview counts only HER set states', plan.counts.sets === 1);
    check('preview counts only HER custom exercises', plan.counts.customExercises === 1);
    check('preview is read-only (source untouched)', JSON.stringify(sourceSnapshot()) === before);

    // =====================================================================
    // selection: only user_morvarid data is chosen
    // =====================================================================
    const src = collectMorvaridSourceData();
    check('selection: only her profile family is considered',
      src.profileCandidates.every(function (p) { return ['morvarid', 'user_morvarid', 'template_female'].indexOf(p.id) >= 0; }));
    check('selection: hossein_chieftain profile excluded',
      !src.profileCandidates.some(function (p) { return p.id === 'hossein_chieftain'; }));
    check('selection: admin_hossein profile excluded',
      !src.profileCandidates.some(function (p) { return p.id === 'admin_hossein'; }));
    check('selection: template_male excluded',
      !src.profileCandidates.some(function (p) { return p.id === 'template_male'; }));
    check('selection: the chosen routine is hers', src.sourceProfileId === 'morvarid');
    check('selection: the foreign custom exercise is excluded',
      !src.customExercises.some(function (e) { return e.id === 'cust_his'; }));
    check('selection: master overrides are not treated as her data',
      JSON.stringify(src).indexOf('master_overrides') < 0);

    // =====================================================================
    // run the migration
    // =====================================================================
    const res = await runMorvaridMigration({ confirmed: true });
    check('run reports completion', res.status === 'completed' && res.ok === true);
    check('run is verified on the cloud', res.verified === true);
    check('run reports no conflicts or failures', res.conflict === 0 && res.failed === 0);
    check('run reports the destination email', res.destinationEmail === 'movahedi.mov@gmail.com');

    // ---- all data families migrate ----
    check('all families: routine', res.counts.routine === 1);
    check('all families: logs', res.counts.logs === 3);
    check('all families: metrics', res.counts.metrics === 2);
    check('all families: set states', res.counts.sets === 1);
    check('all families: custom exercises', res.counts.customExercises === 1);
    check('all families: drafts (device only)', res.counts.drafts === 1);

    // ---- the cloud received everything, through the allowlisted RPCs ----
    check('cloud: exactly one routine row', server.user_routines.length === 1);
    check('cloud: routine keyed by the account profile key',
      server.user_routines[0].profile_key === 'morvarid');
    check('cloud: routine carries no legacy ownerId',
      !('ownerId' in (server.user_routines[0].profile_data || {})));
    check('cloud: routine carries no device PIN',
      !('pin' in (server.user_routines[0].profile_data || {})));
    check('cloud: logs keyed by the destination profile key',
      server.workout_logs.length === 3 &&
      server.workout_logs.every(function (r) { return r.profile_key === 'morvarid'; }));
    check('cloud: metrics keyed by the destination profile key',
      server.body_metrics.length === 2 &&
      server.body_metrics.every(function (r) { return r.profile_key === 'morvarid'; }));
    check('cloud: set state keyed by the destination profile key',
      server.workout_set_states.length === 1 &&
      server.workout_set_states[0].profile_key === 'morvarid');
    check('cloud: custom exercise keeps its ORIGINAL id',
      server.user_custom_exercises.length === 1 &&
      server.user_custom_exercises[0].exercise_data.id === 'cust_111');
    check('cloud: only allowlisted RPCs were used',
      rpcKinds().every(function (k) {
        return ['upsert_routine', 'upsert_workout_log', 'upsert_body_metric',
                'upsert_custom_exercise', 'upsert_set_state'].indexOf(k) >= 0;
      }));
    check('cloud: every RPC call was made at least once',
      ['upsert_routine', 'upsert_workout_log', 'upsert_body_metric',
       'upsert_custom_exercise', 'upsert_set_state'].every(function (k) {
        return rpcKinds().indexOf(k) >= 0;
      }));

    // ---- destination ownership is the authenticated UUID ----
    check('destination: rows belong to the authenticated UUID',
      server.user_routines[0].user_id === AUTH &&
      server.workout_logs.every(function (r) { return r.user_id === AUTH; }) &&
      server.user_custom_exercises.every(function (r) { return r.user_id === AUTH; }));
    check('destination: no RPC payload carries a user id',
      rpcCalls.every(function (c) {
        return !Object.keys(c.payload).some(function (k) { return /^p_(user|owner)_id$/.test(k); });
      }));
    check('destination: the legacy identity never becomes an owner value',
      cloudText().indexOf('user_morvarid') < 0);
    check('destination: the local custom exercise is owned by the UUID',
      customExercises.some(function (e) { return e.id === 'cust_111' && e.ownerId === AUTH; }));

    // ---- nothing from an unrelated local account leaked ----
    check('exclusion: no admin_hossein data in the cloud',
      cloudText().indexOf('admin_hossein') < 0);
    check('exclusion: no hossein_chieftain data in the cloud',
      cloudText().indexOf('hossein_chieftain') < 0);
    check('exclusion: no male-template routine in the cloud',
      cloudText().indexOf('template_male') < 0);
    check('exclusion: the destination has no hossein profile',
      !allProfiles.some(function (p) { return p.id === 'hossein_chieftain' || p.id === 'admin_hossein'; }));
    check('exclusion: the foreign custom exercise stayed out',
      !customExercises.some(function (e) { return e.id === 'cust_his'; }));
    check('exclusion: her unrelated-scope data was never read',
      JSON.stringify(collectMorvaridSourceData()).indexOf('hm_9') < 0);

    // ---- source untouched ----
    check('SOURCE UNTOUCHED: every legacy and foreign key is byte-identical',
      JSON.stringify(sourceSnapshot()) === before);

    // ---- marker ----
    const marker = scopedGetJSON('morvarid_migration', null, null) || {};
    check('marker records a completed run', marker.completed === true);
    check('marker records the source and destination profile key',
      marker.lastRun && marker.lastRun.sourceScope === 'local:user_morvarid' &&
      marker.lastRun.destinationProfileKey === 'morvarid');

    // =====================================================================
    // idempotency
    // =====================================================================
    const rpcCountAfterFirst = rpcCalls.length;
    const countsBefore = JSON.stringify({
      r: server.user_routines.length, l: server.workout_logs.length,
      m: server.body_metrics.length, s: server.workout_set_states.length,
      c: server.user_custom_exercises.length
    });
    const res2 = await runMorvaridMigration({ confirmed: true });
    const expectedRecords = plan.counts.routine + plan.counts.logs + plan.counts.metrics +
                            plan.counts.sets + plan.counts.drafts + plan.counts.customExercises;
    check('idempotent: a repeated run imports nothing new', res2.imported === 0);
    check('idempotent: a repeated run reports EVERY record as already present',
      (res2.skipped + res2.conflict) === expectedRecords && expectedRecords === 9);
    check('idempotent: a repeated run issues no upsert RPC',
      rpcCalls.length === rpcCountAfterFirst);
    check('idempotent: no duplicate cloud row was created',
      JSON.stringify({
        r: server.user_routines.length, l: server.workout_logs.length,
        m: server.body_metrics.length, s: server.workout_set_states.length,
        c: server.user_custom_exercises.length
      }) === countsBefore);
    check('idempotent: the local stores did not duplicate',
      allProfiles.filter(function (p) { return p.id === 'morvarid'; }).length === 1 &&
      customExercises.filter(function (e) { return e.id === 'cust_111'; }).length === 1);

    // =====================================================================
    // conflict behaviour: an existing destination record is never overwritten
    // =====================================================================
    const routineRevisionBefore = server.user_routines[0].revision;
    const routineDaysBefore = JSON.stringify(server.user_routines[0].routine_data);
    const res3 = await runMorvaridMigration({ confirmed: true });
    check('conflict: an existing destination record is never overwritten',
      server.user_routines[0].revision === routineRevisionBefore &&
      JSON.stringify(server.user_routines[0].routine_data) === routineDaysBefore);
    check('conflict: the existing record is reported, not silently merged',
      (res3.skipped + res3.conflict) > 0 && res3.imported === 0);

    // =====================================================================
    // guards
    // =====================================================================
    const res4 = await runMorvaridMigration({ confirmed: false });
    check('guard: an unconfirmed run is refused',
      res4.reason === 'not_confirmed' && res4.imported === 0 && res4.queued === 0);

    currentAuthUser = null;
    currentLocalUser = { id: 'user_morvarid' };
    const res5 = await runMorvaridMigration({ confirmed: true });
    check('guard: an unauthenticated run is refused',
      res5.reason === 'not_authenticated' && res5.imported === 0 && res5.queued === 0);
    check('guard: nothing was queued into an offline scope', readOutbox().length === 0);

    currentAuthUser = { id: OTHER_AUTH, email: 'someone@else.com' };
    currentLocalUser = null;
    const outboxBefore = readOutbox().length;
    const res6 = await runMorvaridMigration({ confirmed: true });
    check('guard: a run under a different account does not touch the first account',
      res6.destinationScope === 'uuid:' + OTHER_AUTH);
    check('guard: the first account\'s queued work is untouched', readOutbox().length >= outboxBefore);
    check('guard: the source is still untouched after every run',
      JSON.stringify(sourceSnapshot()) === before);

    if (failures) { console.log(failures + ' morvarid-migration check(s) failed'); process.exit(1); }
    console.log('PASS: the Morvarid migration selects only her data, excludes every other local identity, uploads through the allowlisted outbox/RPC path under the authenticated UUID, is idempotent, never overwrites, and leaves the source byte-identical.');
    process.exit(0);
  })().catch(function (e) { console.error(e); process.exit(1); });
})();
"""


def _fn(js: str, name: str) -> str:
    body = c.function_body(js, name)
    if not body:
        return ""
    if f"async function {name}(" in js:
        return "async " + body
    return body


def run() -> c.Contract:
    t = c.Contract("morvarid_migration")

    block = c.morvarid_migration_block()
    if not t.require(bool(block.strip()), "MORVARID_MIGRATION block found in app_engine.js"):
        return t

    js = c.read_text(c.APP_JS_PATH) or ""
    live = c.strip_js_comments(js)

    # --- the source scope is a CONSTANT, never a parameter -------------------
    t.require_present(block, "const MORVARID_SOURCE_SCOPE = 'local:user_morvarid'",
                      "the source scope is a single fixed constant")
    t.require(re.search(r"function\s+\w*[Ss]ource\w*\s*\(\s*scope", block) is None,
              "no reader accepts a caller-supplied scope")
    t.require(re.search(r"function\s+\w*[Ff]oreign\w*\s*\(", block) is None,
              "there is no generic foreign-scope accessor")

    # --- discovery is READ ONLY --------------------------------------------
    t.require_present(block, "localStorage.getItem", "discovery reads local storage")
    t.require_absent(block, "localStorage.setItem", "the migration never writes local storage directly")
    t.require_absent(block, "localStorage.removeItem", "the migration never removes a key")
    t.require_absent(block, "localStorage.clear", "the migration never clears storage")
    t.require_present(block, "function collectMorvaridSourceData", "read-only discovery exists")
    t.require_present(block, "function planMorvaridMigration", "read-only preview exists")

    # --- selection is a WHITELIST of her own ids ---------------------------
    t.require_present(block, "MORVARID_PROFILE_IDS", "her profile-id family is declared")
    t.require_present(block, "isMorvaridProfileId", "selection goes through the whitelist predicate")
    for other in ("admin_hossein", "hossein_chieftain", "template_male"):
        t.require_absent(block, f"'{other}'", f"'{other}' is never named as hers")
    t.require_present(block, "referencedIds", "a routine reference is accepted as evidence of ownership")
    t.require_present(block, "splitLegacyProfileKey",
                      "pre-v10 '_' separated keys resolve against the whitelist")
    t.require_present(block, "ownerIsHers", "a foreign ownerId always excludes the record")

    # --- ownership is the authenticated UUID, never the legacy identity -----
    t.require_present(block, "delete dest.ownerId", "no legacy ownerId is carried to the destination")
    t.require_present(block, "dest.ownerId = userId", "the destination owner is the authenticated UUID")
    t.require_present(block, "getAuthenticatedSupabaseUserId", "a real session is required")
    t.require_present(block, "MORVARID_DESTINATION_PROFILE_KEY", "the routine is mapped to an account profile key")
    t.require_present(block, "delete dest.pin", "the device PIN is never migrated")

    # --- explicit confirmation + refusal paths -----------------------------
    t.require_present(block, "opts.confirmed", "the migration requires an explicit confirmed flag")
    t.require_present(block, "'not_confirmed'", "an unconfirmed run is refused")
    t.require_present(block, "'not_authenticated'", "an unauthenticated run is refused")
    t.require_present(block, "function confirmMorvaridMigration", "a confirm handler exists")
    t.require_present(block, "confirm(", "a user confirmation dialog is shown")

    # --- existing infrastructure only --------------------------------------
    for helper in ("enqueueRoutineUpsert", "enqueueLogUpsert", "enqueueMetricUpsert",
                   "enqueueSetStateUpsert", "enqueueCustomExerciseUpsert"):
        t.require_present(block, helper, f"uploads go through {helper}")
    t.require_present(block, "knownRevisionFor", "conflicts are detected from the known cloud revision")
    t.require_absent(block, ".rpc(", "no RPC is called directly")
    t.require_absent(block, ".from(", "no table is queried directly")
    t.require_absent(block, "supabaseClient", "the migration never touches the client directly")

    # --- completion is only marked after verification ----------------------
    t.require_present(block, "MORVARID_MIGRATION_MARKER", "bookkeeping is recorded")
    t.require_present(block, "result.verified", "the run is verified")
    t.require_present(block, "result.pendingLeft", "pending operations are counted")
    t.require_present(block, "result.conflictsLeft", "unresolved conflicts are counted")
    t.require_present(block, "marker.completed = result.status === 'completed'",
                      "completion is recorded only for a verified run")
    for field in ("imported", "skipped", "conflict", "failed"):
        t.require_present(block, f"result.{field}", f"the result tracks '{field}'")

    # --- never automatic ----------------------------------------------------
    callers = re.findall(r"(?<!function )runMorvaridMigration\s*\(", js)
    t.require(len(callers) == 1, f"runMorvaridMigration has exactly one call site (found {len(callers)})")
    outside = c.js_outside("morvarid_migration")
    t.require_absent(outside, "runMorvaridMigration", "nothing outside the block triggers a migration")

    # --- UI is wired --------------------------------------------------------
    t.require_present(block, "function openMorvaridMigrationModal", "the migration modal opener exists")
    t.require_present(block, "morvaridMigrationPreview", "the preview element is populated")
    modals = c.read_text(c.ROOT / "tmpl_modals.html")
    if t.require(modals is not None, "tmpl_modals.html exists"):
        t.require_present(modals, "morvaridMigrationModal", "the migration modal exists in the UI")
        t.require_present(modals, "openMorvaridMigrationModal()", "the migration modal is reachable from the UI")
        t.require_present(modals, "انتقال اطلاعات قدیمی مروارید از این دستگاه",
                          "the requested Persian button label is present")

    # --- existing sync architecture untouched -------------------------------
    t.require(re.search(r"CLOUD_SYNC_GATE\.contractVerified\s*=(?!=)", live) is None,
              "the gate is never assigned at runtime (only read/compared)")
    t.require_present(live, "'upsert_custom_exercise', 'tombstone_custom_exercise'",
                      "the custom-exercise allowlist is unchanged")

    # --- behavioural --------------------------------------------------------
    if not t.require(NODE is not None, "node is available"):
        return t

    blocks = c.storage_outbox_pull_legacy_morvarid()
    if not t.require(bool(blocks.strip()), "all required blocks found"):
        return t

    real_fns = _fn(live, "getAuthenticatedSupabaseUserId")

    script = HARNESS.replace("/*__BLOCKS__*/", blocks).replace("/*__FNS__*/", real_fns)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "morvarid_migration_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))
    t.require(proc.returncode == 0, "all Morvarid-migration behavioural checks passed")

    return t


if __name__ == "__main__":
    c.main(run)
