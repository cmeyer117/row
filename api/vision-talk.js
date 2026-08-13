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
import { verifyOwner } from './_lib/verify-owner.js';

export const config = { api: { bodyParser: false } };

const VISION_URL = 'https://vision-backend-carlmeyer.up.railway.app';
const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

function sessionCookie(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return 'vision_session=' + payload + '.' + sig;
}

// 2026-08-12 audit fix: the raw body was read with no size cap -- Vercel's
// own platform ceiling (4.5MB) bounds worst-case memory today, but real STT
// audio (30s max recording, voice-helpers.js's own MAX_RECORD_MS) never
// gets close to that, so a smaller explicit cap costs nothing for real
// traffic and closes the gap without depending on the platform limit alone.
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB

async function readRawBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(chunk);
  }
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
    const headers = { 'Content-Type': contentType, 'Cookie': sessionCookie(process.env.VISION_SESSION_SECRET) };
    // Vocabulary-bias hint (exercise names), built client-side and passed
    // through unchanged -- see docs/superpowers/specs/
    // 2026-08-12-stt-gym-vocabulary-hint-design.md. Optional: absent for
    // any caller (e.g. Vessel's mic) that doesn't send one.
    const sttPrompt = req.headers['x-stt-prompt'];
    if (sttPrompt && typeof sttPrompt === 'string') headers['X-STT-Prompt'] = sttPrompt;
    const upstream = await fetch(VISION_URL + '/stt', {
      method: 'POST',
      headers,
      body: rawBody,
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Vision' });
  }
}

// Codex-review catch (2026-08-12): coachId used to go straight from the
// request body into the outbound URL path with no check -- unlike
// handleTalk(), which sends coachId in the JSON body, not the path. Vision's
// own /coach/:coachId/history route validates it server-side, but this
// proxy shouldn't rely on that alone. mini-vision-chat.js only ever sends
// 'gym' (the only coach Row has a UI for), so an allowlist of exactly that
// costs nothing today and closes the path-injection surface outright.
const ALLOWED_HISTORY_COACH_IDS = ['gym'];

async function handleHistory(req, res, rawBody) {
  let parsed;
  try { parsed = JSON.parse(rawBody.toString('utf8') || '{}'); } catch { parsed = {}; }
  const coachId = typeof parsed.coachId === 'string' ? parsed.coachId : 'gym';
  if (!ALLOWED_HISTORY_COACH_IDS.includes(coachId)) {
    res.status(400).json({ error: 'unrecognized coachId' });
    return;
  }
  try {
    const upstream = await fetch(`${VISION_URL}/coach/${coachId}/history`, {
      method: 'GET',
      headers: { 'Cookie': sessionCookie(process.env.VISION_SESSION_SECRET) },
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
  // 2026-08-12 audit fix: was a client-visible shared secret (readable from
  // page source), now the real owner session token -- see row-auth.js's
  // getAccessToken().
  if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (e) {
    res.status(413).json({ error: 'Request body too large' });
    return;
  }
  const mode = (req.query && req.query.mode) || 'talk';
  if (mode === 'tts') return handleTts(req, res, rawBody);
  if (mode === 'stt') return handleStt(req, res, rawBody);
  if (mode === 'history') return handleHistory(req, res, rawBody);
  return handleTalk(req, res, rawBody);
}
