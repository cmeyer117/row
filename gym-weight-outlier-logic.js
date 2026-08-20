// gym-weight-outlier-logic.js — flags a logged weight that's wildly out of
// line with the exercise's last logged weight (e.g. "100" typed for "10",
// or a decimal point dropped). Advisory only: gym.html still writes the
// entry either way, this just returns something the UI can show as a
// warning toast. Same window/module.exports convention as the other
// gym-*-logic.js files (see gym-rx-deload-logic.js).
(function () {
  'use strict';

  // 3x-or-more in either direction is well outside normal session-to-session
  // progression (steps are typically 2.5-10lb), but well within range for a
  // dropped decimal point (10 -> 100) or a fat-fingered extra digit.
  var OUTLIER_MULTIPLIER = 3;

  // priorLogs: this exercise's existing log entries (any order/emptiness ok).
  // newWeight: the weight about to be logged.
  // Returns { priorWeight, multiplier } if newWeight looks like a typo
  // against the most recent prior entry, otherwise null.
  function checkWeightOutlier(priorLogs, newWeight) {
    if (!priorLogs || !priorLogs.length) return null;
    if (!newWeight || newWeight <= 0) return null;
    var last = priorLogs[priorLogs.length - 1];
    var priorWeight = last && last.weight;
    if (!priorWeight || priorWeight <= 0) return null;
    var ratio = newWeight / priorWeight;
    if (ratio >= OUTLIER_MULTIPLIER) return { priorWeight: priorWeight, multiplier: Math.round(ratio * 10) / 10 };
    if (ratio <= 1 / OUTLIER_MULTIPLIER) return { priorWeight: priorWeight, multiplier: Math.round((1 / ratio) * 10) / 10 };
    return null;
  }

  var api = { checkWeightOutlier: checkWeightOutlier };
  if (typeof window !== 'undefined') window.GymWeightOutlierLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
