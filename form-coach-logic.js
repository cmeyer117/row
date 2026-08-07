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

  var api = {
    angleDeg: angleDeg,
    LANDMARK: LANDMARK,
    POSE_CONFIGS: POSE_CONFIGS,
    trackedAngles: trackedAngles,
    computeSymmetry: computeSymmetry,
    createHoldTracker: createHoldTracker,
    updateHoldTracker: updateHoldTracker
  };
  if (typeof window !== 'undefined') window.FormCoachLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
