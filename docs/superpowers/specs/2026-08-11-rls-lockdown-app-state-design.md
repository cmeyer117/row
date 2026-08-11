# RLS Lockdown — app_state / food_log / push_subscriptions / workout_events

Date: 2026-08-11
Status: approved, ready for planning

## Problem

Row's `coaching_clients` table (and its siblings) got a real RLS lockdown on
2026-07-23: real client PII behind Supabase Auth, no more blanket anon
access. The rest of Row's tables never got the same treatment — `app_state`,
`food_log`, `push_subscriptions`, and `workout_events` all still carry
blanket `anon`/`public` policies (`select`/`insert`/`update`, `qual: true`).
The only thing standing between a stranger with the public anon key (it's
embedded in every page's client JS — not a secret) and Carl's real
weight/workout/macro/finance data is `topbar.js`'s client-side passphrase
overlay, which never touches the database. Anyone who extracts the anon key
can read and write those tables directly, bypassing the passphrase UI
entirely.

This was previously backlogged as premature (productization isn't
imminent), but Carl decided to do it now. Pattern: reuse exactly what the
coaching lockdown already proved out — `coaching_is_owner()` +
Supabase-Auth-gated `authenticated` policies — rather than inventing
something new.

## Scope — verified against live Supabase state, not the old ~13-table estimate

Queried `vikpcejlyxieguorwysf` (the shared Supabase project behind Row,
Jarvis, Vision, and Content Manager) directly via `pg_policies` before
writing this spec. Row's actual anon-open surface:

**Tables:**
- `app_state` — anon `select`/`insert`/`update`, `qual: true`. 111 rows —
  goals, health, finance, po-coach, po-coach-season, morning_launch:*, etc.
- `food_log` — anon `all`, `qual: true`.
- `push_subscriptions` — anon `all`, `qual: true`.
- `workout_events` — anon `select`/`insert`/`update`, `qual: true`.

**Storage buckets:**
- `progress-photos` — anon `insert` (upload). Bucket is `public: true` for
  reads — that's existing, accepted design (unguessable UUID filenames,
  same tradeoff as any public CDN bucket), not part of this fix. Only the
  anon **insert** policy is in scope.
- `hype-audio` — same shape, same fix.

**Explicitly out of scope:**
- `macro_leads` — anon insert-only, 0 rows, zero references anywhere in
  Row's current codebase (dead feature from an old spec). Left untouched —
  no benefit to fixing unused surface, and touching it risks reintroducing
  it as if it were live.
- `content-inbox` storage bucket — not referenced by Row's code, belongs to
  Content Manager. Content Manager's own follow-on will cover it.
- The other ~17 "anon"-policied tables in this same Supabase project
  (`knowledge_entries`, `content_ideas`, `tracked_creators`, `dev_tasks`,
  `vision_turns`, `commitments`, etc.) belong to Jarvis, Vision, and Content
  Manager, not Row. This is where the old "~13" backlog estimate came from
  — it was conflating shared-project tables that belong to other apps. Each
  app's own RLS pass is a separate future spec.
- `coaching_clients`/`coaching_inquiries`/`coaching_client_logs`/
  `coaching_client_weights` — already locked down (2026-07-23), no work
  needed.

## The real complication: trusted backends use the anon key too

Locking these 4 tables to `authenticated`-only would break more than Row's
browser pages. Confirmed by reading the actual client code in each repo:

- **Jarvis** (`claude-workspace/jarvis/src/db/supabase.ts`): `getSupabase()`
  connects with `SUPABASE_ANON_KEY`, used for every `app_state` read/write
  (`get_personal_data`, `coach-read.ts`, goals/health/finance tools) and
  `food_log` inserts (Telegram meal-photo logging in
  `api/routes/telegram.ts`).
- **Vision** (vendored copy of the same Jarvis DB layer): same anon-key
  client, used by `query-catalog.ts`'s dig queries and `vision-memory*.ts`.
- **Row's own Vercel cron functions**: `send-workout-nudge.js`,
  `send-macro-drift-nudge.js`, `send-morning-launch-nudge.js`, and
  `api/_lib/subscribe-push-logic.js` all hardcode the anon publishable key
  (`sb_publishable_...`) to read `app_state`/`food_log` and read/write
  `push_subscriptions`. `send-coaching-inquiry-nudge.js` already does this
  correctly — it uses `process.env.SUPABASE_SERVICE_ROLE_KEY`.

None of these are interactive users — they're server processes with no
Supabase Auth session to hold. `coaching_is_owner()` checks `auth.jwt() ->>
'email'`, which only exists for a real logged-in session; a service process
can never satisfy it. The correct fix for a trusted backend that can't log
in interactively is the `service_role` key, which bypasses RLS by design —
exactly what `send-coaching-inquiry-nudge.js` already does. This is not a
workaround; it's the standard Supabase pattern for first-party server code.

