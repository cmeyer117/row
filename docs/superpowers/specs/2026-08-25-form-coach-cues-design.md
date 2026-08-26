# Form Coach Cues — Design (Coach Tab Split, Part B)

**Date:** 2026-08-25
**Status:** Approved by Carl
**Scope:** The actual "best form information" content for Form Coach's stub section (`<div class="fc-info-stub">` in `form-coach.html`, added as a deliberate placeholder during Part A — the Coach tab split, `docs/superpowers/specs/2026-08-25-coach-tab-split-design.md`).

## Problem

Part A shipped Form Coach as a real, separate tab with a live lift camera, but the area below the camera is still a one-line placeholder. Carl wants real form guidance there: what good technique looks like, common mistakes, tied to the exercise the camera is currently scoring.

## Scope decision (from brainstorming)

Full per-exercise coverage, not the 16 generic movement-pattern groups `benchmarks.js` already uses for scoring:

- **28 primary exercises** (one per `gym.html` `defaultExercises` entry, across Push/Pull/Legs A/Upper/Legs B) each get a **full cue write-up**: setup, execution, common mistakes, and — where `benchmarks.js` already has a numeric target for that movement pattern — what the tracked depth/lockout angle should feel like at that target.
- **~70 named substitute variants** (`subs` on each primary exercise) each get a **short variant note**: which primary they inherit their form pattern from, plus what's actually different about that specific variant (equipment, ROM, bodyweight-vs-loaded, etc.) — not a full duplicate write-up.
- This gets every one of the ~100 exercise names in Row real, specific content without diluting research depth across near-duplicate entries (a Codex-style self-check on this scope: writing 100 independent full write-ups risks generic/repetitive content on close variants and un-verifiable specifics on brand/equipment-specific subs like "Arsenal Posterior Chain Developer" — the 28+variant-note split avoids both).
- `benchmarks.js`'s scoring logic (`EXERCISE_BENCHMARKS`, joint-angle matching) is untouched — this is a new, separate reader-facing content layer, not a change to how the camera scores reps.

## Data structure

New file `form-cues.js`, same module pattern as `posing-checklists.js`/`benchmarks.js` (IIFE, `window.FormCues` export):

```js
window.FormCues = {
  primaries: {
    "Hack Squat": {
      setup: "...",
      execution: "...",
      mistakes: ["...", "..."],
      benchmarkNote: "..." // only present when a matching benchmarks.js entry exists; ties the written cue to the numeric target (e.g. "target ~100° knee flexion at the bottom")
    },
    // ...27 more
  },
  variants: {
    "Pendulum Squat": { primary: "Hack Squat", note: "..." },
    // ...~70 more
  }
};
```

Keys are the exact exercise names as they appear in `gym.html`'s `defaultExercises`/`subs` arrays — the same strings the camera's exercise-name input already deals with, so lookup reuses the existing fuzzy-match approach (`FormCoachLogic.matchBenchmark`-style normalization), not a new matching system.

## UI: contextual, not a static list

Rejected a static scrollable list (like `posing.html`'s expandable pose cards) in favor of matching whatever exercise name is currently typed into `form-coach.html`'s existing `#liftExerciseName` input — the same field `benchmarks.js`'s scoring already reads. As the user types/selects an exercise, the matching cue (full write-up if it's a primary, or the short variant note + a link back to its primary's full write-up if it's a sub) renders in place of the stub. No match → the stub's current placeholder-style message stays, but reworded to invite typing an exercise name rather than "coming soon."

Rationale: relevant guidance appears exactly when it's useful (about to attempt that exercise), not as a wall of 100 entries to scroll past below a live camera feed.

## Research approach

Most of the 28 primaries are well-established commercial-gym movement patterns (standard squat/press/row/curl/extension/raise/fly variations) with settled, non-controversial form cues — written directly from established resistance-training technique knowledge, no per-exercise search needed. A small number of sub-variant names are newer or brand/equipment-specific enough to verify rather than guess at (e.g. Bayesian Cable Curl, Pendulum Squat, Arsenal Posterior Chain Developer) — one targeted `exa:search` pass covers these before they're written, rather than 28 separate searches for movements that don't need it.

## Out of scope

- Any change to `benchmarks.js`'s scoring/matching logic.
- A UI for Carl to edit cue content later (out of scope for this pass — `form-cues.js` is a static data file, edited like `posing-checklists.js` is today).
- Expanding `gym.html`'s exercise catalog itself — confirmed with Carl that gym.html's existing roster already covers everything his coach programs; this pass only adds cue *content* for names that already exist there.

## Testing

New self-check (`form-cues.selfcheck.cjs`, matching the existing `.selfcheck.cjs` convention) asserting: every `gym.html` primary exercise name has a `primaries` entry, every sub name has a `variants` entry pointing at a real `primaries` key, and no orphaned cue entries reference exercise names that don't exist in `gym.html`. This is the one thing genuinely worth automating here — everything else is content review, not logic.
