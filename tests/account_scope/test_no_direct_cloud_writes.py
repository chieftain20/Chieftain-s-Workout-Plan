"""No direct cloud table WRITES -- static contract.

The client may READ the five user-data tables (RLS-scoped SELECT), but it must
never issue a direct INSERT/UPDATE/DELETE/UPSERT against them: all mutation goes
through the STEP 1 RPCs. Every RPC name used must be part of that contract.

EXPECTED STATUS IN STEP 4: PASS.
"""

import re

import _common as c

OWNED_TABLES = [
    "user_routines",
    "workout_logs",
    "body_metrics",
    "user_custom_exercises",
    "workout_set_states",
]

# RPC names created by the STEP 1 migration. Anything else is an invention.
CONTRACT_RPCS = {
    "owns_active_profile",
    "upsert_routine", "tombstone_routine",
    "upsert_workout_log", "update_workout_log", "tombstone_workout_log",
    "upsert_body_metric", "update_body_metric", "tombstone_body_metric",
    "upsert_custom_exercise", "tombstone_custom_exercise",
    "upsert_set_state", "tombstone_set_state",
}


def run() -> c.Contract:
    t = c.Contract("no_direct_cloud_writes")

    js = c.read_text(c.APP_JS_PATH)
    if not t.require(js is not None, "app_engine.js exists"):
        return t

    # --- no direct mutation of any owned table ------------------------------
    for table in OWNED_TABLES:
        for verb in ("insert", "update", "delete", "upsert"):
            t.require_absent(
                js, f".from('{table}').{verb}(",
                f"no direct {verb} on {table}",
            )

    # --- table access is limited to the owned tables plus profiles ----------
    table_calls = set(re.findall(r"\.from\(\s*['\"]([a-z_]+)['\"]\s*\)", js))
    allowed = set(OWNED_TABLES) | {"profiles"}
    t.require(
        table_calls <= allowed,
        f"only owned tables and profiles are accessed (unexpected: {sorted(table_calls - allowed)})",
    )

    # --- reads are explicit selects over owned tables (plus the admin profile) --
    read_calls = set(re.findall(r"\.from\(\s*['\"]([a-z_]+)['\"]\s*\)\s*\.select\(", js))
    readable = set(OWNED_TABLES) | {"profiles"}
    t.require(
        read_calls <= readable,
        f"reads target only owned tables and profiles (unexpected: {sorted(read_calls - readable)})",
    )

    # --- reads are scoped to the authenticated user -------------------------
    t.require(
        js.count(".eq('user_id', userId)") >= 1,
        "cloud reads filter on the authenticated user id",
    )

    # --- the profiles bootstrap is the one allowed write --------------------
    profiles_writes = re.findall(r"supabaseClient\.from\('profiles'\)\.(insert|update|delete|upsert)\(", js)
    t.require(
        all(w == "insert" for w in profiles_writes),
        f"profiles writes are limited to the first-login insert (found: {sorted(set(profiles_writes))})",
    )

    # --- every .rpc() call uses an allowlisted name -------------------------
    rpc_names = set(re.findall(r"\.rpc\(\s*['\"]([a-z_]+)['\"]", js))
    for name in rpc_names:
        t.require(name in CONTRACT_RPCS, f"RPC name is part of the STEP 1 contract: {name}")

    # --- the allowlist itself only contains contract RPCs -------------------
    allowlist_block = re.search(r"OUTBOX_ALLOWED_KINDS\s*=\s*\[(.*?)\]", js, re.S)
    if t.require(allowlist_block is not None, "OUTBOX_ALLOWED_KINDS list found"):
        listed = set(re.findall(r"'([a-z_]+)'", allowlist_block.group(1)))
        t.require(listed <= CONTRACT_RPCS, f"allowlist contains only contract RPCs (extra: {sorted(listed - CONTRACT_RPCS)})")
        t.require(len(listed) == 12, f"all 12 mutation RPCs are allowlisted (found {len(listed)})")

    return t


if __name__ == "__main__":
    c.main(run)
