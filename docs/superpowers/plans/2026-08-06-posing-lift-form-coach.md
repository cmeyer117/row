# Posing & Lift-Form Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new standalone Row page, `form-coach.html`, giving Carl two camera-based coaching modes backed by client-side MediaPipe Pose: a Posing Coach (freeze-and-compare against `posing.html`'s 7 Competition reference poses, with left/right symmetry scoring) and a Lift-Form Coach (record a set, get rep-by-rep ROM/tempo/stability feedback scored relative to the set's own average).

**Architecture:** All scoring/segmentation math lives in pure functions in `form-coach-logic.js` (no DOM, no camera — dual-exported for `node` self-check and browser `<script>` load, matching `gym-volume-logic.js`'s pattern). `form-coach.html` owns the camera feed, MediaPipe wiring, and rendering only — it calls into `form-coach-logic.js` for every calculation. Zero edits to `gym.html`.

**Tech Stack:** Plain HTML/CSS/JS (no bundler, matching Row's existing pages), `@mediapipe/tasks-vision` loaded via CDN as an ES module, `getUserMedia` for camera access, Node's built-in `assert`/`vm` for the logic module's self-check (no test framework, matching `gym-volume-logic.selfcheck.cjs`).

---

## File Structure

- **Create:** `form-coach-logic.js` — pure functions: `angleDeg`, `POSE_CONFIGS`, `trackedAngles`, `computeSymmetry`, `createHoldTracker`/`updateHoldTracker`, `segmentReps`, `scoreReps`, `scoreStability`, `scoreSet`.
- **Create:** `form-coach-logic.selfcheck.cjs` — assert-based tests for every function above, run via `node form-coach-logic.selfcheck.cjs`.
- **Create:** `form-coach.html` — page shell (header, mode segmented control, gym-tabbar nav matching `posing.html`), camera/MediaPipe wiring, Posing Coach mode UI, Lift-Form Coach mode UI, error-state UI.
- **Modify:** `posing.html` — one nav entry point into the new page (final task, after everything else is verified).

---

### Task 1: `angleDeg` — the core angle primitive

**Files:**
- Create: `form-coach-logic.js`
- Test: `form-coach-logic.selfcheck.cjs`

- [ ] **Step 1: Write `form-coach-logic.js` with the IIFE shell and `angleDeg`**

```js
// form-coach-logic.js — pure functions for the Posing & Lift-Form Coach
// (joint-angle math, symmetry scoring, rep segmentation, ROM/tempo/
// stability scoring). No DOM, no camera, no MediaPipe — see
// form-coach.html for the wiring. Dual export like gym-volume-logic.js
// so this can be self-checked with plain `node` and also loaded as a
// plain <script>.
(function () {
  'use strict';

  // Angle in degrees at vertex b, formed by rays b->a and b->c.
  // Points are {x, y} (MediaPipe landmarks or any 2D coords — scale-
  // and axis-direction-invariant). Returns null if either ray has
  // zero length (a, b, or c coincide) rather than NaN.
  function angleDeg(a, b, c) {
    var abx = a.x - b.x, aby = a.y - b.y;
    var cbx = c.x - b.x, cby = c.y - b.y;
    var magAB = Math.sqrt(abx * abx + aby * aby);
    var magCB = Math.sqrt(cbx * cbx + cby * cby);
    if (magAB === 0 || magCB === 0) return null;
    var cos = (abx * cbx + aby * cby) / (magAB * magCB);
    cos = Math.max(-1, Math.min(1, cos));
    return Math.acos(cos) * (180 / Math.PI);
  }

  var api = {
    angleDeg: angleDeg
  };
  if (typeof window !== 'undefined') window.FormCoachLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 2: Write `form-coach-logic.selfcheck.cjs`**

```js
// Run with: node form-coach-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'form-coach-logic.js'), 'utf8'), sandbox);
const FCL = sandbox.window.FormCoachLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}
function assertClose(actual, expected, tolerance, label) {
  if (actual === null || Math.abs(actual - expected) > tolerance) {
    console.error(`FAIL: ${label}\n  expected: ~${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// angleDeg — a right angle (a straight up from b, c straight right of b) is 90deg.
assertClose(FCL.angleDeg({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 90, 0.01, 'angleDeg: perpendicular rays measure 90deg');

// angleDeg — a straight line through b (a and c on opposite sides) is 180deg.
assertClose(FCL.angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 180, 0.01, 'angleDeg: a straight line through the vertex measures 180deg');

// angleDeg — a fully folded joint (a and c on the same side) is close to 0deg.
assertClose(FCL.angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0.001 }), 0, 1, 'angleDeg: a fully folded joint measures close to 0deg');

// angleDeg — a degenerate ray (a coincides with the vertex) returns null, not NaN.
assertEqual(FCL.angleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), null, 'angleDeg: a zero-length ray returns null rather than NaN');

console.log('form-coach-logic.selfcheck.cjs: all assertions passed (so far)');
```

- [ ] **Step 3: Run it to verify it passes**

Run: `node form-coach-logic.selfcheck.cjs` (from `C:\Users\gregm\row`)
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed (so far)`

- [ ] **Step 4: Commit**

```bash
git add form-coach-logic.js form-coach-logic.selfcheck.cjs
git commit -m "feat(form-coach): add angleDeg joint-angle primitive"
```

---

### Task 2: Landmark indices + `POSE_CONFIGS` + `trackedAngles` + `computeSymmetry`

**Files:**
- Modify: `form-coach-logic.js`
- Modify: `form-coach-logic.selfcheck.cjs`

MediaPipe's Pose Landmarker returns 33 normalized `{x, y, z, visibility}` points per detected person, indexed per Google's standard BlazePose topology. This task only needs the upper-body + leg subset relevant to the 7 poses already in `posing.html`'s Competition gallery (`front-double-biceps`, `front-lat-spread`, `side-chest`, `side-triceps`, `back-double-biceps`, `back-lat-spread`, `abdominal-thigh`).

- [ ] **Step 1: Add landmark indices and `POSE_CONFIGS` to `form-coach-logic.js`**

Insert after the `angleDeg` function, before `var api = {`:

```js
  // Subset of MediaPipe's 33-point BlazePose topology this feature uses.
  var LANDMARK = {
    L_SHOULDER: 11, R_SHOULDER: 12,
    L_ELBOW: 13, R_ELBOW: 14,
    L_WRIST: 15, R_WRIST: 16,
    L_HIP: 23, R_HIP: 24,
    L_KNEE: 25, R_KNEE: 26,
    L_ANKLE: 27, R_ANKLE: 28
  };

  // One entry per posing.html Competition-gallery slug. trackedJoints
  // are the angles this pose cares about (used for hold-stability
  // detection); symmetryPairs names two trackedJoints entries to
  // compare left vs right. Poses shot from the side (side-chest,
  // side-triceps) or deliberately asymmetric (abdominal-thigh) have no
  // meaningful bilateral comparison — symmetryPairs is empty for
  // those, and the UI shows hold-time only, not a symmetry readout.
  var POSE_CONFIGS = {
    'front-double-biceps': {
      label: 'Front Double Biceps',
      trackedJoints: [
        { name: 'L elbow', triple: [LANDMARK.L_SHOULDER, LANDMARK.L_ELBOW, LANDMARK.L_WRIST] },
        { name: 'R elbow', triple: [LANDMARK.R_SHOULDER, LANDMARK.R_ELBOW, LANDMARK.R_WRIST] }
      ],
      symmetryPairs: [{ joint: 'elbow', left: 'L elbow', right: 'R elbow' }]
    },
    'front-lat-spread': {
      label: 'Front Lat Spread',
      trackedJoints: [
        { name: 'L elbow', triple: [LANDMARK.L_SHOULDER, LANDMARK.L_ELBOW, LANDMARK.L_WRIST] },
        { name: 'R elbow', triple: [LANDMARK.R_SHOULDER, LANDMARK.R_ELBOW, LANDMARK.R_WRIST] }
      ],
      symmetryPairs: [{ joint: 'elbow', left: 'L elbow', right: 'R elbow' }]
    },
    'back-double-biceps': {
      label: 'Back Double Biceps',
      trackedJoints: [
        { name: 'L elbow', triple: [LANDMARK.L_SHOULDER, LANDMARK.L_ELBOW, LANDMARK.L_WRIST] },
        { name: 'R elbow', triple: [LANDMARK.R_SHOULDER, LANDMARK.R_ELBOW, LANDMARK.R_WRIST] }
      ],
      symmetryPairs: [{ joint: 'elbow', left: 'L elbow', right: 'R elbow' }]
    },
    'back-lat-spread': {
      label: 'Back Lat Spread',
      trackedJoints: [
        { name: 'L elbow', triple: [LANDMARK.L_SHOULDER, LANDMARK.L_ELBOW, LANDMARK.L_WRIST] },
        { name: 'R elbow', triple: [LANDMARK.R_SHOULDER, LANDMARK.R_ELBOW, LANDMARK.R_WRIST] }
      ],
      symmetryPairs: [{ joint: 'elbow', left: 'L elbow', right: 'R elbow' }]
    },
    'side-chest': {
      label: 'Side Chest',
      trackedJoints: [
        { name: 'front elbow', triple: [LANDMARK.L_SHOULDER, LANDMARK.L_ELBOW, LANDMARK.L_WRIST] },
        { name: 'front knee', triple: [LANDMARK.L_HIP, LANDMARK.L_KNEE, LANDMARK.L_ANKLE] }
      ],
      symmetryPairs: []
    },
    'side-triceps': {
      label: 'Side Triceps',
      trackedJoints: [
        { name: 'near elbow', triple: [LANDMARK.L_SHOULDER, LANDMARK.L_ELBOW, LANDMARK.L_WRIST] }
      ],
      symmetryPairs: []
    },
    'abdominal-thigh': {
      label: 'Abdominal & Thigh',
      trackedJoints: [
        { name: 'extended knee', triple: [LANDMARK.L_HIP, LANDMARK.L_KNEE, LANDMARK.L_ANKLE] }
      ],
      symmetryPairs: []
    }
  };

  function round1(n) { return Math.round(n * 10) / 10; }

  // Returns { values: [deg, ...], byName: { jointName: deg, ... } } for
  // every trackedJoints entry of the given pose slug. Unknown slug
  // returns an empty result rather than throwing.
  function trackedAngles(landmarks, poseSlug) {
    var config = POSE_CONFIGS[poseSlug];
    if (!config) return { values: [], byName: {} };
    var byName = {};
    var values = config.trackedJoints.map(function (j) {
      var deg = angleDeg(landmarks[j.triple[0]], landmarks[j.triple[1]], landmarks[j.triple[2]]);
      byName[j.name] = deg;
      return deg;
    });
    return { values: values, byName: byName };
  }

  // Returns [{ joint, leftDeg, rightDeg, diffDeg }, ...] for every
  // symmetryPairs entry of the given pose. Empty array for poses with
  // no meaningful bilateral comparison (side poses, abdominal-thigh).
  function computeSymmetry(landmarks, poseSlug) {
    var config = POSE_CONFIGS[poseSlug];
    if (!config || !config.symmetryPairs.length) return [];
    var byName = trackedAngles(landmarks, poseSlug).byName;
    return config.symmetryPairs.map(function (pair) {
      var leftDeg = byName[pair.left], rightDeg = byName[pair.right];
      if (leftDeg == null || rightDeg == null) {
        return { joint: pair.joint, leftDeg: null, rightDeg: null, diffDeg: null };
      }
      return { joint: pair.joint, leftDeg: round1(leftDeg), rightDeg: round1(rightDeg), diffDeg: round1(leftDeg - rightDeg) };
    });
  }
```

- [ ] **Step 2: Add both to the `api` export**

```js
  var api = {
    angleDeg: angleDeg,
    LANDMARK: LANDMARK,
    POSE_CONFIGS: POSE_CONFIGS,
    trackedAngles: trackedAngles,
    computeSymmetry: computeSymmetry
  };
```

- [ ] **Step 3: Add tests to `form-coach-logic.selfcheck.cjs`**

Insert before the final `console.log` line:

```js
// Build a 33-slot landmark array (indices 0-32) with everything at
// the origin except the joints a test cares about — matches the
// shape MediaPipe actually returns per frame.
function blankLandmarks() {
  var arr = [];
  for (var i = 0; i < 33; i++) arr.push({ x: 0, y: 0 });
  return arr;
}

// trackedAngles — front-double-biceps tracks both elbows; a landmark
// array with both arms bent to a right angle reports ~90deg each.
var lmSymmetric = blankLandmarks();
lmSymmetric[FCL.LANDMARK.L_SHOULDER] = { x: 0, y: 0 };
lmSymmetric[FCL.LANDMARK.L_ELBOW] = { x: 0, y: -1 };
lmSymmetric[FCL.LANDMARK.L_WRIST] = { x: 1, y: -1 };
lmSymmetric[FCL.LANDMARK.R_SHOULDER] = { x: 2, y: 0 };
lmSymmetric[FCL.LANDMARK.R_ELBOW] = { x: 2, y: -1 };
lmSymmetric[FCL.LANDMARK.R_WRIST] = { x: 1, y: -1 };
var trackedSymmetric = FCL.trackedAngles(lmSymmetric, 'front-double-biceps');
assertClose(trackedSymmetric.byName['L elbow'], 90, 0.01, 'trackedAngles: L elbow reads ~90deg for a right-angle bend');
assertClose(trackedSymmetric.byName['R elbow'], 90, 0.01, 'trackedAngles: R elbow reads ~90deg for a right-angle bend');

// trackedAngles — an unknown pose slug returns an empty result, not a crash.
assertEqual(FCL.trackedAngles(lmSymmetric, 'not-a-real-pose').values.length, 0, 'trackedAngles: unknown pose slug returns empty values');

// computeSymmetry — perfectly mirrored arms report diffDeg 0.
var symResult = FCL.computeSymmetry(lmSymmetric, 'front-double-biceps');
assertEqual(symResult.length, 1, 'computeSymmetry: front-double-biceps has exactly one symmetry pair (elbow)');
assertClose(symResult[0].diffDeg, 0, 0.01, 'computeSymmetry: mirrored arms report ~0deg difference');

// computeSymmetry — an uneven right arm (more bent) reports a non-zero diff.
var lmUneven = blankLandmarks();
lmUneven[FCL.LANDMARK.L_SHOULDER] = { x: 0, y: 0 };
lmUneven[FCL.LANDMARK.L_ELBOW] = { x: 0, y: -1 };
lmUneven[FCL.LANDMARK.L_WRIST] = { x: 1, y: -1 }; // ~90deg
lmUneven[FCL.LANDMARK.R_SHOULDER] = { x: 2, y: 0 };
lmUneven[FCL.LANDMARK.R_ELBOW] = { x: 2, y: -1 };
lmUneven[FCL.LANDMARK.R_WRIST] = { x: 2.9, y: -0.1 }; // much more folded, far from 90deg
var unevenResult = FCL.computeSymmetry(lmUneven, 'front-double-biceps');
if (Math.abs(unevenResult[0].diffDeg) < 5) {
  console.error(`FAIL: computeSymmetry: an uneven arm bend should report a diffDeg clearly away from 0, got ${unevenResult[0].diffDeg}`);
  process.exit(1);
}

// computeSymmetry — a side pose (side-chest) has no bilateral comparison, returns empty.
assertEqual(FCL.computeSymmetry(lmSymmetric, 'side-chest').length, 0, 'computeSymmetry: side-chest has no symmetryPairs, returns empty array');
```

- [ ] **Step 4: Run and verify all assertions pass**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed (so far)`

- [ ] **Step 5: Commit**

```bash
git add form-coach-logic.js form-coach-logic.selfcheck.cjs
git commit -m "feat(form-coach): add POSE_CONFIGS, trackedAngles, computeSymmetry"
```

---

### Task 3: Hold-detection tracker

**Files:**
- Modify: `form-coach-logic.js`
- Modify: `form-coach-logic.selfcheck.cjs`

Pure, functional state machine: given the previous tracker state and this frame's tracked angles, returns a *new* tracker state plus whether the pose has now been held long enough to auto-freeze. No mutation, no timers — `form-coach.html` supplies real timestamps from `performance.now()`.

- [ ] **Step 1: Add to `form-coach-logic.js`** (after `computeSymmetry`)

```js
  function createHoldTracker() {
    return { holdStartMs: null, lastValues: null };
  }

  // True if every angle in `a` is within toleranceDeg of the same-
  // index angle in `b`. False (not stable) if lengths differ or any
  // angle is null (person stepped partly out of frame).
  function anglesStable(a, b, toleranceDeg) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] === null || b[i] === null) return false;
      if (Math.abs(a[i] - b[i]) > toleranceDeg) return false;
    }
    return true;
  }

  // Advances the hold tracker by one frame. `values` is this frame's
  // trackedAngles(...).values for the active pose. Returns
  // { tracker, elapsedMs, ready } — tracker is a new object (the
  // input tracker is never mutated), elapsedMs is how long the pose
  // has been held at its current stable position, ready is true once
  // elapsedMs >= holdDurationMs (the caller should trigger the freeze
  // capture on the frame this first goes true).
  function updateHoldTracker(tracker, values, timestampMs, toleranceDeg, holdDurationMs) {
    var stable = anglesStable(tracker.lastValues, values, toleranceDeg);
    var holdStartMs = stable && tracker.holdStartMs !== null ? tracker.holdStartMs : timestampMs;
    var elapsedMs = timestampMs - holdStartMs;
    return {
      tracker: { holdStartMs: holdStartMs, lastValues: values },
      elapsedMs: elapsedMs,
      ready: elapsedMs >= holdDurationMs
    };
  }
```

- [ ] **Step 2: Add to the `api` export**

```js
    createHoldTracker: createHoldTracker,
    updateHoldTracker: updateHoldTracker
```

- [ ] **Step 3: Add tests**

Insert before the final `console.log` line:

```js
// updateHoldTracker — a pose held steady across several frames
// accumulates elapsed time and eventually reports ready.
var holdTracker = FCL.createHoldTracker();
var stepA = FCL.updateHoldTracker(holdTracker, [90, 90], 0, 5, 1500);
assertEqual(stepA.ready, false, 'updateHoldTracker: not ready on the very first frame');
var stepB = FCL.updateHoldTracker(stepA.tracker, [91, 89], 500, 5, 1500);
assertEqual(stepB.ready, false, 'updateHoldTracker: not ready after 500ms of a 1500ms hold requirement');
assertClose(stepB.elapsedMs, 500, 1, 'updateHoldTracker: elapsedMs tracks time held so far');
var stepC = FCL.updateHoldTracker(stepB.tracker, [90, 90], 1600, 5, 1500);
assertEqual(stepC.ready, true, 'updateHoldTracker: ready once elapsedMs reaches holdDurationMs');

// updateHoldTracker — a big angle jump (pose broken) resets the hold clock.
var jumpTracker = FCL.updateHoldTracker(stepB.tracker, [90, 90], 1000, 5, 1500).tracker;
var afterJump = FCL.updateHoldTracker(jumpTracker, [40, 90], 1100, 5, 1500);
assertEqual(afterJump.ready, false, 'updateHoldTracker: a large angle jump resets readiness');
assertClose(afterJump.elapsedMs, 0, 1, 'updateHoldTracker: elapsedMs resets to 0 right after a broken hold');

// updateHoldTracker — a null angle (person partly out of frame) breaks the hold, doesn't crash.
var nullFrame = FCL.updateHoldTracker(stepC.tracker, [90, null], 1700, 5, 1500);
assertEqual(nullFrame.ready, false, 'updateHoldTracker: a null angle (partial detection) breaks an active hold rather than crashing');
```

- [ ] **Step 4: Run and verify**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed (so far)`

- [ ] **Step 5: Commit**

```bash
git add form-coach-logic.js form-coach-logic.selfcheck.cjs
git commit -m "feat(form-coach): add hold-detection tracker for auto-freeze"
```

---

### Task 4: Rep segmentation (`segmentReps`)

**Files:**
- Modify: `form-coach-logic.js`
- Modify: `form-coach-logic.selfcheck.cjs`

Turns a time series of a single tracked value (e.g. wrist height across a set) into a list of reps by finding turning points (local extrema) with a minimum-amplitude noise filter, then pairing consecutive extrema three at a time (start → turnaround → end = one rep).

- [ ] **Step 1: Add to `form-coach-logic.js`** (after `updateHoldTracker`)

```js
  // Zig-zag turning-point extraction: walks `samples` ({t, value},
  // sorted by t ascending) and records a point only when the signal
  // has reversed direction by at least minAmplitude since the last
  // recorded point. Filters out camera/landmark jitter that isn't a
  // real rep phase. Always includes the first and last sample.
  function findExtrema(samples, minAmplitude) {
    var extrema = [];
    if (!samples.length) return extrema;
    var extremeIdx = 0;
    var direction = 0; // 0 = undetermined yet, 1 = rising, -1 = falling
    for (var i = 1; i < samples.length; i++) {
      var diff = samples[i].value - samples[extremeIdx].value;
      if (direction === 0) {
        if (Math.abs(diff) >= minAmplitude) {
          extrema.push(samples[extremeIdx]);
          direction = diff > 0 ? 1 : -1;
          extremeIdx = i;
        }
      } else if (direction === 1) {
        if (samples[i].value >= samples[extremeIdx].value) {
          extremeIdx = i;
        } else if (samples[extremeIdx].value - samples[i].value >= minAmplitude) {
          extrema.push(samples[extremeIdx]);
          direction = -1;
          extremeIdx = i;
        }
      } else {
        if (samples[i].value <= samples[extremeIdx].value) {
          extremeIdx = i;
        } else if (samples[i].value - samples[extremeIdx].value >= minAmplitude) {
          extrema.push(samples[extremeIdx]);
          direction = 1;
          extremeIdx = i;
        }
      }
    }
    extrema.push(samples[extremeIdx]);
    return extrema;
  }

  // samples: [{t: ms, value: number}, ...] sorted by t ascending — the
  // primary tracked joint's position/angle across a recorded set.
  // minAmplitude: the smallest value swing that counts as a real rep
  // phase rather than jitter (caller picks this relative to the
  // joint's expected range for that exercise). Returns
  // [{ startT, midT, endT, rom, durationMs }, ...] — one entry per
  // full down-up (or up-down) cycle.
  function segmentReps(samples, minAmplitude) {
    var extrema = findExtrema(samples, minAmplitude);
    var reps = [];
    for (var i = 0; i + 2 < extrema.length; i += 2) {
      var start = extrema[i], mid = extrema[i + 1], end = extrema[i + 2];
      reps.push({
        startT: start.t,
        midT: mid.t,
        endT: end.t,
        rom: Math.abs(mid.value - start.value),
        durationMs: end.t - start.t
      });
    }
    return reps;
  }
```

- [ ] **Step 2: Add to the `api` export**

```js
    segmentReps: segmentReps
```

- [ ] **Step 3: Add tests**

Insert before the final `console.log` line:

```js
// segmentReps — a clean 2-rep signal (0 -> 10 -> 0 -> 10 -> 0) with a
// generous minAmplitude produces exactly 2 reps with the right ROM.
var cleanSamples = [
  { t: 0, value: 0 }, { t: 100, value: 5 }, { t: 200, value: 10 },
  { t: 300, value: 5 }, { t: 400, value: 0 },
  { t: 500, value: 5 }, { t: 600, value: 10 },
  { t: 700, value: 5 }, { t: 800, value: 0 }
];
var cleanReps = FCL.segmentReps(cleanSamples, 2);
assertEqual(cleanReps.length, 2, 'segmentReps: a clean 2-rep signal produces 2 reps');
assertClose(cleanReps[0].rom, 10, 0.01, 'segmentReps: rep 1 ROM matches the 0->10 swing');
assertClose(cleanReps[1].rom, 10, 0.01, 'segmentReps: rep 2 ROM matches the 0->10 swing');
assertEqual(cleanReps[0].durationMs, 400, 'segmentReps: rep 1 duration spans its full down-up cycle');

// segmentReps — small jitter below minAmplitude does not create phantom reps.
var jitterySamples = [
  { t: 0, value: 0 }, { t: 50, value: 0.3 }, { t: 100, value: 0.1 },
  { t: 150, value: 0.4 }, { t: 200, value: 0 }
];
assertEqual(FCL.segmentReps(jitterySamples, 2).length, 0, 'segmentReps: sub-threshold jitter produces no reps');

// segmentReps — a short rep (half the ROM of a normal one) is still
// captured as its own rep with the smaller ROM value, not merged away.
var unevenSamples = [
  { t: 0, value: 0 }, { t: 100, value: 10 }, { t: 200, value: 0 },
  { t: 300, value: 5 }, { t: 400, value: 0 }
];
var unevenReps = FCL.segmentReps(unevenSamples, 2);
assertEqual(unevenReps.length, 2, 'segmentReps: a full rep followed by a half rep still produces 2 reps');
assertClose(unevenReps[1].rom, 5, 0.01, 'segmentReps: the shorter second rep reports its own smaller ROM');
```

- [ ] **Step 4: Run and verify**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed (so far)`

- [ ] **Step 5: Commit**

```bash
git add form-coach-logic.js form-coach-logic.selfcheck.cjs
git commit -m "feat(form-coach): add segmentReps rep-boundary detection"
```

---

### Task 5: Per-rep scoring (`scoreReps`, `scoreStability`, `scoreSet`)

**Files:**
- Modify: `form-coach-logic.js`
- Modify: `form-coach-logic.selfcheck.cjs`

Scores each rep against the *set's own average* (per the design's scoring philosophy — no absolute "correct" ROM/tempo exists for a generic exercise).

- [ ] **Step 1: Add to `form-coach-logic.js`** (after `segmentReps`)

```js
  function round2(n) { return Math.round(n * 100) / 100; }

  // Scores each rep's ROM and tempo against the set's own average.
  // romFlagPct: a rep with ROM below this fraction of the set average
  // is flagged short (default 0.7 = 70%). tempoFlagRatio: a rep whose
  // duration is more than this many times the average, OR less than
  // 1/this-many times the average, is flagged as rushed or bounced
  // (default 1.5x either direction). Empty input returns [].
  function scoreReps(reps, romFlagPct, tempoFlagRatio) {
    romFlagPct = romFlagPct || 0.7;
    tempoFlagRatio = tempoFlagRatio || 1.5;
    if (!reps.length) return [];
    var avgRom = reps.reduce(function (s, r) { return s + r.rom; }, 0) / reps.length;
    var avgDuration = reps.reduce(function (s, r) { return s + r.durationMs; }, 0) / reps.length;
    return reps.map(function (r, idx) {
      var romPct = avgRom > 0 ? r.rom / avgRom : 1;
      var tempoRatio = avgDuration > 0 ? r.durationMs / avgDuration : 1;
      return {
        index: idx + 1,
        rom: round2(r.rom),
        romPct: round2(romPct),
        romFlag: romPct < romFlagPct,
        durationMs: r.durationMs,
        tempoRatio: round2(tempoRatio),
        tempoFlag: tempoRatio > tempoFlagRatio || tempoRatio < (1 / tempoFlagRatio)
      };
    });
  }

  // stabilitySamples: [{t: ms, jitter: number}, ...] — per-frame
  // magnitude of a stability landmark's (e.g. hip midpoint) frame-to-
  // frame movement, supplied by the caller. Flags a rep whose average
  // jitter during its [startT, endT] window is notably higher than
  // the set's average jitter (default: more than 1.5x).
  function scoreStability(stabilitySamples, reps, flagRatio) {
    flagRatio = flagRatio || 1.5;
    if (!reps.length) return [];
    if (!stabilitySamples.length) {
      return reps.map(function (_, idx) { return { index: idx + 1, avgJitter: null, stabilityFlag: false }; });
    }
    var perRepJitter = reps.map(function (r) {
      var inWindow = stabilitySamples.filter(function (s) { return s.t >= r.startT && s.t <= r.endT; });
      if (!inWindow.length) return 0;
      return inWindow.reduce(function (s, x) { return s + x.jitter; }, 0) / inWindow.length;
    });
    var avgAll = perRepJitter.reduce(function (s, v) { return s + v; }, 0) / perRepJitter.length;
    return perRepJitter.map(function (j, idx) {
      var ratio = avgAll > 0 ? j / avgAll : 1;
      return { index: idx + 1, avgJitter: round2(j), stabilityFlag: ratio > flagRatio };
    });
  }

  // Combines segmentReps + scoreReps + scoreStability into one
  // rep-by-rep result array: [{ index, rom, romPct, romFlag,
  // durationMs, tempoRatio, tempoFlag, avgJitter, stabilityFlag }, ...]
  function scoreSet(samples, stabilitySamples, minAmplitude) {
    var reps = segmentReps(samples, minAmplitude);
    var romTempo = scoreReps(reps);
    var stability = scoreStability(stabilitySamples, reps);
    return romTempo.map(function (r, idx) {
      return {
        index: r.index,
        rom: r.rom,
        romPct: r.romPct,
        romFlag: r.romFlag,
        durationMs: r.durationMs,
        tempoRatio: r.tempoRatio,
        tempoFlag: r.tempoFlag,
        avgJitter: stability[idx].avgJitter,
        stabilityFlag: stability[idx].stabilityFlag
      };
    });
  }
```

- [ ] **Step 2: Add to the `api` export**

```js
    scoreReps: scoreReps,
    scoreStability: scoreStability,
    scoreSet: scoreSet
```

- [ ] **Step 3: Add tests**

Insert before the final `console.log` line:

```js
// scoreReps — a clearly short rep (well under 70% of the set average
// ROM) is flagged; normal reps are not.
var repsForScoring = [
  { rom: 10, durationMs: 1000 },
  { rom: 10, durationMs: 1000 },
  { rom: 4, durationMs: 1000 }
];
var romScored = FCL.scoreReps(repsForScoring);
assertEqual(romScored[0].romFlag, false, 'scoreReps: a rep at the set average ROM is not flagged');
assertEqual(romScored[2].romFlag, true, 'scoreReps: a rep well under the set average ROM (4 vs ~8) is flagged short');

// scoreReps — a rushed rep (much faster than the set average) is
// flagged for tempo; a normal-speed rep is not.
var tempoReps = [
  { rom: 10, durationMs: 1000 },
  { rom: 10, durationMs: 1000 },
  { rom: 10, durationMs: 300 }
];
var tempoScored = FCL.scoreReps(tempoReps);
assertEqual(tempoScored[0].tempoFlag, false, 'scoreReps: a rep at the set average tempo is not flagged');
assertEqual(tempoScored[2].tempoFlag, true, 'scoreReps: a rep much faster than the set average is flagged for rushed tempo');

// scoreStability — a rep whose window has much higher jitter than the
// set average is flagged; calm reps are not.
var stabilityReps = [
  { startT: 0, endT: 100 },
  { startT: 100, endT: 200 },
  { startT: 200, endT: 300 }
];
var stabilitySamples = [
  { t: 50, jitter: 1 }, { t: 150, jitter: 1 }, { t: 250, jitter: 10 }
];
var stabilityScored = FCL.scoreStability(stabilitySamples, stabilityReps);
assertEqual(stabilityScored[0].stabilityFlag, false, 'scoreStability: a calm rep is not flagged');
assertEqual(stabilityScored[2].stabilityFlag, true, 'scoreStability: a rep with much higher jitter than the set average is flagged');

// scoreStability — no stability samples at all (e.g. tracker lost the
// stability landmark) degrades to unflagged rather than crashing.
var noStability = FCL.scoreStability([], stabilityReps);
assertEqual(noStability[0].stabilityFlag, false, 'scoreStability: missing stability samples degrades to unflagged, not a crash');
assertEqual(noStability[0].avgJitter, null, 'scoreStability: missing stability samples reports avgJitter null');

// scoreSet — end-to-end wiring: a 2-rep signal with one flagged-short
// rep produces one flagged entry in the final combined result.
var e2eSamples = [
  { t: 0, value: 0 }, { t: 100, value: 10 }, { t: 200, value: 0 },
  { t: 300, value: 3 }, { t: 400, value: 0 }
];
var e2eStability = [{ t: 50, jitter: 1 }, { t: 350, jitter: 1 }];
var e2eResult = FCL.scoreSet(e2eSamples, e2eStability, 2);
assertEqual(e2eResult.length, 2, 'scoreSet: end-to-end produces one entry per detected rep');
assertEqual(e2eResult[1].romFlag, true, 'scoreSet: end-to-end correctly flags the short second rep');

console.log('form-coach-logic.selfcheck.cjs: all assertions passed');
```

(This replaces the earlier `console.log('...all assertions passed (so far)')` line — there should be exactly one final `console.log`, at the very end of the file.)

- [ ] **Step 4: Run and verify**

Run: `node form-coach-logic.selfcheck.cjs`
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add form-coach-logic.js form-coach-logic.selfcheck.cjs
git commit -m "feat(form-coach): add scoreReps/scoreStability/scoreSet relative-to-average scoring"
```

---

### Task 6: `form-coach.html` page shell

**Files:**
- Create: `form-coach.html`

Page chrome only — header, mode segmented control (Posing Coach / Lift-Form Coach), the `gym-tabbar` nav (reusing the exact CSS block from `posing.html:159-191`), and placeholder sections for each mode. No camera yet.

- [ ] **Step 1: Create `form-coach.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0a0b">
<link rel="manifest" href="/manifest.json" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Row" />
<title>Form Coach — Row</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="topbar.js" defer></script>
<style>
:root {
  --bg: #000000;
  --bg-card: #111113;
  --text-1: #F4F1EA;
  --text-2: rgba(244,241,234,0.6);
  --text-3: rgba(244,241,234,0.4);
  --text-4: rgba(244,241,234,0.25);
  --border: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.16);
  --accent: #6ee7b7;
  --good: #6ee7b7;
  --warn: #fbbf24;
  --bad: #ff8a8a;
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SF Mono, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: radial-gradient(ellipse 80% 60% at 75% 0%, rgba(110,231,183,0.06) 0%, #0a0a0b 60%);
  color: var(--text-1);
  font-family: var(--font);
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
  min-height: 100vh;
  overflow-x: hidden;
}
.mob-shell {
  width: 100%; max-width: min(720px, 100vw);
  margin: 0 auto;
  padding: 24px 16px calc(120px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.mob-shell * { min-width: 0; }
.mob-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.mob-title { font-size: 22px; font-weight: 700; letter-spacing: -0.015em; margin: 0; }
.mob-subtitle { font-size: 12px; color: var(--text-3); margin: 2px 0 0; }
.mob-tabs { display: flex; gap: 6px; margin-bottom: 20px; overflow-x: auto; scrollbar-width: none; }
.mob-tabs::-webkit-scrollbar { display: none; }
.mob-tab-btn {
  flex-shrink: 0; padding: 8px 16px; border-radius: 999px;
  font-size: 13px; font-weight: 600; letter-spacing: 0.01em;
  color: var(--text-3); background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08); cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  -webkit-tap-highlight-color: transparent; font-family: inherit;
}
.mob-tab-btn:hover { color: var(--text-1); }
.mob-tab-btn.active { color: var(--text-1); background: rgba(110,231,183,0.10); border-color: rgba(110,231,183,0.30); }
.mob-section { display: none; }
.mob-section.active { display: block; }
.mob-card { background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; margin-bottom: 10px; }
.mob-card-body { font-size: 13px; color: var(--text-2); line-height: 1.55; }
.mob-card-body strong { color: var(--text-1); font-weight: 600; }
.mob-rule { background: rgba(110,231,183,0.06); border: 1px solid rgba(110,231,183,0.18); border-radius: 12px; padding: 12px 14px; font-size: 13px; color: var(--text-2); line-height: 1.5; margin-bottom: 16px; }
.mob-rule strong { color: var(--accent); }
.mob-divider { height: 1px; background: var(--border); margin: 20px 0; }

/* ── Camera + capture ── */
.fc-camera-wrap { position: relative; width: 100%; aspect-ratio: 3 / 4; background: #050506; border-radius: 16px; overflow: hidden; margin-bottom: 12px; }
.fc-camera-wrap video, .fc-camera-wrap canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.fc-camera-wrap canvas { pointer-events: none; }
.fc-hold-ring { position: absolute; top: 12px; right: 12px; width: 44px; height: 44px; }
.fc-hold-ring circle { fill: none; stroke-width: 4; }
.fc-hold-ring .bg { stroke: rgba(255,255,255,0.15); }
.fc-hold-ring .fg { stroke: var(--accent); stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 0.1s linear; }
.fc-status-banner { position: absolute; left: 12px; right: 12px; bottom: 12px; padding: 8px 12px; border-radius: 10px; background: rgba(0,0,0,0.65); font-size: 12px; color: var(--text-2); text-align: center; }
.fc-status-banner.warn { color: var(--warn); }
.fc-status-banner.bad { color: var(--bad); }
.fc-compare { display: flex; gap: 8px; margin-bottom: 12px; }
.fc-compare > div { flex: 1; }
.fc-compare img, .fc-compare canvas { width: 100%; border-radius: 10px; display: block; }
.fc-compare .fc-compare-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); margin-bottom: 4px; }
.fc-pose-picker { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 12px; scrollbar-width: none; }
.fc-pose-picker::-webkit-scrollbar { display: none; }
.fc-pose-chip { flex-shrink: 0; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--text-2); background: rgba(255,255,255,0.04); border: 1px solid var(--border); cursor: pointer; -webkit-tap-highlight-color: transparent; font-family: inherit; }
.fc-pose-chip.active { color: var(--text-1); background: rgba(110,231,183,0.10); border-color: rgba(110,231,183,0.30); }
.fc-symmetry-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
.fc-symmetry-row:last-child { border-bottom: none; }
.fc-rep-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
.fc-rep-row:last-child { border-bottom: none; }
.fc-rep-flag { font-size: 11px; padding: 3px 8px; border-radius: 999px; background: rgba(255,138,138,0.12); color: var(--bad); }
.fc-btn { width: 100%; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: inherit; border: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.fc-btn-primary { background: var(--accent); color: #04150e; }
.fc-btn-secondary { background: rgba(255,255,255,0.06); color: var(--text-1); border: 1px solid var(--border); }
.fc-input { width: 100%; padding: 12px 14px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: var(--text-1); font-family: inherit; font-size: 14px; margin-bottom: 12px; }

/* ── Gym tab bar (same as gym.html/posing.html) ── */
.gym-tabbar { position: fixed; left: 0; right: 0; bottom: calc(72px + env(safe-area-inset-bottom)); z-index: 60; display: flex; justify-content: center; padding: 10px max(16px, env(safe-area-inset-right)) 10px max(16px, env(safe-area-inset-left)); background: linear-gradient(180deg, rgba(5,5,6,0) 0%, rgba(5,5,6,0.82) 40%, rgba(5,5,6,0.96) 100%); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); pointer-events: none; }
.gym-tabbar-inner { pointer-events: auto; display: flex; width: 100%; max-width: 400px; gap: 6px; padding: 6px; background: rgba(20,20,22,0.72); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; box-shadow: 0 12px 36px rgba(0,0,0,0.55); }
.gym-tab { flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 14px; border-radius: 13px; font-size: 14px; font-weight: 600; letter-spacing: 0.01em; color: var(--text-3); background: transparent; border: 1px solid transparent; cursor: pointer; text-decoration: none; transition: color 0.15s, background 0.15s, border-color 0.15s; -webkit-tap-highlight-color: transparent; font-family: var(--font); }
.gym-tab:hover { color: var(--text-1); }
.gym-tab.active { color: var(--text-1); background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.10); }
@media (max-width: 400px) { .gym-tab { padding: 11px 10px; font-size: 13px; } }
</style>
</head>
<body>
<div class="mob-shell">
  <div class="mob-header">
    <div>
      <h1 class="mob-title">Form Coach</h1>
      <div class="mob-subtitle">Camera-based posing and lift feedback</div>
    </div>
  </div>

  <div class="mob-tabs">
    <button class="mob-tab-btn active" data-section="posing" type="button">Posing Coach</button>
    <button class="mob-tab-btn" data-section="lift" type="button">Lift-Form Coach</button>
  </div>

  <div class="mob-section active" id="section-posing">
    <div class="mob-rule"><strong>How it works:</strong> pick a pose, hold it steady for ~1.5s and the camera auto-captures a still to compare against the reference photo.</div>
    <div class="mob-card"><div class="mob-card-body">Posing Coach camera UI goes here (Task 8).</div></div>
  </div>

  <div class="mob-section" id="section-lift">
    <div class="mob-rule"><strong>How it works:</strong> name the exercise, record a set, get a rep-by-rep readout of ROM/tempo/stability scored against your own average for that set.</div>
    <div class="mob-card"><div class="mob-card-body">Lift-Form Coach camera UI goes here (Task 9).</div></div>
  </div>
</div>

<nav class="gym-tabbar">
  <div class="gym-tabbar-inner">
    <a class="gym-tab" href="gym.html">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor"/><rect x="2" y="7" width="8" height="2" rx="1" fill="currentColor"/><rect x="2" y="11" width="10" height="2" rx="1" fill="currentColor"/></svg>
      Fitness
    </a>
    <a class="gym-tab" href="posing.html">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="2.5" r="1.5" fill="currentColor"/><path d="M8 4v4M8 8l-2-3M6 5l-1.5-.5M8 8l2-3M10 5l1.5-.5M8 8l-1.5 5M8 8l1.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      Posing
    </a>
    <a class="gym-tab active" href="form-coach.html">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="8" cy="6.5" r="1.6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M2 13h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      Form Coach
    </a>
  </div>
</nav>

<script src="form-coach-logic.js"></script>
<script>
(function () {
  var tabs = document.querySelectorAll('.mob-tab-btn');
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.mob-section').forEach(function (s) { s.classList.remove('active'); });
      document.getElementById('section-' + btn.dataset.section).classList.add('active');
    });
  });
})();
</script>
</body>
</html>
```

Note: the `gym-tabbar` here has 3 entries (Fitness / Posing / Form Coach) instead of the 4-entry version other pages may already show after the parallel hands-free-logging session's edits — that's fine, this file is self-contained and doesn't depend on `gym.html`'s current tab-bar markup.

- [ ] **Step 2: Verify the page loads with no console errors**

Live-verify in the Browser pane (see Task 10) rather than a unit test — this step is pure static markup, nothing to run via `node`.

- [ ] **Step 3: Commit**

```bash
git add form-coach.html
git commit -m "feat(form-coach): add page shell with mode tabs and nav entry"
```

---

### Task 7: Camera + MediaPipe Pose Landmarker wiring

**Files:**
- Modify: `form-coach.html`

Loads `@mediapipe/tasks-vision` from CDN as an ES module, requests camera access, and runs the Pose Landmarker on a throttled interval. Exposes a small shared object (`FormCoachCamera`) that both mode-specific scripts (Tasks 8 and 9) read from — this task only wires the camera and detection loop, not either mode's UI logic.

- [ ] **Step 1: Add a `<video>`/`<canvas>` pair and status banner to the Posing Coach section**

Replace the Posing Coach section's placeholder card in `form-coach.html`:

```html
  <div class="mob-section active" id="section-posing">
    <div class="mob-rule"><strong>How it works:</strong> pick a pose, hold it steady for ~1.5s and the camera auto-captures a still to compare against the reference photo.</div>

    <div class="fc-pose-picker" id="posePicker"></div>

    <div class="fc-camera-wrap" id="posingCameraWrap">
      <video id="posingVideo" autoplay playsinline muted></video>
      <svg class="fc-hold-ring" id="holdRing" viewBox="0 0 44 44">
        <circle class="bg" cx="22" cy="22" r="18"></circle>
        <circle class="fg" cx="22" cy="22" r="18" stroke-dasharray="113" stroke-dashoffset="113"></circle>
      </svg>
      <div class="fc-status-banner" id="posingStatus">Requesting camera…</div>
    </div>

    <div id="posingResult"></div>
  </div>
