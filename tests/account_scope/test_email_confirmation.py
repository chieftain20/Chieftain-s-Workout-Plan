"""Signup email confirmation -- TokenHash flow (static + behavioural).

The link is built from {{ .TokenHash }} and verified in the browser, which
sidesteps the upstream signup redirect_to bug (supabase/auth#2634) and also
defeats email-scanner prefetching, because consuming the token requires the POST
that verifyOtp makes -- and verifyOtp runs only on an explicit user click.

This does NOT prove the flow works against Supabase. A real round trip requires
a production signup and is performed manually.
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

  let replaced = [];
  let verifyCalls = [];
  let resendCalls = [];
  let sessionChanges = [];

  const elements = {};
  function makeEl(id) {
    const set = [];
    return {
      id: id, style: {}, textContent: '', value: '', disabled: false,
      classList: {
        add: function (k) { if (set.indexOf(k) < 0) set.push(k); },
        remove: function (k) { const i = set.indexOf(k); if (i >= 0) set.splice(i, 1); },
        contains: function (k) { return set.indexOf(k) >= 0; }
      }
    };
  }
  ['confirmEmailModal', 'confirmEmailMessage', 'confirmEmailPromptBox',
   'confirmEmailResendBox', 'confirmEmailSubmitBtn', 'confirmEmailSubmitBtnText',
   'confirmEmailResendInput'].forEach(function (id) { elements[id] = makeEl(id); });

  Object.defineProperty(globalThis, 'document', {
    value: { getElementById: function (id) { return elements[id] || null; } },
    writable: true, configurable: true
  });

  Object.defineProperty(globalThis, 'window', {
    value: {
      location: { hostname: 'chieftain20.github.io', origin: 'https://chieftain20.github.io',
                  pathname: '/Chieftain-s-Workout-Plan/', search: '', hash: '' }
    },
    writable: true, configurable: true
  });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'history', {
    value: { replaceState: function (a, b, url) { replaced.push(url); } },
    writable: true, configurable: true
  });

  let currentLang = 'en';
  let supabaseClient = null;
  function showToast() {}
  function handleAuthSessionChanged(u) { sessionChanges.push(u); }

  function setSearch(s) { window.location.search = s || ''; }

/*__BLOCK__*/

  let failures = 0;
  function check(label, cond) { if (!cond) { failures++; console.log('  FAIL: ' + label); } }

  (async () => {
    // ---- 1. token_hash / type extraction --------------------------------
    const p1 = parseEmailConfirmParams('?token_hash=abc&type=email');
    check('extracts token_hash and type', !!p1 && p1.tokenHash === 'abc' && p1.type === 'email');
    const p2 = parseEmailConfirmParams('?type=email&token_hash=abc');
    check('parameter order does not matter', !!p2 && p2.tokenHash === 'abc' && p2.type === 'email');
    const p3 = parseEmailConfirmParams('?token_hash=abc&type=signup');
    check('accepts type=signup', !!p3 && p3.type === 'signup');
    const p4 = parseEmailConfirmParams('?token_hash=abc');
    check('defaults the type to email when absent', !!p4 && p4.type === 'email');
    check('excludes type=recovery (never interferes with recovery)',
      parseEmailConfirmParams('?token_hash=abc&type=recovery') === null);
    check('excludes an unknown type', parseEmailConfirmParams('?token_hash=abc&type=oauth') === null);
    check('rejects a missing token_hash', parseEmailConfirmParams('?type=email') === null);
    check('rejects an empty query string', parseEmailConfirmParams('') === null);
    check('rejects null', parseEmailConfirmParams(null) === null);
    const p5 = parseEmailConfirmParams('?token_hash=a%2Bb%3Dc&type=email');
    check('percent-decodes the token_hash', !!p5 && p5.tokenHash === 'a+b=c');
    const p6 = parseEmailConfirmParams('?foo=1&token_hash=abc&type=email');
    check('ignores unrelated parameters', !!p6 && p6.tokenHash === 'abc');

    // ---- 2. detection from the live location -----------------------------
    setSearch('?token_hash=abc&type=email');
    check('isEmailConfirmLink is true for a confirmation link', isEmailConfirmLink() === true);
    setSearch('?foo=1');
    check('isEmailConfirmLink is false otherwise', isEmailConfirmLink() === false);
    setSearch('');
    check('isEmailConfirmLink is false with no query', isEmailConfirmLink() === false);

    // ---- 3. the prompt opens WITHOUT consuming the token ----------------
    verifyCalls = [];
    setSearch('?token_hash=abc&type=email');
    elements.confirmEmailModal.classList.remove('open');
    const handled = initEmailConfirmationFlow();
    check('initEmailConfirmationFlow reports it handled the link', handled === true);
    check('the confirmation modal is opened', elements.confirmEmailModal.classList.contains('open') === true);
    check('NO verifyOtp happens without an explicit user action', verifyCalls.length === 0);
    check('the token is never rendered into the message area',
      (elements.confirmEmailMessage.textContent || '').indexOf('abc') < 0);

    // ---- 4. explicit confirmation succeeds -------------------------------
    supabaseClient = {
      auth: {
        verifyOtp: async function (args) {
          verifyCalls.push(args);
          return { data: { session: { user: { id: 'u1' } } }, error: null };
        },
        resend: async function (args) { resendCalls.push(args); return { error: null }; }
      }
    };
    replaced = []; sessionChanges = [];
    const okRes = await handleConfirmEmailClick();
    check('verifyOtp is called exactly once', verifyCalls.length === 1);
    check('verifyOtp receives the token_hash', !!verifyCalls[0] && verifyCalls[0].token_hash === 'abc');
    check("verifyOtp receives type 'email'", !!verifyCalls[0] && verifyCalls[0].type === 'email');
    check('the confirmation reports success', okRes.ok === true);
    check('the URL is cleaned after success', replaced.length === 1);
    check('token_hash is removed from the URL', replaced.length === 1 && replaced[0].indexOf('token_hash') < 0);
    check('type is removed from the URL', replaced.length === 1 && replaced[0].indexOf('type=') < 0);
    check('the success state is shown', (elements.confirmEmailMessage.textContent || '').indexOf('confirmed') >= 0);
    check('the session is handed to the app', sessionChanges.length === 1);

    // ---- 5. invalid / expired token --------------------------------------
    supabaseClient.auth.verifyOtp = async function (args) {
      verifyCalls.push(args);
      return { data: null, error: { message: 'otp_expired' } };
    };
    setSearch('?token_hash=expired&type=email');
    replaced = []; verifyCalls = [];
    const badRes = await handleConfirmEmailClick();
    check('a failed verification reports failure', badRes.ok === false);
    check('verifyOtp was attempted', verifyCalls.length === 1);
    check('a failed verification does NOT clean the URL', replaced.length === 0);
    check('an error message is shown', (elements.confirmEmailMessage.textContent || '').length > 0);
    check('the resend option is offered', elements.confirmEmailResendBox.style.display === '');

    // production users see the Persian message (the app is Persian-first)
    currentLang = 'fa';
    replaced = [];
    await handleConfirmEmailClick();
    check('a clear Persian error message is shown',
      (elements.confirmEmailMessage.textContent || '').indexOf('منقضی') >= 0);
    check('the Persian path still does not clean the URL', replaced.length === 0);
    currentLang = 'en';

    // ---- 6. URL cleanup preserves unrelated parameters -------------------
    setSearch('?token_hash=abc&type=email&keep=1');
    replaced = [];
    cleanEmailConfirmUrl();
    check('unrelated query parameters survive cleanup',
      replaced.length === 1 && replaced[0].indexOf('keep=1') >= 0);
    check('token_hash is dropped by cleanup', replaced.length === 1 && replaced[0].indexOf('token_hash') < 0);

    // ---- 7. requesting a new confirmation email --------------------------
    setSearch('?token_hash=expired&type=email');
    resendCalls = [];
    const resent = await requestNewConfirmationEmail('user@example.com');
    check('a new confirmation email can be requested', resent.ok === true);
    check('resend is called with type signup', resendCalls.length === 1 && resendCalls[0].type === 'signup');
    check('resend targets the approved GitHub Pages origin',
      resendCalls.length === 1 && resendCalls[0].options.emailRedirectTo === 'https://chieftain20.github.io/Chieftain-s-Workout-Plan/');
    check('an invalid address is rejected', (await requestNewConfirmationEmail('nope')).ok === false);

    // ---- 8. no interference with PASSWORD_RECOVERY -----------------------
    setSearch('');
    check('no prompt without a token', initEmailConfirmationFlow() === false);
    setSearch('?token_hash=x&type=recovery');
    check('a recovery type is never treated as a confirmation link', isEmailConfirmLink() === false);
    setSearch('#access_token=x&type=recovery');
    check('a recovery hash fragment is not a confirmation link', isEmailConfirmLink() === false);

    if (failures) { console.log(failures + ' email-confirmation check(s) failed'); process.exit(1); }
    console.log('PASS: token_hash extraction, type=email, explicit-confirm gating, success path, expired-token handling, URL cleanup and recovery isolation all behave as specified.');
    process.exit(0);
  })().catch(err => { console.error(err); process.exit(1); });
})();
"""


