# Coaching-layer Supabase RLS Lockdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remove all anon-key access to coaching PII/billing — client page reads/writes via id-scoped `SECURITY DEFINER` RPCs, owner dashboard via Supabase Auth, serverless via service-role — without breaking the live pages.

**Architecture:** Additive DB objects (owner predicate + 3 RPCs) and re-keyed serverless deploy FIRST; the restrictive policy cutover (drop anon policies, enable RLS on logs/weights) goes LAST, after the code that depends on the new model is live. Roster is test-data-only now, but the sequence is written to be zero-downtime regardless.

**Tech Stack:** Supabase Postgres 17 (RLS + PL/pgSQL), static HTML + `@supabase/supabase-js@2`, Vercel serverless (Node, fetch-based). Design spec: `docs/superpowers/specs/2026-07-23-coaching-rls-lockdown-design.md` (read §5 + §5.1 first).

**Apply mechanism:** DDL via Supabase MCP `apply_migration` (project `vikpcejlyxieguorwysf`); the `.sql` file is committed as the record. Attack-tests via MCP `execute_sql`. Vercel env var + Supabase Auth user are manual owner steps (secrets — not automated).

---

## Task 1: Additive DB objects — owner predicate + 3 client RPCs

Safe to apply immediately: creates functions only, touches no existing policy. The old anon policies keep the live pages working until Task 7.

**Files:**
- Create: `supabase/migrations/2026-07-23-coaching-rls-lockdown.sql` (this task writes the additive half; Task 7 appends the cutover half)

- [ ] **Step 1: Write the additive migration**

```sql
-- ============================================================
-- Coaching RLS lockdown — 2026-07-23 — PART A (additive, safe anytime)
-- Owner predicate + id-scoped SECURITY DEFINER RPCs for the client log page.
-- search_path='' + schema-qualified names (hardened SECURITY DEFINER).
-- ============================================================

create or replace function public.coaching_is_owner()
returns boolean language sql stable set search_path = '' as $$
  select (auth.jwt() ->> 'email') = 'carl.meyer.business@gmail.com';
$$;

-- Returns ONLY plan-shaping columns — never email/PII/billing.
create or replace function public.get_coaching_plan(p_id uuid)
returns table (name text, stage text, goal text, equipment text,
               training_days_per_week integer, session_length integer, injury_flags text[])
language sql security definer set search_path = '' as $$
  select name, stage, goal, equipment, training_days_per_week, session_length, injury_flags
  from public.coaching_clients where id = p_id;
$$;

create or replace function public.log_coaching_exercise(
  p_id uuid, p_exercise text, p_weight numeric, p_reps integer, p_is_bodyweight boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.coaching_clients where id = p_id) then
    raise exception 'unknown client';
  end if;
  insert into public.coaching_client_logs (client_id, exercise_name, weight, reps, is_bodyweight)
  values (p_id, p_exercise, p_weight, p_reps, p_is_bodyweight);
end;
$$;

create or replace function public.upsert_coaching_weight(p_id uuid, p_weight numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_week_start date := date_trunc('week', now())::date;  -- Monday, UTC
  v_existing bigint;
begin
  if not exists (select 1 from public.coaching_clients where id = p_id) then
    raise exception 'unknown client';
  end if;
  select id into v_existing from public.coaching_client_weights
    where client_id = p_id and logged_at >= v_week_start
    order by logged_at desc limit 1;
  if v_existing is not null then
    update public.coaching_client_weights set weight = p_weight, logged_at = current_date where id = v_existing;
  else
    insert into public.coaching_client_weights (client_id, weight, logged_at) values (p_id, p_weight, current_date);
  end if;
end;
$$;

-- anon only — the client log page is the sole caller.
revoke all on function public.get_coaching_plan(uuid) from public;
revoke all on function public.log_coaching_exercise(uuid, text, numeric, integer, boolean) from public;
revoke all on function public.upsert_coaching_weight(uuid, numeric) from public;
grant execute on function public.get_coaching_plan(uuid) to anon;
grant execute on function public.log_coaching_exercise(uuid, text, numeric, integer, boolean) to anon;
grant execute on function public.upsert_coaching_weight(uuid, numeric) to anon;
```

`ponytail:` `v_existing` is `bigint` — matches `coaching_client_weights.id` (identity bigint, confirmed live), not uuid.

