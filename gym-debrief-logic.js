// gym-debrief-logic.js — pure formatting for the post-workout debrief
// message's planned-vs-performed comparison lines. No DOM, no Supabase.
// Part of the Workout Autopsy debrief upgrade -- see
// docs/superpowers/specs/2026-08-13-workout-autopsy-debrief-design.md.
(function () {
  'use strict';

  // rx: a getRx() result object ({ type, weight, reps, tag, reason, bw?,
  // stuck }) or null (no prior session to prescribe from). setsStr: the
  // already-formatted "185lb×8, 185lb×7" performed-sets string.
  //
  // Uses rx.reason, not just rx.tag -- reason is already a full sentence
  // (weight/reps/unit baked in from when getRx() was called) that also
  // carries the stall/RIR/pain/recovery detail the old debrief prompt's
  // "any flags" instruction was fishing for. Surfacing only the short tag
  // ("Deload", "Reassess") would silently drop that detail.
  function formatRxComparison(rx, setsStr) {
    if (!rx) return setsStr + ' (first logged session, no Rx to compare)';
    var line = 'Rx: ' + rx.reason + ' Actual: ' + setsStr;
    if (rx.volumeAdvisory) line += ' Volume note: ' + rx.volumeAdvisory.reason;
    return line;
  }

  var api = { formatRxComparison: formatRxComparison };
  if (typeof window !== 'undefined') window.GymDebriefLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