def run() -> c.Contract:
    t = c.Contract("email_confirmation")

    block = c.email_confirm_block()
    if not t.require(bool(block.strip()), "EMAIL_CONFIRM block found"):
        return t

    live = c.strip_js_comments(block)

    # --- the documented TokenHash approach --------------------------------
    t.require_present(live, "token_hash", "the link is verified by token_hash")
    t.require_present(live, "verifyOtp", "verifyOtp performs the verification")
    t.require_present(live, "auth.resend", "a new confirmation email can be requested")
    t.require_present(block, "https://chieftain20.github.io/Chieftain-s-Workout-Plan/",
                      "the approved GitHub Pages origin is used")
    t.require_absent(block, "netlify", "no Netlify origin is invented")

    # --- requirement: NEVER use {{ .ConfirmationURL }} for signup ---------
    t.require_absent(live, "ConfirmationURL", "signup never relies on .ConfirmationURL")

    # --- the token is consumed only on an explicit user action -------------
    t.require_present(live, "handleConfirmEmailClick", "an explicit confirm handler exists")
    init_fn = c.function_body(live, "initEmailConfirmationFlow")
    t.require(bool(init_fn), "initEmailConfirmationFlow is defined")
    t.require_absent(init_fn, "verifyOtp", "startup never verifies by itself (explicit action only)")
    click_fn = c.function_body(live, "handleConfirmEmailClick")
    t.require(bool(click_fn), "handleConfirmEmailClick is defined")
    t.require_present(click_fn, "verifyOtp", "the confirm handler performs the verification")

    # --- recovery isolation ------------------------------------------------
    t.require_absent(live, "PASSWORD_RECOVERY", "the block never touches the recovery event")
    t.require_absent(live, "detectRecoveryUrlError", "the block never touches recovery error handling")
    t.require_present(live, "EMAIL_CONFIRM_TYPES", "an explicit type allowlist gates the flow")
    t.require_absent(live, "'recovery'", "'recovery' is never an accepted confirmation type")

    # --- URL cleanup + no token in the UI ---------------------------------
    t.require_present(live, "history.replaceState", "the URL is cleaned after success")
    clean_fn = c.function_body(live, "cleanEmailConfirmUrl")
    t.require(bool(clean_fn), "cleanEmailConfirmUrl is defined")
    t.require_present(clean_fn, "token_hash", "cleanup removes token_hash")
    t.require_absent(block, "console.log", "nothing is logged from the confirmation flow")
    t.require_absent(block, "console.error", "no error logging from the confirmation flow")

    # --- a clear Persian error message + a way to request a new link -------
    t.require_present(block, "لینک تأیید نامعتبر است یا منقضی شده است",
                      "a clear Persian message is shown for an invalid/expired link")
    t.require_present(block, "لینک تأیید جدید", "the user can request a new confirmation email")
    t.require_present(live, "EMAIL_CONFIRM_ORIGIN", "the resend path targets the approved origin")

    # --- the modal is wired into the UI -----------------------------------
    modals = c.read_text(c.ROOT / "tmpl_modals.html")
    if t.require(modals is not None, "tmpl_modals.html exists"):
        t.require_present(modals, "confirmEmailModal", "confirmation modal exists")
        t.require_present(modals, "handleConfirmEmailClick()", "confirm button is wired")
        t.require_present(modals, "handleResendConfirmationEmail()", "resend button is wired")
        t.require_present(modals, "confirmEmailMessage", "a message area exists for errors")

    # --- startup wiring ----------------------------------------------------
    js = c.read_text(c.APP_JS_PATH) or ""
    t.require_present(js, "initEmailConfirmationFlow()", "the flow is started at boot")

    # --- behavioural -------------------------------------------------------
    if not t.require(NODE is not None, "node is available"):
        return t

    script = HARNESS.replace("/*__BLOCK__*/", block)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "email_confirm_harness.js"
        path.write_text(script, encoding="utf-8")
        proc = subprocess.run([NODE, str(path)], capture_output=True, text=True, encoding="utf-8")

    output = (proc.stdout or "") + (proc.stderr or "")
    print("\n".join("    " + line for line in output.strip().splitlines()))
    t.require(proc.returncode == 0, "all behavioural confirmation checks passed")

    return t


if __name__ == "__main__":
    c.main(run)
