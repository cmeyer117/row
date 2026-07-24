# Coaching-layer Supabase RLS lockdown — design — 2026-07-23

Security fix. Confirmed problem source: `Claude Outputs/2026-07-23-fable-run-through.md` §2, verified live.
Supabase project `vikpcejlyxieguorwysf`. Repo `cmeyer117/row` (main). Cross-repo deliverable #2 lives in `G:\My Drive\Claude` (audit-projects skill).

## 1. Confirmed problem

The coaching layer gained real PII (`email, age, height_in, weight_lb, sex`) and Stripe billing columns (`stripe_customer_id, stripe_subscription_id, billing_status, billing_amount, billing_frequency`) this week, but still runs the old Carl-only blanket-anon DB model. One publishable anon key (`sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv`) ships in plaintext in every coaching page and every serverless function. `coaching-log.html`'s `?id=<uuid>` link is handed to clients, so that key is effectively public.

- `coaching_clients` — RLS on, only policy `anon full access` (ALL, `qual true`) → anon can read/write/delete every client's PII + billing.
- `coaching_inquiries` — anon `SELECT` all (`qual true`) → every lead's name/email/message dumpable.
- `coaching_client_logs`, `coaching_client_weights` — RLS **disabled**, 0 policies → fully open to anon.

## 2. Why the stated near-term plan doesn't hold (both premises are wrong)

**2a. "Scoped RLS policies keyed on the `?id=` UUID" is not a real mechanism.** An RLS policy decides per-row whether the `anon` role may see a row; it cannot read the client's `.eq('id', x)` filter. With one shared anon key there is no per-request identity, so a policy is either "anon may read this row" or not — an attacker drops the filter and `select *` dumps everything. The capability-URL model (know the UUID → get that one row, cannot enumerate) is enforceable **only** via a `SECURITY DEFINER` function that takes the id as an argument.

**2b. The service-role "follow-up pattern" does not exist yet — all three serverless functions use the anon key.** `stripe-webhook.js:9`, `create-coaching-payment.js:11`, `send-coaching-inquiry-nudge.js:8` all hardcode the publishable key and rely on the blanket-anon policies. Any lockdown breaks all three (billing updates, payment-link creation, inquiry nudge) until they move to the service-role key. The writeup assumed they already ride service-role.

**Consequence:** there is no tiny "tweak the policies" fix. Everything couples through one public anon key printed in 3 HTML pages + 3 functions. The minimal *correct* unit is below, and it lands the productization-correct end state in one pass (no throwaway near-term hack).

## 3. Target role model

| Role | Who | Coaching-table access |
|---|---|---|
| `service_role` | Vercel functions (server-side secret) | Bypasses RLS entirely |
| `authenticated` | Carl, logged into the dashboard | Full access (all coaching tables) |
| `anon` | Public key: `coaching-log.html` + external inquiry form | **None direct.** Only: EXECUTE on 3 client RPCs (scoped by id) + INSERT on `coaching_inquiries` |

## 4. Changes by component

### 4a. Serverless → service-role key (required prep; trivial)
`stripe-webhook.js`, `create-coaching-payment.js`, `send-coaching-inquiry-nudge.js`: change the `SUPABASE_KEY` constant from the hardcoded publishable key to `process.env.SUPABASE_SERVICE_ROLE_KEY`. Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel env (Production + Preview). Service-role bypasses RLS, so these keep working regardless of policies. Incidentally fixes the nudge's `push_subscriptions` reads too.

### 4b. Client page (`coaching-log.html`) → 3 `SECURITY DEFINER` RPCs, scoped by id
The page currently uses only 7 non-sensitive columns; it never needs PII/billing. Replace its 3 direct table calls:

- `coaching_clients.select('*').eq('id',clientId).single()` (line 107) → `supa.rpc('get_coaching_plan', { p_id: clientId })` → take `[0]`. RPC returns only `name, stage, goal, equipment, training_days_per_week, session_length, injury_flags` (explicit column list — a future PII column can never leak through it).
- `coaching_client_logs.insert(...)` (line 95) → `supa.rpc('log_coaching_exercise', { p_id: clientId, p_exercise, p_weight, p_reps, p_is_bodyweight })`.
- weight upsert (lines 134–139) → `supa.rpc('upsert_coaching_weight', { p_id: clientId, p_weight })` (the select-existing logic moves into the function).

Enumeration-proof: an unknown id returns nothing / raises `unknown client`; against 122-bit UUIDs the exists-oracle is useless.

