"""Migration artifact contract.

Verifies that the STEP 1 migration file is additive, idempotent, free of
unqualified destructive statements, and complete with respect to the design
docs. This test inspects the file as TEXT ONLY -- it never executes SQL and
never contacts a database.

EXPECTED STATUS IN STEP 1: PASS (this validates the artifact we just wrote).
"""

import re

import _common as c


def run() -> c.Contract:
    t = c.Contract("migration_artifact_contract")

    sql = c.read_text(c.MIGRATION_PATH)
    if not t.require(sql is not None, "migration file exists at supabase/migrations/"):
        return t

    live = c.strip_sql_comments(sql)

    # --- structure -----------------------------------------------------------
    t.require_present(live, "begin;", "migration is wrapped in an explicit transaction (begin;)")
    t.require_present(live, "commit;", "migration closes its transaction (commit;)")

    # --- no unqualified destructive statements -------------------------------
    # Detected at STATEMENT level: `truncate`, `delete` and `references` are also
    # privilege NAMES inside REVOKE lists, which are legitimate here.
    t.require(
        re.search(r"(?im)^\s*truncate\b", live) is None,
        "no TRUNCATE statement in live SQL",
    )
    t.require(
        re.search(r"(?im)^\s*delete\b", live) is None,
        "no DELETE statement in live SQL",
    )
    t.require(
        re.search(r"(?im)^\s*drop\s+(table|schema|database|index|function|view)\b", live) is None,
        "no DROP table/schema/database/index/function/view statement in live SQL",
    )

    # Every DROP that does survive must be fully qualified.
    for line in live.splitlines():
        stripped = line.strip().lower()
        if stripped.startswith("drop "):
            t.require(" on public." in stripped, f"qualified DROP: {line.strip()[:70]}")

    # --- profiles surface untouched ------------------------------------------
    for line in live.splitlines():
        low = line.lower()
        if "policy" in low:
            t.require(
                "public.profiles" not in low,
                f"no policy statement targets public.profiles: {line.strip()[:70]}",
            )

    # --- new objects ---------------------------------------------------------
    t.require_present(live, "create table if not exists public.user_custom_exercises", "new table user_custom_exercises")
    t.require_present(live, "create table if not exists public.workout_set_states", "new table workout_set_states")

    for column in ("profile_data", "client_record_id", "profile_key", "revision", "deleted_at"):
        t.require_present(live, column, f"column present: {column}")

    t.require_present(live, "owns_active_profile", "ownership helper function")

    for rpc in c.MUTATION_RPCS:
        t.require_present(live, rpc, f"RPC present: {rpc}")

    # --- hardening -----------------------------------------------------------
    t.require(
        live.lower().count("security definer") >= 13,
        "all 13 functions are SECURITY DEFINER",
    )
    t.require(
        live.count("set search_path = ''") >= 13,
        "all 13 functions pin search_path to ''",
    )
    t.require_absent(live.lower(), "using (true)", "no permissive `using (true)` policy")
    t.require_absent(live.lower(), "p_user_id", "no RPC accepts a client-supplied owner id")

    t.require(
        live.lower().count("revoke all on function") >= 13,
        "EXECUTE revoked from PUBLIC for every function",
    )
    t.require(
        live.lower().count("grant execute on function") >= 13,
        "EXECUTE granted to authenticated for every function",
    )
    t.require(
        live.lower().count("enable row level security") >= 6,
        "RLS enabled on all six tables",
    )

    # --- least privilege -----------------------------------------------------
    t.require(
        "revoke insert, update, delete, truncate, trigger, references on table public.workout_logs" in live.lower()
        or "revoke insert, update, delete, truncate, trigger, references on table public.workout_logs" in live,
        "workout_logs write privileges revoked from authenticated",
    )
    t.require_present(live, "grant select on table public.workout_logs", "workout_logs SELECT granted to authenticated")

    # --- semantic markers ----------------------------------------------------
    t.require_present(live, "- 'pin'", "PIN is stripped from profile_data (decision B3)")
    t.require_present(live, "- 'ownerId'", "ownerId is stripped from exercise_data")
    t.require_present(live, "not valid", "CHECK/FK constraints added NOT VALID")
    t.require_present(live, "on delete restrict", "composite FKs use ON DELETE RESTRICT")
    t.require_present(live, "on update cascade", "composite FKs use ON UPDATE CASCADE")
    t.require_present(live, "profile_key = null", "profile deletion unassigns history (decision A3)")
    t.require_present(live, "server_version_num", "MAINTAIN revoke is version-guarded")

    # --- idempotency ---------------------------------------------------------
    t.require(
        live.lower().count("if not exists") >= 20,
        "idempotent: at least 20 `if not exists` guards",
    )
    t.require(
        live.lower().count("create or replace function") >= 13,
        "functions use CREATE OR REPLACE",
    )

    # --- companion artifacts exist -------------------------------------------
    t.require(c.read_text(c.PREFLIGHT_PATH) is not None, "preflight diagnostics file exists")
    t.require(c.read_text(c.POSTFLIGHT_PATH) is not None, "postflight diagnostics file exists")
    t.require(c.read_text(c.SQL_TESTS_PATH) is not None, "staging SQL contract tests exist")
    for doc in c.DOCS:
        t.require(doc.exists(), f"design doc exists: {doc.name}")

    return t


if __name__ == "__main__":
    c.main(run)
