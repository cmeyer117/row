import assert from 'node:assert';
import { verifyOwner } from './verify-owner.js';

const fetchStub = (ok, body) => async () => ({ ok, json: async () => body });
const owner = { email: 'carl.meyer.business@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' };

const cases = [
  ['no header', undefined, fetchStub(true, owner), false],
  ['non-bearer', 'Basic abc', fetchStub(true, owner), false],
  ['token rejected', 'Bearer x', fetchStub(false, {}), false],
  ['wrong email', 'Bearer x', fetchStub(true, { email: 'evil@x.com', email_confirmed_at: '2026-01-01' }), false],
  ['unconfirmed owner', 'Bearer x', fetchStub(true, { email: owner.email, email_confirmed_at: null }), false],
  ['confirmed owner', 'Bearer x', fetchStub(true, owner), true],
];

for (const [label, header, f, expected] of cases) {
  assert.equal(await verifyOwner(header, 'https://u', 'anon', f), expected, label);
}

// A stalled network call must not hang the caller forever -- resolves false
// once the timeout elapses, regardless of whether the fetch ever settles.
const neverResolves = async () => new Promise(() => {});
const start = Date.now();
const timedOut = await verifyOwner('Bearer x', 'https://u', 'anon', neverResolves, 50);
assert.equal(timedOut, false, 'stalled fetch times out to false');
assert.ok(Date.now() - start < 500, 'timeout bound was actually respected, not a real hang');

// Regression test (2026-08-18): abort() was being called unconditionally
// after the real fetch already settled, crashing this function on Vercel's
// runtime (uncaught DOMException/AbortError, 500ing every request) -- even
// on the normal fast-success path, not just when the timeout won the race.
// Must never abort a signal whose request has already completed.
let capturedSignal = null;
const capturingFetch = async (_url, opts) => { capturedSignal = opts.signal; return { ok: true, json: async () => owner }; };
await verifyOwner('Bearer x', 'https://u', 'anon', capturingFetch);
assert.equal(capturedSignal.aborted, false, 'must not abort a request that already settled normally');

console.log('verify-owner: all cases pass');
