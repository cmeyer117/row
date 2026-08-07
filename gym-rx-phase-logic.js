// gym-rx-phase-logic.js — pure phase bias for getRx()'s upgrade/stall
// thresholds. Mirrors Jarvis's coach-read.ts phase grouping (cut/show_prep
// together, growth and reverse_diet distinct, peak/null unchanged) rather
// than inventing a new one. No DOM, no Supabase.
(function () {
  'use strict';

  function phaseAdjustedThresholds(baseUpgradeAt, baseStuckThreshold, phase, repMax) {
    var upgradeAt = baseUpgradeAt;
    var stuckThreshold = baseStuckThreshold;
    if (phase === 'cut' || phase === 'show_prep') {
      upgradeAt += 1;
      stuckThreshold = Math.max(1, stuckThreshold - 1);
    } else if (phase === 'growth') {
      upgradeAt -= 1;
    } else if (phase === 'reverse_diet') {
      stuckThreshold += 1;
    }
    upgradeAt = Math.max(1, Math.min(upgradeAt, repMax));
    return { upgradeAt: upgradeAt, stuckThreshold: stuckThreshold };
  }

  var api = { phaseAdjustedThresholds: phaseAdjustedThresholds };
  if (typeof window !== 'undefined') window.GymRxPhaseLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
