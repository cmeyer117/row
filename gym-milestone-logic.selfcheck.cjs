// Run with: node gym-milestone-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
const source = fs.readFileSync(path.join(__dirname, 'gym-milestone-logic.js'), 'utf8');
vm.runInContext(source, sandbox);
const { recordMilestone, unrecordMilestone } = sandbox.window.GymMilestoneLogic;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

// A real PR appends a narrow record.
assertEqual(
  recordMilestone([], { eventType: 'pr', exercise: 'Deadlift', dateKey: '2026-08-20' }),
  [{ date: '2026-08-20', exercise: 'Deadlift', type: 'pr' }],
  'a PR event is recorded'
);

// A non-PR (grind/miss/null) is a no-op.
assertEqual(recordMilestone([{ date: '2026-08-01', exercise: 'Squat', type: 'pr' }], { eventType: 'grind', exercise: 'Bench', dateKey: '2026-08-20' }),
  [{ date: '2026-08-01', exercise: 'Squat', type: 'pr' }], 'grind is not recorded');
assertEqual(recordMilestone([], { eventType: null, exercise: 'Bench', dateKey: '2026-08-20' }), [], 'null eventType is not recorded');
assertEqual(recordMilestone([], { eventType: 'pr', exercise: 'Bench', dateKey: null }), [], 'missing dateKey is not recorded');

// Only narrow fields are stored -- no weight/reps ever leak in.
const rec = recordMilestone([], { eventType: 'pr', exercise: 'Bench', dateKey: '2026-08-20', weight: 225, reps: 5 })[0];
assertEqual(Object.keys(rec).sort(), ['date', 'exercise', 'type'], 'only date/exercise/type fields are stored');

// Cap at 20, oldest dropped.
let list = [];
for (let i = 0; i < 25; i++) {
  const d = '2026-01-' + String(i + 1).padStart(2, '0');
  list = recordMilestone(list, { eventType: 'pr', exercise: 'Ex' + i, dateKey: d });
}
assertEqual(list.length, 20, 'capped at 20 milestones');
assertEqual(list[0].exercise, 'Ex5', 'oldest milestones dropped off the front');

// unrecordMilestone: undo reverses the exact milestone a set caused.
assertEqual(
  unrecordMilestone([{ date: '2026-08-20', exercise: 'Deadlift', type: 'pr' }], { exercise: 'Deadlift', dateKey: '2026-08-20' }),
  [], 'undo removes the matching PR milestone'
);
// Only the LAST matching entry is removed, not all -- a same-day non-PR
// undo shouldn't touch an earlier real PR for a different exercise.
assertEqual(
  unrecordMilestone(
    [{ date: '2026-08-20', exercise: 'Squat', type: 'pr' }, { date: '2026-08-20', exercise: 'Deadlift', type: 'pr' }],
    { exercise: 'Squat', dateKey: '2026-08-20' }
  ),
  [{ date: '2026-08-20', exercise: 'Deadlift', type: 'pr' }],
  'undo only removes the matching exercise/date entry, leaves others'
);
// No match (e.g. undoing a non-PR set) is a no-op.
assertEqual(
  unrecordMilestone([{ date: '2026-08-20', exercise: 'Deadlift', type: 'pr' }], { exercise: 'Bench', dateKey: '2026-08-20' }),
  [{ date: '2026-08-20', exercise: 'Deadlift', type: 'pr' }],
  'no matching milestone is a no-op'
);

console.log('PASS gym-milestone-logic');
