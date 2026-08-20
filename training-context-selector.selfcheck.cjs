// Run with: node training-context-selector.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'training-context-selector.js'), 'utf8'), sandbox);
const S = sandbox.window.TrainingContextSelector;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

const NOW = new Date('2026-08-20T00:00:00.000Z');

const index = [
  { path: 'a.md', title: 'Chest Hypertrophy Programming', tags: ['chest', 'hypertrophy'], headings: ['Volume'], modified: '2026-08-01T00:00:00.000Z' },
  { path: 'b.md', title: 'Growth Phase Overview', tags: ['bodybuilding'], headings: ['Chest priorities'], modified: '2026-08-15T00:00:00.000Z' },
  { path: 'c.md', title: 'Leg Day Notes', tags: ['legs'], headings: ['Squat'], modified: '2026-08-10T00:00:00.000Z' },
  { path: 'd.md', title: 'Old Chest Routine', tags: ['chest'], headings: [], modified: '2025-01-01T00:00:00.000Z' }, // stale
];

// --- phase/exercise match, ranked, capped at 3 ---
const results = S.selectNotes(index, ['chest', 'growth'], NOW);
assertEqual(results.length, 3, 'never returns more than 3 notes even if more matched');
assertEqual(results[0].path, 'a.md', 'exact tag match ranks above title/heading matches');
assertEqual(results[0].reason, 'Tagged "chest"', 'reason names the matched tag');
assertEqual(results.some(r => r.path === 'c.md'), false, 'unrelated note (legs) is not included');

// --- no match ---
assertEqual(S.selectNotes(index, ['shoulders'], NOW), [], 'no matching notes -- empty array, not an error');
assertEqual(S.selectNotes(index, [], NOW), [], 'no query tags -- empty array');
assertEqual(S.selectNotes([], ['chest'], NOW), [], 'empty index -- empty array');
assertEqual(S.selectNotes(null, ['chest'], NOW), [], 'null index -- empty array, never throws (missing-index degrade path)');

// --- stale-note penalty ---
// b and d both match 'chest' via title/tag at equal weight tier when
// queried alone against a smaller set -- isolate the penalty directly.
const staleVsFresh = [
  { path: 'fresh.md', title: 'Chest Notes', tags: ['chest'], headings: [], modified: '2026-08-19T00:00:00.000Z' },
  { path: 'stale.md', title: 'Chest Notes Old', tags: ['chest'], headings: [], modified: '2025-01-01T00:00:00.000Z' },
];
const staleResults = S.selectNotes(staleVsFresh, ['chest'], NOW);
assertEqual(staleResults[0].path, 'fresh.md', 'stale-note penalty pushes the fresher equally-tagged note first');
assertEqual(staleResults[1].freshness, 'stale', 'freshness label reported for the stale note');

// --- freshnessOf ---
assertEqual(S.freshnessOf('2026-08-19T00:00:00.000Z', NOW).label, 'fresh', 'freshnessOf: within 30 days is fresh');
assertEqual(S.freshnessOf('2026-06-01T00:00:00.000Z', NOW).label, 'aging', 'freshnessOf: 30-180 days is aging');
assertEqual(S.freshnessOf('2025-01-01T00:00:00.000Z', NOW).label, 'stale', 'freshnessOf: over 180 days is stale');

console.log('All training-context-selector self-checks passed.');
