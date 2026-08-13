# Volume-Progression Advisory — Design

## Problem

Grok's 2026-08-13 training-logic audit found `getRx()`'s progression model is load-only: stalls always resolve to a deload, with no concept of weekly training volume as a lever. Current evidence-based programming (Israetel/RP) treats volume progression (adding sets) as the dominant hypertrophy driver once linear load progress slows — exactly where an advanced natural chasing a Pro card sits.

Turns out most of the infrastructure already exists: `gym-volume-logic.js` has real MEV/MAV/MRV bands per muscle group (Israetel/RP-sourced, cited), `weeklySetsByMuscle()`, and `classifyMuscleVolume()` — already tested, already wired into the Progress tab's Volume panel. It's purely observational (a dashboard display), never consulted by `getRx()` or the debrief.

## Approach

**Advisory, not integrated** (Carl's call): volume status informs, doesn't change, what `getRx()` actually prescribes. `rx.type`/`weight`/`reps` stay exactly as they are today — nothing about existing, trusted deload/progression behavior changes. A new optional `rx.volumeAdvisory` field gets attached alongside.

1. **`volumeAdvisory(band, stalled)`** — new pure function in `gym-volume-logic.js`. Takes a `classifyMuscleVolume()` result and whether `getRx()` detected a stall for that exercise. Returns `{ suggestion: 'add_set' | 'pull_back', reason: string }` or `null`:
   - Under MEV → `add_set` (real room before load is even the limiting factor)
   - Stalled AND in MAV range → `add_set` (RP-style: a plateau under MRV is often a volume problem, not purely a load problem)
   - At/above MRV → `pull_back` (more volume here is more likely fatigue than growth)
   - Otherwise (in MAV, not stalled) → `null`, nothing to say

2. **Wire into `getRx()`**: after computing the existing result, look up the exercise's `.muscle`, call `weeklySetsByMuscle()` + `classifyMuscleVolume()` + `volumeAdvisory()`, attach as `rx.volumeAdvisory` when non-null. Exercises with no `.muscle` tag (adhoc/custom) get no advisory — same silent-exclusion behavior `weeklySetsByMuscle()` already has for untagged exercises.

3. **Surface in the debrief**: `formatRxComparison()` (from today's earlier debrief upgrade) appends the advisory's `reason` when present, so Jarvis sees it as part of the same planned-vs-performed context and can factor it into the one-variable-change recommendation.

## Out of scope (this pass)

- Rx-card UI badges (separate follow-up, needs its own placement/design thought)
- Actually changing `getRx()`'s deload/progression decision based on volume (the (A) integrated option — revisit once the advisory's been trusted for a while)

## Testing

Extend `gym-volume-logic.selfcheck.cjs` with `volumeAdvisory()` cases (under-MEV, stalled-in-MAV, at-MRV, in-MAV-not-stalled → null). Extend `gym-debrief-logic.selfcheck.cjs` to confirm the advisory reason appears in the formatted line when present.
