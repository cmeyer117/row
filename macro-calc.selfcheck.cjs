// Run with: node macro-calc.selfcheck.cjs
//
// Row's package.json sets "type": "module", which breaks plain require()
// of a same-package .js file (see gym-season-logic.selfcheck.cjs's header
// comment for the same issue). This runs the actual browser files' source
// against a fake `window` instead of fighting Node's module resolution.
// Both macro-calc.js and staple-foods.js attach to the same window, so
// they share one sandbox context here.
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'macro-calc.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'staple-foods.js'), 'utf8'), sandbox);
const { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData, sumIngredients, dedupeByRecency, rankByFrequency, rankByFrecency } = sandbox.window.MacroCalc;
const { FOODS } = sandbox.window.StapleFoods;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// calculateMacros — same cases coaching-landing's macros.html validates.
const r1 = calculateMacros({ sex: 'male', age: 25, heightIn: 70, weightLb: 180, activityLevel: 3, goal: 'cut' });
assertEqual(r1.calories, 2242, 'calculateMacros calories (normal case)');
assertEqual(r1.proteinG, 180, 'calculateMacros protein (normal case)');
assertEqual(r1.fatG, 62, 'calculateMacros fat (normal case)');
assertEqual(r1.carbG, 240, 'calculateMacros carbs (normal case)');

// resolveServingMacros — product with serving-level data, quantity 1.
const withServing = {
  'proteins_serving': 5, 'carbohydrates_serving': 37, 'fat_serving': 4, 'energy-kcal_serving': 200,
  'proteins_100g': 9.62, 'carbohydrates_100g': 71.15, 'fat_100g': 7.69, 'energy-kcal_100g': 385,
};
const s1 = resolveServingMacros(withServing, 1, null);
assertEqual(s1.protein_g, 5, 'resolveServingMacros uses serving data at quantity 1');
assertEqual(s1.calories, 200, 'resolveServingMacros calories at quantity 1');

// resolveServingMacros — same product, 2 servings.
const s2 = resolveServingMacros(withServing, 2, null);
assertEqual(s2.protein_g, 10, 'resolveServingMacros scales with quantity');

// resolveServingMacros — product with NO serving data, falls back to grams.
const noServing = { 'proteins_100g': 20, 'carbohydrates_100g': 0, 'fat_100g': 10, 'energy-kcal_100g': 180 };
assertEqual(hasCompleteServingData(noServing), false, 'hasCompleteServingData is false with no serving fields at all');
const s3 = resolveServingMacros(noServing, 1, 150);
assertEqual(s3.protein_g, 30, 'resolveServingMacros falls back to per-100g x grams when no serving data');
assertEqual(s3.calories, 270, 'resolveServingMacros calories fallback math');

// resolveServingMacros — PARTIAL serving data (protein present, calories
// missing) must NOT be treated as complete, or calories would silently
// report 0. This is the exact bug Codex's terra review flagged.
const partialServing = { 'proteins_serving': 5, 'carbohydrates_serving': 37, 'fat_serving': 4, 'proteins_100g': 9.62, 'carbohydrates_100g': 71.15, 'fat_100g': 7.69, 'energy-kcal_100g': 385 };
assertEqual(hasCompleteServingData(partialServing), false, 'hasCompleteServingData is false when energy-kcal_serving is missing');
const s4 = resolveServingMacros(partialServing, 1, 80);
assertEqual(s4.calories, 308, 'resolveServingMacros correctly falls back to per-100g x grams for partial serving data');

// remainingBudget — subtracts today's entries from targets.
const targets = { proteinG: 180, carbG: 240, fatG: 62, calories: 2242 };
const entries = [
  { protein_g: 40, carb_g: 50, fat_g: 10, calories: 460 },
  { protein_g: 30, carb_g: 20, fat_g: 5, calories: 250 },
];
const b = remainingBudget(targets, entries);
assertEqual(b.protein_g, 110, 'remainingBudget protein remaining');
assertEqual(b.calories, 1532, 'remainingBudget calories remaining');
assertEqual(b.consumed.protein_g, 70, 'remainingBudget tracks consumed total too');

