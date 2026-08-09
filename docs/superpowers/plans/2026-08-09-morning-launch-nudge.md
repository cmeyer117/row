# Morning Launch Nudge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single 8am-Eastern push notification that opens Morning Launch, sent only if today's session hasn't been started yet.

**Architecture:** A GitHub Actions cron workflow POSTs to a new Vercel serverless endpoint (same pattern as `send-workout-nudge.js`), which reads the `goals` app_state row, checks whether today's `morning_launch:<date>` key exists, and if not, pushes a web-push notification to all subscribed devices. A small `sw.js` change makes notification clicks deep-link to the URL in the push payload instead of always opening `/gym.html`.

**Tech Stack:** Node (Vercel serverless functions, ESM), `web-push`, GitHub Actions cron, `node:test` for unit tests.

---

### Task 1: Pure logic — `hasStartedToday`

**Files:**
- Create: `api/_lib/morning-launch-nudge-logic.js`
- Test: `api/_lib/morning-launch-nudge-logic.test.js`

Reuses `todayEasternKey` from `api/_lib/workout-nudge-logic.js` — same Eastern-time
calendar-date convention every other nudge in this codebase uses, and matches
`main.html`'s `getActiveDateString()`/`dateToKey()` (both build local-date keys, and
this nudge only ever fires after 6am so the `<6am rolls back a day` rule in
`getActiveDateString()` never applies here).

`main.html`'s `initCloudSync({ appKey: 'goals', syncedPrefixes: ['goals:',
'morning_launch:'] })` (main.html:2284-2293) syncs the literal localStorage key
`morning_launch:<date>` into the `goals` app_state row's `data` object
(`sync.js:44-52`'s `collect()` stores keys verbatim). So "started today" is just:
does `data['morning_launch:<today's Eastern date>']` exist.

- [ ] **Step 1: Write the failing tests**

```javascript
// api/_lib/morning-launch-nudge-logic.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasStartedToday } from './morning-launch-nudge-logic.js';

test('hasStartedToday: true when today\'s Eastern-keyed session exists', () => {
  const now = new Date('2026-07-21T23:30:00Z'); // 7:30pm Eastern, same calendar day
  const goalsAppState = { 'morning_launch:2026-07-21': { version: 1, currentPhase: 'align' } };
  assert.equal(hasStartedToday(goalsAppState, now), true);
});

test('hasStartedToday: false when only a different day\'s session exists', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const goalsAppState = { 'morning_launch:2026-07-20': { version: 1 } };
  assert.equal(hasStartedToday(goalsAppState, now), false);
});

test('hasStartedToday: false when goalsAppState is empty/undefined', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  assert.equal(hasStartedToday(undefined, now), false);
  assert.equal(hasStartedToday({}, now), false);
});

test('hasStartedToday: Eastern day boundary — 3:59am UTC is still previous Eastern day', () => {
  // Same boundary case workout-nudge-logic.test.js covers for todayEasternKey.
  const earlyUtc = new Date('2026-07-22T03:59:00Z'); // 2026-07-21 11:59pm Eastern
  const goalsAppState = { 'morning_launch:2026-07-21': { version: 1 } };
  assert.equal(hasStartedToday(goalsAppState, earlyUtc), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /c/Users/gregm/row && node --test api/_lib/morning-launch-nudge-logic.test.js`
Expected: FAIL — `Cannot find module './morning-launch-nudge-logic.js'`

- [ ] **Step 3: Write the implementation**

```javascript
// api/_lib/morning-launch-nudge-logic.js
import { todayEasternKey } from './workout-nudge-logic.js';

// goalsAppState is the `data` object of the app_state row keyed 'goals'
// (main.html's initCloudSync({ appKey: 'goals', ... })) -- session state is
// stored under the literal localStorage key 'morning_launch:<date>' inside it,
// same convention hasLoggedToday uses for 'po-coach'/po_coach_workout_done.
export function hasStartedToday(goalsAppState, date = new Date()) {
  if (!goalsAppState) return false;
  const key = 'morning_launch:' + todayEasternKey(date);
  return Boolean(goalsAppState[key]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /c/Users/gregm/row && node --test api/_lib/morning-launch-nudge-logic.test.js`
Expected: PASS — 4/4 tests green

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row
git add api/_lib/morning-launch-nudge-logic.js api/_lib/morning-launch-nudge-logic.test.js
git commit -m "feat: add hasStartedToday helper for morning launch nudge"
```

---

### Task 2: Endpoint — `api/send-morning-launch-nudge.js`

**Files:**
- Create: `api/send-morning-launch-nudge.js`

Mirrors `api/send-workout-nudge.js` line for line (same Supabase REST wiring, same
`web-push` VAPID setup, same dead-subscription cleanup on HTTP 410, same
`CRON_SECRET` bearer-token auth) — only the condition check and push payload differ.

- [ ] **Step 1: Write the file**

```javascript
// api/send-morning-launch-nudge.js
// Vercel serverless function (cron-triggered) — pushes an "8am, Morning
// Launch not started yet" nudge unless a session already exists for today.
// Timezone-sensitive logic lives in morning-launch-nudge-logic.js (unit
// tested); this file is just I/O wiring to Supabase + web-push.
import webpush from 'web-push';
import { hasStartedToday } from './_lib/morning-launch-nudge-logic.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

webpush.setVapidDetails(
  'mailto:carl.meyer.business@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function fetchAppState(key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_state?key=eq.${key}&select=data`, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
  });
  const rows = await r.json();
  return rows[0]?.data || null;
}

