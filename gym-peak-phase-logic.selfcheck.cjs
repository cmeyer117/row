// Run with: node gym-peak-phase-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-peak-phase-logic.js'), 'utf8'), sandbox);
const { peakFreezeResult } = sandbox.window.GymPeakPhaseLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// peakFreezeResult — a weighted exercise freezes at last session's exact weight/reps.
const weightedResult = peakFreezeResult({ bw: false }, { weight: 185, reps: 8 }, 2);
assertEqual(weightedResult.type, 'hold', 'peakFreezeResult (weighted): type is hold');
assertEqual(weightedResult.weight, 185, 'peakFreezeResult (weighted): weight matches last session exactly');
assertEqual(weightedResult.reps, 8, 'peakFreezeResult (weighted): reps match last session exactly');
assertEqual(weightedResult.tag, 'Peak — hold', 'peakFreezeResult (weighted): tag is Peak — hold');
assertEqual(weightedResult.bw, undefined, 'peakFreezeResult (weighted): bw field is not set for a weighted exercise');
assertEqual(weightedResult.stuck, 2, 'peakFreezeResult (weighted): stuck count passes through unchanged');

// peakFreezeResult — a bodyweight exercise freezes at last session's exact reps, weight 0.
const bwResult = peakFreezeResult({ bw: true }, { weight: 0, reps: 12 }, 0);
assertEqual(bwResult.type, 'hold', 'peakFreezeResult (bw): type is hold');
assertEqual(bwResult.weight, 0, 'peakFreezeResult (bw): weight is 0');
assertEqual(bwResult.reps, 12, 'peakFreezeResult (bw): reps match last session exactly');
assertEqual(bwResult.bw, true, 'peakFreezeResult (bw): bw field is true');
assertEqual(bwResult.tag, 'Peak — hold', 'peakFreezeResult (bw): tag is Peak — hold');
assertEqual(bwResult.stuck, 0, 'peakFreezeResult (bw): stuck count passes through unchanged');

console.log('gym-peak-phase-logic.selfcheck.cjs: all assertions passed');