- [ ] **Step 2: Apply Part A** via MCP `apply_migration` (name `coaching_rls_lockdown_part_a`, project `vikpcejlyxieguorwysf`).

- [ ] **Step 3: Verify the RPC returns only safe columns** — MCP `execute_sql`:

```sql
select * from public.get_coaching_plan(
  (select id from public.coaching_clients limit 1));
```
Expected: one row with exactly `name, stage, goal, equipment, training_days_per_week, session_length, injury_flags` — no email/stripe/billing keys.

- [ ] **Step 4: Commit** `git add supabase/migrations/2026-07-23-coaching-rls-lockdown.sql && git commit -m "feat(coaching): add id-scoped SECURITY DEFINER RPCs + owner predicate"`

---

## Task 2: Re-key the two pre-authenticated serverless functions to service-role

`stripe-webhook.js` (Stripe-signature-authed) and `send-coaching-inquiry-nudge.js` (`CRON_SECRET`-authed) are already caller-authenticated — service-role is safe. Only the DB key changes.

**Files:**
- Modify: `api/stripe-webhook.js:9`, `api/send-coaching-inquiry-nudge.js:8`

- [ ] **Step 1: `api/stripe-webhook.js`** — replace line 9:

```js
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

- [ ] **Step 2: `api/send-coaching-inquiry-nudge.js`** — replace line 8:

```js
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

- [ ] **Step 3: MANUAL (owner) — add the Vercel env var.** In Vercel → row project → Settings → Environment Variables, add `SUPABASE_SERVICE_ROLE_KEY` (value from Supabase → Project Settings → API → `service_role` secret) for Production + Preview. *(Claude does not handle this secret.)*

- [ ] **Step 4: Commit** `git commit -am "refactor(coaching): stripe-webhook + inquiry-nudge use service-role key"`

---

## Task 3: `create-coaching-payment.js` → service-role + owner-JWT gate

The HIGH finding: this endpoint has no caller auth. Add owner-JWT verification before any Stripe/DB action, and move DB calls to service-role.

**Files:**
- Create: `api/_lib/verify-owner.js`, `api/_lib/verify-owner.test.js`
- Modify: `api/create-coaching-payment.js`

- [ ] **Step 1: Write the failing test** `api/_lib/verify-owner.test.js`:

```js
import assert from 'node:assert';
import { verifyOwner } from './verify-owner.js';

const fetchStub = (ok, body) => async () => ({ ok, json: async () => body });
const owner = { email: 'carl.meyer.business@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' };

const cases = [
  ['no header', undefined, fetchStub(true, owner), false],
  ['non-bearer', 'Basic abc', fetchStub(true, owner), false],
  ['token rejected', 'Bearer x', fetchStub(false, {}), false],
  ['wrong email', 'Bearer x', fetchStub(true, { email: 'evil@x.com', email_confirmed_at: '2026-01-01' }), false],
  ['unconfirmed owner', 'Bearer x', fetchStub(true, { email: owner.email, email_confirmed_at: null }), false],
  ['confirmed owner', 'Bearer x', fetchStub(true, owner), true],
];
for (const [label, header, f, expected] of cases) {
  assert.equal(await verifyOwner(header, 'https://u', 'anon', f), expected, label);
}
console.log('verify-owner: all cases pass');
```

- [ ] **Step 2: Run it, verify it fails** — `node api/_lib/verify-owner.test.js` → FAIL (`Cannot find module './verify-owner.js'`).

- [ ] **Step 3: Implement** `api/_lib/verify-owner.js`:

```js
// Verifies the caller is the signed-in owner via Supabase's auth/v1/user
// endpoint. Returns true only for a confirmed session on the owner email.
const OWNER_EMAIL = 'carl.meyer.business@gmail.com';

export async function verifyOwner(authHeader, supabaseUrl, anonKey, fetchImpl = fetch) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  let r;
  try {
    r = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: 'Bearer ' + token },
    });
  } catch (e) { return false; }
  if (!r.ok) return false;
  const user = await r.json();
  return !!user && user.email === OWNER_EMAIL && !!user.email_confirmed_at;
}
```

- [ ] **Step 4: Run it, verify it passes** — `node api/_lib/verify-owner.test.js` → `verify-owner: all cases pass`.

- [ ] **Step 5: Wire into `api/create-coaching-payment.js`.** Change the key constants (lines 10-11) to keep the anon key for auth-verify AND add service-role for DB:

