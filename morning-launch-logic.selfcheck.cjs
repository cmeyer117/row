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

// --- phase-name migration ---
assertEqual(L.migratePhaseNames('clear'), 'settle', 'clear migrates to settle');
assertEqual(L.migratePhaseNames('visualize'), 'rehearse', 'visualize migrates to rehearse');
assertEqual(L.migratePhaseNames('align'), 'align', 'align passes through unchanged');
assertEqual(L.migratePhaseNames('commit'), 'commit', 'commit passes through unchanged');
assertEqual(L.migratePhaseNames('complete'), 'complete', 'complete passes through unchanged');
assertEqual(L.migratePhaseNames('settle'), 'settle', 'already-new settle passes through unchanged (idempotent)');
assertEqual(L.migratePhaseNames('rehearse'), 'rehearse', 'already-new rehearse passes through unchanged (idempotent)');

// --- new session shape ---
const freshSession = L.newSession('2026-08-13');
assertEqual(freshSession.currentPhase, 'settle', 'new session starts in settle, not clear');
assertEqual(freshSession.feltRehearsal, '', 'new session has empty feltRehearsal');
assertEqual(freshSession.spokenCommitment, '', 'new session has empty spokenCommitment');
assertEqual(freshSession.spokenAt, null, 'new session has null spokenAt');

// --- phase progression (renamed: clear->settle, visualize->rehearse) ---
let session = L.newSession('2026-08-05');
assertEqual(session.currentPhase, 'settle', 'new session starts in settle');
assertEqual(L.advancePhase(session, 'rehearse').ok, false, 'cannot skip from settle to rehearse');
assertEqual(L.advancePhase(session, 'align').ok, false, 'cannot advance to align with empty brain dump');
session.brainDump = 'lots on my mind';
assertEqual(L.advancePhase(session, 'align').ok, true, 'can advance to align once brain dump is non-empty');
session.currentPhase = 'align';
assertEqual(L.advancePhase(session, 'rehearse').ok, false, 'cannot advance to rehearse without a focus outcome');
session.focusOutcomeId = 'o1';
assertEqual(L.advancePhase(session, 'rehearse').ok, true, 'can advance to rehearse once focus outcome is set');
session.currentPhase = 'rehearse';
assertEqual(L.advancePhase(session, 'commit').ok, false, 'cannot advance to commit with blank rehearse fields');
session.processVisualization = 'do the reps';
session.obstacle = '  ';
session.response = 'push through';
session.feltRehearsal = 'I feel calm and focused';
assertEqual(L.advancePhase(session, 'commit').ok, false, 'whitespace-only obstacle fails commit gate');
session.obstacle = 'I get distracted';
let noFeelSession = L.newSession('2026-08-05');
noFeelSession.brainDump = 'x';
noFeelSession.currentPhase = 'align';
noFeelSession.focusOutcomeId = 'o1';
noFeelSession.currentPhase = 'rehearse';
noFeelSession.processVisualization = 'do the reps';
noFeelSession.obstacle = 'I get distracted';
noFeelSession.response = 'push through';
assertEqual(L.advancePhase(noFeelSession, 'commit').ok, false, 'commit gate fails when feltRehearsal alone is missing');
assertEqual(L.advancePhase(session, 'commit').ok, true, 'can advance to commit once all rehearse fields including feltRehearsal are filled');
session.currentPhase = 'commit';

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

// --- completion (now two steps: completeSession closes Commit into speakit, completeSpeakIt closes Speak It into complete) ---
const completeMovers = [
  { id: 'm1', textSnapshot: 'Ship the PR', order: 0, doneSnapshot: false },
  { id: 'm2', textSnapshot: 'Call the client', order: 1, doneSnapshot: false },
  { id: 'm3', textSnapshot: 'Log macros', order: 2, doneSnapshot: false }
];
session.processVisualization = 'do the reps';
session.obstacle = 'I get distracted';
session.response = 'refocus';
session.feltRehearsal = 'I feel calm and focused';
const missingFeltCandidate = Object.assign({}, session, { feltRehearsal: '' });
const missingFeltResult = L.completeSession(missingFeltCandidate, fiveActive, completeMovers, 'm2');
assertTrue(!missingFeltResult.ok, 'completeSession fails without feltRehearsal even when process/obstacle/response are set');

const result = L.completeSession(session, fiveActive, completeMovers, 'm2');
assertEqual(result.ok, true, 'completeSession succeeds with valid outcomes, movers, and rehearse fields');
assertEqual(result.session.status, 'draft', 'completing Commit does not fully complete the session -- Speak It closes it');
assertEqual(result.session.currentPhase, 'speakit', 'completing Commit lands in speakit, not complete');
assertEqual(result.session.savedOutcomeSnapshot.length, 5, 'completion captures a five-outcome snapshot');
const badResult = L.completeSession(session, fourActive, completeMovers, 'm2');
assertEqual(badResult.ok, false, 'completeSession fails when outcomes are invalid');

// snapshot survives later canonical outcome edits
fiveActive.forEach((o) => { o.text = 'edited-' + o.id; });
assertTrue(!result.session.savedOutcomeSnapshot.some((o) => o.text && o.text.indexOf('edited-') === 0), 'saved outcome snapshot is unaffected by later canonical outcome edits');

