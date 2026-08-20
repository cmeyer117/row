// Run with: node training-insight-engine.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'training-insight-engine.js'), 'utf8'), sandbox);
const E = sandbox.window.TrainingInsightEngine;

function assert(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); process.exit(1); }
}
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

function dateSeries(startDaysAgo, count, stepDays, now) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - (startDaysAgo - i * stepDays));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const NOW = new Date('2026-08-20T00:00:00.000Z');

// --- sample-size floor: fewer than 4 exposures -> no finding, ever ---
assertEqual(E.detectStalledExercise({ exerciseName: 'Bench', exposures: [
  { date: '2026-08-01', load: 100, reps: 8 },
  { date: '2026-08-05', load: 102, reps: 8 },
  { date: '2026-08-10', load: 101, reps: 8 },
] }), null, 'fewer than 4 exposures never triggers a trend');

// --- low confidence: 5 exposures, same bracket, plateau, within 30 days ---
{
  const dates = dateSeries(20, 5, 5, NOW);
  const loads = [100, 102, 101, 103, 101];
  const exposures = dates.map((d, i) => ({ date: d, load: loads[i], reps: 8 }));
  const f = E.detectStalledExercise({ exerciseName: 'Squat', exposures });
  assert(f, 'low-confidence plateau case should produce a finding');
  assertEqual(f.confidence, 'low', 'low confidence: 4-5 exposures within 30 days');
  assertEqual(f.type, 'stalled-load-plateau', 'plateau (no new PR), not a regression, when within 1 SD');
}

// --- medium confidence: 6 exposures, same bracket, genuine declining
// trend (NOT a deload -- second half is still declining, not flat/rising) ---
{
  const dates = dateSeries(40, 6, 8, NOW);
  const loads = [110, 108, 104, 100, 98, 90];
  const exposures = dates.map((d, i) => ({ date: d, load: loads[i], reps: 8 }));
  const f = E.detectStalledExercise({ exerciseName: 'Deadlift', exposures });
  assert(f, 'genuine declining trend should still flag as a regression');
  assertEqual(f.confidence, 'medium', 'medium confidence: 6-9 exposures in the same rep bracket');
  assertEqual(f.type, 'stalled-load-regression', 'gradual decline (not a deload pattern) flags as regression');
}

// --- high confidence: 10+ exposures, 60-day window, CV < 15% ---
{
  const dates = dateSeries(54, 10, 6, NOW);
  const loads = [148, 150, 149, 151, 150, 149, 152, 150, 151, 150];
  const exposures = dates.map((d, i) => ({ date: d, load: loads[i], reps: 8 }));
  const f = E.detectStalledExercise({ exerciseName: 'Leg Press', exposures });
  assert(f, 'high-confidence plateau case should produce a finding');
  assertEqual(f.confidence, 'high', '10+ exposures, 60-day window, CV<15% -> high confidence');
}

// --- deload guard: sharp drop after a flat/rising block must NOT be
// flagged as a regression ---
{
  const dates = dateSeries(35, 6, 7, NOW);
  const loads = [80, 90, 100, 110, 120, 80]; // rising block, then a planned-looking drop
  const exposures = dates.map((d, i) => ({ date: d, load: loads[i], reps: 8 }));
  const f = E.detectStalledExercise({ exerciseName: 'OHP', exposures });
  assertEqual(f, null, 'a sharp drop after a sustained rising block reads as a deload, not a regression -- suppressed');
}

// --- rep-range shift: switching brackets suppresses the insight until
// N=4 is re-established in the NEW bracket ---
{
  const oldDates = dateSeries(40, 5, 5, NOW); // 5 exposures @ reps 8 (bracket 8-12)
  const newDates = dateSeries(10, 3, 4, NOW); // then only 3 exposures @ reps 4 (bracket 4-7)
  const exposures = oldDates.map(d => ({ date: d, load: 150, reps: 8 }))
    .concat(newDates.map(d => ({ date: d, load: 100, reps: 4 })));
  const f = E.detectStalledExercise({ exerciseName: 'Row', exposures });
  assertEqual(f, null, 'only 3 exposures in the new rep bracket -- suppressed, old bracket history not reused');
}

// --- missed-session trend ---
{
  const baseline = dateSeries(42, 7, 4, NOW).filter(d => d <= new Date(NOW.getTime() - 15 * 86400000).toISOString().slice(0, 10));
  const recent = [new Date(NOW.getTime() - 5 * 86400000).toISOString().slice(0, 10)];
  const f = E.detectMissedSessionTrend({ sessionDates: baseline.concat(recent), now: NOW });
  assert(f, 'a real drop in session frequency should produce a finding');
  assertEqual(f.type, 'missed-session-trend', 'missed-session finding type');
}
assertEqual(E.detectMissedSessionTrend({ sessionDates: ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-19'], now: NOW }), null, 'steady session cadence -- no finding');

// --- volume/intensity vs phase ---
{
  const f = E.detectVolumePhaseSignal({ weeklySets: [20, 21, 19, 20, 14, 15], phase: 'growth' });
  assert(f, 'a real volume drop during growth phase should flag');
  assertEqual(f.type, 'volume-phase-mismatch', 'volume-phase finding type');
}
assertEqual(E.detectVolumePhaseSignal({ weeklySets: [20, 21, 19, 20, 20, 21], phase: 'growth' }), null, 'stable volume during growth -- no finding');
assertEqual(E.detectVolumePhaseSignal({ weeklySets: [20, 21, 19], phase: 'growth' }), null, 'too little volume history -- no finding');

// --- sleep/macro recovery correlation ---
{
  const sleepEntries = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(NOW); d.setUTCDate(d.getUTCDate() - (39 - i));
    const hours = i >= 33 ? 4 : (i % 2 === 0 ? 7 : 8); // last 7 days depressed, prior 33 alternate 7/8
    sleepEntries.push({ date: d.toISOString().slice(0, 10), hours: hours });
  }
  const withStall = E.detectRecoverySignal({ sleepEntries, now: NOW, performanceStalled: true });
  assert(withStall, 'sleep deviation + concurrent performance stall should flag');
  assertEqual(withStall.type, 'recovery-signal', 'recovery-signal finding type');
  assertEqual(withStall.confidence, 'medium', 'recovery correlation is never higher than medium confidence');

  const withoutStall = E.detectRecoverySignal({ sleepEntries, now: NOW, performanceStalled: false });
  assertEqual(withoutStall, null, 'sleep deviation alone, with no concurrent performance stall, never fires');
}
assertEqual(E.detectRecoverySignal({ sleepEntries: [{ date: '2026-08-19', hours: 4 }], now: NOW, performanceStalled: true }), null, 'a single night is never enough data -- no finding');

// --- orchestrator: never throws on thin/partial input ---
assertEqual(E.runInsightEngine({}).length, 0, 'runInsightEngine on empty input returns no findings, does not throw');

console.log('All training-insight-engine self-checks passed.');