async function fetchSubscriptions() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?app=eq.row&select=endpoint,p256dh,auth`, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
  });
  return r.json();
}

async function deleteSubscription(endpoint) {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
  }).catch(() => {});
}

export async function handleMorningLaunchNudgeRequest() {
  const goalsData = await fetchAppState('goals');
  if (hasStartedToday(goalsData)) {
    return { status: 200, body: { message: 'Already started today, no push sent' } };
  }

  const subs = await fetchSubscriptions();
  if (!subs.length) {
    return { status: 200, body: { message: 'No subscriptions, no push sent' } };
  }

  const payload = JSON.stringify({ title: 'Row', body: 'Plan your day — Morning Launch', url: '/main.html' });
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 410) await deleteSubscription(sub.endpoint);
    }
  }
  return { status: 200, body: { message: 'Pushed', sent, total: subs.length } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { status, body } = await handleMorningLaunchNudgeRequest();
  res.status(status).json(body);
}
```

- [ ] **Step 2: Sanity-check the module loads**

Run: `cd /c/Users/gregm/row && node --input-type=module -e "await import('./api/send-morning-launch-nudge.js'); console.log('loaded ok')"`
Expected: `loaded ok` (confirms no syntax errors / bad imports — VAPID keys being
unset locally is fine, `setVapidDetails` doesn't validate until a send is attempted)

- [ ] **Step 3: Commit**

```bash
cd /c/Users/gregm/row
git add api/send-morning-launch-nudge.js
git commit -m "feat: add morning launch nudge endpoint"
```

---

### Task 3: Deep-link notification clicks

**Files:**
- Modify: `sw.js:22-31`

Every existing nudge (workout, macro-drift, coaching-inquiry) currently opens
`/gym.html` on click regardless of which notification it was — this task makes the
click destination come from the push payload's `url` field, so this new nudge (and
the two existing ones once redeployed with a `url` in their payload — out of scope
here, not touching those files) lands on the right page.

- [ ] **Step 1: Edit the push and notificationclick handlers**

Replace `sw.js:22-31`:

```javascript
self.addEventListener('push', e => {
  let data = { title: 'Row', body: 'New notification' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icons/icon-192.png' }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/gym.html'));
});
```

with:

```javascript
self.addEventListener('push', e => {
  let data = { title: 'Row', body: 'New notification' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192.png',
    data: { url: data.url },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/gym.html';
  e.waitUntil(clients.openWindow(url));
});
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/gregm/row
git add sw.js
git commit -m "feat: deep-link push notification clicks to their payload url"
```

---

### Task 4: GitHub Actions cron

**Files:**
- Create: `.github/workflows/morning-launch-nudge.yml`

Mirrors `.github/workflows/workout-nudge.yml`'s exact structure — same
`CRON_SECRET` GitHub secret (already configured, reused), same `workflow_dispatch`
for manual testing.

- [ ] **Step 1: Write the workflow file**

```yaml
name: Morning Launch Nudge

on:
  schedule:
    # 8am Eastern (EDT, accounting for DST drift — see workout-nudge.yml) = 12pm UTC
    - cron: '0 12 * * *'
  workflow_dispatch:

jobs:
  nudge:
    runs-on: ubuntu-latest
    steps:
      - name: Send morning launch nudge
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            https://row-sage.vercel.app/api/send-morning-launch-nudge \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}")
          echo "Response code: $response"
          if [ "$response" != "200" ]; then
            echo "Error: unexpected response $response"
            exit 1
          fi
```

- [ ] **Step 2: Commit and push**

```bash
cd /c/Users/gregm/row
git add .github/workflows/morning-launch-nudge.yml
git commit -m "feat: cron-trigger the morning launch nudge at 8am Eastern"
git push
```

---

### Task 5: Deploy and verify end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Confirm Vercel deploy picked up the new endpoint**

Vercel auto-deploys `main` on push (existing project convention — no manual deploy
step needed, same as every other nudge endpoint). After the push in Task 4, check:

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://row-sage.vercel.app/api/send-morning-launch-nudge -H "Authorization: Bearer wrong-secret"`
Expected: `401` (confirms the endpoint is live and auth-gated — using a deliberately
wrong secret here since the real `CRON_SECRET` shouldn't be pasted into a shell
command outside GitHub's secret store)

- [ ] **Step 2: Manually trigger the real workflow and check the result**

Run: `cd /c/Users/gregm/row && gh workflow run "Morning Launch Nudge" && sleep 15 && gh run list --workflow="Morning Launch Nudge" --limit 1`
Expected: a `completed`/`success` run. Then check its log:

Run: `gh run view --workflow="Morning Launch Nudge" --log | tail -20`
Expected: `Response code: 200`, and body message either `Already started today, no
push sent` (if today's session already exists) or `Pushed` with a real `sent` count.

- [ ] **Step 3: Confirm the real behavior matches expectation**

If the message was `Pushed, sent: 1` (or more), a real push notification should have
landed on Carl's subscribed device(s) — ask Carl to confirm he received it and that
tapping it opened `main.html` (Morning Launch), not `gym.html`. If the message was
`Already started today`, that's also a correct, verified outcome — not a false pass
— since it means the skip condition correctly detected an existing session; in that
case, real verification of the "push actually sends" path waits for a morning where
Morning Launch genuinely hasn't been started yet by 8am (i.e., tomorrow's real 8am
fire), and Carl should be asked to confirm then.
