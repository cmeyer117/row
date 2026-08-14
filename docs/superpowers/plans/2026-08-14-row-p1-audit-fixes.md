# Row P1 Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four P1s from the 2026-08-14 Codex audit (`Downloads/row-audit-2026-08-14.md`): silent unload-write failures under the new RLS owner-only policy, a missing coaching RPC migration, a Stripe webhook that masks DB failures from Stripe's retry logic, and an unauthenticated push-subscribe endpoint.

**Architecture:** Cache the owner's Supabase access token client-side (captured once on session init, refreshed on auth state change) so `beforeunload`/`pagehide` handlers — which can't `await` reliably — can attach a real `Authorization: Bearer <token>` header synchronously instead of the anon publishable key that RLS now rejects. Add the missing `SECURITY DEFINER` RPC following the existing migration pattern. Make the Stripe webhook return a retryable status code on DB failure instead of always acking 200 (the underlying PATCH is already idempotent, so no separate event-dedup table is needed). Gate `/api/subscribe-push` with the same `verifyOwner()` helper already used by `jarvis-chat.js`/`vision-talk.js`.

**Tech Stack:** Vanilla JS (browser, no build step), Supabase JS client + REST, Vercel serverless functions, `node:test` for `_lib` unit tests, Postgres/PostgREST migrations (plain `.sql` files, hand-applied via Supabase SQL editor).

---

### Task 1: sync.js — authenticated unload flush

**Files:**
- Modify: `C:\Users\gregm\row\sync.js:6-20` (module scope), `sync.js:138-158` (`flushOnUnload`), `sync.js:159-172` (`init`)

- [ ] **Step 1: Add a cached-token variable and refresh helper**

In `sync.js`, change line 20 from:
```js
    let supa = null, pushTimer = null, suppressSync = false, lastSyncedJson = null;
```
to:
```js
    let supa = null, pushTimer = null, suppressSync = false, lastSyncedJson = null;
    // Unload handlers (beforeunload/pagehide) can't reliably await an async
    // getSession() call before the page tears down, so the owner's access
    // token is cached here on session init/refresh and read synchronously
    // by flushOnUnload(). Falling back to the anon publishable key here is
    // what silently broke unload writes after the 2026-08-11 RLS lockdown
    // made app_state owner-only -- see row-audit-2026-08-14.md P1 #1.
    let cachedAccessToken = null;
```

- [ ] **Step 2: Populate and keep the cached token fresh**

In `sync.js`, inside `init()` (currently lines 159-172), change:
```js
    (async function init() {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      try {
        const { data, error } = await supa.from('app_state').select('data').eq('key', appKey).maybeSingle();
```
to:
```js
    (async function init() {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      async function refreshToken() {
        try {
          const { data } = await supa.auth.getSession();
          cachedAccessToken = (data && data.session) ? data.session.access_token : null;
        } catch (e) { cachedAccessToken = null; }
      }
      await refreshToken();
      supa.auth.onAuthStateChange(function (_event, session) {
        cachedAccessToken = session ? session.access_token : null;
      });
      try {
        const { data, error } = await supa.from('app_state').select('data').eq('key', appKey).maybeSingle();
```

- [ ] **Step 3: Use the cached token in the unload fetch, skip if absent**

In `sync.js`, change `flushOnUnload()` (currently lines 138-158) from:
```js
    function flushOnUnload() {
      if (!syncReady) return;
      const state = collect();
      if (isTrivial(state)) return;
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      try {
        fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ key: appKey, data: state, updated_at: new Date().toISOString() }),
          keepalive: true,
        }).catch(() => {});
        lastSyncedJson = json;
      } catch (e) {}
    }
```
to:
```js
    function flushOnUnload() {
      if (!syncReady || !cachedAccessToken) return;
      const state = collect();
      if (isTrivial(state)) return;
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      try {
        fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + cachedAccessToken,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ key: appKey, data: state, updated_at: new Date().toISOString() }),
          keepalive: true,
        }).catch(() => {});
        lastSyncedJson = json;
      } catch (e) {}
    }
```

