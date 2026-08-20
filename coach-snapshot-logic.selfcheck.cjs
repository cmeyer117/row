// Run with: node coach-snapshot-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'coach-snapshot-logic.js'), 'utf8'), sandbox);
const C = sandbox.window.CoachSnapshotLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

// --- scoreCountSignal ---
assertEqual(C.scoreCountSignal('matched'), 2, 'scoreCountSignal: matched -> 2');
assertEqual(C.scoreCountSignal('partly_matched'), 1, 'scoreCountSignal: partly_matched -> 1');
assertEqual(C.scoreCountSignal('not_matched'), 0, 'scoreCountSignal: not_matched -> 0');
assertEqual(C.scoreCountSignal(null), null, 'scoreCountSignal: no target set -> null');

// --- scoreSleepSignal ---
const isPoorSleep = (e) => e.poor === true;
assertEqual(C.scoreSleepSignal([{ poor: false }, { poor: false }], isPoorSleep), 2, 'scoreSleepSignal: 0 poor nights -> 2');
assertEqual(C.scoreSleepSignal([{ poor: true }, { poor: false }], isPoorSleep), 1, 'scoreSleepSignal: 1 poor night -> 1');
assertEqual(C.scoreSleepSignal([{ poor: true }, { poor: true }], isPoorSleep), 0, 'scoreSleepSignal: 2+ poor nights -> 0');
assertEqual(C.scoreSleepSignal([], isPoorSleep), null, 'scoreSleepSignal: no entries this week -> null, not 0');

// --- scoreMacroSignal ---
assertEqual(C.scoreMacroSignal([false, false]), 2, 'scoreMacroSignal: 0 poor days -> 2');
assertEqual(C.scoreMacroSignal([true, false]), 1, 'scoreMacroSignal: 1 poor day -> 1');
assertEqual(C.scoreMacroSignal([true, true]), 0, 'scoreMacroSignal: 2+ poor days -> 0');
assertEqual(C.scoreMacroSignal([]), null, 'scoreMacroSignal: no days logged -> null, not 0');

// --- scoreBodyweightSignal ---
// growth: 200 lb lifter, +1 lb over 14 days = 0.5 lb/week = 0.25%/week -- squarely in the 0-0.5% good band.
assertEqual(C.scoreBodyweightSignal({ ok: true, weightDelta: 1 }, 200, 'growth'), 2, 'scoreBodyweightSignal: growth, 0.25%/wk (within 0-0.5% target) -> 2 (good)');
// growth: +4 lb over 14 days = 2 lb/week = 1%/week -- right at the "too fast" boundary, still partial not bad.
assertEqual(C.scoreBodyweightSignal({ ok: true, weightDelta: 4 }, 200, 'growth'), 1, 'scoreBodyweightSignal: growth, 1%/wk -> 1 (partial, at the too-fast boundary)');
// growth: +8 lb over 14 days = 4 lb/week = 2%/week -- clearly too fast.
assertEqual(C.scoreBodyweightSignal({ ok: true, weightDelta: 8 }, 200, 'growth'), 0, 'scoreBodyweightSignal: growth, 2%/wk -> 0 (bad, too fast)');
// growth: losing weight during a growth phase is bad.
assertEqual(C.scoreBodyweightSignal({ ok: true, weightDelta: -3 }, 200, 'growth'), 0, 'scoreBodyweightSignal: growth, losing weight -> 0 (bad)');
// cut: trending down is good.
assertEqual(C.scoreBodyweightSignal({ ok: true, weightDelta: -3 }, 200, 'cut'), 2, 'scoreBodyweightSignal: cut, trending down -> 2 (good)');
// cut: gaining during a cut is bad.
assertEqual(C.scoreBodyweightSignal({ ok: true, weightDelta: 2 }, 200, 'cut'), 0, 'scoreBodyweightSignal: cut, gaining -> 0 (bad)');
// reverse_diet: near-flat is good.
assertEqual(C.scoreBodyweightSignal({ ok: true, weightDelta: 0.3 }, 200, 'reverse_diet'), 2, 'scoreBodyweightSignal: reverse_diet, near-flat -> 2 (good)');
// reverse_diet: a big swing is bad.
assertEqual(C.scoreBodyweightSignal({ ok: true, weightDelta: -5 }, 200, 'reverse_diet'), 0, 'scoreBodyweightSignal: reverse_diet, big swing -> 0 (bad)');
// not enough data -> null.
assertEqual(C.scoreBodyweightSignal({ ok: false }, 200, 'growth'), null, 'scoreBodyweightSignal: not enough weigh-ins -> null');
assertEqual(C.scoreBodyweightSignal({ ok: true, weightDelta: 1 }, 0, 'growth'), null, 'scoreBodyweightSignal: no current weight -> null, does not divide by zero');

// --- computeVerdict ---
// pain override wins regardless of how good everything else looks.
const allGood = { cardio: 2, posing: 2, sleep: 2, macro: 2, bodyweight: 2 };
assertEqual(C.computeVerdict(allGood, 'growth', true).verdict, 'off_track', 'computeVerdict: pain=high overrides even perfect signals');

// all signals null -> not_enough_data, not a false verdict.
const allNull = { cardio: null, posing: null, sleep: null, macro: null, bodyweight: null };
assertEqual(C.computeVerdict(allNull, 'growth', false).verdict, 'not_enough_data', 'computeVerdict: all null -> not_enough_data');

// all good, growth phase -> on_track.
assertEqual(C.computeVerdict(allGood, 'growth', false).verdict, 'on_track', 'computeVerdict: all signals good -> on_track');

// growth phase: bodyweight+macro are priority (2x). Both off, everything else good.
const growthPriorityOff = { cardio: 2, posing: 2, sleep: 2, macro: 0, bodyweight: 0 };
const growthResult = C.computeVerdict(growthPriorityOff, 'growth', false);
// weighted: (2*1 + 2*1 + 2*1 + 0*2 + 0*2) / (2*1+2*1+2*1+2*2+2*2) = 6/14 = 0.43 -> needs_attention
assertEqual(growthResult.verdict, 'needs_attention', 'computeVerdict: growth priority signals off drags the ratio down more than non-priority would');
assertEqual(growthResult.offSignals.indexOf('macro') !== -1, true, 'computeVerdict: offSignals lists macro when it scored below 2');

// a phase with no priority pair defined (reverse_diet) -- equal weighting, no crash.
const reverseDietResult = C.computeVerdict(allGood, 'reverse_diet', false);
assertEqual(reverseDietResult.verdict, 'on_track', 'computeVerdict: reverse_diet (no priority pair) still computes correctly');

// unknown/null phase -- equal weighting, no crash.
const nullPhaseResult = C.computeVerdict(allGood, null, false);
assertEqual(nullPhaseResult.verdict, 'on_track', 'computeVerdict: null phase -- equal weighting, no crash');

console.log('All coach-snapshot-logic self-checks passed.');
