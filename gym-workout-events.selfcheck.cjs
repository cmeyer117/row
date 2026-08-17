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
const { classifyWorkoutEvent, totalLoad } = sandbox.window.GymWorkoutEvents;

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

// --- totalLoad: resolve a logged set to the real load moved ---

const smithEx = { bw: false, repMin: 4, repMax: 8, loadType: 'perSidePlusBar', barWeight: 25 };
const machineEx = { bw: false, repMin: 8, repMax: 12, loadType: 'perSide' };
const dipEx = { bw: false, repMin: 8, repMax: 12, loadType: 'plates' };
const cableEx = { bw: false, repMin: 8, repMax: 16, loadType: 'total' };

// lb-mode entries are already total load, whatever the loadType says.
assertEqual(totalLoad({ weight: 225, weightBasis: 'totalLbs' }, smithEx), 225, 'lb-mode entry passes through unconverted');

// Per-side plate entries convert according to loadType.
assertEqual(totalLoad({ weight: 90, weightBasis: 'platesPerSide' }, smithEx), 205, 'perSidePlusBar doubles and adds the bar');
assertEqual(totalLoad({ weight: 90, weightBasis: 'platesPerSide' }, machineEx), 180, 'perSide doubles with no bar');
assertEqual(totalLoad({ weight: 100, weightBasis: 'platesPerSide' }, dipEx), 100, 'plates (single horn) passes through');
assertEqual(totalLoad({ weight: 80, weightBasis: 'platesPerSide' }, cableEx), 80, 'total (stack) passes through');

// perSidePlusBar with no explicit barWeight falls back to a 45 lb bar.
assertEqual(
  totalLoad({ weight: 90, weightBasis: 'platesPerSide' }, { loadType: 'perSidePlusBar' }),
  225,
  'perSidePlusBar defaults to a 45 lb bar'
);

// Unknown loadType on a per-side entry is null (not comparable), never 0 or a guess.
assertEqual(totalLoad({ weight: 90, weightBasis: 'platesPerSide' }, weightedEx), null, 'per-side entry with no loadType is null');

// Legacy plateConfig rows are inferred as per-side and convert the same way.
assertEqual(totalLoad({ weight: 90, plateConfig: { 45: 2 } }, machineEx), 180, 'legacy plateConfig row is inferred as per-side');

// Single-horn plate machines (e.g. T-bar row style, Seated Hamstrings Curl in
// Carl's gym) must not be doubled -- confirmed live 2026-08-17, was
// mistagged perSide until Carl corrected it.
assertEqual(totalLoad({ weight: 135, plateConfig: { 45: 3 } }, dipEx), 135, 'single-horn (plates) loadType is never doubled');

// --- classification across logging modes, once loadType can resolve them ---

// 90/side + 25 bar = 205 total, which is NOT a pr over a 225 lb total-load prior.
assertEqual(
  classifyWorkoutEvent(
    { weight: 90, reps: 5, weightBasis: 'platesPerSide' },
    [{ weight: 225, reps: 5, weightBasis: 'totalLbs' }],
    smithEx
  ),
  null,
  'plate-mode set below a lb-mode prior in real load is not a pr'
);

// 110/side + 25 bar = 245 total, which IS a pr over the same 225 prior.
assertEqual(
  classifyWorkoutEvent(
    { weight: 110, reps: 5, weightBasis: 'platesPerSide' },
    [{ weight: 225, reps: 5, weightBasis: 'totalLbs' }],
    smithEx
  ),
  'pr',
  'plate-mode set above a lb-mode prior in real load is a pr'
);

// Without loadType the two bases stay incomparable -- fires nothing rather than guessing.
assertEqual(
  classifyWorkoutEvent(
    { weight: 90, reps: 5, weightBasis: 'platesPerSide' },
    [{ weight: 225, reps: 5, weightBasis: 'totalLbs' }],
    weightedEx
  ),
  null,
  'unresolvable per-side entry fires nothing'
);

// Same basis still compares normally.
assertEqual(
  classifyWorkoutEvent(
    { weight: 100, reps: 5, weightBasis: 'platesPerSide' },
    [{ weight: 90, reps: 5, weightBasis: 'platesPerSide' }],
    machineEx
  ),
  'pr',
  'same-basis comparison still detects a pr'
);

// Legacy rows without plateConfig are inferred as total lbs -- unchanged behavior.
assertEqual(
  classifyWorkoutEvent({ weight: 225, reps: 5 }, [{ weight: 205, reps: 5 }], weightedEx),
  'pr',
  'legacy rows with no basis and no plateConfig still compare as before'
);

// Bodyweight ignores basis entirely (weight is always 0).
assertEqual(
  classifyWorkoutEvent(
    { weight: 0, reps: 15, weightBasis: 'totalLbs' },
    [{ weight: 0, reps: 12, plateConfig: { 45: 1 } }],
    bwEx
  ),
  'pr',
  'bodyweight classification is unaffected by weightBasis'
);

console.log('gym-workout-events.selfcheck.cjs: all assertions passed');
