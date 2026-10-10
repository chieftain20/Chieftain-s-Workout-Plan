"""The legacy import must be identity-scoped, and must upload only what it selected.

PROVEN PRODUCTION DEFECT:

    A legacy profile belonging to a DIFFERENT local identity ("hossein_chieftain")
    ended up in Morvarid's new cloud account and appeared in her profile list.

Root cause (proved by replaying the real startup sequence + the real import):

  * runLegacyImport() copied EVERY profile from chieftain_profiles_v* into the
    current scope with NO identity predicate at all;
  * it uploaded nothing itself, so the next blanket saveProfiles() - any real edit,
    or quickCloudSyncAction() which calls saveProfiles() first - ran
    enqueueRoutineUpsert() for every profile, and the freshly copied foreign profile
    had no recorded fingerprint, so it was queued and uploaded into HER account;
  * from then on every device signing in pulled it (mergeCloudRoutine) and
    persisted it, so it was self-perpetuating.

FIX A - a legacy profile (and every per-profile data key) is classified before it is
        touched: 'own'/'user' are imported, 'template' never is, and 'foreign' only
        with an explicit opt-in (opts.includeIdentityProfiles).
FIX B - the confirmed import uploads EXACTLY the records it selected, through the
        existing outbox -> allowlisted RPC path, instead of relying on a later
        blanket saveProfiles().
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
  function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || ''); }
  function showToast() {}
  function confirm() { return true; }
  function renderApp() {}
  function updateConflictBadge() {}
  function isAutoCloudSyncEnabled() { return true; }
  function isAdminUnlocked() { return false; }
  async function pushToCloudStorage() { scheduleOutboxFlush(); return true; }
  const TEMPLATE_MALE_PROFILE = { id: 'template_male', name: 'TM', days: [] };
  const TEMPLATE_FEMALE_PROFILE = { id: 'template_female', name: 'TF', days: [] };
  const MASTER_EXERCISES = [];

  // The real saveProfiles(): persists AND queues every profile. This is the call
  // that used to transport a foreign profile into the account.
  function saveProfiles() {
    scopedSetJSON('profiles', null, allProfiles);
    if (typeof enqueueRoutineUpsert === 'function' && Array.isArray(allProfiles)) {
      allProfiles.forEach(function (p) { if (p && p.id) enqueueRoutineUpsert(p); });
    }
  }

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
  const AUTH_M = '00000000-0000-4000-c000-0000000000aa';
  const AUTH_H = '00000000-0000-4000-c000-0000000000bb';
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

  supabaseClient = makeClient();
  scheduleOutboxFlush = function () {};

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }

  // ---- a device that holds EVERY identity's legacy data --------------------
  const LEGACY = {
    'chieftain_profiles_v9': JSON.stringify([
      { id: 'prof_alpha', name: 'Alpha', days: [{ id: 'a1' }] },
      { id: 'morvarid', name: 'مروارید', days: [{ id: 'm1' }] },
      { id: 'user_morvarid', name: 'Morvarid (offline)', days: [] },
      { id: 'hossein_chieftain', name: 'Hossein Chieftain', days: [{ id: 'h1' }] },
      { id: 'admin_hossein', name: 'Hossein (offline)', days: [{ id: 'h2' }] },
      { id: 'template_male', name: "Men's Sample Plan", days: [] },
      { id: 'template_female', name: "Women's Sample Plan", days: [] }
    ]),
    'chieftain_active_profile_id': 'prof_alpha',
    'chieftain_logs_prof_alpha_leg_curl': JSON.stringify([{ timestamp: 1000 }, { timestamp: 2000 }]),
    'chieftain_logs_hossein_chieftain_squat': JSON.stringify([{ timestamp: 7000 }]),
    'chieftain_metrics_prof_alpha': JSON.stringify([{ id: 'm_1', timestamp: 3000 }]),
    'chieftain_metrics_hossein_chieftain': JSON.stringify([{ id: 'hm_1', timestamp: 8000 }]),
    'chieftain_sets_prof_alpha': JSON.stringify({ weekKey: 'IR_WEEK_1', updatedAt: 5, sets: { leg_curl: [true] } }),
    'chieftain_sets_hossein_chieftain': JSON.stringify({ weekKey: 'IR_WEEK_H', updatedAt: 5, sets: { squat: [true] } }),
    'chieftain_draft_log_prof_alpha_leg_curl': JSON.stringify({ timestamp: 4000 }),
    'chieftain_draft_log_hossein_chieftain_squat': JSON.stringify({ timestamp: 9000 }),
    'chieftain_custom_exercises': JSON.stringify([
      { id: 'cust_mine', fa: 'مال من', ownerId: 'user_morvarid' },
      { id: 'cust_his', fa: 'مال حسین', ownerId: 'admin_hossein' }
    ])
  };
  const LEGACY_KEYS = Object.keys(LEGACY);

  function resetWorld() {
    Object.keys(localStorage).forEach(function (k) { delete localStorage[k]; });
    TABLES.forEach(function (t) { server[t] = []; });
    rpcCalls.length = 0;
    currentAuthUser = null; currentLocalUser = null;
    activeProfileId = 'template_male';
    allProfiles = []; customExercises = []; masterExerciseOverrides = {};
    lastAppliedScope = null; cloudSyncLastUserId = null;
    outboxFlushInFlight = false; outboxLastFlushResult = null; outboxFlushCompletedSeq = 0;
    supabaseClient = makeClient();
    LEGACY_KEYS.forEach(function (k) { localStorage[k] = LEGACY[k]; });
  }
  function legacySnapshot() { return LEGACY_KEYS.map(function (k) { return k + '=' + localStorage[k]; }).join('\u0001'); }
  function asCloud(uuid, email) { currentAuthUser = { id: uuid, email: email }; currentLocalUser = null; }
  function asLocal(id) { currentAuthUser = null; currentLocalUser = { id: id }; }
  function profileIds() { return allProfiles.map(function (p) { return p.id; }); }
  function cloudRoutineKeys() { return server.user_routines.map(function (r) { return r.profile_key; }); }
  function cloudText() { return JSON.stringify(server); }
  function outboxRowKeys() { return readOutbox().map(function (o) { return o.rowKey; }); }
  function scopeSubKeys(name) { return scopedSubKeys(name); }
  // Model what startup does: loadAppData() then adoptLoadedProfiles(). Without the
  // baseline the templates would look like unsynced edits.
  function seedAccountProfiles(list) {
    allProfiles = list.map(function (p) {
      return Object.assign({ id: p.id, name: p.name || p.id, days: p.days || [] }, p);
    });
    if (typeof adoptLoadedProfiles === 'function') adoptLoadedProfiles();
  }

  (async function () {
    // =====================================================================
    // 1. classification is read-only and correct
    // =====================================================================
    resetWorld();
    const before = legacySnapshot();
    asCloud(AUTH_M, 'movahedi.mov@gmail.com');
    const preview = discoverLegacyData();
    check('discovery is read-only', legacySnapshot() === before);
    const byId = {};
    (preview.profileClasses || []).forEach(function (c) { byId[c.id] = c.kind; });
    check('classification: user-created profile is "user"', byId['prof_alpha'] === 'user');
    check('classification: app templates are "template"',
      byId['template_male'] === 'template' && byId['template_female'] === 'template');
    check('classification: a cloud account owns no legacy identity',
      byId['morvarid'] === 'foreign' && byId['user_morvarid'] === 'foreign' &&
      byId['hossein_chieftain'] === 'foreign' && byId['admin_hossein'] === 'foreign');
    check('classification: the foreign profiles are listed for the confirmation',
      (preview.foreignProfiles || []).length === 4);
    check('classification: foreign entries name their identity',
      (preview.foreignProfiles || []).every(function (f) { return !!f.identity; }));

    asLocal('admin_hossein');
    check('classification: the owning offline identity claims its own profiles',
      classifyLegacyProfileId('hossein_chieftain') === 'own' &&
      classifyLegacyProfileId('admin_hossein') === 'own');
    check('classification: the owning identity still does not claim another identity',
      classifyLegacyProfileId('morvarid') === 'foreign' &&
      classifyLegacyProfileId('user_morvarid') === 'foreign');
    asLocal('user_morvarid');
    check('classification: Morvarid offline claims her own ids',
      classifyLegacyProfileId('morvarid') === 'own' &&
      classifyLegacyProfileId('user_morvarid') === 'own');
    check('classification: Morvarid offline never claims Hossein',
      classifyLegacyProfileId('hossein_chieftain') === 'foreign' &&
      classifyLegacyProfileId('admin_hossein') === 'foreign');

    // =====================================================================
    // 2. FIX A: Morvarid's CLOUD account cannot import Hossein (default: nothing)
    // =====================================================================
    resetWorld();
    asCloud(AUTH_M, 'movahedi.mov@gmail.com');
    seedAccountProfiles([
      { id: 'template_male', name: 'TM' },
      { id: 'template_female', name: 'TF' }
    ]);
    const res = await runLegacyImport({ confirmed: true });
    console.log('  Morvarid cloud (default):', JSON.stringify({
      imported: res.imported, skipped: res.skipped, queued: res.queued,
      profiles: res.importedProfiles,
      foreign: res.details.foreignProfiles.map(function (f) { return f.id; })
    }));

    check('Morvarid: NO identity-owned profile is imported by default',
      res.importedProfiles.indexOf('hossein_chieftain') < 0 &&
      res.importedProfiles.indexOf('admin_hossein') < 0 &&
      res.importedProfiles.indexOf('morvarid') < 0 &&
      res.importedProfiles.indexOf('user_morvarid') < 0);
    check('Morvarid: only the user-created profile is imported',
      res.importedProfiles.join(',') === 'prof_alpha');
    check('Morvarid: the app templates are NOT imported',
      res.importedProfiles.indexOf('template_male') < 0 &&
      res.importedProfiles.indexOf('template_female') < 0);
    check('Morvarid: all four foreign profiles are reported',
      res.details.foreignProfiles.map(function (f) { return f.id; }).sort().join(',') ===
      'admin_hossein,hossein_chieftain,morvarid,user_morvarid'.split(',').sort().join(','));

    check('Morvarid: his logs are not imported', scopeSubKeys('logs').join(',').indexOf('hossein') < 0);
    check('Morvarid: his metrics are not imported', scopeSubKeys('metrics').join(',').indexOf('hossein') < 0);
    check('Morvarid: his set states are not imported', scopeSubKeys('sets').join(',').indexOf('hossein') < 0);
    check('Morvarid: his draft is not imported', scopeSubKeys('draft').join(',').indexOf('hossein') < 0);
    check('Morvarid: his custom exercise is not imported',
      !customExercises.some(function (e) { return e.id === 'cust_his'; }));
    check('Morvarid: the user-created profile data IS imported',
      scopeSubKeys('logs').indexOf('prof_alpha:leg_curl') >= 0 &&
      scopeSubKeys('metrics').indexOf('prof_alpha') >= 0 &&
      scopeSubKeys('sets').indexOf('prof_alpha') >= 0 &&
      scopeSubKeys('draft').indexOf('prof_alpha:leg_curl') >= 0);

    // ---- FIX B: the outbox carries ONLY what was imported ----
    const keys = outboxRowKeys();
    check('FIX B: the import queued exactly the selected records',
      res.queued === keys.length && res.queued > 0);
    check('FIX B: nothing in the outbox names a foreign identity',
      keys.join(',').indexOf('hossein') < 0);
    check('FIX B: the routine op is exactly the imported profile',
      readOutbox().filter(function (o) { return o.kind === 'upsert_routine'; })
        .map(function (o) { return o.rowKey; }).join(',') === 'prof_alpha');
    check('FIX B: one op per imported log/metric/set',
      readOutbox().filter(function (o) { return o.kind === 'upsert_workout_log'; }).length === 2 &&
      readOutbox().filter(function (o) { return o.kind === 'upsert_body_metric'; }).length === 1 &&
      readOutbox().filter(function (o) { return o.kind === 'upsert_set_state'; }).length === 1);
    await flushOutboxNow();
    console.log('  cloud routines:', JSON.stringify(cloudRoutineKeys()));
    check('CLOUD: only the user-created profile reached the account',
      cloudRoutineKeys().join(',') === 'prof_alpha');
    check('CLOUD: no hossein_chieftain routine exists in her account',
      cloudRoutineKeys().indexOf('hossein_chieftain') < 0);
    check('CLOUD: no admin_hossein routine exists in her account',
      cloudRoutineKeys().indexOf('admin_hossein') < 0);
    check('CLOUD: no male template routine was created',
      cloudRoutineKeys().indexOf('template_male') < 0);
    check('CLOUD: no foreign profile or data reached her account',
      cloudText().indexOf('hossein_chieftain') < 0 && cloudText().indexOf('admin_hossein') < 0);
    check('CLOUD: every row belongs to her authenticated UUID',
      TABLES.every(function (t) {
        return server[t].every(function (r) { return r.user_id === AUTH_M; });
      }));

    // ---- the old leak path is closed: a later blanket saveProfiles() ----
    saveProfiles();
    await flushOutboxNow();
    check('LEAK CLOSED: a later saveProfiles() cannot upload a foreign profile',
      cloudRoutineKeys().indexOf('hossein_chieftain') < 0 &&
      cloudRoutineKeys().indexOf('admin_hossein') < 0 &&
      cloudRoutineKeys().indexOf('morvarid') < 0);
    check('LEAK CLOSED: a later saveProfiles() adds no new routine row',
      cloudRoutineKeys().join(',') === 'prof_alpha');

    check('SOURCE UNTOUCHED after the cloud import', legacySnapshot() === before);

    // =====================================================================
    // 3. per-identity opt-in: allowing HER identity never pulls in HIS
    // =====================================================================
    resetWorld();
    asCloud(AUTH_M, 'movahedi.mov@gmail.com');
    seedAccountProfiles([
      { id: 'template_male', name: 'TM' },
      { id: 'template_female', name: 'TF' }
    ]);
    const opt = await runLegacyImport({ confirmed: true, includeIdentityIds: ['user_morvarid'] });
    console.log('  Morvarid cloud (opt-in user_morvarid):', JSON.stringify({
      profiles: opt.importedProfiles, queued: opt.queued
    }));
    check('opt-in: allowing user_morvarid imports her own profile ids',
      opt.importedProfiles.indexOf('morvarid') >= 0 &&
      opt.importedProfiles.indexOf('user_morvarid') >= 0);
    check('opt-in: allowing user_morvarid NEVER imports Hossein',
      opt.importedProfiles.indexOf('hossein_chieftain') < 0 &&
      opt.importedProfiles.indexOf('admin_hossein') < 0);
    check('opt-in: his data families stay out',
      scopeSubKeys('logs').join(',').indexOf('hossein') < 0 &&
      scopeSubKeys('metrics').join(',').indexOf('hossein') < 0 &&
      scopeSubKeys('sets').join(',').indexOf('hossein') < 0);
    check('opt-in: her custom exercise is imported and re-owned by the account',
      customExercises.some(function (e) { return e.id === 'cust_mine' && e.ownerId === AUTH_M; }));
    check('opt-in: his custom exercise is still excluded',
      !customExercises.some(function (e) { return e.id === 'cust_his'; }));
    check('opt-in: Hossein is still reported as not imported',
      opt.details.foreignProfiles.map(function (f) { return f.id; }).sort().join(',') ===
      'admin_hossein,hossein_chieftain');
    await flushOutboxNow();
    check('opt-in: her profile reached her account, his did not',
      cloudRoutineKeys().indexOf('morvarid') >= 0 &&
      cloudRoutineKeys().indexOf('hossein_chieftain') < 0 &&
      cloudRoutineKeys().indexOf('admin_hossein') < 0);
    check('opt-in: the source is untouched', legacySnapshot() === before);

    // =====================================================================
    // 4. idempotency + no overwrite
    // =====================================================================
    const cloudBefore = cloudRoutineKeys().slice().sort().join(',');
    const res2 = await runLegacyImport({ confirmed: true, includeIdentityIds: ['user_morvarid'] });
    check('idempotent: a repeated import imports nothing new', res2.imported === 0);
    check('idempotent: a repeated import queues nothing', res2.queued === 0);
    check('idempotent: no duplicate profile was created',
      profileIds().filter(function (id) { return id === 'morvarid'; }).length === 1);
    check('idempotent: the cloud routine set is unchanged',
      cloudRoutineKeys().slice().sort().join(',') === cloudBefore &&
      cloudBefore.indexOf('hossein_chieftain') < 0 && cloudBefore.indexOf('morvarid') >= 0);

    resetWorld();
    asCloud(AUTH_M, 'movahedi.mov@gmail.com');
    seedAccountProfiles([
      { id: 'template_male', name: 'TM' },
      { id: 'template_female', name: 'TF' },
      { id: 'morvarid', name: 'نام محلی من', days: [{ id: 'LOCAL' }] }
    ]);
    const keep = await runLegacyImport({ confirmed: true, includeIdentityIds: ['user_morvarid'] });
    const kept = allProfiles.find(function (p) { return p.id === 'morvarid'; });
    check('no overwrite: an existing profile is skipped, not replaced',
      kept.name === 'نام محلی من' && kept.days[0].id === 'LOCAL' &&
      keep.importedProfiles.indexOf('morvarid') < 0);

    // =====================================================================
    // 5. Hossein's OFFLINE login keeps working (requirement 3)
    // =====================================================================
    resetWorld();
    asLocal('admin_hossein');
    const hos = await runLegacyImport({ confirmed: true });
    console.log('  Hossein offline import:', JSON.stringify({
      imported: hos.imported, queued: hos.queued, profiles: hos.importedProfiles
    }));
    check('Hossein offline: his own profiles ARE imported without any opt-in',
      hos.importedProfiles.indexOf('hossein_chieftain') >= 0 &&
      hos.importedProfiles.indexOf('admin_hossein') >= 0);
    check('Hossein offline: Morvarid is NOT imported',
      hos.importedProfiles.indexOf('morvarid') < 0 &&
      hos.importedProfiles.indexOf('user_morvarid') < 0);
    check('Hossein offline: his logs/metrics/sets ARE imported',
      scopeSubKeys('logs').indexOf('hossein_chieftain:squat') >= 0 &&
      scopeSubKeys('metrics').indexOf('hossein_chieftain') >= 0 &&
      scopeSubKeys('sets').indexOf('hossein_chieftain') >= 0);
    check('Hossein offline: his custom exercise IS imported',
      customExercises.some(function (e) { return e.id === 'cust_his' && e.ownerId === 'admin_hossein'; }));
    check('Hossein offline: an offline scope uploads nothing (outbox empty)',
      hos.queued === 0 && readOutbox().length === 0);
    check('Hossein offline: the source is untouched', legacySnapshot() === before);

    // =====================================================================
    // 6. Hossein's CLOUD account: safe by default, per-identity opt-in available
    // =====================================================================
    resetWorld();
    asCloud(AUTH_H, 'hossein@example.com');
    seedAccountProfiles([
      { id: 'template_male', name: 'TM' },
      { id: 'template_female', name: 'TF' }
    ]);
    const hc = await runLegacyImport({ confirmed: true });
    check('Hossein cloud (default): a cloud account inherits no identity profile',
      hc.importedProfiles.indexOf('hossein_chieftain') < 0 &&
      hc.importedProfiles.indexOf('admin_hossein') < 0);
    check('Hossein cloud (default): user-created profiles still import',
      hc.importedProfiles.join(',') === 'prof_alpha');
    check('Hossein cloud (default): the foreign profiles are reported',
      hc.details.foreignProfiles.length === 4);

    resetWorld();
    asCloud(AUTH_H, 'hossein@example.com');
    seedAccountProfiles([
      { id: 'template_male', name: 'TM' },
      { id: 'template_female', name: 'TF' }
    ]);
    const hopt = await runLegacyImport({ confirmed: true, includeIdentityIds: ['admin_hossein'] });
    check('Hossein cloud (opt-in): his own profiles import when he says so',
      hopt.importedProfiles.indexOf('hossein_chieftain') >= 0 &&
      hopt.importedProfiles.indexOf('admin_hossein') >= 0);
    check('Hossein cloud (opt-in): they are queued for upload',
      hopt.queued > 0 &&
      readOutbox().some(function (o) { return o.rowKey === 'hossein_chieftain'; }));
    check('Hossein cloud (opt-in): Morvarid is never pulled in',
      hopt.importedProfiles.indexOf('morvarid') < 0 &&
      hopt.importedProfiles.indexOf('user_morvarid') < 0);
    check('Hossein cloud (opt-in): her custom exercise stays out',
      !customExercises.some(function (e) { return e.id === 'cust_mine'; }));
    await flushOutboxNow();
    check('Hossein cloud (opt-in): his routine reached HIS account',
      server.user_routines.every(function (r) { return r.user_id === AUTH_H; }) &&
      server.user_routines.some(function (r) { return r.profile_key === 'hossein_chieftain'; }));

    if (failures) { console.log(failures + ' identity-scope check(s) failed'); process.exit(1); }
    console.log('PASS: the legacy import is identity-scoped, uploads only what it selected, cannot transport a foreign profile or its data, keeps Hossein\'s offline flow intact and never overwrites existing data.');
    process.exit(0);
  })().catch(function (e) { console.error(e); process.exit(1); });
})();
"""


