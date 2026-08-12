# Mini Vision Chat Bubble — Design

**Reviewed by Codex (luna) and Grok, 2026-08-12** — both confirmed the Web Component approach is sound; must-fix gaps folded in below (voice-helpers script gap, `pcPullRemote` refresh hook, history contract/race, timeout/guard carryover, `.ml-voice-mic-btn` correction). Accessibility/theming polish flagged by Grok deliberately deferred past v1.

## Problem

Row's only entry point into Vision is a push-to-talk mic button on `gym.html` (`voiceMicBtn`/`sendToVision`, `gym.html:5958-6048`) — single-shot voice logging, toast reply, no visible history even though Vision already keeps per-coach conversation memory server-side (`vision/src/talk-turn.ts`, `getRecentHistory`/`getCoachHistory`). Carl wants a fuller, persistent "mini Vision" chat surface reachable from the pages he actually uses, not just one voice-triggered action on one page.

Row has no shared-include mechanism — every HTML page is a standalone file (confirmed: the existing mic markup only ever exists in `gym.html`, never copied elsewhere). Building a chat surface as a real cross-page feature means solving that first, or accepting per-page duplication.

## Decision: Web Component

New `<mini-vision-chat>` custom element (Shadow DOM for style isolation from Row's existing page-level CSS), defined once in `mini-vision-chat.js`. Any page adopts it with two lines:

```html
<script src="mini-vision-chat.js"></script>
<mini-vision-chat></mini-vision-chat>
```

Chosen over the alternatives considered:
- **Client-side fetch-and-inject partial** — rejected: adds a network round-trip and a flash-of-missing-content on every page load.
- **Build-time concatenation (mini static-site generator)** — rejected: Row has no build step today; introducing one is new infra to maintain for every future deploy, not just this feature.

Web Component needs no build tooling, has no injection flicker, and is the reusable pattern for whatever else gets extracted next (nav, other shared chrome) — this feature is also step 1 of "stop copy-pasting shared UI into every Row page."

## Scope

- **Coach: `gym` only.** Row is a fitness tracker; other Vision coach domains (`faith`, `mindset`, `content`, `cpa`, `finance`) have no matching Row page. Hardcoded, not a picker.
- **Pages: `main.html`, `gym.html`, `health.html`, `macros.html`, `coaching.html`** — the pages Carl actually uses. Not all 17 Row pages (e.g. `reset-password.html`, `offline.html` gain nothing).
- **Input: both text and voice**, reusing the existing `window.RowVoice` capture/TTS pipeline already wired into `gym.html`.
- **History: shown on open.** Vision already persists per-coach turns server-side; a chat surface that opens blank despite that would look broken.
- **Confirm flows stay conversational** (say "yes" back), matching how `propose_remove_set`/`confirm_remove_set` already works today. No Confirm/Cancel buttons — that would require `/talk` to return action-type metadata it doesn't return today (just a `reply` string), which is out of scope for v1.
- **Replaces, not adds to, the existing `gym.html` mic button** — same underlying capability (`/talk`, same voice pipeline), so keeping both is two UIs for one thing.

## Behavior

- Renders as a fixed-position floating bubble. Click toggles an expand/collapse panel (message list, text input, mic button). **Closed by default on every page load** — no cross-page open-state persistence in v1 (Row has no SPA router; each page is a fresh load, so "remembering open" would need `localStorage` plumbing that isn't worth it yet). Since the component remounts fresh on every navigation (full page reload, not an SPA), any in-progress voice capture must stop on `beforeunload`/`pagehide` so a mic session never leaks across navigations.
- On first expand per page load, fetches history via a new `mode=history` branch on the existing Row→Vision proxy (`api/vision-talk.js`) → Vision's existing `GET /coach/gym/history`. **The proxy route is POST-only** (matches `talk`/`tts`/`stt`), so the browser call is a `POST /api/vision-talk?mode=history` that internally performs the upstream `GET` — no Vision backend changes needed, the endpoint already exists.
  - **History contract:** response is `{ turns: HistoryTurn[] }` in chronological order (oldest first), matching `getCoachHistory`'s existing return shape (`vision/src/app.ts:116-125`). Render each turn as a user bubble + assistant bubble pair; no pagination/truncation handling needed since the endpoint doesn't paginate today.
  - **Send-during-history-load race:** the input/mic stays disabled (with a loading state) until the initial history fetch resolves, so a send can't land before history renders and get overwritten or duplicated. If the history fetch fails, treat it the same as no history (render nothing, don't block sending — history is an enhancement, not a hard dependency, matching Vision's own server-side treatment of it).
- Sending (text or voice) funnels into the same `/api/vision-talk` call (`mode=talk`, `coachId: 'gym'`) the old mic used — only the source of `transcript` differs (typed vs. `RowVoice.startCapture` output). Carries over the old mic's two safety behaviors verbatim: a **pending-send guard** (disable input while a call is in flight, matching `talkPending`) and the **65s client-side abort timeout** (must stay ≥ Vision's own 60s `codex-exec` timeout — a shorter client timeout risks a retry double-logging a write action that actually already landed server-side).
- Reply renders as a new message bubble. **Only spoken aloud via `RowVoice.speak()` when the turn was voice-initiated** — a typed message gets a silent text-only reply, so the widget doesn't talk unexpectedly in a shared/gym setting.
- **On `gym.html` specifically**, a successful reply must still trigger `window.__gym.pcPullRemote()` (if present) — the old mic added this because Vision's workout writes otherwise took ~3 minutes to show up via the normal sync cadence. Dropping it without replacing it would make a real logged set look like it silently failed.

## Files touched

- **New:** `mini-vision-chat.js` (the custom element: shadow-DOM markup/styles, open/close toggle, history fetch, text+voice send, message rendering).
- **Row pages:** add the script+tag to `main.html`, `gym.html`, `health.html`, `macros.html`, `coaching.html`. **`health.html`, `macros.html`, `coaching.html` don't currently load `voice-helpers.js`** (only `gym.html`/`main.html` do) — must add that script include too, or the mic button on those 3 pages will silently do nothing.
- **`gym.html`:** delete the old `voiceMicBtn`/`sendToVision`/voice-toast code (`gym.html:5958-6048`, ~90 lines) and its `.po-voice-mic` CSS rule. **`.ml-voice-mic-btn` is a separate generic voice-input class, not part of the old floating mic — leave it alone**, verify what else references it before removing anything under that name.
- **`api/vision-talk.js`:** add a `mode=history` branch mirroring the existing `mode=tts`/`mode=stt` pattern, proxying to Vision's `GET /coach/gym/history` with the same session-cookie auth already used for `talk`/`tts`/`stt`.

## Testing

- Unit tests for the component's pure-logic pieces (history-turns→rendered-messages mapping, text-vs-voice reply-speaking branch) — no DOM framework needed, same style as existing `gym-voice-logic.js` tests.
- Manual on-device check for mic/voice parity across the 5 pages — same real-device verification gap the old mic already had, not new risk.

## Out of scope (v1)

- Cross-page open/closed persistence.
- Coach picker / non-gym domains.
- Confirm/Cancel action buttons.
- Rolling the Web Component pattern out to any other shared Row chrome (nav, etc.) — this feature proves the pattern, doesn't have to finish the rollout.
