# PHASE 5A — G0 Preflight Result (post-baseline)

**Verdict: G0 PASSES.** The baseline is in place, every migration assumption about schema,
columns, RLS and policies holds, and there is no data to preserve.

**One finding requires a decision before PHASE 5B** — the migration's revoke set is incomplete
against the ACLs Supabase actually created. Details in §4. Nothing was modified.

- Target: staging `nyeqrujaicdcwicywgu` — PostgreSQL **17.11**, database `postgres`, role `postgres`
- Baseline: `supabase_setup.sql` applied successfully
- No SQL executed by me. No migration applied. No production contact.

---

## 1. Baseline confirmed

| Check | Result |
|---|---|
| `public base tables` | **4** (was 0) |
| `profiles`, `user_routines`, `workout_logs`, `body_metrics` | **all present** |
| Columns | exactly as authored in `supabase_setup.sql` (21 columns total) |
| RLS | **enabled** on all four, `force_row_level_security=false` |
| Policies | **6**, exactly the baseline set |
| `prevent_profile_role_escalation` | **present**, `secdef=true`, `cfg=search_path=""` |
| Row counts | **0** on all four tables |
| Account-scope objects | all absent (2 tables, 12 columns, 13 RPCs) |

### Columns observed

| Table | Columns |
|---|---|
| `profiles` | `id` (uuid, pk), `display_name`, `avatar_url`, `role` (default `'user'`), `updated_at` |
| `user_routines` | `id` (uuid, default `gen_random_uuid()`), `user_id`, `profile_key` (default `'default'`), `routine_data` (jsonb), `updated_at` |
| `workout_logs` | `id`, `user_id`, `exercise_id`, `log_entry` (jsonb), `created_at` |
| `body_metrics` | `id`, `user_id`, `metric_record` (jsonb), `created_at` |

### Policies observed

| Table | Policy | Command | Role |
|---|---|---|---|
| `profiles` | Users can view own profile | SELECT | authenticated |
| `profiles` | Users can insert own profile | INSERT | authenticated |
| `profiles` | Users can update own profile | UPDATE | authenticated |
| `user_routines` | Users can manage own routines | ALL | authenticated |
| `workout_logs` | Users can manage own workout logs | ALL | authenticated |
| `body_metrics` | Users can manage own body metrics | ALL | authenticated |

---

## 2. Migration assumptions — verified one by one

| # | Migration assumption | Actual | Verdict |
|---|---|---|---|
| 1 | `public.user_routines` exists to `add column` | present | PASS |
| 2 | `public.workout_logs` exists to `add column` | present | PASS |
| 3 | `public.body_metrics` exists to `add column` | present | PASS |
| 4 | `public.profiles` exists for `enable row level security` | present | PASS |
| 5 | `user_routines` has `(user_id, profile_key)` unique → valid composite-FK target | `unique(user_id, profile_key)` present | PASS |
| 6 | No pre-existing `client_record_id` / `profile_key` columns to conflict with | absent | PASS |
| 7 | `authenticated` currently holds broad write grants that must be revoked | holds INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES | PASS — **but see §4** |
| 8 | Existing RLS policies to narrow exist | 3 × `ALL` owner policies present | PASS |
| 9 | `profiles` policies to preserve exist | 3 policies present | PASS |
| 10 | No partial account-scope objects from a previous attempt | all absent | PASS |

### Nothing to preserve

