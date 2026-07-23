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
