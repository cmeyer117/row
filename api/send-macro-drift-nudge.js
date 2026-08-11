// Vercel serverless function (cron-triggered) — pushes a "macros have
// missed target 3 days straight" nudge. Timezone-sensitive/decision logic
// lives in macro-drift-logic.js (unit tested); this file is just I/O
// wiring to Supabase + web-push. Mirrors send-workout-nudge.js.
import webpush from 'web-push';
import { last3EasternDates, isDrifting } from './_lib/macro-drift-logic.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function fetchFoodLog(dates) {
  const filter = dates.map((d) => `"${d}"`).join(',');
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/food_log?log_date=in.(${filter})&select=log_date,protein_g,calories`,
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

export async function handleMacroDriftNudgeRequest(force = false) {
  const now = new Date();

  if (!force) {
    const healthState = await fetchAppState('health');
    const targets = healthState?.macro_targets;
    if (!targets) {
      return { status: 200, body: { message: 'No macro targets set, no push sent' } };
    }

    const dates = last3EasternDates(now);
    const foodLogRows = await fetchFoodLog(dates);

    if (!isDrifting(foodLogRows, targets, now)) {
      return { status: 200, body: { message: 'Not drifting, no push sent' } };
    }
  }

  const subs = await fetchSubscriptions();
  if (!subs.length) {
    return { status: 200, body: { message: 'No subscriptions, no push sent' } };
  }

  const payload = JSON.stringify({
    title: 'Row',
    body: force ? 'Diagnostic test push - root-cause check' : 'Macros have missed target 3 days straight',
  });
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
  const { status, body } = await handleMacroDriftNudgeRequest(force);
  res.status(status).json(body);
}
