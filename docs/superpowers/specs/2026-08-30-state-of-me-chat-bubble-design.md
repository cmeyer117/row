# State of Me Chat Bubble — Design

**Date:** 2026-08-30
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

Carl's north-star note (`Carl Meyer/02 - Projects/ROW Dashboard.md`) named "no unifying AI coach surface" as the last remaining gap — the pieces of Row being separate features a user has to know to look for, not one coach tying them together. Auditing before designing (this session's recurring discipline — every other gap tonight turned out partly or fully already resolved) found the premise mostly false: `mini-vision-chat.js` is a real, already-built, already-reviewed (Codex + Grok, 2026-08-12) floating chat bubble to Vision — text and voice, persists conversation history across page loads — already live on `gym.html`, `health.html`, `macros.html`, and `main.html`.

The real gap: it's missing from `state-of-me.html`, the one page built *this session* specifically to synthesize Row's cross-domain data (volume, weight trend, recomp, steps, stack adherence, sleep, macros, Faith+Iron) into a single view. You can see the whole picture there but have no way to ask about it — the exact "one coach tying it together" experience the north-star note wants, minus the one missing wire-up.

## Approach

Add the widget to `state-of-me.html` exactly as it already exists on the other 4 pages — no component changes.

1. **Add `voice-helpers.js`.** `state-of-me.html` doesn't currently load it (confirmed: zero references). The original mini-vision-chat build already hit this exact gap once — 3 pages (`health.html`, `macros.html`, `coaching.html`) needed the same addition, documented in its own spec as a must-fix, or "the mic button... will silently do nothing." Same fix, same reasoning, applied to a 5th/6th page now.
2. **Add the same 3-line include** every working page already uses (confirmed via `main.html`): `<script src="mini-vision-chat-logic.js"></script>`, `<script src="mini-vision-chat.js"></script>`, `<mini-vision-chat></mini-vision-chat>`.
3. **No `pcPullRemote()`-style hook needed** — that's a `gym.html`-specific behavior (refreshing local state after a workout-logging write lands), irrelevant to a page with no local write-back state of its own.
4. **Coach stays hardcoded to `gym`** (Carl's call) — `COACH_ID = 'gym'` is a module-level constant in `mini-vision-chat.js`, shared across every page that uses it. Making it configurable per page would be a real change to a component already deployed in 4 places; not justified for this page, especially since the gym coach already reads real cross-domain signal (recomp, faith check-ins, per this session's earlier fatigue-juxtaposition build) rather than being narrowly gym-only in what it actually knows.

## Files touched

- Modify: `state-of-me.html` — add `voice-helpers.js` and the 3-line widget include, near the closing `</body>` (matching where `main.html` places it).

No other files change. `mini-vision-chat.js`/`mini-vision-chat-logic.js`/`api/vision-talk.js` are all unchanged — reused exactly as they already work on 4 other pages.

## Layout risk (already checked)

The widget's own CSS already offsets itself `bottom: calc(150px + env(safe-area-inset-bottom))` specifically to clear Row's bottom topbar — this was a deliberate original-build decision, not something introduced here. `state-of-me.html` uses the same shared `topbar.js` as the pages the widget already ships on, so this transfers with no new layout work. Confirmed by reading the actual CSS, not assumed.

## Out of scope (this pass)

- Making `COACH_ID` configurable — Carl's explicit call, matches the widget's original "hardcoded, not a picker" design decision.
- Rolling the widget out to any other page beyond `state-of-me.html` (`coach.html`, `posing.html`, `form-coach.html`, `index.html`, etc.) — a real question for later, not decided here. `coach.html` in particular hosts `posing.html`/`form-coach.html` as iframes and has its own cross-frame considerations that a floating chat bubble would need to be checked against separately.
- Any change to `mini-vision-chat.js`/`mini-vision-chat-logic.js` themselves — this page is the 5th consumer of an already-stable, already-tested component, not a reason to touch its internals.

## Testing

`mini-vision-chat-logic.js`'s pure-logic pieces already have their own test file (`mini-vision-chat-logic.test.js`), unchanged by this addition — no new logic is being written. `state-of-me.html` has no test harness of its own (matches this session's other Row static-page builds). Verification:

- Syntax check (`node -e "new Function(...)"` on the file's non-module inline scripts) after the edit.
- Live browser trace (this feature has no meaningful way to verify text-chat behavior without a live Supabase-backed session and a real Vision backend call, matching the same disclosed-gap pattern as other builds tonight): open `state-of-me.html`, confirm the bubble renders in the same bottom-right position as on `gym.html`/`main.html` with no visible overlap with the bottom topbar, click to expand, confirm history loads (or renders empty gracefully if there's none yet), send a text message, confirm a reply renders. Voice input verification is the same disclosed real-device gap every other voice feature in this session already carries.
