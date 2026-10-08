# Client contract: namespace, import, outbox, conflict, recovery, admin, PIN

Companion to `00_OVERVIEW.md`. This document specifies the **STEP 2 target behaviour**. Nothing here
is implemented in STEP 1; `app_engine.js` is untouched.

---

## 1. Account scope

A single function derives the scope from the active identity:

```
scopeKey() =
    currentAuthUser is a real UUID   → "uuid:" + currentAuthUser.id
    currentLocalUser is set          → "local:" + currentLocalUser.id
    otherwise                        → "local:anonymous"
```

`uuid:<supabase-auth-uuid>` and `local:<offline-id>` (e.g. `local:admin_hossein`) never share keys.
Per B2 the cloud admin is an ordinary `uuid:` scope; the local `admin_hossein` identity stays a
separate `local:` scope.

## 2. Local-storage namespace

All user data moves under a single versioned prefix:

```
chieftain_v10:<scope>:<name>[:<sub>]
```

| Current key | New key |
|---|---|
| `chieftain_profiles_v9` | `chieftain_v10:<scope>:profiles` |
| `chieftain_active_profile_id` | `chieftain_v10:<scope>:active_profile_id` |
| `chieftain_logs_<profileId>_<exerciseId>` | `chieftain_v10:<scope>:logs:<profileId>:<exerciseId>` |
| `chieftain_metrics_<profId>` | `chieftain_v10:<scope>:metrics:<profId>` |
| `chieftain_sets_<profileId>` | `chieftain_v10:<scope>:sets:<profileId>` |
| `chieftain_draft_log_<profileId>_<exId>` | `chieftain_v10:<scope>:draft:<profileId>:<exId>` |
| `chieftain_custom_exercises` | `chieftain_v10:<scope>:custom_exercises` |
| `chieftain_master_overrides` | `chieftain_v10:<scope>:master_overrides` |
| *(new)* | `chieftain_v10:<scope>:outbox` |

### The rule that removes the leak

Enumerating keys must go through a **scope-filtered** iterator. The replacement for
`getAllProfilesLogsMap()` (`app_engine.js:5489`) and `getAllProfilesSetsMap()`
(`app_engine.js:5528`) iterates `Object.keys(localStorage)` but **only returns keys beginning with
`chieftain_v10:<scope>:`. A key belonging to another scope is invisible by construction — there is no
code path that can return it.

Non-account keys are deliberately **not** namespaced and stay global: `chieftain_theme`,
`chieftain_lang`, `chieftain_ui_mode`, `chieftain_palette`, `chieftain_hero_collapsed`,
`chieftain_admin_pin`, `chieftain_admin_unlocked`, `chieftain_auto_cloud_sync`.

## 3. Local-storage migration (v9 → v10)

- On first load, if any legacy unscoped key exists and the current scope has no `profiles` key, the
  app writes a single marker `chieftain_v10:legacy_snapshot:<timestamp>` and **does nothing else**.
- Legacy keys are **never** moved, copied, rewritten or deleted automatically.
- A dismissible banner offers the explicit import flow (§4). Until the user acts, the app runs on an
  empty scoped workspace and syncs nothing.
- This is the direct fix for handoff §4's requirement: legacy data can never be uploaded into
  whichever account happens to log in.

## 4. Explicit legacy import

Entry point: a user-initiated "import local data into this account" action. Nothing imports without
an explicit confirmation.

1. Enumerate legacy keys; build a preview: profile count, log count, metric count, set-state count,
   date range. Show it.
2. Require an explicit confirm. Default selection is **per-profile**, with select-all available.
3. On confirm, for each selected legacy profile:
   - `upsert_routine` to create/ensure the registry row (assign the legacy profile id as
     `profile_key`, validated against the format check);
   - remap every log and metric to a **deterministic** `client_record_id` (§`03_RPC_CONTRACT.md` §4)
     so a repeated import is a no-op;
   - derive `profile_data` from the legacy profile document **with `pin` stripped** (B3);
   - enqueue everything in the account-scoped outbox and flush.
