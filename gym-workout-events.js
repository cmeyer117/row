// gym-workout-events.js — classifies a just-logged set as a PR, a grind
// (barely made the floor of the prescribed rep range), a miss, or nothing
// notable. Pure function, no Supabase/network here — see the "logWorkoutEvent"
// fetch helper inlined in gym.html's sync script for the network side.
(function () {
  'use strict';

  function estimate1RM(w, r) {
    if (r < 2) return w;
    return w * (1 + r / 30);
  }

  // A set logged in plate mode stores per-side plate load; one logged in lb mode
  // stores total load. Comparing across the two invents PRs and misses out of a
  // mode switch, so weights are only ever compared within the same basis.
  // Legacy entries predate the field — a plateConfig means it came from the picker.
  function weightBasis(l) {
    return l.weightBasis || (l.plateConfig ? 'platesPerSide' : 'totalLbs');
  }

  // entry: { weight, reps, weightBasis? } — the set that was just logged.
  // priorLogs: array of { weight, reps, weightBasis? } logged before this entry,
  //   for the same exercise+variant. Must NOT include the entry itself.
  // ex: { bw, repMin } — the exercise definition.
  // Returns 'pr' | 'grind' | 'miss' | null.
  function classifyWorkoutEvent(entry, priorLogs, ex) {
    if (!priorLogs || !priorLogs.length) return null;

    if (!ex.bw) {
      const basis = weightBasis(entry);
      priorLogs = priorLogs.filter(function (l) { return weightBasis(l) === basis; });
      if (!priorLogs.length) return null;
    }

    if (ex.bw) {
      const priorMaxReps = Math.max.apply(null, priorLogs.map(function (l) { return l.reps; }));
      if (entry.reps > priorMaxReps) return 'pr';
    } else {
      const entryE1RM = estimate1RM(entry.weight, entry.reps);
      const priorMaxE1RM = Math.max.apply(null, priorLogs.map(function (l) { return estimate1RM(l.weight, l.reps); }));
      if (entryE1RM > priorMaxE1RM) return 'pr';
    }

    if (entry.reps === ex.repMin) return 'grind';
    if (entry.reps < ex.repMin) return 'miss';
    return null;
  }

  if (typeof window !== 'undefined') {
    window.GymWorkoutEvents = { classifyWorkoutEvent: classifyWorkoutEvent, estimate1RM: estimate1RM };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { classifyWorkoutEvent: classifyWorkoutEvent, estimate1RM: estimate1RM };
  }
})();
