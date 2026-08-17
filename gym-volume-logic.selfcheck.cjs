// Run with: node gym-volume-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-volume-logic.js'), 'utf8'), sandbox);
const { mondayOfDate, weeklyVolumeByDay, weeklySetsByMuscle, classifyMuscleVolume, volumeAdvisory, matchesVolumeDecision } = sandbox.window.GymVolumeLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// mondayOfDate — a known Wednesday maps to that week's Monday.
assertEqual(mondayOfDate(new Date('2026-08-05T12:00:00Z')), '2026-08-03', 'mondayOfDate maps a Wednesday to the same week\'s Monday');

// mondayOfDate — a Sunday maps BACKWARD to the same week's Monday, not forward to next week.
assertEqual(mondayOfDate(new Date('2026-08-09T12:00:00Z')), '2026-08-03', 'mondayOfDate maps a Sunday to the same week\'s Monday, not the next week\'s');

// weeklyVolumeByDay — two sets in the same week, same exercise, sum into one bucket.
const thisMonday = mondayOfDate(new Date());
const sameWeekA = thisMonday + 'T12:00:00.000Z';
const sameWeekBDate = new Date(thisMonday + 'T00:00:00Z');
sameWeekBDate.setUTCDate(sameWeekBDate.getUTCDate() + 2);
const sameWeekB = sameWeekBDate.toISOString();

const exercises = [{ id: 'a', day: 'push' }];
const logsSameWeek = { a: [
  { date: sameWeekA, weight: 100, reps: 10 },
  { date: sameWeekB, weight: 100, reps: 8 },
] };
const resultSameWeek = weeklyVolumeByDay(exercises, logsSameWeek, 'all', 4);
const thisWeekEntry = resultSameWeek.find((w) => w.weekKey === thisMonday);
assertEqual(thisWeekEntry.totalVol, 100 * 10 + 100 * 8, 'weeklyVolumeByDay sums two same-week sets into one bucket');

// weeklyVolumeByDay — sets from different weeks land in different buckets.
const priorMondayDate = new Date(thisMonday + 'T00:00:00Z');
priorMondayDate.setUTCDate(priorMondayDate.getUTCDate() - 7);
const priorMonday = priorMondayDate.toISOString().slice(0, 10);
const logsDiffWeeks = { a: [
  { date: sameWeekA, weight: 100, reps: 10 },
  { date: priorMonday + 'T12:00:00.000Z', weight: 50, reps: 5 },
] };
const resultDiffWeeks = weeklyVolumeByDay(exercises, logsDiffWeeks, 'all', 4);
assertEqual(resultDiffWeeks.find((w) => w.weekKey === thisMonday).totalVol, 1000, 'weeklyVolumeByDay keeps this week\'s volume separate from last week\'s');
assertEqual(resultDiffWeeks.find((w) => w.weekKey === priorMonday).totalVol, 250, 'weeklyVolumeByDay keeps last week\'s volume separate from this week\'s');

// weeklyVolumeByDay — dayFilter excludes exercises from other days, 'all' includes everything.
const twoDayExercises = [{ id: 'a', day: 'push' }, { id: 'b', day: 'pull' }];
const twoDayLogs = {
  a: [{ date: sameWeekA, weight: 100, reps: 10 }],
  b: [{ date: sameWeekA, weight: 50, reps: 10 }],
};
const pushOnly = weeklyVolumeByDay(twoDayExercises, twoDayLogs, 'push', 4);
assertEqual(pushOnly.find((w) => w.weekKey === thisMonday).totalVol, 1000, 'weeklyVolumeByDay with dayFilter=push excludes the pull exercise\'s volume');
const allDays = weeklyVolumeByDay(twoDayExercises, twoDayLogs, 'all', 4);
assertEqual(allDays.find((w) => w.weekKey === thisMonday).totalVol, 1500, 'weeklyVolumeByDay with dayFilter=all includes both exercises\' volume');

// weeklyVolumeByDay — a bodyweight exercise (weight: 0) contributes 0, not NaN.
const bwLogs = { a: [{ date: sameWeekA, weight: 0, reps: 12 }] };
const bwResult = weeklyVolumeByDay(exercises, bwLogs, 'all', 4);
assertEqual(bwResult.find((w) => w.weekKey === thisMonday).totalVol, 0, 'weeklyVolumeByDay treats a bodyweight exercise (weight 0) as 0 volume, not NaN');

// weeklyVolumeByDay — a week with zero logged sets appears as a real 0, not omitted.
const sparseResult = weeklyVolumeByDay(exercises, logsSameWeek, 'all', 4);
assertEqual(sparseResult.find((w) => w.weekKey === priorMonday).totalVol, 0, 'weeklyVolumeByDay includes a zero-volume week rather than omitting it');

