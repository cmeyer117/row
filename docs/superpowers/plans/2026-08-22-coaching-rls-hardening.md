# Coaching RLS Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three live Supabase RLS/grant gaps found by a `supabase-rls-audit` pass on 2026-08-22 — an unauthenticated IDOR on the coaching-log RPCs, and two RLS policies (`commitments`, `jarvis_tasks`) that are named "carl only" but actually grant unrestricted public access, plus the same missing-owner-check shape on `decisions`.

**Architecture:** `coaching-log.html` currently calls 4 `SECURITY DEFINER` RPCs directly from the browser using only the client's row UUID from the URL, with the anon key — no auth check at all, so anyone with a client's log link can read/write that client's weights and exercise history. There's no client-auth system to switch this to real RLS (`row-auth.js`/`vessel-auth.js` have no signup flow — the only authenticated principal in this Supabase project is Carl). So instead: add an opaque per-client `access_token`, revoke direct RPC execute from `anon`/`authenticated`, and add a single server-side Vercel function (`row/api/coaching-client.js`) that checks the token with a constant-time compare before calling the RPCs with the service-role key. `commitments`/`jarvis_tasks`/`decisions` get their overly-broad policies swapped for the same `authenticated` + `coaching_is_owner()` pattern every sibling table already uses (`app_state`, `food_log`, etc.) — zero behavior change for Carl's own session-based access, and zero effect on Jarvis/Vision which touch these via the service-role key that bypasses RLS entirely.

**Tech Stack:** Supabase Postgres (RLS policies, SQL functions), Vercel serverless functions (Node, no framework), vanilla JS in `coaching-log.html`.

**Out of scope (confirmed with Carl):** `coaching-plan.html` is Carl's own owner-gated dashboard (`window.RowAuth.ensure()` + `coaching_is_owner()` RLS) — not part of this fix, no changes needed there. Regenerating/resending client links with tokens is an operational step for Carl after this ships, not part of this plan.

---

### Task 1: Add `access_token` to `coaching_clients` and lock down the coaching RPCs

**Files:**
- Create: `row/supabase/migrations/2026-08-22-coaching-client-access-token.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Closes an IDOR found by a supabase-rls-audit pass on 2026-08-22:
-- coaching-log.html calls get_coaching_client_logs/get_coaching_plan/
-- log_coaching_exercise/upsert_coaching_weight directly from the browser
-- with only the client's row UUID (from the URL) and the anon key -- no
-- auth check. Anyone holding a client's log link had full read/write to
-- that client's weights and exercise history. There's no client-auth
-- system to switch this to real RLS (row-auth.js has no signup flow --
-- Carl is the only authenticated principal in this project), so instead:
-- add an opaque per-client bearer token, and revoke direct RPC execute
-- from anon/authenticated so only the new server-side proxy
-- (row/api/coaching-client.js, using the service-role key) can call them.
alter table public.coaching_clients
  add column access_token text;

update public.coaching_clients
  set access_token = encode(gen_random_bytes(24), 'hex')
  where access_token is null;

alter table public.coaching_clients
  alter column access_token set not null,
  alter column access_token set default encode(gen_random_bytes(24), 'hex');

create unique index coaching_clients_access_token_key
  on public.coaching_clients (access_token);

revoke execute on function public.get_coaching_client_logs(uuid, text) from anon, authenticated;
revoke execute on function public.get_coaching_plan(uuid) from anon, authenticated;
revoke execute on function public.log_coaching_exercise(uuid, text, numeric, integer, boolean) from anon, authenticated;
revoke execute on function public.upsert_coaching_weight(uuid, numeric) from anon, authenticated;

grant execute on function public.get_coaching_client_logs(uuid, text) to service_role;
grant execute on function public.get_coaching_plan(uuid) to service_role;
grant execute on function public.log_coaching_exercise(uuid, text, numeric, integer, boolean) to service_role;
grant execute on function public.upsert_coaching_weight(uuid, numeric) to service_role;
```

- [ ] **Step 2: Apply the migration to the live project via the Supabase MCP**

Use `mcp__715f7ddf-*__apply_migration` with `project_id: vikpcejlyxieguorwysf`, `name: coaching_client_access_token`, and the SQL body above.

- [ ] **Step 3: Verify live**

Run via `mcp__715f7ddf-*__execute_sql`:
```sql
select count(*) filter (where access_token is null) as null_tokens,
       count(distinct access_token) as distinct_tokens,
       count(*) as total
from public.coaching_clients;
```
Expected: `null_tokens = 0`, `distinct_tokens = total`.

