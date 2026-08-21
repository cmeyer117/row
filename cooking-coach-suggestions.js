// cooking-coach-suggestions.js — "you're 30g protein short today, here's a
// Meal 3 swap that closes the gap" for the Cooking page. Pure arithmetic +
// lookup, no new meal generation: reuses coach-meal-plan.js's MEALS (already
// real per-meal macros via MacroCalc.sumIngredients against staple-foods.js)
// and macro-calc.js's remainingBudget() (the same food_log-vs-target
// arithmetic getRx()'s macro-adherence signal already uses, 2026-08-14).
//
// ponytail: gap macro is protein only (the example in the spec and the
// simplest real lever) — not a general multi-macro optimizer. Add a
// carb/fat gap path if Carl asks for one.
//
// "Remaining meal slots" uses the same coarse heuristic as
// meal-log-nudge-logic.js's shouldSendMealNudge(): total food_log rows
// logged today vs. meal-plan position, not per-meal tagging (food_log rows
// aren't tied to a specific slot anywhere in this repo).
(function () {
  'use strict';

  var MacroCalc = (typeof window !== 'undefined' && window.MacroCalc) ||
    (typeof require === 'function' ? require('./macro-calc.js') : null);

  var PROTEIN_GAP_FLOOR_G = 5; // below this, treat as "on track" (rounding noise)

  function proteinPerCal(macros) {
    return macros.calories > 0 ? macros.protein_g / macros.calories : 0;
  }

  // targets: { proteinG, carbG, fatG, calories }. todayEntries: food_log rows
  // for today (or null/undefined if the fetch failed/hasn't happened — NOT
  // the same as a legitimate empty array early in the day). meals:
  // CoachMealPlan.MEALS-shaped array. foods: StapleFoods.FOODS-shaped array.
  // recoveryFiring: the caller's already-computed TrainingInsightEngine
  // .detectRecoverySignal(...) result (truthy) or null/undefined -- this
  // function never recomputes that signal itself, just reuses it.
  //
  // Returns [{ slotLabel, swapLabel, swapMacros, gapProteinG }] — one entry
  // per remaining slot, or [] when there's no meaningful protein gap or the
  // inputs are unusable. When recoveryFiring is truthy and a meal slot
  // remains today, the returned array also carries a non-index
  // `recoveryNote` property (ignored by .forEach/.map, so existing callers
  // are unaffected) pointing at whichever remaining slot has the highest
  // carb macros -- one conditional note, not a new recommendation engine.
  function suggestMealSwaps(targets, todayEntries, meals, foods, recoveryFiring) {
    if (!targets || !Array.isArray(meals) || !meals.length || !Array.isArray(foods)) return [];
    if (!Array.isArray(todayEntries)) return []; // missing/failed food_log fetch — degrade quietly

    var loggedCount = todayEntries.length;
    var remainingSlots = meals.slice(loggedCount);

    // Precompute every meal option's macros once, not per slot.
    var withMacros = meals.map(function (m) {
      return { label: m.label, macros: MacroCalc.sumIngredients(m.rows, foods) };
    });

    var result = [];
    var remaining = MacroCalc.remainingBudget(targets, todayEntries);
    if (remaining.protein_g >= PROTEIN_GAP_FLOOR_G && remainingSlots.length) {
      result = remainingSlots.map(function (slot) {
        var candidates = withMacros.filter(function (c) { return c.label !== slot.label; });
        var best = candidates.reduce(function (a, b) {
          return proteinPerCal(b.macros) > proteinPerCal(a.macros) ? b : a;
        });
        return {
          slotLabel: slot.label,
          swapLabel: best.label,
          swapMacros: best.macros,
          gapProteinG: remaining.protein_g,
        };
      });
    }

    if (recoveryFiring && remainingSlots.length) {
      var remainingWithMacros = remainingSlots
        .map(function (slot) { return withMacros.filter(function (w) { return w.label === slot.label; })[0]; })
        .filter(Boolean);
      if (remainingWithMacros.length) {
        var higherCarb = remainingWithMacros.reduce(function (a, b) {
          return b.macros.carb_g > a.macros.carb_g ? b : a;
        });
        result.recoveryNote = "Your sleep's been off this week — consider " + higherCarb.label +
          ' tonight (the higher-carb option among what\'s left today, ~' + Math.round(higherCarb.macros.carb_g) + 'g carbs).';
      }
    }

    return result;
  }

  var api = { suggestMealSwaps: suggestMealSwaps };
  if (typeof window !== 'undefined') window.CookingCoachSuggestions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