4. **Excluded from import:** `chieftain_master_overrides` (global/admin configuration, not user
   data) and the encrypted vault (device-local private body analysis, `restoreEncryptedVaultForUser`,
   `app_engine.js:1133`).
5. On completion, the legacy keys are left in place and the banner is marked handled.

## 5. Outbox

- Storage: `chieftain_v10:<scope>:outbox`, an ordered JSON array.
- Operation shape: `{ id, kind, payload, expectedRevision, attempts, lastError, status, createdAt }`
  where `status ∈ { pending, conflict, failed }`.
- Flush triggers: login, `online` event, debounced ~2 s after a local write, and manual sync.
- Flush is strictly ordered per row key (`client_record_id`, or `(profile_key, week_key)` for set
  states) so that create → update → delete replay in order.
- Retry: exponential backoff, capped; network errors stay `pending`; a `NULL` revision from an RPC
  transitions the op to `conflict`.
- Backpressure: if the queue exceeds a configured cap, stop enqueuing and surface a warning rather
  than silently dropping or growing unbounded.

## 6. Conflict behaviour

- A conflict is a `NULL` revision from a CAS RPC.
- Conflicts are **never** auto-resolved and **never** discarded (decision A13). The op stays queued
  with `status = conflict`.
- The UI shows a badge with the conflict count and a resolver per item offering: *keep cloud*
  (discard the local op), *overwrite with mine* (re-read the row's revision, then re-issue with the
  fresh `expected_revision`), or *keep both* (duplicate with a new `client_record_id`).
- A tombstone conflict can only be resolved as *keep cloud* — resurrection is impossible by design.

## 7. Password recovery

1. "Forgot password" → `supabaseClient.auth.resetPasswordForEmail(email, { redirectTo })`.
2. `redirectTo` uses the allowlisted origin: `https://chieftain20.github.io/Chieftain-s-Workout-Plan/`
   in production, `window.location.origin` for localhost development (decision B1). No Netlify URL is
   invented; it is added to the allowlist once known.
3. On load, an `onAuthStateChange` listener handles the `PASSWORD_RECOVERY` event and opens a
   set-new-password modal.
4. The modal calls `supabaseClient.auth.updateUser({ password })`, then signs the user in normally.
5. The existing email/password login and signup flows are unchanged; the admin magiclink flow is
   unaffected.

## 8. Admin account behaviour (B2)

- The authenticated admin (the `ADMIN_EMAIL` user, holding a real UUID) is a **normal cloud-scoped
  account**: `uuid:<its-uuid>`, with its own routines, logs, metrics, custom exercises and set states.
- No `is_admin()` branch exists in any RLS policy or RPC.
- The local `admin_hossein` identity remains a `local:` scope and is never uploaded.
- The admin authentication mechanism — Edge Function, secrets, magiclink exchange, "ورود مدیریت"
  gate, offline `gym`/`haji` path — is untouched.

## 9. Profile PIN exclusion (B3)

- `prof.pin` (`app_engine.js:3457`) is device-local and is **stripped** from any document written to
  `user_routines.profile_data`.
- The RPC strips a top-level `pin` defensively as a second layer.
- Consequence: a profile lock does not travel between devices. That is intended — the PIN is a local
  UI lock, not an account credential, and putting it in a JWT-readable table would leak it.

## 10. What STEP 2 must remove

- `app_engine.js:6207–6224` — the unscoped insert loop. **Deleted, not adapted.**
- `app_engine.js:6177–6185` — the first-login routine auto-upload. Replaced by explicit import.
- `pushLogToSupabase` (6124), `pushMetricToSupabase` (6139) — replaced by outbox enqueue.
- `syncCurrentDataWithSupabase` (6153) — replaced by outbox flush + scoped pull.
- `getAllProfilesLogsMap` (5489), `getAllProfilesSetsMap` (5528) — replaced by scope-filtered
  iterators.
- `clearLocalUserData` (5950) — extended to switch scope rather than clear tokens only.