def run() -> c.Contract:
    t = c.Contract("legacy_import_identity_scope")

    block = c.legacy_import_block()
    if not t.require(bool(block.strip()), "LEGACY_IMPORT block found in app_engine.js"):
        return t

    js = c.read_text(c.APP_JS_PATH) or ""
    live = c.strip_js_comments(js)

    # --- FIX A: the identity model is declared and applied ------------------
    t.require_present(block, "LEGACY_IDENTITY_PROFILE_IDS", "the identity -> profile-id map exists")
    t.require_present(block, "admin_hossein: ['admin_hossein', 'hossein_chieftain']",
                      "Hossein's identity owns exactly his two profile ids")
    t.require_present(block, "user_morvarid: ['user_morvarid', 'morvarid']",
                      "Morvarid's identity owns exactly her two profile ids")
    t.require_present(block, "LEGACY_APP_TEMPLATE_IDS", "app templates are declared separately")
    t.require_present(block, "function classifyLegacyProfileId", "the classification predicate exists")
    t.require_present(block, "function currentIdentityProfileIds", "the current identity's ids are derived locally")
    t.require_present(block, "function shouldImportLegacyProfileData",
                      "per-profile data families use the same rule")
    t.require_present(block, "opts.includeIdentityIds", "foreign profiles need an explicit, per-identity opt-in")
    t.require_present(block, "function isLegacyIdentityAllowed",
                      "the opt-in is resolved per identity, never as a blanket switch")
    t.require_present(block, "details.foreignProfiles", "skipped foreign profiles are reported")

    run_fn = c.function_body(live, "runLegacyImport")
    if t.require(bool(run_fn), "runLegacyImport is defined"):
        t.require_present(run_fn, "classifyLegacyProfileId",
                          "the profile loop classifies before copying")
        t.require(run_fn.count("shouldImportLegacyProfileData") >= 4,
                  "every per-profile family is identity-guarded (logs, metrics, sets, drafts)")
        t.require_absent(run_fn, "saveProfiles(",
                         "the import never relies on a blanket saveProfiles()")

    # --- FIX B: the upload is explicit --------------------------------------
    q_fn = c.function_body(live, "queueLegacyImportUploads")
    if t.require(bool(q_fn), "queueLegacyImportUploads is defined"):
        for helper in ("enqueueRoutineUpsert", "enqueueLogUpsert", "enqueueMetricUpsert",
                       "enqueueSetStateUpsert", "enqueueCustomExerciseUpsert"):
            t.require_present(q_fn, helper, f"the explicit upload uses {helper}")
        t.require_absent(q_fn, ".rpc(", "no direct RPC call")
        t.require_absent(q_fn, ".from(", "no direct table access")
    if t.require(bool(run_fn), "runLegacyImport is defined"):
        t.require_present(run_fn, "queueLegacyImportUploads",
                          "the confirmed import uploads exactly what it selected")

    # --- discovery is still READ ONLY ---------------------------------------
    t.require_absent(block, "localStorage.setItem", "the import block never writes local storage directly")
    t.require_absent(block, "localStorage.removeItem", "the import block never removes a key")
    t.require_absent(block, "localStorage.clear", "the import block never clears storage")

    # --- never automatic ----------------------------------------------------
    callers = re.findall(r"(?<!function )runLegacyImport\s*\(", js)
    t.require(len(callers) == 1, f"runLegacyImport has exactly one call site (found {len(callers)})")
    outside = c.js_outside("legacy_import")
    t.require_absent(outside, "runLegacyImport", "nothing outside the block triggers an import")

    # --- sync / CAS / outbox / Admin Auth architecture untouched ------------
    t.require(re.search(r"CLOUD_SYNC_GATE\.contractVerified\s*=(?!=)", live) is None,
              "the gate is never assigned at runtime")
    t.require_present(live, "'upsert_custom_exercise', 'tombstone_custom_exercise'",
                      "the RPC allowlist is unchanged")
    t.require_present(live, "outboxRpcPayload", "the CAS payload builder is unchanged")
    t.require_present(live, ".from('profiles')", "the admin-auth profiles access is preserved")

    # --- behavioural --------------------------------------------------------
    if not t.require(NODE is not None, "node is available"):
        return t

    blocks = c.storage_outbox_pull_conflict() + "\n" + block
    if not t.require(bool(blocks.strip()), "all required blocks found"):
        return t

    fns = []
    ident = c.function_body(live, "getAuthenticatedSupabaseUserId")
    if ident:
        fns.append("async " + ident if "async function getAuthenticatedSupabaseUserId(" in live else ident)
    adopt = c.function_body(live, "adoptLoadedProfiles")
    if adopt:
        fns.append(adopt)
    script = HARNESS.replace("/*__BLOCKS__*/", blocks).replace("/*__FNS__*/", "\n".join(fns))
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "legacy_identity_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))
    t.require(proc.returncode == 0, "all identity-scope behavioural checks passed")

    return t


if __name__ == "__main__":
    c.main(run)
