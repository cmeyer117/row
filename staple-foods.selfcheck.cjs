// Run with: node staple-foods.selfcheck.cjs
//
// Row's package.json sets "type": "module", which breaks plain require()
// of a same-package .js file (see gym-season-logic.selfcheck.cjs's header
// comment for the same issue). This runs the actual browser file's source
// against a fake `window` instead of fighting Node's module resolution.
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
const source = fs.readFileSync(path.join(__dirname, 'staple-foods.js'), 'utf8');
vm.runInContext(source, sandbox);
const { FOODS } = sandbox.window.StapleFoods;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

assertEqual(FOODS.length >= 58, true, 'staple-foods dataset has at least 58 entries');

const chicken = FOODS.find((f) => f.name === 'Chicken Breast (cooked)');
assertEqual(!!chicken, true, 'Chicken Breast (cooked) exists in the dataset');
assertEqual(chicken.protein_100g, 31, 'Chicken Breast protein_100g');
assertEqual(chicken.carb_100g, 0, 'Chicken Breast carb_100g');
assertEqual(chicken.fat_100g, 3.6, 'Chicken Breast fat_100g');
assertEqual(chicken.calories_100g, 165, 'Chicken Breast calories_100g');

const rice = FOODS.find((f) => f.name === 'White Rice (cooked)');
assertEqual(rice.calories_100g, 130, 'White Rice calories_100g');

const broccoli = FOODS.find((f) => f.name === 'Broccoli (cooked)');
assertEqual(broccoli.protein_100g, 2.8, 'Broccoli protein_100g');

// No duplicate names — each is a unique dropdown option.
const names = FOODS.map((f) => f.name);
assertEqual(new Set(names).size, names.length, 'no duplicate food names in the dataset');

console.log('staple-foods.selfcheck.cjs: all assertions passed');