- [ ] **Step 4: Manual verification (no unit-test seam — this is DOM/fetch glue, consistent with the rest of sync.js having no test file)**

Open any page that calls `initCloudSync` (e.g. `main.html`) in a browser, sign in, open DevTools console, run `document.querySelector('script[src="sync.js"]')` to confirm it loaded, then in the Network tab trigger a change and close/reload the tab — confirm the `app_state` POST request's `Authorization` header is a JWT (three dot-separated segments), not the literal publishable key string.

- [ ] **Step 5: Commit**

```bash
git add sync.js
git commit -m "fix: sync.js unload flush uses the owner's session token, not the anon key"
```

---

### Task 2: gym.html — authenticated po-coach unload/event writes

**Files:**
- Modify: `C:\Users\gregm\row\gym.html:6599` (module scope), `gym.html:6627-6647` (`logWorkoutEvent`), `gym.html:6682-6698` (`pcDebug`), `gym.html:6913-6937` (`pcFlushPushOnUnload`), `gym.html:7005-7026` (`pcInitCloudSync`)

- [ ] **Step 1: Add the cached-token variable**

In `gym.html`, change line 6599 from:
```js
  let pcSupa = null;
```
to:
```js
  let pcSupa = null;
  // Same reasoning as sync.js's cachedAccessToken -- beforeunload/pagehide
  // can't await getSession(), and the anon key is now rejected by the
  // 2026-08-11 RLS lockdown (row-audit-2026-08-14.md P1 #1).
  let pcAccessToken = null;
```

- [ ] **Step 2: Populate and refresh the token in pcInitCloudSync**

In `gym.html`, change (currently lines 7005-7026):
```js
  (async function pcInitCloudSync() {
    if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) return;
    // Skip if the placeholder values are still in place (local-only mode)
    if (SUPABASE_URL.indexOf('PASTE-') === 0 || SUPABASE_KEY.indexOf('PASTE-') === 0) return;
```
(leave the middle of the function, which builds `localWeightCount` and calls `pcDebug('init-start', ...)`, unchanged) then change:
```js
    pcSupa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    await pcPullRemote();
```
to:
```js
    pcSupa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    async function pcRefreshToken() {
      try {
        const { data } = await pcSupa.auth.getSession();
        pcAccessToken = (data && data.session) ? data.session.access_token : null;
      } catch (e) { pcAccessToken = null; }
    }
    await pcRefreshToken();
    pcSupa.auth.onAuthStateChange(function (_event, session) {
      pcAccessToken = session ? session.access_token : null;
    });
    await pcPullRemote();
```

- [ ] **Step 3: Use the cached token in `logWorkoutEvent`, skip if absent**

In `gym.html`, change (currently lines 6627-6647):
```js
  window.__gym.logWorkoutEvent = function (exerciseName, eventType, weight, reps, isBodyweight) {
    try {
      fetch(SUPABASE_URL + '/rest/v1/workout_events', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
```
to:
```js
  window.__gym.logWorkoutEvent = function (exerciseName, eventType, weight, reps, isBodyweight) {
    if (!pcAccessToken) return;
    try {
      fetch(SUPABASE_URL + '/rest/v1/workout_events', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + pcAccessToken,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
```

- [ ] **Step 4: Use the cached token in `pcDebug`, skip if absent**

In `gym.html`, change (currently lines 6682-6698):
```js
  function pcDebug(event, extra) {
    pcDebugLog.push({ t: new Date().toISOString(), event, extra: extra || null });
    if (pcDebugLog.length > 30) pcDebugLog = pcDebugLog.slice(-30);
    try {
      fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ key: 'po-coach-sync-debug', data: pcDebugLog, updated_at: new Date().toISOString() }),
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  }
```
to:
```js
  function pcDebug(event, extra) {
    pcDebugLog.push({ t: new Date().toISOString(), event, extra: extra || null });
    if (pcDebugLog.length > 30) pcDebugLog = pcDebugLog.slice(-30);
    if (!pcAccessToken) return;
    try {
      fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + pcAccessToken,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ key: 'po-coach-sync-debug', data: pcDebugLog, updated_at: new Date().toISOString() }),
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  }
```

