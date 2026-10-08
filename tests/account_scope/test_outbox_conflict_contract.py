"""Outbox wiring contract (static).

Asserts that the outbox is wired to the account-scoped storage layer, that
conflicts are represented, that all cloud writes go through allowlisted RPCs,
and that the visible conflict badge exists.

EXPECTED STATUS IN STEP 3: PASS. (Behaviour is covered by test_outbox_engine.py.)
"""

import _common as c


def run() -> c.Contract:
    t = c.Contract("outbox_wiring_contract")

    js = c.read_text(c.APP_JS_PATH)
    modals = c.read_text(c.ROOT / "tmpl_modals.html")
    if not t.require(js is not None, "app_engine.js exists"):
        return t

    # --- the outbox lives in the account-scoped namespace -------------------
    t.require_present(js, "const OUTBOX_KIND = 'outbox';", "outbox key name declared")
    t.require_match(
        js,
        r"scoped(Get|Set)JSON\(\s*OUTBOX_KIND",
        "outbox is read and written through the scoped layer",
    )

    # --- the safety gate is a single, explicit, reviewed switch -------------
    # The gate was opened ONLY after the migration, the postflight and the
    # two-account E2E were verified. Its protection is therefore no longer
    # "it is closed" but "there is exactly ONE declaration, and nothing toggles
    # it at runtime".
    t.require_present(js, "CLOUD_SYNC_GATE", "cloud-sync gate exists")
    t.require_match(js, r"CLOUD_SYNC_GATE\s*=\s*\{\s*contractVerified:\s*true\s*\}",
                    "the gate is explicitly OPENED by the reviewed activation")
    t.require_present(js, "isCloudSyncEnabled", "gate predicate exists")

    # Checked against comment-stripped source so documentation prose cannot
    # accidentally satisfy (or break) the assertion.
    live = c.strip_js_comments(js)
    t.require(live.count("contractVerified: true") == 1,
              "exactly ONE live `contractVerified: true` declaration exists")
    t.require_absent(live, "contractVerified = true",
                     "the gate is never mutated at runtime (it changes only by that declaration)")
    t.require_absent(live, "contractVerified = false",
                     "the gate is never mutated at runtime in either direction")

    # --- conflicts are represented, persisted and visible -------------------
    t.require_present(js, "'conflict'", "operations can be marked as conflicts")
    t.require_present(js, "listOutboxConflicts", "conflicts are enumerable")
    t.require_present(js, "outboxStatusSummary", "conflict state is summarisable")
    t.require_present(js, "updateConflictBadge", "conflict badge is rendered")
    t.require_present(js, "resolveOutboxConflict", "conflicts require explicit resolution")
    if t.require(modals is not None, "tmpl_modals.html exists"):
        t.require_present(modals, "cloudConflictBadge", "conflict badge element exists in the UI")

    # --- CAS + retry bookkeeping --------------------------------------------
    t.require_present(js, "expectedRevision", "operations carry an expected revision")
    t.require_present(js, "p_expected_revision", "RPC payload carries the expected revision")
    t.require_present(js, "attempts", "retry attempts are recorded")

    # --- writes are RPC-only, through an allowlist --------------------------
    t.require_present(js, "OUTBOX_ALLOWED_KINDS", "RPC names are allowlisted")
    t.require_present(js, ".rpc(", "cloud writes use RPC calls")
    for rpc in ("upsert_routine", "tombstone_routine", "upsert_workout_log",
                "tombstone_workout_log", "upsert_body_metric", "tombstone_body_metric",
                "upsert_custom_exercise", "tombstone_custom_exercise",
                "upsert_set_state", "tombstone_set_state"):
        t.require_present(js, rpc, f"RPC referenced: {rpc}")

    # --- the direct-write helpers stay deleted ------------------------------
    t.require_absent(js, "async function pushLogToSupabase", "direct pushLogToSupabase helper removed")
    t.require_absent(js, "async function pushMetricToSupabase", "direct pushMetricToSupabase helper removed")

    # --- enqueue points exist ----------------------------------------------
    for helper in ("enqueueRoutineUpsert", "enqueueRoutineTombstone", "enqueueLogUpsert",
                   "enqueueLogTombstone", "enqueueMetricUpsert", "enqueueSetStateUpsert",
                   "enqueueCustomExerciseUpsert"):
        t.require_present(js, f"function {helper}(", f"enqueue helper present: {helper}()")

    # --- flush triggers ------------------------------------------------------
    t.require_present(js, "scheduleOutboxFlush", "debounced flush exists")
    t.require_present(js, "flushOutboxNow", "manual flush exists")
    t.require_match(js, r"addEventListener\('online'", "online-event flush is wired")

    return t


if __name__ == "__main__":
    c.main(run)
