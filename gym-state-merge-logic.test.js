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
const { mergeJointPain, mergeLogs } = sandbox.window.GymStateMergeLogic;

const cases = [];

// mergeLogs -- deletion (tombstone) handling.
// See docs/superpowers/specs/2026-08-12-deleted-set-resurrection-fix-design.md
{
  const entry = { date: '2026-08-11T12:00:00.000Z', weight: 315, reps: 8 };
  const remote = { ex1: [entry] };
  const local = { ex1: [Object.assign({}, entry, { deleted: true })] };
  const result = mergeLogs(remote, local);
  cases.push(['local tombstone beats remote live copy, entry dropped', !result.ex1 || result.ex1.length === 0]);
}
{
  const entry = { date: '2026-08-11T12:00:00.000Z', weight: 225, reps: 10 };
  const remote = { ex1: [Object.assign({}, entry, { deleted: true })] };
  const local = { ex1: [entry] };
  const result = mergeLogs(remote, local);
  cases.push(['remote tombstone beats local live copy, entry dropped', !result.ex1 || result.ex1.length === 0]);
}
{
  const local = { ex1: [{ date: '2026-08-12T12:00:00.000Z', weight: 100, reps: 5 }] };
  const result = mergeLogs({}, local);
  cases.push(['genuine local-only entry survives, unaffected by tombstone logic', result.ex1 && result.ex1.length === 1]);
}
{
  const remote = { ex1: [{ date: '2026-08-12T12:00:00.000Z', weight: 135, reps: 6 }] };
  const result = mergeLogs(remote, {});
  cases.push(['genuine remote-only entry survives, unaffected by tombstone logic', result.ex1 && result.ex1.length === 1]);
}
{
  const remote = { ex1: [{ date: '2026-08-10T12:00:00.000Z', weight: 185, reps: 8 }] };
  const local = { ex1: [{ date: '2026-08-11T12:00:00.000Z', weight: 190, reps: 6 }] };
  const result = mergeLogs(remote, local);
  cases.push(['two distinct non-deleted entries both survive (existing behavior unchanged)', result.ex1 && result.ex1.length === 2]);
}

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
console.log(`gym-state-merge-logic: all ${cases.length} cases pass`);