```sql
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('get_coaching_client_logs','get_coaching_plan','log_coaching_exercise','upsert_coaching_weight')
order by routine_name, grantee;
```
Expected: only `service_role` (and `postgres`/owner) rows — no `anon` or `authenticated` rows.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gregm\row
git add supabase/migrations/2026-08-22-coaching-client-access-token.sql
git commit -m "fix(supabase): revoke anon exec on coaching RPCs, add per-client access token"
```

---

### Task 2: Fix the `commitments`, `jarvis_tasks`, `decisions` policies

**Files:**
- Create: `row/supabase/migrations/2026-08-22-scope-commitments-jarvis-tasks-decisions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Closes two gaps found by a supabase-rls-audit pass on 2026-08-22:
-- "carl only" was the policy NAME on commitments/jarvis_tasks, but the
-- policy itself granted role `public` with `qual: true` -- no identity
-- check at all, so anyone with the anon key could read/write both tables
-- directly via PostgREST regardless of what Carl's own app code calls.
-- decisions had the same shape (authenticated + qual true, no owner
-- check) -- harmless today since Carl is the only authenticated
-- principal in this project, but a landmine once client auth
-- (docs/superpowers/plans/2026-08-09-standalone-coaching-app-plan2-scaffold-auth.md)
-- ships. All three now match every sibling table's pattern (app_state,
-- food_log, etc.).
drop policy "carl only" on public.commitments;
create policy "owner full access to commitments"
  on public.commitments
  for all
  to authenticated
  using (coaching_is_owner())
  with check (coaching_is_owner());

drop policy "carl only" on public.jarvis_tasks;
create policy "owner full access to jarvis_tasks"
  on public.jarvis_tasks
  for all
  to authenticated
  using (coaching_is_owner())
  with check (coaching_is_owner());

drop policy "authenticated full access to decisions" on public.decisions;
create policy "owner full access to decisions"
  on public.decisions
  for all
  to authenticated
  using (coaching_is_owner())
  with check (coaching_is_owner());
```

- [ ] **Step 2: Apply the migration to the live project via the Supabase MCP**

Use `mcp__715f7ddf-*__apply_migration` with `project_id: vikpcejlyxieguorwysf`, `name: scope_commitments_jarvis_tasks_decisions`, and the SQL body above.

- [ ] **Step 3: Verify live**

```sql
select tablename, policyname, roles, qual
from pg_policies
where schemaname='public' and tablename in ('commitments','jarvis_tasks','decisions');
```
Expected: each table has exactly one policy, role `{authenticated}`, qual `coaching_is_owner()` (not `true`).

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gregm\row
git add supabase/migrations/2026-08-22-scope-commitments-jarvis-tasks-decisions.sql
git commit -m "fix(supabase): scope commitments/jarvis_tasks/decisions RLS to coaching_is_owner()"
```

---

### Task 3: Server-side coaching-client API proxy

**Files:**
- Create: `row/api/coaching-client.js`

- [ ] **Step 1: Write the endpoint**

