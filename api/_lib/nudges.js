// The four cron-triggered push nudges, consolidated out of what used to be
// four near-identical serverless functions (send-workout-nudge.js,
// send-macro-drift-nudge.js, send-morning-launch-nudge.js,
// send-coaching-inquiry-nudge.js). Row hit Vercel's Hobby-plan cap of 12
// Serverless Functions per deployment, so these now share one entry point
// (api/send-nudge.js) and live here, under _lib/, which Vercel doesn't count.
//
// Each nudge is still its own function below; only the Supabase/web-push I/O
// wiring is shared. The decision logic stays in its own unit-tested module
// (workout-nudge-logic.js, macro-drift-logic.js, morning-launch-nudge-logic.js).
import webpush from 'web-push';
import { isRestDay, hasLoggedToday, todayEasternKey } from './workout-nudge-logic.js';
import { last3EasternDates, isDrifting } from './macro-drift-logic.js';
import { hasStartedToday } from './morning-launch-nudge-logic.js';
import { shouldSendMealNudge } from './meal-log-nudge-logic.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
// Service-role key: every caller is authenticated by the CRON_SECRET check in
// api/send-nudge.js, and RLS denies anon. Server-side secret (Vercel env).
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

webpush.setVapidDetails(
  'mailto:carl.meyer.business@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const authHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY });

async function fetchAppState(key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_state?key=eq.${key}&select=data`, {
    headers: authHeaders(),
  });
  const rows = await r.json();
  return rows[0]?.data || null;
}

async function fetchSubscriptions() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?app=eq.row&select=endpoint,p256dh,auth`, {
    headers: authHeaders(),
  });
  return r.json();
}

async function deleteSubscription(endpoint) {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {});
}

// Fetch subscriptions, push to all of them, drop any that 410. Returns the
// same {status, body} shape every handler below returns.
async function push(payloadFields) {
  const subs = await fetchSubscriptions();
  if (!subs.length) {
    return { status: 200, body: { message: 'No subscriptions, no push sent' } };
  }

  const payload = JSON.stringify({ title: 'Row', ...payloadFields });
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

async function workout() {
  const now = new Date();
  if (isRestDay(now)) {
    return { status: 200, body: { message: 'Rest day, no push sent' } };
  }

  const poCoachData = await fetchAppState('po-coach');
  if (hasLoggedToday(poCoachData?.po_coach_workout_done, now)) {
    return { status: 200, body: { message: 'Already logged today, no push sent' } };
  }

  return push({ body: 'No workout logged yet today' });
}

async function morningLaunch() {
  const goalsData = await fetchAppState('goals');
  if (hasStartedToday(goalsData)) {
    return { status: 200, body: { message: 'Already started today, no push sent' } };
  }

  return push({ body: 'Plan your day — Morning Launch', url: '/main.html' });
}

async function macroDrift(force) {
  if (!force) {
    const healthState = await fetchAppState('health');
    const targets = healthState?.macro_targets;
    if (!targets) {
      return { status: 200, body: { message: 'No macro targets set, no push sent' } };
    }

    const now = new Date();
    const foodLogRows = await fetchFoodLog(last3EasternDates(now));
    if (!isDrifting(foodLogRows, targets, now)) {
      return { status: 200, body: { message: 'Not drifting, no push sent' } };
    }
  }

  return push({
    body: force ? 'Diagnostic test push - root-cause check' : 'Macros have missed target 3 days straight',
  });
}

async function fetchFoodLog(dates) {
  const filter = dates.map((d) => `"${d}"`).join(',');
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/food_log?log_date=in.(${filter})&select=log_date,protein_g,calories`,
    { headers: authHeaders() }
  );
  return r.json();
}

// Row count only (not full rows) via PostgREST's exact-count header —
// cheaper than fetchFoodLog when the nudge only needs "how many so far".
async function fetchFoodLogCount(dateKey) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/food_log?log_date=eq.${dateKey}&select=id`,
    { headers: { ...authHeaders(), Prefer: 'count=exact' } }
  );
  const contentRange = r.headers.get('content-range'); // "0-4/5" or "*/0"
  return contentRange ? Number(contentRange.split('/')[1]) : 0;
}

async function mealLog(mealIndex, force) {
  if (!force) {
    const today = todayEasternKey();
    const rowCount = await fetchFoodLogCount(today);
    if (!shouldSendMealNudge(rowCount, mealIndex)) {
      return { status: 200, body: { message: 'Already logged enough today, no push sent' } };
    }
  }
  return push({ body: 'Log a meal — quick add', url: '/macros.html' });
}

async function coachingInquiry(force) {
  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const inquiries = force ? [{ name: 'Diagnostic Test' }] : await fetchRecentNewInquiries(since);

  if (!inquiries.length) {
    return { status: 200, body: { message: 'No new inquiries, no push sent' } };
  }

  return push({
    body: inquiries.length === 1
      ? `New coaching application from ${inquiries[0].name}`
      : `${inquiries.length} new coaching applications`,
  });
}

async function fetchRecentNewInquiries(sinceIso) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/coaching_inquiries?status=eq.new&created_at=gte.${encodeURIComponent(sinceIso)}&select=name`,
    { headers: authHeaders() }
  );
  return r.json();
}

// The ?type= values api/send-nudge.js accepts. Adding a nudge = one entry here.
export const NUDGES = {
  workout,
  'morning-launch': morningLaunch,
  'macro-drift': macroDrift,
  'coaching-inquiry': coachingInquiry,
  'meal-log': mealLog,
};
