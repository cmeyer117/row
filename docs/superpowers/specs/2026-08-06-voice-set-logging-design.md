# Voice set logging — design spec

**Status:** Approved, ready for plan.
**Owner:** Row (`gym.html`).
**Round 2 pick:** #7 (checklist row 39) — smallest item, highest wow-per-effort.

## Problem

Between sets, Carl currently taps through the UI to log a set. The ask: say "log 315 for 8" and have it logged, no taps.

## Gate

Carl's gym phone is iPhone Safari (iOS 14.5+), which supports `webkitSpeechRecognition` on-device. No dependency on Whisper or the Local AI Workstation session — standalone.

## Key finding

`gym.html` already has a text-command parser: `quickLog(raw, dateKey)` ([gym.html:5782](file:///C:/Users/gregm/row/gym.html)), used today by the "ghost tap" flow (tapping an Rx suggestion card). It parses `"bench 225×8"`, plate notation (`"hack 3p×9"`), RIR (`"@2"`), and bodyweight (`"pullups 10"`), and does fuzzy exercise-name matching via `fuzzyMatchExercise()` ([gym.html:5703](file:///C:/Users/gregm/row/gym.html)) against the full exercise library, auto-creating an ad-hoc exercise on no match.

Voice logging is built as a thin layer on top of this, not a new parser.

## Approach

Normalize the spoken transcript into the string shape `quickLog()` already accepts, then call it unchanged. Considered building a standalone parser (more duplicate logic, more to get wrong) and extending `parseQuickLog()` itself to natively understand "for"/filler words (touches a shared parser other flows depend on, bigger blast radius for this scope) — rejected both in favor of reuse.

## Design

### Trigger

Push-to-talk only. One fixed, always-visible mic button during an active workout (bottom corner, thumb-reachable, matches existing `po-*` visual style). Tap to start listening (pulsing/active visual state), tap again or auto-stop on `onresult`/`onend` to return to idle. No wake word, no background/always-listening — avoids battery drain, iOS Safari backgrounding issues, and gym-noise misfires.

### Grammar / normalization

On final transcript:
1. Lowercase.
2. Strip filler words: `log`, `please`, `set`, `at`, `on`.
3. Collapse `"X for Y"` → `"X×Y"` when both sides are numeric (handles "315 for 8").
4. Leave plate/RIR phrasing as best-effort (existing `quickLog()` grammar already covers `"3p×9"` and `"@2"` if the transcript happens to match) — not a blocking requirement for v1.

Result should approximate `"<exercise name> <weight>×<reps>"`.

### Exercise resolution

Before calling `quickLog()`, resolve the spoken exercise-name fragment via a **restricted** fuzzy match: same scoring function as `fuzzyMatchExercise()`, but the candidate pool is limited to today's planned exercises (`state.sessions[today]`) plus today's already-created ad-hoc entries — not the full exercise library. Rationale: `quickLog()`'s own matcher silently creates a new ad-hoc exercise on no match, which is an acceptable trade for typed input but a real misfire risk for voice (a garbled transcript could quietly spawn junk exercises or match the wrong one). Confident match required to proceed.

- **Confident match:** build `"<matched exercise name> <weight>×<reps>"` and call `quickLog(raw, getActiveDate())` unchanged.
- **No confident match:** do not call `quickLog()`. Show a toast — "Didn't catch the exercise — try again" — with the raw transcript for context. Retry is another mic tap.

### Feedback / error handling

- **`quickLog()` succeeds:** toast shows what was logged (e.g. "Logged Bench 315×8") with an **Undo** button, live ~5s, that removes the just-added log entry. Trust-and-log, not confirm-first — matches the goal of not reintroducing a tap-through step.
- **`quickLog()` returns `{ok:false}`** (bad rep count, missing weight, etc.): same toast pattern, message only, no undo — retry by voice.
- **No confident exercise match:** separate lighter toast (above), since nothing was logged yet — no undo needed.

### Explicitly out of scope for v1

- Wake-word / always-listening.
- Editing a logged set by voice.
- Cross-exercise disambiguation UI (retry by voice instead).

None of these block later addition.

## Files touched

- `gym.html` only — one new script block (SpeechRecognition wiring, normalizer, restricted matcher, toast/undo UI), no new files. Reuses `quickLog()`, `getActiveDate()`, and the existing toast/undo pattern used elsewhere in the file (e.g. `wasUndone` handling).

## Collision note

Session 2 (Posing Coach) is also expected to touch Row's workout-logging surface (`gym.html`). As of this spec, `git log`/`git status` on the Row repo show no in-flight changes from that session — checked immediately before starting this build. Re-check before implementation lands.
