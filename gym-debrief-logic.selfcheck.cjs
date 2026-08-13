// Run with: node gym-debrief-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-debrief-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.GymDebriefLogic;

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

// --- no prior session: no Rx to compare ---
assertEqual(
  L.formatRxComparison(null, '185lb×8'),
  '185lb×8 (first logged session, no Rx to compare)',
  'null rx falls back to performed-only text'
);

// --- uses the full reason sentence, not just the short tag ---
const rx = { type: 'up', weight: 185, reps: 8, tag: 'Add weight', reason: 'You hit 8 reps — time to add 5lb. Expect 6-7 next session.' };
assertEqual(
  L.formatRxComparison(rx, '190lb×8, 190lb×7, 190lb×6'),
  'Rx: You hit 8 reps — time to add 5lb. Expect 6-7 next session. Actual: 190lb×8, 190lb×7, 190lb×6',
  'formats using the full reason sentence, not the short tag'
);

// --- stall/RIR detail in reason survives into the debrief line (this is
// what the old prompt's dropped "any flags" instruction was fishing for) ---
const stalled = { type: 'down', weight: 166.5, reps: 8, tag: 'Deload', reason: 'Stuck at 185lb for 3 sessions, grinding to RIR 1.0. Drop 10%, reset, build back cleaner.' };
assertTrue(
  L.formatRxComparison(stalled, '185lb×7, 185lb×6').includes('RIR 1.0'),
  'RIR/stall detail from reason survives into the formatted line'
);

console.log('gym-debrief-logic.selfcheck.cjs: all assertions passed');
