# Lift-Form Coach: Real TUT + Depth/Lockout Benchmarks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the time-under-tension data `form-coach.html`'s Lift-Form Coach already computes but discards, and add per-exercise depth/lockout angle benchmarks so both the on-screen display and the AI critique can reference real numbers instead of only relative-to-self deviation.

**Architecture:** Three new pure functions in `form-coach-logic.js` (`matchBenchmark`, extended `segmentReps`/`scoreSet` for phase durations, `scoreDepth`), one new data file (`benchmarks.js`), wiring in `form-coach.html` to compute a real bilateral joint angle per frame when a benchmark matches, and a matching type/prompt update on Vision's `lift-critique.ts` so the richer per-rep data reaches the AI critique. No new camera/detection capability — everything reuses landmarks already buffered every frame.

**Tech Stack:** Vanilla JS (Row, no build step), TypeScript + Vitest (Vision), plain-`node` self-check tests matching each repo's existing convention.

---

### Task 1: `ANGLE_TRIPLES` map + `matchBenchmark()` in `form-coach-logic.js`

**Files:**
- Modify: `C:\Users\gregm\row\form-coach-logic.js` (add after the existing `LANDMARK` map, currently lines 26-33)
- Test: `C:\Users\gregm\row\form-coach-logic.selfcheck.cjs` (append)

- [ ] **Step 1: Write the failing tests**

Append to `form-coach-logic.selfcheck.cjs` (after the existing `computeSymmetry` tests, before `updateHoldTracker`):

