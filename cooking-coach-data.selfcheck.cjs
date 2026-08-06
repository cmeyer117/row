// Run with: node cooking-coach-data.selfcheck.cjs
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

const cookingSource = fs.readFileSync(path.join(__dirname, 'cooking-coach-data.js'), 'utf8');
vm.runInContext(cookingSource, sandbox);
const { MEAL_PLAN, COOKING_GUIDES } = sandbox.window.CookingCoach;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

const stapleNames = new Set(FOODS.map((f) => f.name));
const guideKeys = Object.keys(COOKING_GUIDES);

assertEqual(guideKeys.length >= 20, true, 'COOKING_GUIDES has at least 20 entries');
assertEqual(MEAL_PLAN.meals.length >= 5, true, 'MEAL_PLAN has at least 5 meals');

const guideSet = new Set(guideKeys);
let missingMealFoods = [];
MEAL_PLAN.meals.forEach((meal) => {
  meal.foods.forEach((food) => {
    if (!guideSet.has(food)) missingMealFoods.push(`${meal.label}: ${food}`);
  });
});
assertEqual(missingMealFoods.length === 0, true, `every MEAL_PLAN food has a COOKING_GUIDES entry (missing: ${missingMealFoods.join('; ')})`);

let malformedGuides = [];
guideKeys.forEach((key) => {
  const g = COOKING_GUIDES[key];
  if (!g.method || !g.tempTime || !Array.isArray(g.steps) || g.steps.length === 0 || !g.keyTip || !g.mistake) {
    malformedGuides.push(key);
  }
});
assertEqual(malformedGuides.length === 0, true, `every COOKING_GUIDES entry has method/tempTime/steps/keyTip/mistake (malformed: ${malformedGuides.join('; ')})`);

const NON_STAPLE_LABELS = new Set(['Fruit (200g)', 'Veggies (1 cup)', 'Kombucha (8oz)', 'Ground Turkey (99% lean)']);
let orphanedGuides = [];
guideKeys.forEach((key) => {
  if (!stapleNames.has(key) && !NON_STAPLE_LABELS.has(key)) orphanedGuides.push(key);
});
assertEqual(orphanedGuides.length === 0, true, `every COOKING_GUIDES key matches a StapleFoods name or a known non-staple label (orphaned: ${orphanedGuides.join('; ')})`);

console.log('cooking-coach-data.selfcheck.cjs: all assertions passed');
