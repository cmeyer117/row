// Run with: node row-wrapped-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'row-wrapped-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.RowWrappedLogic;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}
function assertTrue(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); process.exit(1); }
}

// --- quarterBounds ---
let b = L.quarterBounds(new Date('2026-08-07T12:00:00Z'));
assertEqual(b.label, 'Q3 2026', 'August 7 falls in Q3 2026');
assertEqual(b.start.toISOString().slice(0, 10), '2026-07-01', 'Q3 starts July 1');
assertEqual(b.end.toISOString().slice(0, 10), '2026-08-07', 'Q3 "so far" ends at now, not Sep 30');

b = L.quarterBounds(new Date('2026-01-15T12:00:00Z'));
assertEqual(b.label, 'Q1 2026', 'January falls in Q1');
assertEqual(b.start.toISOString().slice(0, 10), '2026-01-01', 'Q1 starts January 1');

b = L.quarterBounds(new Date('2027-01-02T12:00:00Z'));
assertEqual(b.label, 'Q1 2027', 'a new year rolls the quarter label correctly (Dec->Jan edge)');
assertEqual(b.start.toISOString().slice(0, 10), '2027-01-01', 'Q1 2027 starts Jan 1 2027, not Dec 2026');

b = L.quarterBounds(new Date('2028-02-29T12:00:00Z'));
assertEqual(b.label, 'Q1 2028', 'leap-year Feb 29 falls in Q1 without crashing');

// --- quarterPRs ---
const exercises = [
  { id: 'ex1', name: 'Bench Press', bw: false },
  { id: 'ex2', name: 'Pull-ups', bw: true }
];
let logs = {
  ex1: [
    { date: '2026-05-01T12:00:00Z', weight: 185, reps: 5 },
    { date: '2026-07-10T12:00:00Z', weight: 195, reps: 5 }
  ],
  ex2: [
    { date: '2026-05-01T12:00:00Z', weight: 0, reps: 12 },
    { date: '2026-07-15T12:00:00Z', weight: 0, reps: 10 }
  ]
};
let bounds = L.quarterBounds(new Date('2026-08-07T12:00:00Z'));
let prs = L.quarterPRs(exercises, logs, bounds);
assertEqual(prs.length, 1, 'exactly one exercise qualifies as a new PR this quarter');
assertEqual(prs[0].exerciseId, 'ex1', 'the qualifying PR is the bench press, not the pull-ups');
assertTrue(prs[0].e1rm > prs[0].priorBest, 'the qualifying PR e1RM genuinely exceeds the prior best');

logs = { ex1: [{ date: '2026-07-10T12:00:00Z', weight: 100, reps: 5 }] };
prs = L.quarterPRs([exercises[0]], logs, bounds);
assertEqual(prs.length, 1, 'a first-ever log in the window with no prior history counts as a PR');
assertEqual(prs[0].priorBest, 0, 'priorBest is 0 when there is no log before the window');

prs = L.quarterPRs([], {}, bounds);
assertEqual(prs, [], 'no exercises and no logs returns an empty array, not null or a crash');

// --- quarterVolume ---
logs = {
  ex1: [
    { date: '2026-05-01T12:00:00Z', weight: 100, reps: 10 },
    { date: '2026-07-10T12:00:00Z', weight: 100, reps: 10 },
    { date: '2026-07-20T12:00:00Z', weight: 200, reps: 5 }
  ]
};
assertEqual(L.quarterVolume(logs, bounds), 2000, 'quarterVolume sums only in-window logs, excludes the pre-window one');
assertEqual(L.quarterVolume({}, bounds), 0, 'quarterVolume of no logs is a real 0, not an error');

// --- longestStreak ---
logs = {
  ex1: [
    { date: '2026-07-01T12:00:00Z', weight: 100, reps: 5 },
    { date: '2026-07-02T12:00:00Z', weight: 100, reps: 5 },
    { date: '2026-07-03T12:00:00Z', weight: 100, reps: 5 },
    { date: '2026-07-06T12:00:00Z', weight: 100, reps: 5 },
    { date: '2026-07-07T12:00:00Z', weight: 100, reps: 5 }
  ]
};
assertEqual(L.longestStreak(logs, bounds), 3, 'longest streak is 3 (Jul 1-3), not the later 2-day run (Jul 6-7)');

logs = { ex1: [{ date: '2026-07-01T12:00:00Z', weight: 100, reps: 5 }] };
assertEqual(L.longestStreak(logs, bounds), 1, 'a single training day is a streak of 1');

assertEqual(L.longestStreak({}, bounds), 0, 'zero training days in the window is a streak of 0, not 1');

logs = {
  ex1: [{ date: '2026-07-01T12:00:00Z', weight: 100, reps: 5 }],
  ex2: [{ date: '2026-07-01T12:00:00Z', weight: 0, reps: 8 }],
};
assertEqual(L.longestStreak(logs, bounds), 1, 'two exercises logged the same day form one training day, not a streak of 2');

logs = { ex1: [{ date: bounds.end.toISOString(), weight: 100, reps: 5 }] };
assertEqual(L.longestStreak(logs, bounds), 1, 'a log dated exactly on bounds.end is included in the window');

// --- quarterBodyweightSeries ---
const weights = [
  { dateKey: '2026-06-15', weight: 210 },
  { dateKey: '2026-07-05', weight: 205 },
  { dateKey: '2026-07-25', weight: 202 }
];
let series = L.quarterBodyweightSeries(weights, bounds);
assertEqual(series.length, 2, 'quarterBodyweightSeries excludes the pre-window weigh-in');
assertEqual(series[0].dateKey, '2026-07-05', 'series is sorted ascending by date');

assertEqual(L.quarterBodyweightSeries([], bounds), [], 'no weigh-ins returns an empty array');

console.log('row-wrapped-logic.selfcheck.cjs: all assertions passed');
