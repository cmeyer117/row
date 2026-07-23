// Run with: node coaching-diet-trend.selfcheck.cjs
// See coaching-exercise-meta.selfcheck.cjs for why this uses a Function-scope
// module shim instead of require() — package.json's "type":"module" breaks
// plain require() for this repo's UMD-style dual-export .js files.
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'coaching-diet-trend.js'), 'utf8');
const moduleShim = { exports: {} };
new Function('module', 'exports', src)(moduleShim, moduleShim.exports);
const { suggestCalorieAdjustment } = moduleShim.exports;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

assertEqual(suggestCalorieAdjustment('cut', []), null, 'no logs returns null');
assertEqual(suggestCalorieAdjustment('cut', [{ weight: 200, logged_at: '2026-07-01' }]), null, 'one log returns null');
assertEqual(
  suggestCalorieAdjustment('cut', [{ weight: 200, logged_at: '2026-07-01' }, { weight: 200, logged_at: '2026-07-15' }]).direction,
  'decrease',
  'flat weight on a cut suggests a decrease'
);
assertEqual(
  suggestCalorieAdjustment('cut', [{ weight: 200, logged_at: '2026-07-01' }, { weight: 195, logged_at: '2026-07-15' }]),
  null,
  'weight trending down on a cut suggests nothing'
);
assertEqual(
  suggestCalorieAdjustment('bulk', [{ weight: 180, logged_at: '2026-07-01' }, { weight: 180, logged_at: '2026-07-15' }]).direction,
  'increase',
  'flat weight on a bulk suggests an increase'
);
assertEqual(suggestCalorieAdjustment('recomp', [{ weight: 180, logged_at: '2026-07-01' }, { weight: 180, logged_at: '2026-07-15' }]), null, 'recomp never suggests an adjustment');

console.log('coaching-diet-trend.selfcheck.cjs: all assertions passed');
