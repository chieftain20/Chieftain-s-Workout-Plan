"""STEP 5D staging E2E harness -- static safety + coverage contract.

The harness writes real rows, so its safety properties must be enforced
statically: it must be staging-only, secret-free, DDL-free, and wrapped in a
single transaction that ROLLS BACK.

EXPECTED STATUS: PASS.
"""

import re

import _common as c

E2E_PATH = c.ROOT / "supabase" / "tests" / "step5d_staging_e2e.sql"

REQUIRED_CHECKS = [f"T{n:02d}" for n in range(1, 18)]


def strip_dollar_bodies(text: str) -> str:
    out, i = [], 0
    while True:
        m = re.search(r"\$([A-Za-z_][A-Za-z0-9_]*)\$", text[i:])
        if not m:
            out.append(text[i:])
            break
        tag = m.group(0)
        start = i + m.start()
        out.append(text[i:start])
        end = text.find(tag, i + m.end())
        if end < 0:
            out.append("/*UNTERMINATED*/")
            break
        out.append("/*BODY*/")
        i = end + len(tag)
    return "".join(out)


def run() -> c.Contract:
    t = c.Contract("e2e_staging_safety")

    sql = c.read_text(E2E_PATH)
    if not t.require(sql is not None, "supabase/tests/account_scope_e2e_staging.sql exists"):
        return t

    live = "\n".join(line.split("--")[0] for line in sql.splitlines())
    outer = strip_dollar_bodies(live)

    # --- staging only, no secrets ------------------------------------------
    t.require_absent(sql, "dtdwutbzwddindwqqgir", "no production project ref")
    t.require_absent(sql, "supabase.co", "no project URL / endpoint")
    t.require_absent(sql, "sb_secret", "no secret key")
    t.require_absent(sql, "service_role_key", "no service-role key")
    t.require_absent(sql, "eyJ", "no JWT literal")
    t.require_match(sql, r"nyeqrujaicdcwicywgu", "names the staging project ref")
    t.require_match(sql, r"(?i)STAGING ONLY", "declared staging-only")

    # --- single transaction, ending in ROLLBACK ----------------------------
    t.require_match(outer, r"(?im)^\s*begin;", "wrapped in an explicit transaction")
    t.require_match(outer, r"(?im)^\s*rollback;", "ends with ROLLBACK")
    begins = len(re.findall(r"(?im)^\s*begin;", outer))
    rollbacks = len(re.findall(r"(?im)^\s*rollback;", outer))
    t.require(begins == 1, f"exactly one outer BEGIN (found {begins})")
    t.require(rollbacks == 1, f"exactly one ROLLBACK (found {rollbacks})")

    # ROLLBACK must come after BEGIN, and be the last statement
    b = outer.lower().rfind("begin;")
    r = outer.lower().rfind("rollback;")
    t.require(b >= 0 and r > b, "ROLLBACK comes after BEGIN")
    tail = outer[r + len("rollback;"):].strip()
    t.require(tail == "", f"nothing executable after ROLLBACK (found {tail[:40]!r})")

    # --- no DDL ------------------------------------------------------------
    for kw in ("drop table", "drop schema", "drop database", "drop function",
               "truncate", "alter table", "create table", "create index",
               "create policy", "grant ", "revoke "):
        t.require_absent(outer.lower(), kw, f"no `{kw.strip()}` in the harness")

    # --- writes are confined to the rolled-back transaction ----------------
    # Checked against RAW line numbers, because the writes live inside DO bodies.
    raw_lines = sql.splitlines()
    begin_line = next((i for i, l in enumerate(raw_lines) if l.strip().lower() == "begin;"), None)
    rollback_line = next((i for i, l in enumerate(raw_lines) if l.strip().lower() == "rollback;"), None)
    if t.require(begin_line is not None and rollback_line is not None, "outer BEGIN and ROLLBACK found"):
        for verb in ("insert into", "update ", "delete from"):
            hits = [i + 1 for i, l in enumerate(raw_lines)
                    if verb in l.lower() and not l.strip().startswith("--")]
            t.require(
                all(begin_line < h - 1 < rollback_line for h in hits),
                f"every `{verb.strip()}` sits inside the rolled-back transaction (lines {hits})",
            )
    t.require(
        sql.lower().count("insert into auth.users") == 1,
        "exactly one auth.users seed insert",
    )

    # --- deterministic fixtures, no credentials ----------------------------
    uuids = set(re.findall(r"'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'", sql))
    t.require(len(uuids) >= 8, f"uses fixed deterministic UUIDs (found {len(uuids)})")
    t.require_absent(sql.lower(), "apikey", "no API key is used anywhere")
    t.require_absent(sql.lower(), "service_role", "no service-role reference")
    # the seeded users carry an EMPTY password: no credential is created at all
    t.require_match(sql, r"@example\.test', '', now\(\)", "seeded users carry an empty password")
    t.require_absent(sql.lower(), "set password", "no password is set")
    t.require_absent(sql.lower(), "identified by", "no password clause")

    # --- coverage of the 17 required checks --------------------------------
    for check in REQUIRED_CHECKS:
        t.require_present(sql, f"{check} ", f"check {check} present")
        # T06 and T16 are split into a/b/c sub-checks
        t.require(
            f"{check} PASS" in sql or f"{check}a PASS" in sql,
            f"check {check} reports PASS",
        )

    t.require_present(sql, "auth.uid()", "asserts auth.uid() identity")
    t.require_present(sql, "insufficient_privilege", "asserts direct-write denial")
    t.require_present(sql, "tombstone", "asserts tombstone behaviour")
    t.require_present(sql, "expected_revision", "asserts CAS behaviour")
    t.require_present(sql, "ownerId", "asserts ownerId stripping")
    t.require_present(sql, "pin", "asserts PIN stripping")

    # --- Results-panel output contract -------------------------------------
    # The SQL Editor does not show RAISE NOTICE, so a SELECT must produce the
    # visible result. It has to sit BEFORE the ROLLBACK, and reaching it is
    # itself proof that every check passed (a failure raises and aborts).
    stmts = [x.strip() for x in re.sub(r"'(?:[^']|'')*'", "''", outer).split(";") if x.strip()]
    t.require(len(stmts) >= 2 and stmts[-1].lower() == "rollback", "ROLLBACK is the last statement")
    t.require(
        len(stmts) >= 2 and stmts[-2].lower().startswith("select"),
        "a SELECT produces the visible result immediately before ROLLBACK",
    )
    t.require_present(
        sql, "r(seq, check_id, status, message, checks_passed, checks_total)",
        "result columns: check_id, status, message, checks_passed, checks_total",
    )
    rows = re.findall(r"\(\s*\d+,\s*'(T\d\d|SUMMARY)'", sql)
    t.require(len(rows) == 18, f"one row per check plus a summary (found {len(rows)})")
    t.require(rows[-1] == "SUMMARY", "the summary row is last")
    for check in REQUIRED_CHECKS:
        t.require(check in rows, f"result row present for {check}")
    t.require_match(
        sql,
        r"'SUMMARY', 'PASS', '=== STEP 5D E2E: all 17 checks passed ===',\s*17,\s*17",
        "summary row carries status=PASS, checks_passed=17, checks_total=17",
    )

    return t


if __name__ == "__main__":
    c.main(run)
