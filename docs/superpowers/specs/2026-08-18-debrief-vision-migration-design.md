# Post-workout debrief: migrate off Jarvis to Vision

## Why

`gym.html`'s post-workout debrief (`fireDebrief()`) calls `askJarvis()`, which hits
Jarvis's Railway `/chat` via `api/jarvis-chat.js`. Jarvis has been dormant since the
2026-08-15 decision (Vision is the daily driver; no work on Jarvis until Carl
deliberately reactivates it). A portfolio-wide grep (Row, Vessel, Content, hype-audio,
coaching-app, creator-intelligence) confirms `askJarvis()` is the only remaining live
call to Jarvis anywhere — this one change fully retires the dependency.

Separately, the debrief's richer prompt (planned-vs-performed via `gym-debrief-logic.js`,
"weigh recovery context from your own data," one-variable-to-change close) already
shipped 2026-08-13 — the "Workout Autopsy debrief upgrade" backlog item is really just
this migration, not new prompt work.

## Change

1. **`gym.html`: retarget the network call.**
   - `askJarvis()` → renamed `askVisionCoach()`.
   - Endpoint: `/api/jarvis-chat` → `/api/vision-talk`.
   - Request body: `{ message }` → `{ transcript: message, coachId: 'gym' }` (same shape
     `mini-vision-chat.js` already sends successfully).
   - Response field: `data.response || data.message` → `data.reply`.
   - Timeout: 12s → 65s, matching `mini-vision-chat.js`'s `TALK_TIMEOUT_MS` (Vision's
     `/talk` runs a codex-exec call, ceiling ~60s server-side per `vision/src/codex.ts`).
   - Drop the 2-attempt retry loop — a second 65s attempt after a timeout just doubles
     worst-case wait for no benefit; `mini-vision-chat.js` doesn't retry either.
   - `fireDebrief()`'s call site (`askJarvis(message)` → `askVisionCoach(message)`) and
     its error-message branches (401/status/generic) are otherwise unchanged — Vision's
     proxy uses the same owner-auth (`verifyOwner`) and error shape as Jarvis's did.

2. **Delete `api/jarvis-chat.js`** — dead once `askVisionCoach()` is its only caller and
   that caller no longer points at it.

3. **No change to `gym-debrief-logic.js`, the message-construction logic in
   `fireDebrief()`, or the debrief UI.** Vision's gym coach already auto-injects 7-day
   sleep/macro-adherence averages into every turn (`vision/src/live-data.ts`
   `fetchGymSummary`, unconditional fetch) — the prompt's recovery-context instruction
   now has real data behind it, which Jarvis never provided.

## Out of scope

- Removing the now-unused `JARVIS_SESSION_SECRET` Vercel env var — flagged for Carl to
  clean up next dashboard visit, zero functional impact either way.
- Any change to Vision's `/talk` route, `live-data.ts`, or the gym coach's system prompt.
- Any other Jarvis caller — none exist after this change (verified by grep across all 6
  other repos before writing this spec).

## Testing

No new tests. `askVisionCoach()`/`fireDebrief()` are thin fetch/DOM wrappers with no
branching logic beyond what's already inline — matches the existing codebase convention
where fetch-layer code (`mini-vision-chat.js`) stays untested and only pure logic files
(`gym-debrief-logic.js`, `mini-vision-chat-logic.js`) get unit tests. Verification is a
real click-through: trigger a debrief in the live app, confirm it returns a Vision
response instead of erroring against the dormant Jarvis backend.