```

- [ ] **Step 2: Add the MediaPipe module script before the existing tab-switching script**

Insert into `form-coach.html`, after `<script src="form-coach-logic.js"></script>` and before the existing inline `<script>` block:

```html
<script type="module">
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

var FormCoachCamera = {
  landmarker: null,
  stream: null,
  ready: false,
  error: null
};
window.FormCoachCamera = FormCoachCamera;

async function initCamera(videoEl, statusEl) {
  try {
    var vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    FormCoachCamera.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1
    });
  } catch (err) {
    FormCoachCamera.error = 'model-load-failed';
    if (statusEl) { statusEl.textContent = 'Pose detection failed to load — check your connection and reload.'; statusEl.classList.add('bad'); }
    return false;
  }

  try {
    FormCoachCamera.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch (err) {
    FormCoachCamera.error = 'camera-denied';
    if (statusEl) { statusEl.textContent = 'Camera access denied. Allow camera access in your browser settings, then reload.'; statusEl.classList.add('bad'); }
    return false;
  }

  videoEl.srcObject = FormCoachCamera.stream;
  await new Promise(function (resolve) { videoEl.onloadedmetadata = resolve; });
  FormCoachCamera.ready = true;
  if (statusEl) { statusEl.textContent = ''; statusEl.classList.remove('bad', 'warn'); }
  return true;
}

