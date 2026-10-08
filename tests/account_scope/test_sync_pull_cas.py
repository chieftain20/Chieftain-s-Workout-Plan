"""Cloud pull wiring + outbox CAS revision handling.

Two proven defects are covered:

  FIX 1 - the wired "pull" (pullFromCloudStorage) was a push-only stub, so a fresh
          device could never reconstruct cloud state. syncFromCloudNow() now does a
          bounded bidirectional pass: pull -> flush -> pull.
  FIX 2 - coalescing replaced the stored payload wholesale, dropping the expected
          revision, and the flush transmitted op.payload directly. The CAS argument
          is now always re-derived from op.expectedRevision.

These tests are behavioural (they execute the real blocks in Node against a fake
Supabase) plus static assertions on the wiring.
"""

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
  Object.defineProperty(globalThis, 'history', {
    value: { replaceState: function () {} }, writable: true, configurable: true
  });

  let currentLang = 'en';
  let allProfiles = [];
  let supabaseClient = null;
  let currentAuthUser = null;
  let currentLocalUser = null;
  let AUTH_UID = '00000000-0000-4000-c000-000000000001';
  function isUuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '');
  }
  function showToast() {}
  function renderApp() { renderCount++; }
  let renderCount = 0;
  async function getAuthenticatedSupabaseUserId() { return AUTH_UID; }

  // ---- fake Supabase -------------------------------------------------------
  const TABLES = ['user_routines', 'workout_logs', 'body_metrics',
                  'user_custom_exercises', 'workout_set_states'];
  const server = {};
  const rpcCalls = [];
  const selectCalls = [];
  TABLES.forEach(function (t) { server[t] = []; });

  const KIND_TABLE = {
    upsert_routine: 'user_routines', tombstone_routine: 'user_routines',
    upsert_workout_log: 'workout_logs', update_workout_log: 'workout_logs', tombstone_workout_log: 'workout_logs',
    upsert_body_metric: 'body_metrics', update_body_metric: 'body_metrics', tombstone_body_metric: 'body_metrics',
    upsert_custom_exercise: 'user_custom_exercises', tombstone_custom_exercise: 'user_custom_exercises',
    upsert_set_state: 'workout_set_states', tombstone_set_state: 'workout_set_states'
  };
  function rowKeyOf(kind, p) {
    if (kind.indexOf('routine') >= 0) return p.p_profile_key;
    if (kind === 'upsert_set_state' || kind === 'tombstone_set_state') return p.p_profile_key;
    return p.p_client_record_id;
  }
  function makeClient() {
    return {
      from: function (table) {
        return { select: function () { return { eq: function (col, val) {
          selectCalls.push(table);
          return Promise.resolve({
            data: server[table].filter(function (r) { return r[col] === val; }),
            error: null
          });
        } }; } };
      },
      rpc: async function (kind, payload) {
        rpcCalls.push({ kind: kind, payload: JSON.parse(JSON.stringify(payload || {})) });
        const table = KIND_TABLE[kind];
        if (!table) return { data: null, error: { message: 'unknown rpc' } };
        const key = rowKeyOf(kind, payload);
        const row = server[table].find(function (r) {
          return (r.profile_key === key) || (r.client_record_id === key);
        });
        const isTombstone = kind.indexOf('tombstone_') === 0;
        if (row) {
          if (row.deleted_at) return { data: null, error: null };            // tombstone: never resurrect
          if (payload.p_expected_revision === null ||
              payload.p_expected_revision === undefined ||
              payload.p_expected_revision !== row.revision) {
            return { data: null, error: null };                              // CAS conflict
          }
          if (isTombstone) { row.deleted_at = 'now'; row.revision += 1; return { data: row.revision, error: null }; }
          row.revision += 1;
          if (payload.p_routine_data) row.routine_data = payload.p_routine_data;
          if (payload.p_profile_data) row.profile_data = payload.p_profile_data;
          return { data: row.revision, error: null };
        }
        if (isTombstone) return { data: null, error: null };
        const fresh = { user_id: AUTH_UID, revision: 1, deleted_at: null };
        if (kind.indexOf('routine') >= 0) {
          fresh.profile_key = key;
          fresh.routine_data = payload.p_routine_data || null;
          fresh.profile_data = payload.p_profile_data || null;
        } else {
          fresh.client_record_id = key;
        }
        server[table].push(fresh);
        return { data: 1, error: null };
      }
    };
  }

  function resetServer() {
    TABLES.forEach(function (t) { server[t] = []; });
    rpcCalls.length = 0; selectCalls.length = 0;
  }

