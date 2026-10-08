"""Conflict resolver UI -- behavioural + static contract.

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
  let revisionRow = null;
  let rpcHandler = null;
  let supabaseClient = null;

  function makeEqChain(table) {
    return {
      eq: function () { return makeEqChain(table); },
      maybeSingle: function () { return Promise.resolve({ data: revisionRow, error: null }); },
      then: function (resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
    };
  }

  function makeClient() {
    return {
      auth: { getSession: async () => ({ data: { session: currentAuthUser ? { user: { id: currentAuthUser.id } } : null }, error: null }) },
      from: function (table) { return { select: function () { return makeEqChain(table); } }; },
      rpc: async function (name, args) {
        if (typeof rpcHandler === 'function') return rpcHandler(name, args);
        return { data: 1, error: null };
      }
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
    rpcHandler = null; revisionRow = null;
    navigator.onLine = true;
    CLOUD_SYNC_GATE.contractVerified = true;
  }

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }

  async function makeConflict(kind, profileKey, extra) {
    if (kind === 'upsert_workout_log') enqueueLogUpsert(profileKey, extra.exId, { timestamp: extra.ts });
    else if (kind === 'tombstone_workout_log') {
      enqueueLogUpsert(profileKey, extra.exId, { timestamp: extra.ts });
      await flushOutboxNow();                       // transmit the create first
      enqueueLogTombstone(profileKey, extra.exId, extra.ts);
    } else if (kind === 'upsert_routine') enqueueRoutineUpsert({ id: profileKey, days: [] });
    else if (kind === 'upsert_set_state') enqueueSetStateUpsert(profileKey, extra.weekKey, { sets: {} });
    rpcHandler = () => ({ data: null, error: null });   // NULL revision -> conflict
    await flushOutboxNow();
    return listOutboxConflicts()[0];
  }

  (async () => {
    // ---- 1. choices for a log upsert (gate open) -------------------------
    asCloud(USER_A); reset();
    let op = await makeConflict('upsert_workout_log', 'prof_a', { exId: 'leg_curl', ts: 1000 });
    check('a conflict was produced', !!op && op.status === 'conflict');
    let choices = outboxConflictChoices(op);
    check('keep_cloud is offered', choices.indexOf('keep_cloud') >= 0);
    check('cancel is offered', choices.indexOf('cancel') >= 0);
    check('keep_local is offered while the gate is open', choices.indexOf('keep_local') >= 0);
    check('keep_both is offered for a record with a client id', choices.indexOf('keep_both') >= 0);
    check('the description names the affected record', describeOutboxConflict(op).indexOf('leg_curl') < 0
      ? describeOutboxConflict(op).indexOf(op.payload.p_client_record_id) >= 0
      : true);

    // ---- 2. gate closed hides keep_local ---------------------------------
    CLOUD_SYNC_GATE.contractVerified = false;
    choices = outboxConflictChoices(op);
    check('keep_local is hidden while the gate is closed', choices.indexOf('keep_local') < 0);
    check('keep_cloud is still offered', choices.indexOf('keep_cloud') >= 0);
    CLOUD_SYNC_GATE.contractVerified = true;

    // ---- 3. unsafe choices are hidden, not invented ----------------------
    asCloud(USER_A); reset();
    const tomb = await makeConflict('tombstone_workout_log', 'prof_a', { exId: 'squat', ts: 2000 });
    check('tombstone conflict produced', !!tomb && tomb.kind === 'tombstone_workout_log');
    check('keep_both is hidden for a tombstone', outboxConflictChoices(tomb).indexOf('keep_both') < 0);

    asCloud(USER_A); reset();
    const routine = await makeConflict('upsert_routine', 'prof_a', {});
    check('routine conflict produced', !!routine && routine.kind === 'upsert_routine');
    check('keep_both is hidden for a routine (no client id)', outboxConflictChoices(routine).indexOf('keep_both') < 0);

    // ---- 4. an unoffered choice is rejected ------------------------------
    const rejected = await resolveOutboxConflict(routine.id, 'keep_both');
    check('an unoffered choice is rejected', rejected.ok === false && rejected.reason === 'unsupported_choice');
    check('the conflict is unchanged after rejection', listOutboxConflicts().length === 1);

    // ---- 5. cancel leaves it unresolved ----------------------------------
    const cancelled = await resolveOutboxConflict(routine.id, 'cancel');
    check('cancel succeeds', cancelled.ok === true);
    check('cancel leaves the conflict in place', listOutboxConflicts().length === 1);

    // ---- 6. keep_local re-queues with the current revision ---------------
    revisionRow = { revision: 7 };
    const keptLocal = await resolveOutboxConflict(routine.id, 'keep_local');
    check('keep_local succeeds', keptLocal.ok === true && keptLocal.reason === 'kept_local');
    check('the operation is pending again', readOutbox()[0].status === 'pending');
    check('the operation CAS-es against the fetched revision', readOutbox()[0].payload.p_expected_revision === 7);
    check('no conflict remains', listOutboxConflicts().length === 0);

    // ---- 7. keep_local needs a reachable revision ------------------------
    asCloud(USER_A); reset();
    const c2 = await makeConflict('upsert_workout_log', 'prof_a', { exId: 'row', ts: 3000 });
    revisionRow = null;                                   // row not found
    const noRev = await resolveOutboxConflict(c2.id, 'keep_local');
    check('keep_local fails when the revision is unavailable', noRev.ok === false && noRev.reason === 'row_not_found');
    check('the conflict is preserved on failure', listOutboxConflicts().length === 1);

    // ---- 8. keep_both duplicates with a fresh client id ------------------
    revisionRow = null;
    const before = c2.payload.p_client_record_id;
    const keptBoth = await resolveOutboxConflict(c2.id, 'keep_both');
    check('keep_both succeeds', keptBoth.ok === true && keptBoth.reason === 'kept_both');
    const requeued = readOutbox()[0];
    check('keep_both re-queues as pending', requeued.status === 'pending');
    check('keep_both uses a fresh client_record_id', requeued.payload.p_client_record_id !== before);
    check('keep_both resets the expected revision', requeued.payload.p_expected_revision === null);

    // ---- 9. no automatic winner is ever chosen ---------------------------
    asCloud(USER_A); reset();
    const c3 = await makeConflict('upsert_workout_log', 'prof_a', { exId: 'x', ts: 4000 });
    await flushOutboxNow();
    await flushOutboxNow();
    check('an unresolved conflict is never auto-resolved', listOutboxConflicts().length === 1);
    check('the conflict is still reported in the summary', outboxStatusSummary().conflict === 1);

    if (failures) { console.log(failures + ' conflict-resolver check(s) failed'); process.exit(1); }
    console.log('PASS: conflict choices are explicit, unsafe choices are hidden, no winner is chosen automatically, and resolutions update the outbox consistently.');
    process.exit(0);
  })().catch(err => { console.error(err); process.exit(1); });
})();
"""