// Runs the pose landmarker against one video element on a throttled
// interval and calls onResult(landmarks|null, timestampMs) each time.
// landmarks is null when no person is detected in frame — callers
// must handle that (show a "step back" message), not assume a result.
function startDetectionLoop(videoEl, onResult, intervalMs) {
  var lastRun = 0;
  function tick(nowMs) {
    if (FormCoachCamera.ready && FormCoachCamera.landmarker && nowMs - lastRun >= intervalMs) {
      lastRun = nowMs;
      var result = FormCoachCamera.landmarker.detectForVideo(videoEl, performance.now());
      var landmarks = (result.landmarks && result.landmarks.length) ? result.landmarks[0] : null;
      onResult(landmarks, nowMs);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

window.FormCoachCamera.initCamera = initCamera;
window.FormCoachCamera.startDetectionLoop = startDetectionLoop;
window.dispatchEvent(new Event('form-coach-camera-ready'));
</script>
```

`@mediapipe/tasks-vision`'s `getUserMedia`/WASM support requirement is met by iPhone Safari (Carl's actual gym phone) — no unsupported-browser fallback code needed beyond the existing try/catch error paths above, which already degrade to a clear on-screen message instead of a silent failure or crash.

- [ ] **Step 3: Verify no console errors and the status banner clears once camera access is granted**

Live-verify in the Browser pane (Task 10) — this step depends on `getUserMedia`, which isn't available under `node`.

- [ ] **Step 4: Commit**

```bash
git add form-coach.html
git commit -m "feat(form-coach): wire camera + MediaPipe Pose Landmarker detection loop"
```

---

### Task 8: Posing Coach mode — pose picker, hold-detect, freeze-and-compare

**Files:**
- Modify: `form-coach.html`

Wires `form-coach-logic.js`'s `POSE_CONFIGS`/`trackedAngles`/`updateHoldTracker`/`computeSymmetry` to the camera loop from Task 7. Reuses `posing.html`'s reference photos at `assets/mobility/<slug>.png`.

- [ ] **Step 1: Add the Posing Coach mode script**

Insert into `form-coach.html`, inside the existing final inline `<script>` block (the one with the tab-switching logic), replacing its closing `})();` with the code below appended before it — or as its own `<script>` block placed immediately after the tab-switching script:

```html
<script>
(function () {
  var POSE_SLUGS = Object.keys(window.FormCoachLogic.POSE_CONFIGS);
  var activeSlug = POSE_SLUGS[0];
  var holdTracker = window.FormCoachLogic.createHoldTracker();
  var HOLD_TOLERANCE_DEG = 6;
  var HOLD_DURATION_MS = 1500;
  var frozen = false;

  var picker = document.getElementById('posePicker');
  POSE_SLUGS.forEach(function (slug) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'fc-pose-chip' + (slug === activeSlug ? ' active' : '');
    chip.textContent = window.FormCoachLogic.POSE_CONFIGS[slug].label;
    chip.dataset.slug = slug;
    chip.addEventListener('click', function () {
      activeSlug = slug;
      holdTracker = window.FormCoachLogic.createHoldTracker();
      frozen = false;
      document.querySelectorAll('.fc-pose-chip').forEach(function (c) { c.classList.toggle('active', c.dataset.slug === activeSlug); });
      document.getElementById('posingResult').innerHTML = '';
    });
    picker.appendChild(chip);
  });

  var video = document.getElementById('posingVideo');
  var statusEl = document.getElementById('posingStatus');
  var ring = document.querySelector('#holdRing .fg');
  var RING_CIRCUMFERENCE = 113;

  function renderSymmetry(symmetry) {
    if (!symmetry.length) return '<div class="mob-card-body">No side-to-side comparison for this pose — hold time confirmed above.</div>';
    return symmetry.map(function (s) {
      if (s.diffDeg === null) return '<div class="fc-symmetry-row"><span>' + s.joint + '</span><span>Not fully visible</span></div>';
      var side = s.diffDeg > 0 ? 'left higher' : (s.diffDeg < 0 ? 'right higher' : 'even');
      return '<div class="fc-symmetry-row"><span>' + s.joint + '</span><span>' + Math.abs(s.diffDeg) + '&deg; ' + side + '</span></div>';
    }).join('');
  }

  function captureFreeze(holdMs) {
    frozen = true;
    var canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    var symmetry = window.FormCoachLogic.computeSymmetry(lastLandmarks, activeSlug);
    document.getElementById('posingResult').innerHTML =
      '<div class="fc-compare">' +
        '<div><div class="fc-compare-label">You</div></div>' +
        '<div><div class="fc-compare-label">Reference</div><img src="assets/mobility/' + activeSlug + '.png" alt=""></div>' +
      '</div>' +
      '<div class="mob-card"><div class="mob-card-body"><strong>Held ' + (holdMs / 1000).toFixed(1) + 's</strong></div></div>' +
      '<div class="mob-card">' + renderSymmetry(symmetry) + '</div>' +
      '<button class="fc-btn fc-btn-secondary" id="tryAgainBtn" type="button">Try Again</button>';
    document.querySelector('.fc-compare > div:first-child').appendChild(canvas);
    document.getElementById('tryAgainBtn').addEventListener('click', function () {
      frozen = false;
      holdTracker = window.FormCoachLogic.createHoldTracker();
      document.getElementById('posingResult').innerHTML = '';
    });
  }

  var lastLandmarks = null;

  window.addEventListener('form-coach-camera-ready', function () {
    window.FormCoachCamera.initCamera(video, statusEl).then(function (ok) {
      if (!ok) return;
      window.FormCoachCamera.startDetectionLoop(video, function (landmarks, nowMs) {
        if (frozen) return;
        lastLandmarks = landmarks;
        if (!landmarks) {
          statusEl.textContent = 'Step back so your full body is visible';
          statusEl.classList.add('warn');
          holdTracker = window.FormCoachLogic.createHoldTracker();
          ring.style.strokeDashoffset = RING_CIRCUMFERENCE;
          return;
        }
        statusEl.textContent = '';
        statusEl.classList.remove('warn');
        var tracked = window.FormCoachLogic.trackedAngles(landmarks, activeSlug);
        var step = window.FormCoachLogic.updateHoldTracker(holdTracker, tracked.values, nowMs, HOLD_TOLERANCE_DEG, HOLD_DURATION_MS);
        holdTracker = step.tracker;
        var progress = Math.min(1, step.elapsedMs / HOLD_DURATION_MS);
        ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
        if (step.ready) captureFreeze(step.elapsedMs);
      }, 120);
    });
  });
})();
</script>
```

- [ ] **Step 2: Verify live in the Browser pane**

Deferred to Task 10's full verification pass (needs the Lift-Form mode built too, so both get checked in one pass).

- [ ] **Step 3: Commit**

```bash
git add form-coach.html
git commit -m "feat(form-coach): wire Posing Coach mode — hold-detect, freeze, symmetry readout"
```

---

### Task 9: Lift-Form Coach mode — record set, rep-by-rep scoring

**Files:**
- Modify: `form-coach.html`

Buffers the landmark stream during a "Record Set" window, picks the highest-range tracked point as the primary rep-segmentation axis, and renders `form-coach-logic.js`'s `scoreSet` output.

- [ ] **Step 1: Replace the Lift-Form Coach section's placeholder card**

```html
  <div class="mob-section" id="section-lift">
    <div class="mob-rule"><strong>How it works:</strong> name the exercise, record a set, get a rep-by-rep readout of ROM/tempo/stability scored against your own average for that set.</div>

    <input class="fc-input" id="liftExerciseName" type="text" placeholder="Exercise name (e.g. Hack Squat)">

    <div class="fc-camera-wrap" id="liftCameraWrap">
      <video id="liftVideo" autoplay playsinline muted></video>
      <div class="fc-status-banner" id="liftStatus">Requesting camera…</div>
    </div>

    <button class="fc-btn fc-btn-primary" id="recordSetBtn" type="button">Record Set</button>
    <div id="liftResult"></div>
  </div>
