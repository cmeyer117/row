// Vercel serverless function — stores a browser's push subscription so
// send-workout-nudge.js can push to it later. Uses the same publishable
// key + open-anon-RLS pattern as the rest of Row (see gym.html, food_log
// migration) — this is a single-user tool behind topbar.js's passphrase gate.
import { buildSubscribeUpsertRequest } from './subscribe-push-logic.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    res.status(400).json({ error: 'Missing subscription fields' });
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
