// Run with: node cooking-coach-suggestions.selfcheck.cjs
// Same VM-sandbox pattern as macro-calc.selfcheck.cjs (package.json's
// "type": "module" breaks plain require() of these files).
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'macro-calc.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'staple-foods.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'cooking-coach-suggestions.js'), 'utf8'), sandbox);
const { suggestMealSwaps } = sandbox.window.CookingCoachSuggestions;
const { FOODS } = sandbox.window.StapleFoods;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

const TARGETS = { proteinG: 280, carbG: 397, fatG: 58, calories: 3201 };

// Three meal options, deliberately spread in protein density so the "best
// swap" pick per slot is unambiguous: chicken (Meal 2) >> oats (Meal 1) >>
// rice (Meal 3).
const MEALS = [
  { label: 'Meal 1', rows: [{ foodName: 'Oats (dry, rolled)', grams: 200 }] },
  { label: 'Meal 2', rows: [{ foodName: 'Chicken Breast (cooked)', grams: 300 }] },
  { label: 'Meal 3', rows: [{ foodName: 'White Rice (cooked)', grams: 300 }] },
];

function entry(protein_g) {
  return { protein_g, carb_g: 0, fat_g: 0, calories: 0 };
}

// --- real shortfall picks the right swap, one per remaining slot ---
{
  // 1 row logged today (0 protein) -> loggedCount=1 -> Meal 1 slot is
  // "done", Meal 2 + Meal 3 remain. Full 280g protein target still open.
  const suggestions = suggestMealSwaps(TARGETS, [entry(0)], MEALS, FOODS);
  assertEqual(suggestions.length, 2, 'independent suggestion per remaining slot');
  assertEqual(suggestions[0].slotLabel, 'Meal 2', 'first remaining slot is Meal 2');
  // Meal 2's own candidates exclude itself -> best of {oats, rice} is oats.
  assertEqual(suggestions[0].swapLabel, 'Meal 1', 'Meal 2 slot swaps to the next-best density option (oats), excluding itself');
  assertEqual(suggestions[1].slotLabel, 'Meal 3', 'second remaining slot is Meal 3');
  // Meal 3's candidates are {oats, chicken} -> chicken wins clearly.
  assertEqual(suggestions[1].swapLabel, 'Meal 2', 'Meal 3 slot swaps to the highest protein-density option (chicken)');
}

// --- no shortfall (already on track) -> no forced suggestion ---
{
  const suggestions = suggestMealSwaps(TARGETS, [entry(280)], MEALS, FOODS);
  assertEqual(suggestions, [], 'protein target already met -> no suggestions');
}

// --- missing/no food_log data for today degrades gracefully ---
{
  assertEqual(suggestMealSwaps(TARGETS, null, MEALS, FOODS), [], 'null entries (failed fetch) -> no suggestions, no throw');
  assertEqual(suggestMealSwaps(TARGETS, undefined, MEALS, FOODS), [], 'undefined entries -> no suggestions, no throw');
}

// --- a real empty array (valid state: no meals logged yet today) is NOT
// the same as missing data -- it should still produce suggestions ---
{
  const suggestions = suggestMealSwaps(TARGETS, [], MEALS, FOODS);
  assertEqual(suggestions.length, 3, 'no meals logged yet -> all 3 slots remain, still get suggestions');
}

console.log('cooking-coach-suggestions.selfcheck: all checks passed');
