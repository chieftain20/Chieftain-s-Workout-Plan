"""Startup hydration must not overwrite a pulled cloud revision.

PROVEN DEFECT (production, Browser A):

    startup -> loadAppData() -> saveProfiles() -> enqueueRoutineUpsert(EVERY profile)

loadAppData() is a HYDRATION step, but it wrote back through saveProfiles(), which
persists AND queues a cloud upsert for every profile. At startup that ran BEFORE the
cloud pull, so the pre-pull snapshot was re-armed as a pending local edit on every
load. A pending operation DEFERS the cloud merge for its row
(outboxHasUnresolvedFor), so:

    loadAppData()            -> queues a pending op for the stale snapshot
      -> pullFromCloudNow()  -> mergeCloudRoutine DEFERS the row
        -> flush             -> CAS with the stale revision -> NULL -> conflict
          -> the row stays deferred forever

The device therefore never adopted a newer cloud revision, and because the flush
skips pre-existing conflicts without counting them, the UI reported the misleading
"0 sent, 0 conflicts". Repeated startups reproduced the same cycle.

The fix makes hydration a pure read (persist + record the content baseline, never
queue, never push) and makes the account-scoped async passes generation-safe.

These tests are behavioural: they execute the real account-scope / outbox / pull
blocks plus the real loadAppData / adoptLoadedProfiles / saveProfiles /
applyAccountScopeChange / handleAuthSessionChanged bodies in Node against a fake
Supabase. They FAIL against the pre-fix implementation (see `_hydrate_fn`).
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

  // ---- app state ------------------------------------------------------------
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
  function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || ''); }
  function showToast() {}
  function updateAuthUI(u) { if (u) currentAuthUser = u; }
  async function fetchUserProfileAndRole(u) { currentUserProfile = { id: u.id }; return currentUserProfile; }
  function updateConflictBadge() {}
  function isAutoCloudSyncEnabled() { return true; }
  async function pushToCloudStorage() { scheduleOutboxFlush(); return true; }
  const TEMPLATE_MALE_PROFILE = { id: 'template_male', name: 'TM', days: [{ id: 'tm1' }] };
  const TEMPLATE_FEMALE_PROFILE = { id: 'template_female', name: 'TF', days: [{ id: 'tf1' }] };

  // A faithful stand-in for renderProfileSelect(): the program dropdown shows the
  // ACTIVE profile's name out of the live allProfiles array.
  let dropdown = null;
  function renderApp() {
    const sel = allProfiles.find(function (p) { return p.id === activeProfileId; });
    dropdown = { activeProfileId: activeProfileId, name: sel ? sel.name : null,
                 ids: allProfiles.map(function (p) { return p.id; }) };
  }

  // ---- fake Supabase --------------------------------------------------------
  const TABLES = ['user_routines', 'workout_logs', 'body_metrics', 'user_custom_exercises', 'workout_set_states'];
  const server = {};
  TABLES.forEach(function (t) { server[t] = []; });
  const rpcCalls = [];
  const readCalls = [];
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
  let AUTH_UID = AUTH_A;
  function makeClient() {
    return {
      auth: { getSession: async function () {
        return { data: { session: currentAuthUser ? { user: { id: currentAuthUser.id } } : null }, error: null };
      } },
      from: function (table) {
        readCalls.push(table);
        return { select: function () { return makeQuery(table, []); } };
      },
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
          return { data: row.revision, error: null };
        }
        if (isTomb) return { data: null, error: null };
        const fresh = { user_id: currentAuthUser.id, revision: 1, deleted_at: null };
        if (kind.indexOf('routine') >= 0) {
          fresh.profile_key = key;
          fresh.routine_data = payload.p_routine_data || null;
          fresh.profile_data = payload.p_profile_data || null;
        } else { fresh.client_record_id = key; }
        server[table].push(fresh);
        return { data: 1, error: null };
      }
    };
  }

  const P = 'prof_1791469956745';
  const STALE_DAYS = [{ id: 'd1' }];
  const CLOUD_DAYS = [{ id: 'd1' }, { id: 'd2' }];

/*__BLOCKS__*/

/*__FNS__*/

  scheduleOutboxFlush = function () {};

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }

  function resetWorld() {
    Object.keys(localStorage).forEach(function (k) { delete localStorage[k]; });
    TABLES.forEach(function (t) { server[t] = []; });
    rpcCalls.length = 0; readCalls.length = 0;
    currentAuthUser = null; currentLocalUser = null; currentUserProfile = null;
    allProfiles = []; customExercises = []; masterExerciseOverrides = {};
    activeProfileId = 'template_male'; dropdown = null;
    lastAppliedScope = null; cloudSyncLastUserId = null;
    outboxFlushInFlight = false; outboxLastFlushResult = null; outboxFlushCompletedSeq = 0;
    supabaseClient = makeClient();
  }

  // Browser A: an EXISTING workspace holding the stale revision 11 snapshot.
  function seedBrowserA(opts) {
    opts = opts || {};
    currentAuthUser = { id: AUTH_A };
    scopedSetJSON('profiles', null, [
      { id: 'template_male', name: 'TM', days: [{ id: 'tm1' }] },
      { id: 'template_female', name: 'TF', days: [{ id: 'tf1' }] },
      { id: P, name: 'تست', days: STALE_DAYS }
    ]);
    scopedSetRaw('active_profile_id', null, P);
    rememberRevision(P, 11);
    // Browser A has been running: the stale content was already recorded once.
    // (The pre-fix code broke even when this memory was present-but-mismatched, so
    // the failing case is seeded WITHOUT it to model a device whose baseline was
    // never established for this row.)
    if (opts.fingerprint === 'matching') {
      rememberRoutineFingerprint(P, routineFingerprint({ id: P, name: 'تست', days: STALE_DAYS }));
    }
    if (opts.unrelatedConflict) {
      writeOutbox([{
        id: outboxOpId('other_row'), kind: 'upsert_routine', rowKey: 'other_row',
        ownerScope: getAccountScope(),
        payload: { p_profile_key: 'other_row', p_expected_revision: 4 },
        expectedRevision: 4, attempts: 1, lastError: 'cas_conflict_or_tombstone',
        status: 'conflict', createdAt: 1, updatedAt: 1
      }]);
    }
    currentAuthUser = null;
  }

  function seedCloud() {
    server.user_routines.push({
      user_id: AUTH_A, profile_key: P, revision: 12, deleted_at: null,
      profile_data: { id: P, name: 'تست' },
      routine_data: { days: CLOUD_DAYS }
    });
  }

  function daysOf(id) {
    const p = allProfiles.find(function (x) { return x.id === id; });
    return p && Array.isArray(p.days) ? p.days.map(function (d) { return d.id; }) : null;
  }
  function storedDaysOf(id) {
    const arr = scopedGetJSON('profiles', null, []) || [];
    const p = arr.find(function (x) { return x.id === id; });
    return p && Array.isArray(p.days) ? p.days.map(function (d) { return d.id; }) : null;
  }

  // The REAL startup sequence, in the REAL order:
  //   DOMContentLoaded hydration -> auth session -> scope swap -> hydration -> sync
  async function startup(opts) {
    opts = opts || {};
    loadAppData();                                   // DOMContentLoaded (no identity yet)
    await handleAuthSessionChanged({ id: AUTH_A, email: 'a@b.c' });
    if (opts.extraHydration !== false) {
      // The "later startup/local hydration step" that used to overwrite the pull.
      loadAppData();
      renderApp();
    }
    await flushOutboxNow();
  }

  (async function () {
    // =====================================================================
    // 1-8. Browser A must ADOPT revision 12 and KEEP it
    // =====================================================================
    resetWorld(); seedBrowserA({ fingerprint: 'none' }); seedCloud();
    await startup();
    check('3. the auth/startup flow pulled the cloud revision', knownRevisionFor(P) === 12);
    check('5. revision 12 and its routine content survive startup',
      JSON.stringify(daysOf(P)) === JSON.stringify(['d1', 'd2']));
    check('5b. the merged content is PERSISTED, not just in memory',
      JSON.stringify(storedDaysOf(P)) === JSON.stringify(['d1', 'd2']));
    check('6. the program dropdown still shows "تست"',
      !!dropdown && dropdown.name === 'تست' && dropdown.activeProfileId === P);
    check('4/5c. startup hydration queued NO operation for the pulled row',
      !readOutbox().some(function (o) { return o.rowKey === P; }));
    check('the cloud row is untouched by a plain startup',
      server.user_routines[0].revision === 12 && server.user_routines[0].routine_data.days.length === 2);

    // 7. a later render must not restore the stale revision 11 snapshot
    renderApp();
    check('7. a later render does not restore the stale snapshot',
      JSON.stringify(daysOf(P)) === JSON.stringify(['d1', 'd2']) && dropdown.name === 'تست');

    // 8. repeated startup must not regress the state
    await startup();
    await startup();
    check('8. repeated startup does not regress the state',
      knownRevisionFor(P) === 12 && JSON.stringify(daysOf(P)) === JSON.stringify(['d1', 'd2']));
    check('8b. repeated startup still queues nothing for the row',
      !readOutbox().some(function (o) { return o.rowKey === P; }));

    // ---- the same must hold when the baseline memory IS present (control) ----
    resetWorld(); seedBrowserA({ fingerprint: 'matching' }); seedCloud();
    await startup();
    check('a device whose content baseline exists also adopts revision 12',
      knownRevisionFor(P) === 12 && JSON.stringify(daysOf(P)) === JSON.stringify(['d1', 'd2']));

    // =====================================================================
    // 9. Browser B: a fresh device with no local data reconstructs the cloud
    // =====================================================================
    resetWorld(); seedCloud();
    currentAuthUser = { id: AUTH_A };
    await pullFromCloudNow();
    check('9. a fresh device reconstructs "تست" from the cloud',
      !!allProfiles.find(function (p) { return p.id === P && p.name === 'تست'; }));
    check('9b. the fresh device learned the cloud revision', knownRevisionFor(P) === 12);
    check('9c. the fresh device stored the cloud routine',
      JSON.stringify(storedDaysOf(P)) === JSON.stringify(['d1', 'd2']));

    // =====================================================================
    // 10. account isolation
    // =====================================================================
    resetWorld(); seedCloud();
    currentAuthUser = { id: AUTH_A }; AUTH_UID = AUTH_A;
    await pullFromCloudNow();
    const keyA = 'chieftain_v10:uuid:' + AUTH_A + ':profiles';
    check('10. account A owns its own scoped store',
      (localStorage.getItem(keyA) || '').indexOf(P) >= 0);
    currentAuthUser = { id: AUTH_B }; AUTH_UID = AUTH_B;
    allProfiles = [];
    await pullFromCloudNow();
    check('10b. account B pulls nothing of account A', allProfiles.length === 0);
    check('10c. account B\'s scope was not populated from A',
      (localStorage.getItem('chieftain_v10:uuid:' + AUTH_B + ':profiles') || '[]') === '[]');
    check('10d. account A\'s scope is untouched by B',
      (localStorage.getItem(keyA) || '').indexOf(P) >= 0);

    // =====================================================================
    // 11. an unresolved conflict still defers ONLY its own row
    // =====================================================================
    resetWorld(); seedBrowserA({ fingerprint: 'matching', unrelatedConflict: true }); seedCloud();
    await startup({ extraHydration: false });
    check('11. the unrelated conflict is still queued and unresolved',
      readOutbox().some(function (o) { return o.rowKey === 'other_row' && o.status === 'conflict'; }));
    check('11b. the unrelated conflict did NOT block the "تست" merge',
      knownRevisionFor(P) === 12 && JSON.stringify(daysOf(P)) === JSON.stringify(['d1', 'd2']));
    check('11c. the sync REPORTS the outstanding conflict (no misleading 0/0)',
      (function () {
        const conflicts = listOutboxConflicts().length;
        return conflicts === 1;
      })());

    // a conflict ON the row still defers that row (never auto-resolved)
    resetWorld(); seedBrowserA({ fingerprint: 'matching' }); seedCloud();
    currentAuthUser = { id: AUTH_A };
    writeOutbox([{
      id: outboxOpId(P), kind: 'upsert_routine', rowKey: P, ownerScope: getAccountScope(),
      payload: { p_profile_key: P, p_routine_data: { days: STALE_DAYS }, p_profile_data: { id: P, name: 'تست' }, p_expected_revision: 11 },
      expectedRevision: 11, attempts: 1, lastError: 'cas_conflict_or_tombstone',
      status: 'conflict', createdAt: 1, updatedAt: 1
    }]);
    currentAuthUser = null;
    await startup({ extraHydration: false });
    check('11d. a real conflict on the row still defers it (never auto-resolved)',
      readOutbox().some(function (o) { return o.rowKey === P && o.status === 'conflict'; }) &&
      knownRevisionFor(P) === 11);
    check('11e. hydration did not add a SECOND op for the conflicted row',
      readOutbox().filter(function (o) { return o.rowKey === P; }).length === 1);

    // =====================================================================
    // 12. a genuine local edit still enqueues exactly once
    // =====================================================================
    resetWorld(); seedBrowserA({ fingerprint: 'matching' }); seedCloud();
    await startup();
    allProfiles.find(function (p) { return p.id === P; }).days = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];
    saveProfiles();
    check('12. a genuine edit queues exactly ONE operation for the row',
      readOutbox().filter(function (o) { return o.rowKey === P; }).length === 1);
    check('12b. the edit carries the freshly learned revision 12',
      readOutbox().find(function (o) { return o.rowKey === P; }).expectedRevision === 12);
    saveProfiles();
    check('12c. saving again without a change queues nothing new',
      readOutbox().filter(function (o) { return o.rowKey === P; }).length === 1);
    await flushOutboxNow();
    check('12d. the edit is transmitted and the cloud advances to 13',
      server.user_routines[0].revision === 13 && server.user_routines[0].routine_data.days.length === 3);

    // =====================================================================
    // 13. no duplicate conflicts from repeated startup + edit cycles
    // =====================================================================
    resetWorld(); seedBrowserA({ fingerprint: 'matching' }); seedCloud();
    await startup();
    // A stale edit (CAS against an out-of-date revision) becomes ONE conflict.
    rememberRevision(P, 11);
    allProfiles.find(function (p) { return p.id === P; }).days = [{ id: 'd1' }, { id: 'dX' }];
    saveProfiles();
    await flushOutboxNow();
    check('13. a stale edit produces exactly one conflict',
      readOutbox().filter(function (o) { return o.rowKey === P && o.status === 'conflict'; }).length === 1);
    for (let i = 0; i < 3; i++) { await startup(); }
    check('13b. repeated startup does NOT multiply the conflict',
      readOutbox().filter(function (o) { return o.rowKey === P; }).length === 1 &&
      readOutbox().filter(function (o) { return o.rowKey === P && o.status === 'conflict'; }).length === 1);

    // =====================================================================
    // 14. tombstone protection is intact
    // =====================================================================
    resetWorld(); seedCloud();
    currentAuthUser = { id: AUTH_A };
    allProfiles = [{ id: P, name: 'تست', days: STALE_DAYS }];
    scopedSetJSON('profiles', null, allProfiles);
    server.user_routines[0].deleted_at = '2026-01-01T00:00:00Z';
    server.user_routines[0].revision = 13;
    await pullFromCloudNow();
    check('14. a cloud tombstone removes the local profile',
      !allProfiles.some(function (p) { return p.id === P; }));
    // and a stale local edit cannot resurrect it
    resetWorld();
    currentAuthUser = { id: AUTH_A };
    server.user_routines.push({ user_id: AUTH_A, profile_key: 'p_dead', revision: 9, deleted_at: '2026-01-01',
                                profile_data: { id: 'p_dead', name: 'dead' }, routine_data: { days: [] } });
    rememberRevision('p_dead', 9);
    enqueueRoutineUpsert({ id: 'p_dead', name: 'resurrect?', days: [] });
    await flushOutboxNow();
    check('14b. a tombstoned row is not resurrected',
      readOutbox().some(function (o) { return o.rowKey === 'p_dead' && o.status === 'conflict'; }) &&
      server.user_routines.find(function (r) { return r.profile_key === 'p_dead'; }).deleted_at !== null);

    if (failures) { console.log(failures + ' startup-hydration check(s) failed'); process.exit(1); }
    console.log('PASS: startup hydration never overwrites a pulled revision, the dropdown keeps the cloud state, conflicts defer only their own rows, edits still queue once and tombstones still hold.');
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


def _hydrate_fn(js: str) -> str:
    """The real hydration helper, or a faithful pre-fix stand-in.

    Before the fix, loadAppData() called saveProfiles() directly. When
    adoptLoadedProfiles() is absent, this reproduces exactly that behaviour so the
    behavioural checks fail against the old implementation instead of erroring out.
    """
    real = c.function_body(js, "adoptLoadedProfiles")
    if real:
        return real
    return "function adoptLoadedProfiles() { saveProfiles(); }"


def run() -> c.Contract:
    t = c.Contract("startup_hydration")

    blocks = c.storage_outbox_pull_conflict()
    if not t.require(bool(blocks.strip()), "storage + outbox + pull + conflict UI blocks found"):
        return t

    js = c.read_text(c.APP_JS_PATH) or ""
    live = c.strip_js_comments(js)

    # --- static: hydration must not queue or push -------------------------
    load_fn = c.function_body(live, "loadAppData")
    if t.require(bool(load_fn), "loadAppData is defined"):
        t.require_present(load_fn, "adoptLoadedProfiles",
                          "hydration persists through adoptLoadedProfiles()")
        t.require_absent(load_fn, "saveProfiles(",
                         "hydration never calls saveProfiles() (which queues cloud work)")
        t.require_absent(load_fn, "enqueueRoutineUpsert",
                         "hydration never queues a cloud operation")

    adopt_fn = c.function_body(live, "adoptLoadedProfiles")
    if t.require(bool(adopt_fn), "adoptLoadedProfiles is defined"):
        t.require_absent(adopt_fn, "enqueueRoutineUpsert",
                         "adoptLoadedProfiles queues nothing")
        t.require_absent(adopt_fn, "pushToCloudStorage",
                         "adoptLoadedProfiles pushes nothing")
        t.require_present(adopt_fn, "scopedSetJSON('profiles'",
                          "adoptLoadedProfiles persists the scoped store")
        t.require_present(adopt_fn, "rememberRoutineFingerprint",
                          "adoptLoadedProfiles records the loaded content as the baseline")

    # --- static: the async passes are generation/account safe -------------
    pull_fn = c.function_body(live, "pullFromCloudNow")
    if t.require(bool(pull_fn), "pullFromCloudNow is defined"):
        t.require_present(pull_fn, "scopeAtStart",
                          "the pull captures the workspace it is reading for")
        t.require_present(pull_fn, "getAccountScope() !== scopeAtStart",
                          "the pull refuses to publish into a different workspace")
        t.require_present(pull_fn, "scope_changed", "a scope change aborts the pull")

    flush_fn = c.function_body(live, "flushOutboxNow")
    if t.require(bool(flush_fn), "flushOutboxNow is defined"):
        t.require_present(flush_fn, "scopeAtStart",
                          "the flush captures the workspace it is draining")
        t.require_present(flush_fn, "getAccountScope() !== scopeAtStart",
                          "the flush aborts when the workspace changes")

    persist_fn = c.function_body(live, "persistFlushedOps")
    if t.require(bool(persist_fn), "persistFlushedOps is defined"):
        t.require_present(persist_fn, "scope",
                          "persistFlushedOps refuses to write into another workspace")

    # --- static: the sync reports outstanding conflicts truthfully --------
    sync_fn = c.function_body(live, "syncFromCloudNow")
    if t.require(bool(sync_fn), "syncFromCloudNow is defined"):
        t.require_present(sync_fn, "conflictsOutstanding",
                          "the sync reports conflicts that were already unresolved")

    # --- invariants --------------------------------------------------------
    t.require_absent(live, ".from('user_routines').insert", "no direct table write for routines")
    t.require(re.search(r"CLOUD_SYNC_GATE\.contractVerified\s*=(?!=)", live) is None,
              "the gate is never assigned at runtime (only read/compared)")

    # --- behavioural -------------------------------------------------------
    if not t.require(NODE is not None, "node is available"):
        return t

    real_fns = "\n".join([
        _fn(live, "getAuthenticatedSupabaseUserId"),
        load_fn,
        _hydrate_fn(live),
        _fn(live, "saveProfiles"),
        _fn(live, "applyAccountScopeChange"),
        _fn(live, "handleAuthSessionChanged"),
    ])

    script = HARNESS.replace("/*__BLOCKS__*/", blocks).replace("/*__FNS__*/", real_fns)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "startup_hydration_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))
    t.require(proc.returncode == 0, "all startup-hydration behavioural checks passed")

    return t


if __name__ == "__main__":
    c.main(run)
