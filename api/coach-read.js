// Vercel serverless proxy — surfaces Vision's weekly coach-read narrative
// (app_state key 'jarvis:coach_read') to weekly-review.html. That key is
// NOT in app_state's anon-RLS allowlist (see project-app-state-anon-rls-scope
// memory — a standing rule against widening it for personal data), so this
// reads it server-side with the service-role key instead, same owner-gate
// pattern as api/jarvis-chat.js.
import { verifyOwner } from './_lib/verify-owner.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const upstream = await fetch(
      `${SUPABASE_URL}/rest/v1/app_state?key=eq.jarvis:coach_read&select=data`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY } }
    );
    const rows = await upstream.json();
    const data = Array.isArray(rows) && rows[0] ? rows[0].data : null;
    res.status(200).json({ coachRead: data });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Supabase' });
  }
}
