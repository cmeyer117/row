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

// --- Codex bug #1: double-progression (reps climbing at a flat load) must
// NOT be flagged as a plateau -- load stayed the same but reps are a new
// high every exposure ---
{
  const dates = ['2026-08-01', '2026-08-05', '2026-08-10', '2026-08-15'];
  const reps = [8, 9, 10, 11];
  const exposures = dates.map((d, i) => ({ date: d, load: 100, reps: reps[i] }));
  const f = E.detectStalledExercise({ exerciseName: 'Bench', exposures });
  assertEqual(f, null, 'load flat but reps climbing every exposure (100x8,100x9,100x10,100x11) is real double-progression, not a plateau');
}

// --- Codex bug #2: an already-declining historical block must not qualify
// a further drop as an "intentional deload" ---
assertEqual(
  E.looksLikeIntentionalDeload([100, 100, 99, 99, 98, 98], 85),
  false,
  'historical block already trending down (100,100,99,99,98,98) + a drop to 85 is a real regression, not a planned deload'
);

// --- Codex bugs #3/#4: date windows were off-by-one (inclusive of an extra
// boundary day) -- confirm true 14-day / 7-day windows with no gap or
// overlap against their adjoining baseline window ---
{
  // Session frequency: 4 sparse sessions inside the true trailing-14-day
  // window (offsets 0,3,7,11), a 1-session marker sitting exactly on the
  // day-14 boundary (must land in baseline, NOT recent), and a dense
  // 27-session baseline filling offsets 15-41. If the recent window were
  // still 15 dates (the old bug), the day-14 marker would leak into it and
  // recentWeeks would come out at 2.5, not 2.
  const off = n => { const d = new Date(NOW); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const recentSparse = [0, 3, 7, 11].map(off);
  const boundaryMarker = [off(14)];
  const baselineDense = []; for (let i = 15; i <= 41; i++) baselineDense.push(off(i));
  const sessionDates = recentSparse.concat(boundaryMarker).concat(baselineDense);
  const f = E.detectMissedSessionTrend({ sessionDates, now: NOW });
  assert(f, 'sparse recent + dense baseline should still flag a drop');
  assertEqual(f.observation, 'Session frequency dropped from ~7/week to ~2/week over the last 2 weeks.',
    'recent window is a true trailing 14 days (excludes the day-14 boundary marker) and baseline is the contiguous 28 days after it (includes the marker)');
}
{
  // Recovery signal: 7 low-sleep nights at offsets 0-6 (true trailing-7-day
  // window), a marker night (20h) at the day-7 boundary that must land in
  // baseline (not recent), 29 baseline nights alternating 7h/8h at offsets
  // 8-36, and an extreme marker (-20h) at offset 37 that must be excluded
  // from baseline entirely (old baseline window reached out to day 37).
  const off = n => { const d = new Date(NOW); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const entries = [];
  for (let i = 0; i <= 6; i++) entries.push({ date: off(i), hours: 4 });
  entries.push({ date: off(7), hours: 20 });
  for (let i = 8; i <= 36; i++) entries.push({ date: off(i), hours: (i % 2 === 0 ? 7 : 8) });
  entries.push({ date: off(37), hours: -20 });
  const f = E.detectRecoverySignal({ sleepEntries: entries, now: NOW, performanceStalled: true });
  assert(f, 'a real 7-day sleep deviation with a concurrent stall should flag');
  assertEqual(f.observation, '7-day avg sleep (4h) is below the 30-day baseline (7.9h) by 1.7 SD, alongside a performance stall this week.',
    'recent window is a true trailing 7 days (excludes the day-7 marker) and baseline is the contiguous 30 days after it (includes day 7, excludes day 37)');
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

// --- chronic per-muscle volume mismatch ---
{
  const band = { mev: 8, mrv: 22 };

  assertEqual(
    E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'under', 'under', 'under'], band, 2),
    null,
    'a qualifying 3-week run is suppressed when fewer than 3 weeks have any real training history'
  );

  assertEqual(
    E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'mav', 'under', 'under'], band, 6),
    null,
    'a 2-week run is too short to call chronic, even with plenty of real history'
  );

  {
    const f = E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'under', 'under', 'under'], band, 6);
    assert(f, 'a real 3-week under-MEV run should fire');
    assertEqual(f.type, 'chronic-muscle-under', 'chronic-muscle-under finding type');
    assertEqual(f.muscle, 'Chest', 'finding carries the muscle name');
    assertEqual(f.severity, 'low', 'exactly 3 weeks is low severity');
  }

  {
    const f = E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'under', 'under', 'under', 'under'], band, 6);
    assert(f, 'a real 4-week under-MEV run should fire');
    assertEqual(f.severity, 'medium', '4+ weeks escalates to medium severity');
  }

  {
    const f = E.detectChronicMuscleVolume('Back', ['mav', 'mav', 'mav', 'mrv', 'mrv', 'mrv'], band, 6);
    assert(f, 'a real 3-week at/above-MRV run should fire');
    assertEqual(f.type, 'chronic-muscle-over', 'chronic-muscle-over finding type');
  }

  assertEqual(
    E.detectChronicMuscleVolume('Chest', ['under', 'under', 'under', 'mav'], band, 4),
    null,
    'the streak must be current -- an under-run that ended is not a chronic mismatch today'
  );

  {
    const highCoverage = E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'under', 'under', 'under'], band, 6);
    assertEqual(highCoverage.confidence, 'medium', 'observedWeeks >= 5 -> medium confidence');
    const lowCoverage = E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'under', 'under', 'under'], band, 3);
    assertEqual(lowCoverage.confidence, 'low', 'observedWeeks 3-4 -> low confidence, even with the same 3-week run');
  }
}

// --- orchestrator: never throws on thin/partial input ---
assertEqual(E.runInsightEngine({}).length, 0, 'runInsightEngine on empty input returns no findings, does not throw');

console.log('All training-insight-engine self-checks passed.');
