// Vercel serverless proxy — forwards gym.html's Ask Coach/debrief calls to
// Jarvis's /chat. Jarvis dropped passphrase-header auth for HMAC-signed
// session cookies (see jarvis/src/api/middleware/requireSession.ts); this
// mints that same cookie server-side from the shared secret so it never
// sits in the static client HTML. JARVIS_SESSION_SECRET is a Vercel env
// var (same value as Jarvis's JARVIS_SESSION_SECRET), not client-visible.
import { createHmac } from 'node:crypto';

const JARVIS_URL = 'https://claude-workspace-production-8460.up.railway.app';

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
