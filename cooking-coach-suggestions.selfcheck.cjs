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

// --- item 2.5: recovery-signal note ---

// Carb-heavy Meal 1 (oats+banana-equivalent) MEALS set so "higher carb
// among remaining options" has an unambiguous answer distinct from the
// protein-density winner used above.
const CARB_MEALS = [
  { label: 'Meal 1', rows: [{ foodName: 'Oats (dry, rolled)', grams: 200 }] }, // high carb
  { label: 'Meal 2', rows: [{ foodName: 'Chicken Breast (cooked)', grams: 300 }] }, // low carb
];

// --- signal firing produces the extra note, pointing at the genuinely
// higher-carb remaining option (not just always the same food) ---
{
  const suggestions = suggestMealSwaps(TARGETS, [], CARB_MEALS, FOODS, { type: 'recovery-signal' });
  if (typeof suggestions.recoveryNote !== 'string' || !suggestions.recoveryNote.includes('Meal 1')) {
    console.error(`FAIL: recovery signal firing should note the higher-carb remaining option (Meal 1)\n  actual: ${suggestions.recoveryNote}`);
    process.exit(1);
  }
}

// --- the higher-carb pick is relative to today's remaining options, not
// hardcoded -- once the carb-heavy meal is already logged (no longer
// "remaining"), the note should point at whichever remaining option is
// now relatively higher-carb instead ---
{
  // loggedCount=1 -> Meal 1 slot is done, only Meal 2 (chicken) remains.
  const suggestions = suggestMealSwaps(TARGETS, [entry(0)], CARB_MEALS, FOODS, { type: 'recovery-signal' });
  if (typeof suggestions.recoveryNote !== 'string' || !suggestions.recoveryNote.includes('Meal 2')) {
    console.error(`FAIL: with Meal 1 already logged, the recovery note should point at the remaining option (Meal 2), not a hardcoded pick\n  actual: ${suggestions.recoveryNote}`);
    process.exit(1);
  }
}

// --- signal not firing does not force a note ---
{
  const suggestions = suggestMealSwaps(TARGETS, [], CARB_MEALS, FOODS, null);
  assertEqual('recoveryNote' in suggestions, false, 'no recovery signal -> no recoveryNote key at all');
}

// --- signal firing with no remaining slots today produces no note (nothing to point at) ---
{
  const suggestions = suggestMealSwaps(TARGETS, [entry(0), entry(0)], CARB_MEALS, FOODS, { type: 'recovery-signal' });
  assertEqual('recoveryNote' in suggestions, false, 'recovery signal firing with no remaining meal slots -> no note');
}

console.log('cooking-coach-suggestions.selfcheck: all checks passed');
