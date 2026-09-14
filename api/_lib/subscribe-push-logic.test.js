import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSubscribeUpsertRequest, validateSubscription } from './subscribe-push-logic.js';

test('validateSubscription rejects a bare "https://" with no host', () => {
  const result = validateSubscription({ endpoint: 'https://', keys: { p256dh: 'x', auth: 'y' } });
  assert.equal(result.ok, false);
});

test('validateSubscription accepts a real Web Push endpoint URL', () => {
  const result = validateSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'x', auth: 'y' } });
  assert.equal(result.ok, true);
});

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