```javascript
// Server-side proxy for coaching-log.html. Replaces direct anon RPC calls
// (get_coaching_client_logs/get_coaching_plan/log_coaching_exercise/
// upsert_coaching_weight), which were callable by anyone holding a
// client's log-link UUID with no auth check -- see
// docs/superpowers/plans/2026-08-22-coaching-rls-hardening.md. Every
// request must carry the client's opaque access_token; this checks it
// with a constant-time compare before calling the RPC with the
// service-role key (the RPCs themselves now revoke anon/authenticated
// execute, so this is the only path that can reach them).
import { timingSafeEqual } from 'crypto';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function restFetch(path, options) {
  const res = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...(options && options.headers),
    },
  });
  return res;
}

async function loadClientToken(id) {
  const res = await restFetch(`/rest/v1/coaching_clients?id=eq.${encodeURIComponent(id)}&select=access_token`);
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].access_token : null;
}

async function callRpc(fn, args) {
  const res = await restFetch(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  const { action } = req.query;
  const id = req.method === 'GET' ? req.query.id : req.body && req.body.id;
  const token = req.method === 'GET' ? req.query.token : req.body && req.body.token;

  if (!id || !token) {
    res.status(400).json({ error: 'id and token are required' });
    return;
  }

  const realToken = await loadClientToken(id);
  if (!realToken || !safeEqual(token, realToken)) {
    res.status(401).json({ error: 'Invalid client token' });
    return;
  }

  try {
    if (req.method === 'GET' && action === 'plan') {
      const { ok, data } = await callRpc('get_coaching_plan', { p_id: id });
      res.status(ok ? 200 : 502).json({ data });
      return;
    }
    if (req.method === 'GET' && action === 'logs') {
      const exercise = req.query.exercise;
      if (!exercise) { res.status(400).json({ error: 'exercise is required' }); return; }
      const { ok, data } = await callRpc('get_coaching_client_logs', { p_id: id, p_exercise: exercise });
      res.status(ok ? 200 : 502).json({ data });
      return;
    }
    if (req.method === 'POST' && action === 'log-exercise') {
      const { exercise, weight, reps, isBodyweight } = req.body || {};
      if (!exercise || !Number.isFinite(weight) || !Number.isInteger(reps)) {
        res.status(400).json({ error: 'exercise, weight, reps are required' });
        return;
      }
      const { ok } = await callRpc('log_coaching_exercise', {
        p_id: id, p_exercise: exercise, p_weight: weight, p_reps: reps, p_is_bodyweight: !!isBodyweight,
      });
      res.status(ok ? 200 : 502).json({ ok });
      return;
    }
    if (req.method === 'POST' && action === 'upsert-weight') {
      const { weight } = req.body || {};
      if (!Number.isFinite(weight)) { res.status(400).json({ error: 'weight is required' }); return; }
      const { ok } = await callRpc('upsert_coaching_weight', { p_id: id, p_weight: weight });
      res.status(ok ? 200 : 502).json({ ok });
      return;
    }
    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Supabase' });
  }
}
```

- [ ] **Step 2: Self-check the token comparison**

Create `row/api/coaching-client.selfcheck.js` (matches the existing `hype-fetch-row-workout-dates.selfcheck.js` convention — plain assert script, no test framework):

```javascript
import assert from 'assert';
import { execFileSync } from 'child_process';

// Re-implements just the safeEqual logic inline since coaching-client.js
// has no exports (it's a Vercel handler) -- this checks the actual
// algorithm shape (length-mismatch short-circuit, equal/unequal cases),
// not the live import.
import { timingSafeEqual } from 'crypto';
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

assert.strictEqual(safeEqual('abc123', 'abc123'), true, 'equal tokens must match');
assert.strictEqual(safeEqual('abc123', 'abc124'), false, 'different tokens must not match');
assert.strictEqual(safeEqual('abc', 'abcdef'), false, 'different-length tokens must not match');
assert.strictEqual(safeEqual('', ''), true, 'two empty strings are equal (defense in depth: callers already reject empty token before this runs)');

console.log('coaching-client token check: OK');
```

- [ ] **Step 3: Run the self-check**

Run: `node row/api/coaching-client.selfcheck.js`
Expected: `coaching-client token check: OK`

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gregm\row
git add api/coaching-client.js api/coaching-client.selfcheck.js
git commit -m "feat(coaching): server-side token-gated proxy for coaching RPCs"
```

---

### Task 4: Wire `coaching-log.html` to the new endpoint

**Files:**
- Modify: `row/coaching-log.html:53-56` (client setup), `row/coaching-log.html:85-88` (`getClientLogs`), `row/coaching-log.html:120-122` (log exercise call), `row/coaching-log.html:143-147` (load plan), `row/coaching-log.html:172` (upsert weight)

- [ ] **Step 1: Replace client setup to read `token` from the URL and drop the Supabase client**

Replace lines 53-56:
```javascript
  const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
  const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const clientId = new URLSearchParams(window.location.search).get('id');
```
with:
```javascript
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('id');
  const clientToken = params.get('token');
```
(the `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>` tag on line 8 can also be removed — this page no longer talks to Supabase directly.)

- [ ] **Step 2: Replace `getClientLogs`**

Replace lines 85-88:
```javascript
  async function getClientLogs(clientIdArg, exerciseName) {
    const { data, error } = await supa.rpc('get_coaching_client_logs', { p_id: clientIdArg, p_exercise: exerciseName });
    return (error || !data) ? [] : data;
  }
```
with:
```javascript
  async function getClientLogs(clientIdArg, exerciseName) {
    const res = await fetch('/api/coaching-client?action=logs&id=' + encodeURIComponent(clientIdArg) +
      '&token=' + encodeURIComponent(clientToken) + '&exercise=' + encodeURIComponent(exerciseName));
    if (!res.ok) return [];
    const { data } = await res.json();
    return data || [];
  }
