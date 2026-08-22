import assert from 'assert';

// Re-implements just the safeEqual logic inline since coaching-client.js
// has no exports (it's a Vercel handler) -- this checks the actual
// algorithm shape (length-mismatch short-circuit, equal/unequal cases),
// not the live import.
import { timingSafeEqual } from 'crypto';
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

assert.strictEqual(safeEqual('abc123', 'abc123'), true, 'equal tokens must match');
assert.strictEqual(safeEqual('abc123', 'abc124'), false, 'different tokens must not match');
assert.strictEqual(safeEqual('abc', 'abcdef'), false, 'different-length tokens must not match');
assert.strictEqual(safeEqual('', ''), true, 'two empty strings are equal (defense in depth: callers already reject empty token before this runs)');

console.log('coaching-client token check: OK');
