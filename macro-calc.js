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

  // rows: [{ foodName, grams }]. foods: an array shaped like
  // StapleFoods.FOODS ({ name, protein_100g, carb_100g, fat_100g,
  // calories_100g }) — passed in rather than imported, keeping this file
  // dependency-free like the rest of it. A row whose foodName doesn't
  // match anything in foods, or whose grams isn't a valid positive
  // number, contributes 0 rather than throwing or producing NaN.
  function sumIngredients(rows, foods) {
    const byName = {};
    (foods || []).forEach((f) => { byName[f.name] = f; });

    const raw = (rows || []).reduce((acc, row) => {
      const food = row && byName[row.foodName];
      const grams = row ? num(row.grams, 0) : 0;
      if (!food || grams <= 0) return acc;
      const factor = grams / 100;
      return {
        protein_g: acc.protein_g + num(food.protein_100g, 0) * factor,
        carb_g: acc.carb_g + num(food.carb_100g, 0) * factor,
        fat_g: acc.fat_g + num(food.fat_100g, 0) * factor,
        calories: acc.calories + num(food.calories_100g, 0) * factor,
      };
    }, { protein_g: 0, carb_g: 0, fat_g: 0, calories: 0 });

    // Round once at the end, not per-ingredient — avoids compounding
    // rounding error across a longer ingredient list.
    return {
      protein_g: round1(raw.protein_g),
      carb_g: round1(raw.carb_g),
      fat_g: round1(raw.fat_g),
      calories: round1(raw.calories),
    };
  }

  // Shapes a raw food_log row into the flat object insertEntry() accepts —
  // used by all three ranking functions below so their output is always
  // ready to hand straight to insertEntry() without further mapping.
  function toQuickAddItem(e) {
    return {
      name: e.name,
      protein_g: num(e.protein_g, 0),
      carb_g: num(e.carb_g, 0),
      fat_g: num(e.fat_g, 0),
      calories: num(e.calories, 0),
      source: e.source || 'manual',
      barcode: e.barcode || null,
    };
  }

  const QUICK_ADD_LIMIT = 8;

  // entries: food_log rows over some window (macros.html passes 30 days).
  // Unique by name, most-recent created_at wins and its macros are used.
  function dedupeByRecency(entries) {
    const byName = {};
    (entries || []).forEach((e) => {
      if (!e || !e.name || !e.created_at) return;
      const existing = byName[e.name];
      if (!existing || new Date(e.created_at) > new Date(existing.created_at)) {
        byName[e.name] = e;
      }
    });
    return Object.values(byName)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, QUICK_ADD_LIMIT)
      .map(toQuickAddItem);
  }

  // Counts occurrences per name across the window, sorts desc by count
  // (ties broken by recency), keeps the most recent instance's macros.
  function rankByFrequency(entries) {
    const counts = {};
    const latest = {};
    (entries || []).forEach((e) => {
      if (!e || !e.name || !e.created_at) return;
      counts[e.name] = (counts[e.name] || 0) + 1;
      if (!latest[e.name] || new Date(e.created_at) > new Date(latest[e.name].created_at)) {
        latest[e.name] = e;
      }
    });
    return Object.keys(counts)
      .sort((a, b) => {
        if (counts[b] !== counts[a]) return counts[b] - counts[a];
        return new Date(latest[b].created_at) - new Date(latest[a].created_at);
      })
      .slice(0, QUICK_ADD_LIMIT)
      .map((name) => toQuickAddItem(latest[name]));
  }

  // Frequency x exponential recency decay, summed per occurrence. A name
  // logged many times long ago can still lose to a name logged once
  // recently, and vice versa — see macro-calc.selfcheck.cjs for both cases.
  function rankByFrecency(entries, halfLifeDays) {
    halfLifeDays = halfLifeDays || 7;
    const now = Date.now();
    const scores = {};
    const latest = {};
    (entries || []).forEach((e) => {
      if (!e || !e.name || !e.created_at) return;
      const ageDays = (now - new Date(e.created_at).getTime()) / 86400000;
      const weight = Math.pow(2, -ageDays / halfLifeDays);
      scores[e.name] = (scores[e.name] || 0) + weight;
      if (!latest[e.name] || new Date(e.created_at) > new Date(latest[e.name].created_at)) {
        latest[e.name] = e;
      }
    });
    return Object.keys(scores)
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, QUICK_ADD_LIMIT)
      .map((name) => toQuickAddItem(latest[name]));
  }

  const api = { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData, sumIngredients, dedupeByRecency, rankByFrequency, rankByFrecency };
  if (typeof window !== 'undefined') window.MacroCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
