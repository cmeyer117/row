// Vercel serverless function — stores a browser's push subscription so
// send-workout-nudge.js can push to it later. Uses a service-role write,
// gated by the caller's real owner session (verifyOwner), matching the
// pattern already used by jarvis-chat.js/vision-talk.js.
import { verifyOwner } from './_lib/verify-owner.js';
import { buildSubscribeUpsertRequest, validateSubscription } from './_lib/subscribe-push-logic.js';

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
  const validation = validateSubscription(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const { endpoint, keys } = validation;
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
