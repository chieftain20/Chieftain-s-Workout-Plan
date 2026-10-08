# Account-scoped cloud data — design overview

**Status:** STEP 1 design artifact. **Not applied.** No SQL has been executed against any
Supabase project. No application code has been changed.

**Baseline:** `9f2a133d00e5cb9e74e5e12ca7690cf3454bdd05` ("Hide cloud admin login behind explicit
management action"), equal to `refs/heads/main` on origin at the time of writing.
Proposed tag: `pre-account-scope-baseline` (not created — see §7).

---

## 1. Goal

Replace the current unscoped cloud sync with an **account-scoped** model in which:

- every cloud row is owned by exactly one Supabase Auth UUID;
- the client can only ever read or write rows belonging to the signed-in account;
- local data is namespaced per account and can never leak into another account;
- legacy (pre-migration) local data is imported **only** through an explicit user-confirmed flow;
- concurrent edits are resolved deterministically via revision/CAS rather than last-write-wins;
- deletes propagate as tombstones instead of vanishing or resurrecting;
- offline edits queue in an account-scoped outbox and replay safely.

## 2. Non-goals (STEP 1 scope fence)

Explicitly **not** in STEP 1, and not implemented by any artifact in this directory:

- refactoring `app_engine.js`;
- enabling the outbox;
- enabling legacy import;
- any change to frontend behaviour;
- any deployment, any SQL execution, any contact with staging or production.

## 3. The problem being fixed

`app_engine.js:6208–6224` enumerates **every** `chieftain_logs_*` key in `localStorage` — across all
profiles of all previous users on that device — and inserts them under whichever account just
logged in. `app_engine.js:6177–6185` auto-uploads the active profile's routine on first login.
`clearLocalUserData()` (`app_engine.js:5950`) clears only session tokens on account switch, so no
isolation exists. See `05_MIGRATION_PLAN.md` §1 for the full path trace.

## 4. Locked decisions

Resolved from code evidence during the design review. `A` = decided from existing code;
`B` = product decision, now locked by the maintainer.

| # | Decision | Class |
|---|---|---|
| A1 | `profile_key` domain is `text` matching `^[a-z0-9_]{1,64}$` | A |
| A2 | `user_routines` is the profile registry; a live routine row must exist before logs/metrics/set-states may attach to that `profile_key` | A |
| A3 | Deleting a profile tombstones the routine **and** its set states, and sets `profile_key = NULL` on that profile's logs and metrics (preserved, unassigned) | A |
| A4 | `revision` is owned by the server (RPC increments); starts at 1; monotonic per row; no trigger | A |
| A5 | Log identity: `client_record_id` = deterministic uuid v5(scope│profile_key│exercise_id│timestamp); `timestamp` stays inside `log_entry` | A |
| A6 | Metric identity: `client_record_id` = uuid v5(scope│metric.id) | A |
| A7 | Outbox storage: `localStorage`, one key per scope, capped with backpressure | A |
| A8 | One account may own multiple `profile_key`s | A |
| A9 | Custom exercises are **account-scoped**, not profile-scoped | A |
| A10 | "Legacy" = any key not prefixed `chieftain_v10:<scope>:`; explicit import only | A |
| A11 | `revision` applies to custom exercises and set states too | A |
| A12 | Custom exercises and set states are tombstoned, never hard-deleted | A |
| A13 | Conflict queue is indefinite; never auto-dropped; surfaced via a badge | A |
| A14 | `week_key` travels to the cloud; uniqueness `(user_id, profile_key, week_key)` | A |
| A15 | `profiles` (account) and `user_routines` (per-profile routine) both remain | A |
| B1 | Recovery redirect allowlist: `https://chieftain20.github.io/Chieftain-s-Workout-Plan/` + localhost. No invented Netlify URL; added later. | B |
| B2 | The authenticated admin account is a normal cloud-scoped account keyed by its real Auth UUID. Local `admin_hossein` remains a separate `local:` scope. Admin authentication mechanism untouched. | B |
| B3 | `prof.pin` is **never** synced. It is stripped from `profile_data` before persistence and remains device-local. | B |

## 5. Preserved surfaces (must not regress)

**Admin authentication — byte-identical.** The `cloud-admin-login` Edge Function
(`ADMIN_ACCESS_CODE` / `ADMIN_EMAIL` secrets, constant-time compare, per-IP rate limit, magiclink
`token_hash`), the client `verifyOtp({ token_hash, type: 'magiclink' })` exchange, the explicit
"ورود مدیریت" gate, and the offline `gym`/`haji` + `chieftain_admin_pin` path are all untouched.
`ADMIN_ACCESS_CODE` never appears in client code.

**Scientific volume model — untouched.** Direct = 1.0, indirect = 0.5, stability/corrective tracked
separately, RIR kept as a training-quality variable and never converted into a volume multiplier,
hip-thrust hamstrings = 0 (Plotkin 2023). Citations: Pelland et al. 2026 (PMID 41343037). New tables
store data *about* sets; they never recompute volume.

## 6. ⚠️ Critical ordering constraint

The migration **revokes** `INSERT`/`UPDATE`/`DELETE` on the four existing data tables from
`authenticated`, because all mutations move behind RPCs. The **currently deployed** frontend performs
direct `.from(...).insert()` calls and will break the moment this migration is applied.

> **The migration must never be applied to production before the STEP 2 frontend is deployed.**
> Staging first, always. This is recorded as gate G0 in `05_MIGRATION_PLAN.md`.

## 7. Baseline freeze

The repository had **0 tags** at the time of writing. The baseline commit is
`9f2a133d00e5cb9e74e5e12ca7690cf3454bdd05`.

**The tag `pre-account-scope-baseline` was NOT created.** The working copy used for this design work
is an isolated clone (`./repo`), not the maintainer's own working repository. Creating a tag here
would produce a reference that exists only in a throwaway copy and could not be pushed, so it is
deliberately left uncreated. It must be created in the maintainer's own working repository.

## 8. Artifacts in this STEP 1

| Path | Purpose |
|---|---|
| `docs/account-scope/00_OVERVIEW.md` | this file |
| `docs/account-scope/01_SCHEMA.md` | tables, columns, indexes, constraints, FK semantics |
| `docs/account-scope/02_RLS_GRANTS.md` | RLS policies and privilege design |
| `docs/account-scope/03_RPC_CONTRACT.md` | RPC signatures, security properties, CAS/tombstone/idempotency semantics |
| `docs/account-scope/04_CLIENT_CONTRACT.md` | local namespace, import, outbox, conflict, recovery, admin, PIN |
| `docs/account-scope/05_MIGRATION_PLAN.md` | leak trace, implementation order, safety gates, rollback |
| `supabase/migrations/20261008000000_account_scoped_cloud_data.sql` | the migration (additive, idempotent) |
| `supabase/diagnostics/account_scope_preflight.sql` | READ-ONLY preflight queries |
| `supabase/diagnostics/account_scope_postflight.sql` | READ-ONLY postflight verification |
| `supabase/tests/account_scope_contract.sql` | staging-only behavioural contract tests |
| `tests/account_scope/*.py` | local contract tests (some intentionally failing) |
| `tests/account_scope/run_step1_tests.py` | runner with expected/actual reporting |
