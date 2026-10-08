# RLS policies and privilege design

Companion to `00_OVERVIEW.md` and `01_SCHEMA.md`.

---

## 1. Threat model

The only actor this design defends against is an **authenticated user holding a valid JWT for their
own account** — plus `anon`. Specifically:

- user B must never read or write user A's rows;
- a user must never be able to attach a row to a `profile_key` they do not own;
- a user must never be able to resurrect a tombstoned row;
- a user must never be able to self-elevate `profiles.role`;
- a user must never be able to set an arbitrary `user_id` on a write.

Server-side secrets, the service role, and the Edge Function are out of scope here (unchanged).

## 2. The RLS-bypass fact that drives the whole design

The RPCs are `SECURITY DEFINER`. They execute as the function owner, which is the table owner, and
**PostgreSQL does not apply row-level security to the table owner** unless `FORCE ROW LEVEL SECURITY`
is set. Therefore:

> **RLS policies do not constrain RPC writes. Every RPC must perform its own explicit ownership
> check against `auth.uid()`.**

This is intentional and is the reason the RPCs are the *only* write path. It also means the RPC
bodies are the security boundary and must be reviewed as such (`03_RPC_CONTRACT.md`).

## 3. Policy set after the migration

### Unchanged
`profiles` — all three policies remain exactly as in the baseline:
`Users can view own profile` (SELECT), `Users can insert own profile` (INSERT),
`Users can update own profile` (UPDATE), plus the column-level `UPDATE` grant. The
`prevent_profile_role_escalation` trigger is untouched.

### Narrowed
`user_routines`, `workout_logs`, `body_metrics` currently carry a single `FOR ALL` owner policy. These
are replaced with a `FOR SELECT` owner policy, matching the new SELECT-only grants. Narrowing (not
deleting) the policy set keeps policy and grant in agreement and removes the illusion that a client
could write directly.

| Table | Policy | Command | Predicate |
|---|---|---|---|
| `user_routines` | `Users can read own routines` | SELECT | `auth.uid() = user_id` |
| `workout_logs` | `Users can read own workout logs` | SELECT | `auth.uid() = user_id` |
| `body_metrics` | `Users can read own body metrics` | SELECT | `auth.uid() = user_id` |

The old `FOR ALL` policies are dropped with fully-qualified `drop policy if exists … on public.<t>`
statements (no unqualified `DROP`). The previous names are dropped too, so both historical naming
variants are cleaned up.

### New
| Table | Policy | Command | Predicate |
|---|---|---|---|
| `user_custom_exercises` | `Users can read own custom exercises` | SELECT | `auth.uid() = user_id` |
| `workout_set_states` | `Users can read own set states` | SELECT | `auth.uid() = user_id` |

No INSERT / UPDATE / DELETE policies exist for any data table. Writes are RPC-only.

## 4. The ownership helper

```sql
public.owns_active_profile(p_profile_key text) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
```

Returns true iff a **live** (`deleted_at is null`) `user_routines` row exists for
`(auth.uid(), p_profile_key)`.

Why a helper rather than an inline `EXISTS` in each RPC: it centralises the ownership predicate so it
cannot drift between RPCs, and it avoids nesting a RLS-governed subquery inside policy expressions.

Grants: `revoke execute from public, anon` · `grant execute to authenticated`.

## 5. Grants and revokes

### Target state

| Object | `anon` | `authenticated` |
|---|---|---|
| `profiles` | none | `SELECT`, `INSERT`, `UPDATE(display_name, avatar_url, updated_at)` *(unchanged)* |
| `user_routines` | none | `SELECT` only |
| `workout_logs` | none | `SELECT` only |
| `body_metrics` | none | `SELECT` only |
| `user_custom_exercises` | none | `SELECT` only |
| `workout_set_states` | none | `SELECT` only |
| all RPCs | none | `EXECUTE` |
| `owns_active_profile` | none | `EXECUTE` |

### Statements

For each of `user_routines`, `workout_logs`, `body_metrics`, `user_custom_exercises`,
`workout_set_states`:

```sql
revoke all on table public.<t> from anon;
revoke insert, update, delete, truncate, trigger, references on table public.<t> from authenticated;
grant select on table public.<t> to authenticated;
```

`MAINTAIN` (PostgreSQL 17) is revoked separately inside a version-guarded `do` block with an
exception handler, so the migration remains safe on PostgreSQL 15/16 as well.

### ⚠️ Pre-migration grants that are intentionally removed

`authenticated` currently holds `INSERT, UPDATE, DELETE` on `user_routines`, `workout_logs` and
`body_metrics`. **The migration revokes all three.** This is the least-privilege target state, and it
is what forces the ordering constraint in `00_OVERVIEW.md` §6.

### Restore statements (for the non-destructive rollback)

```sql
grant select, insert, update, delete on table public.user_routines  to authenticated;
grant select, insert, update, delete on table public.workout_logs   to authenticated;
grant select, insert, update, delete on table public.body_metrics   to authenticated;
```

## 6. What is deliberately NOT done

- **No `FORCE ROW LEVEL SECURITY`.** It would apply RLS to the RPC owner and break the RPCs. The
  explicit `auth.uid()` checks inside each RPC are the substitute.
- **No admin bypass clause.** Per B2 the admin account is an ordinary scoped account, so no
  `is_admin()` branch exists anywhere in the policy or RPC layer. This removes an entire class of
  privilege-escalation bug.
- **No `USING (true)` anywhere.**
- **No policy on `auth.users`** — never touched.
- **No change to the role-escalation trigger.**
