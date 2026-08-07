// Run with: node gym-rx-phase-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-rx-phase-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.GymRxPhaseLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

// --- no phase / unrecognized phase: unchanged (backward compat) ---
let r = L.phaseAdjustedThresholds(8, 3, null, 12);
assertEqual(r.upgradeAt, 8, 'null phase leaves upgradeAt unchanged');
assertEqual(r.stuckThreshold, 3, 'null phase leaves stuckThreshold unchanged');

r = L.phaseAdjustedThresholds(8, 3, 'some-future-phase', 12);
assertEqual(r.upgradeAt, 8, 'unrecognized phase leaves upgradeAt unchanged');
assertEqual(r.stuckThreshold, 3, 'unrecognized phase leaves stuckThreshold unchanged');

// --- peak: unchanged ---
r = L.phaseAdjustedThresholds(8, 3, 'peak', 12);
assertEqual(r.upgradeAt, 8, 'peak leaves upgradeAt unchanged');
assertEqual(r.stuckThreshold, 3, 'peak leaves stuckThreshold unchanged');

// --- cut / show_prep: hold-bias ---
r = L.phaseAdjustedThresholds(8, 3, 'cut', 12);
assertEqual(r.upgradeAt, 9, 'cut raises upgradeAt by 1');
assertEqual(r.stuckThreshold, 2, 'cut lowers stuckThreshold by 1');

r = L.phaseAdjustedThresholds(8, 3, 'show_prep', 12);
assertEqual(r.upgradeAt, 9, 'show_prep raises upgradeAt by 1');
assertEqual(r.stuckThreshold, 2, 'show_prep lowers stuckThreshold by 1');

// --- growth: push-bias ---
r = L.phaseAdjustedThresholds(8, 3, 'growth', 12);
assertEqual(r.upgradeAt, 7, 'growth lowers upgradeAt by 1');
assertEqual(r.stuckThreshold, 3, 'growth leaves stuckThreshold unchanged');

// --- reverse_diet: conservative ramp ---
r = L.phaseAdjustedThresholds(8, 3, 'reverse_diet', 12);
assertEqual(r.upgradeAt, 8, 'reverse_diet leaves upgradeAt unchanged');
assertEqual(r.stuckThreshold, 4, 'reverse_diet raises stuckThreshold by 1');

// --- clamps ---
r = L.phaseAdjustedThresholds(12, 3, 'cut', 12);
assertEqual(r.upgradeAt, 12, 'upgradeAt never exceeds repMax even after a cut bump');

r = L.phaseAdjustedThresholds(1, 3, 'growth', 12);
assertEqual(r.upgradeAt, 1, 'upgradeAt never drops below 1 even after a growth reduction');

r = L.phaseAdjustedThresholds(8, 1, 'cut', 12);
assertEqual(r.stuckThreshold, 1, 'stuckThreshold never drops below 1 even after a cut reduction');

console.log('gym-rx-phase-logic.selfcheck.cjs: all assertions passed');