// weeklyVolumeByDay — weeksBack caps the returned array length.
assertEqual(weeklyVolumeByDay(exercises, logsSameWeek, 'all', 3).length, 3, 'weeklyVolumeByDay respects weeksBack');
assertEqual(weeklyVolumeByDay(exercises, logsSameWeek, 'all', 10).length, 10, 'weeklyVolumeByDay defaults/respects a larger weeksBack too');

// weeklySetsByMuscle — counts logged SETS (not weight×reps) per muscle,
// for the current week only.
const musclesExercises = [
  { id: 'chest1', muscle: 'Chest' },
  { id: 'back1', muscle: 'Back' },
  { id: 'notagged' }, // no muscle field — must be excluded, not crash
];
const musclesLogsThisWeek = {
  chest1: [
    { date: sameWeekA, weight: 100, reps: 10 },
    { date: sameWeekB, weight: 105, reps: 8 },
  ],
  back1: [
    { date: sameWeekA, weight: 50, reps: 10 },
  ],
  notagged: [
    { date: sameWeekA, weight: 20, reps: 10 },
  ],
};
const muscleCounts = weeklySetsByMuscle(musclesExercises, musclesLogsThisWeek);
assertEqual(muscleCounts.Chest, 2, 'weeklySetsByMuscle counts 2 logged sets for Chest, not weight or reps');
assertEqual(muscleCounts.Back, 1, 'weeklySetsByMuscle counts 1 logged set for Back');
assertEqual('Untagged' in muscleCounts, false, 'weeklySetsByMuscle excludes an untagged exercise rather than bucketing it as "Untagged"');

// weeklySetsByMuscle — a muscle with zero logged sets this week is still
// present in the result as 0, not omitted (same convention as weeklyVolumeByDay).
assertEqual(muscleCounts.Quads, 0, 'weeklySetsByMuscle includes a zero-set muscle as 0, not omitted');

// weeklySetsByMuscle — only counts THIS week, ignores prior weeks.
const musclesLogsMixedWeeks = {
  chest1: [
    { date: sameWeekA, weight: 100, reps: 10 },
    { date: priorMonday + 'T12:00:00.000Z', weight: 90, reps: 10 },
  ],
};
const mixedWeekCounts = weeklySetsByMuscle([{ id: 'chest1', muscle: 'Chest' }], musclesLogsMixedWeeks);
assertEqual(mixedWeekCounts.Chest, 1, 'weeklySetsByMuscle only counts sets from the current week, ignoring prior weeks');

// weeklySetsByMuscle — an explicit refDate counts THAT week instead of the
// current week (used by the decision-to-execution scoreboard to score a
// past week's follow-through, not just "now").
const refDateCounts = weeklySetsByMuscle([{ id: 'chest1', muscle: 'Chest' }], musclesLogsMixedWeeks, new Date(priorMonday + 'T12:00:00.000Z'));
assertEqual(refDateCounts.Chest, 1, 'weeklySetsByMuscle with an explicit refDate counts that week\'s set, not the current week\'s');

// weeklySetsByMuscle — a set with RIR >= 4 is excluded (not a hard set).
const rirExercises = [{ id: 'chest1', muscle: 'Chest' }];
const rirLogsExcluded = { chest1: [
  { date: sameWeekA, weight: 100, reps: 10, rir: 4 },
  { date: sameWeekB, weight: 100, reps: 8, rir: 5 },
] };
assertEqual(weeklySetsByMuscle(rirExercises, rirLogsExcluded).Chest, 0, 'weeklySetsByMuscle excludes sets with RIR >= 4');

// weeklySetsByMuscle — a set with RIR 3 (or lower) counts as hard.
const rirLogsIncluded = { chest1: [
  { date: sameWeekA, weight: 100, reps: 10, rir: 3 },
  { date: sameWeekB, weight: 100, reps: 8, rir: 0 },
] };
assertEqual(weeklySetsByMuscle(rirExercises, rirLogsIncluded).Chest, 2, 'weeklySetsByMuscle counts sets with RIR 3 or below as hard');

// weeklySetsByMuscle — a set with no RIR logged counts (missing RIR defaults to hard).
const rirLogsMissing = { chest1: [{ date: sameWeekA, weight: 100, reps: 10 }] };
assertEqual(weeklySetsByMuscle(rirExercises, rirLogsMissing).Chest, 1, 'weeklySetsByMuscle counts a set with no RIR logged as hard');

