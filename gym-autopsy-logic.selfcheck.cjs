// Run with: node gym-autopsy-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-autopsy-logic.js'), 'utf8'), sandbox);
const A = sandbox.window.GymAutopsyLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

// --- classifyRxOutcome ---
assertEqual(A.classifyRxOutcome(null), null, 'null rx (first session) classifies as null');
assertEqual(A.classifyRxOutcome({ type: 'up', tag: 'Add weight' }), 'beat', 'type up classifies as beat');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Add a rep' }), 'met', 'hold + Add a rep classifies as met');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Push for more' }), 'met', 'hold + Push for more (bodyweight) classifies as met');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Peak — hold' }), 'met', 'peak-week hold classifies as met');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Repeat' }), 'missed', 'hold + Repeat (fell short of repMin) classifies as missed');
assertEqual(A.classifyRxOutcome({ type: 'down', tag: 'Deload' }), 'missed', 'type down (deload) classifies as missed');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Reassess' }), 'missed', 'Reassess (stall) classifies as missed');

// --- sessionNeedsReason ---
assertEqual(A.sessionNeedsReason(['beat', 'met']), false, 'all beat/met: no reason needed');
assertEqual(A.sessionNeedsReason(['beat', 'missed']), true, 'any missed: reason needed');
assertEqual(A.sessionNeedsReason([null, null]), false, 'all null (first sessions only): no reason needed');
assertEqual(A.sessionNeedsReason([]), false, 'empty list: no reason needed');

// --- pickSuggestedChange: ranks by volumeAdvisory.priority, highest wins ---
const low = { volumeAdvisory: { suggestion: 'add_set', priority: 0, reason: 'stall reason' } };
const high = { volumeAdvisory: { suggestion: 'pull_back', priority: 3, reason: 'mrv reason' } };
const mid = { volumeAdvisory: { suggestion: 'add_set', priority: 1, reason: 'phase reason' } };
assertEqual(A.pickSuggestedChange([low, high, mid]), 'mrv reason', 'picks the highest-priority advisory reason across exercises');
assertEqual(A.pickSuggestedChange([low]), 'stall reason', 'single flagged exercise: its own reason wins');
assertEqual(A.pickSuggestedChange([{ volumeAdvisory: null }, { volumeAdvisory: null }]), null, 'no exercise flagged: null');
assertEqual(A.pickSuggestedChange([]), null, 'no exercises logged: null');
assertEqual(A.pickSuggestedChange([null, high]), 'mrv reason', 'tolerates null rx entries (first-ever sessions) mixed in');

console.log('All gym-autopsy-logic self-checks passed.');
