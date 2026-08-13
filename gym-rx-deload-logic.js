// gym-rx-deload-logic.js — pure deload-weight calculation for getRx().
// Mirrors gym-rx-phase-logic.js's exact convention (no DOM, no Supabase,
// dual window/module.exports). Split out 2026-08-13 after a Codex+Grok
// audit found a flat-10% cut could round back to the exact same weight for
// small loads with large equipment steps, and that a flat percentage
// across all lifts doesn't reflect real deload practice (compounds carry
// more systemic/joint fatigue and warrant a bigger cut than isolations).
(function () {
  'use strict';

  function roundToStep(v, s) { return Math.round(v / s) * s; }

  // repMin <= 6 = compound-style (heavier rep range, more systemic/joint
  // fatigue) -> bigger cut. repMin >= 8 = isolation-style -> smaller cut.
  // Same heavy/isolation split gym.html's own rest-timer heuristic already
  // uses (repMin <= 6 = 2:30 rest, 8-16 = 1:15) -- reused, not invented.
  function deloadWeight(weight, step, repMin) {
    var pct = repMin <= 6 ? 0.15 : repMin >= 8 ? 0.05 : 0.10;
    var dl = roundToStep(weight * (1 - pct), step);
    // Rounding to the nearest step can land back on (or above) the
    // starting weight for small loads with a large step -- e.g. 15lb at a
    // 5lb step: round(13.5/5)*5 = 15, a "deload" that changes nothing.
    // Guarantee a real drop of at least one step regardless of rounding.
    if (dl >= weight) dl = weight - step;
    return { weight: Math.max(dl, 0), pct: Math.round(pct * 100) };
  }

  var api = { deloadWeight: deloadWeight };
  if (typeof window !== 'undefined') window.GymRxDeloadLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
