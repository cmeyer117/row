// sync.js is loaded as a classic (non-module) <script> tag, so it can't use
// `export` -- same vm-sandbox pattern as row-auth-timeout.test.js. Verifies
// the 2026-08-20 fix: pushNow()/flushOnUnload() used to swallow every
// failure silently with no durable signal, and flushOnUnload() marked
// itself synced without ever reading whether the keepalive fetch actually
// succeeded. See docs/superpowers/specs/2026-08-20-visible-sync-status-design.md.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./sync.js', import.meta.url), 'utf8');

// Minimal in-memory localStorage + window/CustomEvent/fetch mock. supaImpl
// controls what supa.from('app_state').upsert(...) resolves/rejects to;
// fetchImpl controls the flushOnUnload() keepalive fetch's outcome.
function makeSync({ supaImpl, fetchImpl } = {}) {
  const store = {};
  // listAllKeys() iterates via localStorage.key(i) over localStorage.length --
  // real localStorage guarantees stable key-order iteration; this mock backs
  // it with a simple array to match that contract.
  const keyOrder = [];
  const localStorage = {
    key: (i) => keyOrder[i],
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { if (!(k in store)) keyOrder.push(k); store[k] = v; },
    removeItem: (k) => { const idx = keyOrder.indexOf(k); if (idx !== -1) keyOrder.splice(idx, 1); delete store[k]; },
  };
  Object.defineProperty(localStorage, 'length', { get: () => keyOrder.length });

  const events = [];
  class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
  }
  const listeners = {};
  const windowStub = {
    supabase: {
      createClient: () => ({
        auth: {
          getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }),
          onAuthStateChange: () => {},
        },
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
          upsert: () => (supaImpl ? supaImpl() : Promise.resolve({ error: null })),
        }),
        channel: () => ({ on: () => ({ subscribe: () => {} }) }),
      }),
    },
    dispatchEvent: (e) => { events.push(e); (listeners[e.type] || []).forEach((fn) => fn(e)); },
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    CustomEvent,
    __rowSyncRetry: undefined,
  };
  const sandbox = {
    window: windowStub,
    localStorage,
    fetch: fetchImpl || (() => Promise.resolve({ ok: true })),
    setTimeout,
    clearTimeout,
    CustomEvent, // sync.js references this as a bare global, not window.CustomEvent
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { window: windowStub, localStorage, events, statusEvents: () => events.filter((e) => e.type === 'row:sync-status') };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

async function run() {
  // --- pushNow success -> 'synced' status broadcast ---
  {
    const env = makeSync({ supaImpl: () => Promise.resolve({ error: null }) });
    env.window.initCloudSync({ appKey: 'test', syncedKeys: ['foo'] });
    // init()'s initial fetch resolves with no remote/local data -- 'synced' (nothing to do).
    await new Promise((r) => setTimeout(r, 150));
    const initial = env.statusEvents();
    assertEqual(initial.length > 0, true, 'init should have broadcast at least one status event');
    assertEqual(initial[initial.length - 1].detail.status, 'synced', 'init with nothing to sync broadcasts synced, not the default pending');

    env.localStorage.setItem('foo', JSON.stringify([{ id: 1 }]));
    await new Promise((r) => setTimeout(r, 400)); // past the 250ms push debounce
    const afterPush = env.statusEvents();
    assertEqual(afterPush[afterPush.length - 1].detail.status, 'synced', 'a successful push broadcasts synced');
  }

  // --- pushNow failure -> 'error' status, then automatic retry succeeds ---
  {
    let calls = 0;
    const env = makeSync({
      supaImpl: () => { calls++; return calls === 1 ? Promise.resolve({ error: { message: 'boom' } }) : Promise.resolve({ error: null }); },
    });
    env.window.initCloudSync({ appKey: 'test2', syncedKeys: ['bar'] });
    await new Promise((r) => setTimeout(r, 150));
    env.localStorage.setItem('bar', JSON.stringify([{ id: 1 }]));
    await new Promise((r) => setTimeout(r, 400));
    const afterFail = env.statusEvents();
    assertEqual(afterFail[afterFail.length - 1].detail.status, 'error', 'a failed push broadcasts error, not silently swallowed');

    // Force the retry immediately via the exposed hook instead of waiting
    // out the real backoff delay.
    env.window.__rowSyncRetry['test2']();
    await new Promise((r) => setTimeout(r, 150));
    const afterRetry = env.statusEvents();
    assertEqual(afterRetry[afterRetry.length - 1].detail.status, 'synced', 'forced retry after failure succeeds and broadcasts synced');
    assertEqual(calls, 2, 'upsert was called twice -- the failed attempt, then the retry');
  }

  // --- flushOnUnload never optimistically marks itself synced ---
  {
    let fetchCalls = 0;
    const env = makeSync({
      fetchImpl: () => { fetchCalls++; return Promise.resolve({ ok: false }); }, // simulates a failed keepalive request
    });
    env.window.initCloudSync({ appKey: 'test3', syncedKeys: ['baz'] });
    await new Promise((r) => setTimeout(r, 150));
    env.localStorage.setItem('baz', JSON.stringify([{ id: 1 }]));
    // Real browsers fire BOTH beforeunload and pagehide for one navigation --
    // the second attempt must not see the first as "already synced" and skip
    // itself, since the old code's optimistic lastSyncedJson update did
    // exactly that regardless of whether the fetch actually succeeded.
    for (const type of ['beforeunload', 'pagehide']) {
      env.window.dispatchEvent({ type }); // triggers both real listeners registered for that type
    }
    assertEqual(fetchCalls, 2, 'both beforeunload and pagehide genuinely attempted the flush, neither skipped believing the other already succeeded');
  }

  console.log('sync-status.test.js: all cases passed');
}

run();
