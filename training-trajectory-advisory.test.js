// training-trajectory-advisory.js is loaded in the browser as a classic
// (non-module) <script> tag, same sandbox-eval pattern as
// gym-state-merge-logic.test.js -- see that file's header comment for why
// require()/import can't reach window.TrainingTrajectoryAdvisory directly.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./training-trajectory-advisory.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { getPendingTrajectoryAdvisory } = sandbox.window.TrainingTrajectoryAdvisory;

const cases = [];

{
  const result = getPendingTrajectoryAdvisory({ trajectory: null, allLogs: [] });
  cases.push(['no trajectory data at all -> null', result === null]);
}
{
  const trajectory = { findings: [], computedAt: '2026-08-27T12:00:00.000Z' };
  const result = getPendingTrajectoryAdvisory({ trajectory, allLogs: [] });
  cases.push(['trajectory exists but findings empty -> null', result === null]);
}
{
  const trajectory = {
    findings: [{ observation: 'Session frequency dropped from ~4/week to ~1.5/week.', confidence: 'medium' }],
    computedAt: '2026-08-27T12:00:00.000Z',
  };
  const result = getPendingTrajectoryAdvisory({ trajectory, allLogs: [] });
  cases.push(['pending finding, no logs since computedAt -> surfaces the observation', result === 'Session frequency dropped from ~4/week to ~1.5/week.']);
}
{
  const trajectory = {
    findings: [{ observation: 'Bench Press: no new load/rep high across 6 exposures.', confidence: 'high' }],
    computedAt: '2026-08-27T12:00:00.000Z',
  };
  const allLogs = [{ date: '2026-08-28T09:00:00.000Z' }]; // a set logged the day after computedAt
  const result = getPendingTrajectoryAdvisory({ trajectory, allLogs });
  cases.push(['a workout was logged after computedAt -> clears, null', result === null]);
}
{
  const trajectory = {
    findings: [{ observation: 'Still relevant.', confidence: 'medium' }],
    computedAt: '2026-08-27T12:00:00.000Z',
  };
  const allLogs = [{ date: '2026-08-20T09:00:00.000Z' }]; // older than computedAt -- doesn't count
  const result = getPendingTrajectoryAdvisory({ trajectory, allLogs });
  cases.push(['only older logs than computedAt exist -> still pending', result === 'Still relevant.']);
}
{
  const trajectory = { findings: [{ observation: '  ', confidence: 'low' }], computedAt: '2026-08-27T12:00:00.000Z' };
  const result = getPendingTrajectoryAdvisory({ trajectory, allLogs: [] });
  cases.push(['finding with blank observation text -> null, not a blank banner', result === null]);
}
{
  const result = getPendingTrajectoryAdvisory({});
  cases.push(['called with no args at all -> null, never throws', result === null]);
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`training-trajectory-advisory: all ${cases.length} cases pass`);
