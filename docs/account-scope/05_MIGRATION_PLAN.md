# Migration plan: leak trace, implementation order, safety gates, rollback

Companion to `00_OVERVIEW.md`.

---

## 1. Exact leak trace (current code)

**Primary leak — unscoped upload loop**

```
app_engine.js:6153  async function syncCurrentDataWithSupabase()
app_engine.js:6208    const logsMap = getAllProfilesLogsMap();
app_engine.js:6209    for (const [key, entries] of Object.entries(logsMap)) {
app_engine.js:6210      const exId = key.replace(/^chieftain_logs_[^_]+_/, '');
app_engine.js:6213      const remoteHas = remoteLogs && remoteLogs.some(...)
app_engine.js:6215      await supabaseClient.from('workout_logs').insert({
app_engine.js:6216        user_id: userId,     // ← whichever account just logged in
app_engine.js:6217        exercise_id: exId,
app_engine.js:6218        log_entry: entry,
```

`getAllProfilesLogsMap()` (`app_engine.js:5489`) walks `localStorage.length` and returns **every**
key starting with `chieftain_logs_` — all profiles, all previous users on the device.

**Secondary leak — first-login routine auto-upload**

```
app_engine.js:6176    } else {
app_engine.js:6177      // First time login: auto-upload current profile routine (Zero Data Loss)
app_engine.js:6179      await supabaseClient.from('user_routines').upsert({
app_engine.js:6180        user_id: userId,
app_engine.js:6181        profile_key: prof.id,
```

**Enablers**

- `handleAuthSessionChanged` (`app_engine.js:5983`) calls `syncCurrentDataWithSupabase()` on **every**
  login and every session restore.
- `clearLocalUserData` (`app_engine.js:5950`) clears only session/unlock tokens on account switch, so
  account B sees account A's local logs and uploads them.
- Additional automatic call sites: `app_engine.js:6522` (routine load), `5376` (pull),
  `quickCloudSyncAction` (5658).

**Correct guard that must be preserved:** `getAuthenticatedSupabaseUserId()` (`app_engine.js:5770`)
plus `isUuid()` (5765) correctly prevent a non-UUID local id and a sessionless UUID from reaching an
insert. The bug is *what* is written, not *who* writes it.

## 2. Implementation order (STEP 2 and beyond)

| # | Step | Gate before proceeding |
|---|---|---|
| 0 | Freeze baseline; tag `pre-account-scope-baseline` in the maintainer's repo | tag exists |
| 1 | Design docs + migration + tests (**this STEP**) | review complete |
| 2 | Scope-aware storage adapter; delete the two enumeration helpers' unscoped behaviour | local tests green |
| 3 | Outbox engine, feature-flagged **off** | contract tests green |
| 4 | Explicit legacy-import flow, disabled until the migration is live | import tests green |
| 5 | Password recovery UI | recovery tests green |
| 6 | Switch all writes to RPCs; remove direct `.insert()` calls | no direct table writes remain |
| 7 | Staging rehearsal of the migration | G0–G8 |
| 8 | Deploy frontend to staging; verify end-to-end | staging verified |
| 9 | Production migration, then production frontend | explicit human approval |

Steps 2–6 are **frontend-only** and can ship to production safely ahead of the migration because the
old grants still permit direct writes; step 6 is the one that makes the migration mandatory.

## 3. Safety gates before any staging SQL

| Gate | Requirement |
|---|---|
| **G0** | The STEP 2 frontend is deployed and verified. The migration revokes `INSERT`/`UPDATE`/`DELETE`; applying it against the current client **breaks production**. This gate is absolute. |
| **G1** | All local contract tests green (including the intentionally-failing set, which must have flipped to passing). |
| **G2** | Migration reviewed line-by-line: additive, idempotent, no unqualified `DROP`/`TRUNCATE`/`DELETE`. Verified by `test_migration_artifact_contract.py`. |
| **G3** | `supabase/diagnostics/account_scope_preflight.sql` run via the **Dashboard SQL Editor** (the only confirmed working path) and all checks clean. |
| **G4** | Target project ref pinned to staging `nyeqrujaicdcwicywgu`; a guard refuses any other ref. |
| **G5** | Row counts of the four baseline tables exported before apply. |
| **G6** | `supabase/diagnostics/account_scope_postflight.sql` run; all checks pass. |
| **G7** | Rollback documented and rehearsed on staging. |
| **G8** | Explicit human approval. Production is never touched as part of staging work. |

## 4. Rollback

**Primary (non-destructive):** restore the pre-migration grants (see `02_RLS_GRANTS.md` §5) and
revert the frontend. New tables, columns and indexes are additive and harmless to leave in place; the
old client ignores them.

**Secondary (destructive, documented only):** dropping the new columns/tables is documented in the
trailing comment block of the migration. It destroys only new-format data, never baseline rows.

**Historical rows:** never modified by the migration, so no rollback action is required for them.

## 5. Explicitly out of scope for STEP 1

No SQL executed. No staging or production contact. No `app_engine.js` change. Outbox, import and
recovery are specified but not implemented. No deployment, no commit.
