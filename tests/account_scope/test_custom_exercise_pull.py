"""Custom-exercise definitions must survive the trip PC -> cloud -> phone.

PROVEN DEFECT (production):

    A custom exercise used inside a synced routine rendered as its raw id
    ("cust_1790707020339") on the second device, while the PC showed the name.

The definition WAS being pulled and stored. The bug was in the catalogue:

  * enqueueCustomExerciseUpsert() strips ownerId (ownership is server-side), and
    upsert_custom_exercise() strips it again, so a pulled definition has no ownerId.
  * getAllExercises() only exposed a custom exercise when isApproved was true, the
    viewer was an unlocked admin, or e.ownerId === currentUserId. A normal user
    therefore never saw the pulled definition, so findExerciseById() fell through to
    its { fa: id } fallback and rendered "cust_...".

Two fixes are covered here:

  FIX A - the merge stamps ownership from the LOCAL authenticated identity (never
          from the cloud payload) and merges the matching local entry in place, so a
          pulled definition is visible and never duplicated. getAllExercises() also
          treats an ownerless entry as this account's, because the whole array is
          account-scoped.
  FIX B - a custom exercise that this account owns locally but that has no cloud row
          was never uploaded (the account-scoped table started empty and
          pre-migration exercises were not backfilled). The pull now queues exactly
          those for upload, matched by logical exercise id so an existing row or a
          tombstone is skipped rather than overwritten.

These tests are behavioural: they execute the real account-scope / outbox / pull
blocks plus the real getAllExercises() / findExerciseById() / loadAppData() /
saveProfiles() bodies in Node against a fake Supabase.
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

  let currentLang = 'en';
  let currentAuthUser = null;
  let currentLocalUser = null;
  let currentUserProfile = null;
  let serverAdminVerified = false;
  let activeProfileId = 'template_male';
  let allProfiles = [];
  let customExercises = [];
  let masterExerciseOverrides = {};
  let supabaseClient = null;
  let adminUnlocked = false;
  function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || ''); }
  function showToast() {}
  function updateAuthUI(u) { if (u) currentAuthUser = u; }
  async function fetchUserProfileAndRole() { return null; }
  function renderApp() {}
  function updateConflictBadge() {}
  function isAutoCloudSyncEnabled() { return true; }
  async function pushToCloudStorage() { scheduleOutboxFlush(); return true; }
  // The phone belongs to a NORMAL user: not an admin, not locally unlocked.
  function isAdminUnlocked() { return adminUnlocked; }
  const TEMPLATE_MALE_PROFILE = { id: 'template_male', name: 'TM', days: [{ id: 'tm1' }] };
  const TEMPLATE_FEMALE_PROFILE = { id: 'template_female', name: 'TF', days: [{ id: 'tf1' }] };
  const MASTER_EXERCISES = [
    { id: 'leg_curl', fa: 'پشت پا', en: 'Leg Curl', muscles: 'همسترینگ' },
    { id: 'bench', fa: 'پرس سینه', en: 'Bench Press', muscles: 'سینه' }
  ];

  // ---- fake Supabase --------------------------------------------------------
  const TABLES = ['user_routines', 'workout_logs', 'body_metrics', 'user_custom_exercises', 'workout_set_states'];
  const server = {};
  TABLES.forEach(function (t) { server[t] = []; });
  const rpcCalls = [];
  const KIND_TABLE = {
    upsert_routine: 'user_routines', tombstone_routine: 'user_routines',
    upsert_workout_log: 'workout_logs', update_workout_log: 'workout_logs', tombstone_workout_log: 'workout_logs',
    upsert_body_metric: 'body_metrics', update_body_metric: 'body_metrics', tombstone_body_metric: 'body_metrics',
    upsert_custom_exercise: 'user_custom_exercises', tombstone_custom_exercise: 'user_custom_exercises',
    upsert_set_state: 'workout_set_states', tombstone_set_state: 'workout_set_states'
  };
  function rowKeyOf(kind, p) {
    if (kind.indexOf('routine') >= 0) return p.p_profile_key;
    if (kind.indexOf('set_state') >= 0) return p.p_profile_key;
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
  const AUTH_A = '00000000-0000-4000-c000-0000000000aa';
  const AUTH_B = '00000000-0000-4000-c000-0000000000bb';
  function makeClient() {
    return {
      auth: { getSession: async function () {
        return { data: { session: currentAuthUser ? { user: { id: currentAuthUser.id } } : null }, error: null };
      } },
      from: function (table) { return { select: function () { return makeQuery(table, []); } }; },
      // Mirrors the real RPC contract: strips ownerId, is keyed on
      // (user_id, client_record_id), refuses to touch a tombstone, and returns
      // NULL for a CAS mismatch - never a duplicate insert.
      rpc: async function (kind, payload) {
        rpcCalls.push({ kind: kind, payload: JSON.parse(JSON.stringify(payload || {})) });
        const table = KIND_TABLE[kind];
        const key = rowKeyOf(kind, payload);
        const row = server[table].find(function (r) { return (r.profile_key === key) || (r.client_record_id === key); });
        const isTomb = kind.indexOf('tombstone_') === 0;
        if (row) {
          if (row.deleted_at) return { data: null, error: null };
          if (payload.p_expected_revision === null || payload.p_expected_revision === undefined ||
              payload.p_expected_revision !== row.revision) return { data: null, error: null };
          row.revision += 1;
          if (payload.p_routine_data) row.routine_data = payload.p_routine_data;
          if (payload.p_profile_data) row.profile_data = payload.p_profile_data;
          if (payload.p_exercise_data) {
            const d = Object.assign({}, payload.p_exercise_data);
            delete d.ownerId;                       // server-side strip
            row.exercise_data = d;
          }
          return { data: row.revision, error: null };
        }
        if (isTomb) return { data: null, error: null };
        const fresh = { user_id: currentAuthUser.id, revision: 1, deleted_at: null };
        if (kind.indexOf('routine') >= 0) {
          fresh.profile_key = key;
          fresh.routine_data = payload.p_routine_data || null;
          fresh.profile_data = payload.p_profile_data || null;
        } else if (kind.indexOf('custom_exercise') >= 0) {
          const d = Object.assign({}, payload.p_exercise_data || {});
          delete d.ownerId;                          // server-side strip
          fresh.client_record_id = key;
          fresh.exercise_data = d;
        } else { fresh.client_record_id = key; }
        server[table].push(fresh);
        return { data: 1, error: null };
      }
    };
  }

  const CUST_ID = 'cust_1790707020339';
  const CUST_FA = 'پرس سینه دستگاه';
  const CUST_EN = 'Machine Chest Press';

/*__BLOCKS__*/

/*__FNS__*/

  scheduleOutboxFlush = function () {};

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }
  function rpcKinds() { return rpcCalls.map(function (c) { return c.kind; }); }

  function resetWorld() {
    Object.keys(localStorage).forEach(function (k) { delete localStorage[k]; });
    TABLES.forEach(function (t) { server[t] = []; });
    rpcCalls.length = 0;
    currentAuthUser = null; currentLocalUser = null; currentUserProfile = null;
    allProfiles = []; customExercises = []; masterExerciseOverrides = {};
    activeProfileId = 'template_male'; adminUnlocked = false;
    lastAppliedScope = null; cloudSyncLastUserId = null;
    outboxFlushInFlight = false; outboxLastFlushResult = null; outboxFlushCompletedSeq = 0;
    supabaseClient = makeClient();
  }

  // The object the real UI builds when a custom exercise is created.
  function localExercise(id, fa, en) {
    return {
      id: id, fa: fa, en: en, category: 'gym', muscles: 'سینه',
      defaultReps: '3 × 10–15', defaultSets: 3, videos: [],
      isCustom: true, isApproved: false, requestPublic: false,
      ownerId: currentAuthUser.id, createdAt: '2026-09-28T00:00:00.000Z'
    };
  }

  (async function () {
    // =====================================================================
    // 1-3, 9, 10. PC creates it, uploads it; the PHONE resolves the name
    // =====================================================================
    resetWorld();
    currentAuthUser = { id: AUTH_A };
    customExercises = [localExercise(CUST_ID, CUST_FA, CUST_EN)];
    scopedSetJSON('custom_exercises', null, customExercises);
    check('PC resolves the custom exercise to its name',
      findExerciseById(CUST_ID).fa === CUST_FA);
    check('PC resolves its English name', findExerciseById(CUST_ID).en === CUST_EN);

    // the real upload path the UI calls on creation
    enqueueCustomExerciseUpsert(customExercises[0]);
    await flushOutboxNow();
    const cloudRow = server.user_custom_exercises[0];
    check('1. the definition reached public.user_custom_exercises', !!cloudRow);
    check('3. the cloud row preserves the original custom id exactly',
      cloudRow.exercise_data.id === CUST_ID);
    check('4a. the uploaded payload carries no ownerId (ownership is server-side)',
      !('ownerId' in cloudRow.exercise_data));

    // ---- PHONE: a different device, same account, empty local store ----
    Object.keys(localStorage).forEach(function (k) { delete localStorage[k]; });
    customExercises = []; allProfiles = [];
    lastAppliedScope = null; cloudSyncLastUserId = null;
    supabaseClient = makeClient();
    const phonePull = await pullFromCloudNow();
    check('1b. the phone pull is not skipped', phonePull.skipped === false && !phonePull.error);
    check('2. exercise_data is restored into the account-scoped store',
      (scopedGetJSON('custom_exercises', null, []) || []).some(function (e) { return e.id === CUST_ID; }));
    check('2b. the in-memory customExercises collection has it',
      customExercises.some(function (e) { return e.id === CUST_ID; }));
    check('3b. the phone keeps the original custom id verbatim',
      customExercises.find(function (e) { return e.id === CUST_ID; }).id === CUST_ID);
    check('9. getAllExercises() exposes the pulled definition',
      getAllExercises().some(function (e) { return e.id === CUST_ID; }));
    check('9b. ACCEPTANCE: the phone resolves the Persian name, not the raw id',
      findExerciseById(CUST_ID).fa === CUST_FA);
    check('9c. ACCEPTANCE: the phone resolves the English name',
      findExerciseById(CUST_ID).en === CUST_EN);
    check('4b. ownership is derived locally, never taken from the cloud row',
      customExercises.find(function (e) { return e.id === CUST_ID; }).ownerId === AUTH_A);
    check('the phone still resolves a MASTER exercise', findExerciseById('bench').fa === 'پرس سینه');

    // =====================================================================
    // 4. a cloud payload that DOES carry an ownerId must not be trusted
    // =====================================================================
    resetWorld();
    currentAuthUser = { id: AUTH_A };
    customExercises = [];
    server.user_custom_exercises.push({
      user_id: AUTH_A, revision: 4, deleted_at: null,
      client_record_id: deterministicUuid('custom_exercise', 'cust_spoof'),
      exercise_data: { id: 'cust_spoof', fa: 'جعلی', en: 'Spoof', isCustom: true,
                       isApproved: false, ownerId: 'someone-elses-id' }
    });
    await pullFromCloudNow();
    const spoof = customExercises.find(function (e) { return e.id === 'cust_spoof'; });
    check('4c. a cloud-supplied ownerId is discarded', !!spoof && spoof.ownerId === AUTH_A);
    check('4d. the spoofed definition is still visible to this account',
      getAllExercises().some(function (e) { return e.id === 'cust_spoof'; }));
    check('4e. ownerId is not an authorization mechanism: no cloud value survives',
      customExercises.every(function (e) { return e.ownerId !== 'someone-elses-id'; }));

    // =====================================================================
    // 5. a tombstoned custom exercise is not restored
    // =====================================================================
    resetWorld();
    currentAuthUser = { id: AUTH_A };
    customExercises = [localExercise('cust_dead', 'مرده', 'Dead')];
    scopedSetJSON('custom_exercises', null, customExercises);
    server.user_custom_exercises.push({
      user_id: AUTH_A, revision: 7, deleted_at: '2026-01-01T00:00:00Z',
      client_record_id: deterministicUuid('custom_exercise', 'cust_dead'),
      exercise_data: { id: 'cust_dead', fa: 'مرده', en: 'Dead', isCustom: true }
    });
    await pullFromCloudNow();
    check('5. a tombstoned custom exercise is removed locally',
      !customExercises.some(function (e) { return e.id === 'cust_dead'; }));
    await flushOutboxNow();
    check('5b. a tombstoned custom exercise is NOT resurrected by the backfill',
      !rpcCalls.some(function (c) { return c.kind === 'upsert_custom_exercise'; }));
    check('5c. the tombstone is still set on the server',
      server.user_custom_exercises[0].deleted_at !== null);

    // =====================================================================
    // 6, 7, 8. merge with cloud: unrelated kept, matching merged, no duplicates
    // =====================================================================
    resetWorld();
    currentAuthUser = { id: AUTH_A };
    customExercises = [
      localExercise('cust_shared', 'نام قدیمی', 'Old Name'),
      localExercise('cust_local_only', 'فقط محلی', 'Local Only')
    ];
    scopedSetJSON('custom_exercises', null, customExercises);
    server.user_custom_exercises.push({
      user_id: AUTH_A, revision: 3, deleted_at: null,
      client_record_id: deterministicUuid('custom_exercise', 'cust_shared'),
      exercise_data: { id: 'cust_shared', fa: 'نام جدید', en: 'New Name', isCustom: true,
                       isApproved: false, category: 'home' }
    });
    await pullFromCloudNow();
    const shared = customExercises.filter(function (e) { return e.id === 'cust_shared'; });
    check('7. the matching local entry is merged with the cloud content',
      shared.length === 1 && shared[0].fa === 'نام جدید' && shared[0].en === 'New Name');
    check('7b. a field only the local copy had is preserved by the merge',
      shared[0].defaultReps === '3 × 10–15');
    check('6. an unrelated local custom exercise is untouched',
      customExercises.some(function (e) { return e.id === 'cust_local_only' && e.fa === 'فقط محلی'; }));
    check('8. no duplicate custom exercise is created', shared.length === 1);
    check('8b. the merged entry keeps the original id', shared[0].id === 'cust_shared');
    check('7c. the merged entry is visible to a normal user',
      getAllExercises().some(function (e) { return e.id === 'cust_shared'; }));

    // =====================================================================
    // FIX B: a local-only custom exercise is uploaded (bounded, idempotent)
    // =====================================================================
    resetWorld();
    currentAuthUser = { id: AUTH_A };
    customExercises = [localExercise('cust_never_uploaded', 'آپلود نشده', 'Never Uploaded')];
    scopedSetJSON('custom_exercises', null, customExercises);
    const backfillPull = await pullFromCloudNow();
    check('B1. the pull queues the local-only exercise for upload',
      readOutbox().some(function (o) {
        return o.kind === 'upsert_custom_exercise' &&
               o.rowKey === deterministicUuid('custom_exercise', 'cust_never_uploaded');
      }));
    check('B2. the pull reports the backfill',
      (backfillPull.stats && backfillPull.stats.backfilled) === 1);
    await flushOutboxNow();
    check('B3. the definition reaches the cloud',
      server.user_custom_exercises.some(function (r) {
        return r.exercise_data && r.exercise_data.id === 'cust_never_uploaded';
      }));
    // idempotent: a second pull must queue nothing more
    rpcCalls.length = 0;
    await pullFromCloudNow();
    await flushOutboxNow();
    check('B4. the backfill is idempotent (no second upload)',
      !rpcCalls.some(function (c) { return c.kind === 'upsert_custom_exercise'; }));
    check('B5. no duplicate cloud row was created',
      server.user_custom_exercises.filter(function (r) {
        return r.exercise_data && r.exercise_data.id === 'cust_never_uploaded';
      }).length === 1);

    // and the OTHER device can now resolve it
    const phoneStore = scopedGetJSON('custom_exercises', null, []);
    Object.keys(localStorage).forEach(function (k) { delete localStorage[k]; });
    customExercises = [];
    lastAppliedScope = null; cloudSyncLastUserId = null;
    supabaseClient = makeClient();
    await pullFromCloudNow();
    check('B6. the second device resolves the backfilled definition',
      findExerciseById('cust_never_uploaded').fa === 'آپلود نشده');
    check('B7. the first device still owns its own store', phoneStore.length === 1);

    // =====================================================================
    // 10/11. account isolation and routine sync untouched
    // =====================================================================
    resetWorld();
    currentAuthUser = { id: AUTH_A };
    server.user_custom_exercises.push({
      user_id: AUTH_A, revision: 1, deleted_at: null,
      client_record_id: deterministicUuid('custom_exercise', 'cust_A'),
      exercise_data: { id: 'cust_A', fa: 'الف', en: 'A', isCustom: true }
    });
    await pullFromCloudNow();
    check('10. account A pulls its own custom exercise',
      customExercises.some(function (e) { return e.id === 'cust_A'; }));
    currentAuthUser = { id: AUTH_B };
    customExercises = [];
    lastAppliedScope = null;
    await pullFromCloudNow();
    check('10b. account B pulls nothing of account A', customExercises.length === 0);
    check('10c. account A\'s scoped store is untouched',
      (localStorage.getItem('chieftain_v10:uuid:' + AUTH_A + ':custom_exercises') || '').indexOf('cust_A') >= 0);

    // routine sync path must be byte-for-byte unchanged in behaviour
    resetWorld();
    currentAuthUser = { id: AUTH_A };
    allProfiles = [{ id: 'p1', name: 'P', days: [{ id: 'd1' }] }];
    scopedSetJSON('profiles', null, allProfiles);
    rememberRevision('p1', 2);
    server.user_routines.push({ user_id: AUTH_A, profile_key: 'p1', revision: 2, deleted_at: null,
                                profile_data: { id: 'p1', name: 'P' }, routine_data: { days: [{ id: 'd1' }] } });
    await pullFromCloudNow();
    check('11. routine pull still learns the cloud revision', knownRevisionFor('p1') === 2);
    allProfiles[0].days = [{ id: 'd1' }, { id: 'd2' }];
    saveProfiles();
    await flushOutboxNow();
    check('11b. routine edits still upload and advance the revision',
      server.user_routines[0].revision === 3 &&
      server.user_routines[0].routine_data.days.length === 2);

    if (failures) { console.log(failures + ' custom-exercise check(s) failed'); process.exit(1); }
    console.log('PASS: custom exercise definitions round-trip PC -> cloud -> phone, resolve to their real names, never duplicate, never overwrite unrelated entries, never resurrect tombstones, and local-only definitions are backfilled once.');
    process.exit(0);
  })().catch(function (e) { console.error(e); process.exit(1); });
})();
"""


