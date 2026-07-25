// Run with: node gym-state-merge-logic.selfcheck.cjs
// (See gym-season-logic.selfcheck.cjs for why this repo's own .selfcheck.js
// convention doesn't actually run given package.json's "type":"module" --
// same workaround here: execute the real browser file's source in a
// sandboxed `window` rather than fighting Node's module resolution.)
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'gym-state-merge-logic.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { mergeLogs, totalLogCount } = sandbox.window.GymStateMergeLogic;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

// Remote wins when both have the exact same entries.
assertEqual(
  mergeLogs({ ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }] }, { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }] }),
  { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }] },
  'identical entries produce no duplication'
);

// A local-only entry (never synced) survives the merge.
assertEqual(
  mergeLogs(
    { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }] },
    { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }, { weight: 230, reps: 6, date: '2026-07-08' }] }
  ),
  { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }, { weight: 230, reps: 6, date: '2026-07-08' }] },
  'local-only entry not yet pushed is preserved, not dropped'
);

// This is the actual bug being fixed: remote logs wiped to {} must not
// destroy real local history -- it should come back from local instead.
assertEqual(
  mergeLogs({}, { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }] }),
  { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }] },
  'empty remote logs does not erase real local history'
);

// An exercise only logged locally (never pushed at all) still appears.
assertEqual(
  mergeLogs({ ex1: [{ weight: 100, reps: 10, date: '2026-07-01' }] }, { ex2: [{ weight: 50, reps: 12, date: '2026-07-02' }] }),
  { ex1: [{ weight: 100, reps: 10, date: '2026-07-01' }], ex2: [{ weight: 50, reps: 12, date: '2026-07-02' }] },
  'exercise present only locally is not dropped'
);

// A genuinely new remote entry (from a different device) is picked up.
assertEqual(
  mergeLogs(
    { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }, { weight: 230, reps: 5, date: '2026-07-05' }] },
    { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }] }
  ),
  { ex1: [{ weight: 225, reps: 8, date: '2026-07-01' }, { weight: 230, reps: 5, date: '2026-07-05' }] },
  'new entry pushed from another device is not lost'
);

assertEqual(totalLogCount({ ex1: [{}, {}], ex2: [{}] }), 3, 'totalLogCount sums across all exercises');
assertEqual(totalLogCount({}), 0, 'totalLogCount handles empty logs');
assertEqual(totalLogCount(null), 0, 'totalLogCount handles null/missing logs');

console.log('gym-state-merge-logic.selfcheck.cjs: all assertions passed');
