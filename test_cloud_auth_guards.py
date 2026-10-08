"""Local regression checks ensuring local identities never become Supabase user IDs.

The guard under test is getAuthenticatedSupabaseUserId(), the single place that
decides whether a cloud identity may be used. It is exercised directly rather
than through a write path, because STEP 2 removed the direct cloud write helpers
(pushLogToSupabase / pushMetricToSupabase) in favour of the account-scoped local
storage layer. The guard itself is unchanged and is now covered more thoroughly.
"""
import subprocess
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
JS = (ROOT / "app_engine.js").read_text(encoding="utf-8")
NODE = shutil.which("node")
assert NODE, "Node.js is required for cloud-auth guard checks."

auth_helpers = JS[JS.index("function isUuid(value)"):JS.index("function initSupabase()")]
assert "async function getAuthenticatedSupabaseUserId()" in auth_helpers, \
    "getAuthenticatedSupabaseUserId() must live between isUuid() and initSupabase()"
source = """
let currentAuthUser = null;
let supabaseClient = null;
""" + auth_helpers + r"""
(async () => {
  supabaseClient = {
    auth: { getSession: async () => ({ data: { session: null }, error: null }) }
  };

  // Existing local login IDs are never accepted as Supabase Auth users.
  currentAuthUser = { id: 'admin_hossein', email: 'hossein@chieftain.pro' };
  if (await getAuthenticatedSupabaseUserId() !== null) {
    throw Error('Non-UUID local ID was accepted as a Supabase identity');
  }

  // A UUID without a live Supabase session is not enough.
  const realId = '752b816b-40a2-4c41-a3e0-5f8ab8094397';
  currentAuthUser = { id: realId };
  if (await getAuthenticatedSupabaseUserId() !== null) {
    throw Error('User ID without a live Supabase session was accepted');
  }

  // Only the live session UUID is accepted.
  supabaseClient.auth.getSession = async () => ({ data: { session: { user: { id: realId } } }, error: null });
  if (await getAuthenticatedSupabaseUserId() !== realId) {
    throw Error('Live Auth session UUID was not returned');
  }

  // A session belonging to a different user than currentAuthUser is rejected.
  supabaseClient.auth.getSession = async () => ({
    data: { session: { user: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' } } }, error: null
  });
  if (await getAuthenticatedSupabaseUserId() !== null) {
    throw Error('A session for a different user was accepted');
  }

  // A failed session read is rejected.
  supabaseClient.auth.getSession = async () => ({ data: { session: null }, error: new Error('session unavailable') });
  if (await getAuthenticatedSupabaseUserId() !== null) {
    throw Error('A failed session read was accepted');
  }

  console.log('PASS: local, sessionless and mismatched IDs are blocked; only the live Auth session UUID is accepted.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
"""
result = subprocess.run([NODE, "-e", source], capture_output=True, text=True, encoding="utf-8")
assert result.returncode == 0, result.stdout + result.stderr
print(result.stdout.strip())
assert "currentAuthUser = null;" in JS[JS.index("function setLocalAuthSession"):JS.index("function loadStoredLocalAuthSession")]
assert "currentLocalUser = user;" in JS[JS.index("function setLocalAuthSession"):JS.index("function loadStoredLocalAuthSession")]
assert "auth.verifyOtp({ token_hash: result.token_hash, type: 'magiclink' })" in JS
assert "ADMIN_ACCESS_CODE" not in JS
print("PASS: offline session storage is separate, cloud admin receives a real Supabase Auth session, and no admin secret is in client code.")
