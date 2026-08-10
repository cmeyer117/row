// Run with: node recomp-signal-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'recomp-signal-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.RecompSignalLogic;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}
function assertTrue(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); process.exit(1); }
}

const NOW = new Date('2026-08-10T12:00:00Z'); // cutoff for a 30-day window is 2026-07-11

// --- computeRecompDelta: classifications ---

// Good recomp signal: waist down, weight flat
let r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 200 }, { date: '2026-08-10', value: 200.3 }],
  [{ date: '2026-07-15', value: 35.0 }, { date: '2026-08-10', value: 34.0 }],
  30, NOW
);
assertEqual(r.ok, true, 'good-recomp case resolves');
assertEqual(r.label, 'Good recomp signal', 'waist down + weight flat = good recomp signal');
assertEqual(r.weightDelta, 0.3, 'weight delta computed correctly');
assertEqual(r.waistDelta, -1, 'waist delta computed correctly');

// Cutting: weight down, waist down
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 205 }, { date: '2026-08-10', value: 200 }],
  [{ date: '2026-07-15', value: 36 }, { date: '2026-08-10', value: 34 }],
  30, NOW
);
assertEqual(r.label, 'Cutting', 'weight down + waist down = cutting');

// Bulking — watch waist pace: weight up, waist up
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 195 }, { date: '2026-08-10', value: 200 }],
  [{ date: '2026-07-15', value: 33 }, { date: '2026-08-10', value: 34.5 }],
  30, NOW
);
assertEqual(r.label, 'Bulking — watch waist pace', 'weight up + waist up = bulking watch');

// Worth watching: weight down, waist up
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 205 }, { date: '2026-08-10', value: 200 }],
  [{ date: '2026-07-15', value: 33 }, { date: '2026-08-10', value: 34 }],
  30, NOW
);
assertEqual(r.label, 'Worth watching', 'weight down + waist up = worth watching');

// Holding steady: both flat
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 200 }, { date: '2026-08-10', value: 200.4 }],
  [{ date: '2026-07-15', value: 34 }, { date: '2026-08-10', value: 34.1 }],
  30, NOW
);
assertEqual(r.label, 'Holding steady', 'both flat = holding steady');

// Waist is the primary axis: waist flat wins even if weight is clearly moving
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 195 }, { date: '2026-08-10', value: 205 }],
  [{ date: '2026-07-15', value: 34 }, { date: '2026-08-10', value: 34.1 }],
  30, NOW
);
assertEqual(r.label, 'Holding steady', 'waist flat outranks a moving weight (waist is the primary axis)');

// --- computeRecompDelta: insufficient data ---

// Only 1 waist point in the window (an earlier point falls before the cutoff)
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 200 }, { date: '2026-08-10', value: 200.3 }],
  [{ date: '2020-01-01', value: 40 }, { date: '2026-08-01', value: 34 }],
  30, NOW
);
assertEqual(r.ok, false, 'insufficient waist data returns ok:false');
assertTrue(/waist/i.test(r.reason), 'insufficient-waist reason names waist specifically');

// Only 1 weight point in the window
r = L.computeRecompDelta(
  [{ date: '2020-01-01', value: 210 }, { date: '2026-08-01', value: 200 }],
  [{ date: '2026-07-15', value: 35 }, { date: '2026-08-10', value: 34 }],
  30, NOW
);
assertEqual(r.ok, false, 'insufficient weight data returns ok:false');
assertTrue(/weigh/i.test(r.reason), 'insufficient-weight reason names weigh-ins specifically');

// Both empty
r = L.computeRecompDelta([], [], 30, NOW);
assertEqual(r.ok, false, 'both series empty returns ok:false');

console.log('recomp-signal-logic.selfcheck.cjs: all assertions passed (Task 1)');
