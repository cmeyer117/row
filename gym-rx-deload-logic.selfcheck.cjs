// Run with: node gym-rx-deload-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-rx-deload-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.GymRxDeloadLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}
function assertTrue(cond, label) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
}

// --- the actual bug found by the 2026-08-13 Codex audit: small load, large
// step, flat 10% would round back to the exact same weight ---
let r = L.deloadWeight(15, 5, 8);
assertTrue(r.weight < 15, 'small load / large step deload is strictly below the starting weight (was rounding to the same weight)');

// --- compound-style (repMin <= 6) gets a bigger cut than isolation-style (repMin >= 8) ---
const compound = L.deloadWeight(200, 5, 6);
const isolation = L.deloadWeight(200, 5, 8);
assertTrue(compound.pct > isolation.pct, 'compound-style rep range gets a bigger deload percentage than isolation-style');
assertEqual(compound.pct, 15, 'compound-style (repMin<=6) is 15%');
assertEqual(isolation.pct, 5, 'isolation-style (repMin>=8) is 5%');

// --- mid-range repMin (7) falls back to the original flat 10% ---
const mid = L.deloadWeight(200, 5, 7);
assertEqual(mid.pct, 10, 'mid-range repMin (7) uses the original flat 10%');

// --- always a real decrease, never equal to or above the starting weight ---
for (const [weight, step, repMin] of [[15, 5, 8], [100, 10, 5], [22.5, 2.5, 9], [50, 25, 6]]) {
  const result = L.deloadWeight(weight, step, repMin);
  assertTrue(result.weight < weight, `deloadWeight(${weight}, ${step}, ${repMin}) is strictly below the starting weight`);
}

// --- never goes negative for a small weight near the step size ---
r = L.deloadWeight(5, 5, 8);
assertTrue(r.weight >= 0, 'deload never returns a negative weight');

console.log('gym-rx-deload-logic.selfcheck.cjs: all assertions passed');
