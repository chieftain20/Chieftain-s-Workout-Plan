"""Cloud pull / read sync -- behavioural test.

Executes the storage + outbox + pull blocks in Node against an instrumented
localStorage and a mocked Supabase read client.

EXPECTED STATUS IN STEP 4: PASS.
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

  globalThis.setTimeout = function () { return 1; };
  globalThis.clearTimeout = function () {};
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, writable: true, configurable: true });

  let currentAuthUser = null;
  let currentLocalUser = null;
  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
  }

/*__BLOCKS__*/

  let allProfiles = [];
  let customExercises = [];
  let masterExerciseOverrides = {};

  const USER_A = '752b816b-40a2-4c41-a3e0-5f8ab8094397';
  const USER_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  let rowsByTable = {};
  let readCalls = [];
  let eqCalls = [];
  let rpcCalls = [];
  let supabaseClient = null;

  function makeEqChain(table, filters) {
    return {
      eq: function (col, val) { eqCalls.push({ table: table, col: col, val: val }); return makeEqChain(table, filters.concat([[col, val]])); },
      maybeSingle: function () { return Promise.resolve({ data: (rowsByTable[table] || [])[0] || null, error: null }); },
      then: function (resolve, reject) {
        return Promise.resolve({ data: rowsByTable[table] || [], error: null }).then(resolve, reject);
      }
    };
  }

  function makeClient() {
    return {
      auth: { getSession: async () => ({ data: { session: currentAuthUser ? { user: { id: currentAuthUser.id } } : null }, error: null }) },
      from: function (table) {
        readCalls.push(table);
        return {
          select: function () { return makeEqChain(table, []); },
          insert: function () { throw new Error('pull must never INSERT'); },
          update: function () { throw new Error('pull must never UPDATE'); },
          delete: function () { throw new Error('pull must never DELETE'); },
          upsert: function () { throw new Error('pull must never UPSERT'); }
        };
      },
      rpc: async function (name, args) { rpcCalls.push({ name: name, args: args }); return { data: 1, error: null }; }
    };
  }

  async function getAuthenticatedSupabaseUserId() {
    if (!supabaseClient || !currentAuthUser || !isUuid(currentAuthUser.id)) return null;
    const res = await supabaseClient.auth.getSession();
    const u = res && res.data && res.data.session && res.data.session.user;
    if (!u || u.id !== currentAuthUser.id) return null;
    return u.id;
  }

  function asCloud(uuid) { currentAuthUser = { id: uuid }; currentLocalUser = null; supabaseClient = makeClient(); }
  function reset() {
    Object.keys(localStorage).forEach(k => { if (k.indexOf('chieftain_v10:') === 0) delete localStorage[k]; });
    allProfiles = []; customExercises = []; masterExerciseOverrides = {};
    rowsByTable = {}; readCalls = []; eqCalls = []; rpcCalls = [];
    navigator.onLine = true;
    CLOUD_SYNC_GATE.contractVerified = true;
  }

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }

  function cloudRows() {
    return {
      user_routines: [
        { profile_key: 'prof_cloud', profile_data: { name: 'Cloud' }, routine_data: { days: [{ id: 'd1' }] }, revision: 3, deleted_at: null },
        { profile_key: 'prof_gone', profile_data: { name: 'Gone' }, routine_data: { days: [] }, revision: 2, deleted_at: '2026-01-01T00:00:00Z' }
      ],
      workout_logs: [
        { profile_key: 'prof_local', exercise_id: 'leg_curl', client_record_id: 'c-1', log_entry: { timestamp: 5000 }, revision: 4, deleted_at: null }
      ],
      body_metrics: [
        { profile_key: 'prof_local', client_record_id: 'c-2', metric_record: { id: 'm_9', timestamp: 6000 }, revision: 2, deleted_at: null }
      ],
      user_custom_exercises: [
        { client_record_id: 'c-3', exercise_data: { id: 'cust_9' }, revision: 1, deleted_at: null }
      ],
      workout_set_states: [
        { profile_key: 'prof_local', week_key: 'IR_WEEK_1', state_data: { weekKey: 'IR_WEEK_1', updatedAt: 100, sets: {} }, revision: 1, deleted_at: null }
      ]
    };
  }

  (async () => {
    // ---- 1. gate closed: no read is even attempted ----------------------
    asCloud(USER_A); reset();
    CLOUD_SYNC_GATE.contractVerified = false;
    rowsByTable = cloudRows();
    const gated = await pullFromCloudNow();
    check('gate closed: pull skipped', gated.skipped === true && gated.reason === 'cloud_sync_disabled');
    check('gate closed: no table was read', readCalls.length === 0);

    // ---- 2. offline: no read --------------------------------------------
    CLOUD_SYNC_GATE.contractVerified = true;
    navigator.onLine = false;
    const offline = await pullFromCloudNow();
    check('offline: pull skipped', offline.skipped === true && offline.reason === 'offline');
    check('offline: no table was read', readCalls.length === 0);
    navigator.onLine = true;

    // ---- 3. merge ------------------------------------------------------
    reset();
    allProfiles = [
      { id: 'prof_local', name: 'Local', days: [] },
      { id: 'prof_gone', name: 'ShouldBeRemoved', days: [] }
    ];
    rowsByTable = cloudRows();
    const pulled = await pullFromCloudNow();
    check('pull did not skip', pulled.skipped === false && !pulled.error);

    check('cloud routine added', allProfiles.some(p => p.id === 'prof_cloud'));
    check('cloud routine payload merged', (allProfiles.find(p => p.id === 'prof_cloud') || {}).name === 'Cloud');
    check('cloud routine days merged', ((allProfiles.find(p => p.id === 'prof_cloud') || {}).days || []).length === 1);
    check('local profile preserved', allProfiles.some(p => p.id === 'prof_local'));
    check('tombstoned routine removed locally', !allProfiles.some(p => p.id === 'prof_gone'));
    check('tombstone counted', pulled.stats.tombstones >= 1);

    const logs = scopedGetJSON('logs', 'prof_local:leg_curl', []);
    check('cloud log merged', Array.isArray(logs) && logs.length === 1 && logs[0].timestamp === 5000);
    const metrics = scopedGetJSON('metrics', 'prof_local', []);
    check('cloud metric merged', Array.isArray(metrics) && metrics.some(m => m.id === 'm_9'));
    check('cloud custom exercise merged', customExercises.some(e => e.id === 'cust_9'));
    check('cloud set state merged', !!scopedGetJSON('sets', 'prof_local', null));

    // ---- 4. revisions remembered ---------------------------------------
    check('cloud routine revision remembered', knownRevisionFor('prof_cloud') === 3);
    check('cloud log revision remembered', knownRevisionFor('c-1') === 4);
    check('cloud metric revision remembered', knownRevisionFor('c-2') === 2);

    // ---- 5. reads are scoped to the authenticated account ---------------
    check('every read filtered on user_id', eqCalls.length > 0 && eqCalls.every(e => e.col === 'user_id'));
    check('every read used the session user id', eqCalls.every(e => e.val === USER_A));
    check('all five tables were read', new Set(readCalls).size === 5);
    check('pull issued no RPC', rpcCalls.length === 0);

    // ---- 6. pending local work is protected -----------------------------
    reset();
    allProfiles = [{ id: 'prof_local', name: 'Local', days: [] }];
    const pendingId = deterministicUuid('log', 'prof_local', 'leg_curl', 7000);
    enqueueLogUpsert('prof_local', 'leg_curl', { timestamp: 7000, local: true });
    scopedSetJSON('logs', 'prof_local:leg_curl', [{ timestamp: 7000, local: true }]);
    check('a pending operation exists', outboxHasUnresolvedFor(pendingId) === true);
    rowsByTable = {
      workout_logs: [
        { profile_key: 'prof_local', exercise_id: 'leg_curl', client_record_id: pendingId, log_entry: { timestamp: 7000, fromCloud: true }, revision: 9, deleted_at: null }
      ]
    };
    const protectedPull = await pullFromCloudNow();
    check('pending row was deferred', protectedPull.stats.deferred >= 1);
    const protectedLogs = scopedGetJSON('logs', 'prof_local:leg_curl', []);
    check('pending local record was not overwritten',
      Array.isArray(protectedLogs) && protectedLogs.length === 1 && protectedLogs[0].local === true);
    check('pending operation is still queued', readOutbox().some(o => o.status === 'pending'));

    // ---- 7. a cloud tombstone cannot resurrect pending local work -------
    reset();
    allProfiles = [{ id: 'prof_local', name: 'Local', days: [] }];
    const pendingId2 = deterministicUuid('log', 'prof_local', 'squat', 8000);
    enqueueLogUpsert('prof_local', 'squat', { timestamp: 8000, local: true });
    scopedSetJSON('logs', 'prof_local:squat', [{ timestamp: 8000, local: true }]);
    rowsByTable = {
      workout_logs: [
        { profile_key: 'prof_local', exercise_id: 'squat', client_record_id: pendingId2, log_entry: { timestamp: 8000 }, revision: 5, deleted_at: '2026-01-01T00:00:00Z' }
      ]
    };
    await pullFromCloudNow();
    const survived = scopedGetJSON('logs', 'prof_local:squat', []);
    check('a pending local record survives a cloud tombstone',
      Array.isArray(survived) && survived.length === 1);

    // ---- 8. a newer local set state is not overwritten ------------------
    reset();
    allProfiles = [{ id: 'prof_local', name: 'Local', days: [] }];
    scopedSetJSON('sets', 'prof_local', { weekKey: 'IR_WEEK_1', updatedAt: 999, sets: { local: [true] } });
    rowsByTable = {
      workout_set_states: [
        { profile_key: 'prof_local', week_key: 'IR_WEEK_1', state_data: { weekKey: 'IR_WEEK_1', updatedAt: 1, sets: { cloud: [true] } }, revision: 2, deleted_at: null }
      ]
    };
    const setPull = await pullFromCloudNow();
    const keptSets = scopedGetJSON('sets', 'prof_local', null);
    check('newer local set state wins', !!keptSets && !!keptSets.sets.local);
    check('the stale cloud set state was deferred', setPull.stats.deferred >= 1);

    // ---- 9. an account never reads another account's rows --------------
    reset();
    allProfiles = [];
    rowsByTable = cloudRows();
    await pullFromCloudNow();
    check('reads used only the active account id', eqCalls.every(e => e.val === USER_A));
    asCloud(USER_B);
    check('a second account starts with an empty workspace', scopedGetJSON('profiles', null, null) === null);
    rowsByTable = {};
    await pullFromCloudNow();
    check('the second account read only its own id', eqCalls.slice(-5).every(e => e.val === USER_B));

    if (failures) { console.log(failures + ' pull check(s) failed'); process.exit(1); }
    console.log('PASS: pull is gated, reads only the authenticated account, respects revisions and tombstones, protects pending local work and issues no writes.');
    process.exit(0);
  })().catch(err => { console.error(err); process.exit(1); });
})();
"""


def run() -> c.Contract:
    t = c.Contract("cloud_pull_behaviour")

    if not t.require(NODE is not None, "node is available"):
        return t

    blocks = c.storage_outbox_and_pull()
    if not t.require(bool(blocks.strip()), "storage + outbox + pull blocks found"):
        return t

    script = HARNESS.replace("/*__BLOCKS__*/", blocks)

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "pull_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))

    t.require(proc.returncode == 0, "all behavioural pull checks passed")
    return t


if __name__ == "__main__":
    c.main(run)