```js
const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;  // DB calls below
```

Add the import at the top:

```js
import { verifyOwner } from './_lib/verify-owner.js';
```

Insert the gate as the first thing inside `handler`, immediately after the method check (`create-coaching-payment.js:17`):

```js
  if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
```

(`buildClientLookupRequest`/`buildClientUpdateRequest` keep using `SUPABASE_KEY`, now service-role — RLS-independent.)

- [ ] **Step 6: Commit** `git add api/_lib/verify-owner.js api/_lib/verify-owner.test.js api/create-coaching-payment.js && git commit -m "feat(coaching): owner-JWT gate + service-role on create-coaching-payment"`

---

## Task 4: `coaching-log.html` — direct table calls → RPCs

**Files:**
- Modify: `coaching-log.html` (3 call sites)

- [ ] **Step 1: Plan read → RPC.** Replace `coaching-log.html:107`:

```js
    const { data: rows, error } = await supa.rpc('get_coaching_plan', { p_id: clientId });
    const data = rows && rows[0];
    if (error || !data) { document.getElementById('clientTitle').textContent = 'Client not found'; return; }
```

- [ ] **Step 2: Exercise log → RPC.** Replace the insert at `coaching-log.html:95-97`:

```js
        const { error } = await supa.rpc('log_coaching_exercise', {
          p_id: clientId, p_exercise: exName, p_weight: weight, p_reps: reps, p_is_bodyweight: meta.bw
        });
```

- [ ] **Step 3: Weight upsert → RPC.** Replace the select-then-upsert block at `coaching-log.html:133-140` (the `weekStart`/`existing`/`result` logic) with:

```js
    const result = await supa.rpc('upsert_coaching_weight', { p_id: clientId, p_weight: weight });
    statusEl.textContent = result.error ? 'Save failed: ' + result.error.message : 'Saved.';
```

Delete the now-unused `startOfWeek` function and the `weekStart`/`today` locals in that handler (the week logic now lives in the RPC).

- [ ] **Step 4: Commit** `git commit -am "refactor(coaching-log): read/write via id-scoped RPCs, no direct table access"`

---

## Task 5: Owner auth gate + payment-call token

**Files:**
- Create: `coaching-auth.js`
- Modify: `coaching.html`, `coaching-plan.html`

- [ ] **Step 1: Create `coaching-auth.js`:**

```js
// Supabase Auth gate for the owner dashboard pages (coaching.html,
// coaching-plan.html). Blocks the page until the owner is signed in.
(function () {
  'use strict';
  function markAuthed() { try { sessionStorage.setItem('row_auth', '1'); } catch (e) {} }

  function appendWhenReady(node) {
    if (document.body) { document.body.appendChild(node); }
    else { document.addEventListener('DOMContentLoaded', () => document.body.appendChild(node), { once: true }); }
  }

  function showLogin(supa) {
    return new Promise((resolve) => {
      document.documentElement.style.visibility = 'hidden';
      const overlay = document.createElement('div');
      overlay.id = 'coaching-auth-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:#080808;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;';
      overlay.innerHTML =
        '<form id="ca-form" style="width:100%;max-width:340px;padding:36px 30px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:12px;">' +
        '<div style="color:#FAFAFA;font-size:18px;font-weight:700;">Coaching — sign in</div>' +
        '<input id="ca-email" type="email" placeholder="Email" autocomplete="username" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<input id="ca-pass" type="password" placeholder="Password" autocomplete="current-password" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<div id="ca-error" style="color:#FF6B6B;font-size:12px;display:none;"></div>' +
        '<button type="submit" style="padding:12px;border-radius:12px;border:0;background:#FAFAFA;color:#0A0A0B;font-size:14px;font-weight:700;cursor:pointer;">Sign in</button>' +
        '</form>';
      appendWhenReady(overlay);
      document.documentElement.style.visibility = '';
      overlay.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = overlay.querySelector('#ca-error');
        const { data, error } = await supa.auth.signInWithPassword({
          email: overlay.querySelector('#ca-email').value.trim(),
          password: overlay.querySelector('#ca-pass').value,
        });
        if (error || !data.session) { errEl.textContent = error ? error.message : 'Sign-in failed'; errEl.style.display = 'block'; return; }
        markAuthed();
        overlay.remove();
        resolve(data.session);
      });
    });
  }

  window.CoachingAuth = {
    // Resolves once the owner has a session. Call before loading any data.
    async ensure(supa) {
      const { data: { session } } = await supa.auth.getSession();
      if (session) { markAuthed(); return session; }
      return showLogin(supa);
    },
  };
})();
```

