// Run with: node exercise-rx-tracking.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'exercise-rx-tracking.js'), 'utf8'), sandbox);
const { classifyRxOutcome } = sandbox.window.ExerciseRxTracking;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// classifyRxOutcome(rx, actual, priorWeight) -- priorWeight is the weight
// logged in the exposure BEFORE this one (what getRx() based its
// suggestion on), needed to tell "moved less than suggested" (edited) apart
// from "didn't move at all" (rejected) -- rx.weight alone can't distinguish
// those two cases.

// --- classifyRxOutcome: 'up' rx, priorWeight 100 ---
assertEqual(
  classifyRxOutcome({ type: 'up', weight: 105, reps: 5 }, { weight: 105, reps: 5 }, 100),
  'accepted',
  "up rx: logging exactly the suggested weight/reps is accepted"
);
assertEqual(
  classifyRxOutcome({ type: 'up', weight: 105, reps: 5 }, { weight: 102, reps: 5 }, 100),
  'edited',
  "up rx: logging a smaller increase than suggested (but still up from priorWeight) is edited"
);
assertEqual(
  classifyRxOutcome({ type: 'up', weight: 105, reps: 5 }, { weight: 100, reps: 5 }, 100),
  'rejected',
  "up rx: holding at priorWeight instead of adding is rejected"
);
assertEqual(
  classifyRxOutcome({ type: 'up', weight: 105, reps: 5 }, { weight: 95, reps: 5 }, 100),
  'rejected',
  "up rx: dropping below priorWeight when rx said add is rejected"
);

// --- classifyRxOutcome: 'down' rx (deload), priorWeight 100 ---
assertEqual(
  classifyRxOutcome({ type: 'down', weight: 90, reps: 8 }, { weight: 90, reps: 8 }, 100),
  'accepted',
  "down rx: logging exactly the suggested deload weight/reps is accepted"
);
assertEqual(
  classifyRxOutcome({ type: 'down', weight: 90, reps: 8 }, { weight: 95, reps: 8 }, 100),
  'edited',
  "down rx: logging a smaller deload than suggested (but still down from priorWeight) is edited"
);
assertEqual(
  classifyRxOutcome({ type: 'down', weight: 90, reps: 8 }, { weight: 100, reps: 8 }, 100),
  'rejected',
  "down rx: holding at priorWeight instead of deloading is rejected"
);
assertEqual(
  classifyRxOutcome({ type: 'down', weight: 90, reps: 8 }, { weight: 105, reps: 8 }, 100),
  'rejected',
  "down rx: adding weight above priorWeight when rx said deload is rejected"
);

// --- classifyRxOutcome: 'hold' rx, priorWeight 100 ---
assertEqual(
  classifyRxOutcome({ type: 'hold', weight: 100, reps: 7 }, { weight: 100, reps: 7 }, 100),
  'accepted',
  "hold rx: logging exactly the suggested weight/reps is accepted"
);
assertEqual(
  classifyRxOutcome({ type: 'hold', weight: 100, reps: 7 }, { weight: 100, reps: 6 }, 100),
  'edited',
  "hold rx: same weight, different reps than suggested is edited (not a direction change)"
);
assertEqual(
  classifyRxOutcome({ type: 'hold', weight: 100, reps: 7 }, { weight: 105, reps: 7 }, 100),
  'edited',
  "hold rx: a 'hold' has no up/down direction to contradict, so any deviation is edited, never rejected"
);

const { resolvePriorRxDecision } = sandbox.window.ExerciseRxTracking;

// --- resolvePriorRxDecision ---
assertEqual(
  resolvePriorRxDecision('accepted', false),
  'worked',
  "accepted + not stalled next time = worked"
);
assertEqual(
  resolvePriorRxDecision('edited', false),
  'worked',
  "edited + not stalled next time = worked"
);
assertEqual(
  resolvePriorRxDecision('accepted', true),
  'wrong',
  "accepted + stalled next time = wrong"
);
assertEqual(
  resolvePriorRxDecision('edited', true),
  'wrong',
  "edited + stalled next time = wrong"
);
assertEqual(
  resolvePriorRxDecision('rejected', false),
  'partly_worked',
  "rejected (Carl's own call) + not stalled = partly_worked"
);
assertEqual(
  resolvePriorRxDecision('rejected', true),
  'inconclusive',
  "rejected + stalled = inconclusive, no causation claimed"
);

console.log('exercise-rx-tracking.selfcheck.cjs: all classifyRxOutcome and resolvePriorRxDecision cases passed');