// weeklySetsByMuscle — an exercise in EXERCISE_MUSCLE_CONTRIBUTIONS adds
// weighted secondary credit alongside full primary credit, same week.
const secondaryExercises = [{ id: 'bench', name: 'Smith Machine Flat Chest Press', muscle: 'Chest' }];
const secondaryLogs = { bench: [{ date: sameWeekA, weight: 200, reps: 8 }] };
const secondaryCounts = weeklySetsByMuscle(secondaryExercises, secondaryLogs);
assertEqual(secondaryCounts.Chest, 1, 'weeklySetsByMuscle gives full primary credit to Chest for a chest press');
assertEqual(secondaryCounts.Triceps, 0.5, 'weeklySetsByMuscle gives 0.5 secondary credit to Triceps for a chest press');

// weeklySetsByMuscle — an exercise with no contribution-map entry only
// contributes to its primary muscle (no secondary credit anywhere).
const noSecondaryExercises = [{ id: 'ext', name: 'Leg Extension', muscle: 'Quads' }];
const noSecondaryLogs = { ext: [{ date: sameWeekA, weight: 100, reps: 12 }] };
const noSecondaryCounts = weeklySetsByMuscle(noSecondaryExercises, noSecondaryLogs);
assertEqual(noSecondaryCounts.Quads, 1, 'weeklySetsByMuscle gives full primary credit for an exercise with no secondary mapping');
assertEqual(noSecondaryCounts.Hamstrings, 0, 'weeklySetsByMuscle adds no secondary credit for an exercise with no contribution-map entry');

// phaseTarget — growth targets mavHigh, cut/show_prep/reverse_diet target
// mavLow, peak/null/unrecognized has no target (falls back to static bands).
assertEqual(classifyMuscleVolume('Chest', 15, 'growth').target, 20, 'classifyMuscleVolume: growth phase targets mavHigh');
assertEqual(classifyMuscleVolume('Chest', 15, 'cut').target, 12, 'classifyMuscleVolume: cut phase targets mavLow');
assertEqual(classifyMuscleVolume('Chest', 15, 'show_prep').target, 12, 'classifyMuscleVolume: show_prep phase targets mavLow');
assertEqual(classifyMuscleVolume('Chest', 15, 'reverse_diet').target, 12, 'classifyMuscleVolume: reverse_diet phase targets mavLow');
assertEqual(classifyMuscleVolume('Chest', 15, 'peak').target, null, 'classifyMuscleVolume: peak phase has no target');
assertEqual(classifyMuscleVolume('Chest', 15, null).target, null, 'classifyMuscleVolume: no phase has no target');
assertEqual(classifyMuscleVolume('Chest', 15, 'not_a_real_phase').target, null, 'classifyMuscleVolume: unrecognized phase string has no target');
assertEqual(classifyMuscleVolume('Chest', 15).target, null, 'classifyMuscleVolume: omitted phase argument has no target (backward compatible)');

// classifyMuscleVolume — belowTarget compares count against the phase target.
assertEqual(classifyMuscleVolume('Chest', 15, 'growth').belowTarget, true, 'classifyMuscleVolume: 15 sets is below growth\'s target of 20');
assertEqual(classifyMuscleVolume('Chest', 20, 'growth').belowTarget, false, 'classifyMuscleVolume: 20 sets is not below growth\'s target of 20');
assertEqual(classifyMuscleVolume('Chest', 15, null).belowTarget, false, 'classifyMuscleVolume: belowTarget is always false with no phase target');

// volumeAdvisory — in MAV range, below the phase target: add_set with
// phase-flavored wording, even when NOT stalled (the new proactive case).
const growthAdvisory = volumeAdvisory(classifyMuscleVolume('Chest', 15, 'growth'), false, 'growth');
assertEqual(growthAdvisory.suggestion, 'add_set', 'volumeAdvisory: below growth target suggests add_set even when not stalled');
assertEqual(growthAdvisory.reason.toLowerCase().indexOf('growth') !== -1 && growthAdvisory.reason.toLowerCase().indexOf('push') !== -1, true, 'volumeAdvisory: growth-phase reason is phase-flavored');

const cutAdvisory = volumeAdvisory(classifyMuscleVolume('Chest', 9, 'cut'), false, 'cut');
assertEqual(cutAdvisory.suggestion, 'add_set', 'volumeAdvisory: below cut target suggests add_set even when not stalled');
assertEqual(cutAdvisory.reason.toLowerCase().indexOf('minimum') !== -1, true, 'volumeAdvisory: cut-phase reason mentions minimum-effective framing');

// volumeAdvisory — in MAV, AT/ABOVE the phase target, not stalled: same
// today's-behavior null (the regression guard for the common growth case
// where volume is already at the phase's ceiling).
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 20, 'growth'), false, 'growth'), null, 'volumeAdvisory: at growth target and not stalled returns null');

// volumeAdvisory — no phase set, in MAV, not stalled: unchanged from today
// (the core no-regression check for users without an active season).
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 15, null), false, null), null, 'volumeAdvisory: no phase, in MAV, not stalled returns null (unchanged)');

