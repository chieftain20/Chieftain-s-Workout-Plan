"""Shared helpers for the account-scope contract tests.

These tests are static: they read the repository's own artifacts and assert the
STEP 1 contract. They never touch the network, Supabase, or any database.

Some tests are EXPECTED TO FAIL in STEP 1, because the migration has not been
applied and app_engine.js has not yet been changed. run_step1_tests.py knows
which is which and reports the difference.
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]

APP_JS_PATH = ROOT / "app_engine.js"
MIGRATION_PATH = ROOT / "supabase" / "migrations" / "20261008000000_account_scoped_cloud_data.sql"
PREFLIGHT_PATH = ROOT / "supabase" / "diagnostics" / "account_scope_preflight.sql"
POSTFLIGHT_PATH = ROOT / "supabase" / "diagnostics" / "account_scope_postflight.sql"
SQL_TESTS_PATH = ROOT / "supabase" / "tests" / "account_scope_contract.sql"
ADMIN_FN_PATH = ROOT / "supabase" / "functions" / "cloud-admin-login" / "index.ts"
SCIENCE_DOC_PATH = ROOT / "SCIENTIFIC_VOLUME_MODEL.md"
SCIENCE_TEST_PATH = ROOT / "test_scientific_summary.py"

DOCS = [
    ROOT / "docs" / "account-scope" / "00_OVERVIEW.md",
    ROOT / "docs" / "account-scope" / "01_SCHEMA.md",
    ROOT / "docs" / "account-scope" / "02_RLS_GRANTS.md",
    ROOT / "docs" / "account-scope" / "03_RPC_CONTRACT.md",
    ROOT / "docs" / "account-scope" / "04_CLIENT_CONTRACT.md",
    ROOT / "docs" / "account-scope" / "05_MIGRATION_PLAN.md",
]

MUTATION_RPCS = [
    "upsert_routine", "tombstone_routine",
    "upsert_workout_log", "update_workout_log", "tombstone_workout_log",
    "upsert_body_metric", "update_body_metric", "tombstone_body_metric",
    "upsert_custom_exercise", "tombstone_custom_exercise",
    "upsert_set_state", "tombstone_set_state",
]


def read_text(path: Path):
    """Return file text, or None when the file does not exist."""
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    except OSError:
        return None


def strip_sql_comments(sql: str) -> str:
    """Remove `--` line comments so rollback blocks are not treated as live code."""
    out = []
    for line in sql.splitlines():
        idx = line.find("--")
        out.append(line if idx < 0 else line[:idx])
    return "\n".join(out)


def strip_js_comments(js: str) -> str:
    """Remove `//` line comments so prose never satisfies a source assertion."""
    out = []
    for line in js.splitlines():
        idx = line.find("//")
        out.append(line if idx < 0 else line[:idx])
    return "\n".join(out)


SCOPE_BLOCK_BEGIN = "// >>> ACCOUNT_SCOPE_STORAGE_BEGIN"
SCOPE_BLOCK_END = "// <<< ACCOUNT_SCOPE_STORAGE_END"
OUTBOX_BLOCK_BEGIN = "// >>> CLOUD_OUTBOX_BEGIN"
OUTBOX_BLOCK_END = "// <<< CLOUD_OUTBOX_END"


def _extract(begin_marker: str, end_marker: str) -> str:
    js = read_text(APP_JS_PATH)
    if not js:
        return ""
    start = js.find(begin_marker)
    end = js.find(end_marker)
    if start < 0 or end < 0 or end <= start:
        return ""
    return js[start + len(begin_marker):end]


def scope_block() -> str:
    """Return the account-scope storage layer exactly as it appears in app_engine.js."""
    return _extract(SCOPE_BLOCK_BEGIN, SCOPE_BLOCK_END)


def outbox_block() -> str:
    """Return the outbox/cloud-sync layer exactly as it appears in app_engine.js."""
    return _extract(OUTBOX_BLOCK_BEGIN, OUTBOX_BLOCK_END)


def storage_and_outbox() -> str:
    """Both layers, in dependency order, ready to execute in Node."""
    return scope_block() + "\n" + outbox_block()


LEGACY_IMPORT_BLOCK_BEGIN = "// >>> LEGACY_IMPORT_BEGIN"
LEGACY_IMPORT_BLOCK_END = "// <<< LEGACY_IMPORT_END"
PASSWORD_RECOVERY_BLOCK_BEGIN = "// >>> PASSWORD_RECOVERY_BEGIN"
PASSWORD_RECOVERY_BLOCK_END = "// <<< PASSWORD_RECOVERY_END"
CLOUD_PULL_BLOCK_BEGIN = "// >>> CLOUD_PULL_BEGIN"
CLOUD_PULL_BLOCK_END = "// <<< CLOUD_PULL_END"
CONFLICT_UI_BLOCK_BEGIN = "// >>> CONFLICT_UI_BEGIN"
CONFLICT_UI_BLOCK_END = "// <<< CONFLICT_UI_END"
EMAIL_CONFIRM_BLOCK_BEGIN = "// >>> EMAIL_CONFIRM_BEGIN"
EMAIL_CONFIRM_BLOCK_END = "// <<< EMAIL_CONFIRM_END"

BLOCK_MARKERS = {
    "legacy_import": (LEGACY_IMPORT_BLOCK_BEGIN, LEGACY_IMPORT_BLOCK_END),
    "password_recovery": (PASSWORD_RECOVERY_BLOCK_BEGIN, PASSWORD_RECOVERY_BLOCK_END),
    "cloud_pull": (CLOUD_PULL_BLOCK_BEGIN, CLOUD_PULL_BLOCK_END),
    "conflict_ui": (CONFLICT_UI_BLOCK_BEGIN, CONFLICT_UI_BLOCK_END),
    "email_confirm": (EMAIL_CONFIRM_BLOCK_BEGIN, EMAIL_CONFIRM_BLOCK_END),
}


def legacy_import_block() -> str:
    return _extract(LEGACY_IMPORT_BLOCK_BEGIN, LEGACY_IMPORT_BLOCK_END)


def password_recovery_block() -> str:
    return _extract(PASSWORD_RECOVERY_BLOCK_BEGIN, PASSWORD_RECOVERY_BLOCK_END)


def cloud_pull_block() -> str:
    return _extract(CLOUD_PULL_BLOCK_BEGIN, CLOUD_PULL_BLOCK_END)


def conflict_ui_block() -> str:
    return _extract(CONFLICT_UI_BLOCK_BEGIN, CONFLICT_UI_BLOCK_END)


def email_confirm_block() -> str:
    """Return the signup email-confirmation (TokenHash) layer."""
    return _extract(EMAIL_CONFIRM_BLOCK_BEGIN, EMAIL_CONFIRM_BLOCK_END)


def js_outside(*block_names: str) -> str:
    """app_engine.js with the named blocks excised (by begin/end marker)."""
    js = read_text(APP_JS_PATH) or ""
    for name in block_names:
        begin, end = BLOCK_MARKERS[name]
        start = js.find(begin)
        stop = js.find(end)
        if start >= 0 and stop > start:
            js = js[:start] + js[stop + len(end):]
    return js


def storage_outbox_and_legacy() -> str:
    """Storage + outbox + legacy import, in dependency order."""
    return scope_block() + "\n" + outbox_block() + "\n" + legacy_import_block()


def storage_outbox_and_pull() -> str:
    """Storage + outbox + cloud pull, in dependency order."""
    return scope_block() + "\n" + outbox_block() + "\n" + cloud_pull_block()


def storage_outbox_pull_conflict() -> str:
    """Storage + outbox + pull + conflict UI, in dependency order."""
    return scope_block() + "\n" + outbox_block() + "\n" + cloud_pull_block() + "\n" + conflict_ui_block()


def function_body(js: str, name: str) -> str:
    """Return the source of a top-level `function <name>(...) { ... }` block.

    Braces are counted so nested blocks are handled; returns "" when not found.
    """
    marker = f"function {name}("
    start = js.find(marker)
    if start < 0:
        return ""
    depth = 0
    i = js.find("{", start)
    if i < 0:
        return ""
    for j in range(i, len(js)):
        if js[j] == "{":
            depth += 1
        elif js[j] == "}":
            depth -= 1
            if depth == 0:
                return js[start:j + 1]
    return ""


class Contract:
    """Collects contract violations and reports them in a uniform format."""

    def __init__(self, name: str):
        self.name = name
        self.checks = 0
        self.missing = []

    def require(self, condition, label: str):
        self.checks += 1
        if not condition:
            self.missing.append(label)
        return bool(condition)

    def require_match(self, text, pattern: str, label: str):
        found = bool(text) and re.search(pattern, text, re.MULTILINE) is not None
        return self.require(found, label)

    def require_absent(self, text, needle: str, label: str):
        found = bool(text) and needle in text
        return self.require(not found, label)

    def require_present(self, text, needle: str, label: str):
        found = bool(text) and needle in text
        return self.require(found, label)

    def finish(self) -> int:
        passed = self.checks - len(self.missing)
        status = "PASS" if not self.missing else "FAIL"
        print(f"[{self.name}] {status}  ({passed}/{self.checks} checks)")
        for item in self.missing:
            print(f"    MISSING: {item}")
        return 0 if not self.missing else 1


def main(fn):
    """Run a test body, print its report, and exit with its status code."""
    contract = fn()
    sys.exit(contract.finish())
