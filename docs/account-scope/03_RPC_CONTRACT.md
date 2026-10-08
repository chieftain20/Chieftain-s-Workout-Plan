# RPC contract: signatures, security properties, CAS / tombstone / idempotency semantics

Companion to `00_OVERVIEW.md`, `01_SCHEMA.md`, `02_RLS_GRANTS.md`.

---

## 1. Universal properties of every RPC

| Property | Value |
|---|---|
| Language | `plpgsql` (except `owns_active_profile`, which is `sql`) |
| Security | `SECURITY DEFINER` |
| `search_path` | `''` (empty) — every identifier schema-qualified, every builtin `pg_catalog`-safe |
| Ownership source | `auth.uid()` **only**. No RPC accepts a `p_user_id` parameter. |
| Null auth | raises `28000` (`not authenticated`) |
| Bad profile key | raises `22023` (`invalid profile key`) |
| Not owner / no live routine | raises `42501` (`profile not owned`) |
| CAS conflict / tombstone hit | returns `NULL` — never raises, never partially writes |
| Return type | `bigint` — the row's new `revision`, or `NULL` |
| `EXECUTE` | revoked from `PUBLIC` and `anon`, granted to `authenticated` |
| Comment | every function carries a `comment on function` describing its contract |

**Why `NULL` instead of an exception for conflicts:** the client queues operations and replays them.
An exception is indistinguishable from a transport failure and would be retried forever; a `NULL`
revision is an unambiguous, idempotent "this did not apply, resolve it" signal that the outbox can
classify as a conflict.

## 2. Revision / CAS semantics

- `revision` starts at `1` on insert.
- Only the server increments it: `revision = revision + 1`. The client never sends a revision value
  other than as `p_expected_revision`.
- `p_expected_revision IS NULL` means **"I believe this row does not exist yet"** (insert path).
- `p_expected_revision = <n>` means **"I believe the row is at revision n"** (update path).
- A CAS operation succeeds iff the row is live **and** `revision = p_expected_revision`.
- On success the caller receives the new revision and must store it for the next operation on that
  row. On `NULL` the caller keeps its operation queued as a conflict.
- Monotonic per row, per account. `revision` is **not** a global clock and must never be compared
  across rows.

## 3. Tombstone semantics

- A tombstone is `deleted_at IS NOT NULL`. Rows are never hard-deleted.
- **A tombstoned row can never be updated or resurrected.** `upsert_*` on a tombstoned
  `client_record_id` returns `NULL` (not a new row, not an update). This is the retry-bug fix from the
  original handoff §9, stated as a hard rule.
- Tombstoning requires a matching `p_expected_revision`; a stale tombstone request returns `NULL`.
- Tombstoning sets `deleted_at = now()` and increments `revision`, so a client that missed the delete
  will conflict rather than silently overwrite.
- Tombstones are permanent in STEP 1. No purge job exists.

## 4. Idempotency semantics (`client_record_id`)

- `client_record_id` is **derived deterministically on the client** by uuid v5 over stable inputs, so
  the same logical record always yields the same id — including across a re-import or a replay:
  - logs: `v5(scope │ profile_key │ exercise_id │ timestamp)`
  - metrics: `v5(scope │ metric.id)` where `metric.id` is already `m_<epoch>` or an edit-supplied
    `recordId` (`app_engine.js:8663`)
  - custom exercises: `v5(scope │ 'cust_<epoch>')` (`app_engine.js:4981`)
- Deterministic derivation is what makes the legacy import safe to run twice and what makes an outbox
  replay a no-op rather than a duplicate.
- Set states need no `client_record_id`: their natural key `(user_id, profile_key, week_key)` is
  already unique.
- A unique-violation raised by a concurrent insert is caught and converted to `NULL` (conflict), never
  surfaced as an error.

## 5. Signatures