// remainingBudget — empty log returns full targets remaining.
const b2 = remainingBudget(targets, []);
assertEqual(b2.protein_g, 180, 'remainingBudget with no entries returns full target');

// remainingBudget — a corrupt/non-numeric row contributes 0, not NaN.
const b3 = remainingBudget(targets, [{ protein_g: 'not-a-number', carb_g: null, fat_g: undefined, calories: 100 }]);
assertEqual(b3.protein_g, 180, 'remainingBudget treats non-numeric fields as 0 instead of propagating NaN');
assertEqual(b3.calories, 2142, 'remainingBudget still counts the valid numeric field on the same row');

// sumIngredients — Carl's own example: 200g White Rice + 200g Chicken
// Breast + 50g Broccoli. Hand-computed expected total:
//   protein: 200*2.7/100 + 200*31/100 + 50*2.8/100   = 5.4 + 62 + 1.4   = 68.8
//   carb:    200*28/100  + 200*0/100  + 50*7/100     = 56 + 0 + 3.5     = 59.5
//   fat:     200*0.3/100 + 200*3.6/100 + 50*0.4/100  = 0.6 + 7.2 + 0.2  = 8
//   cal:     200*130/100 + 200*165/100 + 50*35/100   = 260 + 330 + 17.5 = 607.5
const meal = sumIngredients([
  { foodName: 'White Rice (cooked)', grams: 200 },
  { foodName: 'Chicken Breast (cooked)', grams: 200 },
  { foodName: 'Broccoli (cooked)', grams: 50 },
], FOODS);
assertEqual(meal.protein_g, 68.8, 'sumIngredients protein for Carl\'s example meal');
assertEqual(meal.carb_g, 59.5, 'sumIngredients carb for Carl\'s example meal');
assertEqual(meal.fat_g, 8, 'sumIngredients fat for Carl\'s example meal');
assertEqual(meal.calories, 607.5, 'sumIngredients calories for Carl\'s example meal');

// sumIngredients — an unmatched food name contributes 0, not NaN.
const withUnknown = sumIngredients([
  { foodName: 'White Rice (cooked)', grams: 100 },
  { foodName: 'Nonexistent Food', grams: 999 },
], FOODS);
assertEqual(withUnknown.protein_g, 2.7, 'sumIngredients ignores an unmatched food name');

// sumIngredients — a zero/negative grams row is skipped.
const withZero = sumIngredients([
  { foodName: 'White Rice (cooked)', grams: 100 },
  { foodName: 'Chicken Breast (cooked)', grams: 0 },
  { foodName: 'Broccoli (cooked)', grams: -10 },
], FOODS);
assertEqual(withZero.calories, 130, 'sumIngredients skips zero/negative-gram rows');

// sumIngredients — null/undefined rows and an empty/undefined rows array
// don't throw (a row can legitimately be malformed if a UI bug ever
// slips one through).
const withNullRow = sumIngredients([
  { foodName: 'White Rice (cooked)', grams: 100 },
  null,
  undefined,
], FOODS);
assertEqual(withNullRow.calories, 130, 'sumIngredients tolerates null/undefined rows without throwing');
assertEqual(sumIngredients(undefined, FOODS).calories, 0, 'sumIngredients(undefined, FOODS) returns a zeroed total, not a throw');

// ---- Quick Add ranking functions ----

function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

// dedupeByRecency — same name logged twice with different macros; the more
// recent instance's macros win, and the result collapses to one entry.
const dedupeEntries = [
  { name: 'Protein Shake', protein_g: 25, carb_g: 5, fat_g: 2, calories: 140, source: 'manual', barcode: null, created_at: daysAgo(3) },
  { name: 'Protein Shake', protein_g: 30, carb_g: 8, fat_g: 3, calories: 180, source: 'manual', barcode: null, created_at: daysAgo(1) },
];
const dedupeResult = dedupeByRecency(dedupeEntries);
assertEqual(dedupeResult.length, 1, 'dedupeByRecency collapses same-name entries to one');
assertEqual(dedupeResult[0].protein_g, 30, "dedupeByRecency keeps the more recent instance's macros");

