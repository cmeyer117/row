// sub-history-logic.test.js — per-variant "last set" for the substitution
// picker. Loaded as a classic <script> in the browser, so vm-sandboxed here
// (same as form-coach-history.test.js).
import assert from 'node:assert'; // loose: arrays/objects built inside the vm carry a foreign prototype
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./sub-history-logic.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { lastSetPerVariant, formatLastSet } = sandbox.window.SubHistoryLogic;

const TODAY = '2026-09-09';
const VARIANTS = [null, 'Cable Press', 'DB Press'];

// never used: every variant null
{
  const r = lastSetPerVariant([], VARIANTS, TODAY);
  assert.deepEqual(r, { '': null, 'Cable Press': null, 'DB Press': null });
}

// single variant, single set
{
  const logs = [{ weight: 185, reps: 8, date: '2026-08-28', variant: 'Cable Press' }];
  const r = lastSetPerVariant(logs, VARIANTS, TODAY);
  assert.deepEqual(r['Cable Press'], { weight: 185, reps: 8, date: '2026-08-28', daysAgo: 12 });
  assert.equal(r[''], null);
  assert.equal(r['DB Press'], null);
}

// two variants on the same day stay separate
{
  const logs = [
    { weight: 100, reps: 10, date: '2026-09-08', variant: 'Cable Press' },
    { weight: 60, reps: 12, date: '2026-09-08', variant: 'DB Press' },
  ];
  const r = lastSetPerVariant(logs, VARIANTS, TODAY);
  assert.equal(r['Cable Press'].weight, 100);
  assert.equal(r['DB Press'].weight, 60);
  assert.equal(r['DB Press'].daysAgo, 1);
}

// most recent date wins, then top set by weight, then reps on a weight tie
{
  const logs = [
    { weight: 200, reps: 5, date: '2026-09-01', variant: null },  // older, heavier -- must NOT win
    { weight: 180, reps: 6, date: '2026-09-09', variant: null },
    { weight: 185, reps: 8, date: '2026-09-09', variant: null },
    { weight: 185, reps: 9, date: '2026-09-09', variant: null },
    { weight: 170, reps: 12, date: '2026-09-09', variant: null },
  ];
  const r = lastSetPerVariant(logs, VARIANTS, TODAY);
  assert.deepEqual(r[''], { weight: 185, reps: 9, date: '2026-09-09', daysAgo: 0 });
}

// legacy untagged log (no variant field at all) counts as the primary
{
  const logs = [{ weight: 150, reps: 10, date: '2026-09-02' }];
  const r = lastSetPerVariant(logs, VARIANTS, TODAY);
  assert.deepEqual(r[''], { weight: 150, reps: 10, date: '2026-09-02', daysAgo: 7 });
}

// formatting
assert.equal(formatLastSet(null), 'Never used');
assert.equal(formatLastSet({ weight: 185, reps: 8, daysAgo: 12 }), 'Last: 185 × 8 · 12d ago');
assert.equal(formatLastSet({ weight: 185, reps: 8, daysAgo: 0 }), 'Last: 185 × 8 · today');
assert.equal(formatLastSet({ weight: 185, reps: 8, daysAgo: 1 }), 'Last: 185 × 8 · yesterday');
assert.equal(formatLastSet({ weight: 0, reps: 12, daysAgo: 3 }), 'Last: 0 × 12 · 3d ago', 'bodyweight (0) is a real value, not "never"');

console.log('sub-history-logic: all passed');
