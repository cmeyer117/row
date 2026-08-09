# Standalone Coaching App — Plan 2: App Scaffold + Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get a real, deployed app with two working login paths — owner email/password, client magic-link — wired to Plan 1's Supabase project, with an owner-triggered "invite client" action. No feature pages yet (plan view, logging) — that's Plan 3.

**Architecture:** Static HTML/JS pages (no build step, no framework — matches Row's existing pattern exactly: plain `<script>` tags, Supabase JS v2 via CDN), deployed to Vercel. One shared `supabase-client.js` sets up the Supabase client once instead of duplicating the URL/key on every page (Row duplicates them per-file; this is a small, deliberate improvement worth making in a fresh app, not scope creep). The owner's "invite client" action needs the Supabase Admin API (`inviteUserByEmail`), which requires the service-role key — that only ever runs server-side, in a new `api/invite-client.js` Vercel function gated by an owner-session check (ported from Row's `verify-owner.js` pattern).

**Tech Stack:** Vanilla HTML/JS, Supabase JS v2 (CDN), Vercel serverless functions (Node), Supabase Auth (email/password for owner, magic link/OTP for clients).

**Reference:** `row/docs/superpowers/specs/2026-08-09-standalone-coaching-app-design.md` (design spec). Plan 1's output this depends on: Supabase project `bygkogytbxinubsnkwje` (URL `https://bygkogytbxinubsnkwje.supabase.co`), RPCs `claim_client_profile()`/`get_my_coaching_plan()`/`log_my_exercise()`/`upsert_my_weight()`, owner auth user `carl.meyer.business@gmail.com` (already created). Row's existing patterns this ports from: `row/coaching-auth.js` (owner login overlay), `row/api/_lib/verify-owner.js` (owner session verification for API routes).

---

## File Structure

All in the existing `C:\Users\gregm\coaching-app` repo (created in Plan 1):

- `coaching-app/supabase-client.js` — shared Supabase client init (new, not a Row pattern — Row duplicates this per-file, this app centralizes it)
- `coaching-app/coaching-auth.js` — owner login gate, ported from Row's `coaching-auth.js`, repointed at the new project
- `coaching-app/login.html` — owner login page (uses `coaching-auth.js`)
- `coaching-app/index.html` — owner dashboard entry point; Plan 2 scope is just the auth gate + a placeholder, real dashboard content is Plan 3
- `coaching-app/client-login.html` — client magic-link request page
- `coaching-app/client-auth-callback.html` — lands here after clicking the magic-link email; calls `claim_client_profile()` and shows the result
- `coaching-app/api/_lib/verify-owner.js` — ported from Row's `api/_lib/verify-owner.js`, same logic, pointed at the new project
- `coaching-app/api/invite-client.js` — owner-only; calls Supabase Admin API to send a client their magic link
- `coaching-app/.env.example` — documents the env vars needed (not real values)

## Task 1: Shared Supabase client + Vercel env setup

**Files:**
- Create: `C:\Users\gregm\coaching-app\supabase-client.js`
- Create: `C:\Users\gregm\coaching-app\.env.example`

- [ ] **Step 1: Write the shared client**

```javascript
// supabase-client.js — one Supabase client, shared across every page.
// Row duplicates SUPABASE_URL/KEY per-file; this app centralizes it
// since every page here needs the same client and there's no reason
// to repeat two constants six times.
(function () {
  'use strict';
  const SUPABASE_URL = 'https://bygkogytbxinubsnkwje.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_wzuL0UGFjhjLuN1XkQOmvw_bnYPMmiN';
  window.supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
```

Every page includes, in this order: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>` then `<script src="supabase-client.js"></script>`, giving every subsequent inline script a ready `window.supa`.

- [ ] **Step 2: Document the server-side env var**

```
# .env.example — real values live in Vercel project settings, never here.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add supabase-client.js .env.example
git commit -m "feat: shared Supabase client"
git push
```

- [ ] **Step 4: Create the Vercel project and set the env var**

```bash
vercel link --yes
```

Then set `SUPABASE_SERVICE_ROLE_KEY` in the Vercel project (Production) to the `coaching-app` Supabase project's actual service-role key (Supabase dashboard → Project Settings → API → service_role — this is the one secret in this whole plan that must never appear in a commit, in this plan document, or in chat).

---

## Task 2: Owner login

**Files:**
- Create: `C:\Users\gregm\coaching-app\coaching-auth.js`
- Create: `C:\Users\gregm\coaching-app\login.html`
- Create: `C:\Users\gregm\coaching-app\index.html`

- [ ] **Step 1: Port the owner auth gate from Row**

```javascript
// coaching-auth.js — ported from row/coaching-auth.js, repointed at
// the coaching-app Supabase project. Same shape: blocks the page
// until the owner is signed in, via real Supabase Auth (not a
// client-side passphrase — this app has no topbar.js/passphrase
// pattern at all, real auth is the only gate from day one).
(function () {
  'use strict';

  function appendWhenReady(node) {
    if (document.body) { document.body.appendChild(node); }
    else { document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(node); }, { once: true }); }
  }

  function showLogin() {
    return new Promise(function (resolve) {
      document.documentElement.style.visibility = 'hidden';
      var overlay = document.createElement('div');
      overlay.id = 'ca-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:#080808;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;';
      overlay.innerHTML =
        '<form id="ca-form" style="width:100%;max-width:340px;padding:36px 30px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:12px;">' +
        '<div style="color:#FAFAFA;font-size:18px;font-weight:700;">Coaching App — sign in</div>' +
        '<input id="ca-email" type="email" placeholder="Email" autocomplete="username" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<input id="ca-pass" type="password" placeholder="Password" autocomplete="current-password" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<div id="ca-error" style="color:#FF6B6B;font-size:12px;display:none;"></div>' +
        '<button type="submit" style="padding:12px;border-radius:12px;border:0;background:#FAFAFA;color:#0A0A0B;font-size:14px;font-weight:700;cursor:pointer;">Sign in</button>' +
        '</form>';
      appendWhenReady(overlay);
      document.documentElement.style.visibility = '';
      overlay.addEventListener('submit', async function (e) {
        e.preventDefault();
        var errEl = overlay.querySelector('#ca-error');
        var res = await window.supa.auth.signInWithPassword({
          email: overlay.querySelector('#ca-email').value.trim(),
          password: overlay.querySelector('#ca-pass').value,
        });
        if (res.error || !res.data.session) {
          errEl.textContent = res.error ? res.error.message : 'Sign-in failed';
          errEl.style.display = 'block';
          return;
        }
        overlay.remove();
        resolve(res.data.session);
      });
    });
  }

  window.CoachingAuth = {
    ensure: async function () {
      var got = await window.supa.auth.getSession();
      if (got.data.session) return got.data.session;
      return showLogin();
    },
  };
})();
```

- [ ] **Step 2: Write `login.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coaching App — Sign In</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
<script src="coaching-auth.js"></script>
<style>
html, body { margin: 0; background: #000; }
</style>
</head>
<body>
<script>
(async function () {
  await window.CoachingAuth.ensure();
  window.location.href = 'index.html';
})();
</script>
</body>
</html>
```

- [ ] **Step 3: Write `index.html` (owner dashboard placeholder for now)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coaching App — Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
<script src="coaching-auth.js"></script>
<style>
:root { --text-primary: #F4F1EA; --font: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
html, body { margin: 0; background: #000; color: var(--text-primary); font-family: var(--font); }
body { padding: 40px 20px; }
</style>
</head>
<body>
<div id="content" style="display:none;">
  <h1>Coaching App</h1>
  <p>Signed in as owner. Client list + billing UI is Plan 3.</p>
  <button id="inviteTestBtn" type="button">Send test invite (Task 4 verification)</button>
  <div id="inviteResult" style="margin-top:10px;font-size:13px;color:#B8B6B0;"></div>
</div>
<script>
(async function () {
  await window.CoachingAuth.ensure();
  document.getElementById('content').style.display = 'block';
})();
</script>
</body>
</html>
```

The "Send test invite" button is wired in Task 4 — it's here now as a placeholder element Task 4's script attaches to.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gregm\coaching-app
git add coaching-auth.js login.html index.html
git commit -m "feat: owner login (Supabase Auth email/password)"
git push
```

- [ ] **Step 5: Deploy and verify the gate blocks unauthenticated access**

```bash
vercel deploy --prod --yes
```

Then, without logging in, visit the deployed `index.html` URL. Expected: the login overlay appears, page content stays hidden. This part is fully verifiable without a password. **The actual successful-login path needs you** — try signing in with the owner email/password you set in Plan 1 and confirm you land on the dashboard placeholder. I don't have and won't ask for that password.

---

## Task 3: Client magic-link login + claim flow

**Files:**
- Create: `C:\Users\gregm\coaching-app\client-login.html`
- Create: `C:\Users\gregm\coaching-app\client-auth-callback.html`

- [ ] **Step 1: Write `client-login.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coaching — Client Sign In</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
<style>
:root { --text-primary: #F4F1EA; --text-secondary: #B8B6B0; --accent: #6EE7B7; --font: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
html, body { margin: 0; background: #000; color: var(--text-secondary); font-family: var(--font); }
.page { max-width: 340px; margin: 80px auto; padding: 0 20px; }
h1 { color: var(--text-primary); font-size: 22px; }
input { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.07); color: var(--text-primary); font-family: inherit; font-size: 14px; margin-bottom: 10px; }
button { width: 100%; padding: 12px; border: 0; border-radius: 12px; background: var(--accent); color: #052e16; font-weight: 700; cursor: pointer; }
#status { margin-top: 12px; font-size: 13px; }
</style>
</head>
<body>
<div class="page">
  <h1>Sign in to your plan</h1>
  <p>Enter the email your coach invited you with. We'll send a link — no password needed.</p>
  <form id="loginForm">
    <input id="email" type="email" placeholder="you@example.com" required>
    <button type="submit">Send sign-in link</button>
  </form>
  <div id="status"></div>
</div>
<script>
document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var email = document.getElementById('email').value.trim();
  var statusEl = document.getElementById('status');
  statusEl.textContent = 'Sending…';
  var res = await window.supa.auth.signInWithOtp({
    email: email,
    options: { emailRedirectTo: window.location.origin + '/client-auth-callback.html' },
  });
  statusEl.textContent = res.error ? ('Error: ' + res.error.message) : 'Check your email for the sign-in link.';
});
</script>
</body>
</html>
```

- [ ] **Step 2: Write `client-auth-callback.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signing you in…</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
<style>
html, body { margin: 0; background: #000; color: #B8B6B0; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
.page { max-width: 340px; margin: 100px auto; padding: 0 20px; text-align: center; }
</style>
</head>
<body>
<div class="page" id="status">Signing you in…</div>
<script>
(async function () {
  var statusEl = document.getElementById('status');
  // supabase-js v2 parses the magic-link token from the URL hash
  // automatically on client init and fires this event once the
  // session is established — no manual token parsing needed.
  window.supa.auth.onAuthStateChange(async function (event, session) {
    if (event !== 'SIGNED_IN' || !session) return;
    var claim = await window.supa.rpc('claim_client_profile');
    if (claim.error) {
      statusEl.textContent = 'Sign-in worked, but no matching client profile was found: ' + claim.error.message;
      return;
    }
    statusEl.textContent = 'Welcome, ' + claim.data[0].name + '. (Plan/log pages are Plan 3.)';
  });
  // Also check immediately in case the session was already established
  // by the time this script runs (SIGNED_IN can fire before the listener attaches).
  var existing = await window.supa.auth.getSession();
  if (existing.data.session) {
    var claim2 = await window.supa.rpc('claim_client_profile');
    if (!claim2.error) statusEl.textContent = 'Welcome, ' + claim2.data[0].name + '. (Plan/log pages are Plan 3.)';
  }
})();
</script>
</body>
</html>
```

- [ ] **Step 3: Commit and deploy**

```bash
git add client-login.html client-auth-callback.html
git commit -m "feat: client magic-link login + claim flow"
git push
vercel deploy --prod --yes
```

---

## Task 4: Owner-triggered client invite

**Files:**
- Create: `C:\Users\gregm\coaching-app\api\_lib\verify-owner.js`
- Create: `C:\Users\gregm\coaching-app\api\invite-client.js`
- Modify: `C:\Users\gregm\coaching-app\index.html:` wire the "Send test invite" button

- [ ] **Step 1: Port `verify-owner.js` from Row**

```javascript
// api/_lib/verify-owner.js — same as row/api/_lib/verify-owner.js,
// repointed at the coaching-app Supabase project.
const OWNER_EMAIL = 'carl.meyer.business@gmail.com';

export async function verifyOwner(authHeader, supabaseUrl, anonKey, fetchImpl = fetch) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  let r;
  try {
    r = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: 'Bearer ' + token },
    });
  } catch (e) {
    return false;
  }
  if (!r.ok) return false;
  const user = await r.json();
  return !!user && user.email === OWNER_EMAIL && !!user.email_confirmed_at;
}
```

- [ ] **Step 2: Write `api/invite-client.js`**

```javascript
// Vercel serverless function — sends a client their magic-link invite.
// Owner-only: uses the Supabase Admin API (service-role key), which
// must never run for an unauthenticated caller. Manual trigger only
// (design decision #4) — never called automatically from a client
// row being created.
import { verifyOwner } from './_lib/verify-owner.js';