// rankByFrequency — a 3x-logged food outranks a 1x-logged food regardless
// of which was logged more recently.
const freqEntries = [
  { name: 'Chicken Rice Bowl', protein_g: 50, carb_g: 60, fat_g: 10, calories: 520, source: 'manual', barcode: null, created_at: daysAgo(10) },
  { name: 'Chicken Rice Bowl', protein_g: 50, carb_g: 60, fat_g: 10, calories: 520, source: 'manual', barcode: null, created_at: daysAgo(6) },
  { name: 'Chicken Rice Bowl', protein_g: 50, carb_g: 60, fat_g: 10, calories: 520, source: 'manual', barcode: null, created_at: daysAgo(2) },
  { name: 'One-Off Snack', protein_g: 5, carb_g: 20, fat_g: 8, calories: 170, source: 'manual', barcode: null, created_at: daysAgo(0) },
];
const freqResult = rankByFrequency(freqEntries);
assertEqual(freqResult[0].name, 'Chicken Rice Bowl', 'rankByFrequency ranks the 3x-logged food first despite being less recent');

// rankByFrecency — a fresh-but-rare food outranks a stale-but-frequent food
// when the count gap is small (decay dominates).
const frecencySmallGap = [
  { name: 'Fresh Food', protein_g: 20, carb_g: 20, fat_g: 5, calories: 220, source: 'manual', barcode: null, created_at: daysAgo(1) },
  { name: 'Fresh Food', protein_g: 20, carb_g: 20, fat_g: 5, calories: 220, source: 'manual', barcode: null, created_at: daysAgo(1) },
  { name: 'Stale Food', protein_g: 20, carb_g: 20, fat_g: 5, calories: 220, source: 'manual', barcode: null, created_at: daysAgo(20) },
  { name: 'Stale Food', protein_g: 20, carb_g: 20, fat_g: 5, calories: 220, source: 'manual', barcode: null, created_at: daysAgo(20) },
  { name: 'Stale Food', protein_g: 20, carb_g: 20, fat_g: 5, calories: 220, source: 'manual', barcode: null, created_at: daysAgo(20) },
];
const frecencySmallGapResult = rankByFrecency(frecencySmallGap);
assertEqual(frecencySmallGapResult[0].name, 'Fresh Food', 'rankByFrecency lets a fresh 2x food outrank a stale 3x food (decay dominates a small count gap)');

// rankByFrecency — a large count gap still wins even against a fresher
// low-count food (frequency dominates when the gap is big enough).
const frecencyBigGap = [];
for (let i = 0; i < 10; i++) {
  frecencyBigGap.push({ name: 'Staple Food', protein_g: 20, carb_g: 20, fat_g: 5, calories: 220, source: 'manual', barcode: null, created_at: daysAgo(5) });
}
frecencyBigGap.push({ name: 'New Food', protein_g: 20, carb_g: 20, fat_g: 5, calories: 220, source: 'manual', barcode: null, created_at: daysAgo(0) });
const frecencyBigGapResult = rankByFrecency(frecencyBigGap);
assertEqual(frecencyBigGapResult[0].name, 'Staple Food', 'rankByFrecency lets a big count gap (10x vs 1x) win even against a fresher food');

// All three cap at 8 items and tolerate empty/undefined input.
const manyEntries = [];
for (let i = 0; i < 12; i++) {
  manyEntries.push({ name: 'Food ' + i, protein_g: 10, carb_g: 10, fat_g: 5, calories: 130, source: 'manual', barcode: null, created_at: daysAgo(i) });
}
assertEqual(dedupeByRecency(manyEntries).length, 8, 'dedupeByRecency caps at 8 items');
assertEqual(rankByFrequency(manyEntries).length, 8, 'rankByFrequency caps at 8 items');
assertEqual(rankByFrecency(manyEntries).length, 8, 'rankByFrecency caps at 8 items');
assertEqual(dedupeByRecency([]).length, 0, 'dedupeByRecency of empty array returns empty array');
assertEqual(rankByFrequency(undefined).length, 0, 'rankByFrequency(undefined) does not throw, returns empty array');

console.log('macro-calc.selfcheck.cjs: all assertions passed');