```

- [ ] **Step 2: Add the Lift-Form Coach mode script**

Insert as its own `<script>` block, immediately after Task 8's Posing Coach script block:

```html
<script>
(function () {
  var video = document.getElementById('liftVideo');
  var statusEl = document.getElementById('liftStatus');
  var recordBtn = document.getElementById('recordSetBtn');
  var resultEl = document.getElementById('liftResult');
  var recording = false;
  var buffer = []; // [{ t, landmarks }]
  var lastLandmarks = null;
  var cameraStarted = false;
  var LIFT_LANDMARK = window.FormCoachLogic.LANDMARK;

  function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // Picks the tracked point with the greatest y-range across the
  // buffered recording as the primary rep-segmentation axis — a
  // wrist for a press pattern, a hip for a squat pattern, etc.,
  // without needing to know the exercise in advance.
  function buildPrimarySignal(frames) {
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

  function buildStabilitySamples(frames) {
    var out = [];
    for (var i = 1; i < frames.length; i++) {
      var prevHip = midpoint(frames[i - 1].landmarks[LIFT_LANDMARK.L_HIP], frames[i - 1].landmarks[LIFT_LANDMARK.R_HIP]);
      var currHip = midpoint(frames[i].landmarks[LIFT_LANDMARK.L_HIP], frames[i].landmarks[LIFT_LANDMARK.R_HIP]);
      var dx = currHip.x - prevHip.x, dy = currHip.y - prevHip.y;
      out.push({ t: frames[i].t, jitter: Math.sqrt(dx * dx + dy * dy) });
    }
    return out;
  }

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
      return '<div class="fc-rep-row"><span>Rep ' + r.index + ' — ' + Math.round(r.romPct * 100) + '% ROM</span><span>' + (flags.join(' ') || 'Good') + '</span></div>';
    }).join('');
    resultEl.innerHTML = '<div class="mob-card"><div class="mob-card-body"><strong>' + (exerciseName || 'Set') + '</strong> — ' + scored.length + ' reps</div></div><div class="mob-card">' + rows + '</div>';
  }

  window.addEventListener('form-coach-camera-ready', function () {
    // Reuses the same camera stream Task 8 requested — only one
    // getUserMedia prompt for the whole page. If Posing Coach hasn't
    // initialized yet (e.g. Carl opens directly on the Lift-Form tab),
    // initCamera() is safe to call again; it re-requests the stream.
    window.FormCoachCamera.initCamera(video, statusEl).then(function (ok) {
      cameraStarted = ok;
      if (!ok) return;
      window.FormCoachCamera.startDetectionLoop(video, function (landmarks, nowMs) {
        lastLandmarks = landmarks;
        if (recording && landmarks) buffer.push({ t: nowMs, landmarks: landmarks });
      }, 100);
    });
  });

  recordBtn.addEventListener('click', function () {
    if (!cameraStarted) return;
    if (!recording) {
      recording = true;
      buffer = [];
      resultEl.innerHTML = '';
      recordBtn.textContent = 'Stop Recording';
      recordBtn.className = 'fc-btn fc-btn-secondary';
    } else {
      recording = false;
      recordBtn.textContent = 'Record Set';
      recordBtn.className = 'fc-btn fc-btn-primary';
      if (buffer.length < 10) {
        resultEl.innerHTML = '<div class="mob-card"><div class="mob-card-body">Recording too short — try a longer set.</div></div>';
        return;
      }
      var primary = buildPrimarySignal(buffer);
      var stabilitySamples = buildStabilitySamples(buffer);
      var minAmplitude = primary.range * 0.15; // 15% of the set's own observed range filters jitter without hiding a real short rep
      var scored = window.FormCoachLogic.scoreSet(primary.samples, stabilitySamples, minAmplitude);
      renderResult(scored, document.getElementById('liftExerciseName').value.trim());
    }
  });
})();
</script>
```

- [ ] **Step 3: Verify no console errors on page load** (full functional verification happens in Task 10)

- [ ] **Step 4: Commit**

```bash
git add form-coach.html
git commit -m "feat(form-coach): wire Lift-Form Coach mode — record, segment, score against set average"
```

---

### Task 10: Error-state polish + live verification

**Files:**
- Modify: `form-coach.html` (only if verification surfaces a real bug)

- [ ] **Step 1: Start the Row dev server / open the page and grant camera access**

Use `preview_start` (per this session's standing verification rule) to open `form-coach.html` in the Browser pane. Grant camera permission when prompted.

- [ ] **Step 2: Verify Posing Coach end-to-end**

- Pose picker shows all 7 poses from `posing.html`'s Competition gallery.
- Camera feed renders, status banner clears once loaded.
- Hold a stable position (or have Carl hold a real pose) for ~1.5s → freeze triggers, captured still + reference photo render side by side.
- Switch to a side pose (`side-chest`) → confirm the symmetry card shows the "no side-to-side comparison" message instead of a broken/empty readout.
- "Try Again" re-arms the camera correctly.
- Cover the camera / step out of frame → status banner shows "Step back so your full body is visible," no crash.

- [ ] **Step 3: Verify Lift-Form Coach end-to-end**

- Type an exercise name, tap Record Set, perform a few reps in frame (or simulate motion), tap Stop Recording.
- Rep-by-rep readout renders with plausible ROM percentages.
- Deliberately do one short/rushed rep → confirm it gets flagged while normal reps don't.
- Record fewer than ~10 frames (tap Record then Stop immediately) → confirm the "recording too short" message shows, not a crash.

- [ ] **Step 4: Check `read_console_messages` for any errors across both modes**

Fix any real issues found (edit `form-coach.html` or `form-coach-logic.js` as needed), re-verify, then proceed.

- [ ] **Step 5: Commit any fixes found during verification**

```bash
git add form-coach.html form-coach-logic.js
git commit -m "fix(form-coach): address issues found during live verification"
```

(Skip this step entirely if verification found nothing to fix.)

---

### Task 11: Nav link from `posing.html` into the new page

**Files:**
- Modify: `posing.html:542-558` (the `gym-tabbar` block)

The one deliberately-deferred touch to an existing file — done last, after everything above is verified working, and easy to skip/postpone if `gym.html`'s parallel session is still actively mid-edit (this only touches `posing.html`, not `gym.html`).

- [ ] **Step 1: Check `gym.html`'s current tab-bar state before editing**

```bash
git -C C:/Users/gregm/row fetch origin
git -C C:/Users/gregm/row log --oneline -3 origin/main -- gym.html
```

If the hands-free-logging session has pushed more commits touching `gym.html` since this plan started, that's fine — this step only reads `posing.html`, which is a different file.

- [ ] **Step 2: Add a 4th tab to `posing.html`'s `gym-tabbar`**

In `posing.html`, replace:

```html
    <a class="gym-tab active" href="posing.html">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="2.5" r="1.5" fill="currentColor"/><path d="M8 4v4M8 8l-2-3M6 5l-1.5-.5M8 8l2-3M10 5l1.5-.5M8 8l-1.5 5M8 8l1.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      Posing
    </a>
  </div>
