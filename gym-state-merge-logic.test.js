// gym-state-merge-logic.js is loaded in the browser as a classic (non-module)
// <script> tag (gym.html:5911), so it can't use `export`. Under this repo's
// "type": "module" package.json, Node treats every .js file as ESM even via
// require() (returns an empty synthetic namespace instead of throwing),
// so neither `import` nor `require` reach the file's window/module.exports
// branches. Sidestep Node's module system entirely: read the source as
// text and eval it in a sandboxed `window` object, exactly mimicking what
// the browser does when it loads the <script> tag.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./gym-state-merge-logic.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { mergeJointPain } = sandbox.window.GymStateMergeLogic;

const cases = [];

// Empty/missing inputs don't throw, return empty array.
{
  const result = mergeJointPain(undefined, undefined);
  cases.push(['undefined/undefined returns []', Array.isArray(result) && result.length === 0]);
}
{
  const result = mergeJointPain(null, null);
  cases.push(['null/null returns []', Array.isArray(result) && result.length === 0]);
}

// Remote-only entries are kept.
{
  const remote = [{ joint: 'elbow', severity: 4, date: '2026-07-20' }];
  const result = mergeJointPain(remote, []);
  cases.push(['remote-only entry kept', result.length === 1 && result[0].joint === 'elbow']);
}

// Local-only entries (not present remotely) are added.
{
  const remote = [{ joint: 'elbow', severity: 4, date: '2026-07-20' }];
  const local = [
    { joint: 'elbow', severity: 4, date: '2026-07-20' }, // duplicate of remote, should not double up
    { joint: 'knee', severity: 6, date: '2026-07-21' },   // local-only, should be added
  ];
  const result = mergeJointPain(remote, local);
  cases.push(['exact duplicate not doubled', result.length === 2]);
  cases.push(['local-only entry present', result.some(e => e.joint === 'knee' && e.severity === 6)]);
}

// A stale local array (e.g. reset device) does not drop remote history.
{
  const remote = [
    { joint: 'shoulder', severity: 3, date: '2026-07-15' },
    { joint: 'elbow', severity: 5, date: '2026-07-18' },
  ];
  const local = []; // stale/reset client
  const result = mergeJointPain(remote, local);
  cases.push(['stale empty local does not drop remote history', result.length === 2]);
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`gym-state-merge-logic (jointPain): all ${cases.length} cases pass`);
