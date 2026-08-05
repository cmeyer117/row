// Run with: node morning-launch-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'morning-launch-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.MorningLaunchLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}
function assertTrue(cond, label) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
}

// --- outcomes ---
assertEqual(L.validateOutcomes([]).ok, false, 'zero outcomes fails');
const fourActive = [1, 2, 3, 4].map((i) => ({ id: 'o' + i, active: true }));
assertEqual(L.validateOutcomes(fourActive).ok, false, 'four active outcomes fails');
const fiveActive = [1, 2, 3, 4, 5].map((i) => ({ id: 'o' + i, active: true, text: 'outcome ' + i }));
assertEqual(L.validateOutcomes(fiveActive).ok, true, 'five active outcomes succeeds');
const fiveActiveOneInactive = fiveActive.concat([{ id: 'old', active: false }]);
assertEqual(L.validateOutcomes(fiveActiveOneInactive).ok, true, 'five active succeeds even with inactive historical outcomes present');
const sixActive = fiveActive.concat([{ id: 'o6', active: true }]);
assertEqual(L.validateOutcomes(sixActive).ok, false, 'six active outcomes fails');

// --- phase progression ---
let session = L.newSession('2026-08-05');
assertEqual(session.currentPhase, 'clear', 'new session starts in clear');
assertEqual(L.advancePhase(session, 'visualize').ok, false, 'cannot skip from clear to visualize');
assertEqual(L.advancePhase(session, 'align').ok, false, 'cannot advance to align with empty brain dump');
session.brainDump = 'lots on my mind';
assertEqual(L.advancePhase(session, 'align').ok, true, 'can advance to align once brain dump is non-empty');
session.currentPhase = 'align';
assertEqual(L.advancePhase(session, 'visualize').ok, false, 'cannot advance to visualize without a focus outcome');
session.focusOutcomeId = 'o1';
assertEqual(L.advancePhase(session, 'visualize').ok, true, 'can advance to visualize once focus outcome is set');
session.currentPhase = 'visualize';
assertEqual(L.advancePhase(session, 'commit').ok, false, 'cannot advance to commit with blank visualize fields');
session.processVisualization = 'do the reps';
session.obstacle = '  ';
session.response = 'push through';
assertEqual(L.advancePhase(session, 'commit').ok, false, 'whitespace-only obstacle fails commit gate');
session.obstacle = 'I get distracted';
assertEqual(L.advancePhase(session, 'commit').ok, true, 'can advance to commit once all visualize fields are filled');

// --- if-then formatting ---
assertEqual(L.formatIfThen('I get distracted', 'refocus on the first action'), 'If I get distracted, then I will refocus on the first action.', 'if-then sentence formats correctly');
assertEqual(L.formatIfThen('', 'x'), '', 'if-then returns empty string when obstacle is blank');
assertEqual(L.formatIfThen('  x  ', '  y  '), 'If x, then I will y.', 'if-then trims boundary whitespace without altering inner content');

// --- legacy ID upgrade ---
const legacyGoals = [{ text: 'call the vendor', done: false }, { text: 'ship the report', done: true, doneAt: '2026-08-04' }];
const upgraded = L.upgradeGoalsWithIds(legacyGoals, 'goals:2026-08-04');
assertTrue(upgraded[0].id && upgraded[1].id, 'legacy goals receive IDs');
assertEqual(upgraded[0].text, 'call the vendor', 'upgrade preserves text');
assertEqual(upgraded[1].done, true, 'upgrade preserves done state');
assertEqual(upgraded[1].doneAt, '2026-08-04', 'upgrade preserves doneAt');
const upgradedAgain = L.upgradeGoalsWithIds(legacyGoals, 'goals:2026-08-04');
assertEqual(upgradedAgain[0].id, upgraded[0].id, 'repeated upgrade of the same legacy goal produces the same ID (deterministic, cross-device safe)');
assertEqual(legacyGoals[0].id, undefined, 'upgradeGoalsWithIds does not mutate the input array');

// --- movers ---
const twoMovers = [{ id: 'm1' }, { id: 'm2' }];
assertEqual(L.validateMovers(twoMovers, 'm1').ok, false, 'two movers fails');
const threeMovers = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
assertEqual(L.validateMovers(threeMovers, 'm1').ok, true, 'three movers with a valid win mover succeeds');
assertEqual(L.validateMovers(threeMovers, 'foreign').ok, false, 'a winMoverId not among the movers fails');
assertEqual(L.validateMovers(threeMovers, null).ok, false, 'a missing winMoverId fails');

