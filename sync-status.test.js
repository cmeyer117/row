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
function makeSync({ supaImpl, fetchImpl, initialRemoteData } = {}) {
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
    SUPABASE_CONFIG: { URL: 'https://example.supabase.co', KEY: 'test-key' },
    supabase: {
      createClient: () => ({
        auth: {
          getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }),
          onAuthStateChange: () => {},
        },
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: initialRemoteData ? { data: initialRemoteData } : null, error: null }) }) }),
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

  // --- applyRemote()'s new unconditional schedulePush() (added so a
  // genuine merge round-trips back to Supabase) must not leave the badge
  // stuck on 'pending' for the common case where nothing actually needed
  // pushing (a plain remote pull with no local divergence). Self-review
  // catch, 2026-08-20: schedulePush() sets 'pending', but pushNow() used
  // to return silently (no status update) whenever it found nothing new
  // to send, so the badge never recovered to 'synced'. ---
  {
    const env = makeSync({
      initialRemoteData: { foo: [{ id: 1, updated_at: 5 }] }, // local starts empty, so applying this IS a "change"
      supaImpl: () => Promise.resolve({ error: null }),
    });
    env.window.initCloudSync({ appKey: 'test5', syncedKeys: ['foo'] });
    await new Promise((r) => setTimeout(r, 500)); // past init's applyRemote + the resulting schedulePush's 250ms debounce
    const events = env.statusEvents();
    assertEqual(events[events.length - 1].detail.status, 'synced', 'a plain remote pull with nothing left to push settles back to synced, not stuck on pending');
  }

  // --- local-wins merge (mergeObjects() keeps the local value because it's
  // newer) still pushes back, even though it writes nothing to localStorage
  // -- Codex layered review catch, 2026-08-20: the original fix only
  // scheduled a push when the merge ALSO happened to change local storage,
  // missing exactly the case where local already had the winning value and
  // just needed to reach Supabase. ---
  {
    let upsertCalls = 0;
    const env = makeSync({
      initialRemoteData: { settings: { phase: 'old', updated_at: '2026-01-01T00:00:00Z' } },
      supaImpl: () => { upsertCalls++; return Promise.resolve({ error: null }); },
    });
    // Pre-seed local with a NEWER version of the same key, before
    // initCloudSync wraps localStorage.setItem -- the merge should keep
    // this local value outright (nothing to write), but it still differs
    // from the raw remote payload above and must still push back.
    env.localStorage.setItem('settings', JSON.stringify({ phase: 'new', updated_at: '2026-01-02T00:00:00Z' }));
    env.window.initCloudSync({ appKey: 'test6', syncedKeys: ['settings'], mergeableObjectKeys: ['settings'] });
    await new Promise((r) => setTimeout(r, 500)); // past init's applyRemote + the resulting schedulePush's 250ms debounce
    assertEqual(upsertCalls >= 1, true, 'a local-wins merge still triggered a real push to Supabase, not silently skipped');
    assertEqual(JSON.parse(env.localStorage.getItem('settings')).phase, 'new', 'local value (the merge winner) is preserved, not overwritten by the older remote copy');
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

  // --- concurrent pushNow() invocations are serialized, never run at once ---
  // (Codex layered review catch, 2026-08-20: the debounce timer and a
  // pending backoff retry could both call pushNow() concurrently, and a
  // fresh success finishing before an already-in-flight retry finishing
  // as a failure could leave a false red badge indefinitely with no way
  // to recover, since the corrective rerun would see lastSyncedJson
  // already matching and skip itself.)
  {
    let activeCount = 0, maxActive = 0, upsertCalls = 0;
    const env = makeSync({
      supaImpl: () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        upsertCalls++;
        return new Promise((resolve) => setTimeout(() => { activeCount--; resolve({ error: null }); }, 400));
      },
    });
    env.window.initCloudSync({ appKey: 'test4', syncedKeys: ['qux'] });
    await new Promise((r) => setTimeout(r, 150));
    env.localStorage.setItem('qux', JSON.stringify([{ id: 1 }]));
    // Fires an immediate pushNow() via the retry hook right after the edit,
    // well before the 250ms debounce timer would fire on its own -- while
    // that first call's slow (400ms) upsert is still in flight, the
    // debounce timer's own pushNow() call arrives too.
    env.window.__rowSyncRetry['test4']();
    await new Promise((r) => setTimeout(r, 600)); // past both the 250ms debounce and the 400ms upsert delay
    assertEqual(maxActive, 1, 'pushNow() invocations never ran concurrently -- max 1 upsert in flight at a time');
    assertEqual(upsertCalls >= 1, true, 'at least one upsert actually happened');
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
