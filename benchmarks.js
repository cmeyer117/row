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
    { names: ['leg press', 'cybex leg press', 'sissy leg press'], jointAngle: 'knee', depthDirection: 'min', targetAngleDeg: 90, cueLabel: 'knee flexion depth' },
    { names: ['bulgarian split squat', 'split squat', 'lunge', 'dumbbell heel elevated lunge'], jointAngle: 'knee', depthDirection: 'min', targetAngleDeg: 100, cueLabel: 'front knee flexion depth' },
    // Chest dip and close-grip/narrow-grip bench variants are elbow-lockout
    // pressing patterns like the rest of this family, not a distinct
    // movement pattern -- grouped here rather than a new entry.
    { names: ['bench press', 'bench', 'dumbbell bench', 'incline bench', 'chest dip', 'dumbbell incline chest press', 'smith machine flat chest press', 'smith machine narrow grip bench'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'elbow lockout' },
    { names: ['overhead press', 'shoulder press', 'ohp', 'neutral grip shoulder press machine'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'elbow lockout' },
    { names: ['tricep extension', 'skull crusher', 'pushdown', 'cable triceps overhead extension', 'cable triceps pushdown'], jointAngle: 'elbow', depthDirection: 'max', targetAngleDeg: 170, cueLabel: 'elbow lockout' },
    { names: ['bicep curl', 'curl', 'hammer curl', 'machine preacher curl', 'seated behind the back cable curl'], jointAngle: 'elbow', depthDirection: 'min', targetAngleDeg: 50, cueLabel: 'top-of-curl flexion' },
    { names: ['deadlift', 'romanian deadlift', 'rdl', 'stiff leg deadlift', 'dumbbell b stance rdl', 'smith machine rdl'], jointAngle: 'hip', depthDirection: 'max', targetAngleDeg: 165, cueLabel: 'hip lockout' },
    { names: ['hip thrust', 'glute bridge'], jointAngle: 'hip', depthDirection: 'max', targetAngleDeg: 170, cueLabel: 'hip lockout' },
    { names: ['bent over row', 'barbell row', 't-bar row', 'chest supported t bar row', 'cable seated row neutral grip', 'machine high row', 'machine low row'], jointAngle: 'elbow', depthDirection: 'min', targetAngleDeg: 60, cueLabel: 'top-of-row elbow flexion' },
    { names: ['pulldown', 'lat pulldown', 'pull up', 'chin up', 'neutral grip lat pulldown', 'cable lat pushdown pullover'], jointAngle: 'elbow', depthDirection: 'min', targetAngleDeg: 55, cueLabel: 'bottom-of-pull elbow flexion' },
    { names: ['leg extension'], jointAngle: 'knee', depthDirection: 'max', targetAngleDeg: 170, cueLabel: 'knee lockout' },
    // Hamstring/leg curl -- same knee joint as squat/leg-extension, but an
    // isolated curl pattern (deep flexion is the target, not a lockout).
    { names: ['hamstring curl', 'leg curl', 'lying hamstrings curl', 'seated hamstrings curl'], jointAngle: 'knee', depthDirection: 'min', targetAngleDeg: 60, cueLabel: 'top-of-curl knee flexion' },
    { names: ['calf raise', 'seated calf raise', 'standing calf raise'], jointAngle: 'ankle', depthDirection: 'max', targetAngleDeg: 140, cueLabel: 'ankle plantarflexion' },
    { names: ['lateral raise', 'dumbbell lateral raise', 'cable lateral raise', 'front raise', 'dumbbell front raise', 'cable front raise'], jointAngle: 'shoulder_abduction', depthDirection: 'max', targetAngleDeg: 85, cueLabel: 'top-of-raise shoulder abduction' },
    { names: ['rear delt fly', 'reverse fly', 'cable rear delt fly'], jointAngle: 'shoulder_abduction', depthDirection: 'max', targetAngleDeg: 85, cueLabel: 'top-of-fly shoulder abduction' }
    // ponytail: hip adduction still has no entry -- current hip triple
    // only tracks sagittal flexion-extension, and a frontal-plane
    // adduction angle needs different plumbing than the fix above. Flagged
    // as a follow-up, not built here.
  ];
  if (typeof window !== 'undefined') window.EXERCISE_BENCHMARKS = EXERCISE_BENCHMARKS;
  if (typeof module !== 'undefined' && module.exports) module.exports = EXERCISE_BENCHMARKS;
})();