def _fn(js: str, name: str) -> str:
    """_common.function_body() drops an `async` prefix; keep it for real execution."""
    body = c.function_body(js, name)
    if not body:
        return ""
    if f"async function {name}(" in js:
        return "async " + body
    return body


def run() -> c.Contract:
    t = c.Contract("custom_exercise_pull")

    blocks = c.storage_outbox_pull_conflict()
    if not t.require(bool(blocks.strip()), "storage + outbox + pull + conflict UI blocks found"):
        return t

    js = c.read_text(c.APP_JS_PATH) or ""
    live = c.strip_js_comments(js)

    # --- the merge must derive ownership locally and never duplicate ---------
    merge_fn = c.function_body(live, "mergeCloudCustomExercise")
    if t.require(bool(merge_fn), "mergeCloudCustomExercise is defined"):
        t.require_present(merge_fn, "currentAccountExerciseOwner",
                          "the merge stamps ownership from the local identity")
        t.require_present(merge_fn, "delete merged.ownerId",
                          "a cloud-supplied ownerId is discarded")
        t.require_present(merge_fn, "merged.id = data.id",
                          "the original custom id is preserved verbatim")
        t.require_present(merge_fn, "customExercises[at] = Object.assign",
                          "a matching local entry is merged in place (no duplicate)")
        t.require_present(merge_fn, "row.deleted_at",
                          "a tombstoned definition is never restored")

    owner_fn = c.function_body(live, "currentAccountExerciseOwner")
    if t.require(bool(owner_fn), "currentAccountExerciseOwner is defined"):
        t.require_absent(owner_fn, "exercise_data",
                         "ownership never reads the cloud payload")

    # --- the catalogue must expose an account-scoped ownerless entry --------
    all_fn = c.function_body(live, "getAllExercises")
    if t.require(bool(all_fn), "getAllExercises is defined"):
        t.require_present(all_fn, "currentAccountExerciseOwner",
                          "the catalogue uses the local owner identity")
        t.require_present(all_fn, "if (!e.ownerId) return true",
                          "an ownerless (pulled) entry stays visible to its account")
        t.require_absent(all_fn, "(!e.ownerId && isAdminUnlocked())",
                         "the unreachable ownerless clause is gone")

    # --- the bounded backfill is wired into the pull ------------------------
    pull_fn = c.function_body(live, "pullFromCloudNow")
    if t.require(bool(pull_fn), "pullFromCloudNow is defined"):
        t.require_present(pull_fn, "backfillMissingCustomExercises",
                          "the pull backfills local-only definitions")

    back_fn = c.function_body(live, "backfillMissingCustomExercises")
    if t.require(bool(back_fn), "backfillMissingCustomExercises is defined"):
        t.require_present(back_fn, "knownIds",
                          "a definition already in the cloud (or tombstoned) is skipped")
        t.require_present(back_fn, "enqueueCustomExerciseUpsert",
                          "the backfill goes through the allowlisted RPC path")
        t.require_present(back_fn, "outboxHasUnresolvedFor",
                          "an already-queued edit is not queued twice")
        t.require_absent(back_fn, "server", "the backfill never touches the network itself")

    # --- invariants --------------------------------------------------------
    t.require_absent(live, ".from('user_custom_exercises')",
                     "no direct table access to user_custom_exercises")
    t.require_absent(live, "upsert_custom_exercise('", "no invented RPC call syntax")
    t.require_present(live, "'upsert_custom_exercise', 'tombstone_custom_exercise'",
                      "only the two allowlisted custom-exercise RPCs are used")
    t.require_present(live, "mergeCloudRoutine", "the routine merge is untouched")

    # --- behavioural -------------------------------------------------------
    if not t.require(NODE is not None, "node is available"):
        return t

    # Before the fix there is no backfill helper. Define an inert stand-in so the
    # behavioural checks fail on the real assertions instead of erroring out.
    backfill_js = _fn(live, "backfillMissingCustomExercises") or \
        "function backfillMissingCustomExercises() {}"

    real_fns = "\n".join([
        _fn(live, "getAuthenticatedSupabaseUserId"),
        _fn(live, "loadAppData"),
        _fn(live, "adoptLoadedProfiles"),
        _fn(live, "saveProfiles"),
        _fn(live, "getAllExercises"),
        _fn(live, "findExerciseById"),
        backfill_js,
    ])

    script = HARNESS.replace("/*__BLOCKS__*/", blocks).replace("/*__FNS__*/", real_fns)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "custom_exercise_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))
    t.require(proc.returncode == 0, "all custom-exercise behavioural checks passed")

    return t


if __name__ == "__main__":
    c.main(run)