## Design

### 1. Database (Row's Supabase project, `vikpcejlyxieguorwysf`)

Reuse `coaching_is_owner()` as-is — same owner, no new function needed.

For each of `app_state`, `food_log`, `push_subscriptions`, `workout_events`:
drop the blanket anon policy/policies, add one policy:
```sql
create policy "owner full access to <table>"
  on public.<table> for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());
```

For storage: drop `"anon upload progress-photos"` and `"hype-audio public
insert"`, replace each with an `authenticated` + `coaching_is_owner()`
insert policy. Public read policy is untouched.

Staged like the coaching lockdown was (PART A additive / PART B cutover) —
see Rollout below.

### 2. Row's browser pages — real login replaces the passphrase

Generalize `coaching-auth.js` into `row-auth.js` (same `ensure(supa)` shape,
drop the "Coaching —" label). Every page currently gated by `topbar.js`'s
`AUTH_PASS`/`authGate()` calls `RowAuth.ensure(supa)` instead. Remove
`AUTH_PASS` and `authGate()` from `topbar.js` entirely — one real gate, not
a cosmetic one layered on a real one. `coaching.html`/`coaching-plan.html`
keep using `coaching-auth.js` as-is (already correct, no change needed) —
or migrate them to the same shared `row-auth.js` if that removes
duplication cheaply; decide during planning, not a spec-level requirement.

Session persistence: unchanged from today's coaching-page behavior —
Supabase's own client persists the auth token in `localStorage`, so a
returning visit doesn't re-prompt for login until the token actually
expires or is revoked.

### 3. Trusted backends — key swap, not login

- Row's 3 nudge functions + `subscribe-push-logic.js`: replace the
  hardcoded `sb_publishable_...` constant with
  `process.env.SUPABASE_SERVICE_ROLE_KEY` (already set in Row's Vercel
  project — no new secret to create).
- Jarvis's `getSupabase()`: switch from `SUPABASE_ANON_KEY` to a new
  `SUPABASE_SERVICE_ROLE_KEY` Railway env var. This is a single shared
  client used for many tables beyond Row's four — switching it to
  service_role is strictly safer everywhere it's used (bypasses RLS,
  removes anon-key exposure entirely) and requires no changes to any other
  table's policies.
- Vision's vendored equivalent: same swap, same new Railway env var.
- The service_role key value: pull from Row's existing Vercel env (already
  has it, working, for `send-coaching-inquiry-nudge.js`) via the Vercel
  MCP, push into both Railway projects via the Railway CLI. No manual
  secret-hunting needed from Carl.

### 4. Rollout order — stage it, don't cut over blind

**PART A (additive, safe to deploy anytime, changes no policy):**
1. Confirm `coaching_is_owner()` exists and is correct (it already does).
2. Ship `row-auth.js` + remove `topbar.js`'s passphrase gate; deploy Row.
3. Swap Row's 3 nudge functions + `subscribe-push-logic.js` to
   service_role; deploy Row.
4. Add `SUPABASE_SERVICE_ROLE_KEY` to Jarvis's Railway env, swap
   `getSupabase()`; deploy Jarvis.
5. Same for Vision; deploy Vision.
6. **Verify all of the above actually works** — real login on a real Row
   page, a real nudge function firing (or a manual trigger), a real Jarvis
   tool call touching `app_state`, a real Vision dig query — before
   touching any RLS policy.

**PART B (cutover — only after every PART A step is confirmed live):**
7. Drop the anon policies on `app_state`/`food_log`/`push_subscriptions`/
   `workout_events` and the two storage buckets' anon-insert policies.
8. Re-verify the same checklist from step 6 against the now-locked tables.

This mirrors the coaching lockdown's own two-part structure specifically to
avoid a lockout window — nothing gets cut off until the replacement path is
proven working end to end.

## Testing / verification

- No new pure-logic module here (this is auth/infra wiring, not
  application logic) — nothing to unit-test in the ponytail sense. The
  self-check is the live verification checklist in PART A step 6 / PART B
  step 8 above, run for real against the deployed apps, not simulated.
- After PART B: attempt an anon (unauthenticated) read/write against each
  locked table directly (curl with just the anon key) and confirm it's
  rejected — the actual proof the lockdown works, not just "the policy
  looks right."

## Out of scope (this spec)

- Vessel and Content Manager's own passphrase/anon-RLS patterns — queued as
  fast-follow specs reusing this same design, not part of this build.
- `macro_leads`, `content-inbox` bucket — dead/other-app surface, not
  touched.
- Rotating the shared `007007`/`131313`-style passphrase values anywhere —
  irrelevant once the passphrase gate is removed for the tables it used to
  "protect."
