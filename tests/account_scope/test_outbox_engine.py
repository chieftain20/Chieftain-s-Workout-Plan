"""Outbox engine -- behavioural test.

Extracts the ACCOUNT_SCOPE_STORAGE and CLOUD_OUTBOX blocks from app_engine.js and
executes them in Node against an instrumented localStorage, a stubbed
supabaseClient and a controllable clock. This is a real behavioural test of the
queue, not a text scan.

EXPECTED STATUS IN STEP 3: PASS.
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

  // ---- instrumented localStorage -----------------------------------------
  const localStorage = {};
  Object.defineProperties(localStorage, {
    getItem: { value: function (k) { return Object.prototype.hasOwnProperty.call(localStorage, k) ? localStorage[k] : null; } },
    setItem: { value: function (k, v) { localStorage[String(k)] = String(v); } },
    removeItem: { value: function (k) { delete localStorage[String(k)]; } },
    key: { value: function (i) { return Object.keys(localStorage)[i] || null; } },
    length: { get: function () { return Object.keys(localStorage).length; } }
  });

  // ---- controllable timers (the debounce must not fire during tests) ------
  const timers = [];
  globalThis.setTimeout = function (fn, ms) { timers.push({ fn: fn, ms: ms }); return timers.length; };
  globalThis.clearTimeout = function () {};

  // ---- controllable connectivity -----------------------------------------
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true }, writable: true, configurable: true
  });

  let currentAuthUser = null;
  let currentLocalUser = null;
  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
  }

/*__STORAGE_AND_OUTBOX__*/

  // ---- harness stubs ------------------------------------------------------
  let rpcCalls = [];
  let rpcHandler = null;
  let supabaseClient = null;

  async function getAuthenticatedSupabaseUserId() {
    if (!supabaseClient || !currentAuthUser || !isUuid(currentAuthUser.id)) return null;
    const res = await supabaseClient.auth.getSession();
    const u = res && res.data && res.data.session && res.data.session.user;
    if (res && res.error) return null;
    if (!u || u.id !== currentAuthUser.id || !isUuid(u.id)) return null;
    return u.id;
  }

  function makeClient() {
    return {
      auth: {
        getSession: async () => ({
          data: { session: currentAuthUser ? { user: { id: currentAuthUser.id } } : null },
          error: null
        })
      },
      rpc: async (name, args) => {
        rpcCalls.push({ name: name, args: args });
        if (typeof rpcHandler === 'function') return rpcHandler(name, args, rpcCalls.length);
        return { data: 1, error: null };
      }
    };
  }

  const USER_A = '752b816b-40a2-4c41-a3e0-5f8ab8094397';
  const USER_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  function asCloud(uuid) { currentAuthUser = { id: uuid }; currentLocalUser = null; supabaseClient = makeClient(); }
  function asLocal(id) { currentAuthUser = null; currentLocalUser = { id: id }; supabaseClient = makeClient(); }

  function reset() {
    Object.keys(localStorage).forEach(k => { if (k.indexOf('chieftain_v10:') === 0) delete localStorage[k]; });
    rpcCalls = [];
    rpcHandler = null;
    timers.length = 0;
    navigator.onLine = true;
    CLOUD_SYNC_GATE.contractVerified = true;
  }

  let failures = 0;
  function check(label, cond) {
    if (!cond) { failures++; console.log('  FAIL: ' + label); }
  }

  (async () => {
    // ---- 1. deterministic identity -------------------------------------
    check('sha1(abc) test vector', sha1Hex('abc') === 'a9993e364706816aba3e25717850c26c9cd0d89d');
    check('sha1("") test vector', sha1Hex('') === 'da39a3ee5e6b4b0d3255bfef95601890afd80709');

    const u1 = deterministicUuid('log', 'prof_a', 'leg_curl', 1700000000000);
    const u2 = deterministicUuid('log', 'prof_a', 'leg_curl', 1700000000000);
    const u3 = deterministicUuid('log', 'prof_a', 'leg_curl', 1700000000001);
    check('uuid is stable for identical input', u1 === u2);
    check('uuid differs for different input', u1 !== u3);
    check('uuid is a valid v5-shaped uuid',
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(u1));

    // ---- 2. gate closed: nothing is transmitted --------------------------
    asCloud(USER_A); reset();
    CLOUD_SYNC_GATE.contractVerified = false;
    enqueueLogUpsert('prof_a', 'leg_curl', { timestamp: 111 });
    check('operation queues even while gated', readOutbox().length === 1);
    const gated = await flushOutboxNow();
    check('gate blocks transmission', gated.skipped === true && gated.reason === 'cloud_sync_disabled');
    check('gate: no RPC was issued', rpcCalls.length === 0);
    check('gate: operation still pending', readOutbox()[0].status === 'pending');
    check('gate default is closed', isCloudSyncEnabled() === false);

    // ---- 3. offline write -> queued, online -> flushed -------------------
    CLOUD_SYNC_GATE.contractVerified = true;
    navigator.onLine = false;
    const offline = await flushOutboxNow();
    check('offline: flush skipped', offline.skipped === true && offline.reason === 'offline');
    check('offline: nothing transmitted', rpcCalls.length === 0);
    check('offline: operation still queued', readOutbox().length === 1);

    navigator.onLine = true;
    const online = await flushOutboxNow();
    check('online: one operation flushed', online.flushed === 1);
    check('online: RPC name matches the STEP 1 contract', rpcCalls[0].name === 'upsert_workout_log');
    check('online: queue pruned after success', readOutbox().length === 0);

    // ---- 4. payload shape: ownership is never client-supplied ------------
    const args = rpcCalls[0].args;
    check('payload carries the profile key', args.p_profile_key === 'prof_a');
    check('payload carries a client record id', typeof args.p_client_record_id === 'string');
    check('payload carries the expected revision', args.p_expected_revision === null);
    check('payload carries no user id',
      !('p_user_id' in args) && !('user_id' in args) && !Object.keys(args).some(k => /user_id/i.test(k)));

    // ---- 5. ordering -----------------------------------------------------
    asCloud(USER_A); reset();
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    enqueueLogUpsert('prof_a', 'b', { timestamp: 2 });
    enqueueLogUpsert('prof_a', 'c', { timestamp: 3 });
    await flushOutboxNow();
    check('queue order preserved',
      rpcCalls.map(x => x.args.p_exercise_id).join(',') === 'a,b,c');

    // ---- 6. idempotency --------------------------------------------------
    asCloud(USER_A); reset();
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    check('identical upsert coalesces to one operation', readOutbox().length === 1);
    await flushOutboxNow();
    check('coalesced operation sent exactly once', rpcCalls.length === 1);

    asCloud(USER_A); reset();
    enqueueLogUpsert('prof_a', 'a', { timestamp: 7 });
    const idA = readOutbox()[0].payload.p_client_record_id;
    asCloud(USER_A); reset();
    enqueueLogUpsert('prof_a', 'a', { timestamp: 7 });
    const idB = readOutbox()[0].payload.p_client_record_id;
    check('client_record_id is deterministic across sessions', idA === idB);

    // ---- 7. retry: a failed RPC stays queued and stops the pass ----------
    asCloud(USER_A); reset();
    rpcHandler = () => ({ data: null, error: { message: 'network down' } });
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    enqueueLogUpsert('prof_a', 'b', { timestamp: 2 });
    const failed = await flushOutboxNow();
    check('failed RPC: operation remains queued', readOutbox().length === 2);
    check('failed RPC: attempt counted', readOutbox()[0].attempts === 1);
    check('failed RPC: pass stopped', failed.stopped === true && rpcCalls.length === 1);
    check('failed RPC: later operation untouched', readOutbox()[1].attempts === 0);

    // ---- 8. CAS conflict: NULL revision is never success ------------------
    asCloud(USER_A); reset();
    rpcHandler = () => ({ data: null, error: null });
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    const conflicted = await flushOutboxNow();
    check('NULL revision is not counted as flushed', conflicted.flushed === 0 && conflicted.conflicted === 1);
    check('NULL revision marks the operation as conflict', readOutbox()[0].status === 'conflict');
    check('conflict is persisted in the queue', readOutbox().length === 1);
    check('conflict is visible in the summary', outboxStatusSummary().conflict === 1);

    rpcCalls = [];
    rpcHandler = () => ({ data: 9, error: null });
    await flushOutboxNow();
    check('conflict is never auto-retried', rpcCalls.length === 0);
    check('conflict remains unresolved', outboxStatusSummary().conflict === 1);

    // ---- 9. tombstone protection -----------------------------------------
    asCloud(USER_A); reset();
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    check('upsert queued', readOutbox().length === 1);
    enqueueLogTombstone('prof_a', 'a', 1);
    check('unsent create + delete cancel out (no resurrection attempt)', readOutbox().length === 0);

    asCloud(USER_A); reset();
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    await flushOutboxNow();
    enqueueLogTombstone('prof_a', 'a', 1);
    const afterSend = readOutbox();
    check('tombstone is queued once the create was transmitted',
      afterSend.length === 1 && afterSend[0].kind === 'tombstone_workout_log');

    // ---- 10. an unresolved conflict is never clobbered -------------------
    asCloud(USER_A); reset();
    rpcHandler = () => ({ data: null, error: null });
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    await flushOutboxNow();
    check('conflict present before re-enqueue', outboxStatusSummary().conflict === 1);
    rpcHandler = () => ({ data: 5, error: null });
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    const mixed = readOutbox();
    check('conflict survives a later enqueue', mixed.filter(o => o.status === 'conflict').length === 1);
    check('the later write is appended, not merged', mixed.length === 2);

    // ---- 11. explicit conflict resolution --------------------------------
    asCloud(USER_A); reset();
    rpcHandler = () => ({ data: null, error: null });
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    await flushOutboxNow();
    const conflictOp = readOutbox()[0];
    check('resolution rejects an unknown operation',
      (await resolveOutboxConflict('nope', 'keep_cloud')).ok === false);
    check('resolution requires the conflict state',
      (await resolveOutboxConflict(conflictOp.id, 'cancel')).reason === 'left_unresolved');
    check('cancel leaves the conflict in place', readOutbox().length === 1);
    const keptCloud = await resolveOutboxConflict(conflictOp.id, 'keep_cloud');
    check('keep_cloud drops the local queued operation',
      keptCloud.ok === true && readOutbox().length === 0);

    // ---- 12. per-scope isolation -----------------------------------------
    asCloud(USER_A); reset();
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    check('account A queued one operation', readOutbox().length === 1);
    asCloud(USER_B);
    check('account B cannot see account A operations', readOutbox().length === 0);
    enqueueLogUpsert('prof_b', 'b', { timestamp: 2 });
    check('account B has its own operation', readOutbox().length === 1);
    asCloud(USER_A);
    check('account A still sees only its own operation',
      readOutbox().length === 1 && readOutbox()[0].payload.p_profile_key === 'prof_a');

    // ---- 13. ownership recorded, payloads carry no owner ------------------
    asCloud(USER_A); reset();
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    enqueueMetricUpsert('prof_a', { id: 'm_1' });
    enqueueSetStateUpsert('prof_a', 'IR_WEEK_1', { sets: {} });
    enqueueRoutineUpsert({ id: 'prof_a', days: [], pin: '1234' });
    enqueueCustomExerciseUpsert({ id: 'cust_1', ownerId: 'someone-else' });
    const ops = readOutbox();
    check('all five operation kinds queued', ops.length === 5);
    ops.forEach(op => {
      const keys = Object.keys(op.payload);
      check('payload keys are STEP 1 parameter names for ' + op.kind, keys.every(k => k.indexOf('p_') === 0));
      check('payload carries no owner for ' + op.kind, !keys.some(k => /user_id|owner/i.test(k)));
      check('ownerScope recorded for ' + op.kind, op.ownerScope === 'uuid:' + USER_A);
    });
    const routineOp = ops.find(o => o.kind === 'upsert_routine');
    check('device-local PIN is stripped from the routine payload',
      routineOp && !('pin' in routineOp.payload.p_profile_data));
    const custOp = ops.find(o => o.kind === 'upsert_custom_exercise');
    check('client-supplied ownerId is stripped from the custom exercise',
      custOp && !('ownerId' in custOp.payload.p_exercise_data));

    // ---- 14. allowlist and scope guards ----------------------------------
    check('an unknown RPC kind is rejected',
      enqueueOutboxOp({ kind: 'drop_everything', rowKey: 'x', payload: {} }) === null);
    asLocal('admin_hossein');
    reset();
    check('a local: scope queues nothing', enqueueLogUpsert('prof_a', 'a', { timestamp: 1 }) === null);
    check('a local: scope outbox stays empty', readOutbox().length === 0);

    // ---- 15. debounced flush is scheduled --------------------------------
    asCloud(USER_A); reset();
    enqueueLogUpsert('prof_a', 'a', { timestamp: 1 });
    check('a debounced flush was scheduled after a write', timers.length > 0);

    if (failures) {
      console.log(failures + ' outbox check(s) failed');
      process.exit(1);
    }
    console.log('PASS: outbox ordering, per-scope isolation, idempotency, retry, CAS conflict, tombstone protection, offline queueing, gated transmission and no cross-account ownership all hold.');
    process.exit(0);
  })().catch(err => { console.error(err); process.exit(1); });
})();
"""


def run() -> c.Contract:
    t = c.Contract("outbox_engine")

    if not t.require(NODE is not None, "node is available"):
        return t

    block = c.storage_and_outbox()
    if not t.require(bool(block.strip()), "scope + outbox blocks found in app_engine.js"):
        return t

    script = HARNESS.replace("/*__STORAGE_AND_OUTBOX__*/", block)

    # The generated script is far larger than a Windows command line allows, so
    # it is written to a temp file and executed from there.
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "outbox_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run(
            [NODE, str(path)],
            capture_output=True, text=True, encoding="utf-8",
        )

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))

    t.require(proc.returncode == 0, "all behavioural outbox checks passed")
    return t


if __name__ == "__main__":
    c.main(run)