- [ ] **Step 2: `coaching.html`** — add to `<head>` (after the supabase CDN script, `coaching.html:11`):

```html
<script src="coaching-auth.js"></script>
```

Gate the data load — replace the final `loadClients(); loadInquiries();` (`coaching.html:355-356`):

```js
  window.CoachingAuth.ensure(supa).then(() => { loadClients(); loadInquiries(); });
```

Attach the owner token to the payment call — in `submitBill`, replace the `fetch('/api/create-coaching-payment', …)` (`coaching.html:226-230`):

```js
      const { data: { session } } = await supa.auth.getSession();
      const r = await fetch('/api/create-coaching-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session ? session.access_token : '') },
        body: JSON.stringify({ clientId, amountDollars, frequency: freqSelect.value }),
      });
```

- [ ] **Step 3: `coaching-plan.html`** — add to `<head>` (after `coaching-plan.html:8`):

```html
<script src="coaching-auth.js"></script>
```

Gate the load — replace the final `load();` (`coaching-plan.html:260`):

```js
  window.CoachingAuth.ensure(supa).then(load);
```

- [ ] **Step 4: Commit** `git add coaching-auth.js coaching.html coaching-plan.html && git commit -m "feat(coaching): Supabase Auth gate on dashboard + owner token on billing call"`

- [ ] **Step 5: Deploy** all of Tasks 2-5 to Vercel (push to `main` triggers it, or `vercel --prod`). The RPCs (Task 1) and the code are now live BEFORE the policy cutover.

---

## Task 6: MANUAL (owner) — create the Supabase Auth user

- [ ] **Step 1:** Supabase → Authentication → Users → Add user → email `carl.meyer.business@gmail.com`, a strong password, **mark email confirmed** (the payment gate requires `email_confirmed_at`). *(Claude does not create accounts / handle passwords.)*
- [ ] **Step 2:** If public sign-ups are enabled on the project, disable them (Authentication → Providers → Email → disable "Enable sign-ups") so no other account can be created. Verify and report.

---

## Task 7: The cutover migration — lock down the tables

Apply ONLY after Tasks 1-6 are live and the auth user exists. This is the moment anon loses table access.

**Files:**
- Modify: `supabase/migrations/2026-07-23-coaching-rls-lockdown.sql` (append Part B)

- [ ] **Step 1: Append Part B to the migration file:**

```sql
-- ============================================================
-- PART B — CUTOVER (apply only after RPCs + re-keyed serverless + auth gate are live)
-- ============================================================

-- coaching_clients: drop blanket anon; owner-only.
drop policy if exists "anon full access to coaching_clients" on public.coaching_clients;
create policy "owner full access to coaching_clients"
  on public.coaching_clients for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

-- coaching_inquiries: RLS already ON; keep existing anon INSERT-only; drop the two leaks.
alter table public.coaching_inquiries enable row level security;
drop policy if exists "anon select coaching_inquiries" on public.coaching_inquiries;
drop policy if exists "anon update coaching_inquiries" on public.coaching_inquiries;
create policy "owner full access to coaching_inquiries"
  on public.coaching_inquiries for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

-- logs + weights: turn RLS ON; owner full; anon reaches them only via RPCs.
alter table public.coaching_client_logs enable row level security;
create policy "owner full access to coaching_client_logs"
  on public.coaching_client_logs for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());
alter table public.coaching_client_weights enable row level security;
create policy "owner full access to coaching_client_weights"
  on public.coaching_client_weights for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());
```

- [ ] **Step 2: Apply Part B** via MCP `apply_migration` (name `coaching_rls_lockdown_part_b`).

- [ ] **Step 3: Post-migration assertion (fails loudly if any leak remains)** — MCP `execute_sql`:

```sql
select tablename, policyname, cmd, roles::text
from pg_policies
where tablename like 'coaching%' and 'anon' = any (roles) and cmd <> 'INSERT';
```
Expected: **0 rows.** Any row = a residual anon read/write path; stop and fix.

- [ ] **Step 4: Confirm RLS on all four** — `execute_sql`:

