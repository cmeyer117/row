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
