"""Body measurements must reach the second device.

PROVEN PRODUCTION DEFECT (body analysis existed on the PC, nothing on the phone):

RC-1 (option A - never enqueued): saveProfileBodyMetrics() persisted locally and
     enqueued NOTHING. The only enqueue site was saveBodyMetricRecord() (the UI
     add/edit button), so every other writer of the metrics store never uploaded:
     most importantly restoreEncryptedVaultForUser(), which is what the profile
     UNLOCK flow (confirmProfilePin -> 'gym' / 'inci') and the offline login use to
     load the private body-analysis records. Probe: 2 records persisted, outbox
     empty, 0 cloud rows.

RC-2 (option E - no reliable profile association): mergeCloudMetric() required
     profile_key, client_record_id AND metric_record, so legacy body_metrics rows
     written before the account-scoped migration (profile_key IS NULL,
     client_record_id IS NULL) were silently discarded on every pull.

RC-3: deleting a measurement never told the cloud (no enqueueMetricTombstone), so
     a deleted record was re-pulled and resurrected on every device.

FIXES
  * pullFromCloudNow() backfills locally-persisted measurements through the
    existing outbox -> allowlisted RPC path, gated on the account actually owning
    the profile (the RPC enforces owns_active_profile server-side, so an op that
    cannot succeed is never created). A bucket whose own key is not owned is
    uploaded under the first owned key of the SAME app-level family that
    getProfileBodyMetrics()/saveProfileBodyMetrics() already treat as one person.
  * A legacy NULL-profile cloud row is adopted ONLY when the account has exactly
    ONE live cloud profile - then the association is unambiguous. With two or more
    it is left alone and counted, never guessed.
  * deleteBodyMetricRecord() now enqueues tombstone_body_metric, and only when the
    record's cloud revision is known, so no spurious CAS conflict is created.
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
  let activeProfileId = 'template_male';
  let allProfiles = [];
  let customExercises = [];
  let masterExerciseOverrides = {};
  let supabaseClient = null;
  function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || ''); }
  function showToast() {}
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
  function ownsProfile(profileKey) {
    return server.user_routines.some(function (r) {
      return r.user_id === AUTH && r.profile_key === profileKey && !r.deleted_at;
    });
  }
  function makeClient() {
    return {
      auth: { getSession: async function () {
        return { data: { session: currentAuthUser ? { user: { id: currentAuthUser.id } } : null }, error: null };
      } },
      from: function (t) { return { select: function () { return makeQuery(t, []); } }; },
      rpc: async function (kind, payload) {
        rpcCalls.push({ kind: kind, payload: JSON.parse(JSON.stringify(payload || {})) });
        const table = KIND_TABLE[kind];
        const key = rowKeyOf(kind, payload);
        // The real RPCs enforce owns_active_profile server-side.
        if (kind === 'upsert_body_metric') {
          if (!payload.p_profile_key || !/^[a-z0-9_]{1,64}$/.test(payload.p_profile_key)) {
            return { data: null, error: { message: 'invalid profile key' } };
          }
          if (!ownsProfile(payload.p_profile_key)) {
            return { data: null, error: { message: 'profile not owned' } };
          }
        }
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
          if (isTomb) { row.deleted_at = 'now'; return { data: row.revision, error: null }; }
          if (payload.p_metric_record) row.metric_record = payload.p_metric_record;
          if (payload.p_profile_key) row.profile_key = payload.p_profile_key;
          return { data: row.revision, error: null };
        }
        if (isTomb) return { data: null, error: null };
        const fresh = { user_id: currentAuthUser.id, revision: 1, deleted_at: null };
        if (kind.indexOf('routine') >= 0) {
          fresh.profile_key = key;
          fresh.routine_data = payload.p_routine_data || null;
          fresh.profile_data = payload.p_profile_data || null;
        } else if (kind === 'upsert_body_metric') {
          fresh.client_record_id = key; fresh.profile_key = payload.p_profile_key;
          fresh.metric_record = payload.p_metric_record;
        } else if (kind === 'upsert_workout_log') {
          fresh.client_record_id = key; fresh.profile_key = payload.p_profile_key;
          fresh.log_entry = payload.p_log_entry;
        } else if (kind === 'upsert_set_state') {
          fresh.profile_key = payload.p_profile_key; fresh.week_key = payload.p_week_key;
          fresh.state_data = payload.p_state_data;
        } else if (kind.indexOf('custom_exercise') >= 0) {
          const d = Object.assign({}, payload.p_exercise_data || {}); delete d.ownerId;
          fresh.client_record_id = key; fresh.exercise_data = d;
        } else { fresh.client_record_id = key; }
        server[table].push(fresh);
        return { data: 1, error: null };
      }
    };
  }

/*__BLOCKS__*/

/*__FNS__*/

  scheduleOutboxFlush = function () {};

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }

  function resetWorld() {
    Object.keys(localStorage).forEach(function (k) { delete localStorage[k]; });
    TABLES.forEach(function (t) { server[t] = []; });
    rpcCalls.length = 0;
    currentAuthUser = { id: AUTH, email: 'user@example.com' }; currentLocalUser = null;
    activeProfileId = 'template_male';
    allProfiles = [{ id: 'template_male', name: 'TM', days: [] }];
    customExercises = []; masterExerciseOverrides = {};
    lastAppliedScope = null; cloudSyncLastUserId = null;
    outboxFlushInFlight = false; outboxLastFlushResult = null; outboxFlushCompletedSeq = 0;
    supabaseClient = makeClient();
  }
  function addCloudRoutine(profileKey) {
    server.user_routines.push({ user_id: AUTH, profile_key: profileKey, revision: 1,
                                deleted_at: null, routine_data: { days: [] } });
  }
  // The exact record shape the UI builds.
  function metric(id, ts, weight) {
    return { id: id, timestamp: ts, date: '1405/07/18', time: '10:00', condition: 'normal',
             gender: 'male', weight: weight, height: 180, waist: 90, abdomen: 95,
             bodyFatManual: 18, notes: 'n' };
  }
  function idsIn(profKey) {
    return (scopedGetJSON('metrics', profKey, []) || []).map(function (m) { return m.id; });
  }
  function outboxKinds() { return readOutbox().map(function (o) { return o.kind; }); }
  function cloudMetricIds() {
    return server.body_metrics.filter(function (r) { return !r.deleted_at; })
      .map(function (r) { return r.metric_record && r.metric_record.id; });
  }

  (async function () {
    // =====================================================================
    // 1. PC (UI) -> Cloud -> Phone, and repeated sync is not duplicating
    // =====================================================================
    resetWorld(); addCloudRoutine('template_male');
    const uiRec = metric('m_ui', 1000, 80);
    const uiList = getProfileBodyMetrics('template_male');
    uiList.push(uiRec);
    saveProfileBodyMetrics('template_male', uiList);
    enqueueMetricUpsert('template_male', uiRec);            // what saveBodyMetricRecord does
    await flushOutboxNow();
    check('PC UI record reached the cloud', cloudMetricIds().indexOf('m_ui') >= 0);
    check('PC UI record kept its profile key',
      server.body_metrics[0].profile_key === 'template_male');

    // ---- phone ----
    Object.keys(localStorage).forEach(function (k) { delete localStorage[k]; });
    lastAppliedScope = null; cloudSyncLastUserId = null; activeProfileId = 'template_male';
    allProfiles = [{ id: 'template_male', name: 'TM', days: [] }];
    await pullFromCloudNow();
    check('phone sees the UI record', idsIn('template_male').indexOf('m_ui') >= 0);
    const phoneRec = getProfileBodyMetrics('template_male').find(function (m) { return m.id === 'm_ui'; });
    check('phone preserves the timestamp', !!phoneRec && phoneRec.timestamp === 1000);
    check('phone preserves the values', !!phoneRec && phoneRec.weight === 80 && phoneRec.waist === 90);
    await pullFromCloudNow(); await pullFromCloudNow();
    check('repeated sync does not duplicate the record',
      idsIn('template_male').filter(function (i) { return i === 'm_ui'; }).length === 1);
    check('repeated sync does not duplicate the cloud row', server.body_metrics.length === 1);

    // =====================================================================
    // 2. RC-1: records persisted by the vault / legacy writers are uploaded
    // =====================================================================
    resetWorld(); addCloudRoutine('template_male');
    const vault = getProfileBodyMetrics('template_male');
    vault.push(metric('m_v1', 2000, 81));
    vault.push(metric('m_v2', 2100, 82));
    saveProfileBodyMetrics('template_male', vault);          // vault / legacy writer: no enqueue
    check('RC-1 reproduced: the vault writer enqueues nothing', readOutbox().length === 0);
    check('RC-1 reproduced: the cloud has nothing', server.body_metrics.length === 0);

    const pullA = await pullFromCloudNow();
    check('the pull backfills the locally-persisted measurements',
      pullA.stats.metricsQueued === 2);
    check('the backfill uses the allowlisted metric RPC',
      outboxKinds().every(function (k) { return k === 'upsert_body_metric'; }));
    await flushOutboxNow();
    check('both vault records reached the cloud', cloudMetricIds().sort().join(',') === 'm_v1,m_v2');

    // ---- the phone ----
    Object.keys(localStorage).forEach(function (k) { delete localStorage[k]; });
    lastAppliedScope = null; cloudSyncLastUserId = null; activeProfileId = 'template_male';
    allProfiles = [{ id: 'template_male', name: 'TM', days: [] }];
    await pullFromCloudNow();
    check('PHONE: the vault records now appear', idsIn('template_male').sort().join(',') === 'm_v1,m_v2');
    check('PHONE: timestamps preserved',
      getProfileBodyMetrics('template_male').every(function (m) { return m.timestamp >= 2000; }));
    const before = JSON.stringify(idsIn('template_male').sort());
    await pullFromCloudNow(); await flushOutboxNow(); await pullFromCloudNow();
    check('no duplicate on repeated sync', JSON.stringify(idsIn('template_male').sort()) === before);
    check('no duplicate cloud row on repeated sync', server.body_metrics.length === 2);
    check('the backfill is idempotent (nothing left queued)',
      !readOutbox().some(function (o) { return o.kind === 'upsert_body_metric'; }));

    // =====================================================================
    // 3. the ownership gate: never create an op the server would reject
    // =====================================================================
    resetWorld(); addCloudRoutine('hossein_chieftain');
    const male = getProfileBodyMetrics('template_male');
    male.push(metric('m_fam', 3000, 84));
    saveProfileBodyMetrics('template_male', male);           // template_male is NOT owned in the cloud
    const pullB = await pullFromCloudNow();
    check('a bucket in an owned family is uploaded under the owned key',
      pullB.stats.metricsQueued === 1 && readOutbox().length === 1);
    await flushOutboxNow();
    check('the family fallback used the owned profile key',
      server.body_metrics.length === 1 && server.body_metrics[0].profile_key === 'hossein_chieftain');
    check('no RPC was rejected (no failing op, queue not stalled)',
      rpcCalls.every(function (c) { return !c.error; }) && readOutbox().length === 0);

    resetWorld(); addCloudRoutine('template_male');
    const orphan = getProfileBodyMetrics('prof_orphan');
    orphan.push(metric('m_orphan', 3100, 85));
    saveProfileBodyMetrics('prof_orphan', orphan);
    const pullC = await pullFromCloudNow();
    check('a bucket with no owned profile is NOT uploaded (never a guess)',
      pullC.stats.metricsQueued === undefined && readOutbox().length === 0);
    check('it is counted as unassigned instead', pullC.stats.metricsUnassigned === 1);
    await flushOutboxNow();
    check('nothing was written to the cloud for the orphan bucket', server.body_metrics.length === 0);

    // =====================================================================
    // 4. RC-2: legacy NULL-profile cloud rows
    // =====================================================================
    resetWorld(); addCloudRoutine('hossein_chieftain');
    server.body_metrics.push({ user_id: AUTH, client_record_id: null, profile_key: null,
                               revision: 1, deleted_at: null,
                               metric_record: metric('m_legacy', 4000, 86) });
    const pullD = await pullFromCloudNow();
    check('legacy row: adopted when the account has exactly ONE live profile',
      idsIn('hossein_chieftain').indexOf('m_legacy') >= 0);
    check('legacy row: the merge is reported', pullD.stats.metrics === 1);
    check('legacy row: adopted once, not duplicated',
      idsIn('hossein_chieftain').filter(function (i) { return i === 'm_legacy'; }).length === 1);
    await pullFromCloudNow();
    check('legacy row: repeated pull does not duplicate it',
      idsIn('hossein_chieftain').filter(function (i) { return i === 'm_legacy'; }).length === 1);
    check('legacy row: nothing was re-uploaded for it',
      !readOutbox().some(function (o) { return o.kind === 'upsert_body_metric'; }));
    check('legacy row: the cloud row was NOT modified',
      server.body_metrics[0].client_record_id === null && server.body_metrics[0].profile_key === null);

    // ---- deleting an adopted legacy row must not resurrect it ----
    resetWorld(); addCloudRoutine('hossein_chieftain');
    server.body_metrics.push({ user_id: AUTH, client_record_id: null, profile_key: null,
                               revision: 1, deleted_at: null,
                               metric_record: metric('m_legacy_del', 4200, 88) });
    await pullFromCloudNow();
    check('the legacy row was adopted before deletion',
      idsIn('hossein_chieftain').indexOf('m_legacy_del') >= 0);
    // the user deletes it; the cloud row has no client_record_id to tombstone
    const delList2 = getProfileBodyMetrics('hossein_chieftain')
      .filter(function (m) { return m.id !== 'm_legacy_del'; });
    saveProfileBodyMetrics('hossein_chieftain', delList2);
    check('no tombstone can be queued for a legacy row',
      enqueueMetricTombstone('hossein_chieftain', 'm_legacy_del') === null);
    rememberLocallyDeletedMetric('m_legacy_del');
    await pullFromCloudNow();
    check('a deleted legacy row is NOT adopted back',
      idsIn('hossein_chieftain').indexOf('m_legacy_del') < 0);

    resetWorld(); addCloudRoutine('hossein_chieftain'); addCloudRoutine('prof_other');
    server.body_metrics.push({ user_id: AUTH, client_record_id: null, profile_key: null,
                               revision: 1, deleted_at: null,
                               metric_record: metric('m_ambiguous', 4100, 87) });
    await pullFromCloudNow();
    check('legacy row: NOT assigned when the account has several profiles',
      idsIn('hossein_chieftain').indexOf('m_ambiguous') < 0 &&
      idsIn('prof_other').indexOf('m_ambiguous') < 0 &&
      idsIn('template_male').indexOf('m_ambiguous') < 0);

    // =====================================================================
    // 5. RC-3: deleting a measurement tombstones it
    // =====================================================================
    resetWorld(); addCloudRoutine('template_male');
    const delRec = metric('m_del', 5000, 88);
    const delList = getProfileBodyMetrics('template_male');
    delList.push(delRec);
    saveProfileBodyMetrics('template_male', delList);
    enqueueMetricUpsert('template_male', delRec);
    await flushOutboxNow();
    check('the record to delete is in the cloud', cloudMetricIds().indexOf('m_del') >= 0);

    const tomb = enqueueMetricTombstone('template_male', 'm_del');
    check('deleting a synced record queues a tombstone', !!tomb && tomb.kind === 'tombstone_body_metric');
    check('the tombstone carries the known CAS revision',
      !!tomb && typeof tomb.expectedRevision === 'number' && tomb.expectedRevision === 1);
    await flushOutboxNow();
    check('the cloud row is soft-deleted, not hard-deleted',
      server.body_metrics.length === 1 && server.body_metrics[0].deleted_at !== null);
    check('the tombstone left the queue', !readOutbox().some(function (o) { return o.kind === 'tombstone_body_metric'; }));

    const ghost = enqueueMetricTombstone('template_male', 'never_uploaded');
    check('a never-uploaded record produces NO tombstone (no spurious conflict)', ghost === null);

    // ---- the phone must not resurrect the deleted record ----
    Object.keys(localStorage).forEach(function (k) { delete localStorage[k]; });
    lastAppliedScope = null; cloudSyncLastUserId = null; activeProfileId = 'template_male';
    allProfiles = [{ id: 'template_male', name: 'TM', days: [] }];
    await pullFromCloudNow();
    check('PHONE: the deleted record does not come back', idsIn('template_male').indexOf('m_del') < 0);

    // =====================================================================
    // 6. account isolation
    // =====================================================================
    resetWorld(); addCloudRoutine('template_male');
    const iso = getProfileBodyMetrics('template_male');
    iso.push(metric('m_iso', 6000, 89));
    saveProfileBodyMetrics('template_male', iso);
    await pullFromCloudNow(); await flushOutboxNow();
    const keyA = 'chieftain_v10:uuid:' + AUTH + ':metrics:template_male';
    check('account A owns its own metrics bucket', (localStorage.getItem(keyA) || '').indexOf('m_iso') >= 0);
    check('every cloud row belongs to the authenticated UUID',
      server.body_metrics.every(function (r) { return r.user_id === AUTH; }));

    if (failures) { console.log(failures + ' body-metrics check(s) failed'); process.exit(1); }
    console.log('PASS: body measurements round-trip PC -> cloud -> phone, locally-persisted (vault/legacy) records are backfilled through the allowlisted RPC, legacy NULL-profile rows are adopted only when unambiguous, deletion tombstones correctly and nothing is ever duplicated or uploaded for an unowned profile.');
    process.exit(0);
  })().catch(function (e) { console.error(e); process.exit(1); });
})();
"""


