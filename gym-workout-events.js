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

  // Converts a logged set to the actual load moved, so plate-mode and lb-mode
  // sets on the same exercise become comparable. Never mutates the stored
  // `weight` — the log keeps exactly what was entered, and this is applied at
  // read time, so a wrong loadType mis-displays but never corrupts history.
  //
  // ex.loadType:
  //   'total'          — weight as entered is the whole load (cable stack,
  //                      selectorized machine, dumbbell). The default.
  //   'perSidePlusBar' — plates go on both ends of a bar: w*2 + ex.barWeight.
  //   'perSide'        — plates go on both sides, no bar to add (most
  //                      plate-loaded machines; carriage weight not counted).
  //   'plates'         — all plates hang on one horn/belt: w as entered.
  //
  // Returns null when a per-side entry lands on an exercise with no loadType —
  // unknown, not zero. Callers must treat null as "not comparable".
  function totalLoad(entry, ex) {
    const w = entry.weight;
    if (weightBasis(entry) === 'totalLbs') return w;
    switch (ex && ex.loadType) {
      case 'perSidePlusBar': return w * 2 + (ex.barWeight != null ? ex.barWeight : 45);
      case 'perSide':        return w * 2;
      case 'plates':
      case 'total':          return w;
      default:               return null;
    }
  }

  // entry: { weight, reps, weightBasis? } — the set that was just logged.
  // priorLogs: array of { weight, reps, weightBasis? } logged before this entry,
  //   for the same exercise+variant. Must NOT include the entry itself.
  // ex: { bw, repMin, loadType?, barWeight? } — the exercise definition.
  // Returns 'pr' | 'grind' | 'miss' | null.
  function classifyWorkoutEvent(entry, priorLogs, ex) {
    if (!priorLogs || !priorLogs.length) return null;

    if (ex.bw) {
      const priorMaxReps = Math.max.apply(null, priorLogs.map(function (l) { return l.reps; }));
      if (entry.reps > priorMaxReps) return 'pr';
    } else {
      // Compare real load, so a mid-exercise mode switch is no longer a fake PR.
      // Where loadType can't resolve a per-side entry, that set is simply not
      // comparable — drop it rather than guess.
      const entryLoad = totalLoad(entry, ex);
      if (entryLoad == null) return null;
      const priorLoads = priorLogs
        .map(function (l) { return { load: totalLoad(l, ex), reps: l.reps }; })
        .filter(function (l) { return l.load != null; });
      if (!priorLoads.length) return null;
      const entryE1RM = estimate1RM(entryLoad, entry.reps);
      const priorMaxE1RM = Math.max.apply(null, priorLoads.map(function (l) { return estimate1RM(l.load, l.reps); }));
      if (entryE1RM > priorMaxE1RM) return 'pr';
    }

    if (entry.reps === ex.repMin) return 'grind';
    if (entry.reps < ex.repMin) return 'miss';
    return null;
  }

  if (typeof window !== 'undefined') {
    window.GymWorkoutEvents = { classifyWorkoutEvent: classifyWorkoutEvent, estimate1RM: estimate1RM, totalLoad: totalLoad, weightBasis: weightBasis };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { classifyWorkoutEvent: classifyWorkoutEvent, estimate1RM: estimate1RM, totalLoad: totalLoad, weightBasis: weightBasis };
  }
})();
