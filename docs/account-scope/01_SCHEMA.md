# Schema, columns, indexes, constraints, FK semantics

Companion to `00_OVERVIEW.md`. Describes the target schema produced by
`supabase/migrations/20261008000000_account_scoped_cloud_data.sql`.

**Design rules applied:** additive where possible · idempotent (`if not exists` / guarded `do` blocks)
· no unqualified `DROP`/`TRUNCATE`/`DELETE` · compatible with the existing 4-table baseline ·
historical rows preserved untouched · reversible.

---

## 1. Baseline (unchanged, for reference)

Four tables exist today with RLS enabled and owner policies:

```
profiles(id pk→auth.users, display_name, avatar_url, role, updated_at)
user_routines(id pk, user_id→auth.users, profile_key, routine_data, updated_at, UNIQUE(user_id, profile_key))
workout_logs(id pk, user_id→auth.users, exercise_id, log_entry, created_at)
body_metrics(id pk, user_id→auth.users, metric_record, created_at)
```

`UNIQUE(user_id, profile_key)` on `user_routines` already exists. The migration additionally creates
a non-partial unique index on the same columns so the composite foreign keys have a stable,
name-independent target.

## 2. New table: `public.user_custom_exercises` — account-scoped

Custom exercises are keyed by **account**, not profile, because the client derives their owner from
`currentAuthUser?.id || currentLocalUser?.id || activeProfileId` (`app_engine.js:4978`), i.e. the
account, never the active profile.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | PK, `default gen_random_uuid()` |
| `user_id` | `uuid` | no | `references auth.users(id) on delete cascade` |
| `client_record_id` | `uuid` | no | idempotency key = uuid v5(scope│`cust_<epoch>`) |
| `exercise_data` | `jsonb` | no | client exercise document; `ownerId` stripped server-side |
| `revision` | `bigint` | no | `default 1`, CAS counter |
| `created_at` | `timestamptz` | no | `default timezone('utc', now())` |
| `updated_at` | `timestamptz` | no | `default timezone('utc', now())` |
| `deleted_at` | `timestamptz` | yes | tombstone |

**Constraints:** `UNIQUE(user_id, client_record_id)`.
**No** `profile_key`, **no** composite FK — deliberately, per decision A9.

## 3. New table: `public.workout_set_states` — profile + week scoped

Local shape is `{ weekKey, updatedAt, sets: { exId: [bool] } }` stored at
`chieftain_sets_<profileId>` (`app_engine.js:5039–5056`), with
`weekKey = getIranianWeekKey()` → `IR_WEEK_YYYY-MM-DD` (Saturday-anchored).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | PK, `default gen_random_uuid()` |
| `user_id` | `uuid` | no | `references auth.users(id) on delete cascade` |
| `profile_key` | `text` | no | owned profile |
| `week_key` | `text` | no | `IR_WEEK_YYYY-MM-DD` |
| `state_data` | `jsonb` | no | `{ sets: {...} }` payload |
| `revision` | `bigint` | no | `default 1` |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |
| `deleted_at` | `timestamptz` | yes | tombstone |

**Constraints:** `UNIQUE(user_id, profile_key, week_key)`; `CHECK` on `profile_key` format;
composite FK to `user_routines`.

## 4. Added columns on existing tables

### `public.user_routines`
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `profile_data` | `jsonb` | yes | — | full profile document **minus `pin`** (B3) |
| `revision` | `bigint` | no | `1` | CAS counter |
| `created_at` | `timestamptz` | no | `timezone('utc', now())` | |
| `deleted_at` | `timestamptz` | yes | — | tombstone |

### `public.workout_logs`
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `client_record_id` | `uuid` | yes | — | NULL for historical rows |
| `profile_key` | `text` | yes | — | NULL for historical rows |
| `revision` | `bigint` | no | `1` | |
| `deleted_at` | `timestamptz` | yes | — | |

### `public.body_metrics`
Identical set of four columns to `workout_logs`.

**Historical rows are not modified.** Pre-existing rows end up with
`client_record_id = NULL`, `profile_key = NULL`, `revision = 1`, `deleted_at = NULL`. They remain
fully readable and are **read-only under the new contract**, because every CAS operation is keyed by
`client_record_id`, which they do not have. No `UPDATE` statement is issued against historical rows
anywhere in the migration. An optional, **commented-out** backfill is documented in §8 for a later
explicit decision.

