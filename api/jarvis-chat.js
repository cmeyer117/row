// Vercel serverless proxy — forwards gym.html's Ask Coach/debrief calls to
// Jarvis's /chat. Jarvis dropped passphrase-header auth for HMAC-signed
// session cookies (see jarvis/src/api/middleware/requireSession.ts); this
// mints that same cookie server-side from the shared secret so it never
// sits in the static client HTML. JARVIS_SESSION_SECRET is a Vercel env
// var (same value as Jarvis's JARVIS_SESSION_SECRET), not client-visible.
import { createHmac } from 'node:crypto';
import { verifyOwner } from './_lib/verify-owner.js';

const JARVIS_URL = 'https://claude-workspace-production-8460.up.railway.app';
const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

function sessionCookie(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return 'jarvis_session=' + payload + '.' + sig;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  // 2026-08-12 audit fix: was a client-visible shared secret, now the real
  // owner session token -- see row-auth.js's getAccessToken().
  if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { message } = req.body || {};
  if (!message) {
    res.status(400).json({ error: 'Missing message' });
    return;
  }
  try {
    const upstream = await fetch(JARVIS_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie(process.env.JARVIS_SESSION_SECRET) },
      body: JSON.stringify({ userId: 'default-user', message }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Jarvis' });
  }
}
