// Run with: node gym-volume-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-volume-logic.js'), 'utf8'), sandbox);
const { mondayOfDate, weeklyVolumeByDay } = sandbox.window.GymVolumeLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// mondayOfDate — a known Wednesday maps to that week's Monday.
assertEqual(mondayOfDate(new Date('2026-08-05T12:00:00Z')), '2026-08-03', 'mondayOfDate maps a Wednesday to the same week\'s Monday');

// mondayOfDate — a Sunday maps BACKWARD to the same week's Monday, not forward to next week.
assertEqual(mondayOfDate(new Date('2026-08-09T12:00:00Z')), '2026-08-03', 'mondayOfDate maps a Sunday to the same week\'s Monday, not the next week\'s');

// weeklyVolumeByDay — two sets in the same week, same exercise, sum into one bucket.
const thisMonday = mondayOfDate(new Date());
const sameWeekA = thisMonday + 'T12:00:00.000Z';
const sameWeekBDate = new Date(thisMonday + 'T00:00:00Z');
sameWeekBDate.setUTCDate(sameWeekBDate.getUTCDate() + 2);
const sameWeekB = sameWeekBDate.toISOString();

const exercises = [{ id: 'a', day: 'push' }];
const logsSameWeek = { a: [
  { date: sameWeekA, weight: 100, reps: 10 },
  { date: sameWeekB, weight: 100, reps: 8 },
] };
const resultSameWeek = weeklyVolumeByDay(exercises, logsSameWeek, 'all', 4);
const thisWeekEntry = resultSameWeek.find((w) => w.weekKey === thisMonday);
assertEqual(thisWeekEntry.totalVol, 100 * 10 + 100 * 8, 'weeklyVolumeByDay sums two same-week sets into one bucket');

// weeklyVolumeByDay — sets from different weeks land in different buckets.
const priorMondayDate = new Date(thisMonday + 'T00:00:00Z');
priorMondayDate.setUTCDate(priorMondayDate.getUTCDate() - 7);
const priorMonday = priorMondayDate.toISOString().slice(0, 10);
const logsDiffWeeks = { a: [
  { date: sameWeekA, weight: 100, reps: 10 },
  { date: priorMonday + 'T12:00:00.000Z', weight: 50, reps: 5 },
] };
const resultDiffWeeks = weeklyVolumeByDay(exercises, logsDiffWeeks, 'all', 4);
assertEqual(resultDiffWeeks.find((w) => w.weekKey === thisMonday).totalVol, 1000, 'weeklyVolumeByDay keeps this week\'s volume separate from last week\'s');
assertEqual(resultDiffWeeks.find((w) => w.weekKey === priorMonday).totalVol, 250, 'weeklyVolumeByDay keeps last week\'s volume separate from this week\'s');

// weeklyVolumeByDay — dayFilter excludes exercises from other days, 'all' includes everything.
const twoDayExercises = [{ id: 'a', day: 'push' }, { id: 'b', day: 'pull' }];
const twoDayLogs = {
  a: [{ date: sameWeekA, weight: 100, reps: 10 }],
  b: [{ date: sameWeekA, weight: 50, reps: 10 }],
};
const pushOnly = weeklyVolumeByDay(twoDayExercises, twoDayLogs, 'push', 4);
assertEqual(pushOnly.find((w) => w.weekKey === thisMonday).totalVol, 1000, 'weeklyVolumeByDay with dayFilter=push excludes the pull exercise\'s volume');
const allDays = weeklyVolumeByDay(twoDayExercises, twoDayLogs, 'all', 4);
assertEqual(allDays.find((w) => w.weekKey === thisMonday).totalVol, 1500, 'weeklyVolumeByDay with dayFilter=all includes both exercises\' volume');

// weeklyVolumeByDay — a bodyweight exercise (weight: 0) contributes 0, not NaN.
const bwLogs = { a: [{ date: sameWeekA, weight: 0, reps: 12 }] };
const bwResult = weeklyVolumeByDay(exercises, bwLogs, 'all', 4);
assertEqual(bwResult.find((w) => w.weekKey === thisMonday).totalVol, 0, 'weeklyVolumeByDay treats a bodyweight exercise (weight 0) as 0 volume, not NaN');

// weeklyVolumeByDay — a week with zero logged sets appears as a real 0, not omitted.
const sparseResult = weeklyVolumeByDay(exercises, logsSameWeek, 'all', 4);
assertEqual(sparseResult.find((w) => w.weekKey === priorMonday).totalVol, 0, 'weeklyVolumeByDay includes a zero-volume week rather than omitting it');

// weeklyVolumeByDay — weeksBack caps the returned array length.
assertEqual(weeklyVolumeByDay(exercises, logsSameWeek, 'all', 3).length, 3, 'weeklyVolumeByDay respects weeksBack');
assertEqual(weeklyVolumeByDay(exercises, logsSameWeek, 'all', 10).length, 10, 'weeklyVolumeByDay defaults/respects a larger weeksBack too');

console.log('gym-volume-logic.selfcheck.cjs: all assertions passed');