```sql
-- ownership helper
public.owns_active_profile(p_profile_key text) returns boolean

-- profiles / routines (registry)
public.upsert_routine(p_profile_key text, p_routine_data jsonb,
                      p_profile_data jsonb default null,
                      p_expected_revision bigint default null) returns bigint
public.tombstone_routine(p_profile_key text, p_expected_revision bigint) returns bigint

-- workout logs
public.upsert_workout_log(p_profile_key text, p_client_record_id uuid, p_exercise_id text,
                          p_log_entry jsonb, p_expected_revision bigint default null) returns bigint
public.update_workout_log(p_client_record_id uuid, p_log_entry jsonb,
                          p_expected_revision bigint) returns bigint
public.tombstone_workout_log(p_client_record_id uuid, p_expected_revision bigint) returns bigint

-- body metrics
public.upsert_body_metric(p_profile_key text, p_client_record_id uuid, p_metric_record jsonb,
                          p_expected_revision bigint default null) returns bigint
public.update_body_metric(p_client_record_id uuid, p_metric_record jsonb,
                          p_expected_revision bigint) returns bigint
public.tombstone_body_metric(p_client_record_id uuid, p_expected_revision bigint) returns bigint

-- custom exercises (account-scoped: no profile_key)
public.upsert_custom_exercise(p_client_record_id uuid, p_exercise_data jsonb,
                              p_expected_revision bigint default null) returns bigint
public.tombstone_custom_exercise(p_client_record_id uuid, p_expected_revision bigint) returns bigint

-- set states (profile + week scoped)
public.upsert_set_state(p_profile_key text, p_week_key text, p_state_data jsonb,
                        p_expected_revision bigint default null) returns bigint
public.tombstone_set_state(p_profile_key text, p_week_key text, p_expected_revision bigint) returns bigint
```

## 6. Per-RPC behaviour

### `owns_active_profile`
`select exists (select 1 from public.user_routines r where r.user_id = auth.uid() and r.profile_key = p_profile_key and r.deleted_at is null)`

### `upsert_routine`
The **only** RPC that may create a `profile_key`. It does **not** call `owns_active_profile` — it is
what makes a profile owned. It validates the key format, then:
- row exists and is tombstoned → `NULL`
- row exists and is live → requires `p_expected_revision = revision`, else `NULL`; updates
  `routine_data`, `profile_data`, `revision + 1`
- row does not exist → inserts with `revision = 1`

`p_profile_data` is stored **as received**; the client is responsible for having stripped `pin`
(B3). The RPC additionally strips a top-level `pin` key defensively before persisting, so a
regression in the client cannot leak a PIN into the cloud.

### `tombstone_routine`
The deletion path (decision A3). In one statement-scope:
1. tombstone the `user_routines` row (requires matching revision);
2. tombstone all `workout_set_states` rows for that `(user_id, profile_key)`;
3. set `profile_key = NULL` on that profile's `workout_logs` and `body_metrics` — **rows are
   preserved, only the association is dropped**, which is what makes the composite FK satisfiable;
4. return the routine's new revision, or `NULL` if the CAS check failed (in which case **nothing**
   in steps 1–3 happens).

### `upsert_workout_log` / `upsert_body_metric`
Require `owns_active_profile(p_profile_key)`. Upsert keyed by `(user_id, client_record_id)`.
Tombstoned → `NULL`. Live + mismatched revision → `NULL`. Live + matching → update + increment.
Absent → insert with `revision = 1`.

### `update_workout_log` / `update_body_metric`
Require a live row owned by `auth.uid()` with `revision = p_expected_revision`. No profile check —
the row already belongs to an owned profile. Tombstoned → `NULL`.

### `tombstone_workout_log` / `tombstone_body_metric`
Single conditional `UPDATE … WHERE user_id = auth.uid() AND client_record_id = … AND deleted_at IS NULL AND revision = p_expected_revision`.
Zero rows matched → `NULL`.

### `upsert_custom_exercise`
Account-scoped: validates `auth.uid()` and the payload, but **no profile check**. The server sets
`user_id` from `auth.uid()` and **strips `ownerId`** from `exercise_data` so the client cannot
declare ownership.

### `upsert_set_state` / `tombstone_set_state`
Require `owns_active_profile(p_profile_key)`. Keyed by `(user_id, profile_key, week_key)`.
`state_data` is replaced wholesale, which is why CAS matters here.

## 7. Grant statements (repeated per function)

```sql
revoke all on function public.<name>(<argtypes>) from public;
revoke all on function public.<name>(<argtypes>) from anon;
grant execute on function public.<name>(<argtypes>) to authenticated;
```

## 8. Known limitation carried into STEP 2

`upsert_custom_exercise` stores `exercise_data` as supplied. The client's `isApproved` /
`requestPublic` flags (`app_engine.js:4975–4977`) are admin-gated **only in the client**. If custom
exercises ever become globally visible, a user could self-approve. Today the table is account-private
so this is not exploitable, but the server should own those two flags before any global visibility
feature ships. Recorded as an unresolved technical issue; **not** solved in STEP 1.
