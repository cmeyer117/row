// plate-calc.js — pure greedy-fill plate math for the plate calculator modal.
// No DOM, no Supabase. Follows the gym-season-logic.js pattern.
(function () {
  'use strict';

  var PLATE_SET = [45, 35, 25, 10, 5, 2.5];

  // totalWeight/barWeight in lbs. Returns { perSide: number[], leftover: number }.
  // leftover is lbs per side that couldn't be matched by the available plate set
  // (e.g. an odd total), rounded down to the nearest whole pound for display.
  function weightToPlates(totalWeight, barWeight) {
    var toLoad = totalWeight - barWeight;
    if (toLoad <= 0) return { perSide: [], leftover: 0 };
    var perSideTarget = toLoad / 2;
    var perSide = [];
    var remaining = perSideTarget;
    PLATE_SET.forEach(function (plate) {
      while (remaining >= plate - 1e-9) {
        perSide.push(plate);
        remaining -= plate;
      }
    });
    return { perSide: perSide, leftover: Math.floor(remaining) };
  }

  if (typeof window !== 'undefined') {
    window.PlateCalc = { weightToPlates: weightToPlates, PLATE_SET: PLATE_SET };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { weightToPlates: weightToPlates, PLATE_SET: PLATE_SET };
  }
})();
