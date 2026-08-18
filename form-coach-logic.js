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

  // Shapes a completed session's result into the record format written to
  // the 'row:form-coach-history' app_state key (see form-coach.html). Pure
  // — just stamps a timestamp and wraps the caller's already-computed
  // result (computeSymmetry's or scoreSet's output) rather than reshaping
  // it, so this stays a thin adapter, not a second source of truth for
  // field names. nowIso is injectable for testing; defaults to real time.
  function buildHistoryRecord(type, data, nowIso) {
    var timestamp = nowIso || new Date().toISOString();
    if (type === 'posing') {
      var record = { type: 'posing', timestamp: timestamp, pose: data.pose, holdTimeMs: data.holdTimeMs, symmetry: data.symmetry };
      if (data.poseCritique) record.poseCritique = data.poseCritique;
      return record;
    }
    if (type === 'lift') {
      var liftRecord = { type: 'lift', timestamp: timestamp, exercise: data.exercise, reps: data.reps };
      if (data.liftCritique) liftRecord.liftCritique = data.liftCritique;
      return liftRecord;
    }
    return null;
  }

  var api = {
    angleDeg: angleDeg,
    LANDMARK: LANDMARK,
    ANGLE_TRIPLES: ANGLE_TRIPLES,
    bilateralAngle: bilateralAngle,
    matchBenchmark: matchBenchmark,
    POSE_CONFIGS: POSE_CONFIGS,
    trackedAngles: trackedAngles,
    computeSymmetry: computeSymmetry,
    createHoldTracker: createHoldTracker,
    updateHoldTracker: updateHoldTracker,
    segmentReps: segmentReps,
    scoreReps: scoreReps,
    scoreStability: scoreStability,
    scoreSet: scoreSet,
    buildHistoryRecord: buildHistoryRecord
  };
  if (typeof window !== 'undefined') window.FormCoachLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
