// Vercel serverless proxy — forwards gym.html's voice-log transcripts to
// Vision's POST /talk (coachId 'gym'), so natural speech gets real language
// understanding + write-back (log_workout etc.) via Vision's codex-exec
// pipeline instead of the local rigid regex parser. Byte-identical shape to
// vision-lift-critique.js, reusing the same VISION_SESSION_SECRET (no new
// env var needed). See docs/superpowers/specs/
// 2026-08-10-voice-log-vision-talk-design.md.
//
// Also handles ?mode=tts and ?mode=stt (added 2026-08-11) -- folded into
// this same file rather than two new api/*.js files because Row's Vercel
// project is on the Hobby plan's 12-serverless-function cap (confirmed by
// a failed deploy: errorCode exceeded_serverless_functions_per_deployment).
// See docs/superpowers/specs/2026-08-11-spoken-morning-briefs-design.md.
import { createHmac } from 'node:crypto';
import { verifyAppSecret } from './_lib/verify-app-secret.js';

export const config = { api: { bodyParser: false } };

const VISION_URL = 'https://vision-backend-carlmeyer.up.railway.app';

function sessionCookie(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return 'vision_session=' + payload + '.' + sig;
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function handleTalk(req, res, rawBody) {
  let parsed;
  try { parsed = JSON.parse(rawBody.toString('utf8') || '{}'); } catch { parsed = {}; }
  const { transcript, coachId } = parsed;
  if (!transcript || typeof transcript !== 'string') {
    res.status(400).json({ error: 'Missing transcript' });
    return;
  }
  try {
    const upstream = await fetch(VISION_URL + '/talk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie(process.env.VISION_SESSION_SECRET) },
      body: JSON.stringify({ transcript, coachId: coachId || 'gym' }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Vision' });
  }
}

async function handleTts(req, res, rawBody) {
  let parsed;
  try { parsed = JSON.parse(rawBody.toString('utf8') || '{}'); } catch { parsed = {}; }
  const { text } = parsed;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing text' });
    return;
  }
  try {
    const upstream = await fetch(VISION_URL + '/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie(process.env.VISION_SESSION_SECRET) },
      body: JSON.stringify({ text, voice: 'cedar' }),
    });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Vision TTS failed' });
      return;
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Vision' });
  }
}

async function handleStt(req, res, rawBody) {
  try {
    // Forward the client's real Content-Type (iOS Safari sends audio/mp4,
    // not webm -- see stt.ts on Vision's side for why this can't be
    // hardcoded) instead of relabeling every recording as webm.
    const contentType = req.headers['content-type'] || 'audio/webm';
    const upstream = await fetch(VISION_URL + '/stt', {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'Cookie': sessionCookie(process.env.VISION_SESSION_SECRET) },
      body: rawBody,
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Vision' });
  }
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
  const rawBody = await readRawBody(req);
  const mode = (req.query && req.query.mode) || 'talk';
  if (mode === 'tts') return handleTts(req, res, rawBody);
  if (mode === 'stt') return handleStt(req, res, rawBody);
  return handleTalk(req, res, rawBody);
}
