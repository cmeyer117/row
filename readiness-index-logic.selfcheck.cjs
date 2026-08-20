// Run with: node readiness-index-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'readiness-index-logic.js'), 'utf8'), sandbox);
const R = sandbox.window.ReadinessIndexLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

// --- averageScore ---
assertEqual(R.averageScore({ scores: [{ pose: 'front double biceps', score: 4 }, { pose: 'side chest', score: 3 }, { pose: 'back double biceps', score: 5 }] }), 4, 'averageScore: mean of 3 scores');
assertEqual(R.averageScore({ scores: [{ pose: 'a', score: 3 }, { pose: 'b', score: null }] }), 3, 'averageScore: excludes non-numeric scores, not counted as 0');
assertEqual(R.averageScore({ scores: [] }), null, 'averageScore: empty scores -- null');
assertEqual(R.averageScore({}), null, 'averageScore: missing scores field -- null, does not crash');

// --- trend ---
assertEqual(R.trend(4, 3), 'up', 'trend: higher average -- up');
assertEqual(R.trend(3, 4), 'down', 'trend: lower average -- down');
assertEqual(R.trend(3, 3), 'flat', 'trend: equal averages -- flat');
assertEqual(R.trend(4, null), null, 'trend: no prior check-in -- null, not flat');
assertEqual(R.trend(null, 4), null, 'trend: no current average -- null');

// --- latestCheckin ---
const list = [
  { date: '2026-07-01', scores: [{ pose: 'a', score: 3 }] },
  { date: '2026-08-01', scores: [{ pose: 'a', score: 4 }] },
  { date: '2026-06-01', scores: [{ pose: 'a', score: 2 }] },
];
assertEqual(R.latestCheckin(list).date, '2026-08-01', 'latestCheckin: most recent by date, unsorted input');
assertEqual(R.latestCheckin([]), null, 'latestCheckin: empty list -- null');
assertEqual(R.latestCheckin(null), null, 'latestCheckin: null input -- null, does not crash');

// --- daysSince ---
assertEqual(R.daysSince('2026-08-08', '2026-08-20'), 12, 'daysSince: whole days between dates');
assertEqual(R.daysSince('2026-08-20', '2026-08-20'), 0, 'daysSince: same date -- 0');

console.log('All readiness-index-logic self-checks passed.');
