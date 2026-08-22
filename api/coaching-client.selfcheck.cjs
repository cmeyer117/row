const assert = require('assert');

// coaching-client.js is ESM (package.json "type": "module"); require() can't
// load it from a .cjs file, so this dynamic-imports the real export instead
// of re-implementing it -- keeps this check honest against the actual code
// rather than a copy that can silently drift.
(async () => {
  const { safeEqual } = await import('./coaching-client.js');

  assert.strictEqual(safeEqual('abc123', 'abc123'), true, 'equal tokens must match');
  assert.strictEqual(safeEqual('abc123', 'abc124'), false, 'different tokens must not match');
  assert.strictEqual(safeEqual('abc', 'abcdef'), false, 'different-length tokens must not match');
  assert.strictEqual(safeEqual('', ''), true, 'two empty strings are equal (defense in depth: callers already reject empty token before this runs)');

  console.log('coaching-client token check: OK');
})();
