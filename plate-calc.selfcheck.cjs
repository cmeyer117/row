// Run with: node plate-calc.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require('path').join(__dirname, 'plate-calc.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { weightToPlates } = sandbox.window.PlateCalc;

function assertDeepEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

// 225 total, 45 bar -> 180 to load -> 90/side -> two 45s per side.
assertDeepEqual(weightToPlates(225, 45), { perSide: [45, 45], leftover: 0 }, '225 total, 45 bar');

// 315 total, 45 bar -> 270 to load -> 135/side -> greedy fills as three 45s (135 = 45x3 exactly).
assertDeepEqual(weightToPlates(315, 45), { perSide: [45, 45, 45], leftover: 0 }, '315 total, 45 bar');

// 325 total, 45 bar -> 280 to load -> 140/side -> 45+45+45+5.
assertDeepEqual(weightToPlates(325, 45), { perSide: [45, 45, 45, 5], leftover: 0 }, '325 total, 45 bar');

// 135 total, 45 bar -> 90 to load -> 45/side -> single 45.
assertDeepEqual(weightToPlates(135, 45), { perSide: [45], leftover: 0 }, '135 total, 45 bar (empty bar + one plate/side)');

// Below bar weight -> no plates, leftover reported as negative-clamped 0.
assertDeepEqual(weightToPlates(35, 45), { perSide: [], leftover: 0 }, 'below bar weight clamps to empty');

// Odd total that can't be split evenly leaves a leftover (1lb/side, no plate that small).
assertDeepEqual(weightToPlates(227, 45), { perSide: [45, 45], leftover: 1 }, '227 total leaves 1lb unaccounted per side');

// Sub-integer residual: 226 total, 45 bar -> 181 to load -> 90.5/side -> 45+45=90,
// 0.5lb/side left over. Must NOT be floored to 0 -- that would silently report
// this as an exact match when it's actually 1lb short across the whole bar.
assertDeepEqual(weightToPlates(226, 45), { perSide: [45, 45], leftover: 0.5 }, '226 total leaves a 0.5lb/side residual, not silently rounded to exact');

console.log('plate-calc.selfcheck.cjs: all assertions passed');