```

- [ ] **Step 3: Replace the log-exercise call**

Replace lines 120-122:
```javascript
        const { error } = await supa.rpc('log_coaching_exercise', {
          p_id: clientId, p_exercise: exName, p_weight: weight, p_reps: reps, p_is_bodyweight: meta.bw
        });
```
with:
```javascript
        const res = await fetch('/api/coaching-client?action=log-exercise', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: clientId, token: clientToken, exercise: exName, weight, reps, isBodyweight: meta.bw }),
        });
        const error = !res.ok;
```

- [ ] **Step 4: Replace the plan load**

Replace lines 143-147:
```javascript
  async function load() {
    if (!clientId) { document.getElementById('clientTitle').textContent = 'No client ID given'; return; }
    const { data: rows, error } = await supa.rpc('get_coaching_plan', { p_id: clientId });
    const data = rows && rows[0];
    if (error || !data) { document.getElementById('clientTitle').textContent = 'Client not found'; return; }
```
with:
```javascript
  async function load() {
    if (!clientId || !clientToken) { document.getElementById('clientTitle').textContent = 'No client link given'; return; }
    const res = await fetch('/api/coaching-client?action=plan&id=' + encodeURIComponent(clientId) +
      '&token=' + encodeURIComponent(clientToken));
    const body = res.ok ? await res.json() : null;
    const data = body && body.data && body.data[0];
    if (!res.ok || !data) { document.getElementById('clientTitle').textContent = 'Client not found'; return; }
```

- [ ] **Step 5: Replace the upsert-weight call**

Replace line 172:
```javascript
    const result = await supa.rpc('upsert_coaching_weight', { p_id: clientId, p_weight: weight });
    statusEl.textContent = result.error ? 'Save failed: ' + result.error.message : 'Saved.';
```
with:
```javascript
    const res = await fetch('/api/coaching-client?action=upsert-weight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clientId, token: clientToken, weight }),
    });
    statusEl.textContent = res.ok ? 'Saved.' : 'Save failed.';
```

- [ ] **Step 6: Manual verification**

Deploy or run locally, then hit `coaching-log.html?id=<a real client id>&token=<its access_token from Task 1>` and confirm the page loads the plan and a weight save succeeds. Then hit the same URL with a wrong/missing `token` and confirm it shows "Client not found" and no data leaks (check the Network tab: `/api/coaching-client` should return 401, not client data).

- [ ] **Step 7: Commit**

```bash
cd C:\Users\gregm\row
git add coaching-log.html
git commit -m "fix(coaching-log): route RPC calls through token-gated server proxy"
```

---

### Task 5: Update the vault registry and hand back client links to Carl

**Files:**
- Modify: `G:\My Drive\Claude\Carl Meyer\11 - Tech Stack\Supabase Key Consumers.md`

- [ ] **Step 1: Correct the earlier false-positive and add the fix record**

Edit the "Known risk items" section: remove/correct item 4 (Vision's `commitments`/`vision_recommendations` calls were verified to already use the service-role client, not anon — the earlier flag was based on which exports existed in `packages/capabilities/src/supabase.ts`, not which ones are actually called). Add a new dated note recording that the coaching RPC IDOR, and the `commitments`/`jarvis_tasks`/`decisions` open-policy gaps, were found by a live `supabase-rls-audit` pass on 2026-08-22 and fixed via this plan (link the plan file).

- [ ] **Step 2: Tell Carl (not part of the commit)**

At the end of this plan's execution, surface clearly: every existing `coaching-log.html?id=...` link Carl has already sent to clients needs the client's `access_token` appended as `&token=...` (pull it from `coaching_clients.access_token` for that row) or the client will see "No client link given". This is Carl's call on how/when to redistribute — do not send anything without his say-so.

- [ ] **Step 3: Commit (Drive workspace)**

```bash
cd "G:\My Drive\Claude"
git add "Carl Meyer/11 - Tech Stack/Supabase Key Consumers.md"
git commit -m "docs(supabase): record coaching RLS hardening fix, correct false-positive risk item"
git push
```
(`Carl Meyer/` is gitignored in this repo per `.gitignore:10` — confirm with `git status` first; if it's ignored, this step is a no-op and the note is vault-only, same as its initial creation.)