```sql
select relname, relrowsecurity from pg_class
where relnamespace='public'::regnamespace and relname like 'coaching%' and relkind='r';
```
Expected: all four `true`.

- [ ] **Step 5: Commit** `git commit -am "feat(coaching): cutover — lock coaching tables to owner + RPC-only anon"`

---

## Task 8: Verification & anon attack-test

- [ ] **Step 1: Anon cannot dump (MCP `execute_sql` as a check, then the real anon test).** Confirm the advisor is clean:

MCP `get_advisors({ project_id: 'vikpcejlyxieguorwysf', type: 'security' })` → the two `rls_disabled_in_public` ERRORs for `coaching_client_logs`/`coaching_client_weights` are **gone**, and no `coaching_clients`/`coaching_inquiries` `rls_policy_always_true` for anon remains.

- [ ] **Step 2: Real anon attack-test** (browser console on the deployed site, or `curl` with the publishable key). All must return empty/`401`/`403`, none return data:

```
GET /rest/v1/coaching_clients?select=*            → [] or 401
GET /rest/v1/coaching_inquiries?select=*          → [] or 401
GET /rest/v1/coaching_client_logs?select=*        → [] or 401
GET /rest/v1/coaching_client_weights?select=*     → [] or 401
POST /rpc/get_coaching_plan {"p_id":"<random uuid>"} → []   (real id → 7 safe cols only)
POST /api/create-coaching-payment (no Authorization) → 401
```

- [ ] **Step 3: `/verify` the client page.** Open `coaching-log.html?id=<real id>`: plan renders, an exercise logs, weight saves. Confirm the network response for the plan RPC contains **no** email/stripe/billing fields.

- [ ] **Step 4: `/verify` the dashboard.** Open `coaching.html`: login gate blocks → sign in → client list + inquiries load; add-client, archive, issue-plan (via `coaching-plan.html`), and **Bill** (creates a Stripe link) all work. Confirm a Stripe test webhook still flips `billing_status`.

- [ ] **Step 5: `/code-review`** the branch before merge (security diff — ask Carl normal vs +codex).

---

## Task 9: Cross-repo — wire `get_advisors` into `audit-projects`

Independent of Tasks 1-8. Workspace repo, not the row repo.

**Files:**
- Modify: `G:\My Drive\Claude\.claude\scheduled-tasks\audit-projects\SKILL.md` (verify worktree/main drift first — the live task reads the main checkout)

- [ ] **Step 1:** After the `## 3b. Mobile-layout spot-check…` subsection, insert:

```markdown
## 3c. Supabase security advisors (added 2026-07-24, standard+ only)
The `get_advisors` linter catches the exact class that the coaching-RLS incident was (RLS off on a public table, anon-permissive policies, SECURITY DEFINER issues) — cheaply, before it ships. Nothing consumed it before.
- For each Supabase-backed project (Row `vikpcejlyxieguorwysf`; Vessel + Content Manager — get each ref from its project memory note or `supabase` config), call the Supabase MCP `get_advisors({ type: 'security' })`.
- Surface every ERROR and every WARN whose table holds third-party PII/billing (coaching, leads). Blanket-anon on Carl's *own*-data tables (app_state, food_log, etc.) is a known accepted pattern — note the count, don't re-flag each.
- Requires the Supabase connector; if unavailable, note "skipped — connector not authorized" and move on. One MCP call/project; report-only.
```

- [ ] **Step 2:** In the `## Log this run` section, add `"ran section 3c: supabase advisors"` to the example steps list.

- [ ] **Step 3: Commit** in the workspace repo: `git commit -am "feat(audit-projects): add Supabase get_advisors security check (§3c)"`

---

## Self-review notes

- **Spec coverage:** §4a→T2/T3, §4b→T1/T4, §4c→T5, §4d/§4e→T7, §5.1 corrections→T1(hardening)/T3(payment auth)/T7(real names+assertion)/grants, §6→T9, §7→T8. ✓
- **Sequencing:** additive (T1) + code/deploy (T2-5) + auth user (T6) precede the restrictive cutover (T7). ✓
- **Accepted risk (bearer link discloses one client's name+injury_flags):** needs Carl's explicit OK (spec §5.1) — not a code task.
- **Deferred:** inquiry spam hardening; retiring topbar passphrase; the ~13 other blanket-anon (own-data) tables.
