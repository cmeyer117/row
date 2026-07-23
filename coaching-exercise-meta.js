// coaching-exercise-meta.js — exercise name -> {repMin, repMax, step, bw}
// lookup for coaching-log.html/coaching-plan.html's getRx() calls. Values
// for every name below are copied from gym.html's defaultExercises (Carl's
// own tracked lifts) where the name matches a coaching-templates.js
// exercise exactly. Names with no match use DEFAULT_META — correctable by
// hand later if visibly wrong for a specific lift. Dual export like
// gym-workout-events.js so this loads as a plain <script> and self-checks
// with plain `node`.
(function () {
  'use strict';

  const DEFAULT_META = { repMin: 8, repMax: 12, step: 5, bw: false };

  const META = {
    'Neutral Grip Shoulder Press Machine': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Smith Machine Flat Chest Press': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Incline Cable Pec Fly': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Dumbbell Lateral Raise': { repMin: 8, repMax: 16, step: 2.5, bw: false },
    'Cable Front Raise': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Cable Triceps Overhead Extension': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Lat Pulldown': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Cable Seated Row (Neutral Grip)': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Machine High Row': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Machine Low Row': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Cable Lat Pushdown Pullover': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Cable Rear Delt Fly': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Seated Behind-the-Back Cable Curl': { repMin: 8, repMax: 16, step: 2.5, bw: false },
    'Hack Squat': { repMin: 4, repMax: 8, step: 10, bw: false },
    'Seated Hamstrings Curl': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Dumbbell Incline Chest Press': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Chest Supported T-Bar Row': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Smith Machine Narrow Grip Bench': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Neutral Grip Lat Pulldown': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Low Cable Lateral Raise': { repMin: 8, repMax: 16, step: 2.5, bw: false },
    'Dumbbell Front Raise': { repMin: 8, repMax: 16, step: 2.5, bw: false },
    'Machine Preacher Curl': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Cable Triceps Pushdown': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Smith Machine RDL': { repMin: 4, repMax: 8, step: 10, bw: false },
    'Lying Hamstrings Curl': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Cybex Leg Press': { repMin: 8, repMax: 12, step: 10, bw: false },
    'Dumbbell Heel Elevated Lunge': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Leg Extension': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Seated Calf Raise': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Standing Calf Raise': { repMin: 8, repMax: 16, step: 5, bw: false },
  };

  // Isometric/hold exercises don't fit a weight x reps log at all —
  // coaching-log.html checks this list and skips rendering a log input
  // for them (shown as plan-only text instead).
  const NOT_LOGGABLE = ['Plank'];

  function getMeta(exerciseName) {
    return META[exerciseName] || Object.assign({}, DEFAULT_META);
  }

  function isLoggable(exerciseName) {
    return NOT_LOGGABLE.indexOf(exerciseName) === -1;
  }

  const api = { getMeta: getMeta, isLoggable: isLoggable, NOT_LOGGABLE: NOT_LOGGABLE };
  if (typeof window !== 'undefined') window.CoachingExerciseMeta = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
