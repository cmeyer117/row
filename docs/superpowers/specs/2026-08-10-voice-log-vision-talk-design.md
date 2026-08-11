# Row Voice Logging → Vision `/talk` Wiring — Design

**Date:** 2026-08-10
**Status:** approved, ready for planning
**Author:** Claude (brainstorming session with Carl)

## Context

Row shipped hands-free voice set logging 2026-08-06 (`gym-voice-logic.js` + `initVoiceLog()` in `gym.html`), gated on on-device verification. That verification ran today and surfaced three real bugs, fixed in this session:

1. `recognition.start()` hung forever with no feedback when Row is opened from its home-screen icon — iOS WebKit blocks `getUserMedia`/`SpeechRecognition` in standalone display mode (WebKit bug 185448, still open). Fixed: standalone mode now hides the mic button instead of freezing on tap.
2. iOS fires a `nomatch` event (not `result`/`error`) when it hears speech with no confident transcript — unhandled, this also looked like a silent freeze. Fixed: added a `nomatch` listener.
3. With both of those fixed, voice logging technically worked in a regular Safari tab, but kept failing to parse real phrasing — e.g. "log 315 for 8" (no exercise name) or "log smith machine incline chest 315 for 8" both hit "Didn't catch that." The root cause isn't a bug: `parseQuickLog`'s regex requires a rigid `<name> <weight>×<reps>` shape, and natural speech doesn't reliably land in that shape.

Carl's actual want, surfaced during this troubleshooting: not just "make the regex more forgiving," but "an assistant I can talk to in Row." That's a genuine capability gap the local regex parser can't close — it needs real language understanding.

**The good news:** Vision already has this. `runTalkTurn` (`vision/src/talk-turn.ts`) is a fully-built, production-proven conversational engine — domain routing, history, live data, memory, and write-back tools via `codex exec` (ChatGPT Plus subscription-billed, not metered per-token API — the zero-cost constraint Carl set). It's exposed today at `POST /talk` (`vision/src/app.ts:84`), already used by the Telegram bot. The `gym` domain already has `log_workout`, `log_weight`, `add_goal`, and `complete_goal` whitelisted as write tools, and `log_workout` (`vision/src/_jarvis/tools/log-workout.ts`) already writes directly into the same `po_coach_v1` cloud state Row's own `sync.js` reads — so a logged set shows up in Row automatically via the existing sync mechanism, no new sync code needed.

This spec is wiring, not new capability — same shape as the existing `vision-lift-critique.js` / `vision-pose-critique.js` proxies Row already has.

## Goals

- Voice logging in `gym.html` understands natural phrasing (missing exercise name, filler words, reordered clauses) instead of requiring a rigid command syntax.
- Zero new ongoing API spend — reuse Vision's existing `codex exec` pipeline (ChatGPT Plus subscription), not a metered Anthropic/OpenAI API key.
- Reuse the exact proxy pattern already established for Row→Vision calls (`vision-lift-critique.js`), not inventing new auth.
- Voice-add/complete a training goal comes along for free, since `gym` domain's write tools already include `add_goal`/`complete_goal` — not separately built, just not blocked.

## Non-goals

- Not building voice Undo. The old local flow could pop the last array entry because the write happened client-side; here Vision writes server-side, so there's no local handle to undo. Flagged as a fast-follow if the lack of it is annoying in practice — would need a new Vision action (e.g. `undo_last_set`).
- Not adding a local-parser fallback if Vision is unreachable. Keeps the change small; can revisit if flaky connectivity makes this annoying at the gym.
- Not touching the existing typed quick-log path (`parseQuickLog`/`quickLog()` used by the manual text-entry quick-log box) — that stays exactly as-is, rigid syntax and all, since it's typed input where rigid syntax is fine.
- Not changing Vision's `/talk` contract or `log_workout` tool — Row is purely a new consumer of already-shipped, already-proven capability.

## Architecture

### 1. Client-side — `row/gym.html`, `initVoiceLog()`

Current flow: `recognition`'s `result` event → `normalizeTranscript()` → `parseQuickLog()` → `quickLog()` (all local, synchronous).

New flow: `recognition`'s `result` event → POST the raw transcript to `/api/vision-talk` → show Vision's natural-language `reply` in the existing toast.

