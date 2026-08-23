// Self-check for sync.js's mergeObjects() -- extracts the real function via
// window.RowSyncMergeObjects (a top-level export, unlike mergeArrays which
// stays nested inside initCloudSync's closure). See
// docs/superpowers/specs/2026-08-20-object-key-conflict-merge-design.md.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, 'sync.js'), 'utf8');
const sandbox = { window: { SUPABASE_CONFIG: { URL: 'https://example.supabase.co', KEY: 'test-key' } } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const mergeObjects = sandbox.window.RowSyncMergeObjects;
if (typeof mergeObjects !== 'function') {
  console.error('sync-merge-objects.selfcheck.cjs: window.RowSyncMergeObjects not found in sync.js');
  process.exit(1);
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`); process.exit(1); }
}

// Disjoint keys on both sides are all kept -- the core fix, since a
// wholesale replace would have dropped whichever side lost.
assertEqual(
  mergeObjects({ a: 1, updated_at: '2026-01-01T00:00:00Z' }, { b: 2, updated_at: '2026-01-01T00:00:00Z' }),
  { a: 1, updated_at: '2026-01-01T00:00:00Z', b: 2 },
  'disjoint keys from both sides survive the merge'
);

// A shared key with different values resolves to whichever side is newer.
assertEqual(
  mergeObjects({ x: 'remote', updated_at: '2026-01-02T00:00:00Z' }, { x: 'local', updated_at: '2026-01-01T00:00:00Z' }),
  { x: 'remote', updated_at: '2026-01-02T00:00:00Z' },
  'shared key: newer remote wins'
);
assertEqual(
  mergeObjects({ x: 'remote', updated_at: '2026-01-01T00:00:00Z' }, { x: 'local', updated_at: '2026-01-02T00:00:00Z' }),
  { x: 'local', updated_at: '2026-01-02T00:00:00Z' },
  'shared key: newer local wins'
);

// Missing updated_at on both sides defaults to local winning on a tie --
// matches the codebase's existing "don't lose local silently" instinct.
assertEqual(
  mergeObjects({ x: 'remote' }, { x: 'local' }),
  { x: 'local' },
  'no updated_at on either side: local wins the tie, not silently replaced by remote'
);

// Non-object / null inputs degrade to {} rather than throwing.
assertEqual(mergeObjects(null, { a: 1 }), { a: 1 }, 'null remote treated as empty object');
assertEqual(mergeObjects({ a: 1 }, null), { a: 1 }, 'null local treated as empty object');
assertEqual(mergeObjects('not an object', { a: 1 }), { a: 1 }, 'non-object remote treated as empty object');
assertEqual(mergeObjects([1, 2], { a: 1 }), { a: 1 }, 'array remote treated as empty object, not merged as an array');

console.log('sync-merge-objects.selfcheck.cjs: all assertions passed');
