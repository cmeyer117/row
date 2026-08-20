// Loaded as a classic <script> tag in the browser — see
// gym-state-merge-logic.test.js for why this sandboxes instead of import/require.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./gym-weight-outlier-logic.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { checkWeightOutlier } = sandbox.window.GymWeightOutlierLogic;

const cases = [];

{
  const result = checkWeightOutlier([], 25);
  cases.push(['no prior logs -> null (nothing to compare)', result === null]);
}
{
  const result = checkWeightOutlier([{ weight: 25, reps: 8 }], 27.5);
  cases.push(['normal +2.5lb progression -> null', result === null]);
}
{
  const result = checkWeightOutlier([{ weight: 10, reps: 8 }], 100);
  cases.push(['dropped-decimal typo (10 -> 100) flagged', result && result.multiplier === 10]);
}
{
  const result = checkWeightOutlier([{ weight: 100, reps: 8 }], 10);
  cases.push(['same typo the other direction (100 -> 10) flagged', result && result.multiplier === 10]);
}
{
  const result = checkWeightOutlier([{ weight: 45, reps: 8 }], 135);
  cases.push(['exactly at the 3x boundary flagged', result && result.multiplier === 3]);
}
{
  const result = checkWeightOutlier([{ weight: 45, reps: 8 }], 134);
  cases.push(['just under the 3x boundary -> null', result === null]);
}
{
  const result = checkWeightOutlier([{ weight: 0, reps: 12 }], 0);
  cases.push(['bodyweight exercise (weight 0) never flagged', result === null]);
}
{
  const result = checkWeightOutlier([{ weight: 25, reps: 8 }, { weight: 25, reps: 9 }, { weight: 100, reps: 5 }], 105);
  cases.push(['compares against the most recent entry, not an earlier one', result === null]);
}
{
  const result = checkWeightOutlier([{ weight: 135, reps: 8 }], 45);
  cases.push(['exactly at the 1/3x boundary flagged', result && result.multiplier === 3]);
}
{
  const result = checkWeightOutlier([{ weight: 135, reps: 8 }], 46);
  cases.push(['just above the 1/3x boundary -> null', result === null]);
}
{
  const result = checkWeightOutlier([{ weight: 25, reps: 8 }], NaN);
  cases.push(['NaN new weight -> null, not a crash', result === null]);
}
{
  const result = checkWeightOutlier([{ weight: NaN, reps: 8 }], 100);
  cases.push(['malformed prior weight (NaN) -> null, not a crash', result === null]);
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`gym-weight-outlier-logic: all ${cases.length} cases pass`);
