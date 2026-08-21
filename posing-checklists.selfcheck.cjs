// Run with: node posing-checklists.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'posing-checklists.js'), 'utf8'), sandbox);
const PC = sandbox.window.PosingChecklists;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

// Exact pose-name match.
assertEqual(PC.matchChecklist('Front Double Biceps').label, 'Front Double Biceps', 'exact match: Front Double Biceps resolves');
assertEqual(PC.matchChecklist('Side Chest').label, 'Side Chest', 'exact match: Side Chest resolves');

// Fuzzy match within the 0.35 threshold still resolves correctly (case,
// punctuation, and a dropped word — same tolerance form-coach-logic's
// matchBenchmark accepts).
assertEqual(PC.matchChecklist('front double bicep').label, 'Front Double Biceps', 'fuzzy match: singular "bicep" still resolves to Front Double Biceps');
assertEqual(PC.matchChecklist('FRONT LAT SPREAD').label, 'Front Lat Spread', 'fuzzy match: all-caps still resolves');
assertEqual(PC.matchChecklist('side-chest').label, 'Side Chest', 'fuzzy match: hyphenated slug form resolves');

// No confident match returns null, not a wrong/generic checklist.
assertEqual(PC.matchChecklist('Most Muscular'), null, 'no match: an uncovered pose returns null, not a wrong checklist');
assertEqual(PC.matchChecklist(''), null, 'no match: empty string returns null');
assertEqual(PC.matchChecklist('banana smoothie recipe'), null, 'no match: unrelated text returns null');

// Content spot-check against the source note (ROW Competition Posing
// Manual.md, "Front Double Biceps" > "What judges should see" — six bullets,
// copied verbatim 2026-08-21). If a future edit to that section silently
// drops or reorders items, this assertion catches it.
assertEqual(
  JSON.stringify(PC.CHECKLISTS['front-double-biceps'].items),
  JSON.stringify([
    'Biceps shape and balance',
    'Shoulder-to-waist ratio',
    'Lat width visible beneath the arms',
    'Chest, abdominal and serratus control',
    'Quad sweep, separation and calf balance',
    'Overall symmetry rather than arm size alone'
  ]),
  'content: Front Double Biceps checklist matches the source note\'s "What judges should see" list verbatim'
);

console.log('OK: posing-checklists.selfcheck.cjs');
