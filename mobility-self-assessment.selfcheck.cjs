// mobility-self-assessment.selfcheck.cjs
// Run with: node mobility-self-assessment.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'mobility-self-assessment.js'), 'utf8'), sandbox);
const L = sandbox.window.MobilitySelfAssessment;

function assert(cond, label) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
}

// --- SELF_ASSESSMENT has exactly 7 tests, matching PAIN_LIBRARY's AREA_ORDER ---
assert(Array.isArray(L.SELF_ASSESSMENT), 'SELF_ASSESSMENT is an array');
assert(L.SELF_ASSESSMENT.length === 7, 'SELF_ASSESSMENT has exactly 7 tests');
var areas = L.SELF_ASSESSMENT.map(function (t) { return t.area; });
assert(
  JSON.stringify(areas) === JSON.stringify(['shoulder', 'elbow', 'knee', 'hip', 'lowBack', 'wrist', 'ankle']),
  'SELF_ASSESSMENT areas are exactly [shoulder, elbow, knee, hip, lowBack, wrist, ankle] in that order'
);
L.SELF_ASSESSMENT.forEach(function (t) {
  assert(typeof t.name === 'string' && t.name.length > 0, t.area + '.name is a non-empty string');
  assert(typeof t.instructions === 'string' && t.instructions.length > 0, t.area + '.instructions is a non-empty string');
  assert(typeof t.failCriteria === 'string' && t.failCriteria.length > 0, t.area + '.failCriteria is a non-empty string');
});

// --- STORAGE_KEY is the exact agreed key ---
assert(L.STORAGE_KEY === 'mob_self_assessment_v1', 'STORAGE_KEY is mob_self_assessment_v1');

// --- renderTests() renders all 7 cards with data-area, name, instructions, fail criteria ---
var testsHtml = L.renderTests();
assert(typeof testsHtml === 'string' && testsHtml.length > 0, 'renderTests() returns a non-empty string');
L.SELF_ASSESSMENT.forEach(function (t) {
  assert(testsHtml.indexOf('data-area="' + t.area + '"') !== -1, 'renderTests() output has data-area for ' + t.area);
  assert(testsHtml.indexOf(t.name) !== -1, 'renderTests() output contains name for ' + t.area);
  assert(testsHtml.indexOf(t.instructions) !== -1, 'renderTests() output contains instructions for ' + t.area);
  assert(testsHtml.indexOf(t.failCriteria) !== -1, 'renderTests() output contains fail criteria for ' + t.area);
});
assert(testsHtml.indexOf('id="selfAssessSaveBtn"') !== -1, 'renderTests() output includes the Save button');

// --- renderSummary(null) shows the "run it" prompt, no saved-date text ---
var freshSummary = L.renderSummary(null);
assert(freshSummary.indexOf('id="selfAssessRunBtn"') !== -1, 'renderSummary(null) includes the Run button');
assert(freshSummary.toLowerCase().indexOf('run') !== -1, 'renderSummary(null) prompts to run the assessment');

// --- renderSummary(saved) shows the date and pass count ---
var saved = { date: '2026-08-10', results: { shoulder: 'pass', elbow: 'fail', knee: 'pass', hip: 'pass', lowBack: 'fail', wrist: 'pass', ankle: 'pass' } };
var savedSummary = L.renderSummary(saved);
assert(savedSummary.indexOf('2026-08-10') !== -1, 'renderSummary(saved) shows the saved date');
assert(savedSummary.indexOf('5/7') !== -1, 'renderSummary(saved) shows the correct pass count (5/7)');
assert(savedSummary.indexOf('id="selfAssessRunBtn"') !== -1, 'renderSummary(saved) still includes the Run (re-run) button');

// --- getFailedAreas() returns only the failed area keys, in AREA_ORDER ---
var failed = L.getFailedAreas(saved.results);
assert(JSON.stringify(failed) === JSON.stringify(['elbow', 'lowBack']), 'getFailedAreas() returns [elbow, lowBack] for the sample result set');
assert(JSON.stringify(L.getFailedAreas({})) === JSON.stringify([]), 'getFailedAreas() returns an empty array for no results');
assert(
  JSON.stringify(L.getFailedAreas({ shoulder: 'pass', elbow: 'pass', knee: 'pass', hip: 'pass', lowBack: 'pass', wrist: 'pass', ankle: 'pass' })) === JSON.stringify([]),
  'getFailedAreas() returns an empty array when everything passed'
);

// --- allAnswered() requires all 7 areas present, any other value doesn't count ---
assert(L.allAnswered(saved.results) === true, 'allAnswered() is true when all 7 areas have a result');
assert(L.allAnswered({ shoulder: 'pass' }) === false, 'allAnswered() is false when only 1 of 7 areas has a result');
assert(L.allAnswered({}) === false, 'allAnswered() is false for an empty results object');

console.log('mobility-self-assessment.selfcheck.cjs: all assertions passed');
