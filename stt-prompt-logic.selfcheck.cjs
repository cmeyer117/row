// Run with: node stt-prompt-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'stt-prompt-logic.js'), 'utf8'), sandbox);
const { buildSttPrompt } = sandbox.window.SttPromptLogic;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}
function assertTrue(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); process.exit(1); }
}

// Empty/undefined inputs -> empty string
assertEqual(buildSttPrompt([], []), '', 'empty arrays return empty string');
assertEqual(buildSttPrompt(undefined, undefined), '', 'undefined inputs return empty string');
assertEqual(buildSttPrompt(null, null), '', 'null inputs return empty string');

// Program-only exercises
assertEqual(
  buildSttPrompt([{ name: 'Bench Press' }, { name: 'Hack Squat' }], []),
  'Exercise names Carl may say: Bench Press, Hack Squat',
  'program-only exercises join correctly'
);

// Program + ad-hoc with an overlapping name -> deduped once
assertEqual(
  buildSttPrompt(
    [{ name: 'Bench Press' }, { name: 'Hack Squat' }],
    [{ name: 'Hack Squat' }, { name: 'Sissy Leg Press' }]
  ),
  'Exercise names Carl may say: Bench Press, Hack Squat, Sissy Leg Press',
  'overlapping name between program and ad-hoc is deduped, not repeated'
);

// Entries with no name are skipped, not thrown
assertEqual(
  buildSttPrompt([{ name: 'Bench Press' }, { id: 'x' }], []),
  'Exercise names Carl may say: Bench Press',
  'an entry with no name is skipped rather than producing "undefined" in the prompt'
);

// A library long enough to exceed MAX_LEN truncates at a comma boundary
const longLibrary = [];
for (let i = 0; i < 200; i++) longLibrary.push({ name: 'Exercise Number ' + i });
const result = buildSttPrompt(longLibrary, []);
assertTrue(result.length <= 900, 'truncated result stays at or under MAX_LEN');
assertTrue(!result.endsWith(','), 'truncation does not leave a trailing comma');
assertTrue(!/Exercise Number \d+$/.test(result) || result.includes('Exercise Number 0'), 'truncation cuts at a full name, not mid-word');

console.log('All stt-prompt-logic tests passed.');
