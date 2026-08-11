# RLS Lockdown — app_state / food_log / push_subscriptions / workout_events — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the blanket-anon RLS gap on Row's `app_state`, `food_log`, `push_subscriptions`, `workout_events` tables (+ `progress-photos`/`hype-audio` storage upload policies), replacing the client-side-only passphrase gate with real Supabase Auth — without breaking Jarvis, Vision, or Row's own scheduled nudges, which all currently read/write these tables using the same public anon key from trusted server code.

**Architecture:** Reuse the existing `coaching_is_owner()` Supabase Auth pattern (proven 2026-07-23 on `coaching_clients`) for the browser side — a new shared `row-auth.js` module replaces `topbar.js`'s passphrase overlay with a real login gate. For every trusted backend caller (Row's 3 Vercel cron nudges + `subscribe-push.js`, Jarvis's `getSupabase()`, Vision's vendored copy of the same file), swap the anon key for the `service_role` key, which bypasses RLS by design — the correct pattern for a server that can't do interactive login. Roll out in two DB stages (PART A additive, PART B cutover) so nothing is locked out until its replacement path is verified live.

**Tech Stack:** Supabase (Postgres RLS + Auth), vanilla JS (Row, no framework), Vercel serverless functions, Railway (Jarvis + Vision backends), Supabase MCP for live DB inspection/migration.

**Spec:** `row/docs/superpowers/specs/2026-08-11-rls-lockdown-app-state-design.md`