### 4c. Dashboard + plan editor (`coaching.html`, `coaching-plan.html`) → Supabase Auth
Chosen over serverless: **less code** (the existing `.from().select/insert/update` calls don't change — they just run as `authenticated`), and it closes the "dashboard has no auth" gap (topbar.js is a cosmetic client-side passphrase `007007`, zero DB protection) in the same pass.

- New shared `coaching-auth.js`: on load, `await supa.auth.getSession()`; if none, render a small email+password login overlay → `supa.auth.signInWithPassword(...)`; block data loads until a session exists. The existing module-scoped `supa` client attaches the JWT automatically once logged in.
- Both pages: gate their entry point behind it — `ensureAuth().then(() => { loadClients(); loadInquiries(); })` / `ensureAuth().then(load)`.
- Carl creates **one** Supabase Auth user (his email) once; session persists in localStorage across visits.
- `topbar.js` left untouched (shared across the whole Row app, out of scope). Its cosmetic passphrase may still show first on coaching pages — harmless and redundant now that the DB layer enforces `authenticated`. Retiring it is a separate later cleanup.
- On successful login, also `sessionStorage.setItem('row_auth','1')` so topbar's passphrase overlay is satisfied and Carl isn't double-prompted.

### 4d. `coaching_inquiries`
Drop the anon `SELECT`-all policy. Keep an anon **INSERT-only** policy (the public application form — external, not in this repo — inserts leads via the anon key). Dashboard + nudge now read via `authenticated` / `service_role`.

### 4e. `coaching_client_logs` / `coaching_client_weights`
Enable RLS. `authenticated` full access; anon reaches them only through the 4b RPCs.

## 5. Migration SQL

```sql
-- ============================================================
-- Coaching RLS lockdown — 2026-07-23
-- anon: RPCs (scoped by ?id=) + inquiry INSERT only.
-- authenticated (Carl): full access.  service_role (Vercel fns): bypasses RLS.
-- ============================================================

-- Owner predicate — scopes "authenticated" to Carl by JWT email, so a future
-- Row auth user on this same project does NOT inherit coaching access.
create or replace function coaching_is_owner()
returns boolean language sql stable set search_path = public as $$
  select (auth.jwt() ->> 'email') = 'carl.meyer.business@gmail.com';
$$;

-- ---- coaching_clients ----
drop policy if exists "anon full access to coaching_clients" on coaching_clients;
create policy "owner full access to coaching_clients"
  on coaching_clients for all to authenticated using (coaching_is_owner()) with check (coaching_is_owner());

-- ---- coaching_inquiries ----
-- Drop the anon SELECT-all policy. NOTE: confirm its exact name live before applying
-- (placeholder name below). Keep the public form able to submit; no reads for anon.
drop policy if exists "anon read coaching_inquiries" on coaching_inquiries;
create policy "anon can submit inquiries"
  on coaching_inquiries for insert to anon with check (status = 'new');
create policy "owner full access to coaching_inquiries"
  on coaching_inquiries for all to authenticated using (coaching_is_owner()) with check (coaching_is_owner());

-- ---- coaching_client_logs ----
alter table coaching_client_logs enable row level security;
create policy "owner full access to coaching_client_logs"
  on coaching_client_logs for all to authenticated using (coaching_is_owner()) with check (coaching_is_owner());

-- ---- coaching_client_weights ----
alter table coaching_client_weights enable row level security;
create policy "owner full access to coaching_client_weights"
  on coaching_client_weights for all to authenticated using (coaching_is_owner()) with check (coaching_is_owner());

-- ============================================================
-- SECURITY DEFINER RPCs for the client log page (anon, scoped by ?id=)
-- ============================================================
create or replace function get_coaching_plan(p_id uuid)
returns table (name text, stage text, goal text, equipment text,
               training_days_per_week integer, session_length integer, injury_flags text[])
language sql security definer set search_path = public as $$
  select name, stage, goal, equipment, training_days_per_week, session_length, injury_flags
  from coaching_clients where id = p_id;
$$;

create or replace function log_coaching_exercise(
  p_id uuid, p_exercise text, p_weight numeric, p_reps integer, p_is_bodyweight boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from coaching_clients where id = p_id) then
    raise exception 'unknown client';
  end if;
  insert into coaching_client_logs (client_id, exercise_name, weight, reps, is_bodyweight)
  values (p_id, p_exercise, p_weight, p_reps, p_is_bodyweight);
end;
$$;

create or replace function upsert_coaching_weight(p_id uuid, p_weight numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_week_start date := date_trunc('week', now())::date;  -- Monday, UTC
  v_existing uuid;
begin
  if not exists (select 1 from coaching_clients where id = p_id) then
    raise exception 'unknown client';
  end if;
  select id into v_existing from coaching_client_weights
    where client_id = p_id and logged_at >= v_week_start
    order by logged_at desc limit 1;
  if v_existing is not null then
    update coaching_client_weights set weight = p_weight, logged_at = current_date where id = v_existing;
  else
    insert into coaching_client_weights (client_id, weight, logged_at) values (p_id, p_weight, current_date);
  end if;
end;
$$;

-- Only anon/authenticated may call; nothing runs as PUBLIC.
revoke all on function get_coaching_plan(uuid) from public;
revoke all on function log_coaching_exercise(uuid, text, numeric, integer, boolean) from public;
revoke all on function upsert_coaching_weight(uuid, numeric) from public;
grant execute on function get_coaching_plan(uuid) to anon, authenticated;
grant execute on function log_coaching_exercise(uuid, text, numeric, integer, boolean) to anon, authenticated;
grant execute on function upsert_coaching_weight(uuid, numeric) to anon, authenticated;
```

`ponytail:` week bucket is UTC-Monday, not the client's local Monday — a weekly weigh-in tolerates the edge-of-week drift; pass a client week-start param only if it ever matters.

## 6. Cross-repo deliverable #2 — wire `get_advisors` into `audit-projects`

Target: `G:\My Drive\Claude\.claude\scheduled-tasks\audit-projects\SKILL.md` (workspace repo — verify worktree/main drift before editing; the live scheduled task reads the main checkout). Add a subsection under §3 Code health, running at standard+ (skipped at low):

> **## 3c. Supabase security advisors (added 2026-07-23)**
> For each Supabase-backed project (Row `vikpcejlyxieguorwysf`, Vessel, Content Manager — get each ref from its project memory note or `supabase` config), call the Supabase MCP `get_advisors({ type: 'security' })` and surface every finding (RLS disabled on a table, anon-accessible sensitive tables, SECURITY DEFINER issues, exposed auth settings). This is the check that catches the exact coaching-RLS class before it ships. Requires the Supabase connector — if unavailable, note "skipped, connector not authorized" and move on. Cheap (one MCP call/project); report-only.

Also add "ran section 3c: supabase advisors" to the write-run-logs steps line when it fires.

## 7. Verification (before "done")

- **RPC + policies (needs Supabase apply):** with only the anon key, confirm `select * from coaching_clients` returns 0 rows (or permission denied), `get_coaching_plan(<real id>)` returns exactly the 7 safe columns, and `coaching_inquiries` select returns nothing while an insert succeeds.
- **`coaching-log.html`:** open with a real `?id=`, confirm plan renders, an exercise logs, weight saves. Confirm no PII/billing fields appear in the network response.
- **`coaching.html` + `coaching-plan.html`:** confirm login gate blocks, login succeeds, client list + inquiries load, add-client + archive + bill + issue-plan all work as `authenticated`.
- **Serverless:** confirm a Stripe test webhook still updates `billing_status`, a payment link still creates, the inquiry nudge still fires — on the service-role key.

## 8. Pre-apply unknowns to confirm live (Supabase MCP is OAuth-blocked this session)

1. Exact current policy **name** on `coaching_inquiries` (for the `drop policy`).
2. The external application form does **insert-only** (no select-back) — so INSERT-only anon suffices.
3. Whether `coaching_client_logs.client_id` / `coaching_client_weights.client_id` have FKs to `coaching_clients` (the exists-check covers it either way).
4. How the migration gets applied: Supabase MCP `apply_migration` (needs the connector authorized) **or** Carl runs the SQL in the Supabase SQL editor. Auth user creation is a one-time manual step in the Supabase Auth UI.

## 9. Done vs deferred

The Auth choice collapses the writeup's "productization-correct follow-up" into this pass — after this, **no anon direct table access exists** and the dashboard has real auth. Genuinely deferred (YAGNI): multi-coach scoping (policies key on the single owner email via `coaching_is_owner()`; add a `coach_id` column + predicate only when a second coach exists); retiring the now-redundant topbar passphrase.

## 10. Files touched

- New: `supabase/migrations/2026-07-23-coaching-rls-lockdown.sql`, `coaching-auth.js`
- Edited: `coaching-log.html` (3 calls → RPCs), `coaching.html` + `coaching-plan.html` (auth gate), `api/stripe-webhook.js` + `api/create-coaching-payment.js` + `api/send-coaching-inquiry-nudge.js` (service-role key)
- Cross-repo: `G:\My Drive\Claude\.claude\scheduled-tasks\audit-projects\SKILL.md` (§3c)
```
