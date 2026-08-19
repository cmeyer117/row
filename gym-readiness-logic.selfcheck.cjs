// Run with: node gym-readiness-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-readiness-logic.js'), 'utf8'), sandbox);
const R = sandbox.window.GymReadinessLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

const RECOVERY_SCORE = { low: 1, med: 2, high: 3 };

// --- recoveryTrend ---
// checkins: { 'YYYY-MM-DD': { recovery: 'low'|'med'|'high'|null, ... } }.
// refSunday: the Sunday the trailing 7-day window ends on (inclusive).
const checkins14 = {
  '2026-08-03': { recovery: 'low' }, '2026-08-04': { recovery: 'low' }, '2026-08-05': { recovery: 'med' },
  '2026-08-06': { recovery: 'low' }, '2026-08-07': { recovery: 'med' }, '2026-08-08': { recovery: 'low' }, '2026-08-09': { recovery: 'low' },
  '2026-08-10': { recovery: 'high' }, '2026-08-11': { recovery: 'high' }, '2026-08-12': { recovery: 'med' },
  '2026-08-13': { recovery: 'high' }, '2026-08-14': { recovery: 'med' }, '2026-08-15': { recovery: 'high' }, '2026-08-16': { recovery: 'high' },
};
const trend = R.recoveryTrend(checkins14, '2026-08-16', RECOVERY_SCORE);
assertEqual(trend.direction, 'up', 'recoveryTrend: second week averaged higher than first -- direction up');

const flatCheckins = {
  '2026-08-10': { recovery: 'med' }, '2026-08-11': { recovery: 'med' }, '2026-08-12': { recovery: 'med' },
  '2026-08-13': { recovery: 'med' }, '2026-08-14': { recovery: 'med' }, '2026-08-15': { recovery: 'med' }, '2026-08-16': { recovery: 'med' },
};
const flatTrend = R.recoveryTrend(flatCheckins, '2026-08-16', RECOVERY_SCORE);
assertEqual(flatTrend.direction, 'flat', 'recoveryTrend: identical weeks (no prior data to compare) -- flat, not up/down');

const noData = R.recoveryTrend({}, '2026-08-16', RECOVERY_SCORE);
assertEqual(noData.direction, null, 'recoveryTrend: no checkin data at all -- direction null');
assertEqual(noData.avgLast7, null, 'recoveryTrend: no data -- avgLast7 null');

// entries with no recovery rating (null) are excluded from the average, not
// treated as 0.
const partialCheckins = { '2026-08-16': { recovery: 'high' }, '2026-08-15': { pain: 'low' } };
const partialTrend = R.recoveryTrend(partialCheckins, '2026-08-16', RECOVERY_SCORE);
assertEqual(partialTrend.avgLast7, 3, 'recoveryTrend: entries with no recovery field are excluded, not counted as 0');

// --- mobilityExceptionsInWeek ---
const jointPain = [
  { joint: 'knee', severity: 'med', date: '2026-08-11' },
  { joint: 'shoulder', severity: 'low', date: '2026-08-13' },
  { joint: 'knee', severity: 'high', date: '2026-08-03' }, // outside the window
];
const exceptions = R.mobilityExceptionsInWeek(jointPain, '2026-08-10', '2026-08-16');
assertEqual(exceptions.length, 2, 'mobilityExceptionsInWeek: only entries within the Monday-Sunday window');
assertEqual(exceptions[0].joint, 'knee', 'mobilityExceptionsInWeek: preserves entry shape/order');

assertEqual(R.mobilityExceptionsInWeek([], '2026-08-10', '2026-08-16').length, 0, 'mobilityExceptionsInWeek: empty input returns empty array');
assertEqual(R.mobilityExceptionsInWeek(null, '2026-08-10', '2026-08-16').length, 0, 'mobilityExceptionsInWeek: null input returns empty array, does not crash');

console.log('All gym-readiness-logic self-checks passed.');
