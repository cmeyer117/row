// Run with: node coach-meal-plan.selfcheck.cjs
//
// Row's package.json sets "type": "module", which breaks plain require()
// of a same-package .js file (see staple-foods.selfcheck.cjs's header
// comment for the same issue). This runs the actual browser files' source
// against a fake `window` instead of fighting Node's module resolution.
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);

const stapleSource = fs.readFileSync(path.join(__dirname, 'staple-foods.js'), 'utf8');
vm.runInContext(stapleSource, sandbox);
const { FOODS } = sandbox.window.StapleFoods;

const planSource = fs.readFileSync(path.join(__dirname, 'coach-meal-plan.js'), 'utf8');
vm.runInContext(planSource, sandbox);
const { MEALS } = sandbox.window.CoachMealPlan;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

const foodNames = new Set(FOODS.map((f) => f.name));

assertEqual(MEALS.length, 6, 'MEALS has 6 entries (5 meals + pre/post-workout)');

let missingFoods = [];
let badGrams = [];
MEALS.forEach((meal) => {
  if (!meal.rows.length) missingFoods.push(`${meal.label}: no rows`);
  meal.rows.forEach((row) => {
    if (!foodNames.has(row.foodName)) missingFoods.push(`${meal.label}: "${row.foodName}" not in StapleFoods`);
    if (!(row.grams > 0)) badGrams.push(`${meal.label}: "${row.foodName}" has non-positive grams (${row.grams})`);
  });
});
assertEqual(missingFoods.length === 0, true, `every meal row's foodName resolves in StapleFoods.FOODS (missing: ${missingFoods.join('; ')})`);
assertEqual(badGrams.length === 0, true, `every meal row has positive grams (bad: ${badGrams.join('; ')})`);

const labels = MEALS.map((m) => m.label);
assertEqual(new Set(labels).size, labels.length, 'meal labels are unique');

console.log('coach-meal-plan.selfcheck.cjs: all assertions passed');
