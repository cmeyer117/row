// Vercel serverless proxy — forwards form-coach.html's Posing Coach AI
// critique calls to Vision's POST /pose-critique. Mirrors jarvis-chat.js
// exactly: shared-secret gate on the client-visible ROW_APP_SECRET, a
// server-minted session cookie so VISION_SESSION_SECRET never sits in
// static client HTML. See docs/superpowers/specs/
// 2026-08-09-vision-pose-critique-wiring-design.md.
import { createHmac } from 'node:crypto';
import { verifyOwner } from './_lib/verify-owner.js';

const VISION_URL = 'https://vision-backend-carlmeyer.up.railway.app';
const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

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
  // 2026-08-12 audit fix: was a client-visible shared secret, now the real
  // owner session token -- see row-auth.js's getAccessToken().
  if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64 || !mediaType) {
    res.status(400).json({ error: 'Missing imageBase64 or mediaType' });
    return;
  }
  try {
    const upstream = await fetch(VISION_URL + '/pose-critique', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie(process.env.VISION_SESSION_SECRET) },
      body: JSON.stringify({ imageBase64, mediaType }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Vision' });
  }
}