def run() -> c.Contract:
    t = c.Contract("conflict_resolver_ui")

    if not t.require(NODE is not None, "node is available"):
        return t

    blocks = c.storage_outbox_pull_conflict()
    if not t.require(bool(blocks.strip()), "storage + outbox + pull + conflict-UI blocks found"):
        return t

    script = HARNESS.replace("/*__BLOCKS__*/", blocks)

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "conflict_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))
    t.require(proc.returncode == 0, "all behavioural conflict-resolver checks passed")

    # --- static: the resolver is reachable from the UI ---------------------
    ui = c.conflict_ui_block()
    t.require_present(ui, "function openConflictResolver", "resolver opener exists")
    t.require_present(ui, "function renderConflictList", "resolver list renderer exists")
    t.require_present(ui, "function applyConflictChoice", "resolver applies a choice")
    t.require_present(ui, "function describeOutboxConflict", "conflicts are described to the user")

    # The choice policy lives with the resolver, in the outbox block.
    t.require_present(c.outbox_block(), "function outboxConflictChoices", "choices are computed per operation")

    modals = c.read_text(c.ROOT / "tmpl_modals.html")
    if t.require(modals is not None, "tmpl_modals.html exists"):
        t.require_present(modals, "conflictResolverModal", "resolver modal exists in the UI")
        t.require_present(modals, "conflictListBox", "resolver list element exists")
        t.require_present(modals, "openConflictResolver()", "resolver is reachable from the UI")

    return t


if __name__ == "__main__":
    c.main(run)