// --- mover reference resolution ---
const goalsByDateKey = { 'goals:2026-08-05': [{ id: 'g1', text: 'ship it', done: false }] };
assertEqual(L.resolveMoverReference({ goalDateKey: 'goals:2026-08-05', goalId: 'g1' }, goalsByDateKey).status, 'available', 'existing goal reference resolves as available');
assertEqual(L.resolveMoverReference({ goalDateKey: 'goals:2026-08-05', goalId: 'gone' }, goalsByDateKey).status, 'missing', 'deleted goal reference resolves as missing, not recreated');

// --- reconciliation ---
const moversForReconcile = [{ id: 'm1', goalDateKey: 'goals:2026-08-05', goalId: 'g1', doneSnapshot: false }];
const reconciled = L.reconcileFromToday(moversForReconcile, 'goals:2026-08-05', 'g1', true);
assertEqual(reconciled[0].doneSnapshot, true, 'reconcileFromToday flips the matching mover\'s doneSnapshot');
assertEqual(moversForReconcile[0].doneSnapshot, false, 'reconcileFromToday does not mutate the input movers array');
const reconciledOther = L.reconcileFromToday(moversForReconcile, 'goals:2026-08-05', 'other', true);
assertEqual(reconciledOther[0].doneSnapshot, false, 'reconcileFromToday leaves non-matching movers untouched');

// --- completion + snapshot ---
const completeMovers = [
  { id: 'm1', textSnapshot: 'Ship the PR', order: 0, doneSnapshot: false },
  { id: 'm2', textSnapshot: 'Call the client', order: 1, doneSnapshot: false },
  { id: 'm3', textSnapshot: 'Log macros', order: 2, doneSnapshot: false }
];
session.processVisualization = 'do the reps';
session.obstacle = 'I get distracted';
session.response = 'refocus';
const result = L.completeSession(session, fiveActive, completeMovers, 'm2');
assertEqual(result.ok, true, 'completeSession succeeds with valid outcomes, movers, and visualize fields');
assertEqual(result.session.status, 'completed', 'completed session has status completed');
assertEqual(result.session.currentPhase, 'complete', 'completed session has currentPhase complete');
assertEqual(result.session.savedOutcomeSnapshot.length, 5, 'completion captures a five-outcome snapshot');
const badResult = L.completeSession(session, fourActive, completeMovers, 'm2');
assertEqual(badResult.ok, false, 'completeSession fails when outcomes are invalid');

// snapshot survives later canonical outcome edits
fiveActive.forEach((o) => { o.text = 'edited-' + o.id; });
assertTrue(!result.session.savedOutcomeSnapshot.some((o) => o.text && o.text.indexOf('edited-') === 0), 'saved outcome snapshot is unaffected by later canonical outcome edits');

// --- summary ---
const summary = L.summarize(result.session);
assertEqual(summary.winCondition, 'Call the client', 'summary reports the win mover\'s text');
assertEqual(summary.currentFirstAction, undefined, 'summary firstAction is undefined when movers have no firstAction field (not exercised here)');
assertEqual(summary.status, 'completed', 'summary reports session status');

// --- vault export projection ---
const sessionForExport = Object.assign({}, result.session, {
  focusOutcomeId: result.session.savedOutcomeSnapshot[0].id,
  brainDump: 'sensitive private thoughts'
});
const projection = L.vaultExportProjection(sessionForExport);
assertTrue(projection && !('brainDump' in projection), 'vault export projection never includes brainDump');
assertEqual(projection.winCondition, 'Call the client', 'vault export projection includes win condition text');
assertEqual(projection.focusOutcome, 'outcome 1', 'vault export projection resolves focus outcome text from the saved snapshot');
assertEqual(projection.movers.length, 3, 'vault export projection includes three movers');
assertEqual(projection.ifThen, 'If I get distracted, then I will refocus.', 'vault export projection includes formatted if-then sentence');
assertEqual(L.vaultExportProjection(L.newSession('2026-08-06')), null, 'vault export projection is null for a non-completed, non-skipped session');

console.log('morning-launch-logic.selfcheck.cjs: all assertions passed');