Note: keep the local `pcDebugLog.push`/trim above the new guard — the in-memory debug trail should still accumulate even before the token is ready, only the remote write is skipped.

- [ ] **Step 5: Use the cached token in `pcFlushPushOnUnload`, skip if absent**

In `gym.html`, change (currently lines 6913-6937):
```js
  function pcFlushPushOnUnload() {
    if (!pcSupa || !pcInitialPullDone) return;
```
to:
```js
  function pcFlushPushOnUnload() {
    if (!pcSupa || !pcInitialPullDone || !pcAccessToken) return;
```
and change the fetch headers below it from:
```js
          'Authorization': 'Bearer ' + SUPABASE_KEY,
```
to:
```js
          'Authorization': 'Bearer ' + pcAccessToken,
```
(this is the only `Authorization` line inside `pcFlushPushOnUnload`'s fetch call — the one at line 6928 in the pre-edit file.)

- [ ] **Step 6: Manual verification**

Open `gym.html` in a browser, sign in, log a set (triggers `logWorkoutEvent`), check DevTools Network tab for the `workout_events` POST — confirm its `Authorization` header is a JWT. Then close the tab after changing something and confirm (via a second device or the Supabase table editor) the `app_state` row for `po-coach` updated.

- [ ] **Step 7: Commit**

```bash
git add gym.html
git commit -m "fix: gym.html po-coach unload/event writes use the owner's session token"
```

---

### Task 3: Missing `get_coaching_client_logs` RPC migration

**Files:**
- Create: `C:\Users\gregm\row\supabase\migrations\2026-08-14-coaching-client-logs-rpc.sql`

`coaching-log.html:86` calls `supa.rpc('get_coaching_client_logs', { p_id, p_exercise })` to fetch a client's exercise history for the Rx (next-session recommendation) calculation — but no migration ever defined this function. It has been silently returning nothing (caught by `getClientLogs`'s `(error || !data) ? [] : data` fallback) since the coaching-log page shipped, meaning **the Rx tag has never actually appeared for any coaching client, ever.** This follows the exact `SECURITY DEFINER` + anon-grant pattern already established by `get_coaching_plan`/`log_coaching_exercise`/`upsert_coaching_weight` in `2026-07-23-coaching-rls-lockdown.sql` — same capability-link access model, not a new decision (see "Decisions for Carl" note at the end of this plan for the separate question of whether that access model itself should change).

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Missing coaching_client_logs RPC — 2026-08-14
-- coaching-log.html has called get_coaching_client_logs() since it shipped
-- (2026-07-23-coaching-rls-lockdown), but no migration ever defined it --
-- the Rx recommendation tag has silently rendered empty for every client.
-- Same SECURITY DEFINER + anon-grant pattern as the sibling RPCs in
-- 2026-07-23-coaching-rls-lockdown.sql (id-scoped, anon is the sole caller
-- via the client log page).
-- ============================================================

create or replace function public.get_coaching_client_logs(p_id uuid, p_exercise text)
returns table (weight numeric, reps integer, is_bodyweight boolean, logged_at timestamptz)
language sql security definer set search_path = '' as $$
  select weight, reps, is_bodyweight, logged_at
  from public.coaching_client_logs
  where client_id = p_id and exercise_name = p_exercise
  order by logged_at asc;
$$;

revoke all on function public.get_coaching_client_logs(uuid, text) from public;
grant execute on function public.get_coaching_client_logs(uuid, text) to anon;
```

- [ ] **Step 2: Apply and verify**

Apply via the Supabase SQL editor for project `vikpcejlyxieguorwysf` (same manual-apply pattern as the sibling migration — no CLI migration runner in this repo). Verify with a real client id and exercise name that already has logged sets:
```sql
select * from public.get_coaching_client_logs('<real client uuid>', '<real exercise name string logged for that client>');
```
Expected: rows ordered oldest-first, matching what `coaching-log.html`'s Rx calculation (`getRx`, which reads `logs[logs.length - 1]` as "last") expects.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026-08-14-coaching-client-logs-rpc.sql
git commit -m "fix: add the missing get_coaching_client_logs RPC coaching-log.html has called since launch"
```

