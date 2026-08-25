// Run with: node gym-workout-closeout-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, 'gym-workout-closeout-logic.js'), 'utf8'),
  sandbox
);
const C = sandbox.window.GymWorkoutCloseoutLogic;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

const base = {
  today: '2026-08-25',
  exerciseId: 'press-1',
  exerciseName: 'Machine Shoulder Press',
  activeVariant: null,
  outcome: 'met',
  jointPain: [],
};

assertEqual(
  C.buildCloseoutCandidates({
    ...base,
    jointPain: [
      { exerciseId: 'press-1', joint: 'shoulder', severity: 6, date: '2026-08-22' },
      { exerciseId: 'press-1', joint: 'shoulder', severity: 7, date: '2026-08-25' },
      { exerciseId: 'row-1', joint: 'shoulder', severity: 8, date: '2026-08-25' },
    ],
  }),
  [{
    exerciseId: 'press-1',
    kind: 'joint-pain',
    text: 'Shoulder flagged twice in 7 days — review load and range before Machine Shoulder Press.',
  }],
  'scoped repeated joint flags create one exercise-specific candidate'
);

assertEqual(
  C.buildCloseoutCandidates({
    ...base,
    activeVariant: 'Dumbbell Neutral Grip Shoulder Press',
    outcome: 'missed',
  }),
  [
    {
      exerciseId: 'press-1',
      kind: 'substitution',
      text: 'Substituted Dumbbell Neutral Grip Shoulder Press last session — check whether it should stick.',
    },
    {
      exerciseId: 'press-1',
      kind: 'missed-progression',
      text: 'Came up short of the last Rx — repeat before adding weight.',
    },
  ],
  'substitution and missed progression are separate acknowledgement choices'
);

assertEqual(
  C.buildCloseoutCandidates({
    ...base,
    jointPain: [{ joint: 'shoulder', severity: 8, date: '2026-08-25' }],
  }),
  [],
  'legacy unscoped pain is never falsely attributed to an exercise'
);

const closeout = {
  date: '2026-08-25',
  kind: 'missed-progression',
  text: 'Came up short of the last Rx — repeat before adding weight.',
  acknowledgedAt: '2026-08-25T20:00:00.000Z',
};
assertEqual(
  C.getPendingCloseoutAdvisory({ closeout, exerciseLogs: [{ date: '2026-08-25T12:00:00.000Z' }] }),
  closeout.text,
  'same-date logs do not prematurely hide the next-session note'
);
assertEqual(
  C.getPendingCloseoutAdvisory({ closeout, exerciseLogs: [{ date: '2026-08-26T12:00:00.000Z' }] }),
  null,
  'a later exercise log consumes the pending note'
);
assertEqual(
  C.getPendingCloseoutAdvisory({ closeout: { date: 'bad', text: 'x' }, exerciseLogs: [] }),
  null,
  'malformed records never create an advisory'
);

console.log('gym-workout-closeout-logic.selfcheck.cjs: all assertions passed');
