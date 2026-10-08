"""Password recovery -- behavioural + static contract.

EXPECTED STATUS IN STEP 4: PASS.

NOTE: this does NOT prove recovery works against Supabase. Verifying the redirect
allowlist and the real PASSWORD_RECOVERY round trip requires the staging project
and is deferred.
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

  Object.defineProperty(globalThis, 'window', {
    value: { location: { hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/index.html', hash: '' } },
    writable: true, configurable: true
  });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, writable: true, configurable: true });

  let currentLang = 'en';
  let supabaseClient = null;
  const calls = [];
  function showToast() {}
  function alert() {}
  function confirm() { return true; }

/*__BLOCK__*/

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }

  function setLocation(hostname, origin, pathname, hash) {
    window.location = { hostname: hostname, origin: origin, pathname: pathname, hash: hash || '' };
  }

  (async () => {
    // ---- 1. new-password validation --------------------------------------
    check('missing password is rejected', validateNewPassword('', '').ok === false);
    check('short password is rejected', validateNewPassword('abc', 'abc').ok === false);
    check('mismatched passwords are rejected', validateNewPassword('abcdef', 'abcdeg').ok === false);
    check('a valid password passes', validateNewPassword('abcdef', 'abcdef').ok === true);

    // ---- 2. redirect origin ----------------------------------------------
    setLocation('localhost', 'http://localhost:5173', '/index.html', '');
    check('localhost uses its own origin', passwordRecoveryRedirectUrl() === 'http://localhost:5173/index.html');
    setLocation('127.0.0.1', 'http://127.0.0.1:8000', '/', '');
    check('127.0.0.1 uses its own origin', passwordRecoveryRedirectUrl().indexOf('127.0.0.1') >= 0);
    setLocation('chieftain20.github.io', 'https://chieftain20.github.io', '/Chieftain-s-Workout-Plan/', '');
    check('production uses the approved GitHub Pages origin',
      passwordRecoveryRedirectUrl() === 'https://chieftain20.github.io/Chieftain-s-Workout-Plan/');
    check('no Netlify origin is invented', passwordRecoveryRedirectUrl().indexOf('netlify') < 0);

    // ---- 3. recovery state ------------------------------------------------
    check('recovery state starts inactive', isPasswordRecoveryActive() === false);
    setPasswordRecoveryActive(true);
    check('recovery state can be set active', isPasswordRecoveryActive() === true);
    setPasswordRecoveryActive(false);
    check('recovery state can be cleared', isPasswordRecoveryActive() === false);

    // ---- 4. invalid / expired recovery link -------------------------------
    setLocation('localhost', 'http://localhost:5173', '/index.html', '#error=access_denied&error_code=otp_expired');
    const err = detectRecoveryUrlError();
    check('an expired link is detected', !!err && err.code === 'otp_expired');
    setLocation('localhost', 'http://localhost:5173', '/index.html', '#access_token=abc&type=recovery');
    check('a valid recovery link is not reported as an error', detectRecoveryUrlError() === null);
    setLocation('localhost', 'http://localhost:5173', '/index.html', '');
    check('no hash means no error', detectRecoveryUrlError() === null);

    // ---- 5. requesting a reset --------------------------------------------
    setLocation('chieftain20.github.io', 'https://chieftain20.github.io', '/Chieftain-s-Workout-Plan/', '');
    supabaseClient = null;
    check('request without a client fails safely', (await requestPasswordReset('a@b.com')).ok === false);

    supabaseClient = {
      auth: {
        resetPasswordForEmail: async (email, opts) => { calls.push({ kind: 'reset', email: email, opts: opts }); return { error: null }; },
        updateUser: async (payload) => { calls.push({ kind: 'update', payload: payload }); return { error: null }; }
      }
    };
    check('an invalid address is rejected', (await requestPasswordReset('not-an-email')).ok === false);
    const sent = await requestPasswordReset('user@example.com');
    check('a valid address is accepted', sent.ok === true);
    check('resetPasswordForEmail was called', calls.some(c2 => c2.kind === 'reset'));
    const resetCall = calls.find(c2 => c2.kind === 'reset');
    check('the reset call passes a redirectTo', !!resetCall.opts && typeof resetCall.opts.redirectTo === 'string');
    check('the reset call uses the approved origin', resetCall.opts.redirectTo === 'https://chieftain20.github.io/Chieftain-s-Workout-Plan/');

    supabaseClient.auth.resetPasswordForEmail = async () => ({ error: { message: 'rate limited' } });
    check('a failed request is reported', (await requestPasswordReset('user@example.com')).ok === false);

    // ---- 6. setting the new password --------------------------------------
    supabaseClient.auth.updateUser = async (payload) => { calls.push({ kind: 'update', payload: payload }); return { error: null }; };
    check('a mismatched confirmation is rejected', (await submitNewPassword('abcdef', 'abcdeg')).ok === false);
    check('a short password is rejected', (await submitNewPassword('abc', 'abc')).ok === false);

    setPasswordRecoveryActive(true);
    const updated = await submitNewPassword('newpass1', 'newpass1');
    check('a valid new password is accepted', updated.ok === true);
    const updateCall = calls.filter(c2 => c2.kind === 'update').pop();
    check('updateUser receives the password', !!updateCall && updateCall.payload.password === 'newpass1');
    check('recovery state is cleared after success', isPasswordRecoveryActive() === false);

    supabaseClient.auth.updateUser = async () => ({ error: { message: 'weak password' } });
    setPasswordRecoveryActive(true);
    const failedUpdate = await submitNewPassword('newpass2', 'newpass2');
    check('a failed update is reported', failedUpdate.ok === false);
    check('recovery state persists after a failure', isPasswordRecoveryActive() === true);

    if (failures) { console.log(failures + ' recovery check(s) failed'); process.exit(1); }
    console.log('PASS: recovery request, recovery state, password update, invalid-link handling and origin selection all behave as specified.');
    process.exit(0);
  })().catch(err => { console.error(err); process.exit(1); });
})();
"""


