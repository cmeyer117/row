# Coaching Inquiry Push Nudge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push a notification to Carl's phone within ~15-20 minutes of a new coaching application landing in `coaching_inquiries`.

**Architecture:** One new Vercel serverless function mirroring `api/send-macro-drift-nudge.js` exactly (same subscription-fetch/send/cleanup shape, different query), triggered by a new GitHub Actions cron every 15 minutes. Reuses the existing `push_subscriptions` table and `app='row'` subscriptions — no new subscribe flow, no new secrets.

**Tech Stack:** Vercel serverless function (Node, `web-push` npm package — already a dependency, used by the existing nudge functions), Supabase REST (existing publishable key), GitHub Actions.

---

### Task 1: `api/send-coaching-inquiry-nudge.js`

**Files:**
- Create: `api/send-coaching-inquiry-nudge.js`

- [ ] **Step 1: Write the file**

```js
// Vercel serverless function (cron-triggered) — pushes a "new coaching
// application" nudge. Mirrors send-macro-drift-nudge.js's shape exactly;
// the only real difference is the query (recent coaching_inquiries rows
// instead of a food-log drift check).
import webpush from 'web-push';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

webpush.setVapidDetails(
  'mailto:carl.meyer.business@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function fetchRecentNewInquiries(sinceIso) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/coaching_inquiries?status=eq.new&created_at=gte.${encodeURIComponent(sinceIso)}&select=name`,
    { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
  );
  return r.json();
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

export async function handleCoachingInquiryNudgeRequest(force = false) {
  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const inquiries = force ? [{ name: 'Diagnostic Test' }] : await fetchRecentNewInquiries(since);

  if (!inquiries.length) {
    return { status: 200, body: { message: 'No new inquiries, no push sent' } };
  }

  const subs = await fetchSubscriptions();
  if (!subs.length) {
    return { status: 200, body: { message: 'No subscriptions, no push sent' } };
  }

  const body = inquiries.length === 1
    ? `New coaching application from ${inquiries[0].name}`
    : `${inquiries.length} new coaching applications`;
  const payload = JSON.stringify({ title: 'Row', body });

  let sent = 0;
  const failures = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 410) await deleteSubscription(sub.endpoint);
      failures.push({ endpointHost: new URL(sub.endpoint).host, statusCode: e.statusCode, message: e.body || e.message });
    }
  }
  return { status: 200, body: { message: 'Pushed', sent, total: subs.length, failures } };
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
  const force = req.query.force === 'true';
  const { status, body } = await handleCoachingInquiryNudgeRequest(force);
  res.status(status).json(body);
}
```

- [ ] **Step 2: Commit**

```bash
git add api/send-coaching-inquiry-nudge.js
git commit -m "feat: coaching inquiry push nudge endpoint"
```

---

### Task 2: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/coaching-inquiry-nudge.yml`

- [ ] **Step 1: Write the file**

```yaml
name: Coaching Inquiry Nudge

on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:
    inputs:
      force:
        description: 'Force a real test push regardless of whether a new inquiry exists (diagnostic use only)'
        type: boolean
        default: false

jobs:
  nudge:
    runs-on: ubuntu-latest
    steps:
      - name: Send coaching inquiry nudge
        run: |
          url="https://row-sage.vercel.app/api/send-coaching-inquiry-nudge"
          if [ "${{ inputs.force }}" = "true" ]; then
            url="${url}?force=true"
          fi
          response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}")
          code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')
          echo "Response code: $code"
          echo "Response body: $body"
          if [ "$code" != "200" ]; then
            echo "Error: unexpected response $code"
            exit 1
          fi
          message=$(echo "$body" | jq -r '.message')
          if [ "$message" = "Pushed" ]; then
            sent=$(echo "$body" | jq -r '.sent')
            total=$(echo "$body" | jq -r '.total')
            if [ "$sent" != "$total" ]; then
              echo "Error: only $sent/$total pushes actually succeeded"
              exit 1
            fi
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/coaching-inquiry-nudge.yml
git commit -m "feat: 15-minute cron for the coaching inquiry push nudge"
```

---

### Task 3: Deploy, live verification, HANDOFF

**Files:** none (verification + docs only)

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Wait for the Vercel deploy, then trigger a real forced test push**

Use `gh workflow run "Coaching Inquiry Nudge" -f force=true` (or trigger via the GitHub Actions UI) once the push above has had a minute or two to deploy on Vercel. Confirm the run succeeds (green check) and that a real push notification actually arrives on Carl's phone — ask Carl to confirm receipt, don't assume from a 200 response alone (a "sent" count matching "total" only proves the send call succeeded, not that a human saw it).

- [ ] **Step 3: Confirm the real end-to-end path with a genuine new inquiry**

Submit one real test application via `coaching-landing-nu.vercel.app`, wait for the next 15-minute cron tick (or trigger the workflow manually without `force`), confirm the push fires and names the real test applicant. Delete the test `coaching_inquiries` row afterward.

- [ ] **Step 4: Update HANDOFF.md**

Edit-only (never full-file Write) — add a `RESOLVED` entry under Active Focus in `G:\My Drive\Claude\HANDOFF.md` summarizing: coaching inquiry push nudge shipped, 15-minute cron, zero API cost, confirmed received on Carl's phone.