## 5. Indexes

| Index | Table | Definition | Purpose |
|---|---|---|---|
| `ux_user_routines_owner_profile` | `user_routines` | UNIQUE `(user_id, profile_key)` | FK target, name-independent |
| `ux_workout_logs_client_record` | `workout_logs` | UNIQUE `(user_id, client_record_id)` WHERE `client_record_id IS NOT NULL` | idempotency; partial so historical NULLs don't collide |
| `ux_body_metrics_client_record` | `body_metrics` | same, partial | idempotency |
| `ux_custom_exercises_client_record` | `user_custom_exercises` | UNIQUE `(user_id, client_record_id)` | idempotency |
| `ux_set_states_owner_profile_week` | `workout_set_states` | UNIQUE `(user_id, profile_key, week_key)` | idempotency |
| `idx_workout_logs_owner_profile` | `workout_logs` | `(user_id, profile_key)` | ownership joins |
| `idx_body_metrics_owner_profile` | `body_metrics` | `(user_id, profile_key)` | ownership joins |
| `idx_workout_logs_deleted_at` | `workout_logs` | `(deleted_at)` | tombstone filtering |
| `idx_body_metrics_deleted_at` | `body_metrics` | `(deleted_at)` | tombstone filtering |
| `idx_user_routines_deleted_at` | `user_routines` | `(deleted_at)` | registry filtering |
| `idx_set_states_owner_profile` | `workout_set_states` | `(user_id, profile_key)` | ownership joins |

All created with `create index if not exists` / `create unique index if not exists`.

## 6. Check constraints

`chk_profile_key_format` on `user_routines`, `workout_logs`, `body_metrics`,
`workout_set_states`:

```
CHECK (profile_key ~ '^[a-z0-9_]{1,64}$')
```

Derived from observed ids: `template_male`, `template_female`, `morvarid`, `hossein_chieftain`,
`admin_hossein`, `user_morvarid`, and user-created `prof_<epoch_ms>` (`app_engine.js:3440`).

Each is added **`NOT VALID`** so pre-existing rows can never block the migration. New and updated
rows are still checked. `VALIDATE CONSTRAINT` is a separate, later step (gate G6 / category-C check),
and is expected to pass trivially.

## 7. Foreign-key semantics

```
workout_logs      (user_id, profile_key) → user_routines(user_id, profile_key)
body_metrics      (user_id, profile_key) → user_routines(user_id, profile_key)
workout_set_states(user_id, profile_key) → user_routines(user_id, profile_key)
    on update cascade
    on delete restrict
    not valid
```

- **MATCH SIMPLE** (the default) means a composite FK is **not enforced when any component is NULL**.
  Historical rows with `profile_key IS NULL` are therefore unaffected, which is exactly why decision
  A3 nulls out `profile_key` on profile deletion instead of cascading a delete.
- **`on delete restrict`** — routines are never hard-deleted; deletion is a tombstone. `restrict` is a
  safety net that makes an accidental hard delete fail loudly rather than silently orphaning children.
- **`on update cascade`** — renaming a `profile_key` propagates to children.
- Added `NOT VALID` for safety; `VALIDATE CONSTRAINT` is a later, separate step.

## 8. Optional backfill — deliberately NOT enabled

Assigning `client_record_id` to historical rows requires an `UPDATE` over historical data. It is
**not** part of the migration. If it is ever wanted, it must be a separate, explicitly approved,
staging-verified step:

```sql
-- NOT PART OF THE MIGRATION. Do not run without explicit approval and a staging rehearsal.
-- update public.workout_logs
--    set client_record_id = gen_random_uuid()
--  where client_record_id is null;
-- update public.body_metrics
--    set client_record_id = gen_random_uuid()
--  where client_record_id is null;
```

Consequence of leaving it disabled: historical rows cannot be updated or tombstoned through CAS.
They are read-only legacy history. This is the conservative, non-destructive choice.

## 9. Reversibility

Every change is additive. The **non-destructive rollback** is:

1. restore the pre-migration table grants (see `02_RLS_GRANTS.md` §5);
2. stop using the RPCs (the client reverts with the frontend).

New tables, columns and indexes may simply be left in place — the old client ignores them. Dropping
them is documented in the migration's trailing comment block and is **destructive for the new
columns only**; it never touches baseline data.