// volumeAdvisory — under MEV and at/above MRV are phase-independent.
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 3, 'growth'), false, 'growth').suggestion, 'add_set', 'volumeAdvisory: under MEV suggests add_set regardless of phase');
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 25, 'cut'), false, 'cut').suggestion, 'pull_back', 'volumeAdvisory: at/above MRV suggests pull_back regardless of phase');

// classifyMuscleVolume — under MEV, in MAV range, at/above MRV.
assertEqual(classifyMuscleVolume('Chest', 3).label, 'under', 'classifyMuscleVolume: 3 sets for Chest (MEV 8) is under');
assertEqual(classifyMuscleVolume('Chest', 15).label, 'mav', 'classifyMuscleVolume: 15 sets for Chest (MAV 12-20) is in range');
assertEqual(classifyMuscleVolume('Chest', 25).label, 'mrv', 'classifyMuscleVolume: 25 sets for Chest (MRV 22) is at/above');
assertEqual(classifyMuscleVolume('Chest', 8).mev, 8, 'classifyMuscleVolume returns the muscle\'s MEV value');
assertEqual(classifyMuscleVolume('Chest', 8).mrv, 22, 'classifyMuscleVolume returns the muscle\'s MRV value');

// volumeAdvisory — under MEV always suggests adding a set, regardless of stall.
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 3), false).suggestion, 'add_set', 'volumeAdvisory: under MEV suggests add_set even when not stalled');

// volumeAdvisory — in MAV range, not stalled: nothing to say.
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 15), false), null, 'volumeAdvisory: in MAV range and not stalled returns null');

// volumeAdvisory — in MAV range, but stalled: suggests adding a set (RP-style, not an automatic deload).
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 15), true).suggestion, 'add_set', 'volumeAdvisory: stalled but under MRV suggests add_set');

// volumeAdvisory — at/above MRV: suggests pulling back, regardless of stall.
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 25), false).suggestion, 'pull_back', 'volumeAdvisory: at/above MRV suggests pull_back');
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 25), true).suggestion, 'pull_back', 'volumeAdvisory: at/above MRV suggests pull_back even when also stalled');

// volumeAdvisory — unknown muscle (null band) returns null, doesn't crash.
assertEqual(volumeAdvisory(null, true), null, 'volumeAdvisory: null band (unknown muscle) returns null');

// matchesVolumeDecision — add_set is followed only if actual exceeds baseline.
assertEqual(matchesVolumeDecision('add_set', 10, 12), true, 'matchesVolumeDecision: add_set followed when actual > baseline');
assertEqual(matchesVolumeDecision('add_set', 10, 10), false, 'matchesVolumeDecision: add_set not followed when actual === baseline');
assertEqual(matchesVolumeDecision('add_set', 10, 8), false, 'matchesVolumeDecision: add_set not followed when actual < baseline');

// matchesVolumeDecision — pull_back is followed only if actual falls under baseline.
assertEqual(matchesVolumeDecision('pull_back', 10, 8), true, 'matchesVolumeDecision: pull_back followed when actual < baseline');
assertEqual(matchesVolumeDecision('pull_back', 10, 10), false, 'matchesVolumeDecision: pull_back not followed when actual === baseline');
assertEqual(matchesVolumeDecision('pull_back', 10, 12), false, 'matchesVolumeDecision: pull_back not followed when actual > baseline');

// matchesVolumeDecision — keep allows +/-1 tolerance (fractional secondary-muscle
// credit and normal week-to-week set-count drift shouldn't false-negative a
// genuine "kept it about the same" week).
assertEqual(matchesVolumeDecision('keep', 10, 10), true, 'matchesVolumeDecision: keep followed on exact match');
assertEqual(matchesVolumeDecision('keep', 10, 9), true, 'matchesVolumeDecision: keep followed within -1 tolerance');
assertEqual(matchesVolumeDecision('keep', 10, 11), true, 'matchesVolumeDecision: keep followed within +1 tolerance');
assertEqual(matchesVolumeDecision('keep', 8.5, 8), true, 'matchesVolumeDecision: keep followed within tolerance for a fractional secondary-credit baseline');
assertEqual(matchesVolumeDecision('keep', 10, 8), false, 'matchesVolumeDecision: keep not followed beyond tolerance');

// matchesVolumeDecision — no baseline (old-format decisions) or an
// unrecognized action both return null (no verdict, not a false negative).
assertEqual(matchesVolumeDecision('add_set', null, 12), null, 'matchesVolumeDecision: null baseline returns null (old-format decision)');
assertEqual(matchesVolumeDecision('not_a_real_action', 10, 12), null, 'matchesVolumeDecision: unrecognized action returns null');

console.log('gym-volume-logic.selfcheck.cjs: all assertions passed');
