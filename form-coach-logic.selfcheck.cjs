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

console.log('form-coach-logic.selfcheck.cjs: all assertions passed (so far)');
