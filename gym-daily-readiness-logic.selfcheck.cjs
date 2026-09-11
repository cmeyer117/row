// Run with: node gym-daily-readiness-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-daily-readiness-logic.js'), 'utf8'), sandbox);
const { computeDailyReadiness } = sandbox.window.GymDailyReadinessLogic;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

const isPoorSleep = function (entry) {
  return !!entry && (entry.hours != null && entry.hours < 6 || entry.quality != null && entry.quality <= 2);
};

// No data at all -- neutral 'ready', no factors.
assertEqual(
  computeDailyReadiness(null, null, isPoorSleep),
  { level: 'ready', label: 'Ready', factors: [] },
  'no sleep or checkin data: ready, no factors'
);

// Pain always wins, even with a great night's sleep and high recovery.
assertEqual(
  computeDailyReadiness({ hours: 8, quality: 5 }, { pain: 'high', recovery: 'high', pump: null }, isPoorSleep),
  { level: 'rest', label: 'Rest signal', factors: ['pain reported high'] },
  'high pain overrides everything else: rest'
);

// Low recovery alone triggers caution.
assertEqual(
  computeDailyReadiness(null, { pain: null, recovery: 'low', pump: null }, isPoorSleep),
  { level: 'caution', label: 'Caution', factors: ['recovery reported low'] },
  'low recovery alone: caution'
);

// Poor sleep alone triggers caution, independent of checkin.
assertEqual(
  computeDailyReadiness({ hours: 4, quality: null }, null, isPoorSleep),
  { level: 'caution', label: 'Caution', factors: ['sleep short or poor'] },
  'poor sleep alone (no checkin at all): caution'
);

// Both poor sleep and low recovery -- caution, both factors named.
assertEqual(
  computeDailyReadiness({ hours: 4, quality: null }, { pain: null, recovery: 'low', pump: null }, isPoorSleep),
  { level: 'caution', label: 'Caution', factors: ['recovery reported low', 'sleep short or poor'] },
  'poor sleep and low recovery together: caution, both factors named'
);

// High recovery + good sleep (>=7h, not poor) -- primed.
assertEqual(
  computeDailyReadiness({ hours: 7.5, quality: 4 }, { pain: null, recovery: 'high', pump: null }, isPoorSleep),
  { level: 'primed', label: 'Primed', factors: ['recovery reported high', 'slept 7.5h'] },
  'high recovery + 7.5h good sleep: primed'
);

// High recovery alone (no sleep data) is not enough for primed -- needs both.
assertEqual(
  computeDailyReadiness(null, { pain: null, recovery: 'high', pump: null }, isPoorSleep),
  { level: 'ready', label: 'Ready', factors: ['recovery reported high'] },
  'high recovery with no sleep data: ready (not primed -- needs sleep too), factor still named'
);

// Good sleep alone (no checkin) is not enough for primed -- needs both.
assertEqual(
  computeDailyReadiness({ hours: 8, quality: 5 }, null, isPoorSleep),
  { level: 'ready', label: 'Ready', factors: ['slept 8h'] },
  'good sleep with no checkin: ready (not primed -- needs recovery too), factor still named'
);

// Medium recovery + neutral sleep (not poor, but under 7h) -- plain ready, no factors.
assertEqual(
  computeDailyReadiness({ hours: 6.5, quality: 4 }, { pain: null, recovery: 'med', pump: null }, isPoorSleep),
  { level: 'ready', label: 'Ready', factors: [] },
  'medium recovery + ok-but-not-great sleep: ready, no factors either way'
);

// isPoorSleepFn not a function (defensive) -- never throws, treats as not-poor.
assertEqual(
  computeDailyReadiness({ hours: 4, quality: null }, null, undefined),
  { level: 'ready', label: 'Ready', factors: [] },
  'missing isPoorSleepFn: does not throw, treats sleep as not-poor'
);

console.log('gym-daily-readiness-logic.selfcheck.cjs: all assertions passed');
