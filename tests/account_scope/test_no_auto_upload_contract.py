"""No-auto-upload contract.

Asserts that the two dangerous cross-account cloud-upload paths are gone and
that no user-data table is written from the client any more. The admin-auth
`profiles` access must survive.

EXPECTED STATUS IN STEP 2: PASS.
"""

import _common as c


def run() -> c.Contract:
    t = c.Contract("no_auto_upload_contract")

    js = c.read_text(c.APP_JS_PATH)
    if not t.require(js is not None, "app_engine.js exists"):
        return t

    # --- the direct-push helpers are deleted ---------------------------------
    t.require_absent(js, "async function pushLogToSupabase", "pushLogToSupabase() deleted")
    t.require_absent(js, "async function pushMetricToSupabase", "pushMetricToSupabase() deleted")

    # --- the two leak rationales are gone ------------------------------------
    t.require_absent(js, "Upload local logs not yet in Supabase", "unscoped log-upload loop deleted")
    t.require_absent(js, "First time login: auto-upload current profile routine", "first-login routine auto-upload deleted")
    t.require_absent(js, "Zero Data Loss", "the auto-upload rationale is gone")

    # --- no client writes to user-data tables --------------------------------
    for table in ("workout_logs", "body_metrics", "user_routines"):
        t.require_absent(js, f".from('{table}')", f"no client access to {table}")

    # --- admin auth access to profiles is preserved --------------------------
    t.require_present(js, ".from('profiles')", "admin-auth profiles access preserved")

    # --- login no longer triggers any cloud sync -----------------------------
    body = c.function_body(js, "handleAuthSessionChanged")
    t.require(bool(body), "handleAuthSessionChanged found")
    if body:
        t.require_absent(body, "syncCurrentDataWithSupabase", "login does not trigger a cloud sync")
        t.require_absent(body, "supabaseClient.from", "login performs no table write")
        t.require_present(body, "applyAccountScopeChange()", "login swaps the account scope instead")

    # --- the sync entry point is inert ---------------------------------------
    sync_body = c.function_body(js, "syncCurrentDataWithSupabase")
    t.require(bool(sync_body), "syncCurrentDataWithSupabase found")
    if sync_body:
        t.require_absent(sync_body, "supabaseClient.from", "sync performs no table access")
        t.require_absent(sync_body, ".insert(", "sync performs no insert")
        t.require_absent(sync_body, ".upsert(", "sync performs no upsert")

    return t


if __name__ == "__main__":
    c.main(run)
