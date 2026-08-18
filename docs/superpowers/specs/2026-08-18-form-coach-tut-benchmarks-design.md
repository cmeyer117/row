# Lift-Form Coach: real time-under-tension + depth/lockout benchmarks

## Why

`form-coach.html`'s Lift-Form Coach already tracks reps and gives AI critique, but two real gaps:

1. **Time-under-tension data is computed and thrown away.** `segmentReps()` (in
   `form-coach-logic.js`) already extracts each rep's `startT`/`midT`/`endT` timestamps —
   everything needed for eccentric/concentric phase durations and total set TUT — but the
   UI only ever shows a relative `romPct` and pass/fail flags, never real seconds.
2. **ROM/tempo are relative-only, never absolute.** `buildPrimarySignal()` (in
   `form-coach.html`) tracks a landmark's raw Y-position (wrist/hip/knee, whichever moves
   most), not a real joint angle, and scores every rep against the *set's own average* —
   it can say "this rep was shorter than your others," never "your squat isn't hitting
   real depth." There's no per-exercise benchmark to check against.

Both fixes reuse machinery that already exists (`angleDeg()`, the `LANDMARK` triples, the
already-buffered per-frame landmarks) — this is filling in unused capability, not adding
new tracking.

**Cost:** confirmed zero API-token spend both before and after this change. The AI
critique pipeline (`api/vision-lift-critique.js` → Vision's `lift-critique.ts`) sends only
computed numbers, never images, and runs through `codex exec` (ChatGPT-Plus-bundled,
zero marginal cost) — this change only grows the JSON payload sent through that same
pipeline, no new spend surface.

## Change

### 1. Benchmark table (Row, new file `benchmarks.js` — kept separate from
`form-coach-logic.js` since it's a data table, not tracking logic)

A small curated `EXERCISE_BENCHMARKS` array (~12-15 common lifts: squat, bench, deadlift,
overhead press, row, curl, pulldown, leg press, etc.). Each entry:

```js
{
  names: ['squat', 'back squat', 'hack squat'],   // match candidates
  jointAngle: 'knee',                              // key into ANGLE_TRIPLES (below) -- a real vertex angle, not a Y-position proxy
  depthDirection: 'min',                           // 'min' = deeper angle is better (squat), 'max' = more extension is better (bench lockout)
  targetAngleDeg: 100,                              // squat: knee angle should reach <=100 deg at bottom
  cueLabel: 'knee flexion'
}
```

Note this is a *different* concept from `buildPrimarySignal()`'s existing
`wristAvgY`/`hipAvgY`/`kneeAvgY` candidates (those are raw Y-position, used for
segmentation only, no angle math). `jointAngle` keys into a new small
`ANGLE_TRIPLES` map in `form-coach-logic.js` — real vertex-angle triples, reusing the
existing `LANDMARK` indices exactly like posing mode's `POSE_CONFIGS` already does:

```js
var ANGLE_TRIPLES = {
  knee:  { l: [L_HIP, L_KNEE, L_ANKLE],     r: [R_HIP, R_KNEE, R_ANKLE] },
  elbow: { l: [L_SHOULDER, L_ELBOW, L_WRIST], r: [R_SHOULDER, R_ELBOW, R_WRIST] },
  hip:   { l: [L_SHOULDER, L_HIP, L_KNEE],  r: [R_SHOULDER, R_HIP, R_KNEE] }
};
```

Per-frame angle = average of `angleDeg(l...)` and `angleDeg(r...)` (bilateral average of
two real angles — not averaging Y-position first and computing one angle from that,
which would be a different, less accurate number).

### 2. Exercise-name matching (Row, `form-coach-logic.js`)

New pure function `matchBenchmark(exerciseName, benchmarks)` — same bidirectional
token-F1 scoring algorithm as `gym.html`'s `fuzzyMatchExercise()` (hits² / (qTokens ×
nTokens), threshold 0.35), reimplemented against the benchmark table's `names` arrays
instead of `state.exercises` (different data shape, not directly reusable, but the same
proven algorithm). Returns `null` on no match — callers must treat "no benchmark" as a
normal, expected case, not an error.

