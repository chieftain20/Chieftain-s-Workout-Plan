"""Frontend account-scope contract.

Asserts that app_engine.js stores all user data under the account-scoped
namespace and that the unscoped enumerators are gone.

EXPECTED STATUS IN STEP 2: PASS.
"""

import _common as c


def run() -> c.Contract:
    t = c.Contract("frontend_scope_contract")

    js = c.read_text(c.APP_JS_PATH)
    if not t.require(js is not None, "app_engine.js exists"):
        return t

    # --- the versioned account namespace exists ------------------------------
    t.require_present(js, "chieftain_v10:", "account-scoped namespace prefix 'chieftain_v10:'")

    # --- a single scope derivation function exists ---------------------------
    t.require_match(
        js,
        r"function\s+(scopeKey|getScopeKey|getAccountScope|accountScope|currentScope)\s*\(",
        "a scope derivation function (getAccountScope)",
    )
    t.require_match(
        js,
        r"['\"]uuid:['\"]|`uuid:\$\{|['\"]local:['\"]",
        "scope encodes uuid: / local: identity",
    )

    # --- the storage abstraction is complete ---------------------------------
    for helper in ("scopedKey", "scopedGetRaw", "scopedGetJSON", "scopedSetRaw",
                   "scopedSetJSON", "scopedRemove", "scopedSubKeys", "scopedEntryMap"):
        t.require_present(js, f"function {helper}(", f"storage helper present: {helper}()")

    # --- the scope block is delimited so tests can execute it ----------------
    t.require_present(js, "// >>> ACCOUNT_SCOPE_STORAGE_BEGIN", "scope block start marker")
    t.require_present(js, "// <<< ACCOUNT_SCOPE_STORAGE_END", "scope block end marker")

    # --- every user-data kind is routed through the scope layer --------------
    for name in ("'profiles'", "'logs'", "'metrics'", "'sets'", "'draft'",
                 "'custom_exercises'", "'master_overrides'", "'active_profile_id'"):
        t.require_present(js, name, f"scoped data kind wired: {name}")

    # --- the unscoped enumerators are gone -----------------------------------
    t.require_absent(js, "function getAllProfilesLogsMap", "getAllProfilesLogsMap removed (cross-account enumerator)")
    t.require_absent(js, "function getAllProfilesSetsMap", "getAllProfilesSetsMap removed (cross-account enumerator)")
    t.require_present(js, "function getScopedLogsMap", "replaced by the scope-filtered getScopedLogsMap")
    t.require_present(js, "function getScopedSetsMap", "replaced by the scope-filtered getScopedSetsMap")

    # --- no raw full-storage enumeration -------------------------------------
    t.require_absent(
        js,
        "for (let i = 0; i < localStorage.length; i++)",
        "no raw localStorage.length enumeration remains",
    )

    # --- the old global keys are only referenced by the legacy import --------
    # The legacy-import block is the single place allowed to name pre-v10 keys,
    # and it only ever reads them.
    outside = c.js_outside("legacy_import")
    t.require_absent(outside, "chieftain_profiles_v9", "the global v9 profiles key is referenced only by the legacy importer")
    t.require_absent(outside, "chieftain_logs_' + activeProfileId", "logs keyed through the scoped adapter")

    # --- scope changes swap the workspace ------------------------------------
    t.require_present(js, "function applyAccountScopeChange", "scope-change handler exists")

    return t


if __name__ == "__main__":
    c.main(run)