```javascript
// ANGLE_TRIPLES — a fixed map of real joint-angle triples, reusing LANDMARK indices.
assertEqual(FCL.ANGLE_TRIPLES.knee.l[1], FCL.LANDMARK.L_KNEE, 'ANGLE_TRIPLES: knee triple vertex is the knee landmark');
assertEqual(FCL.ANGLE_TRIPLES.elbow.l[1], FCL.LANDMARK.L_ELBOW, 'ANGLE_TRIPLES: elbow triple vertex is the elbow landmark');

// matchBenchmark — an exact name match wins.
var benchmarks = [
  { names: ['squat', 'back squat'], jointAngle: 'knee', depthDirection: 'min', targetAngleDeg: 100, cueLabel: 'knee flexion' },
  { names: ['bench', 'bench press'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'elbow lockout' }
];
assertEqual(FCL.matchBenchmark('squat', benchmarks).cueLabel, 'knee flexion', 'matchBenchmark: exact match returns the right entry');

// matchBenchmark — a fuzzy match above threshold still resolves (e.g. "back squat" typed as "squats").
assertEqual(FCL.matchBenchmark('back squats', benchmarks).cueLabel, 'knee flexion', 'matchBenchmark: a close fuzzy match resolves to the right entry');

// matchBenchmark — an unrelated exercise name returns null, not a wrong guess.
assertEqual(FCL.matchBenchmark('cable crossover', benchmarks), null, 'matchBenchmark: no meaningful match returns null');

// matchBenchmark — empty/whitespace input returns null without throwing.
assertEqual(FCL.matchBenchmark('', benchmarks), null, 'matchBenchmark: empty input returns null');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: FAIL — `FCL.ANGLE_TRIPLES` is undefined (`TypeError: Cannot read properties of undefined`)

- [ ] **Step 3: Implement**

In `form-coach-logic.js`, add immediately after the existing `LANDMARK` map (after line 33, before the `POSE_CONFIGS` comment on line 35):

```javascript
  // Real joint-angle triples for the Lift-Form Coach's depth/lockout
  // benchmarks (distinct from POSE_CONFIGS' trackedJoints below, which
  // are posing-mode specific). Each side traces shoulder->elbow->wrist,
  // hip->knee->ankle, or shoulder->hip->knee -- reuses LANDMARK indices.
  var ANGLE_TRIPLES = {
    knee: { l: [LANDMARK.L_HIP, LANDMARK.L_KNEE, LANDMARK.L_ANKLE], r: [LANDMARK.R_HIP, LANDMARK.R_KNEE, LANDMARK.R_ANKLE] },
    elbow: { l: [LANDMARK.L_SHOULDER, LANDMARK.L_ELBOW, LANDMARK.L_WRIST], r: [LANDMARK.R_SHOULDER, LANDMARK.R_ELBOW, LANDMARK.R_WRIST] },
    hip: { l: [LANDMARK.L_SHOULDER, LANDMARK.L_HIP, LANDMARK.L_KNEE], r: [LANDMARK.R_SHOULDER, LANDMARK.R_HIP, LANDMARK.R_KNEE] }
  };

  // Bilateral angle for the named ANGLE_TRIPLES entry -- average of the
  // left and right real angles (not an average of Y-position first).
  // Returns null if either side is undetectable this frame.
  function bilateralAngle(landmarks, jointAngle) {
    var triple = ANGLE_TRIPLES[jointAngle];
    if (!triple) return null;
    var l = angleDeg(landmarks[triple.l[0]], landmarks[triple.l[1]], landmarks[triple.l[2]]);
    var r = angleDeg(landmarks[triple.r[0]], landmarks[triple.r[1]], landmarks[triple.r[2]]);
    if (l === null || r === null) return null;
    return (l + r) / 2;
  }

  // Bidirectional token-F1 fuzzy match against a benchmark table's
  // `names` arrays -- same algorithm as gym.html's fuzzyMatchExercise(),
  // reimplemented here since the data shape differs (a names[] array per
  // entry vs. a single exercise.name). Returns null below threshold 0.35,
  // same as the reference implementation, so an unmatched exercise
  // degrades to "no benchmark" rather than a wrong guess.
  function matchBenchmark(exerciseName, benchmarks) {
    var q = (exerciseName || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    if (!q) return null;
    var qTokens = q.split(/\s+/).filter(Boolean);
    var best = null, bestScore = -1;
    benchmarks.forEach(function (entry) {
      entry.names.forEach(function (name) {
        var nTokens = name.toLowerCase().split(/\s+/).filter(Boolean);
        var hits = 0;
        qTokens.forEach(function (qt) {
          if (nTokens.some(function (nt) { return nt.startsWith(qt) || qt.startsWith(nt); })) hits++;
        });
        var score = (hits * hits) / (Math.max(qTokens.length, 1) * Math.max(nTokens.length, 1));
        if (score > bestScore) { bestScore = score; best = entry; }
      });
    });
    return bestScore >= 0.35 ? best : null;
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Export the new API and commit**

In `form-coach-logic.js`, in the `api` object (currently lines 324-337), add:

```javascript
    ANGLE_TRIPLES: ANGLE_TRIPLES,
    bilateralAngle: bilateralAngle,
    matchBenchmark: matchBenchmark,
```

```bash
cd /c/Users/gregm/row && git add form-coach-logic.js form-coach-logic.selfcheck.cjs && git commit -m "feat(form-coach): add ANGLE_TRIPLES + matchBenchmark for depth/lockout benchmarks"
```

---

### Task 2: `benchmarks.js` data file

**Files:**
- Create: `C:\Users\gregm\row\benchmarks.js`
- Test: `C:\Users\gregm\row\form-coach-logic.selfcheck.cjs` (append)

- [ ] **Step 1: Write the failing test**

Append to `form-coach-logic.selfcheck.cjs`:

```javascript
// EXERCISE_BENCHMARKS — loaded from benchmarks.js, matchBenchmark resolves real entries.
var fs2 = require('fs');
vm.runInContext(fs2.readFileSync(path.join(__dirname, 'benchmarks.js'), 'utf8'), sandbox);
var realBenchmarks = sandbox.window.EXERCISE_BENCHMARKS;
assertEqual(Array.isArray(realBenchmarks) && realBenchmarks.length >= 10, true, 'EXERCISE_BENCHMARKS: at least 10 curated entries exist');
var squatMatch = FCL.matchBenchmark('squat', realBenchmarks);
assertEqual(squatMatch.jointAngle, 'knee', 'EXERCISE_BENCHMARKS: squat entry tracks the knee joint');
var benchMatch = FCL.matchBenchmark('bench press', realBenchmarks);
assertEqual(benchMatch.jointAngle, 'elbow', 'EXERCISE_BENCHMARKS: bench press entry tracks the elbow joint');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: FAIL — `ENOENT` reading `benchmarks.js` (file doesn't exist yet)

- [ ] **Step 3: Implement**

Create `C:\Users\gregm\row\benchmarks.js`:

```javascript
// benchmarks.js — curated depth/lockout angle targets for the Lift-Form
// Coach's most common exercises. Deliberately small (~12-15 entries) per
// the design spec -- widen later based on what Carl actually logs, not
// upfront. `jointAngle` keys into form-coach-logic.js's ANGLE_TRIPLES.
// `depthDirection: 'min'` means a SMALLER angle at the tracked extremum is
// better (e.g. squat depth, more knee flexion); 'max' means a LARGER angle
// is better (e.g. full lockout extension).
(function () {
  'use strict';
  var EXERCISE_BENCHMARKS = [
    { names: ['squat', 'back squat', 'hack squat', 'goblet squat'], jointAngle: 'knee', depthDirection: 'min', targetAngleDeg: 100, cueLabel: 'knee flexion depth' },
    { names: ['leg press'], jointAngle: 'knee', depthDirection: 'min', targetAngleDeg: 90, cueLabel: 'knee flexion depth' },
    { names: ['bulgarian split squat', 'split squat', 'lunge'], jointAngle: 'knee', depthDirection: 'min', targetAngleDeg: 100, cueLabel: 'front knee flexion depth' },
    { names: ['bench press', 'bench', 'dumbbell bench', 'incline bench'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'elbow lockout' },
    { names: ['overhead press', 'shoulder press', 'ohp'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'elbow lockout' },
    { names: ['tricep extension', 'skull crusher', 'pushdown'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 170, cueLabel: 'elbow lockout' },
    { names: ['bicep curl', 'curl', 'hammer curl'], jointAngle: 'elbow', depthDirection: 'min', targetAngleDeg: 50, cueLabel: 'top-of-curl flexion' },
    { names: ['deadlift', 'romanian deadlift', 'rdl', 'stiff leg deadlift'], jointAngle: 'hip', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'hip lockout' },
    { names: ['hip thrust', 'glute bridge'], jointAngle: 'hip', depthDirection: 'max', targetAngleDeg: 170, cueLabel: 'hip lockout' },
    { names: ['bent over row', 'barbell row', 't-bar row'], jointAngle: 'elbow', depthDirection: 'min', targetAngleDeg: 60, cueLabel: 'top-of-row elbow flexion' },
    { names: ['pulldown', 'lat pulldown', 'pull up', 'chin up'], jointAngle: 'elbow', depthDirection: 'min', targetAngleDeg: 55, cueLabel: 'bottom-of-pull elbow flexion' },
    { names: ['leg extension'], jointAngle: 'knee', depthDirection: 'max', targetAngleDeg: 170, cueLabel: 'knee lockout' }
  ];
  if (typeof window !== 'undefined') window.EXERCISE_BENCHMARKS = EXERCISE_BENCHMARKS;
  if (typeof module !== 'undefined' && module.exports) module.exports = EXERCISE_BENCHMARKS;
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row && git add benchmarks.js form-coach-logic.selfcheck.cjs && git commit -m "feat(form-coach): add curated exercise depth/lockout benchmark table"
```

---

### Task 3: Real TUT — `midValue` in `segmentReps()`, new `phaseDurations()`, `totalTutMs` in `scoreSet()`

**Files:**
- Modify: `C:\Users\gregm\row\form-coach-logic.js:206-227` (`segmentReps`), `:281-301` (`scoreSet`)
- Test: `C:\Users\gregm\row\form-coach-logic.selfcheck.cjs` (append)

- [ ] **Step 1: Write the failing tests**

Append to `form-coach-logic.selfcheck.cjs`:

```javascript
// segmentReps — now also reports midValue (the extremum's raw value),
// needed for depth/lockout scoring against a benchmark's target angle.
var repsWithMidValue = FCL.segmentReps(cleanSamples, 2);
assertClose(repsWithMidValue[0].midValue, 10, 0.01, 'segmentReps: rep 1 midValue is the extremum value (10)');

// phaseDurations — splits a rep's full duration into eccentric (start->mid)
// and concentric (mid->start) phases.
var phaseTest = FCL.phaseDurations({ startT: 0, midT: 300, endT: 400 });
assertEqual(phaseTest.eccentricMs, 300, 'phaseDurations: eccentric phase is start->mid');
assertEqual(phaseTest.concentricMs, 100, 'phaseDurations: concentric phase is mid->end');

// scoreSet — now includes eccentricMs/concentricMs per rep and totalTutMs
// for the set (sum of every rep's durationMs).
var e2eWithTut = FCL.scoreSet(e2eSamples, e2eStability, 2);
assertEqual(e2eWithTut[0].eccentricMs, 100, 'scoreSet: rep 1 eccentricMs matches its start->mid duration');
assertEqual(e2eWithTut[0].concentricMs, 100, 'scoreSet: rep 1 concentricMs matches its mid->end duration');
assertEqual(FCL.totalTutMs(e2eWithTut), e2eWithTut[0].durationMs + e2eWithTut[1].durationMs, 'totalTutMs: sums every rep\'s durationMs');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: FAIL — `repsWithMidValue[0].midValue` is `undefined`, not close to 10

- [ ] **Step 3: Implement**

In `form-coach-logic.js`, modify `segmentReps` (the `reps.push` block, currently lines 218-224) to add `midValue`:

```javascript
      reps.push({
        startT: start.t,
        midT: mid.t,
        endT: end.t,
        midValue: mid.value,
        rom: Math.abs(mid.value - start.value),
        durationMs: end.t - start.t
      });
```

Add `phaseDurations` and `totalTutMs` immediately after `segmentReps` (after its closing brace, before the `round2` function on line 229):

```javascript
  // Splits one segmentReps() entry's full duration into eccentric
  // (start->mid, the first direction of travel) and concentric
  // (mid->end, the return) phase durations. Pure arithmetic on data
  // segmentReps already computes -- no new tracking.
  function phaseDurations(rep) {
    return { eccentricMs: rep.midT - rep.startT, concentricMs: rep.endT - rep.midT };
  }

  // Total time-under-tension for a scored set -- sum of every rep's
  // full durationMs (scoreSet's output already carries this per rep).
  function totalTutMs(scoredReps) {
    return scoredReps.reduce(function (sum, r) { return sum + r.durationMs; }, 0);
  }
```

Modify `scoreSet`'s return-mapping (currently lines 288-300) to include the new fields:

```javascript
  function scoreSet(samples, stabilitySamples, minAmplitude) {
    var reps = segmentReps(samples, minAmplitude);
    var romTempo = scoreReps(reps);
    var stability = scoreStability(stabilitySamples, reps);
    return romTempo.map(function (r, idx) {
      var phases = phaseDurations(reps[idx]);
      return {
        index: r.index,
        rom: r.rom,
        romPct: r.romPct,
        romFlag: r.romFlag,
        durationMs: r.durationMs,
        eccentricMs: phases.eccentricMs,
        concentricMs: phases.concentricMs,
        tempoRatio: r.tempoRatio,
        tempoFlag: r.tempoFlag,
        avgJitter: stability[idx].avgJitter,
        stabilityFlag: stability[idx].stabilityFlag
      };
    });
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Export and commit**

Add to the `api` object:

```javascript
    phaseDurations: phaseDurations,
    totalTutMs: totalTutMs,
```

```bash
cd /c/Users/gregm/row && git add form-coach-logic.js form-coach-logic.selfcheck.cjs && git commit -m "feat(form-coach): real time-under-tension -- eccentric/concentric phase durations + set totalTutMs"
```

---

### Task 4: `scoreDepth()` and wiring into `scoreSet()`

**Files:**
- Modify: `C:\Users\gregm\row\form-coach-logic.js` (add `scoreDepth`, extend `scoreSet` signature)
- Test: `C:\Users\gregm\row\form-coach-logic.selfcheck.cjs` (append)

- [ ] **Step 1: Write the failing tests**

Append to `form-coach-logic.selfcheck.cjs`:

```javascript
// scoreDepth — 'min' direction: a rep whose midValue angle is AT OR BELOW
// target is a met depth (e.g. squat knee angle 95deg vs target <=100deg).
var squatBenchmark = { jointAngle: 'knee', depthDirection: 'min', targetAngleDeg: 100, cueLabel: 'knee flexion depth' };
var deepRep = { midValue: 95 };
var shallowRep = { midValue: 115 };
assertEqual(FCL.scoreDepth(deepRep, squatBenchmark).depthMet, true, 'scoreDepth: min-direction rep at or below target angle is depthMet true');
assertEqual(FCL.scoreDepth(shallowRep, squatBenchmark).depthMet, false, 'scoreDepth: min-direction rep above target angle is depthMet false (shallow)');
assertEqual(FCL.scoreDepth(deepRep, squatBenchmark).depthDeg, 95, 'scoreDepth: depthDeg reports the rep\'s own angle');
assertEqual(FCL.scoreDepth(deepRep, squatBenchmark).targetDeg, 100, 'scoreDepth: targetDeg reports the benchmark target');

// scoreDepth — 'max' direction: a rep whose midValue is AT OR ABOVE target is met.
var benchBenchmark = { jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'elbow lockout' };
assertEqual(FCL.scoreDepth({ midValue: 170 }, benchBenchmark).depthMet, true, 'scoreDepth: max-direction rep at or above target is depthMet true');
assertEqual(FCL.scoreDepth({ midValue: 150 }, benchBenchmark).depthMet, false, 'scoreDepth: max-direction rep below target is depthMet false (short of lockout)');

// scoreDepth — no matched benchmark (null) returns null, not a crash.
assertEqual(FCL.scoreDepth(deepRep, null), null, 'scoreDepth: no benchmark returns null');

// scoreDepth — a rep with no midValue (angle undetectable that frame) returns null.
assertEqual(FCL.scoreDepth({ midValue: null }, squatBenchmark), null, 'scoreDepth: an undetectable midValue returns null rather than a wrong flag');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: FAIL — `FCL.scoreDepth is not a function`

- [ ] **Step 3: Implement**

Add after `phaseDurations`/`totalTutMs` (from Task 3):

```javascript
  // Compares one rep's extremum angle (midValue, from segmentReps) against
  // a matched benchmark's target. Returns null when there's no benchmark
  // (matchBenchmark found nothing) or the angle wasn't detectable that
  // frame -- both are "no data," never guessed at.
  function scoreDepth(rep, benchmark) {
    if (!benchmark || rep.midValue == null) return null;
    var met = benchmark.depthDirection === 'min'
      ? rep.midValue <= benchmark.targetAngleDeg
      : rep.midValue >= benchmark.targetAngleDeg;
    return { depthDeg: round1(rep.midValue), targetDeg: benchmark.targetAngleDeg, depthMet: met };
  }
```

Modify `scoreSet` to accept an optional `benchmark` param and include depth scoring:

```javascript
  function scoreSet(samples, stabilitySamples, minAmplitude, benchmark) {
    var reps = segmentReps(samples, minAmplitude);
    var romTempo = scoreReps(reps);
    var stability = scoreStability(stabilitySamples, reps);
    return romTempo.map(function (r, idx) {
      var phases = phaseDurations(reps[idx]);
      var depth = scoreDepth(reps[idx], benchmark || null);
      var result = {
        index: r.index,
        rom: r.rom,
        romPct: r.romPct,
        romFlag: r.romFlag,
        durationMs: r.durationMs,
        eccentricMs: phases.eccentricMs,
        concentricMs: phases.concentricMs,
        tempoRatio: r.tempoRatio,
        tempoFlag: r.tempoFlag,
        avgJitter: stability[idx].avgJitter,
        stabilityFlag: stability[idx].stabilityFlag
      };
      if (depth) {
        result.depthDeg = depth.depthDeg;
        result.targetDeg = depth.targetDeg;
        result.depthMet = depth.depthMet;
      }
      return result;
    });
  }
```

(The existing `e2eResult`/`e2eWithTut` self-check calls above pass no 4th arg — `benchmark` defaults to `undefined`/`null`, `scoreDepth` returns `null`, no `depthDeg` key gets added, matching the "absent field when not applicable" pattern `avgJitter`/`stabilityFlag` already use elsewhere. Confirm this by re-running the full suite in Step 4 — none of the earlier assertions should break.)

- [ ] **Step 4: Run to verify it passes**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed` (including every earlier assertion in the file — this step also verifies Task 4 didn't break Tasks 1-3 or the pre-existing tests)

- [ ] **Step 5: Export and commit**

Add to the `api` object:

```javascript
    scoreDepth: scoreDepth,
```

```bash
cd /c/Users/gregm/row && git add form-coach-logic.js form-coach-logic.selfcheck.cjs && git commit -m "feat(form-coach): scoreDepth -- compare rep extremum angle against a matched benchmark"
```

---

### Task 5: Wire angle-based tracking + display into `form-coach.html`

**Files:**
- Modify: `C:\Users\gregm\row\form-coach.html:494` (add `benchmarks.js` script tag), `:522-540` (`buildPrimarySignal`), `:553-566` (`renderResult`), `:583-619` (record button handler)

No new automated test — this is DOM/camera wiring code, untested per the existing convention in this exact file (the camera loop, `buildPrimarySignal`, `renderResult` etc. have no unit tests today either; only the pure logic in `form-coach-logic.js` is tested). Verified manually in Step 6.

- [ ] **Step 1: Load `benchmarks.js`**

Find the `<script>` tag that loads `form-coach-logic.js` in `form-coach.html` (search for `src="form-coach-logic.js"`) and add immediately after it:

```html
<script src="benchmarks.js"></script>
```

- [ ] **Step 2: Compute the bilateral angle per frame when a benchmark matches**

Modify `buildPrimarySignal` (currently lines 522-540) to accept the matched benchmark and prefer the real angle when one exists:

```javascript
  // Picks the tracked point with the greatest y-range across the
  // buffered recording as the primary rep-segmentation axis when there's
  // no matched benchmark -- a wrist for a press pattern, a hip for a
  // squat pattern, etc. When a benchmark DID match, uses the real
  // bilateral joint angle for that exercise instead (FormCoachLogic.
  // bilateralAngle + ANGLE_TRIPLES) -- more accurate for depth-specific
  // coaching, and the same angle scoreDepth() will check against.
  function buildPrimarySignal(frames, benchmark) {
    if (benchmark) {
      var angleSamples = frames.map(function (f) {
        return { t: f.t, value: window.FormCoachLogic.bilateralAngle(f.landmarks, benchmark.jointAngle) };
      }).filter(function (s) { return s.value !== null; });
      if (angleSamples.length >= 10) {
        var values = angleSamples.map(function (s) { return s.value; });
        return { samples: angleSamples, range: Math.max.apply(null, values) - Math.min.apply(null, values) };
      }
      // Fewer than 10 valid angle frames (person partly out of frame too
      // often) -- fall through to the Y-position fallback below rather
      // than scoring a set from a mostly-missing signal.
    }
    var candidates = {
      wristAvgY: function (lm) { return (lm[LIFT_LANDMARK.L_WRIST].y + lm[LIFT_LANDMARK.R_WRIST].y) / 2; },
      hipAvgY: function (lm) { return (lm[LIFT_LANDMARK.L_HIP].y + lm[LIFT_LANDMARK.R_HIP].y) / 2; },
      kneeAvgY: function (lm) { return (lm[LIFT_LANDMARK.L_KNEE].y + lm[LIFT_LANDMARK.R_KNEE].y) / 2; }
    };
    var best = null, bestRange = -1;
    Object.keys(candidates).forEach(function (name) {
      var values = frames.map(function (f) { return candidates[name](f.landmarks); });
      var range = Math.max.apply(null, values) - Math.min.apply(null, values);
      if (range > bestRange) { bestRange = range; best = name; }
    });
    var samples = frames.map(function (f) { return { t: f.t, value: candidates[best](f.landmarks) }; });
    return { samples: samples, range: bestRange };
  }
```

- [ ] **Step 3: Pass the matched benchmark through the record-button handler**

In the record button's stop-recording branch (currently around lines 599-604), before `buildPrimarySignal` is called:

```javascript
      var exerciseName = document.getElementById('liftExerciseName').value.trim();
      var matchedBenchmark = window.FormCoachLogic.matchBenchmark(exerciseName, window.EXERCISE_BENCHMARKS);
      var primary = buildPrimarySignal(buffer, matchedBenchmark);
      var stabilitySamples = buildStabilitySamples(buffer);
      var minAmplitude = primary.range * 0.15;
      var scored = window.FormCoachLogic.scoreSet(primary.samples, stabilitySamples, minAmplitude, matchedBenchmark);
      renderResult(scored, exerciseName);
```

(This replaces the existing `var primary = buildPrimarySignal(buffer);` / `var scored = window.FormCoachLogic.scoreSet(primary.samples, stabilitySamples, minAmplitude);` / `var exerciseName = ...` / `renderResult(scored, exerciseName);` lines — same logic, reordered so `exerciseName` and `matchedBenchmark` are available before `buildPrimarySignal` needs them.)

- [ ] **Step 4: Display real seconds, phase split, depth, and set TUT**

Replace `renderResult` (currently lines 553-566):

```javascript
  function formatSeconds(ms) { return (ms / 1000).toFixed(1) + 's'; }

  function renderResult(scored, exerciseName) {
    if (!scored.length) {
      resultEl.innerHTML = '<div class="mob-card"><div class="mob-card-body">No clear reps detected — make sure your full body stays in frame through the whole set.</div></div>';
      return;
    }
    var rows = scored.map(function (r) {
      var flags = [];
      if (r.romFlag) flags.push('<span class="fc-rep-flag">Short ROM</span>');
      if (r.tempoFlag) flags.push('<span class="fc-rep-flag">Rushed/bounced</span>');
      if (r.stabilityFlag) flags.push('<span class="fc-rep-flag">Unstable</span>');
      var tempoStr = formatSeconds(r.eccentricMs) + ' down / ' + formatSeconds(r.concentricMs) + ' up';
      var depthStr = ('depthMet' in r) ? (' — ' + r.depthDeg + '°/target ' + r.targetDeg + '° ' + (r.depthMet ? '✓' : '✗')) : '';
      return '<div class="fc-rep-row"><span>Rep ' + r.index + ' — ' + tempoStr + depthStr + '</span><span>' + (flags.join(' ') || 'Good') + '</span></div>';
    }).join('');
    var totalTut = window.FormCoachLogic.totalTutMs(scored);
    resultEl.innerHTML = '<div class="mob-card"><div class="mob-card-body"><strong>' + escape(exerciseName || 'Set') + '</strong> — ' + scored.length + ' reps, ' + formatSeconds(totalTut) + ' total TUT</div></div><div class="mob-card">' + rows + '</div>';
  }
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row && git add form-coach.html && git commit -m "feat(form-coach): wire angle-based tracking + real TUT/depth display into the recording flow"
```

---

### Task 6: Richer critique payload on Vision's `lift-critique.ts`

**Files:**
- Modify: `C:\Users\gregm\claude-workspace-scratch\vision\src\lift-critique.ts:29-38` (`ScoredRep` type, `formatRep`)
- Test: `C:\Users\gregm\claude-workspace-scratch\vision\src\lift-critique.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `lift-critique.test.ts`, inside the `describe('critiqueLift', ...)` block:

```typescript
  it('includes phase durations and depth/lockout data in the prompt when present', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(null, '', ''))
    readFileMock.mockResolvedValue(FULL_JSON)

    const repsWithDepth = [
      { index: 1, romPct: 0.95, romFlag: false, durationMs: 1800, eccentricMs: 1200, concentricMs: 600, tempoRatio: 1.0, tempoFlag: false, avgJitter: 0.02, stabilityFlag: false, depthDeg: 95, targetDeg: 100, depthMet: true },
    ]
    await critiqueLift({ exercise: 'Back Squat', reps: repsWithDepth })

    const promptArg = (execFileMock.mock.calls[0]![1] as string[]).at(-1)
    expect(promptArg).toContain('1.2s down')
    expect(promptArg).toContain('0.6s up')
    expect(promptArg).toContain('depth 95')
    expect(promptArg).toContain('target 100')
    expect(promptArg).toContain('met')
  })

  it('falls back to the existing rep line shape when phase/depth data is absent (older client)', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(null, '', ''))
    readFileMock.mockResolvedValue(FULL_JSON)

    await critiqueLift({ exercise: 'Hack Squat', reps: SAMPLE_REPS })

    const promptArg = (execFileMock.mock.calls[0]![1] as string[]).at(-1)
    expect(promptArg).toContain('Rep 1: 95% ROM')
    expect(promptArg).not.toContain('depth')
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:\Users\gregm\claude-workspace-scratch\vision && npx vitest run lift-critique.test.ts`
Expected: FAIL — the new test's assertions (`toContain('1.2s down')` etc.) don't match, since `formatRep` doesn't emit them yet

- [ ] **Step 3: Implement**

In `lift-critique.ts`, modify the `ScoredRep` type (currently lines 29-38) to add the new optional fields:

```typescript
export type ScoredRep = {
  index: number
  romPct: number
  romFlag: boolean
  durationMs: number
  eccentricMs?: number
  concentricMs?: number
  tempoRatio: number
  tempoFlag: boolean
  avgJitter: number
  stabilityFlag: boolean
  depthDeg?: number
  targetDeg?: number
  depthMet?: boolean
}
```

Modify `formatRep` (currently lines 78-81) to include the new fields when present, falling back to the existing shape when absent:

```typescript
function formatRep(rep: ScoredRep): string {
  const flags = [rep.romFlag && 'short ROM', rep.tempoFlag && 'rushed/bounced tempo', rep.stabilityFlag && 'unstable'].filter(Boolean)
  const flagsStr = flags.length ? flags.join(', ') : 'no flags'
  if (rep.eccentricMs != null && rep.concentricMs != null) {
    const tempoStr = `${(rep.eccentricMs / 1000).toFixed(1)}s down / ${(rep.concentricMs / 1000).toFixed(1)}s up`
    const depthStr = rep.depthDeg != null && rep.targetDeg != null
      ? `, depth ${rep.depthDeg}/target ${rep.targetDeg} (${rep.depthMet ? 'met' : 'not met'})`
      : ''
    return `Rep ${rep.index}: ${tempoStr}${depthStr}, ${flagsStr}`
  }
  return `Rep ${rep.index}: ${Math.round(rep.romPct * 100)}% ROM, tempo ratio ${rep.tempoRatio.toFixed(2)}, ${flagsStr}`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd C:\Users\gregm\claude-workspace-scratch\vision && npx vitest run lift-critique.test.ts`
Expected: all tests pass, including the two new ones and every pre-existing one (the fallback test specifically confirms `SAMPLE_REPS`, which has no `eccentricMs`, still produces the old rep-line shape)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/claude-workspace-scratch/vision && git add src/lift-critique.ts src/lift-critique.test.ts && git commit -m "feat(lift-critique): include phase durations + depth/lockout data in the critique prompt when present"
```

---

### Task 7: Push both repos and verify live

**Files:** none — deploy + manual verification.

- [ ] **Step 1: Run each repo's full test suite one more time**

```bash
cd /c/Users/gregm/row && node scripts/run-tests.mjs
```
Expected: all tests pass (including the new form-coach ones)

```bash
cd /c/Users/gregm/claude-workspace-scratch/vision && npx vitest run
```
Expected: all tests pass

- [ ] **Step 2: Push Row**

```bash
cd /c/Users/gregm/row && git push
```

- [ ] **Step 3: Deploy Vision**

Per the standing rule for this repo (`npm run deploy`, never raw `railway up` — see `project-vision-deploy-process` memory):

```bash
cd /c/Users/gregm/claude-workspace-scratch/vision && npm run deploy
```

- [ ] **Step 4: Carl verifies live on his phone**

Record a real set of one of the 12 benchmarked exercises (e.g. squat or bench press) on the actual Form Coach page. Confirm: real seconds show per rep (not just a %), a depth/lockout line appears with a ✓ or ✗, the total-TUT line appears in the set summary, and the AI critique text references the real numbers. Then record a set of something NOT in the benchmark table (e.g. "cable crossover") and confirm it falls back cleanly to the old percentage-only display with no depth line and no errors.

- [ ] **Step 5: If anything fails, get the exact error and debug from that**

Same pattern as every other live-verification step this session — a real console error or a real wrong number, not a guess.
