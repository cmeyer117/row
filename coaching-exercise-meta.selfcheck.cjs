// Run with: node coaching-exercise-meta.selfcheck.cjs
//
// Root cause of the CJS-vs-ESM dance below: package.json sets
// "type": "module" (added 2026-07-20 for web-push), which makes Node's
// loader treat every plain .js file as ESM — but coaching-exercise-meta.js
// deliberately has zero import/export syntax so it stays loadable as a
// classic <script> in the browser. That combination means Node's normal
// require()/import() machinery can't see this file's UMD-style
// `module.exports` at all (confirmed: the same failure already exists on
// gym-workout-events.selfcheck.js, silently broken since 07-20 and fixed
// 2026-07-27 by renaming to .cjs and switching to a vm sandbox — not
// something introduced here). Executing the source directly inside a
// Function scope with a real `module` shim sidesteps Node's loader
// entirely — no changes needed to the shipped browser file.
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'coaching-exercise-meta.js'), 'utf8');
const moduleShim = { exports: {} };
new Function('module', 'exports', src)(moduleShim, moduleShim.exports);
const { getMeta, isLoggable } = moduleShim.exports;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

assertEqual(getMeta('Hack Squat'), { repMin: 4, repMax: 8, step: 10, bw: false }, 'known exercise returns real Row values');
assertEqual(getMeta('Goblet Squat'), { repMin: 8, repMax: 12, step: 5, bw: false }, 'unknown exercise returns the default');
assertEqual(isLoggable('Hack Squat'), true, 'a normal exercise is loggable');
assertEqual(isLoggable('Plank'), false, 'Plank is excluded from logging');

console.log('coaching-exercise-meta.selfcheck.cjs: all assertions passed');