const SUPABASE_URL = 'https://bygkogytbxinubsnkwje.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wzuL0UGFjhjLuN1XkQOmvw_bnYPMmiN';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Missing email' });
    return;
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        redirect_to: 'https://coaching-app.vercel.app/client-auth-callback.html',
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(502).json({ error: data.msg || data.error_description || 'Invite failed' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Invite request failed' });
  }
}
```

Note the redirect URL is a placeholder domain (`coaching-app.vercel.app`) — Step 4 below fixes it to the real deployed URL once Task 1's `vercel deploy` reveals it.

- [ ] **Step 3: Wire the test button in `index.html`**

Add before the closing `</script>` tag in `index.html`'s existing script:

```javascript
document.getElementById('inviteTestBtn').addEventListener('click', async function () {
  var resultEl = document.getElementById('inviteResult');
  var email = prompt('Send a test invite to which email?');
  if (!email) return;
  resultEl.textContent = 'Sending…';
  var session = await window.supa.auth.getSession();
  var res = await fetch('/api/invite-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.data.session.access_token },
    body: JSON.stringify({ email: email }),
  });
  var data = await res.json();
  resultEl.textContent = res.ok ? 'Invite sent.' : ('Error: ' + data.error);
});
```

- [ ] **Step 4: Fix the redirect URL to the real deployed domain, commit, deploy**

After Task 1's first `vercel deploy --prod --yes`, note the real production URL it printed. Update `api/invite-client.js`'s `redirect_to` value to match exactly.

```bash
git add api/_lib/verify-owner.js api/invite-client.js index.html
git commit -m "feat: owner-triggered client magic-link invite"
git push
vercel deploy --prod --yes
```

- [ ] **Step 5: Verify — this is the one step that genuinely needs Carl**

I can confirm the invite endpoint rejects an unauthenticated call (`curl -X POST .../api/invite-client` with no `Authorization` header → expect 401) myself, the same way Plan 1 verified anon access was blocked. But the full loop — owner logs in, clicks "Send test invite" to a real email (e.g. `carl.meyer.business+coachingtest2@gmail.com`), receives the email, clicks the link, lands on `client-auth-callback.html`, sees "no matching client profile found" (expected — no test client row exists at this stage, Plan 1's test rows were cleaned up) — needs a real inbox and a real owner login, both of which are yours. Try it and tell me what you see.

---

## Self-Review

**Spec coverage:** Owner auth (decision #3) → Task 2. Client magic-link (decision #3) → Task 3. Manual invite flow (decision #4) → Task 4. `claim_client_profile()` called from real app code for the first time (per Plan 1's handoff note) → Task 3 Step 2. No new client-facing features beyond auth (decision #5) → confirmed, this plan builds only login/invite, no plan/log pages.

**Placeholder scan:** `index.html`'s dashboard content is explicitly a placeholder, stated as such, not hidden — Plan 3's job. The `redirect_to` URL starts as a stated placeholder with an explicit fix-it step (Task 4 Step 4), not left wrong.

**Consistency check:** `window.supa` (not `supabase` or `client`) used consistently from `supabase-client.js` through every page and the callback's `claim_client_profile` call. `SUPABASE_SERVICE_ROLE_KEY` env var name matches `.env.example` from Task 1.

---

## What Plan 3 picks up

The real owner dashboard (client list, billing, add-client — replacing `index.html`'s placeholder) and the ported plan-view/log pages, both reading/writing against this same Supabase project and auth session.
