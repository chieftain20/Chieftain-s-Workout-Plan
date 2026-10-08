"""Account-scope isolation -- behavioural test.

Extracts the ACCOUNT_SCOPE_STORAGE block from app_engine.js and executes it in
Node against an instrumented in-memory localStorage. This is a real behavioural
test of the scope layer, not a text scan.

EXPECTED STATUS IN STEP 2: PASS.
"""

import json
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
  // Methods are non-enumerable so Object.keys(localStorage) yields only keys,
  // matching the browser Storage contract that the scope layer relies on.
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

  let currentAuthUser = null;
  let currentLocalUser = null;
  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
  }

/*__SCOPE_BLOCK__*/

  // ---- helpers ------------------------------------------------------------
  let failures = 0;
  function check(label, cond) {
    if (!cond) { failures++; console.log('  FAIL: ' + label); }
  }
  function asCloud(uuid) { currentAuthUser = { id: uuid }; currentLocalUser = null; }
  function asLocal(id) { currentAuthUser = null; currentLocalUser = { id: id }; }
  function asAnon() { currentAuthUser = null; currentLocalUser = null; }

  const USER_A = '752b816b-40a2-4c41-a3e0-5f8ab8094397';
  const USER_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  function seedScope(tag) {
    scopedSetJSON('profiles', null, [{ id: 'p_' + tag }]);
    scopedSetJSON('logs', 'prof_' + tag + ':leg_curl', [{ timestamp: 1, tag: tag }]);
    scopedSetJSON('metrics', 'prof_' + tag, [{ id: 'm_' + tag }]);
    scopedSetJSON('sets', 'prof_' + tag, { weekKey: 'IR_WEEK_2026-10-03', tag: tag });
    scopedSetJSON('draft', 'prof_' + tag + ':leg_curl', { tag: tag });
    scopedSetJSON('custom_exercises', null, [{ id: 'cust_' + tag }]);
    scopedSetJSON('master_overrides', null, { tag: tag });
    scopedSetRaw('active_profile_id', null, 'prof_' + tag);
  }

  function assertScopeTag(tag) {
    check(tag + ': profiles', (scopedGetJSON('profiles', null, null) || [{}])[0].id === 'p_' + tag);
    check(tag + ': logs', (scopedGetJSON('logs', 'prof_' + tag + ':leg_curl', null) || [{}])[0].tag === tag);
    check(tag + ': metrics', (scopedGetJSON('metrics', 'prof_' + tag, null) || [{}])[0].id === 'm_' + tag);
    check(tag + ': sets', (scopedGetJSON('sets', 'prof_' + tag, null) || {}).tag === tag);
    check(tag + ': draft', (scopedGetJSON('draft', 'prof_' + tag + ':leg_curl', null) || {}).tag === tag);
    check(tag + ': custom_exercises', (scopedGetJSON('custom_exercises', null, null) || [{}])[0].id === 'cust_' + tag);
    check(tag + ': master_overrides', (scopedGetJSON('master_overrides', null, null) || {}).tag === tag);
    check(tag + ': active_profile_id', scopedGetRaw('active_profile_id', null) === 'prof_' + tag);
  }

  function assertScopeEmpty(tag) {
    check(tag + ': profiles empty', scopedGetJSON('profiles', null, null) === null);
    check(tag + ': custom_exercises empty', scopedGetJSON('custom_exercises', null, null) === null);
    check(tag + ': master_overrides empty', scopedGetJSON('master_overrides', null, null) === null);
    check(tag + ': active_profile_id empty', scopedGetRaw('active_profile_id', null) === null);
    check(tag + ': logs subkeys empty', scopedSubKeys('logs').length === 0);
    check(tag + ': sets subkeys empty', scopedSubKeys('sets').length === 0);
    check(tag + ': metrics subkeys empty', scopedSubKeys('metrics').length === 0);
    check(tag + ': draft subkeys empty', scopedSubKeys('draft').length === 0);
  }

  // 1. scope key derivation
  asCloud(USER_A);        check('scope uuid', getAccountScope() === 'uuid:' + USER_A);
  asLocal('admin_hossein'); check('scope local', getAccountScope() === 'local:admin_hossein');
  asAnon();               check('scope anonymous', getAccountScope() === 'local:anonymous');

  // 2. two cloud accounts cannot see each other
  asCloud(USER_A); seedScope('A'); assertScopeTag('A');
  asCloud(USER_B); assertScopeEmpty('B'); seedScope('B'); assertScopeTag('B');
  asCloud(USER_A); assertScopeTag('A');
  asCloud(USER_B); assertScopeTag('B');

  // 3. no cross-scope key enumeration
  asCloud(USER_A);
  check('A logs subkeys count', scopedSubKeys('logs').length === 1);
  check('A sets subkeys count', scopedSubKeys('sets').length === 1);
  check('A metrics subkeys count', scopedSubKeys('metrics').length === 1);
  check('A entry map size', Object.keys(scopedEntryMap('logs')).length === 1);
  asCloud(USER_B);
  check('B logs subkeys count', scopedSubKeys('logs').length === 1);

  // 4. a local: scope is isolated from every uuid: scope
  asLocal('admin_hossein'); assertScopeEmpty('local'); seedScope('L'); assertScopeTag('L');
  asCloud(USER_A);          assertScopeTag('A');
  asLocal('admin_hossein'); assertScopeTag('L');

  // 5. a different local identity is isolated from the first
  asLocal('morvarid'); assertScopeEmpty('local2');

  // 6. legacy pre-v10 keys are never read, written or removed
  const LEGACY = {
    'chieftain_profiles_v9': JSON.stringify([{ id: 'legacy_profile' }]),
    'chieftain_profiles_v8': JSON.stringify([{ id: 'legacy_v8' }]),
    'chieftain_active_profile_id': 'legacy_profile',
    'chieftain_logs_template_male_leg_curl': JSON.stringify([{ timestamp: 9 }]),
    'chieftain_metrics_template_male': JSON.stringify([{ id: 'm_legacy' }]),
    'chieftain_sets_template_male': JSON.stringify({ weekKey: 'IR_WEEK_legacy' }),
    'chieftain_draft_log_template_male_leg_curl': JSON.stringify({ legacy: true }),
    'chieftain_custom_exercises': JSON.stringify([{ id: 'cust_legacy' }]),
    'chieftain_master_overrides': JSON.stringify({ legacy: true })
  };
  Object.keys(LEGACY).forEach(function (k) { localStorage[k] = LEGACY[k]; });

  writes.length = 0;
  removes.length = 0;

  asCloud(USER_A);          seedScope('X');
  asLocal('admin_hossein'); seedScope('Y');
  asAnon();                 seedScope('Z');

  Object.keys(LEGACY).forEach(function (k) {
    check('legacy preserved: ' + k, localStorage[k] === LEGACY[k]);
  });
  check('every write stayed inside the v10 namespace',
        writes.every(function (k) { return k.indexOf('chieftain_v10:') === 0; }));
  check('every remove stayed inside the v10 namespace',
        removes.every(function (k) { return k.indexOf('chieftain_v10:') === 0; }));
  check('legacy log key invisible to the current scope',
        scopedSubKeys('logs').indexOf('template_male_leg_curl') < 0);
  check('legacy set key invisible to the current scope',
        scopedSubKeys('sets').indexOf('template_male') < 0);

  if (failures) {
    console.log(failures + ' isolation check(s) failed');
    process.exit(1);
  }
  console.log('PASS: scopes isolated; active profile, logs, metrics, sets, drafts, custom exercises and overrides are per-scope; no cross-scope enumeration; legacy keys untouched.');
})();
"""


def run() -> c.Contract:
    t = c.Contract("scope_isolation")

    if not t.require(NODE is not None, "node is available"):
        return t

    block = c.scope_block()
    if not t.require(bool(block.strip()), "ACCOUNT_SCOPE_STORAGE block found in app_engine.js"):
        return t

    script = HARNESS.replace("/*__SCOPE_BLOCK__*/", block)

    # Run from a temp file: the generated script can exceed the Windows command
    # line length limit.
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "isolation_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run(
            [NODE, str(path)],
            capture_output=True, text=True, encoding="utf-8",
        )

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))

    t.require(proc.returncode == 0, "all behavioural isolation checks passed")
    return t


if __name__ == "__main__":
    c.main(run)
