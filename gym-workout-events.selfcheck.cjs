// Run with: node gym-workout-events.selfcheck.cjs
//
// gym-workout-events.js is loaded via a plain <script src> in gym.html (not
// type="module"), so it can't use ESM export/import without breaking that
// page load -- and Row's package.json sets "type": "module", which breaks
// plain require() of a same-package .js file the other way (see
// gym-season-logic.selfcheck.cjs's header comment for the same issue).
// This runs the actual browser file's source against a fake `window`
// instead of fighting Node's module resolution.
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
const source = fs.readFileSync(path.join(__dirname, 'gym-workout-events.js'), 'utf8');
vm.runInContext(source, sandbox);
const { classifyWorkoutEvent } = sandbox.window.GymWorkoutEvents;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

const weightedEx = { bw: false, repMin: 6, repMax: 10 };
const bwEx = { bw: true, repMin: 6, repMax: 12 };

// First-ever log for an exercise never fires an event, regardless of reps.
assertEqual(classifyWorkoutEvent({ weight: 135, reps: 6 }, [], weightedEx), null, 'first log never fires an event');

// Weighted PR — beats prior max e1RM.
assertEqual(
  classifyWorkoutEvent({ weight: 225, reps: 5 }, [{ weight: 205, reps: 5 }], weightedEx),
  'pr',
  'weighted set beating prior e1RM is a pr'
);

// Weighted grind — reps exactly at repMin, not a PR.
assertEqual(
  classifyWorkoutEvent({ weight: 205, reps: 6 }, [{ weight: 205, reps: 8 }], weightedEx),
  'grind',
  'reps landing exactly at repMin is a grind'
);

// Weighted miss — reps under repMin.
assertEqual(
  classifyWorkoutEvent({ weight: 205, reps: 4 }, [{ weight: 205, reps: 8 }], weightedEx),
  'miss',
  'reps under repMin is a miss'
);

// Weighted mid-range — no event (lower e1RM than prior best, reps above repMin).
assertEqual(
  classifyWorkoutEvent({ weight: 205, reps: 8 }, [{ weight: 205, reps: 9 }], weightedEx),
  null,
  'mid-range reps that are not a new best fire nothing'
);

// Bodyweight PR — beats prior max reps.
assertEqual(
  classifyWorkoutEvent({ weight: 0, reps: 15 }, [{ weight: 0, reps: 12 }], bwEx),
  'pr',
  'bodyweight reps beating prior max is a pr'
);

// Bodyweight grind.
assertEqual(
  classifyWorkoutEvent({ weight: 0, reps: 6 }, [{ weight: 0, reps: 12 }], bwEx),
  'grind',
  'bodyweight reps at repMin is a grind'
);

// Bodyweight miss.
assertEqual(
  classifyWorkoutEvent({ weight: 0, reps: 3 }, [{ weight: 0, reps: 12 }], bwEx),
  'miss',
  'bodyweight reps under repMin is a miss'
);

console.log('gym-workout-events.selfcheck.cjs: all assertions passed');