def run() -> c.Contract:
    t = c.Contract("password_recovery")

    block = c.password_recovery_block()
    if not t.require(bool(block.strip()), "PASSWORD_RECOVERY block found"):
        return t

    # --- static: the flow exists and no origin is invented -----------------
    t.require_present(block, "resetPasswordForEmail", "resetPasswordForEmail is called")
    t.require_present(block, "updateUser", "updateUser({ password }) completes the reset")
    t.require_present(block, "PASSWORD_RECOVERY", "the PASSWORD_RECOVERY event is handled")
    t.require_present(block, "redirectTo", "an explicit redirectTo is passed")
    t.require_present(block, "https://chieftain20.github.io/Chieftain-s-Workout-Plan/",
                      "the approved GitHub Pages origin is used")
    t.require_absent(block, "netlify", "no Netlify origin is invented")
    t.require_match(block, r"localhost|127\.0\.0\.1", "localhost development origin is supported")
    t.require_present(block, "MIN_PASSWORD_LENGTH", "a minimum password length is enforced")

    # --- static: no password or token is ever logged or rendered -----------
    t.require_absent(block, "console.log", "nothing is logged from the recovery flow")
    t.require_absent(block, "console.error", "no error logging from the recovery flow")
    for fn in ("showToast(", "showSetPasswordMessage(", "alert("):
        idx = 0
        while True:
            i = block.find(fn, idx)
            if i < 0:
                break
            j = block.find(");", i)
            snippet = block[i:(j if j > 0 else i + 240)]
            t.require(
                not any(v in snippet for v in ("newPassword", "confirmPassword", "confirmPw", " pw")),
                f"no password value reaches {fn}",
            )
            idx = i + 1

    # --- static: the UI is wired -------------------------------------------
    modals = c.read_text(c.ROOT / "tmpl_modals.html")
    if t.require(modals is not None, "tmpl_modals.html exists"):
        t.require_present(modals, "setPasswordModal", "set-password modal exists")
        t.require_present(modals, "handleSetNewPassword()", "set-password handler is wired")
        t.require_present(modals, "handleForgotPasswordClick()", "forgot-password entry point is wired")
        t.require_match(modals, r'id="newPasswordInput"[^>]*type="password"|type="password"[^>]*id="newPasswordInput"', "new password field is masked")
        t.require_match(modals, r'id="confirmPasswordInput"[^>]*type="password"|type="password"[^>]*id="confirmPasswordInput"', "confirmation field is masked")

    # --- behavioural -------------------------------------------------------
    if not t.require(NODE is not None, "node is available"):
        return t

    script = HARNESS.replace("/*__BLOCK__*/", block)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "recovery_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))
    t.require(proc.returncode == 0, "all behavioural recovery checks passed")

    return t


if __name__ == "__main__":
    c.main(run)
