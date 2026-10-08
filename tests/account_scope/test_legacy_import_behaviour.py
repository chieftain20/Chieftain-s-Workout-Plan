"""Legacy import -- behavioural test.

Executes the storage + outbox + legacy-import blocks in Node against an
instrumented localStorage seeded with pre-v10 keys.

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

  const writes = [];
  const removes = [];
  const localStorage = {};
  Object.defineProperties(localStorage, {
    getItem: { value: function (k) { return Object.prototype.hasOwnProperty.call(localStorage, k) ? localStorage[k] : null; } },
    setItem: { value: function (k, v) { writes.push(String(k)); localStorage[String(k)] = String(v); } },
    removeItem: { value: function (k) { removes.push(String(k)); delete localStorage[String(k)]; } },
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
  const toastLog = [];
  function showToast(m) { toastLog.push(String(m)); }
  function confirm() { return true; }

  const USER_A = '752b816b-40a2-4c41-a3e0-5f8ab8094397';
  const USER_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  function asCloud(uuid) { currentAuthUser = { id: uuid }; currentLocalUser = null; }

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }

  const LEGACY = {
    'chieftain_profiles_v9': JSON.stringify([
      { id: 'prof_alpha', name: 'Alpha', days: [] },
      { id: 'prof_beta', name: 'Beta', days: [] }
    ]),
    'chieftain_active_profile_id': 'prof_alpha',
    'chieftain_logs_prof_alpha_leg_curl': JSON.stringify([{ timestamp: 1000 }, { timestamp: 2000 }]),
    'chieftain_metrics_prof_alpha': JSON.stringify([{ id: 'm_1', timestamp: 3000 }]),
    'chieftain_sets_prof_alpha': JSON.stringify({ weekKey: 'IR_WEEK_2026-10-03', updatedAt: 5, sets: { leg_curl: [true] } }),
    'chieftain_draft_log_prof_alpha_leg_curl': JSON.stringify({ timestamp: 4000, sets: [] }),
    'chieftain_custom_exercises': JSON.stringify([{ id: 'cust_1', fa: 'x' }]),
    'chieftain_master_overrides': JSON.stringify({ leg_curl: { fa: 'y' } })
  };
  const LEGACY_KEYS = Object.keys(LEGACY);
  function seedLegacy() { LEGACY_KEYS.forEach(k => { localStorage[k] = LEGACY[k]; }); }
  function legacySnapshot() { return LEGACY_KEYS.map(k => k + '=' + localStorage[k]).join('\u0001'); }

  // Non-user-data globals must never be mistaken for legacy user data.
  const GLOBALS = ['chieftain_lang', 'chieftain_theme', 'chieftain_admin_pin', 'chieftain_auto_cloud_sync'];

  (async () => {
    seedLegacy();
    const before = legacySnapshot();

    // ---- 1. key classification ------------------------------------------
    check('legacy profile key detected', isLegacyUserDataKey('chieftain_profiles_v9') === true);
    check('legacy log key detected', isLegacyUserDataKey('chieftain_logs_prof_alpha_leg_curl') === true);
    check('v10 key is not legacy', isLegacyUserDataKey('chieftain_v10:uuid:x:profiles') === false);
    GLOBALS.forEach(g => check('global key is not legacy: ' + g, isLegacyUserDataKey(g) === false));

    // ---- 2. read-only discovery -----------------------------------------
    asCloud(USER_A);
    writes.length = 0; removes.length = 0;
    const preview = discoverLegacyData();
    check('preview lists every legacy key', preview.keys.length === LEGACY_KEYS.length);
    check('preview counts profiles', preview.counts.profiles === 2);
    check('preview counts logs', preview.counts.logs === 2);
    check('preview counts metrics', preview.counts.metrics === 1);
    check('preview counts sets', preview.counts.sets === 1);
    check('preview counts drafts', preview.counts.drafts === 1);
    check('preview counts custom exercises', preview.counts.customExercises === 1);
    check('preview counts master overrides', preview.counts.masterOverrides === 1);
    check('preview totals 9 records', preview.totalRecords === 9);
    check('discovery performed no writes', writes.length === 0);
    check('discovery performed no removes', removes.length === 0);
    check('legacy keys untouched by discovery', legacySnapshot() === before);

    // ---- 3. unconfirmed import does nothing ------------------------------
    const refused = await runLegacyImport({ confirmed: false });
    check('unconfirmed import is skipped', refused.skipped === 1 && refused.details.reason === 'not_confirmed');
    check('unconfirmed import imported nothing', refused.imported === 0);
    check('unconfirmed import wrote nothing to the scope', scopedGetJSON('profiles', null, null) === null);

    // ---- 4. confirmed import --------------------------------------------
    const result = await runLegacyImport({ confirmed: true });
    check('import reports the target scope', result.scope === 'uuid:' + USER_A);
    check('import imported 9 records', result.imported === 9);
    check('import reported no invalid records', result.invalid === 0);
    check('profiles landed in the scoped store',
      Array.isArray(scopedGetJSON('profiles', null, null)) && scopedGetJSON('profiles', null, null).length === 2);
    check('logs landed in the scoped store', (scopedGetJSON('logs', 'prof_alpha:leg_curl', null) || []).length === 2);
    check('metrics landed in the scoped store', (scopedGetJSON('metrics', 'prof_alpha', null) || []).length === 1);
    check('sets landed in the scoped store', !!scopedGetJSON('sets', 'prof_alpha', null));
    check('draft landed in the scoped store', !!scopedGetJSON('draft', 'prof_alpha:leg_curl', null));
    check('custom exercises landed in the scoped store', customExercises.length === 1);
    check('master overrides landed in the scoped store', !!masterExerciseOverrides.leg_curl);
    check('active profile carried over', scopedGetRaw('active_profile_id', null) === 'prof_alpha');

    // ---- 5. legacy keys byte-identical, never written or removed ---------
    check('legacy keys byte-identical after import', legacySnapshot() === before);
    check('no write ever targeted a legacy key', writes.every(k => isLegacyUserDataKey(k) === false));
    check('no remove ever targeted a legacy key', removes.every(k => isLegacyUserDataKey(k) === false));

    // ---- 6. idempotency --------------------------------------------------
    const second = await runLegacyImport({ confirmed: true });
    check('second import adds nothing', second.imported === 0);
    check('second import skips the already-present records', second.skipped === 9);
    check('profiles are not duplicated', scopedGetJSON('profiles', null, null).length === 2);
    check('logs are not duplicated', scopedGetJSON('logs', 'prof_alpha:leg_curl', null).length === 2);
    check('metrics are not duplicated', scopedGetJSON('metrics', 'prof_alpha', null).length === 1);
    check('custom exercises are not duplicated', customExercises.length === 1);
    check('legacy keys still byte-identical', legacySnapshot() === before);

    // ---- 7. cross-account isolation -------------------------------------
    asCloud(USER_B);
    check('a second account sees an empty workspace', scopedGetJSON('profiles', null, null) === null);
    check('a second account sees no logs', scopedSubKeys('logs').length === 0);
    check('a second account sees no sets', scopedSubKeys('sets').length === 0);
    check('legacy keys are still discoverable', discoverLegacyData().keys.length === LEGACY_KEYS.length);

    const refusedB = await runLegacyImport({ confirmed: false });
    check('a second account cannot import without confirming', refusedB.imported === 0);

    const resultB = await runLegacyImport({ confirmed: true });
    check('a second account imports into its own scope', resultB.scope === 'uuid:' + USER_B);
    check('a second account has its own copy', scopedGetJSON('profiles', null, null).length === 2);

    asCloud(USER_A);
    check('the first account data is untouched by the second import',
      scopedGetJSON('profiles', null, null).length === 2 &&
      scopedGetJSON('logs', 'prof_alpha:leg_curl', null).length === 2);
    check('legacy keys remain byte-identical at the end', legacySnapshot() === before);

    // ---- 8. import bookkeeping is per scope ------------------------------
    const markerA = scopedGetJSON(LEGACY_IMPORT_MARKER, null, null);
    check('the importing scope recorded a run', !!markerA && Array.isArray(markerA.runs) && markerA.runs.length >= 1);
    check('the recorded run names the scope', markerA.runs[markerA.runs.length - 1].scope === 'uuid:' + USER_A);

    if (failures) { console.log(failures + ' legacy-import check(s) failed'); process.exit(1); }
    console.log('PASS: legacy discovery is read-only; import is explicit, confirmed, scoped, idempotent and leaves legacy keys byte-identical.');
    process.exit(0);
  })().catch(err => { console.error(err); process.exit(1); });
})();
"""


def run() -> c.Contract:
    t = c.Contract("legacy_import_behaviour")

    if not t.require(NODE is not None, "node is available"):
        return t

    blocks = c.storage_outbox_and_legacy()
    if not t.require(bool(blocks.strip()), "storage + outbox + legacy-import blocks found"):
        return t

    script = HARNESS.replace("/*__BLOCKS__*/", blocks)

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "legacy_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))

    t.require(proc.returncode == 0, "all behavioural legacy-import checks passed")
    return t


if __name__ == "__main__":
    c.main(run)
