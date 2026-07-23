// Vercel serverless function (cron-triggered) — pushes a "no workout logged
// yet" nudge unless today is a rest day or a workout's already logged.
// Timezone-sensitive logic lives in workout-nudge-logic.js (unit tested);
// this file is just I/O wiring to Supabase + web-push.
import webpush from 'web-push';
import { isRestDay, hasLoggedToday } from './_lib/workout-nudge-logic.js';

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

export async function handleWorkoutNudgeRequest() {
  const now = new Date();
  if (isRestDay(now)) {
    return { status: 200, body: { message: 'Rest day, no push sent' } };
  }

  const poCoachData = await fetchAppState('po-coach');
  if (hasLoggedToday(poCoachData?.po_coach_workout_done, now)) {
    return { status: 200, body: { message: 'Already logged today, no push sent' } };
  }

  const subs = await fetchSubscriptions();
  if (!subs.length) {
    return { status: 200, body: { message: 'No subscriptions, no push sent' } };
  }

  const payload = JSON.stringify({ title: 'Row', body: 'No workout logged yet today' });
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
  const { status, body } = await handleWorkoutNudgeRequest();
  res.status(status).json(body);
}
