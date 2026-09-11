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

// No confident match returns null, not a wrong/generic checklist. Most
// Muscular stays uncovered deliberately (2026-09-11 extension) -- it has no
// live pose-tracking entry in form-coach-logic.js's POSE_CONFIGS, so it
// gets no checklist either, same "don't add what isn't tracked" scope the
// other 7 poses follow.
assertEqual(PC.matchChecklist('Most Muscular'), null, 'no match: an uncovered pose returns null, not a wrong checklist');
assertEqual(PC.matchChecklist(''), null, 'no match: empty string returns null');
assertEqual(PC.matchChecklist('banana smoothie recipe'), null, 'no match: unrelated text returns null');

// 2026-09-11 extension: the 4 poses added to complete live-tracking
// coverage (all resolve via posing.html's exact on-page display text).
assertEqual(PC.matchChecklist('Side Triceps').label, 'Side Triceps', 'exact match: Side Triceps resolves');
assertEqual(PC.matchChecklist('Back Double Biceps').label, 'Back Double Biceps', 'exact match: Back Double Biceps resolves');
assertEqual(PC.matchChecklist('Back Lat Spread').label, 'Back Lat Spread', 'exact match: Back Lat Spread resolves');
assertEqual(PC.matchChecklist('Abdominal & Thigh').label, 'Abdominal & Thigh', 'exact match: Abdominal & Thigh resolves (posing.html\'s exact on-page text, "&" not "and")');

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

// Content spot-check for one of the 2026-09-11 additions, same discipline
// as the Front Double Biceps check above.
assertEqual(
  JSON.stringify(PC.CHECKLISTS['back-double-biceps'].items),
  JSON.stringify([
    'Back width and density',
    'Left-right symmetry',
    'Rear delts and arm peaks',
    'Lower-back detail',
    'Glute conditioning',
    'Hamstring and calf balance'
  ]),
  'content: Back Double Biceps checklist matches the source note\'s "What judges should see" list verbatim'
);

console.log('OK: posing-checklists.selfcheck.cjs');
