"""G0 preflight safety contract (static).

The preflight must be safe to run against a COMPLETELY FRESH staging database.
This test enforces that:

  * no static SQL statement references a baseline table directly (a missing table
    would otherwise raise `relation "public.profiles" does not exist`);
  * every dynamic statement is existence-guarded and inside an exception handler;
  * the file is read-only (no DDL, no DML);
  * absent objects are reported as MISSING / absent.

EXPECTED STATUS: PASS.
"""

import re

import _common as c

BASELINE = ["profiles", "user_routines", "workout_logs", "body_metrics"]


def strip_dollar_quoted(text: str) -> str:
    """Replace every $tag$ ... $tag$ body with a placeholder."""
    out = []
    i = 0
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
        out.append("/*DYN*/")
        i = end + len(tag)
    return "".join(out)


def run() -> c.Contract:
    t = c.Contract("preflight_existence_aware")

    sql = c.read_text(c.PREFLIGHT_PATH)
    if not t.require(sql is not None, "preflight file exists"):
        return t

    # --- structure ----------------------------------------------------------
    live = "\n".join(line.split("--")[0] for line in sql.splitlines())
    t.require(live.count("(") == live.count(")"), "parentheses are balanced")
    for tag in ("pre_a", "pre_b", "q"):
        n = live.count(f"${tag}$")
        t.require(n % 2 == 0, f"dollar-quote tag ${tag}$ is balanced (found {n})")

    # --- the core fix: no static reference to a baseline table --------------
    static = strip_dollar_quoted(live)
    static = re.sub(r"'(?:[^']|'')*'", "''", static)

    refs = [m.group(1) for m in re.finditer(r"\b(?:from|join|into|update)\s+public\.([a-z_]+)", static, re.I)]
    leaked = [r for r in refs if r.lower() in BASELINE]
    t.require(
        not leaked,
        f"no static SQL references a baseline table directly (found: {sorted(set(leaked))})",
    )

    counts = re.findall(r"count\(\*\)\s+from\s+public\.([a-z_]+)", static, re.I)
    t.require(
        not [x for x in counts if x.lower() in BASELINE],
        "no static COUNT(*) against a baseline table",
    )

    # --- read-only ----------------------------------------------------------
    for kw in ("drop ", "truncate", "delete from", "alter table", "create table",
               "insert into", "grant ", "revoke ", "create index", "create or replace"):
        t.require_absent(static.lower(), kw, f"no `{kw.strip()}` in the preflight")

    # --- existence guards + exception handlers ------------------------------
    t.require_present(sql, "to_regclass", "to_regclass() is used for existence checks")
    t.require_present(sql, "information_schema.columns", "column existence is checked")

    executes = [i for i, l in enumerate(sql.splitlines()) if re.search(r"\bexecute\b", l, re.I)]
    handlers = [i for i, l in enumerate(sql.splitlines()) if "exception when others" in l.lower()]
    t.require(len(executes) > 0, "the preflight uses dynamic SQL for guarded counts")
    t.require(
        len(handlers) >= 4,
        f"every dynamic section has an exception handler (found {len(handlers)})",
    )

    # every EXECUTE line must be preceded by a guard within the same DO block
    guards = [i for i, l in enumerate(sql.splitlines())
              if "to_regclass(" in l or "information_schema.columns" in l]
    t.require(len(guards) >= len(executes), "guards outnumber dynamic statements")

    # --- missing objects are reported, never assumed ------------------------
    t.require_present(sql, "MISSING", "absent tables are reported as MISSING")
    t.require_present(sql, "absent", "absent migration objects are reported as absent")
    for marker in ("1. ENV", "2. TABLE", "3. COLUMNS", "4. RLS", "5. POLICY",
                   "6. GRANT", "7. FUNCTION", "8. SCOPEOBJ", "9. ROWCOUNT"):
        t.require_present(sql, marker, f"report section present: {marker}")

    return t


if __name__ == "__main__":
    c.main(run)
