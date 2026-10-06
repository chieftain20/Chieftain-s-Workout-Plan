"""Local regression checks ensuring local identities never become Supabase user IDs."""
import subprocess
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
JS = (ROOT / "app_engine.js").read_text(encoding="utf-8")
NODE = shutil.which("node")
assert NODE, "Node.js is required for cloud-auth guard checks."

auth_helpers = JS[JS.index("function isUuid(value)"):JS.index("function initSupabase()")]
push_log = JS[JS.index("async function pushLogToSupabase"):JS.index("async function pushMetricToSupabase")]
source = """
let currentAuthUser = null;
let supabaseClient = null;
""" + auth_helpers + push_log + r"""
(async () => {
  const writes = [];
  supabaseClient = {
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    from: (table) => ({ insert: (row) => writes.push({ table, row }) })
  };

  // Existing local login IDs are never accepted as Supabase Auth users.
  currentAuthUser = { id: 'admin_hossein', email: 'hossein@chieftain.pro' };
  await pushLogToSupabase('leg_curl', { timestamp: 1 });
  if (writes.length) throw Error('Non-UUID local ID reached a Supabase insert');

  const realId = '752b816b-40a2-4c41-a3e0-5f8ab8094397';
  currentAuthUser = { id: realId };
  await pushLogToSupabase('leg_curl', { timestamp: 2 });
  if (writes.length) throw Error('User ID without a live Supabase session reached an insert');

  supabaseClient.auth.getSession = async () => ({ data: { session: { user: { id: realId } } }, error: null });
  await pushLogToSupabase('leg_curl', { timestamp: 3 });
  if (writes.length !== 1 || writes[0].row.user_id !== realId) throw Error('Cloud insert did not use the live Auth session UUID');

  console.log('PASS: local and sessionless IDs are blocked; live Auth session UUID is used.');
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
