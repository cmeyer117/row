// Run with: node gym-sleep-check-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-sleep-check-logic.js'), 'utf8'), sandbox);
const { isPoorSleepEntry } = sandbox.window.GymSleepCheckLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// No entry at all — not poor.
assertEqual(isPoorSleepEntry(null), false, 'isPoorSleepEntry: null entry is not poor');
assertEqual(isPoorSleepEntry(undefined), false, 'isPoorSleepEntry: undefined entry is not poor');

// hours threshold — below 6 is poor, 6 and above is not.
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: 5, quality: null }), true, 'isPoorSleepEntry: 5 hours is poor');
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: 7, quality: null }), false, 'isPoorSleepEntry: 7 hours is not poor');
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: 6, quality: null }), false, 'isPoorSleepEntry: exactly 6 hours is not poor');

// quality threshold — 2 or below is poor, 3 and above is not.
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: null, quality: 2 }), true, 'isPoorSleepEntry: quality 2 is poor');
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: null, quality: 3 }), false, 'isPoorSleepEntry: quality 3 is not poor');

// Either field alone can trigger it -- both null means no signal at all.
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: 4, quality: null }), true, 'isPoorSleepEntry: only hours logged, still triggers on a low value');
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: null, quality: null }), false, 'isPoorSleepEntry: both fields null is not poor (no data, not "poor")');

console.log('gym-sleep-check-logic.selfcheck.cjs: all assertions passed');
