// =============================================================
// Per-exercise Rx outcome tracking -- classifies a logged set
// against what getRx() would have suggested, and resolves the
// PRIOR exposure's classification into a verdict using this
// exposure's stalled signal. Pure logic, no DOM, no Supabase --
// see docs/superpowers/specs/2026-09-15-exercise-rx-outcome-tracking-design.md.
// =============================================================
(function () {
  'use strict';

  // rx: { type: 'up'|'hold'|'down', weight, reps } -- getRx()'s suggestion.
  // actual: { weight, reps } -- what was actually logged.
  // priorWeight: the weight logged in the exposure BEFORE this one (what
  // getRx() based its suggestion on) -- rx.weight alone can't distinguish
  // "moved less than suggested" (edited) from "didn't move at all"
  // (rejected), since both differ from rx.weight the same way.
  function classifyRxOutcome(rx, actual, priorWeight) {
    if (rx.weight === actual.weight && rx.reps === actual.reps) return 'accepted';
    if (rx.type === 'up') return actual.weight > priorWeight ? 'edited' : 'rejected';
    if (rx.type === 'down') return actual.weight < priorWeight ? 'edited' : 'rejected';
    // 'hold' has no up/down direction to contradict -- any deviation is edited.
    return 'edited';
  }

  // priorClassification: 'accepted' | 'edited' | 'rejected' -- the PRIOR
  // exposure's classification. nextRxStalled: getRx()'s stalled boolean
  // computed for THIS (the new) exposure.
  function resolvePriorRxDecision(priorClassification, nextRxStalled) {
    const followed = priorClassification === 'accepted' || priorClassification === 'edited';
    if (followed) return nextRxStalled ? 'wrong' : 'worked';
    return nextRxStalled ? 'inconclusive' : 'partly_worked';
  }

  window.ExerciseRxTracking = {
    classifyRxOutcome: classifyRxOutcome,
    resolvePriorRxDecision: resolvePriorRxDecision,
  };
})();
