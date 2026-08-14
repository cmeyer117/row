// gym-peak-phase-logic.js — pure peak-week freeze decision for getRx().
// Mirrors gym-rx-deload-logic.js's exact convention (no DOM, no Supabase,
// dual window/module.exports). See
// docs/superpowers/specs/2026-08-14-peak-phase-freeze-design.md.
(function () {
  'use strict';

  // ex: { bw, ... }. last: the most recent logged set ({ weight, reps }).
  // stuck: the caller's already-computed consecutive-same-weight/reps
  // streak, passed through unchanged (informational only -- it does not
  // drive this decision, unlike the normal load-progression branches).
  // Freezes at exactly last session's numbers -- no autonomous 'up'
  // (weight increase) or 'down'/stall-driven 'Reassess' during peak week.
  // Reason text is built by the caller (getRx()), which has unit() in
  // scope -- same split gym-rx-deload-logic.js's deloadWeight() already
  // uses (returns bare numbers, caller builds the sentence).
  function peakFreezeResult(ex, last, stuck) {
    if (ex.bw) {
      return { type: 'hold', weight: 0, reps: last.reps, tag: 'Peak — hold', bw: true, stuck: stuck };
    }
    return { type: 'hold', weight: last.weight, reps: last.reps, tag: 'Peak — hold', stuck: stuck };
  }

  var api = { peakFreezeResult: peakFreezeResult };
  if (typeof window !== 'undefined') window.GymPeakPhaseLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