All four tables are **empty**. Therefore:
- no duplicate `(user_id, client_record_id)` groups can exist (column doesn't exist yet);
- no NULL or non-conforming `profile_key` values exist;
- **no historical rows exist**, so the migration's "preserve historical rows" behaviour is a
  no-op on staging. The postflight expectation "historical row counts unchanged" is trivially
  0 → 0.

---

## 3. ACL reality — the most valuable G0 output

Supabase's **default privileges** granted `ALL` on every table in `public` to `anon`,
`authenticated` and `service_role` when `supabase_setup.sql` created them. Observed privileges
per table: `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES`.

This confirms the "ACL extras" the original handoff warned about (`TRUNCATE`, `TRIGGER`,
`REFERENCES`) — and they are present on **all four** tables, for **three** roles.

`MAINTAIN` is not visible: `information_schema.role_table_grants` does not expose it. The
migration's version-guarded `revoke maintain` covers it regardless, and is a no-op if absent.

Notable: the baseline's `revoke update, delete on table public.profiles from authenticated`
**worked** — `authenticated` shows no table-level `UPDATE`/`DELETE` on `profiles`, and the
column-level `UPDATE (display_name, avatar_url, updated_at)` grant lives in
`role_column_grants`, which this report does not list.

---

## 4. ⚠️ Finding — the migration's revoke set is incomplete

The migration's stated target (`docs/account-scope/02_RLS_GRANTS.md`) is:

| Table | `anon` | `authenticated` |
|---|---|---|
| all five data tables | **none** | **SELECT only** |
| `profiles` | **none** | SELECT, INSERT, column-UPDATE |

The current SECTION 8 does not fully reach that target. **Three gaps:**

| Gap | What survives | Why it happens |
|---|---|---|
| **G1** | `authenticated` keeps `INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES` on **`user_custom_exercises`** and **`workout_set_states`** | The migration only does `revoke all … from anon` on the two new tables. It never revokes the Supabase default `ALL` from `authenticated`, so only `grant select` is layered on top. |
| **G2** | `anon` keeps **`SELECT`** on `user_routines`, `workout_logs`, `body_metrics` | The migration revokes the six write-ish privileges from `anon` but never `SELECT`. `revoke all` is used only for the new tables and `profiles`. |
| **G3** | `authenticated` keeps `TRUNCATE, TRIGGER, REFERENCES` on **`profiles`** | The baseline only revoked table-level `UPDATE`/`DELETE`. The remaining extras came from Supabase defaults and are never revoked. |

### Why this matters

RLS blocks ordinary `INSERT`/`UPDATE`/`DELETE` (no such policy exists on the new tables), so the
main exposure is not a straightforward data leak. But **`TRUNCATE` is not subject to RLS**, and
`TRIGGER`/`REFERENCES` are schema-level privileges. Least privilege says remove them, and the
project's own design document and postflight test (`account_scope_postflight.sql`, check **V7**:
"authenticated → SELECT only, anon → no rows") require it.

**Left unfixed, postflight V7 would fail** and the migration would have to be re-applied.

### Proposed fix — 12 statements, to be inserted into SECTION 8

```sql
-- anon: no access at all to any of the six tables
revoke all on table public.profiles              from anon;
revoke all on table public.user_routines         from anon;
revoke all on table public.workout_logs          from anon;
revoke all on table public.body_metrics          from anon;
revoke all on table public.user_custom_exercises from anon;
revoke all on table public.workout_set_states    from anon;

-- authenticated: SELECT only on the five data tables
revoke insert, update, delete, truncate, trigger, references on table public.user_routines         from authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.workout_logs          from authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.body_metrics          from authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.user_custom_exercises from authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.workout_set_states    from authenticated;

-- profiles: keep SELECT + INSERT + column-level UPDATE; drop the schema-level extras
revoke truncate, trigger, references on table public.profiles from authenticated;
```

These are all `REVOKE`s — idempotent, non-destructive, and they cannot remove anything a client
legitimately needs (RLS already denies those paths, and `service_role` is untouched).

**Not applied. Awaiting approval.**

---

## 5. G0 checklist outcome

| G0 item | Outcome |
|---|---|
| 1. Verify target is exactly `nyeqrujaicdcwicywgu` | **PASS** |
| 2. Current schema state | **CAPTURED** — 4 tables, 21 columns, RLS on, 6 policies, 1 function |
| 3. Read-only SQL only | **PASS** |
| 4. Baseline row counts | **CAPTURED** — 0 / 0 / 0 / 0 |
| 5. Phase 2/3 objects, migration objects, duplicates, invalid keys, ACL extras, policies | **CAPTURED** — no migration objects; ACL extras present; see §3–§4 |
| 6. Migration assumptions match actual DB | **PASS** — all 10 assumptions hold |
| 7. Nothing modified | **HONOURED** |

**No STOP condition is triggered.**

---

## 6. Next step

1. Approve (or amend) the §4 revoke fix and let me patch the migration.
2. Then, on separate approval, PHASE 5B — apply
   `supabase/migrations/20261008000000_account_scoped_cloud_data.sql` to staging.
3. Then PHASE 5C — postflight + `supabase/tests/account_scope_contract.sql`.

`CLOUD_SYNC_GATE.contractVerified` remains **false**.
