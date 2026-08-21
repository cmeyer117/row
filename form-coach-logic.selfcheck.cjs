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

// ANGLE_TRIPLES — a fixed map of real joint-angle triples, reusing LANDMARK indices.
assertEqual(FCL.ANGLE_TRIPLES.knee.l[1], FCL.LANDMARK.L_KNEE, 'ANGLE_TRIPLES: knee triple vertex is the knee landmark');
assertEqual(FCL.ANGLE_TRIPLES.elbow.l[1], FCL.LANDMARK.L_ELBOW, 'ANGLE_TRIPLES: elbow triple vertex is the elbow landmark');
assertEqual(FCL.ANGLE_TRIPLES.ankle.l[1], FCL.LANDMARK.L_ANKLE, 'ANGLE_TRIPLES: ankle triple vertex is the ankle landmark');
assertEqual(FCL.ANGLE_TRIPLES.ankle.l[2], FCL.LANDMARK.L_FOOT_INDEX, 'ANGLE_TRIPLES: ankle triple traces through the foot landmark (calf raise)');
assertEqual(FCL.ANGLE_TRIPLES.shoulder_abduction.l[1], FCL.LANDMARK.L_SHOULDER, 'ANGLE_TRIPLES: shoulder_abduction triple vertex is the shoulder landmark');

// bilateralAngle — a calf-raise-style ankle triple reads ~90deg when the
// foot is flat (knee straight above ankle, foot straight ahead).
var lmFlatFoot = blankLandmarks();
lmFlatFoot[FCL.LANDMARK.L_KNEE] = { x: 0, y: -1 };
lmFlatFoot[FCL.LANDMARK.L_ANKLE] = { x: 0, y: 0 };
lmFlatFoot[FCL.LANDMARK.L_FOOT_INDEX] = { x: 1, y: 0 };
lmFlatFoot[FCL.LANDMARK.R_KNEE] = { x: 2, y: -1 };
lmFlatFoot[FCL.LANDMARK.R_ANKLE] = { x: 2, y: 0 };
lmFlatFoot[FCL.LANDMARK.R_FOOT_INDEX] = { x: 3, y: 0 };
assertClose(FCL.bilateralAngle(lmFlatFoot, 'ankle'), 90, 0.01, 'bilateralAngle: ankle triple reads ~90deg for a flat foot');

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

