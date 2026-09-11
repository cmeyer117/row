# Live Form Coach Voice Cue — Design

**Date:** 2026-09-11
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

`Claude Outputs/2026-09-10-fleet-4model-deep-ideation.md` named real-time in-set audio coaching as the single item all three internal models (Codex, Kimi, Gemini) independently called the biggest leap for Row, and Grok's live market scan found real shipping competitors (SmartSight AI) doing exactly this — confirming it's table stakes, not speculative.

This is a narrower, deliberate reopening of a decision made in `docs/superpowers/specs/2026-08-30-live-form-coach-feedback-design.md`, which explicitly scoped audio cues out: "Spoken/audio cues — Carl chose visual-only for this pass." That design shipped the underlying live-scoring pipeline (`liveScoreTick()`, running every 1500ms while recording a set) and its one live-safe signal (`velocityFlag`, baselined on the set's first 2 reps so it can't flip retroactively — see that spec's Revision note for why every other flag is set-relative and provisional until Stop). Carl confirmed reopening the audio question now that the visual version has been live and proven.

## Approach

Wire the existing, unmodified `RowVoice.speak()` primitive (`voice-helpers.js:266` — free browser `SpeechSynthesis`, already used elsewhere in the app, zero cost) into the existing `renderLiveResult()`'s velocity-flag detection (`form-coach.html:515-528`). No new TTS infrastructure, no new scoring logic — this is a call-site addition, matching the same "wiring, not building" scope as the parent live-feedback design.

### 1. New state: `lastSpokenVelocityFlagIndex`

Declared alongside the existing `liveMinAmplitude`/`liveCalPrev` recording-scoped state (`form-coach.html:283-284`), reset to `null` in the same place those are reset (the `recordBtn` "start recording" branch, `form-coach.html:581-582`). Tracks the highest rep index a voice cue has already been spoken for, this recording only.

### 2. New localStorage-backed toggle: `row:voice-coach-enabled`

A checkbox near the record button, labeled "🔊 Voice cue on velocity drop," default **off** — new audio behavior must not surprise anyone silently on their next set. Read via `localStorage.getItem('row:voice-coach-enabled') === '1'`, matching this codebase's existing flat-key localStorage convention (e.g. `po_coach_season`, `health:sleep` — no dedicated settings-page abstraction exists in Row, and none is being introduced here). Wrap both the read and the checkbox's change-handler write in `try`/`catch` — a private-browsing/storage-restricted context can throw on `localStorage` access, and this feature degrading to "toggle doesn't persist, defaults to off" is an acceptable failure mode, matching this codebase's existing `try { localStorage.setItem(...) } catch (e) {}` pattern elsewhere (e.g. `gym.html`).

### 3. Speak once per set, on the first flagged rep found

Inside `renderLiveResult()` (or immediately after its call in `liveScoreTick()` — implementation's choice, whichever keeps the function's existing single responsibility clean), after `fatigueRep` is found:

```
if (fatigueRep && voiceCoachEnabled && lastSpokenVelocityFlagIndex === null) {
  lastSpokenVelocityFlagIndex = fatigueRep.index; // set before speak() -- defensive ordering, no reliance on speak()'s own timing
  window.RowVoice.speak('Velocity dropping on rep ' + fatigueRep.index);
}
```

**Correction (Codex review, 2026-09-11):** the first draft used `fatigueRep.index > lastSpokenVelocityFlagIndex`, which does NOT fire exactly once — it re-fires on every tick where a *later* rep becomes the new most-recent flagged rep (e.g. rep 3 flagged → speak, latch=3; rep 4 also flags on a later tick → `4 > 3` → speaks again). The corrected guard is a strict null-check: once `lastSpokenVelocityFlagIndex` is set to anything (not null), no further cue speaks for the rest of this recording, regardless of which rep is later found as `fatigueRep`. This is what actually matches Carl's pick of "once per set, first flag only."

### 4. Cue text: plain and factual

`"Velocity dropping on rep " + fatigueRep.index` — deliberately not "consider stopping the set" or any other directive. The signal is a velocity-loss threshold crossing, not a stop/continue verdict; the existing visual banner already carries the "consider stopping" framing for anyone looking at the screen, but a spoken cue that Carl might act on without reading the screen shouldn't imply more certainty than the underlying measurement supports.

## Files touched

- Modify: `form-coach.html` — the same `recordBtn` click handler / `liveScoreTick` / `renderLiveResult` scope the parent design already touches (~lines 279-533), plus a new checkbox element near the record button.
- No changes to `form-coach-logic.js` (`scoreVelocity`, `scoreSet` etc. are untouched) or `voice-helpers.js` (`RowVoice.speak` is called, not modified).

## Non-goals

- **No true mid-rep/mid-motion cues.** The underlying signal only confirms after a rep completes (same limitation the parent visual-banner design already has, for the same reason: `segmentReps`'s trailing extremum isn't a confirmed rep boundary until the *next* rep starts). This fires moments after a rep, not during one — a real, honest scope limit, not something this design papers over.
- **No cues for rom/tempo/stability flags.** Those remain set-relative and provisional until Stop (per the parent design's Revision note) — velocity is still the only signal safe to act on live.
- **No escalating/repeated cues within a set.** Exactly one spoken cue per recording, per Carl's pick — a long set that stays flagged for many reps after the first one doesn't re-announce.
- **No settings page.** A single checkbox on `form-coach.html` itself, matching Row's existing no-settings-page convention.
- **No changes to `RowVoice.speak()` itself** (queuing, interruption, volume) — a second `speak()` call while one is still playing already calls `window.speechSynthesis.cancel()` first (existing behavior, `voice-helpers.js:269`). **Correction (Codex review, 2026-09-11):** the original claim that "there's nothing for it to interrupt in practice" was too strong — `RowVoice.speak()` is a global primitive (`window.speechSynthesis` is page-wide, not scoped to `form-coach.html`), and this design doesn't audit every other page/component that might call it. Since this recording page only speaks at most once per set today and no other caller was found active on `form-coach.html` specifically, the practical risk is low, but the `cancel()`-first behavior is an existing global side effect this design inherits rather than one it controls — worth knowing, not something this design is claiming to have ruled out everywhere.

## Edge cases

- **Toggle checked mid-recording, after a rep was already flagged while it was off:** the `voiceCoachEnabled` read happens live inside the tick (not cached at record-start), so flipping the checkbox mid-set takes effect on the very next tick. **Real gap, accepted (Codex review, 2026-09-11):** because `lastSpokenVelocityFlagIndex` is still `null` at that point (nothing was spoken while the toggle was off), enabling the toggle after a flag already occurred will speak that already-existing flag on the next tick — the cue can land "late" relative to when the drop actually happened, not relative to when the toggle was turned on. Accepted rather than fixed: this only happens if Carl turns the toggle on mid-set (an unusual interaction — the toggle is meant to be a standing preference, checked once before a session, not flipped mid-set), the spoken content is still accurate (that rep really did flag), and adding a "seed the latch from current state when the toggle changes" listener to close this gap is more complexity than a rare, harmless-content edge case justifies.
- **Recording stopped before any rep is flagged:** `lastSpokenVelocityFlagIndex` simply never gets set; nothing to reset differently from today's flow.
- **Rapid start/stop/start clicking:** `lastSpokenVelocityFlagIndex` resets to `null` in the same branch `liveMinAmplitude`/`liveCalPrev` already reset in — no separate interaction to design for, same reasoning the parent design already established for its own recording-scoped state.
- **Speech synthesis unsupported/blocked:** `RowVoice.speak()` already no-ops safely when `window.speechSynthesis` is unavailable (`voice-helpers.js:267`) — the visual banner is unaffected either way, so an unsupported browser silently falls back to visual-only, not an error.

## Testing

`form-coach.html` has no test harness (matches the parent design and this codebase's other Row static-page builds). Verification for this addition:

- **Live browser trace** (real camera, same as the parent design's own verification approach): start a set with the voice toggle on, perform reps until velocity drops past the flag threshold, confirm exactly one spoken cue fires within one tick (≤1.5s) of the banner first appearing, and confirm no further cues fire for the rest of that same recording even if velocity keeps dropping on later reps.
- Confirm the toggle defaults to off on a fresh page load (no `localStorage` key set).
- Confirm stopping and starting a new set resets the one-cue-per-set latch (a second set in the same page session should be able to speak again) — includes confirming a *new* recording started with the toggle already on doesn't speak until a real flag occurs in that new recording (fresh `lastSpokenVelocityFlagIndex`, no carryover from the prior set).
- Confirm the accepted mid-recording-toggle edge case behaves as documented, not worse than documented: with the toggle off, get a rep flagged (visual banner appears, no cue), then turn the toggle on — confirm exactly one cue speaks on the next tick (the accepted "late" cue) and no further cues speak for the rest of that recording.
