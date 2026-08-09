# Standalone Coaching App — Plan 1: Supabase Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new, dedicated Supabase project with the coaching schema, RLS policies, and RPCs needed for real multi-tenant client access (magic-link, `auth.users.id`-bound identity) — verified end-to-end via direct SQL/REST calls, with no app UI required yet.

**Architecture:** Port the existing `coaching_clients`/`coaching_client_logs`/`coaching_client_weights`/`coaching_inquiries` schema from Row's Supabase project (`vikpcejlyxieguorwysf`) into a new project, adding an `auth_user_id` column that becomes a client's real identity after their first magic-link login (via a new `claim_client_profile()` RPC). All client-facing RPCs derive identity from `auth.uid()` — never a parameter — closing the gap Codex flagged in the design spec. Owner access uses the same `coaching_is_owner()` email-JWT-match pattern already proven in Row's existing lockdown (`row/supabase/migrations/2026-07-23-coaching-rls-lockdown.sql`).

**Tech Stack:** Postgres (Supabase), plain SQL migrations, `psql`/Supabase SQL editor for verification (no app code in this plan).

**Reference:** `row/docs/superpowers/specs/2026-08-09-standalone-coaching-app-design.md` (the approved, Codex-reviewed design spec this plan implements). Existing schema/RLS pattern this ports from: `row/supabase/migrations/2026-07-17-coaching-clients.sql`, `2026-07-23-coaching-billing.sql`, `2026-07-23-coaching-rls-lockdown.sql`, and its design doc `row/docs/superpowers/specs/2026-07-23-coaching-rls-lockdown-design.md`.

---

## File Structure

New repo `C:\Users\gregm\coaching-app` (native clone, not under Google Drive — matches the workspace's own convention of never running Node/git tooling against Drive-synced paths). This plan only creates a `supabase/migrations/` folder and a `scripts/` folder for verification SQL — no app code yet (that's Plan 2).

