# Decision closeout: measured evidence — design

2026-08-31

## Problem

`decisions.js` records a decision with `expected_outcome`/`review_date`.
`training-insight-engine.js` produces deterministic pattern findings with
explicit evidence windows. `weekly-review.html`'s closeout flow
(`renderCloseout` → `getOpenDueDecision`) already exists. The three never
connect — Carl has to eyeball whether a decision worked instead of seeing
measured evidence for the week it governed.

## Scope

`decisions.js` only ever writes/reads category `'weekly-coach-loop'` — there
is one decision shape, carrying `details.muscle_groups` (per-muscle
`{action, baseline}`), `details.anchor_lifts` (`{lift, call, guardrail}`),
`details.cardio_rx`/`posing_rx`, `details.pain_flags`. This design covers
that shape only; no new decision categories.

## Review window

Reuse `computeScorecard()`'s existing window derivation exactly:
`scoreWeekRef = easternCalendarDate(decision.created_at) + 7 days`, then
`weekWindow(scoreWeekRef)` → Monday/Sunday. This is already the week
`review_date` points at.

The insight engine's `now` param is set to that Sunday (end of the review
week), not live `new Date()`. If Carl closes out late, evidence reflects
what was true at the end of the governed week, not diluted by whatever he
logged afterward — same reasoning `computeScorecard` already applies to its
own window.

## Relevance mapping

Metadata-only matching, no new heuristics:

| Finding type | Relevant when |
|---|---|
| `chronic-muscle-under` / `chronic-muscle-over` | `finding.muscle` is a key in `decision.details.muscle_groups` |
| `stalled-load-regression` / `stalled-load-plateau` | `finding.exercise` case-insensitively equals any `decision.details.anchor_lifts[].lift` |
| `missed-session-trend` / `volume-phase-mismatch` / `recovery-signal` | always included — these carry no muscle/exercise field, and a `weekly-coach-loop` decision always covers overall training for the week |

Implemented as a pure function `matchInsightFindings(decision, findings)`.

## Shared windowing refactor

`renderReadinessPanel()` (weekly-review.html:706-833) already builds the
engine's `exercises`/`sessionDates`/`weeklySets`/`sleepEntries` input from
`gymState`/`health`, plus runs the per-muscle `detectChronicMuscleVolume`
6-completed-week windowing, anchored to live `now`. The closeout path needs
the identical construction anchored to the review week's Sunday instead.

Factor that block into one function:

```
buildInsightFindings(gymState, health, phase, nowRef) -> findings[]
```

`renderReadinessPanel` calls it with `nowRef = new Date()` (unchanged
behavior). The new closeout path calls it with `nowRef = sunday of the
review week`. No duplicated windowing logic.

**Data cutoff (Codex review finding, 2026-08-31):** `detectStalledExercise`
has no internal `now` awareness — it consumes every exposure it's handed.
The existing `renderReadinessPanel` builder gathers *all* logged
exercise/sleep entries with no cutoff, which is fine when `nowRef` is live
`new Date()` (nothing logged is ever in the future) but wrong once
`buildInsightFindings` is called with a past `nowRef` — a late closeout
would leak exposures logged *after* the review week into that week's
"measured evidence." `buildInsightFindings` must filter every dated input
(exercise exposures, `sessionDates`, sleep entries, and the trailing
weekly-sets/chronic-muscle windows) to `date <= nowRef` before handing
anything to the engine. `renderReadinessPanel`'s behavior is unchanged by
this (its `nowRef` is already "now," so the filter is a no-op there); it
only matters for the closeout path.

## New closeout function

```
async function computeCloseoutEvidence(decision) {
  // same scoreWeekRef/monday/sunday computeScorecard() already derives
  // fetch gymState (shared fetchGymState()), health (fetchAppStateKey('health'))
  // phase = gymState.season && gymState.season.phase
  // findings = buildInsightFindings(gymState, health, phase, sundayAsDate)
  // return matchInsightFindings(decision, findings)
}
```

Called from `renderCloseout` alongside `computeScorecard`, same
try/catch-degrade-gracefully pattern (evidence is a bonus; the verdict
picker must never be blocked by a fetch failure).

## Rendering

A flat "Measured evidence" block in the closeout UI, below the scorecard.
Each matched finding's own `observation` string already names its
muscle/exercise, so a flat list (same rendering shape `findingsHtml` already
uses in the readiness panel — text + confidence badge) is enough; no need to
weave findings into individual scorecard rows. Empty state: block omitted
entirely (matches the empty-scorecard pattern already in this flow).

Trailing-window findings (missed-session-trend: 42d, recovery-signal: 37d,
chronic-muscle/volume-phase: 6wk) legitimately span more than the single
review week and can recur across consecutive closeouts — that's real
historical context, not double-counting. Each row also shows its
`evidenceWindow` (when it's a real date range, not the two detectors whose
window is a descriptive string) so it doesn't read as "caused solely by this
week" (Codex review, 2026-08-31).

**Known limitation:** `anchor_lifts[].lift` is free text Carl types at
decision time, matched case-insensitively-exact against the exercise's
canonical `ex.name` at finding time. A substitution or naming drift (e.g.
"RDL" vs "Smith Machine RDL") will silently miss the match — no fuzzy
matching in v1 (Codex review, 2026-08-31). Acceptable for a personal app:
Carl controls both the decision text and the exercise names.

## Testing

Extend the existing vm-sandbox extraction pattern
(`weekly-review-scorecard.test.js`, `weekly-review-closeout.test.js`):

- `matchInsightFindings` — pure function, straightforward table-driven cases
  per row of the relevance table above, plus case-insensitivity on exercise
  name matching.
- `computeCloseoutEvidence` — real `gym-volume-logic.js` +
  `training-insight-engine.js` wired in (like `weekly-review-scorecard.test.js`
  does for `gym-volume-logic.js`), fetch stubbed for `po-coach`/`health`,
  asserting the Sunday-anchored `now` and the relevance filter both apply
  correctly end to end.

## Out of scope

- No changes to `training-insight-engine.js` detection logic itself.
- No new decision categories or `details` fields.
- Not weaving findings into individual scorecard rows (flat block instead) —
  can revisit if the flat block proves hard to scan in practice.