---

### Task 4: Stripe webhook returns non-2xx on DB failure

**Files:**
- Modify: `C:\Users\gregm\row\api\stripe-webhook.js:60-73`

The `billing_status`/`stripe_subscription_id` PATCH is idempotent (re-applying the same patch on a Stripe retry does nothing harmful, same value in, same value out) — so unlike a non-idempotent operation, no event-ID dedup table is needed here; returning a retryable status is the whole fix. Codex's dedup suggestion is skipped for that reason.

- [ ] **Step 1: Change the failure path to return a retryable status**

In `api/stripe-webhook.js`, change (currently lines 60-74):
```js
  try {
    const { url, options } = buildClientUpdateByCustomerRequest(SUPABASE_URL, SUPABASE_KEY, stripeCustomerId, patch);
    const updateRes = await fetch(url, options);
    if (!updateRes.ok) {
      console.error('Supabase update failed for customer ' + stripeCustomerId + ': ' + updateRes.status);
    }
  } catch (e) {
    // Always ack 200 once the event itself is understood — Stripe retries
    // on non-2xx, and a transient Supabase blip here is fixable by hand,
    // not worth an infinite webhook retry storm.
    console.error('Failed to update billing status for customer ' + stripeCustomerId, e);
  }

  res.status(200).json({ ok: true });
}
```
to:
```js
  try {
    const { url, options } = buildClientUpdateByCustomerRequest(SUPABASE_URL, SUPABASE_KEY, stripeCustomerId, patch);
    const updateRes = await fetch(url, options);
    if (!updateRes.ok) {
      console.error('Supabase update failed for customer ' + stripeCustomerId + ': ' + updateRes.status);
      // The patch is idempotent (same billing_status/subscription_id in,
      // same out), so letting Stripe retry is safe and self-healing --
      // unlike the old always-200 behavior, which silently left a paid
      // customer stuck at a stale billing_status until someone noticed by
      // hand (row-audit-2026-08-14.md P1 #3).
      res.status(502).json({ ok: false, error: 'Supabase update failed' });
      return;
    }
  } catch (e) {
    console.error('Failed to update billing status for customer ' + stripeCustomerId, e);
    res.status(502).json({ ok: false, error: 'Supabase update failed' });
    return;
  }

  res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Verify no test regression**

No dedicated test file exists for `stripe-webhook.js` itself (only its pure `_lib/stripe-billing-logic.js` helpers are unit-tested, and this change is in the handler's control flow, not the helpers) — consistent with the rest of the API handlers in this repo. Run the existing `_lib` suite to confirm the shared helpers are untouched:
```bash
node --test api/_lib/stripe-billing-logic.test.js
```
Expected: all tests pass (this change doesn't touch `stripe-billing-logic.js`).

- [ ] **Step 3: Commit**

```bash
git add api/stripe-webhook.js
git commit -m "fix: stripe webhook returns 502 on DB write failure so Stripe retries instead of the status silently going stale"
```

---

### Task 5: Auth-gate `/api/subscribe-push`

**Files:**
- Modify: `C:\Users\gregm\row\api\subscribe-push.js`, `C:\Users\gregm\row\push-subscribe.js:28-34`

Currently any POST to `/api/subscribe-push` writes to `push_subscriptions` using the service-role key with zero caller verification — the endpoint's own comment ("single-user tool behind topbar.js's passphrase gate") is stale; the passphrase gate was replaced by real Supabase Auth in the 2026-08-12 audit fix, and this endpoint was missed. Gate it the same way `jarvis-chat.js`/`vision-talk.js` already do with `verifyOwner()`. Since Row is single-user, the auth gate alone closes the abuse vector — no separate rate limit needed.

- [ ] **Step 1: Add the auth gate to the handler**

Replace the full contents of `api/subscribe-push.js`:
```js
// Vercel serverless function — stores a browser's push subscription so
// send-workout-nudge.js can push to it later. Uses a service-role write,
// gated by the caller's real owner session (verifyOwner), matching the
// pattern already used by jarvis-chat.js/vision-talk.js.
import { verifyOwner } from './_lib/verify-owner.js';
import { buildSubscribeUpsertRequest } from './_lib/subscribe-push-logic.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { endpoint, keys } = req.body || {};
  if (!endpoint || typeof endpoint !== 'string' || endpoint.length > 2048 || !endpoint.startsWith('https://')) {
    res.status(400).json({ error: 'Missing or invalid endpoint' });
    return;
  }
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 256 || keys.auth.length > 256) {
    res.status(400).json({ error: 'Missing or invalid subscription keys' });
    return;
  }
  try {
    const { url, options } = buildSubscribeUpsertRequest('row', endpoint, keys);
    const r = await fetch(url, options);
    if (!r.ok) {
      res.status(502).json({ error: 'Supabase upsert failed' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Subscribe failed' });
  }
}
```

- [ ] **Step 2: Send the owner's token and only mark success on a real 200**

In `push-subscribe.js`, change (currently lines 28-34):
```js
    await fetch('/api/subscribe-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });

    localStorage.setItem('row_push_subscribed', '1');
```
to:
```js
    const token = window.RowAuth ? await window.RowAuth.getAccessToken() : null;
    if (!token) return; // not signed in yet -- retry on next page load's subscribeToPush() call

    const res = await fetch('/api/subscribe-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) return; // leave row_push_subscribed unset so the next load retries

    localStorage.setItem('row_push_subscribed', '1');
```

- [ ] **Step 3: Confirm script load order gives `push-subscribe.js` access to `window.RowAuth`**

`gym.html` already loads `sync.js`, then `row-auth.js`, then (further down) `push-subscribe.js`, all as `defer` scripts — deferred scripts execute in source order after parse, so `window.RowAuth` exists before `push-subscribe.js` runs. Confirm the same ordering (`row-auth.js` before `push-subscribe.js`) on every other page that includes `push-subscribe.js`:
```bash
grep -n "row-auth.js\|push-subscribe.js" main.html health.html macros.html finance.html state-of-me.html
```
If any page includes `push-subscribe.js` without `row-auth.js` already present earlier in the file, add `<script src="row-auth.js" defer></script>` before it on that page.

- [ ] **Step 4: Run the existing subscribe-push unit tests (still valid — request-building logic unchanged)**

```bash
node --test api/_lib/subscribe-push-logic.test.js
```
Expected: both existing tests pass unchanged (`buildSubscribeUpsertRequest` itself wasn't touched, only its caller).

- [ ] **Step 5: Manual verification**

In a browser, sign in to Row, clear `localStorage.row_push_subscribed`, reload, wait ~3s, accept the notification permission prompt, check DevTools Network tab for `/api/subscribe-push` — confirm the request carries an `Authorization: Bearer <jwt>` header and returns 200.

- [ ] **Step 6: Commit**

```bash
git add api/subscribe-push.js push-subscribe.js
git commit -m "fix: /api/subscribe-push requires the owner's session, was open to any caller"
```

---

## Decisions for Carl (not built in this plan — flagged, not guessed)

1. **Coaching portal access model** (audit P1 #2, partially fixed by Task 3's missing RPC). The `coaching-log.html?id=<uuid>` capability-link model — anon caller, no rate limit, no expiring token — is unchanged by this plan; Task 3 only fixes the objectively broken missing RPC, keeping the existing anon-grant pattern its three sibling RPCs already use. Whether to add expiring/revocable client tokens here, or move clients onto real Supabase Auth, is the same open question the **Standalone Coaching App** project (Plans 1-3 built, Plan 4/Stripe not started, HANDOFF.md) already exists to resolve — not worth a parallel, smaller fix in Row itself.
2. **Progress photos are public-by-URL** (audit P2 #3) — not touched by this plan. Confirm whether that's an intentional product decision before locking the storage bucket down, since making it private could break any existing sharing flow that depends on public URLs.