- `coaching-app/supabase/migrations/0001-coaching-schema.sql` — tables
- `coaching-app/supabase/migrations/0002-coaching-rls-and-rpcs.sql` — RLS policies + RPCs
- `coaching-app/scripts/verify-rls-isolation.sql` — the cross-client isolation test (run manually against the live project, not an automated CI test — there's no app/CI yet in this plan)
- `coaching-app/README.md` — one paragraph, what this repo is and its current state (foundation only, no app yet)

## Task 1: Create the new repo and Supabase project

**Files:**
- Create: `C:\Users\gregm\coaching-app\README.md`
- Create: `C:\Users\gregm\coaching-app\.gitignore`

- [ ] **Step 1: Create the new GitHub repo and local clone**

```bash
gh repo create cmeyer117/coaching-app --private --clone
cd C:\Users\gregm\coaching-app
```

- [ ] **Step 2: Write the README**

```markdown
# Coaching App

Standalone client-facing coaching app, spun out of Row (`cmeyer117/row`'s `coaching.html`/`coaching-plan.html`/`coaching-log.html`).

**Status:** Foundation only — Supabase schema/RLS/RPCs. No app code yet (Plan 2).

Design spec: see `cmeyer117/row`'s `docs/superpowers/specs/2026-08-09-standalone-coaching-app-design.md`.
```

- [ ] **Step 3: Add a `.gitignore`**

```
node_modules/
.env
.env.local
.vercel/
```

- [ ] **Step 4: Commit**

```bash
git add README.md .gitignore
git commit -m "chore: initialize coaching-app repo"
git push -u origin main
```

- [ ] **Step 5: Create the Supabase project**

Manual step (Supabase MCP connector isn't authorized in this session — do this via the dashboard): go to https://supabase.com/dashboard, create a new project named `coaching-app`, same organization as the `row` project, choose a strong database password and save it somewhere safe (you'll need it once, for direct `psql` access if a migration needs to run outside the SQL editor). Note down after creation:
- Project URL (`https://<ref>.supabase.co`)
- `anon`/publishable key (Project Settings → API)
- `service_role` key (Project Settings → API — treat as a real secret, never commit it)
- Project ref (the `<ref>` part of the URL, needed for later CLI/MCP use)

Nothing to commit for this step — these values get used starting in Task 5's verification and stored as env vars once Plan 2 creates the app.

---

## Task 2: `coaching_clients` table

**Files:**
- Create: `C:\Users\gregm\coaching-app\supabase\migrations\0001-coaching-schema.sql`

- [ ] **Step 1: Write the migration (clients table, ported columns + new `auth_user_id`)**

```sql
-- ============================================================
-- Coaching App — schema — 0001
-- Ports coaching_clients from row's Supabase project
-- (supabase/migrations/2026-07-17-coaching-clients.sql +
-- 2026-07-23-coaching-billing.sql), adding auth_user_id for
-- real per-client Supabase Auth identity (magic-link).
-- ============================================================

create table coaching_clients (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null unique,
  name text not null,
  email text not null unique,
  age integer,
  height_in numeric,
  weight_lb numeric,
  sex text check (sex in ('male', 'female', 'other')),
  stage text not null check (stage in ('beginner', 'intermediate', 'advanced')),
  goal text not null check (goal in ('cut', 'bulk', 'recomp', 'contest-prep')),
  equipment text not null check (equipment in ('full-gym', 'home', 'limited')),
  training_days_per_week integer not null check (training_days_per_week between 1 and 7),
  session_length integer not null check (session_length > 0),
  injury_flags text[] not null default '{}',
  needs_review boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'issued', 'archived')),
  issued_snapshot jsonb,
  personalization_note text not null default '',
  stripe_customer_id text,
  stripe_subscription_id text,
  billing_status text not null default 'none'
    check (billing_status in ('none', 'pending', 'paid', 'past_due', 'cancelled')),
  billing_amount integer,
  billing_frequency text check (billing_frequency in ('one_time', 'monthly')),
  -- New: set once by claim_client_profile() on the client's first magic-link
  -- login. NULL means "invited but never logged in yet" — a real, valid
  -- state, not an error. This FK, not email, is the RLS identity from here on.
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table coaching_clients enable row level security;
-- No policies yet — Task 5 adds them. RLS ON with zero policies means
-- "nobody but service_role can touch this table" in the meantime, which
-- is the correct default while the schema is still being built.
```

- [ ] **Step 2: Create `coaching_client_logs` and `coaching_client_weights` in the same file**

```sql
create table coaching_client_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references coaching_clients(id) on delete cascade,
  exercise_name text not null,
  weight numeric not null,
  reps integer not null,
  is_bodyweight boolean not null default false,
  logged_at timestamptz not null default now()
);
alter table coaching_client_logs enable row level security;

create table coaching_client_weights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references coaching_clients(id) on delete cascade,
  weight numeric not null,
  logged_at date not null default current_date
);
alter table coaching_client_weights enable row level security;
```

- [ ] **Step 3: Create `coaching_inquiries` in the same file**

```sql
-- Fed by an external public application form (not in this repo, not in
-- Row either — see row's 2026-07-23-coaching-rls-lockdown-design.md §4d).
-- That form's Supabase URL/anon key needs repointing at this new project
-- once it's live — tracked as a follow-up in Plan 5 (migration/cutover),
-- not this plan's concern.
create table coaching_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text,
  status text not null default 'new' check (status in ('new', 'converted', 'declined')),
  created_at timestamptz not null default now()
);
alter table coaching_inquiries enable row level security;
```

- [ ] **Step 4: Apply the migration**

Run the full contents of `0001-coaching-schema.sql` in the new project's Supabase SQL editor (dashboard → SQL Editor → paste → Run). Expected: all 4 `CREATE TABLE` statements succeed, no errors.

- [ ] **Step 5: Verify tables exist with RLS on, zero policies**

Run in the SQL editor:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename like 'coaching%';
```

Expected: 4 rows, all `rowsecurity = true`.

```sql
select tablename, count(*) from pg_policies
where schemaname = 'public' and tablename like 'coaching%'
group by tablename;
```

Expected: 0 rows returned (no policies exist yet — confirms nothing but `service_role` can touch these tables right now).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001-coaching-schema.sql
git commit -m "feat: coaching schema (clients, logs, weights, inquiries)"
git push
```

---

## Task 3: Owner access — `coaching_is_owner()` + owner RLS policies

**Files:**
- Create: `C:\Users\gregm\coaching-app\supabase\migrations\0002-coaching-rls-and-rpcs.sql`

- [ ] **Step 1: Write the owner-predicate function**

```sql
-- ============================================================
-- Coaching App — RLS + RPCs — 0002
-- Owner: single-email JWT match, same pattern as row's
-- coaching_is_owner() (2026-07-23-coaching-rls-lockdown.sql).
-- Client: auth_user_id match, set by claim_client_profile().
-- ============================================================

create or replace function public.coaching_is_owner()
returns boolean language sql stable set search_path = '' as $$
  select (auth.jwt() ->> 'email') = 'carl.meyer.business@gmail.com';
$$;
```

- [ ] **Step 2: Owner policies on all 4 tables, in the same file**

```sql
create policy "owner full access to coaching_clients"
  on public.coaching_clients for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

create policy "owner full access to coaching_client_logs"
  on public.coaching_client_logs for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

create policy "owner full access to coaching_client_weights"
  on public.coaching_client_weights for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

create policy "owner full access to coaching_inquiries"
  on public.coaching_inquiries for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());
```

- [ ] **Step 3: Apply, then create the one Supabase Auth user for the owner**

Run the SQL above in the SQL editor. Then, dashboard → Authentication → Users → Add user → `carl.meyer.business@gmail.com`, set a password. This is the one owner account — same manual one-time step Row's existing coaching dashboard already uses.

- [ ] **Step 4: Verify owner access works, non-owner doesn't**

In the SQL editor (runs as `postgres`/service role, so this checks the *policy logic* via `auth.jwt()` simulation — real end-to-end owner-login testing happens in Task 6):

```sql
select proname from pg_proc where proname = 'coaching_is_owner';
```

Expected: 1 row. Full login-based verification happens in Task 6 once client policies exist too (testing owner vs. client together is more efficient than twice).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002-coaching-rls-and-rpcs.sql
git commit -m "feat: owner RLS policies (coaching_is_owner)"
git push
```

---

## Task 4: Client identity — `claim_client_profile()` + client RLS policies

**Files:**
- Modify: `C:\Users\gregm\coaching-app\supabase\migrations\0002-coaching-rls-and-rpcs.sql`

- [ ] **Step 1: Write `claim_client_profile()`**

```sql
-- Called once by the app immediately after a client's first successful
-- magic-link login. Matches their verified session email to an unclaimed
-- coaching_clients row and permanently binds auth_user_id. After this,
-- email is never used for access control again — only auth_user_id is.
-- SECURITY DEFINER because an unclaimed row has no RLS policy that would
-- let the client see it yet (chicken-and-egg: they need to find their row
-- before they're "in" it) — but the function itself only ever touches the
-- one row matching the caller's own verified JWT email, never anyone else's.
create or replace function public.claim_client_profile()
returns table (id uuid, name text)
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_id uuid;
begin
  if v_email is null then
    raise exception 'no authenticated session';
  end if;

  -- Idempotent: if this caller already claimed a row, just return it.
  select c.id into v_id from public.coaching_clients c
    where c.auth_user_id = auth.uid();
  if v_id is not null then
    return query select c.id, c.name from public.coaching_clients c where c.id = v_id;
    return;
  end if;

  -- First claim: match by email, only if not already claimed by someone else.
  select c.id into v_id from public.coaching_clients c
    where c.email = v_email and c.auth_user_id is null;
  if v_id is null then
    raise exception 'no invited client found for this email';
  end if;

  update public.coaching_clients set auth_user_id = auth.uid(), updated_at = now()
    where id = v_id;

  return query select c.id, c.name from public.coaching_clients c where c.id = v_id;
end;
$$;

revoke all on function public.claim_client_profile() from public;
grant execute on function public.claim_client_profile() to authenticated;
```

- [ ] **Step 2: Client RLS policies, bound to `auth_user_id`**

```sql
create policy "client reads own row"
  on public.coaching_clients for select to authenticated
  using (auth_user_id = auth.uid());

create policy "client reads own logs"
  on public.coaching_client_logs for select to authenticated
  using (client_id in (select id from public.coaching_clients where auth_user_id = auth.uid()));

create policy "client reads own weights"
  on public.coaching_client_weights for select to authenticated
  using (client_id in (select id from public.coaching_clients where auth_user_id = auth.uid()));
```

Note: clients only get `select` policies here — writes (logging a set, upserting a weight) go through the `SECURITY DEFINER` RPCs in Task 5, not direct table access. This matches the existing Row pattern (`log_coaching_exercise`/`upsert_coaching_weight` as RPCs) and keeps the write path auditable/validated in one place instead of two (direct-table + RPC).

- [ ] **Step 3: Apply and verify with two real test client rows**

```sql
insert into coaching_clients (plan_id, name, email, stage, goal, equipment, training_days_per_week, session_length)
values
  ('test-plan-a', 'Test Client A', 'test-a@example.com', 'beginner', 'cut', 'full-gym', 3, 60),
  ('test-plan-b', 'Test Client B', 'test-b@example.com', 'beginner', 'cut', 'full-gym', 3, 60)
returning id, plan_id;
```

Note both returned `id` values — needed for Task 6's isolation test. Do not delete these rows yet; Task 6 uses them.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002-coaching-rls-and-rpcs.sql
git commit -m "feat: claim_client_profile RPC + client RLS policies"
git push
```

---

## Task 5: Client-facing write RPCs (session-derived identity, no `p_id` parameter)

**Files:**
- Modify: `C:\Users\gregm\coaching-app\supabase\migrations\0002-coaching-rls-and-rpcs.sql`

- [ ] **Step 1: Write `get_my_coaching_plan()`**

```sql
-- Unlike row's get_coaching_plan(p_id uuid) — no parameter at all. The
-- caller's identity comes entirely from their session, closing the Codex-
-- flagged gap where a client-supplied id could be trusted as authority.
create or replace function public.get_my_coaching_plan()
returns table (name text, stage text, goal text, equipment text,
               training_days_per_week integer, session_length integer, injury_flags text[])
language sql security definer set search_path = '' as $$
  select c.name, c.stage, c.goal, c.equipment, c.training_days_per_week, c.session_length, c.injury_flags
  from public.coaching_clients c where c.auth_user_id = auth.uid();
$$;

revoke all on function public.get_my_coaching_plan() from public;
grant execute on function public.get_my_coaching_plan() to authenticated;
```

- [ ] **Step 2: Write `log_my_exercise()` and `upsert_my_weight()`**

```sql
create or replace function public.log_my_exercise(
  p_exercise text, p_weight numeric, p_reps integer, p_is_bodyweight boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_client_id uuid;
begin
  select id into v_client_id from public.coaching_clients where auth_user_id = auth.uid();
  if v_client_id is null then
    raise exception 'no claimed client profile for this session';
  end if;
  insert into public.coaching_client_logs (client_id, exercise_name, weight, reps, is_bodyweight)
  values (v_client_id, p_exercise, p_weight, p_reps, p_is_bodyweight);
end;
$$;

create or replace function public.upsert_my_weight(p_weight numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_client_id uuid;
  v_week_start date := date_trunc('week', now())::date;
  v_existing uuid;
begin
  select id into v_client_id from public.coaching_clients where auth_user_id = auth.uid();
  if v_client_id is null then
    raise exception 'no claimed client profile for this session';
  end if;
  select id into v_existing from public.coaching_client_weights
    where client_id = v_client_id and logged_at >= v_week_start
    order by logged_at desc limit 1;
  if v_existing is not null then
    update public.coaching_client_weights set weight = p_weight, logged_at = current_date where id = v_existing;
  else
    insert into public.coaching_client_weights (client_id, weight, logged_at) values (v_client_id, p_weight, current_date);
  end if;
end;
$$;

revoke all on function public.log_my_exercise(text, numeric, integer, boolean) from public;
revoke all on function public.upsert_my_weight(numeric) from public;
grant execute on function public.log_my_exercise(text, numeric, integer, boolean) to authenticated;
grant execute on function public.upsert_my_weight(numeric) to authenticated;
```

- [ ] **Step 3: Apply and confirm the functions exist**

```sql
select proname from pg_proc
where proname in ('get_my_coaching_plan', 'log_my_exercise', 'upsert_my_weight', 'claim_client_profile');
```

Expected: 4 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002-coaching-rls-and-rpcs.sql
git commit -m "feat: session-derived client RPCs (plan, log, weight)"
git push
```

---

## Task 6: Cross-client isolation verification (the bar Codex named as non-negotiable)

**Files:**
- Create: `C:\Users\gregm\coaching-app\scripts\verify-rls-isolation.sql`

This is a manual verification procedure, not an automated test — there's no app/CI harness yet in this plan. Every step must actually be run against the live project and its real output checked against the "Expected" line, not skimmed.

- [ ] **Step 1: Confirm anon has zero direct table access**

In the SQL editor, switch role to simulate anon (or use the project's anon key via `curl`/Postman against `PROJECT_URL/rest/v1/coaching_clients` with `apikey: <anon key>` and no `Authorization` bearer):

```bash
curl "https://<ref>.supabase.co/rest/v1/coaching_clients?select=*" \
  -H "apikey: <anon key>"
```

Expected: `[]` or a permission-denied error — **not** a list of client rows. This is the single most important check in this plan.

- [ ] **Step 2: Simulate Client A's first login and claim**

There's no real magic-link flow yet (that's Plan 2's job — the app UI). To test the DB layer alone, manually create an `auth.users` row via the dashboard (Authentication → Users → Add user → `test-a@example.com`, any password, since this is a throwaway test account) and note its `id`. Then, using that user's access token (dashboard → copy a session token, or sign in via the Supabase JS client in a scratch script), call:

```sql
-- Run this AS the test-a authenticated user (via their JWT, not the SQL editor's service role)
select * from claim_client_profile();
```

Expected: returns `{id: <Test Client A's coaching_clients id>, name: 'Test Client A'}` — matching the row created in Task 4 Step 3.

- [ ] **Step 3: Confirm Client A can read their own plan and nothing else**

Still as the `test-a@example.com` session:

```sql
select * from get_my_coaching_plan();
```

Expected: one row, `name = 'Test Client A'`.

```sql
select * from coaching_clients;
```

Expected: exactly 1 row (their own, via the `client reads own row` policy) — **not** both test clients.

- [ ] **Step 4: Confirm Client A cannot read Client B's logs even by guessing the ID**

Log a set as Client A first:

```sql
select log_my_exercise('Bench Press', 135, 8, false);
```

Then, still as Client A, try to read Client B's logs directly (Client B's `client_id` from Task 4 Step 3's returned rows):

```sql
select * from coaching_client_logs where client_id = '<Client B''s id>';
```

Expected: `[]` — zero rows. The RLS policy scopes by `client_id in (select id from coaching_clients where auth_user_id = auth.uid())`, and Client B's id isn't in that set for Client A's session.

- [ ] **Step 5: Confirm an un-claimed client (never logged in) can't be impersonated**

As a fresh session with no `auth.users` row at all (or `test-b@example.com` before it's ever created an `auth.users` account), attempt `claim_client_profile()` using an email that doesn't match any unclaimed `coaching_clients` row:

```sql
-- As a session whose JWT email is 'nobody@example.com'
select * from claim_client_profile();
```

Expected: raises `no invited client found for this email` — confirms the RPC can't be used to claim an arbitrary client row.

- [ ] **Step 6: Confirm owner sees everything**

As the owner session (`carl.meyer.business@gmail.com`):

```sql
select count(*) from coaching_clients;
```

Expected: 2 (both test clients) — owner bypasses the per-client scoping entirely.

- [ ] **Step 7: Clean up the test data**

```sql
delete from coaching_client_logs where client_id in (
  select id from coaching_clients where plan_id in ('test-plan-a', 'test-plan-b')
);
delete from coaching_clients where plan_id in ('test-plan-a', 'test-plan-b');
```

Also delete the throwaway `test-a@example.com`/`test-b@example.com` auth users via the dashboard.

- [ ] **Step 8: Write down what was verified, commit the verification script**

Save the exact SQL used above (with the placeholder IDs) as `scripts/verify-rls-isolation.sql`, with a comment noting it's a manual runbook, not automated — future changes to RLS policies should be re-verified against this same procedure by hand until Plan 2's app exists and this can become a real integration test.

```bash
git add scripts/verify-rls-isolation.sql
git commit -m "docs: RLS cross-client isolation verification runbook"
git push
```

---

## Self-Review

**Spec coverage check** (against `2026-08-09-standalone-coaching-app-design.md`):
- Decision #2 (new dedicated Supabase project) → Task 1. ✅
- Decision #3 (owner + client auth roles) → Tasks 3-4. ✅
- Decision #6 + Codex fixes #2/#3 (auth_user_id identity, RPC session-derived) → Tasks 4-5. ✅
- Codex fix #4 (RLS locked down before real data) → this entire plan produces a locked-down project before Plan 2's app or Plan 5's migration ever runs — satisfied by ordering, not a single task.
- Codex fix #1 (retire old unauthenticated route) → **not in this plan** — that's Row's *existing* project, not this new one; correctly belongs to Plan 5 (migration/cutover), not Plan 1. Noted, not a gap.
- Expanded verification scope (every RPC, read/write, guessed IDs, unclaimed sessions) → Task 6 covers all of these explicitly.

**Placeholder scan:** no TBD/TODO. The one manual/non-automated step (Task 1 Step 5, Task 6 generally) is explicitly justified — there's no app or CI yet to automate against, not laziness.

**Type/name consistency:** `get_my_coaching_plan`, `log_my_exercise`, `upsert_my_weight`, `claim_client_profile` — same names used consistently from Task 4 through Task 6's verification calls. `auth_user_id` (not `auth_uid` or `user_id`) used consistently across Tasks 2-6.

---

## What Plan 2 picks up

The new Supabase project (URL, anon key, service-role key) from Task 1 Step 5, and the four RPCs from Tasks 4-5, are what Plan 2 (app scaffold + auth) wires a real magic-link login flow and UI against. Plan 2 is where `claim_client_profile()` actually gets called from app code for the first time, not just a manual test session.
