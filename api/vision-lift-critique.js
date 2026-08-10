// Vercel serverless proxy — forwards form-coach.html's Lift-Form Coach AI
// critique calls to Vision's POST /lift-critique. Byte-identical shape to
// vision-pose-critique.js, reusing the same VISION_SESSION_SECRET (no new
// env var needed). See docs/superpowers/specs/
// 2026-08-10-vision-lift-critique-design.md.
import { createHmac } from 'node:crypto';
import { verifyAppSecret } from './_lib/verify-app-secret.js';

const VISION_URL = 'https://vision-backend-carlmeyer.up.railway.app';

function sessionCookie(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return 'vision_session=' + payload + '.' + sig;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!verifyAppSecret(req.headers['authorization'], process.env.ROW_APP_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { exercise, reps } = req.body || {};
  if (!exercise || !Array.isArray(reps) || reps.length === 0) {
    res.status(400).json({ error: 'Missing exercise or reps' });
    return;
  }
  try {
    const upstream = await fetch(VISION_URL + '/lift-critique', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie(process.env.VISION_SESSION_SECRET) },
      body: JSON.stringify({ exercise, reps }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Vision' });
  }
}