1. On `result`, skip `normalizeTranscript`/`parseQuickLog`/`quickLog` entirely. Show a "Thinking…" toast immediately (no Undo button) — codex exec takes a few seconds, not instant, and the old flow's toast appeared synchronously so this loading state avoids it looking frozen again.
2. `POST /api/vision-talk` with `{transcript, coachId: 'gym'}`, header `Authorization: Bearer <ROW_APP_SECRET>` (same client-visible constant `gym.html` already uses for its other Vision/Jarvis proxy calls).
3. 30-second `AbortController` timeout (codex exec's own server-side timeout is 60s; client times out first so the UI never hangs indefinitely even if the server call is still running).
4. On success: replace the "Thinking…" toast with Vision's `reply` text, 5-second auto-dismiss (matches existing `showToast` behavior). No Undo button — see Non-goals.
5. On failure or timeout: toast reads "Vision didn't respond — try again" (mirrors the existing `nomatch`/`error` toast copy style).
6. The existing `recognition` `end`/`error`/`nomatch` listeners are unchanged — they still govern the mic button's own listening state, independent of what happens after a transcript is captured.

### 2. New proxy — `row/api/vision-talk.js`

Structurally identical to `row/api/vision-lift-critique.js`:

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
  const { transcript, coachId } = req.body || {};
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
```

### 3. Env vars

None new. `VISION_SESSION_SECRET` and `ROW_APP_SECRET` are already set on Row's Vercel project (established by `vision-lift-critique.js`/`vision-pose-critique.js`).

### 4. Data flow after a successful log

Vision's `log_workout` writes to `app_state` key `po-coach`, field `po_coach_v1.logs`/`sessions` — the exact structure Row's own `state` object mirrors. Row's existing `initCloudSync` (`sync.js`) already polls/subscribes to remote changes and merges them in via `applyRemote()`. No new sync code: the logged set appears in the exercise's log/PR display through the same mechanism that already handles multi-device sync today. Worth confirming during verification that the pull cadence is fast enough to feel responsive (if not, a follow-up could trigger an explicit re-pull right after a successful `/talk` reply — deferred unless verification shows it's needed).

## Error handling

- Missing/malformed request body at the proxy: 400.
- Wrong/missing `ROW_APP_SECRET`: 401.
- Vision unreachable, `/talk` errors, or codex exec fails (auth expired, queue busy): proxy passes through Vision's own status code (503 for `QueueBusyError`, 401 for `CodexAuthError`, 500 otherwise) via `res.status(upstream.status).json(data)`.
- Client-side timeout: toast shows a clear "didn't respond" message; mic button returns to idle, ready to retry.

## Testing

Row's `api/` serverless functions have no unit-test framework wired in (confirmed — neither `jarvis-chat.js` nor `vision-lift-critique.js` have one), and this is structurally identical to an already-shipped, already-verified proxy. Live-verification plan:

1. Real voice capture on Carl's gym iPhone, natural phrasing (including today's exact failing cases — "log 315 for 8" with no name, and with a multi-word exercise name) → confirm Vision's reply is sensible and the set appears in `gym.html`'s log/PR display without a manual refresh.
2. Proxy called without the `Authorization` header → 401, verified directly against the deployed endpoint.
3. Say something ambiguous or unloggable (e.g. just "hey") → confirm Vision replies conversationally without a spurious `log_workout` call (the domain's duplicate-guard and Codex's own judgment should prevent this, but worth confirming live).
4. Say a second, near-identical log within moments of the first → confirm Vision's existing duplicate-guard (`runTalkTurn`'s `duplicateNote` logic) asks for confirmation rather than silently double-logging.

## Migration / rollout

No data migration. Depends only on Row's Vercel env vars already being set (they are, per `vision-lift-critique.js`) and Vision's `/talk` route already being live (it is, serving the Telegram bot today).

## Follow-up (not in this spec)

- Voice Undo, if its absence turns out to matter in practice.
- Explicit re-pull-after-reply, if cloud sync's existing cadence feels laggy during verification.
- Extending past `gym` domain (e.g. voice-logging a Vessel journal entry) — same pattern, separate spec if wanted later.