// --- Speak It closes the session ---
const emptySpeakResult = L.completeSpeakIt(result.session, '');
assertTrue(!emptySpeakResult.ok, 'completeSpeakIt fails on an empty spoken commitment');
const speakResult = L.completeSpeakIt(result.session, 'I will ship it and call the client.');
assertEqual(speakResult.ok, true, 'completeSpeakIt succeeds with a real spoken commitment');
assertEqual(speakResult.session.status, 'completed', 'completed session (post-Speak-It) has status completed');
assertEqual(speakResult.session.currentPhase, 'complete', 'completed session (post-Speak-It) has currentPhase complete');
assertEqual(speakResult.session.spokenCommitment, 'I will ship it and call the client.', 'completeSpeakIt stores the spoken commitment');
assertTrue(!!speakResult.session.spokenAt, 'completeSpeakIt stamps spokenAt');

// --- summary ---
const summaryBeforeSpeak = L.summarize(result.session);
assertEqual(summaryBeforeSpeak.spokenCommitment, null, 'summarize reports null spokenCommitment before Speak It');
const summary = L.summarize(speakResult.session);
assertEqual(summary.winCondition, 'Call the client', 'summary reports the win mover\'s text');
assertEqual(summary.currentFirstAction, undefined, 'summary firstAction is undefined when movers have no firstAction field (not exercised here)');
assertEqual(summary.status, 'completed', 'summary reports session status');
assertEqual(summary.spokenCommitment, 'I will ship it and call the client.', 'summary reports the spoken commitment once set');

// --- vault export projection ---
const sessionForExport = Object.assign({}, speakResult.session, {
  focusOutcomeId: speakResult.session.savedOutcomeSnapshot[0].id,
  brainDump: 'sensitive private thoughts'
});
const projection = L.vaultExportProjection(sessionForExport);
assertTrue(projection && !('brainDump' in projection), 'vault export projection never includes brainDump');
assertEqual(projection.winCondition, 'Call the client', 'vault export projection includes win condition text');
assertEqual(projection.focusOutcome, 'outcome 1', 'vault export projection resolves focus outcome text from the saved snapshot');
assertEqual(projection.movers.length, 3, 'vault export projection includes three movers');
assertEqual(projection.ifThen, 'If I get distracted, then I will refocus.', 'vault export projection includes formatted if-then sentence');
assertEqual(projection.feltRehearsal, 'I feel calm and focused', 'vault export projection includes feltRehearsal');
assertEqual(projection.spokenCommitment, 'I will ship it and call the client.', 'vault export projection includes spokenCommitment');
assertEqual(L.vaultExportProjection(L.newSession('2026-08-06')), null, 'vault export projection is null for a non-completed, non-skipped session');
assertEqual(L.vaultExportProjection(result.session), null, 'vault export projection is still null for a session that only completed Commit (speakit phase), not fully completed');

// --- evening shutdown ---
assertEqual(L.validateEveningClose(null).ok, false, 'validateEveningClose fails on null');
assertEqual(L.validateEveningClose({}).ok, false, 'validateEveningClose fails with no verdict');
assertEqual(L.validateEveningClose({ verdict: 'nope' }).ok, false, 'validateEveningClose fails on an invalid verdict value');
assertEqual(L.validateEveningClose({ verdict: 'win' }).ok, true, 'validateEveningClose succeeds with verdict win');
assertEqual(L.validateEveningClose({ verdict: 'push' }).ok, true, 'validateEveningClose succeeds with verdict push');
assertEqual(L.validateEveningClose({ verdict: 'miss' }).ok, true, 'validateEveningClose succeeds with verdict miss');

const launchSession = { needleMovers: completeMovers, evening: null };
const launchProj = L.buildEveningShutdown(launchSession, [{ id: 'g1', text: 'unrelated today item' }]);
assertEqual(launchProj.source, 'launch', 'buildEveningShutdown uses launch movers when a session has needleMovers');
assertEqual(launchProj.movers.length, 3, 'buildEveningShutdown returns all three movers for a launch session');
assertEqual(launchProj.todayGoals.length, 0, 'buildEveningShutdown does not return todayGoals when movers exist');

const noLaunchSession = { needleMovers: [], evening: null };
const todayFallback = [{ id: 'g1', text: 'Ad-hoc task' }];
const fallbackProj = L.buildEveningShutdown(noLaunchSession, todayFallback);
assertEqual(fallbackProj.source, 'today', 'buildEveningShutdown falls back to today when there are no movers');
assertEqual(fallbackProj.movers.length, 0, 'buildEveningShutdown returns no movers in the today fallback');
assertEqual(fallbackProj.todayGoals.length, 1, 'buildEveningShutdown returns todayGoals in the fallback case');

assertEqual(L.buildEveningShutdown(L.newSession('2026-08-06'), []).source, 'today', 'a fresh (absent-day) session falls back to today with zero items, not an error');

// old records without verdict/verdictNote still export cleanly (backward compatibility)
const oldStyleSession = Object.assign({}, speakResult.session, { evening: { moved: 'a', interference: 'b', tomorrowChange: 'c', completedAt: '2026-08-01T22:00:00.000Z' } });
const oldProjection = L.vaultExportProjection(oldStyleSession);
assertEqual(oldProjection.evening.moved, 'a', 'vault export projection still includes evening fields from an old-format record with no verdict');
assertEqual(oldProjection.evening.verdict, undefined, 'old-format evening record has no verdict field, and none is fabricated');

console.log('morning-launch-logic.selfcheck.cjs: all assertions passed');
