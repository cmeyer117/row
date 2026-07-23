import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSubscribeUpsertRequest } from './subscribe-push-logic.js';

test('buildSubscribeUpsertRequest: new subscription — POST with merge-duplicates on endpoint conflict', () => {
  const req = buildSubscribeUpsertRequest('row', 'https://fcm.example/abc', { p256dh: 'p1', auth: 'a1' });
  assert.equal(req.url.includes('on_conflict=endpoint'), true);
  assert.equal(req.options.method, 'POST');
  assert.equal(req.options.headers.Prefer.includes('resolution=merge-duplicates'), true);
  const body = JSON.parse(req.options.body);
  assert.deepEqual(body, { app: 'row', endpoint: 'https://fcm.example/abc', p256dh: 'p1', auth: 'a1' });
});

test('buildSubscribeUpsertRequest: re-subscribe with same endpoint produces an identical request shape', () => {
  const first = buildSubscribeUpsertRequest('row', 'https://fcm.example/abc', { p256dh: 'p1', auth: 'a1' });
  const second = buildSubscribeUpsertRequest('row', 'https://fcm.example/abc', { p256dh: 'p2', auth: 'a2' });
  // Same endpoint → same conflict target and merge strategy (the upsert, not
  // the caller, is what dedups) — only the payload's key material differs.
  assert.equal(first.url, second.url);
  assert.equal(first.options.headers.Prefer, second.options.headers.Prefer);
  assert.notDeepEqual(JSON.parse(first.options.body), JSON.parse(second.options.body));
});
