// Vercel serverless proxy — forwards gym.html's Ask Coach/debrief calls to
// Jarvis's /chat, attaching the passphrase server-side so it never sits in
// the static client HTML. JARVIS_PASSPHRASE is a Vercel env var, not client-visible.
const JARVIS_URL = 'https://claude-workspace-production-8460.up.railway.app';

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
      headers: { 'Content-Type': 'application/json', 'x-jarvis-passphrase': process.env.JARVIS_PASSPHRASE },
      body: JSON.stringify({ userId: 'default-user', message }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Jarvis' });
  }
}