// matchBenchmark — Codex review catch: a generic word shared by two
// DIFFERENT entries' names ("press" matches "bench press" and "overhead
// press" equally) must return null (ambiguous), not silently pick
// whichever entry happens to appear first in the array.
var pressBenchmarks = [
  { names: ['bench press', 'bench'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'bench lockout' },
  { names: ['overhead press', 'shoulder press'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'ohp lockout' }
];
assertEqual(FCL.matchBenchmark('press', pressBenchmarks), null, 'matchBenchmark: a generic term tied across two different entries returns null rather than guessing');
// A specific enough name still resolves cleanly despite the shared token.
assertEqual(FCL.matchBenchmark('bench press', pressBenchmarks).cueLabel, 'bench lockout', 'matchBenchmark: a specific full name still resolves even when a generic sub-token is shared');

// matchBenchmark — code review catch, 2026-08-20: a 1-2 letter token
// (e.g. "b" from "B-Stance") must not spuriously prefix-match an unrelated
// word (e.g. "bench") -- "Dumbbell B-Stance RDL" was matching the bench
// press entry instead of the RDL entry it actually belongs to.
var rdlVsBenchBenchmarks = [
  { names: ['bench press', 'bench'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'bench lockout' },
  { names: ['deadlift', 'rdl', 'romanian deadlift', 'dumbbell b stance rdl'], jointAngle: 'hip', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'hip lockout' }
];
assertEqual(FCL.matchBenchmark('dumbbell b stance rdl', rdlVsBenchBenchmarks).cueLabel, 'hip lockout', 'matchBenchmark: a short token like "b" does not spuriously prefix-match an unrelated benchmark name');

// EXERCISE_BENCHMARKS — loaded from benchmarks.js, matchBenchmark resolves real entries.
var fs2 = require('fs');
vm.runInContext(fs2.readFileSync(path.join(__dirname, 'benchmarks.js'), 'utf8'), sandbox);
var realBenchmarks = sandbox.window.EXERCISE_BENCHMARKS;
assertEqual(Array.isArray(realBenchmarks) && realBenchmarks.length >= 10, true, 'EXERCISE_BENCHMARKS: at least 10 curated entries exist');
var squatMatch = FCL.matchBenchmark('squat', realBenchmarks);
assertEqual(squatMatch.jointAngle, 'knee', 'EXERCISE_BENCHMARKS: squat entry tracks the knee joint');
var benchMatch = FCL.matchBenchmark('bench press', realBenchmarks);
assertEqual(benchMatch.jointAngle, 'elbow', 'EXERCISE_BENCHMARKS: bench press entry tracks the elbow joint');
var calfMatch = FCL.matchBenchmark('seated calf raise', realBenchmarks);
assertEqual(calfMatch.jointAngle, 'ankle', 'EXERCISE_BENCHMARKS: calf raise entry tracks the ankle joint');
var lateralMatch = FCL.matchBenchmark('dumbbell lateral raise', realBenchmarks);
assertEqual(lateralMatch.jointAngle, 'shoulder_abduction', 'EXERCISE_BENCHMARKS: lateral raise entry tracks shoulder abduction');
var rearDeltMatch = FCL.matchBenchmark('rear delt fly', realBenchmarks);
assertEqual(rearDeltMatch.jointAngle, 'shoulder_abduction', 'EXERCISE_BENCHMARKS: rear delt fly entry tracks shoulder abduction');

// EXERCISE_BENCHMARKS — item 2.4 additions (2026-08-21): newly-added
// lifts resolve, both exact and fuzzy, and existing entries are unchanged.
var pecFlyExact = FCL.matchBenchmark('incline cable pec fly', realBenchmarks);
assertEqual(pecFlyExact && pecFlyExact.jointAngle, 'shoulder_abduction', 'EXERCISE_BENCHMARKS: incline cable pec fly (exact) tracks shoulder abduction');
assertEqual(pecFlyExact && pecFlyExact.depthDirection, 'min', 'EXERCISE_BENCHMARKS: pec fly entry targets the top-of-squeeze (min direction), opposite of raise family');
var pecFlyFuzzy = FCL.matchBenchmark('pec dec fly', realBenchmarks);
assertEqual(pecFlyFuzzy && pecFlyFuzzy.cueLabel, 'top-of-fly chest squeeze', 'EXERCISE_BENCHMARKS: pec dec fly (sub name) fuzzy-resolves to the chest fly entry');
// A generic "fly" alone must not collide with rear delt fly's "reverse fly" name.
var rearDeltStillWorks = FCL.matchBenchmark('reverse fly', realBenchmarks);
assertEqual(rearDeltStillWorks && rearDeltStillWorks.cueLabel, 'top-of-fly shoulder abduction', 'EXERCISE_BENCHMARKS: rear delt fly still resolves correctly after the chest fly entry was added (no cross-entry collision)');

var goodMorningExact = FCL.matchBenchmark('v squat good morning', realBenchmarks);
assertEqual(goodMorningExact && goodMorningExact.cueLabel, 'hip lockout', 'EXERCISE_BENCHMARKS: "v squat good morning" resolves to the hip-hinge entry, not the squat (knee) entry, despite sharing the "squat" token');
var hipExtensionMatch = FCL.matchBenchmark('cable hip extension machine', realBenchmarks);
assertEqual(hipExtensionMatch && hipExtensionMatch.jointAngle, 'hip', 'EXERCISE_BENCHMARKS: cable hip extension machine resolves to the hip-hinge entry');
// Regression: the squat entry itself is unaffected by the good-morning names added to a different entry.
var squatStillWorks = FCL.matchBenchmark('squat', realBenchmarks);
assertEqual(squatStillWorks && squatStillWorks.jointAngle, 'knee', 'EXERCISE_BENCHMARKS: plain "squat" still resolves to the squat (knee) entry, not the hip-hinge entry');
// Regression: existing RDL names still resolve unchanged.
var rdlStillWorks = FCL.matchBenchmark('romanian deadlift', realBenchmarks);
assertEqual(rdlStillWorks && rdlStillWorks.cueLabel, 'hip lockout', 'EXERCISE_BENCHMARKS: "romanian deadlift" still resolves after the good-morning names were added to the same entry');

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

// segmentReps — now also reports midValue (the extremum's raw value),
// needed for depth/lockout scoring against a benchmark's target angle.
assertClose(cleanReps[0].midValue, 10, 0.01, 'segmentReps: rep 1 midValue is the extremum value (10)');

// phaseDurations — splits a rep's full duration into eccentric (start->mid)
// and concentric (mid->start) phases.
var phaseTest = FCL.phaseDurations({ startT: 0, midT: 300, endT: 400 });
assertEqual(phaseTest.eccentricMs, 300, 'phaseDurations: eccentric phase is start->mid');
assertEqual(phaseTest.concentricMs, 100, 'phaseDurations: concentric phase is mid->end');

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

// scoreSet — now includes eccentricMs/concentricMs per rep and totalTutMs
// for the set (sum of every rep's durationMs).
var e2eWithTut = FCL.scoreSet(e2eSamples, e2eStability, 2);
assertEqual(e2eWithTut[0].eccentricMs, 100, 'scoreSet: rep 1 eccentricMs matches its start->mid duration');
assertEqual(e2eWithTut[0].concentricMs, 100, 'scoreSet: rep 1 concentricMs matches its mid->end duration');
assertEqual(FCL.totalTutMs(e2eWithTut), e2eWithTut[0].durationMs + e2eWithTut[1].durationMs, 'totalTutMs: sums every rep\'s durationMs');

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

// scoreDepth — Codex review catch: for a 'max' benchmark, the real lockout
// can be at start/end rather than mid, depending on where recording began
// (e.g. bench press recorded starting from a locked-out rack position --
// the bottom of the rep is the mid extremum, lockout is start/end). A rep
// that DOES lock out (startValue/endValue near target) must not be scored
// depthMet:false just because midValue (the bottom) is far from target.
var lockoutAtEndsRep = { startValue: 172, midValue: 70, endValue: 172 };
assertEqual(FCL.scoreDepth(lockoutAtEndsRep, benchBenchmark).depthMet, true, 'scoreDepth: max-direction benchmark checks start/end too, not just midValue -- a real lockout at the rep boundaries is still detected');
assertEqual(FCL.scoreDepth(lockoutAtEndsRep, benchBenchmark).depthDeg, 172, 'scoreDepth: max-direction depthDeg reports the best (highest) of start/mid/end, not just mid');

// scoreDepth — same principle for 'min' direction: the real squat depth
// could land at start/end if recording began from the bottom position.
var deepAtEndsRep = { startValue: 92, midValue: 165, endValue: 92 };
assertEqual(FCL.scoreDepth(deepAtEndsRep, squatBenchmark).depthMet, true, 'scoreDepth: min-direction benchmark checks start/end too -- real depth at the rep boundaries is still detected');
assertEqual(FCL.scoreDepth(deepAtEndsRep, squatBenchmark).depthDeg, 92, 'scoreDepth: min-direction depthDeg reports the best (lowest) of start/mid/end');

// buildHistoryRecord — posing shape wraps caller data with a type tag and timestamp.
var posingRecord = FCL.buildHistoryRecord('posing', { pose: 'front-double-biceps', holdTimeMs: 1620, symmetry: symResult }, '2026-08-07T00:00:00.000Z');
assertEqual(posingRecord.type, 'posing', 'buildHistoryRecord: posing record has type "posing"');
assertEqual(posingRecord.pose, 'front-double-biceps', 'buildHistoryRecord: posing record carries the pose slug through');
assertEqual(posingRecord.holdTimeMs, 1620, 'buildHistoryRecord: posing record carries holdTimeMs through');
assertEqual(posingRecord.symmetry, symResult, 'buildHistoryRecord: posing record carries the symmetry array through unmodified');
assertEqual(posingRecord.timestamp, '2026-08-07T00:00:00.000Z', 'buildHistoryRecord: uses the injected timestamp when provided');

// buildHistoryRecord — posing shape carries an optional poseCritique through when present.
var withCritique = FCL.buildHistoryRecord('posing', { pose: 'front-double-biceps', holdTimeMs: 1620, symmetry: symResult, poseCritique: { pose: 'Front Double Biceps', critique: 'Lock your lats down harder.' } }, '2026-08-07T00:00:00.000Z');
assertEqual(withCritique.poseCritique.critique, 'Lock your lats down harder.', 'buildHistoryRecord: posing record carries poseCritique through when provided');

// buildHistoryRecord — posing shape omits poseCritique (not a null placeholder) when absent, matching the existing fields' behavior.
assertEqual('poseCritique' in posingRecord, false, 'buildHistoryRecord: posing record has no poseCritique key when the caller did not provide one');

// buildHistoryRecord — lift shape wraps caller data the same way.
var liftRecord = FCL.buildHistoryRecord('lift', { exercise: 'Hack Squat', reps: e2eResult }, '2026-08-07T00:00:00.000Z');
assertEqual(liftRecord.type, 'lift', 'buildHistoryRecord: lift record has type "lift"');
assertEqual(liftRecord.exercise, 'Hack Squat', 'buildHistoryRecord: lift record carries the exercise name through');
assertEqual(liftRecord.reps, e2eResult, 'buildHistoryRecord: lift record carries the scored reps array through unmodified');

// buildHistoryRecord — lift shape carries an optional liftCritique through when present.
var liftWithCritique = FCL.buildHistoryRecord('lift', { exercise: 'Hack Squat', reps: e2eResult, liftCritique: { critique: 'Slow the eccentric down.' } }, '2026-08-07T00:00:00.000Z');
assertEqual(liftWithCritique.liftCritique.critique, 'Slow the eccentric down.', 'buildHistoryRecord: lift record carries liftCritique through when provided');

// buildHistoryRecord — lift shape omits liftCritique when absent.
assertEqual('liftCritique' in liftRecord, false, 'buildHistoryRecord: lift record has no liftCritique key when the caller did not provide one');

// buildHistoryRecord — an unknown type returns null rather than a malformed record.
assertEqual(FCL.buildHistoryRecord('bogus', {}), null, 'buildHistoryRecord: an unrecognized type returns null');

// buildHistoryRecord — omitting nowIso falls back to a real ISO timestamp, not undefined.
var autoStamped = FCL.buildHistoryRecord('posing', { pose: 'side-chest', holdTimeMs: 1500, symmetry: [] });
assertEqual(typeof autoStamped.timestamp, 'string', 'buildHistoryRecord: timestamp defaults to a real ISO string when not injected');

console.log('form-coach-logic.selfcheck.cjs: all assertions passed');
