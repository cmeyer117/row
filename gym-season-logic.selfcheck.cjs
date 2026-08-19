// Run with: node gym-season-logic.selfcheck.cjs
//
// gym-season-logic.js is loaded via a plain <script src> in gym.html (not
// type="module"), so it can't use ESM export/import without breaking that
// page load -- and Row's package.json sets "type": "module", which breaks
// plain require() of a same-package .js file the other way (this bit
// gym-workout-events.selfcheck.js too, since fixed 2026-07-27). This
// runs the actual browser file's source against a fake `window` instead of
// fighting Node's module resolution.
'use strict';

const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require('path').join(__dirname, 'gym-season-logic.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { daysSince, todayKey, PHASES } = sandbox.window.GymSeasonLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// Day 1 on the start date itself, not day 0.
assertEqual(daysSince('2026-07-25', new Date('2026-07-25T15:00:00')), 1, 'start date itself is day 1');

// The following calendar day is day 2.
assertEqual(daysSince('2026-07-25', new Date('2026-07-26T15:00:00')), 2, 'next calendar day is day 2');

// A week later is day 8.
assertEqual(daysSince('2026-07-25', new Date('2026-08-01T15:00:00')), 8, 'one week later is day 8');

// Crossing a month boundary still counts correctly.
assertEqual(daysSince('2026-07-30', new Date('2026-08-02T15:00:00')), 4, 'month-boundary crossing counts correctly');

// todayKey formats as YYYY-MM-DD with zero-padded month/day.
assertEqual(todayKey(new Date(2026, 0, 5)), '2026-01-05', 'todayKey zero-pads single-digit month and day');
assertEqual(todayKey(new Date(2026, 10, 23)), '2026-11-23', 'todayKey formats double-digit month correctly');

// PHASES -- shared label map, single source of truth (previously
// duplicated inline in gym.html's Season Engine IIFE).
assertEqual(PHASES.cut, 'Cut', 'PHASES: cut label');
assertEqual(PHASES.reverse_diet, 'Reverse Diet', 'PHASES: reverse_diet label');
assertEqual(PHASES.growth, 'Growth', 'PHASES: growth label');
assertEqual(PHASES.peak, 'Peak Week', 'PHASES: peak label');
assertEqual(PHASES.show_prep, 'Show Prep', 'PHASES: show_prep label');

console.log('gym-season-logic.selfcheck.cjs: all assertions passed');