</nav>
```

with:

```html
    <a class="gym-tab active" href="posing.html">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="2.5" r="1.5" fill="currentColor"/><path d="M8 4v4M8 8l-2-3M6 5l-1.5-.5M8 8l2-3M10 5l1.5-.5M8 8l-1.5 5M8 8l1.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      Posing
    </a>
    <a class="gym-tab" href="form-coach.html">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="8" cy="6.5" r="1.6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M2 13h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      Form Coach
    </a>
  </div>
</nav>
```

- [ ] **Step 3: Live-verify the new tab appears and links correctly**

Reload `posing.html` in the Browser pane, confirm the 4th tab renders and navigates to `form-coach.html`.

- [ ] **Step 4: Commit and push**

```bash
git add posing.html
git commit -m "feat(posing): add Form Coach nav entry"
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** every scope decision from the design doc has a task — freeze-and-compare (Task 8), all 7 Competition poses (Task 2/8), symmetry readout with side poses correctly excluded (Task 2/8), generic ROM/tempo/stability lift scoring relative to set average (Task 5/9), record-then-review capture mode (Task 7/9), zero edits to `gym.html` (Task 6-9 create new files only; Task 11 touches `posing.html` only), no persistence (no Supabase code anywhere in this plan), error handling (Task 7's try/catch paths, Task 10's verification).
- **Placeholder scan:** no TBD/TODO markers; every code step has complete, real code.
- **Type consistency:** `trackedAngles` returns `{values, byName}` consistently across Tasks 2/3/8; `scoreSet`'s output shape (`index, rom, romPct, romFlag, durationMs, tempoRatio, tempoFlag, avgJitter, stabilityFlag`) matches what Task 9's `renderResult` reads.
