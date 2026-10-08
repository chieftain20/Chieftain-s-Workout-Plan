"""Explicit legacy-import contract (static).

Asserts that pre-v10 local data can only be imported through an explicit,
user-confirmed flow, that discovery is read-only, and that nothing is ever
auto-imported or auto-uploaded.

EXPECTED STATUS IN STEP 4: PASS. (Behaviour is covered by
test_legacy_import_behaviour.py.)
"""

import re

import _common as c


def run() -> c.Contract:
    t = c.Contract("legacy_import_contract")

    js = c.read_text(c.APP_JS_PATH)
    if not t.require(js is not None, "app_engine.js exists"):
        return t

    block = c.legacy_import_block()
    if not t.require(bool(block.strip()), "LEGACY_IMPORT block found"):
        return t

    # --- the legacy key inventory is declared explicitly --------------------
    t.require_present(block, "LEGACY_EXACT_KEYS", "legacy exact-key inventory declared")
    t.require_present(block, "LEGACY_PREFIXES", "legacy prefix inventory declared")
    t.require_present(block, "function isLegacyUserDataKey", "legacy key predicate exists")
    t.require_present(block, "function discoverLegacyData", "read-only discovery exists")

    # --- discovery is READ ONLY ---------------------------------------------
    t.require_present(block, "localStorage.getItem", "discovery reads legacy keys")
    t.require_absent(block, "localStorage.setItem", "discovery never writes")
    t.require_absent(block, "localStorage.removeItem", "discovery never removes")
    t.require_absent(block, "localStorage.clear", "discovery never clears storage")

    # --- import is explicit and confirmed -----------------------------------
    t.require_present(block, "async function runLegacyImport", "import entry point exists")
    t.require_present(block, "opts.confirmed", "import requires an explicit confirmed flag")
    t.require_present(block, "function confirmLegacyImport", "confirm handler exists")
    t.require_present(block, "confirm(", "a user confirmation dialog is shown")

    # --- the confirmation names the destination scope ------------------------
    t.require_present(block, "getAccountScope()", "the confirmation names the target account scope")

    # --- import is never triggered automatically ----------------------------
    callers = re.findall(r"(?<!function )runLegacyImport\s*\(", js)
    t.require(len(callers) == 1, f"runLegacyImport has exactly one call site (found {len(callers)})")
    outside = c.js_outside("legacy_import")
    t.require_absent(outside, "runLegacyImport", "nothing outside the import block triggers an import")

    # --- import copies into the CURRENT scope via the scoped layer -----------
    t.require_present(block, "scopedSetJSON", "import writes through the scoped layer")
    t.require_present(block, "LEGACY_IMPORT_MARKER", "import bookkeeping is recorded")

    # --- audit result --------------------------------------------------------
    for field in ("imported", "skipped", "conflict", "invalid"):
        t.require_present(block, field, f"import result tracks '{field}'")

    # --- UI is wired ---------------------------------------------------------
    t.require_present(block, "function openLegacyImportModal", "import modal opener exists")
    t.require_present(block, "legacyImportPreview", "preview element is populated")

    modals = c.read_text(c.ROOT / "tmpl_modals.html")
    if t.require(modals is not None, "tmpl_modals.html exists"):
        t.require_present(modals, "legacyImportModal", "import modal exists in the UI")
        t.require_present(modals, "openLegacyImportModal()", "import modal is reachable from the UI")

    return t


if __name__ == "__main__":
    c.main(run)
