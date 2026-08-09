// Run with: node daily-routine-checklist-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'daily-routine-checklist-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.DailyRoutineChecklistLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

// --- hasVesselActivityToday ---
assertEqual(L.hasVesselActivityToday(null, 'prayer_log', '2026-08-09'), false, 'null data -> false');
assertEqual(L.hasVesselActivityToday({}, 'prayer_log', '2026-08-09'), false, 'missing key -> false');
assertEqual(
  L.hasVesselActivityToday({ 'vessel:prayer_log': ['2026-08-08', '2026-08-09'] }, 'prayer_log', '2026-08-09'),
  true,
  'bare date-string array, today present -> true'
);
assertEqual(
  L.hasVesselActivityToday({ 'vessel:prayer_log': ['2026-08-08'] }, 'prayer_log', '2026-08-09'),
  false,
  'bare date-string array, today absent -> false'
);
assertEqual(
  L.hasVesselActivityToday({ 'vessel:journal': [{ id: 'j1', date: '2026-08-09' }] }, 'journal', '2026-08-09'),
  true,
  'object array with date field, today present -> true'
);
assertEqual(
  L.hasVesselActivityToday({ 'vessel:journal': [{ id: 'j1', date: '2026-08-05' }] }, 'journal', '2026-08-09'),
  false,
  'object array with date field, today absent -> false'
);

// --- buildChecklistState ---
const morningState = L.buildChecklistState(
  L.MORNING_ITEMS,
  { sunlight: true, cold_or_exercise: false },
  { devotional_log: { 'vessel:devotional_log': ['2026-08-09'] }, prayer_log: { 'vessel:prayer_log': [] } },
  '2026-08-09'
);
assertEqual(morningState.find(function (i) { return i.id === 'sunlight'; }).checked, true, 'sunlight checkbox reflects saved true');
assertEqual(morningState.find(function (i) { return i.id === 'cold_or_exercise'; }).checked, false, 'cold_or_exercise checkbox reflects saved false');
assertEqual(morningState.find(function (i) { return i.id === 'caffeine_delay'; }).checked, false, 'unsaved checkbox defaults to false');
assertEqual(morningState.find(function (i) { return i.id === 'devotional'; }).checked, true, 'devotional live item true when today present in read');
assertEqual(morningState.find(function (i) { return i.id === 'prayer'; }).checked, false, 'prayer live item false when today absent in read');
assertEqual(morningState.find(function (i) { return i.id === 'prayer'; }).unknown, false, 'prayer read resolved (empty array is a known result, not unknown)');

const morningStateNoReads = L.buildChecklistState(L.MORNING_ITEMS, {}, {}, '2026-08-09');
assertEqual(morningStateNoReads.find(function (i) { return i.id === 'devotional'; }).unknown, true, 'live item with no read entry at all is unknown, not false');
assertEqual(morningStateNoReads.find(function (i) { return i.id === 'devotional'; }).checked, false, 'unknown live item defaults checked to false');

const eveningState = L.buildChecklistState(L.EVENING_ITEMS, { melatonin: true }, { journal: { 'vessel:journal': [{ id: 'j1', date: '2026-08-09' }] } }, '2026-08-09');
assertEqual(eveningState.find(function (i) { return i.id === 'melatonin'; }).checked, true, 'evening melatonin checkbox reflects saved true');
assertEqual(eveningState.find(function (i) { return i.id === 'journal'; }).checked, true, 'evening journal live item true');
assertEqual(eveningState.length, 5, 'evening item list has 5 items');
assertEqual(L.MORNING_ITEMS.length, 5, 'morning item list has 5 items');

console.log('All daily-routine-checklist-logic tests passed.');