**Repos touched:**
- `row` — native checkout at `C:\Users\gregm\row` (git repo, `main` branch, already up to date)
- `jarvis` — scratch checkout at `C:\Users\gregm\claude-workspace-scratch\jarvis` (must `git fetch && git reset --hard origin/master` before use per standing rule — this clone is never a source of truth)
- `vision` — scratch checkout at `C:\Users\gregm\claude-workspace-scratch\vision` (same rule; vendors `db/supabase.ts` byte-identical from the sibling `jarvis` checkout at deploy time, so fixing Jarvis's copy is sufficient — no separate Vision source edit needed for the key swap)

---

## Part 1 — Row: real login replaces the passphrase

### Task 1: Create `row-auth.js`

**Files:**
- Create: `C:\Users\gregm\row\row-auth.js`

- [ ] **Step 1: Write the file**

```js
// Real Supabase Auth gate for every Row page — replaces the old shared
// client-side passphrase (topbar.js's AUTH_PASS). Blocks the page until the
// owner has a real session. Once that session exists, it's persisted by the
// Supabase JS client in localStorage (keyed to this project's URL) and
// automatically picked up by every OTHER client instance the app creates
// (sync.js's internal client, gym.html's/macros.html's own inline clients,
// etc.) — no shared client object needed, no changes required to any of
// those files.
(function () {
  'use strict';
  const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
  const AUTH_KEY = 'row_auth';

  function markAuthed() { try { sessionStorage.setItem(AUTH_KEY, '1'); } catch (e) {} }

  function appendWhenReady(node) {
    if (document.body) { document.body.appendChild(node); }
    else { document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(node); }, { once: true }); }
  }

  function showLogin(supa) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.id = 'row-auth-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:#080808;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;';
      overlay.innerHTML =
        '<form id="ra-form" style="width:100%;max-width:340px;padding:36px 30px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:12px;">' +
        '<div style="color:#FAFAFA;font-size:18px;font-weight:700;">Carl&#39;s Dashboard &mdash; sign in</div>' +
        '<input id="ra-email" type="email" placeholder="Email" autocomplete="username" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<input id="ra-pass" type="password" placeholder="Password" autocomplete="current-password" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<div id="ra-error" style="color:#FF6B6B;font-size:12px;display:none;"></div>' +
        '<button type="submit" style="padding:12px;border-radius:12px;border:0;background:#FAFAFA;color:#0A0A0B;font-size:14px;font-weight:700;cursor:pointer;">Sign in</button>' +
        '</form>';
      appendWhenReady(overlay);
      overlay.addEventListener('submit', async function (e) {
        e.preventDefault();
        var errEl = overlay.querySelector('#ra-error');
        var res = await supa.auth.signInWithPassword({
          email: overlay.querySelector('#ra-email').value.trim(),
          password: overlay.querySelector('#ra-pass').value,
        });
        if (res.error || !res.data.session) {
          errEl.textContent = res.error ? res.error.message : 'Sign-in failed';
          errEl.style.display = 'block';
          return;
        }
        markAuthed();
        overlay.remove();
        resolve(res.data.session);
      });
    });
  }

  window.RowAuth = {
    // Resolves once the owner has a real Supabase Auth session. Caller is
    // responsible for hiding page content until this resolves.
    ensure: async function () {
      if (!window.supabase) throw new Error('RowAuth.ensure() called before the Supabase CDN script loaded');
      var supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      var got = await supa.auth.getSession();
      if (got.data.session) { markAuthed(); return got.data.session; }
      return showLogin(supa);
    },
  };
})();
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/gregm/row
git add row-auth.js
git commit -m "feat: add row-auth.js, a shared real-login gate for every page"
```

---

### Task 2: Rewrite `topbar.js`'s auth gate to use `RowAuth`

**Files:**
- Modify: `C:\Users\gregm\row\topbar.js:11-74`

- [ ] **Step 1: Replace the passphrase gate**

Replace lines 11-74 (from `// -------- Auth gate...` through the closing `}` of `authGate()`, i.e. everything between that comment and the `-------- Service worker --------` comment) with:

```js
  // -------- Auth gate — blocks page until real Supabase Auth session --------
  function authGate() {
    if (window.self !== window.top) return; // skip iframes
    document.documentElement.style.visibility = 'hidden';
    window.RowAuth.ensure().then(function () {
      document.documentElement.style.visibility = '';
    }).catch(function (err) {
      // Fail open rather than permanently blanking the page on a network
      // hiccup — matches the old gate's behavior of never leaving Carl
      // locked out by something other than a wrong credential.
      console.error('RowAuth.ensure() failed:', err);
      document.documentElement.style.visibility = '';
    });
  }

  authGate();
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/gregm/row
git add topbar.js
git commit -m "feat: topbar.js real-login gate replaces the shared passphrase"
```

---

### Task 3: Include `row-auth.js` on every page, ahead of `topbar.js`

**Files (add `<script src="row-auth.js" defer></script>` immediately before the existing `<script src="topbar.js" defer></script>` line in each):**
- Modify: `gym.html`, `state-of-me.html`, `health.html`, `mobility.html`, `form-coach.html`, `main.html`, `index.html`, `row-wrapped.html`, `macros.html`, `posing.html`, `cooking.html`, `finance.html`, `coaching.html`, `coaching-plan.html`

- [ ] **Step 1: Add the script tag to each of the 14 files**

For each file, find its existing `<script src="topbar.js" defer></script>` line and insert directly above it:

```html
<script src="row-auth.js" defer></script>
```

(Both are `defer`, so they execute in document order relative to each other, after the synchronous `@supabase/supabase-js` CDN script that's already present earlier in every one of these 14 files' `<head>` — confirmed present in all 14 during planning.)

- [ ] **Step 2: Verify with a grep that all 14 got it and none got a duplicate**

```bash
cd C:/Users/gregm/row
grep -l 'row-auth.js' *.html | wc -l
```
Expected: `14`

```bash
grep -c 'row-auth.js' *.html | grep -v ':1$'
```
Expected: no output (every matching file has exactly one include).

- [ ] **Step 3: Commit**

```bash
cd C:/Users/gregm/row
git add gym.html state-of-me.html health.html mobility.html form-coach.html main.html index.html row-wrapped.html macros.html posing.html cooking.html finance.html coaching.html coaching-plan.html
git commit -m "feat: wire row-auth.js into every page's head, ahead of topbar.js"
```

---

### Task 4: Retire `coaching-auth.js` — fold into the unified gate

**Files:**
- Modify: `C:\Users\gregm\row\coaching.html:12` (remove script tag), `:389` (swap call)
- Modify: `C:\Users\gregm\row\coaching-plan.html:9` (remove script tag), `:261` (swap call)
- Delete: `C:\Users\gregm\row\coaching-auth.js`

- [ ] **Step 1: `coaching.html`** — remove line 12 (`<script src="coaching-auth.js"></script>`); it already got `row-auth.js` + `topbar.js` in Task 3. Change line 389 from:
```js
  window.CoachingAuth.ensure(supa).then(function () { loadClients(); loadInquiries(); });
```
to:
```js
  window.RowAuth.ensure().then(function () { loadClients(); loadInquiries(); });
```
(the page's own `supa` client at line 127 is untouched — still used for `loadClients`/`loadInquiries`'s actual data queries)

- [ ] **Step 2: `coaching-plan.html`** — remove line 9 (`<script src="coaching-auth.js"></script>`). Change line 261 from:
```js
  window.CoachingAuth.ensure(supa).then(load);
```
to:
```js
  window.RowAuth.ensure().then(load);
```

- [ ] **Step 3: Delete the now-unused file**

```bash
cd C:/Users/gregm/row
git rm coaching-auth.js
```

- [ ] **Step 4: Grep to confirm no remaining references**

```bash
grep -rn "coaching-auth\|CoachingAuth" --include=*.html --include=*.js .
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add coaching.html coaching-plan.html
git commit -m "refactor: retire coaching-auth.js, fold coaching pages into the shared RowAuth gate"
```

---

### Task 5: Fix the now-stale `AUTH_PASS` comments (unrelated `ROW_APP_SECRET` mechanism)

**Context:** `main.html:1459` and `gym.html:5419` each have a comment describing `ROW_APP_SECRET` (a *different*, unrelated app-secret check for `/api/polish` and `/api/jarvis-chat` — do not touch `ROW_APP_SECRET` itself, it's out of scope) by comparing it to `topbar.js`'s `AUTH_PASS`, which this plan removes. Only the comment wording needs updating so it doesn't reference a deleted constant by name.

**Files:**
- Modify: `C:\Users\gregm\row\main.html:1457`
- Modify: `C:\Users\gregm\row\gym.html:5414`

- [ ] **Step 1: `main.html`** — change:
```js
  // Same trust tier as topbar.js's AUTH_PASS ('007007', reused here) --
  // raises the bar on /api/polish from "any bot that finds the URL burns
  // Anthropic usage" to "requires reading page source". Must match the
  // ROW_APP_SECRET Vercel env var checked by api/_lib/verify-app-secret.js.
```
to:
```js
  // A client-visible speed bump, not real security (it ships in page
  // source) -- raises the bar on /api/polish from "any bot that finds the
  // URL burns Anthropic usage" to "requires reading page source". Must
  // match the ROW_APP_SECRET Vercel env var checked by
  // api/_lib/verify-app-secret.js.
```

- [ ] **Step 2: `gym.html`** — same edit, adjusted for its own next line:
```js
  // Same trust tier as topbar.js's AUTH_PASS ('007007', reused here) --
  // ships in client JS, just raises the bar on /api/jarvis-chat from "any
  // bot that finds the URL burns Jarvis usage" to "requires reading page
  // source". Must match the ROW_APP_SECRET Vercel env var checked by
  // api/_lib/verify-app-secret.js.
```
to:
```js
  // A client-visible speed bump, not real security (it ships in page
  // source) -- raises the bar on /api/jarvis-chat from "any bot that finds
  // the URL burns Jarvis usage" to "requires reading page source". Must
  // match the ROW_APP_SECRET Vercel env var checked by
  // api/_lib/verify-app-secret.js.
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/gregm/row
git add main.html gym.html
git commit -m "docs: stop referencing the deleted AUTH_PASS constant in unrelated comments"
```

---

### Task 6: Swap Row's trusted-backend anon key for the service_role key

**Files:**
- Modify: `C:\Users\gregm\row\api\send-workout-nudge.js:8-9`
- Modify: `C:\Users\gregm\row\api\send-macro-drift-nudge.js:8-9`
- Modify: `C:\Users\gregm\row\api\send-morning-launch-nudge.js:8-9`
- Modify: `C:\Users\gregm\row\api\_lib\subscribe-push-logic.js:1-2`

- [ ] **Step 1: In each of the 3 nudge files**, replace:
```js
const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
```
with:
```js
const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
```
(matches `send-coaching-inquiry-nudge.js`'s already-correct pattern exactly — that file needs no change.)

- [ ] **Step 2: In `subscribe-push-logic.js`**, same replacement:
```js
const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
```
This function only ever runs inside `api/subscribe-push.js`'s serverless handler (confirmed during planning — never imported into client-side code), so the service-role key never reaches the browser.

- [ ] **Step 3: Run the existing test suite for the touched logic module**

```bash
cd C:/Users/gregm/row
node --test api/_lib/subscribe-push-logic.test.js
```
Expected: both tests pass (they assert on URL shape and body, not the `apikey` header value, so this change doesn't affect them).

- [ ] **Step 4: Confirm `SUPABASE_SERVICE_ROLE_KEY` already exists in Row's Vercel env** (it does — `send-coaching-inquiry-nudge.js` already depends on it in production)

```bash
vercel env ls production
```
Expected: `SUPABASE_SERVICE_ROLE_KEY` appears in the list. If it does not, stop and get the value from Carl before proceeding — do not hardcode it.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/gregm/row
git add api/send-workout-nudge.js api/send-macro-drift-nudge.js api/send-morning-launch-nudge.js api/_lib/subscribe-push-logic.js
git commit -m "fix: Row's trusted backend calls use the service_role key, not the public anon key"
```

---

### Task 7: Deploy Row, live-verify PART A end to end

- [ ] **Step 1: Push and deploy**

```bash
cd C:/Users/gregm/row
git push origin main
vercel deploy --prod
```

- [ ] **Step 2: Live-verify real login in the Browser pane**

Open `https://row-sage.vercel.app/index.html`. Expected: the new email/password overlay appears (not the old 6-digit passphrase screen). Sign in with Carl's real owner credentials (`carl.meyer.business@gmail.com` — same account `coaching_is_owner()` already checks). Expected: page reveals, hub renders normally.

Navigate to `gym.html`, `health.html`, `macros.html`, `finance.html`, `coaching.html` directly. Expected: no re-prompt (session persisted), each page's real data loads (confirms every page's separately-created Supabase client instance picked up the shared session automatically, per the design).

- [ ] **Step 3: Confirm the anon key alone no longer needs to work for login** — this step is informational only, do not yet test RLS rejection (PART B hasn't run). Just confirm the passphrase overlay is gone from a hard page refresh in a fresh incognito-style tab (no `sessionStorage`/`localStorage` carried over) — expected: real login form appears, not the old passphrase form.

- [ ] **Step 4: Manually trigger one nudge function to confirm the service_role key works**

```bash
curl -X POST https://row-sage.vercel.app/api/send-workout-nudge -H "Authorization: Bearer $CRON_SECRET"
```
(Get `$CRON_SECRET`'s real value from Row's Vercel env — do not hardcode it in the command history. Expected: `200` with a JSON body like `{"message":"..."}`, not a 500/auth error — confirms the service_role key correctly reads `app_state`/`push_subscriptions`.)

---

## Part 2 — Jarvis: trusted-backend key swap

### Task 8: Refresh the scratch checkout

- [ ] **Step 1**

```bash
cd C:/Users/gregm/claude-workspace-scratch/jarvis
git fetch origin
git reset --hard origin/master
```

---

### Task 9: Add `SUPABASE_SERVICE_ROLE_KEY` to Jarvis's Railway env

- [ ] **Step 1: Pull the real value from Row's Vercel env (already has it, already correct)**

```bash
cd C:/Users/gregm/row
vercel env pull .env.service-role-tmp --environment=production
```
If this errors because the local checkout isn't linked to a specific Vercel project yet, link it first:
```bash
vercel link --yes
```
then re-run the `env pull` command. `.env.service-role-tmp` is covered by `.gitignore`'s `.env*` pattern — confirmed during planning, never gets committed.

- [ ] **Step 2: Read the value out of the pulled file (do not print the full key to a shared terminal transcript — read it into the next command directly)**

```bash
grep SUPABASE_SERVICE_ROLE_KEY .env.service-role-tmp
```

- [ ] **Step 3: Set it on Jarvis's Railway project**

```bash
cd C:/Users/gregm/claude-workspace-scratch/jarvis
railway variables --set "SUPABASE_SERVICE_ROLE_KEY=<value from step 2>"
```
(Already linked to `hospitable-adventure` / production per the existing `.railway` config — confirmed during planning.)

- [ ] **Step 4: Delete the temp pulled file**

```bash
cd C:/Users/gregm/row
rm .env.service-role-tmp
```

---

### Task 10: Swap `getSupabase()` to the service_role key

**Files:**
- Modify: `C:\Users\gregm\claude-workspace-scratch\jarvis\src\db\supabase.ts`

- [ ] **Step 1: Replace the file's key lookup**

Change:
```ts
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env['SUPABASE_URL']
    const key = process.env['SUPABASE_ANON_KEY']
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required')
    _client = createClient(url, key)
  }
  return _client
}
```
to:
```ts
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env['SUPABASE_URL']
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    _client = createClient(url, key)
  }
  return _client
}
```

This is Jarvis's single shared Supabase client, used for every table it touches (not just Row's four) — switching it to service_role is strictly safer everywhere (bypasses RLS instead of relying on any table's anon policy) and requires no other table's RLS policy to change.

- [ ] **Step 2: Fix `scripts/sync-knowledge.ts`, which independently reads `SUPABASE_ANON_KEY`**

**Files:**
- Modify: `C:\Users\gregm\claude-workspace-scratch\jarvis\scripts\sync-knowledge.ts:115,118`

Change:
```ts
  const supabaseKey = process.env['SUPABASE_ANON_KEY']
  ...
  if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required')
```
to:
```ts
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  ...
  if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
```
(This script syncs the vault into `knowledge_entries`, which already has an anon-open policy and isn't part of this lockdown's table scope — but it's a standalone script that runs on Carl's machine, not through the deployed backend, so it needs its own env var. Since `knowledge_entries` isn't being locked down, this step is optional hardening, not required for the cutover to succeed. Do it anyway since it's a one-line matching fix and `SUPABASE_ANON_KEY` is being retired from Jarvis's own `.env` conventions.)

- [ ] **Step 3: Run the full test suite**

```bash
cd C:/Users/gregm/claude-workspace-scratch/jarvis
npm test
```
Expected: all tests green (no test asserts on the literal env var name, per a grep check during planning — confirm this stays true; if a test does reference `SUPABASE_ANON_KEY`, update it to `SUPABASE_SERVICE_ROLE_KEY` to match).

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 5: Commit** (this is a scratch checkout — commit here, then the push in Task 11 sends it to the real remote)

```bash
git add src/db/supabase.ts scripts/sync-knowledge.ts
git commit -m "fix: Jarvis reads app_state/food_log via the service_role key, not the public anon key"
```

---

### Task 11: Push and deploy Jarvis, live-verify

- [ ] **Step 1**

```bash
cd C:/Users/gregm/claude-workspace-scratch/jarvis
git push origin master
npm run deploy
```

- [ ] **Step 2: Poll `/health` until the new deploy is live**

```bash
curl https://claude-workspace-production-8460.up.railway.app/health
```

- [ ] **Step 3: Live-verify a real Jarvis tool call that touches `app_state`** — via the Browser pane, open the Jarvis frontend (`https://jarvis-pi-liart.vercel.app`) and ask something that exercises `get_personal_data`/`goals`/`coach-read` (e.g. "what's on my goals list today"). Expected: a real, current answer — not an error, not stale/cached data — confirming the service_role key correctly reads `app_state` in production.

---

## Part 3 — Vision: trusted-backend key swap (picks up Jarvis's fix automatically)

### Task 12: Refresh the scratch checkout

- [ ] **Step 1**

```bash
cd C:/Users/gregm/claude-workspace-scratch/vision
git fetch origin
git reset --hard origin/master
```

---

### Task 13: Add `SUPABASE_SERVICE_ROLE_KEY` to Vision's Railway env

- [ ] **Step 1: Reuse the same value already pulled in Task 9** (or re-pull from Row's Vercel env the same way if that temp file was already deleted)

```bash
cd C:/Users/gregm/row
vercel env pull .env.service-role-tmp --environment=production
grep SUPABASE_SERVICE_ROLE_KEY .env.service-role-tmp
```

- [ ] **Step 2: Set it on Vision's Railway project**

```bash
cd C:/Users/gregm/claude-workspace-scratch/vision
railway variables --set "SUPABASE_SERVICE_ROLE_KEY=<value from step 1>"
```
(Already linked to the `vision` Railway project / production per the existing `.railway` config — confirmed during planning.)

- [ ] **Step 3: Delete the temp pulled file**

```bash
cd C:/Users/gregm/row
rm .env.service-role-tmp
```

---

### Task 14: Re-vendor from Jarvis and deploy Vision

No source edit needed in Vision itself — `scripts/vendor-jarvis.ts` copies `db/supabase.ts` byte-identical from the sibling `jarvis` checkout (`../../jarvis/src`) at deploy time, so Task 10's fix is picked up automatically as long as both scratch checkouts live under the same parent directory (`C:\Users\gregm\claude-workspace-scratch\`, confirmed true during planning) and Jarvis's checkout (refreshed in Task 8, fixed in Task 10) is in place before this runs.

- [ ] **Step 1: Run the test suite** (exercises `vendor-jarvis.test.ts`, which checks the vendored output)

```bash
cd C:/Users/gregm/claude-workspace-scratch/vision
npm test
```
Expected: all tests green.

- [ ] **Step 2: Deploy**

```bash
npm run deploy
```
Per the standing rule for this project: always `npm run deploy`, never a raw `railway up` — the raw command omits the vendored `_jarvis/` files, which are gitignored and would silently be missing otherwise.

- [ ] **Step 3: Poll health**

```bash
curl https://ultron-backend-production.up.railway.app/health
```

- [ ] **Step 4: Live-verify a real Vision dig query** — via the Browser pane, log into Vision's frontend and ask something that triggers a `query_data` dig against `weight_trend` or `exercise_history` (e.g. "how has my bench been trending"). Expected: a real answer grounded in actual data, not an error — confirms the vendored service_role key correctly reads Row's tables.

---

## Part 4 — Database cutover (the actual RLS lockdown)

**Do not start this part until Tasks 7, 11, and 14 have all been live-verified.** This is the whole point of the staged rollout — nothing gets cut off until every replacement path is proven working.

### Task 15: Confirm `coaching_is_owner()` still matches what's live

- [ ] **Step 1: Query it directly via the Supabase MCP** (project `vikpcejlyxieguorwysf`)

```sql
select prosrc from pg_proc where proname = 'coaching_is_owner';
```
Expected: the same function body as `supabase/migrations/2026-07-23-coaching-rls-lockdown.sql` — `select (auth.jwt() ->> 'email') = 'carl.meyer.business@gmail.com';`. No changes needed if it matches; this step is a confirmation, not a migration.

---

### Task 16: Write the migration file

**Files:**
- Create: `C:\Users\gregm\row\supabase\migrations\2026-08-11-rls-lockdown-app-state.sql`

- [ ] **Step 1: Write the file**

```sql
-- ============================================================
-- app_state / food_log / push_subscriptions / workout_events
-- RLS lockdown — 2026-08-11
-- Design: docs/superpowers/specs/2026-08-11-rls-lockdown-app-state-design.md
--
-- Reuses coaching_is_owner() from the 2026-07-23 coaching lockdown --
-- same owner, no new function needed.
--
-- CUTOVER — apply only after Tasks 7/11/14 (Row real login, Jarvis
-- service_role, Vision service_role) are deployed and live-verified. See
-- the plan's Task 15-19 checklist.
-- ============================================================

drop policy if exists "anon read" on public.app_state;
drop policy if exists "anon update" on public.app_state;
drop policy if exists "anon write" on public.app_state;
create policy "owner full access to app_state"
  on public.app_state for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

drop policy if exists "anon full access to food_log" on public.food_log;
create policy "owner full access to food_log"
  on public.food_log for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

drop policy if exists "anon full access to push_subscriptions" on public.push_subscriptions;
create policy "owner full access to push_subscriptions"
  on public.push_subscriptions for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

drop policy if exists "anon read" on public.workout_events;
drop policy if exists "anon update" on public.workout_events;
drop policy if exists "anon write" on public.workout_events;
create policy "owner full access to workout_events"
  on public.workout_events for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

-- Storage: progress-photos / hype-audio -- lock the anon upload policy,
-- leave public read as-is (existing accepted design, unguessable UUID
-- filenames, not part of this fix).
drop policy if exists "anon upload progress-photos" on storage.objects;
create policy "owner upload progress-photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and public.coaching_is_owner());

drop policy if exists "hype-audio public insert" on storage.objects;
create policy "owner upload hype-audio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'hype-audio' and public.coaching_is_owner());
```

- [ ] **Step 2: Commit (do not apply yet — this file documents the migration; Step 3 below applies it live via the Supabase MCP, matching how the 2026-07-23 lockdown was actually executed)**

```bash
cd C:/Users/gregm/row
git add supabase/migrations/2026-08-11-rls-lockdown-app-state.sql
git commit -m "docs: migration file for the app_state/food_log/push_subscriptions/workout_events RLS cutover"
git push origin main
```

---

### Task 17: Apply the cutover live

- [ ] **Step 1: Run the migration SQL from Task 16 via the Supabase MCP's `execute_sql`** against project `vikpcejlyxieguorwysf`, statement by statement or as one batch — either is fine, this isn't a transactional multi-step dependency.

- [ ] **Step 2: Confirm the policies actually changed**

```sql
select tablename, policyname, roles, cmd from pg_policies
where schemaname = 'public' and tablename in ('app_state', 'food_log', 'push_subscriptions', 'workout_events')
order by tablename;
```
Expected: exactly one `owner full access to <table>` policy per table, `roles = {authenticated}`. No `anon`/`public` rows remain.

```sql
select policyname, roles, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
and policyname in ('owner upload progress-photos', 'owner upload hype-audio');
```
Expected: both present, `roles = {authenticated}`.

---

### Task 18: Post-cutover verification — the real proof, not just "the policy looks right"

- [ ] **Step 1: Confirm anon access is actually rejected** — attempt a raw REST read against `app_state` using only the public anon key (no auth token):

```bash
curl "https://vikpcejlyxieguorwysf.supabase.co/rest/v1/app_state?select=key&limit=1" \
  -H "apikey: sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv" \
  -H "Authorization: Bearer sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv"
```
Expected: empty array `[]` (RLS silently filters out all rows for a role with no matching policy — this is the correct/expected Postgres RLS behavior, not an error response). This is the actual proof the lockdown works.

- [ ] **Step 2: Re-run every live-verification step from Tasks 7, 11, and 14** against the now-locked tables — real login on Row, a real Jarvis tool call, a real Vision dig query, a real nudge-function trigger. All must still succeed exactly as they did in PART A, now proving the lockdown didn't break anything it wasn't supposed to.

- [ ] **Step 3: Update the Row backlog / HANDOFF** — this closes the "Extend RLS lockdown to Row's other ~13 anon tables" item. Note the real final scope (4 tables + 2 storage upload policies, not ~13 — see spec) and that Vessel/Content Manager are the queued fast-follows using this same design.

---

## Explicitly not covered by this plan (per spec's Out of Scope)

- Vessel and Content Manager's own passphrase/anon-RLS lockdowns — separate future plans, same design pattern.
- `macro_leads`, `content-inbox` storage bucket.
- Rotating the `007007`/`131313` passphrase values anywhere else they're used (Jarvis's own passphrase, Vision's `VISION_PASSPHRASE`) — unrelated to this DB-level fix.