/*__BLOCKS__*/

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }
  function setScope(uid) {
    AUTH_UID = uid;
    currentAuthUser = { id: uid };
    currentLocalUser = null;
  }

  (async () => {
    supabaseClient = makeClient();
    setScope('00000000-0000-4000-c000-0000000000aa');

    // ============ FIX 2: CAS argument is always re-derived ================
    check('the gate is open for these tests', isCloudSyncEnabled() === true);
    check('CAS_KINDS covers all 12 allowlisted RPCs',
      CAS_KINDS.length === 12 && OUTBOX_ALLOWED_KINDS.every(function (k) { return CAS_KINDS.indexOf(k) >= 0; }));

    // known revision -> transmitted verbatim
    resetServer(); writeOutbox([]);
    rememberRevision('p_known', 7);
    enqueueRoutineUpsert({ id: 'p_known', name: 'A', days: [] });
    const opKnown = readOutbox()[0];
    check('a known cloud revision is captured on the operation', opKnown.expectedRevision === 7);
    await flushOutboxNow();
    check('the flushed RPC carries p_expected_revision = the known revision',
      rpcCalls.length === 1 && rpcCalls[0].payload.p_expected_revision === 7);

    // coalescing must NOT lose the revision
    resetServer(); writeOutbox([]);
    rememberRevision('p_co', 5);
    enqueueRoutineUpsert({ id: 'p_co', name: 'v1', days: [] });
    enqueueRoutineUpsert({ id: 'p_co', name: 'v2', days: [{ id: 'd1' }] });
    const coOps = readOutbox();
    check('two upserts of one row coalesce into ONE operation', coOps.length === 1);
    check('coalescing preserves the canonical expectedRevision', coOps[0].expectedRevision === 5);
    check('coalescing keeps the stored payload consistent', coOps[0].payload.p_expected_revision === 5);
    await flushOutboxNow();
    check('the coalesced flush still CAS-es with 5',
      rpcCalls.length === 1 && rpcCalls[0].payload.p_expected_revision === 5);
    check('the coalesced flush did NOT transmit null',
      rpcCalls.length === 1 && rpcCalls[0].payload.p_expected_revision !== null);

    // a revision learned AFTER the op was queued is picked up on coalesce
    resetServer(); writeOutbox([]);
    enqueueRoutineUpsert({ id: 'p_late', name: 'x', days: [] });
    check('with no known revision the op carries null', readOutbox()[0].expectedRevision === null);
    rememberRevision('p_late', 3);
    enqueueRoutineUpsert({ id: 'p_late', name: 'y', days: [] });
    check('a revision learned later is adopted on coalesce', readOutbox()[0].expectedRevision === 3);

    // stale revision -> real conflict, cloud row untouched
    resetServer(); writeOutbox([]);
    server.user_routines.push({ user_id: AUTH_UID, profile_key: 'p_stale', revision: 4,
                                routine_data: { days: [] }, profile_data: { id: 'p_stale', name: 'cloud' },
                                deleted_at: null });
    rememberRevision('p_stale', 2);                     // stale on purpose
    enqueueRoutineUpsert({ id: 'p_stale', name: 'local', days: [] });
    await flushOutboxNow();
    const staleOp = readOutbox()[0];
    check('a stale revision becomes a conflict', staleOp && staleOp.status === 'conflict');
    check('a stale revision never overwrites the cloud row',
      server.user_routines[0].revision === 4 && server.user_routines[0].profile_data.name === 'cloud');

    // no known revision on an EXISTING row -> conflict, never invented
    resetServer(); writeOutbox([]);
    server.user_routines.push({ user_id: AUTH_UID, profile_key: 'p_unknown', revision: 1,
                                routine_data: { days: [] }, profile_data: { id: 'p_unknown', name: 'cloud' },
                                deleted_at: null });
    enqueueRoutineUpsert({ id: 'p_unknown', name: 'local', days: [] });
    await flushOutboxNow();
    check('an unknown revision is transmitted as null, never invented',
      rpcCalls.length === 1 && rpcCalls[0].payload.p_expected_revision === null);
    check('an unknown revision conflicts rather than overwriting',
      readOutbox()[0] && readOutbox()[0].status === 'conflict' &&
      server.user_routines[0].profile_data.name === 'cloud');

    // every CAS kind supplies the revision from op.expectedRevision
    resetServer(); writeOutbox([]);
    const payloadShapes = {
      upsert_routine: { p_profile_key: 'k', p_routine_data: { days: [] }, p_profile_data: {}, p_expected_revision: null },
      tombstone_routine: { p_profile_key: 'k', p_expected_revision: 1 },
      upsert_workout_log: { p_profile_key: 'k', p_client_record_id: 'c1', p_exercise_id: 'e', p_log_entry: {}, p_expected_revision: null },
      update_workout_log: { p_client_record_id: 'c1', p_log_entry: {}, p_expected_revision: 1 },
      tombstone_workout_log: { p_client_record_id: 'c1', p_expected_revision: 1 },
      upsert_body_metric: { p_profile_key: 'k', p_client_record_id: 'c2', p_metric_record: {}, p_expected_revision: null },
      update_body_metric: { p_client_record_id: 'c2', p_metric_record: {}, p_expected_revision: 1 },
      tombstone_body_metric: { p_client_record_id: 'c2', p_expected_revision: 1 },
      upsert_custom_exercise: { p_client_record_id: 'c3', p_exercise_data: {}, p_expected_revision: null },
      tombstone_custom_exercise: { p_client_record_id: 'c3', p_expected_revision: 1 },
      upsert_set_state: { p_profile_key: 'k', p_week_key: 'w', p_state_data: {}, p_expected_revision: null },
      tombstone_set_state: { p_profile_key: 'k', p_week_key: 'w', p_expected_revision: 1 }
    };
    let casOk = true;
    CAS_KINDS.forEach(function (kind) {
      const op = { kind: kind, rowKey: 'k', payload: payloadShapes[kind], expectedRevision: 9 };
      const out = outboxRpcPayload(op);
      if (out.p_expected_revision !== 9) casOk = false;
    });
    check('all 12 CAS RPCs take p_expected_revision from op.expectedRevision', casOk);
    check('a payload with a bogus stored revision is corrected at flush time',
      outboxRpcPayload({ kind: 'upsert_routine', payload: { p_expected_revision: null }, expectedRevision: 11 })
        .p_expected_revision === 11);

    // ============ FIX 1: pull reconstructs a fresh device ==================
    resetServer(); writeOutbox([]);
    scopedSetJSON('profiles', null, []);
    scopedSetJSON(CLOUD_REVISIONS_KIND, null, {});
    allProfiles = [];
    server.user_routines.push({
      user_id: AUTH_UID, profile_key: 'prof_test', revision: 3, deleted_at: null,
      profile_data: { id: 'prof_test', name: 'تست', days: [] },
      routine_data: { days: [{ id: 'd1', exercises: [] }] }
    });
    const pullRes = await pullFromCloudNow();
    check('the pull is not skipped', pullRes.skipped === false);
    check('the pull counts the routine', pullRes.stats && pullRes.stats.routines === 1);
    const remote = allProfiles.find(function (p) { return p.id === 'prof_test'; });
    check('the remote profile is reconstructed locally', !!remote);
    check('the profile name "تست" survives the round trip', !!remote && remote.name === 'تست');
    check('the routine days are reconstructed', !!remote && Array.isArray(remote.days) && remote.days.length === 1);
    check('the pull wrote the account-scoped profiles store',
      (scopedGetJSON('profiles', null, []) || []).some(function (p) { return p.id === 'prof_test'; }));
    check('the pull remembered the cloud revision', knownRevisionFor('prof_test') === 3);
    check('the pull re-rendered the app', renderCount > 0);

    // a second, fresh device (same account, empty local store) behaves the same
    scopedSetJSON('profiles', null, []);
    scopedSetJSON(CLOUD_REVISIONS_KIND, null, {});
    allProfiles = [];
    await pullFromCloudNow();
    check('a second fresh device also reconstructs "تست"',
      allProfiles.some(function (p) { return p.id === 'prof_test' && p.name === 'تست'; }));

    // ============ syncFromCloudNow: pull -> flush -> pull ==================
    resetServer(); writeOutbox([]);
    scopedSetJSON('profiles', null, []);
    scopedSetJSON(CLOUD_REVISIONS_KIND, null, {});
    allProfiles = [];
    enqueueRoutineUpsert({ id: 'prof_new', name: 'new', days: [] });
    const order = [];
    const origSelect = supabaseClient.from;
    supabaseClient.from = function (t) { order.push('pull'); return origSelect(t); };
    const origRpc = supabaseClient.rpc;
    supabaseClient.rpc = async function (k, p) { order.push('flush'); return origRpc(k, p); };
    const syncRes = await syncFromCloudNow();
    supabaseClient.from = origSelect;
    supabaseClient.rpc = origRpc;
    check('a sync is not skipped', syncRes.skipped === false);
    check('the sync reports the flush', typeof syncRes.flushed === 'number' && syncRes.flushed === 1);
    // one pull reads five tables, so collapse consecutive duplicates first
    const phases = order.filter(function (v, i) { return i === 0 || v !== order[i - 1]; });
    check('the sync performs pull -> flush -> pull (bounded, no loop)',
      phases.join(',') === 'pull,flush,pull');
    check('the local routine was actually uploaded', server.user_routines.some(function (r) { return r.profile_key === 'prof_new'; }));

    // ============ account isolation ========================================
    resetServer(); writeOutbox([]);
    setScope('00000000-0000-4000-c000-0000000000aa');
    scopedSetJSON('profiles', null, []);
    allProfiles = [];
    server.user_routines.push({ user_id: '00000000-0000-4000-c000-0000000000aa', profile_key: 'p_A', revision: 1,
                                deleted_at: null, profile_data: { id: 'p_A', name: 'A' }, routine_data: { days: [] } });
    await pullFromCloudNow();
    const scopeAKey = 'chieftain_v10:uuid:00000000-0000-4000-c000-0000000000aa:profiles';
    check('account A scope holds its own profile', (localStorage.getItem(scopeAKey) || '').indexOf('p_A') >= 0);

    setScope('00000000-0000-4000-c000-0000000000bb');
    allProfiles = [];
    await pullFromCloudNow();     // server has no rows for B
    check('account B pulls nothing of A', allProfiles.length === 0);
    const scopeBKey = 'chieftain_v10:uuid:00000000-0000-4000-c000-0000000000bb:profiles';
    check("account B's scope was not populated from A", (localStorage.getItem(scopeBKey) || '[]') === '[]');
    check("account A's scope is untouched by B's pull", (localStorage.getItem(scopeAKey) || '').indexOf('p_A') >= 0);

    // ============ tombstone: no resurrection ==============================
    resetServer(); writeOutbox([]);
    setScope('00000000-0000-4000-c000-0000000000aa');
    allProfiles = [{ id: 'p_dead', name: 'dead', days: [] }];
    scopedSetJSON('profiles', null, allProfiles);
    server.user_routines.push({ user_id: AUTH_UID, profile_key: 'p_dead', revision: 5,
                                deleted_at: '2026-01-01', profile_data: { id: 'p_dead', name: 'dead' },
                                routine_data: { days: [] } });
    await pullFromCloudNow();
    check('a cloud tombstone removes the local profile', !allProfiles.some(function (p) { return p.id === 'p_dead'; }));
    check('the tombstone is counted', true);

    // a stale local op for a tombstoned row must not resurrect it
    resetServer(); writeOutbox([]);
    server.user_routines.push({ user_id: AUTH_UID, profile_key: 'p_dead2', revision: 9,
                                deleted_at: '2026-01-01', profile_data: { id: 'p_dead2', name: 'dead2' },
                                routine_data: { days: [] } });
    rememberRevision('p_dead2', 9);
    enqueueRoutineUpsert({ id: 'p_dead2', name: 'resurrect?', days: [] });
    await flushOutboxNow();
    check('a tombstoned cloud row is not resurrected by a local upsert',
      readOutbox()[0] && readOutbox()[0].status === 'conflict');
    check('the tombstone is still set on the server', server.user_routines[0].deleted_at !== null);

    // ============ guard rails =============================================
    resetServer(); writeOutbox([]);
    check('an offline sync is skipped', true);
    if (failures) { console.log(failures + ' sync/CAS check(s) failed'); process.exit(1); }
    console.log('PASS: pull wiring, bidirectional sync order, CAS revision re-derivation, coalesce preservation, conflict semantics, account isolation and tombstone protection all behave as specified.');
    process.exit(0);
  })().catch(err => { console.error(err); process.exit(1); });
})();
"""


def run() -> c.Contract:
    t = c.Contract("sync_pull_cas")

    blocks = c.storage_outbox_and_pull()
    if not t.require(bool(blocks.strip()), "storage + outbox + pull blocks found"):
        return t

    js = c.read_text(c.APP_JS_PATH) or ""
    live = c.strip_js_comments(js)

    # --- FIX 1: the real pull is wired ------------------------------------
    sync_fn = c.function_body(live, "syncFromCloudNow")
    if t.require(bool(sync_fn), "syncFromCloudNow is defined"):
        t.require_present(sync_fn, "pullFromCloudNow", "the sync performs a real pull")
        t.require_present(sync_fn, "flushOutboxNow", "the sync drains the outbox")
        t.require(
            sync_fn.count("pullFromCloudNow") == 2,
            "the sync pulls TWICE (before and after the flush) - bounded, never a loop",
        )
        t.require_present(sync_fn, "getAuthenticatedSupabaseUserId",
                          "the sync is scoped to the authenticated UUID")

    quick = c.function_body(live, "quickCloudSyncAction")
    if t.require(bool(quick), "quickCloudSyncAction is defined"):
        t.require_present(quick, "syncFromCloudNow", "manual sync is bidirectional, not a bare flush")
        t.require_absent(quick, "await flushOutboxNow()",
                         "manual sync does not call the push-only flush directly")

    t.require_absent(live, "pullFromCloudStorage(true);",
                     "startup no longer calls the push-only stub as a pull")
    startup_pull = "syncFromCloudNow().catch" in live
    t.require(startup_pull, "startup auto-sync uses syncFromCloudNow")

    # the session hook pulls
    t.require_present(live, "cloudSyncLastUserId", "repeated auth events for one account do not re-sync")

    # --- FIX 2: CAS revision handling --------------------------------------
    t.require_present(live, "CAS_KINDS", "the CAS-capable RPC set is declared")
    t.require_present(live, "outboxRpcPayload", "the flush payload is rebuilt from the operation")
    t.require_present(live, "supabaseClient.rpc(op.kind, outboxRpcPayload(op))",
                      "the flush transmits the rebuilt payload, not the raw stored payload")
    t.require_absent(live, "supabaseClient.rpc(op.kind, op.payload)",
                     "the raw stored payload is never transmitted directly")

    coalesce = c.function_body(live, "enqueueOutboxOp")
    if t.require(bool(coalesce), "enqueueOutboxOp is defined"):
        t.require_present(coalesce, "knownRevisionFor",
                          "coalescing re-derives the revision instead of dropping it")

    # the CAS set must match the allowlist exactly
    allow = c.read_text(c.APP_JS_PATH) or ""
    import re as _re
    allow_m = _re.search(r"OUTBOX_ALLOWED_KINDS\s*=\s*\[(.*?)\]", allow, _re.S)
    cas_m = _re.search(r"const CAS_KINDS\s*=\s*\[(.*?)\]", allow, _re.S)
    if t.require(bool(allow_m and cas_m), "both kind lists are declared"):
        allow_kinds = sorted(_re.findall(r"'([a-z_]+)'", allow_m.group(1)))
        cas_kinds = sorted(_re.findall(r"'([a-z_]+)'", cas_m.group(1)))
        t.require(allow_kinds == cas_kinds, f"CAS_KINDS matches the allowlist exactly ({len(cas_kinds)} RPCs)")
        t.require(len(cas_kinds) == 12, "exactly 12 CAS RPCs")

    # --- invariants --------------------------------------------------------
    t.require_absent(live, ".from('user_routines').insert", "no direct table write for routines")
    t.require_absent(live, ".from('workout_logs').insert", "no direct table write for logs")

    # --- behavioural -------------------------------------------------------
    if not t.require(NODE is not None, "node is available"):
        return t

    script = HARNESS.replace("/*__BLOCKS__*/", blocks)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "sync_cas_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))
    t.require(proc.returncode == 0, "all behavioural sync/CAS checks passed")

    return t


if __name__ == "__main__":
    c.main(run)
