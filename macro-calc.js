// macro-calc.js — pure functions for macro targets, per-scan macro
// resolution, and remaining-today budget math. No DOM, no Supabase —
// see macros.html for the wiring. Dual export like gym-workout-events.js
// so this can be self-checked with plain `node` (no test runner in this
// repo) and also loaded as a plain <script> in the browser.
(function () {
  'use strict';

  function round1(n) { return Math.round(n * 10) / 10; }

  // Same formula already validated in coaching-landing/macros.html's
  // calculateMacros() — copied here rather than shared, since these are
  // two separate static repos with no build step to share a module through.
  function calculateMacros({ sex, age, heightIn, weightLb, activityLevel, goal }) {
    const ACTIVITY_MULTIPLIERS = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 };
    const GOAL_ADJUSTMENTS = { cut: 0.8, bulk: 1.125, recomp: 0.95 };
    const CARB_FLOOR_G = 50;

    const weightKg = weightLb * 0.45359237;
    const heightCm = heightIn * 2.54;

    const bmr = sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

    const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
    const calories = tdee * GOAL_ADJUSTMENTS[goal];

    const proteinG = weightLb;
    let fatG = (0.25 * calories) / 9;
    let carbG = (calories - proteinG * 4 - fatG * 9) / 4;

    if (carbG < CARB_FLOOR_G) {
      carbG = CARB_FLOOR_G;
      fatG = (calories - proteinG * 4 - carbG * 4) / 9;
    }

    return {
      calories: Math.round(calories),
      proteinG: Math.round(proteinG),
      fatG: Math.round(fatG),
      carbG: Math.round(carbG),
    };
  }

  // A product only counts as having usable per-serving data if ALL FOUR
  // macro fields are present — a product with proteins_serving but no
  // energy-kcal_serving would otherwise silently report 0 calories.
  function hasCompleteServingData(nutriments) {
    return ['proteins_serving', 'carbohydrates_serving', 'fat_serving', 'energy-kcal_serving']
      .every((k) => nutriments[k] != null);
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  // nutriments: the raw `nutriments` object from an Open Food Facts
  // product response. quantity: number of servings logged — only used
  // when hasCompleteServingData(nutriments) is true. gramsOverride: grams
  // eaten — required (by the caller) whenever serving data is incomplete;
  // this function still falls back to 100g if the caller omits it so it
  // never throws, but the UI must not skip prompting for grams in that case.
  function resolveServingMacros(nutriments, quantity, gramsOverride) {
    nutriments = nutriments || {};
    if (hasCompleteServingData(nutriments) && gramsOverride == null) {
      const q = num(quantity, 1);
      return {
        protein_g: round1(num(nutriments['proteins_serving'], 0) * q),
        carb_g: round1(num(nutriments['carbohydrates_serving'], 0) * q),
        fat_g: round1(num(nutriments['fat_serving'], 0) * q),
        calories: round1(num(nutriments['energy-kcal_serving'], 0) * q),
      };
    }
    const grams = gramsOverride != null ? num(gramsOverride, 100) : 100;
    const factor = grams / 100;
    return {
      protein_g: round1(num(nutriments['proteins_100g'], 0) * factor),
      carb_g: round1(num(nutriments['carbohydrates_100g'], 0) * factor),
      fat_g: round1(num(nutriments['fat_100g'], 0) * factor),
      calories: round1(num(nutriments['energy-kcal_100g'], 0) * factor),
    };
  }

  // targets: { proteinG, carbG, fatG, calories }
  // entries: array of food_log rows for today ({ protein_g, carb_g, fat_g, calories })
  // Values are coerced through num() — a corrupt/non-numeric row (e.g. from
  // a future bad write) contributes 0 rather than producing NaN totals.
  function remainingBudget(targets, entries) {
    const consumed = (entries || []).reduce((acc, e) => ({
      protein_g: acc.protein_g + num(e.protein_g, 0),
      carb_g: acc.carb_g + num(e.carb_g, 0),
      fat_g: acc.fat_g + num(e.fat_g, 0),
      calories: acc.calories + num(e.calories, 0),
    }), { protein_g: 0, carb_g: 0, fat_g: 0, calories: 0 });

    return {
      protein_g: round1((targets.proteinG || 0) - consumed.protein_g),
      carb_g: round1((targets.carbG || 0) - consumed.carb_g),
      fat_g: round1((targets.fatG || 0) - consumed.fat_g),
      calories: round1((targets.calories || 0) - consumed.calories),
      consumed,
    };
  }

  const api = { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData };
  if (typeof window !== 'undefined') window.MacroCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