def run() -> c.Contract:
    t = c.Contract("body_metrics_sync")

    blocks = c.storage_outbox_pull_conflict()
    if not t.require(bool(blocks.strip()), "storage + outbox + pull + conflict UI blocks found"):
        return t

    js = c.read_text(c.APP_JS_PATH) or ""
    live = c.strip_js_comments(js)

    # --- the backfill exists and is wired into the pull ---------------------
    back = c.function_body(live, "backfillMissingBodyMetrics")
    if t.require(bool(back), "backfillMissingBodyMetrics is defined"):
        t.require_present(back, "enqueueMetricUpsert",
                          "the backfill goes through the allowlisted metric RPC")
        t.require_present(back, "metricProfileUploadKey",
                          "the backfill is gated on an owned profile")
        t.require_present(back, "knownClientIds", "records the cloud already has are skipped")
        t.require_present(back, "outboxHasUnresolvedFor", "already-queued records are not queued twice")
        t.require_absent(back, ".rpc(", "the backfill never calls an RPC directly")
        t.require_absent(back, ".from(", "the backfill never touches a table directly")

    pull_fn = c.function_body(live, "pullFromCloudNow")
    if t.require(bool(pull_fn), "pullFromCloudNow is defined"):
        t.require_present(pull_fn, "backfillMissingBodyMetrics", "the pull runs the metric backfill")
        t.require_present(pull_fn, "fallbackMetricProfileKey",
                          "a legacy row is adopted only through an unambiguous fallback")

    # --- legacy adoption is strictly conditional ----------------------------
    merge_fn = c.function_body(live, "mergeCloudMetric")
    if t.require(bool(merge_fn), "mergeCloudMetric is defined"):
        t.require_present(merge_fn, "fallbackProfileKey",
                          "the merge accepts an explicit fallback profile")
        t.require_absent(merge_fn, "'template_male'", "the merge never hard-codes a profile")
    if t.require(bool(pull_fn), "pullFromCloudNow is defined"):
        t.require_present(pull_fn, "liveCloudProfileKeys.length === 1",
                          "the fallback is used only when exactly one live profile exists")

    # --- deletion tombstones ------------------------------------------------
    tomb = c.function_body(live, "enqueueMetricTombstone")
    if t.require(bool(tomb), "enqueueMetricTombstone is defined"):
        t.require_present(tomb, "tombstone_body_metric", "the allowlisted tombstone RPC is used")
        t.require_present(tomb, "knownRevisionFor",
                          "a tombstone is only queued when the CAS revision is known")
    del_fn = c.function_body(live, "deleteBodyMetricRecord")
    if t.require(bool(del_fn), "deleteBodyMetricRecord is defined"):
        t.require_present(del_fn, "enqueueMetricTombstone", "deleting a record tells the cloud")
        t.require_present(del_fn, "rememberLocallyDeletedMetric",
                          "a deletion the cloud cannot address is remembered locally")

    # --- invariants: no direct table access, architecture untouched ---------
    t.require_absent(live, ".from('body_metrics')", "no direct body_metrics table access")
    t.require_present(live, "'upsert_body_metric', 'update_body_metric', 'tombstone_body_metric'",
                      "the metric RPC allowlist is unchanged")
    t.require(re.search(r"CLOUD_SYNC_GATE\.contractVerified\s*=(?!=)", live) is None,
              "the gate is never assigned at runtime")
    t.require_present(live, ".from('profiles')", "the admin-auth profiles access is preserved")
    t.require_present(live, "function saveProfileBodyMetrics",
                      "the local save path is preserved")

    # --- behavioural --------------------------------------------------------
    if not t.require(NODE is not None, "node is available"):
        return t

    fns = []
    ident = c.function_body(live, "getAuthenticatedSupabaseUserId")
    if ident:
        fns.append("async " + ident if "async function getAuthenticatedSupabaseUserId(" in live else ident)
    for name in ("getProfileBodyMetrics", "saveProfileBodyMetrics"):
        body = c.function_body(live, name)
        if body:
            fns.append(body)

    script = HARNESS.replace("/*__BLOCKS__*/", blocks).replace("/*__FNS__*/", "\n".join(fns))
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "body_metrics_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))
    t.require(proc.returncode == 0, "all body-metrics behavioural checks passed")

    return t


if __name__ == "__main__":
    c.main(run)
