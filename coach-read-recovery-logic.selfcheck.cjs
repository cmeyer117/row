// Run with: node coach-read-recovery-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, 'coach-read-recovery-logic.js'), 'utf8'),
  sandbox
);
const R = sandbox.window.CoachReadRecoveryLogic;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

const TODAY = '2026-08-25';
const NOW = Date.parse('2026-08-25T12:00:00Z');
const STALE_WEEK = '2026-08-14';

const base = {
  weekOf: STALE_WEEK,
  nowMs: NOW,
  today: TODAY,
  weights: [{ dateKey: TODAY, weight: 205.4 }],
  sleep: [{ date: TODAY, hours: 7.5, quality: null }],
};

assertEqual(
  R.buildStaleCoachReadRecovery(base),
  {
    weekLabel: '· stale (week of 2026-08-14)',
    weight: { text: 'Weigh-in logged today', href: 'gym.html' },
    sleep: { text: 'Sleep logged today', href: '#sleepQuick' },
    review: { text: 'Open weekly review →', href: 'weekly-review.html' },
  },
  'stale read with today weight and sleep -> complete recovery checklist'
);

assertEqual(
  R.buildStaleCoachReadRecovery({
    ...base,
    weekOf: '2026-08-13',
    weights: [{ dateKey: '2026-08-23', weight: 206 }],
    sleep: [],
  }),
  {
    weekLabel: '· stale (week of 2026-08-13)',
    weight: { text: 'Last weigh-in: 2026-08-23', href: 'gym.html' },
    sleep: { text: 'Sleep not logged today', href: '#sleepQuick' },
    review: { text: 'Open weekly review →', href: 'weekly-review.html' },
  },
  'stale read with older weight and no sleep -> actionable missing statuses'
);

assertEqual(
  R.buildStaleCoachReadRecovery({ ...base, weekOf: '2026-08-16' }),
  null,
  'exactly ten days old is fresh under the existing days > 10 boundary'
);

assertEqual(
  R.buildStaleCoachReadRecovery({
    ...base,
    weekOf: null,
    weights: [{ dateKey: '', weight: 205 }, null, { dateKey: '2026-08-24', weight: null }],
    sleep: 'not-an-array',
  }),
  null,
  'missing weekOf preserves no-stale-state behavior despite malformed logs'
);

assertEqual(
  R.buildStaleCoachReadRecovery({
    ...base,
    weights: [{ dateKey: '', weight: 205 }, null, { dateKey: '2026-08-24', weight: null }],
    sleep: 'not-an-array',
  }),
  {
    weekLabel: '· stale (week of 2026-08-14)',
    weight: { text: 'No weigh-in logged', href: 'gym.html' },
    sleep: { text: 'Sleep not logged today', href: '#sleepQuick' },
    review: { text: 'Open weekly review →', href: 'weekly-review.html' },
  },
  'malformed logs do not hide a valid stale recovery checklist'
);

console.log('coach-read-recovery-logic.selfcheck.cjs: all assertions passed');
