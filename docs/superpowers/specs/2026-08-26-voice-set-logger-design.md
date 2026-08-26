# Row Live Set Logger / Rest-Timer Copilot — Design Spec

**Date:** 2026-08-26
**Status:** Ready to plan
**Source:** Item #4 of `Claude Outputs/2026-08-26-fleet-idea-batch.md` — the buildable half of Row's existing open item ("Posing/Lift-Form Coach on-device checklist Task 5": real speech-to-log during a set). Codex and Gemini independently converged on hands-free gym-floor logging in this week's `multi-model-check` ideation pass.

## Problem

Logging a set today requires touching the phone — typing weight and reps, tapping Log — between every set of every exercise. That's the exact moment hands are chalked, sweaty, or occupied. The value here is speaking a set the instant you rack it ("incline press, 245 for 8") and having it logged, timed, and cued for the next set without a touch.

## Scope decision: local parse, not a Vision round-trip

`RowVoice`'s `transcribeLocally()` (`voice-helpers.js:116`) already gives an on-device transcript via a local Whisper pipeline — no network involved on the happy path. Parsing that transcript into `{ exercise, weight, reps }` is a deterministic small-grammar problem ("245 for 8", "8 reps at 245", spoken number-words), not one that benefits from Vision's general-purpose reasoning. Routing every set through Vision would add 2-5s of network latency per set, fail on dead gym wifi, and cost tokens on every rep for no real accuracy gain over a purpose-built parser matched against a ~7-exercise candidate list (today's split). Vision's existing chat bubble stays as the fallback for anything the local parser can't handle — untouched, not replaced.

Mic capture itself goes through `RowVoice.startCapture()` (`voice-helpers.js:161`), the same shared function the Vision chat bubble already uses — not a bespoke recorder. It tries local transcription first and only falls back to a paid OpenAI STT call if that fails (`voice-helpers.js:204`). Reusing it as-is was a deliberate choice (Carl's call, 2026-08-26): it avoids duplicating `startCapture`'s carefully-fixed iOS/MediaRecorder-codec/gesture-unlock handling, and the fallback cost already exists for Row's other voice feature — a bad local transcription is the rare case, not the common one.

## Architecture

One new pure-logic file, one wiring block in `gym.html`, everything else reused as-is.

### `gym-voice-log.js` (new)

Exports `parseSetUtterance(transcript, exercises, activeExerciseId)`, returning either `{ exId, weight, reps }` or `{ error: 'no-match' | 'no-numbers', transcript }`. Never throws.

- **Exercise matching**: fuzzy-match against `exercises` filtered to today's split first (per `gym.html`'s existing `splitRotation`/day-exercise data, ~7 candidates — high accuracy, since gym noise mangles names most). Falls through to the full exercise list for ad-hoc lifts not on today's split. No match → `{ error: 'no-match' }`.
- **Number extraction**: regex + a small spoken-number-word table (one..twenty, since working sets rarely exceed that rep range) to pull weight and reps regardless of order ("245 for 8" / "8 reps at 245" / "8 at 245 pounds"). No numbers found → `{ error: 'no-numbers' }`.
- **RIR tolerance, not storage**: a trailing RIR phrase ("two RIR", "two reps in reserve") is recognized and stripped so it doesn't get misparsed as a second rep count, but it is **not stored** — Row's RIR is a program-level weekly target (`getMesocycleRirTarget()`, `gym.html:3622`), not a per-set logged field, and nothing reads a per-set value today. Flagged as a real follow-on if Carl wants per-set RIR tracking later; out of scope here (YAGNI).

### `gym.html` wiring

- A floating tap-to-talk mic button on the Log tab, visible whenever an exercise is active. Tap → `RowVoice` records → `transcribeLocally()` → `parseSetUtterance()`.
- On a clean parse: calls a new `saveSet(ex, weight, reps)` — extracted from the log-button handler's current inline body (`gym.html:~6470-6493`), since that logic (push to `state.logs`, PR classification via `GymWorkoutEvents.classifyWorkoutEvent`, milestone recording, `logWorkoutEvent`, `startRestTimer`, receipt pulse, existing 2×-jump outlier alert) needs to fire identically whether the set came from typing or speaking. This is a mechanical extraction, not new behavior — the manual log button switches to calling the same function.
- On `{ error }`: shows the raw transcript in a small card with **Retry** (re-arm the mic) and **Edit** (pre-fill the normal weight/reps inputs with whatever numbers *were* parsed, if any, so a partial mishear doesn't waste the whole utterance).
- Everything downstream of `saveSet` — the receipt, Undo button, rest timer, next-cue, PR-rant button — already exists and needs no changes.

## Error handling

- **Mishear that still parses** (e.g., "225" heard as "245"): caught the same way a manual typo is today — the existing 2×-jump-from-last-set outlier alert (`gym.html:~6489`) already fires regardless of input method. Undo reverses it, including correct PR-milestone reversal (the 2026-08-21 Codex-caught fix already handles this).
- **No exercise match / no numbers found**: never silently drops the utterance — always surfaces the transcript for Retry/Edit. Never auto-logs a guess.
- **Mic/transcription failure**: `transcribeLocally()` already resolves `null` on timeout/error (`voice-helpers.js:128`) rather than throwing; the wiring treats `null` the same as `no-numbers`.

## Testing

- `gym-voice-log.js` unit tests (TDD, Node-runnable, no browser): exact exercise match, partial/fuzzy match, today's-split-priority match, ad-hoc fallback to full list, no-match; number extraction in each supported order and phrasing, spoken number-words, RIR-phrase stripping without corrupting rep count; garbage/empty input.
- `saveSet` extraction: a before/after behavior-equivalence check (same `state.logs` mutation, same milestone/PR/rest-timer calls) confirming the refactor changed nothing for the existing manual-log path.
- Mic UX (button, retry/edit card, end-to-end parse → save → receipt) verified live in the browser per this project's UI-change convention.
- **Gym-noise reliability is explicitly out of scope for this implementation pass** — that requires Carl testing it live at the gym, which is the one part of the original Task 5 that has always needed him physically present.

## Acceptance criteria

1. `parseSetUtterance()` passes its full test suite covering the cases above.
2. Manual weight/reps logging behaves identically after the `saveSet` extraction (no regression).
3. A clean voice utterance for an on-split exercise logs a set, starts the rest timer, and shows the receipt/Undo — verified live in the browser.
4. An unparseable utterance never silently logs a wrong set — always shows Retry/Edit.

## Follow-on work (not this spec)

- **Per-set RIR storage** — only if Carl wants RIR tracked per set rather than as a weekly program target. Nothing here blocks it; the parser already strips the phrase cleanly, so wiring it into `state.logs` later is additive.
- **Auto re-arm / wake-word mic triggers** — considered and deferred (see fleet idea batch discussion): both raise gym-noise false-trigger risk or battery/complexity cost well beyond what a proven tap-to-talk v1 needs to justify.
- **Gym-floor reliability tuning** (background noise, gym music, mumbled reps) — Carl's own next step once this ships, using the existing Retry/Edit path as the signal for what's actually failing.
