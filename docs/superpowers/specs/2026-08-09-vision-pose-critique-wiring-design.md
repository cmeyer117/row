# Row Posing Coach → Vision Pose Critique Wiring — Design

**Date:** 2026-08-09
**Status:** approved, ready for planning
**Author:** Claude (brainstorming session with Carl)

## Context

This is subsystem 3 of the Vision `critique_pose` parity effort — the final piece, after Vision's core `critiquePose()` capability (`vision@dd8a5ba1`) and Vision's Telegram bot (`vision@1d357a9b`) both already shipped. Row's Posing Coach (`row/form-coach.html`, shipped 2026-06-06 per `2026-08-06-posing-lift-form-coach-design.md`) already captures a still photo and scores it against reference-pose symmetry via client-side MediaPipe — this spec adds an AI-written critique alongside that existing numeric score, by calling Vision's already-shipped `POST /pose-critique` endpoint.

A 4th subsystem — an equivalent AI critique layer for Lift-Form Coach — was raised during brainstorming and deliberately deferred to its own spec, since Lift-Form Coach has no "pose photo" to critique (it scores rep-by-rep motion data instead), meaning it needs a genuinely new Vision capability, not reuse of `critiquePose()`.

## Goals

- Posing Coach's freeze-frame capture also gets an AI-written critique (pose name + coaching note), rendered alongside the existing symmetry card.
- Reuse the exact `row/api/jarvis-chat.js` proxy pattern already established for Row→Jarvis calls (shared secret in client JS, server-minted session cookie), applied to Row→Vision instead of inventing a new auth mechanism.
- Fail open: a Vision outage or slow response never blocks or degrades the existing MediaPipe symmetry score, which remains the primary, always-available feature.

## Non-goals

- Not building Lift-Form Coach's AI critique (separate future spec, new Vision capability).
- Not changing Vision's `/pose-critique` contract — Row is purely a consumer of the already-shipped API.
- Not adding a read path for the AI critique in `FormCoachHistory` — matches that feature's existing write-only, no-UI convention.

## Architecture

### 1. Client-side — `row/form-coach.html`

In `captureFreeze()` (the function that builds the freeze-frame canvas and renders the symmetry card), after the existing symmetry render:

1. Convert the already-built canvas to JPEG: `canvas.toDataURL('image/jpeg', 0.85)`, strip the `data:image/jpeg;base64,` prefix.
2. Append a "Getting AI critique…" loading card to `#posingResult`.
3. `POST /api/vision-pose-critique` with `{imageBase64, mediaType: 'image/jpeg'}`, header `Authorization: Bearer <ROW_APP_SECRET>` — the same client-visible `'007007'` constant `gym.html` already uses for its Jarvis proxy call, added locally to `form-coach.html` (matches that file's own comment: same trust tier as `topbar.js`'s `AUTH_PASS`, ships in client JS by design, not a real access-control boundary).
4. 25-second `AbortController` timeout (longer than `gym.html`'s 12s Jarvis-chat timeout — vision-model calls take longer than text).
5. On success: replace the loading card with `{pose}: {critique}` (or just the critique text if `pose` is null — matches `critiquePose()`'s own "couldn't confidently identify" fallback shape).
6. On failure or timeout: remove the loading card silently, `console.warn` only. **The symmetry card above it is unaffected either way** — this call starts after that card already rendered.
7. Fold the result into the existing `FormCoachHistory.logSession('posing', {...})` call as an added `poseCritique: {pose, critique}` field (omitted entirely if the call failed/timed out) — matches that feature's "capture everything for later accuracy judgment" purpose, fire-and-forget, no read path.

### 2. New proxy — `row/api/vision-pose-critique.js`

Structurally identical to the existing `row/api/jarvis-chat.js`:

```javascript
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
```

This is the exact HMAC recipe Vision's own `src/api/lib/session.ts` verifies (`createHmac('sha256', secret).update(payload).digest('hex')`, cookie name `vision_session`, same `{exp}` payload shape) — copied because Row and Vision are separate deployables in separate repos, not a shared import.

### 3. Env vars

One new Row-side Vercel env var: `VISION_SESSION_SECRET`, value copied from Vision's Railway `VISION_SESSION_SECRET`. No new client-visible secret — `ROW_APP_SECRET` is already set and already client-visible by the same design `gym.html`'s Jarvis call uses.

## Error handling

- Missing/malformed request body at the proxy: 400, mirrors `jarvis-chat.js`'s existing `Missing message` check.
- Wrong/missing `ROW_APP_SECRET`: 401, same as `jarvis-chat.js`.
- Vision unreachable or errors: 502 (or Vision's own status code relayed through, matching `jarvis-chat.js`'s `res.status(upstream.status).json(data)` pass-through).
- Client-side timeout or any fetch failure: loading card removed silently, symmetry card (already rendered) is unaffected, `console.warn` for debugging only — never a user-facing error state on top of an already-successful pose capture.

## Testing

Row's `api/` serverless functions have no unit-test framework wired in today (confirmed — `jarvis-chat.js` itself has none), and this is a small proxy structurally identical to an already-shipped, already-verified one. Live-verification plan, matching how the original Posing/Lift-Form Coach build and `jarvis-chat.js` were themselves verified:

1. Real photo capture in the deployed app → real critique text rendered.
2. Proxy called without the `Authorization` header (or wrong secret) → 401, verified directly against the deployed endpoint.
3. Vision temporarily pointed at an unreachable URL (local override, not deployed) → confirm the symmetry card still renders correctly and no error leaks into the UI.

## Migration / rollout

No data migration. Requires `VISION_SESSION_SECRET` set on Row's Vercel project before the proxy will authenticate successfully against Vision (fails closed with a 502 until then, not silently broken). Depends on Vision's `/pose-critique` route already being live in production (shipped, confirmed working via its own route tests and the pose-critique-core spec's verification).

## Follow-up (separate spec)

Lift-Form Coach AI critique — a new Vision capability (not `critiquePose()` reuse) that takes scored rep data (ROM/tempo/stability, not an image) and returns a written coaching note via `codex exec`. Genuinely new design work, not wiring.