### 3. Angle-based tracking (Row, `form-coach.html`)

When `matchBenchmark()` finds a match for the typed exercise name, `buildPrimarySignal()`
also computes the real bilateral joint angle (via `FormCoachLogic.angleDeg()` and the new
`ANGLE_TRIPLES` map) for the matched `jointAngle`, every frame, from the already-buffered
landmarks — no new camera/detection work, this data is already captured, just unused
today. This angle becomes the primary signal for rep segmentation instead of the
Y-position proxy when a benchmark exists (more accurate for depth-specific coaching);
falls back to today's Y-position auto-pick when there's no match.

### 4. Real TUT (Row, `form-coach-logic.js`)

New pure function `phaseDurations(rep)` — takes one `segmentReps()` output entry
(`{startT, midT, endT, ...}`) and returns `{eccentricMs, concentricMs}` (straight
subtraction, `midT - startT` and `endT - midT`). `scoreSet()` gains these two fields per
rep alongside the existing ones. Set-level `totalTutMs` = sum of every rep's
`durationMs`.

### 5. Depth/lockout scoring (Row, `form-coach-logic.js`)

New pure function `scoreDepth(rep, matchedBenchmark, primaryAngleAtExtremum)` — compares
the rep's extremum angle (mid-point, where the tracked signal reverses direction) to
`targetAngleDeg` per `depthDirection`. Returns `{depthDeg, targetDeg, depthMet: boolean}`.
`null` when no benchmark matched — same "absent field, not a forced default" pattern the
rest of `scoreSet()` already uses (e.g. `avgJitter: null` when no stability samples).

### 6. Display (Row, `form-coach.html`)

`renderResult()`'s per-rep row changes from:
```
Rep 3 — 82% ROM        [Short ROM]
```
to:
```
Rep 3 — 2.1s down / 0.8s up      92°/target ≤100° ✓
```
(the depth segment only renders when `scoreDepth` returned non-null). Existing
rushed/bounced/unstable flags stay, appended after. Set summary line gains
`totalTutMs` formatted as seconds.

### 7. Richer critique (Vision, `lift-critique.ts` + `lift-critique-schema.json`)

`ScoredRep` type gains the new optional fields (`eccentricMs`, `concentricMs`,
`depthDeg`, `targetDeg`, `depthMet`). `formatRep()` includes them in the per-rep line
sent to the prompt when present:
```
Rep 3: 2.1s down / 0.8s up, depth 92°/target <=100 (met), no flags
```
`buildPrompt()`'s instruction text stays otherwise unchanged — the model already knows
how to synthesize a critique from rep lines, richer data just makes the critique able to
reference real depth/lockout instead of only relative deviation. No schema/output-shape
change needed (`critique`/`form_score`/`fault_tag`/`cue` stay the same).

## Out of scope

- Expanding the benchmark table beyond ~12-15 common lifts in this pass — start narrow,
  widen later based on what Carl actually logs.
- Any new camera/detection capability — everything here reuses already-buffered landmark
  data and already-existing pure functions (`angleDeg`, `LANDMARK`).
- Touching the Posing Coach (`posing` mode) — this is scoped to `lift` mode only.
- Historical trend comparison across sessions (mentioned as a possible future depth but
  not part of "surface real numbers + add benchmarks").

## Testing

New pure functions (`matchBenchmark`, `phaseDurations`, `scoreDepth`) get the same
`node`-runnable self-check pattern as the rest of `form-coach-logic.js`
(`form-coach-logic.selfcheck.cjs`) — cases for: exact match, fuzzy match above/below
threshold, no-benchmark fallback, depth met/not-met in both `min`/`max` directions,
phase-duration arithmetic on a real `segmentReps()` sample. `form-coach.html`'s own
wiring (camera, angle-vs-Y-position primary-signal switch, display strings) stays
untested per the existing convention — DOM/camera-glue code isn't unit tested anywhere
else in this file either.
