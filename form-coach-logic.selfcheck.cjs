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

console.log('form-coach-logic.selfcheck.cjs: all assertions passed (so far)');
