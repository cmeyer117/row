// row-auth.js is loaded in the browser as a classic (non-module) <script>
// tag, so it can't use `export` -- same vm-sandbox pattern as
// gym-state-merge-logic.test.js. Verifies the 2026-08-13 fix: getAccessToken()
// used to await supa.auth.getSession() with no bound, so a hung Supabase
// token-refresh call (weak signal) could stall well past any caller's own
// fetch timeout with no way to recover -- this is what produced "Could not
// reach Jarvis" even though Jarvis was never actually contacted.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./row-auth.js', import.meta.url), 'utf8');

function makeAuth(getSessionImpl) {
  const sandbox = {
    window: {
      supabase: { createClient: () => ({ auth: { getSession: getSessionImpl } }) },
    },
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.RowAuth;
}

const OWNER_SESSION = {
  data: { session: { user: { email: 'carl.meyer.business@gmail.com' }, access_token: 'tok123' } },
};

// Minimal DOM stub for ensure()'s offline-retry overlay -- captures the
// Retry button's click handler so the test can invoke it directly instead
// of needing a real DOM/click simulation.
function makeAuthWithDom(getSessionImpl) {
  let retryHandler = null;
  const btnStub = { addEventListener: (evt, fn) => { retryHandler = fn; } };
  const overlayStub = { style: {}, innerHTML: '', querySelector: () => btnStub, remove: () => {} };
  const sandbox = {
    window: { supabase: { createClient: () => ({ auth: { getSession: getSessionImpl, signOut: () => Promise.resolve() } }) } },
    document: { createElement: () => overlayStub, body: { appendChild: () => {} } },
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { RowAuth: sandbox.window.RowAuth, triggerRetry: () => retryHandler() };
}

const cases = [];

async function run() {
  {
    const auth = makeAuth(() => Promise.resolve(OWNER_SESSION));
    const token = await auth.getAccessToken();
    cases.push(['fast session resolves with the real token', token === 'tok123']);
  }

  {
    // Slow but genuinely successful -- well under the 6s bound, not instant.
    const auth = makeAuth(() => new Promise((resolve) => setTimeout(() => resolve(OWNER_SESSION), 200)));
    const token = await auth.getAccessToken();
    cases.push(['slow-but-under-timeout session still resolves with the real token', token === 'tok123']);
  }

  {
    // Simulates a hung Supabase token-refresh call under weak signal.
    const auth = makeAuth(() => new Promise(() => {}));
    const start = Date.now();
    const token = await auth.getAccessToken();
    const elapsed = Date.now() - start;
    cases.push(['hung getSession resolves to null instead of hanging forever', token === null]);
    cases.push(['hung getSession bounded near the 6s timeout, not indefinite', elapsed < 6500]);
  }

  {
    const auth = makeAuth(() => Promise.reject(new Error('network error')));
    const token = await auth.getAccessToken();
    cases.push(['rejected getSession resolves to null, not an unhandled rejection', token === null]);
  }

  // ensure() -- the 2026-08-20 fix. Previously called getSession() with no
  // bound at all (unlike getAccessToken() above, which already had this
  // exact timeout for the exact same reason) -- a hung call would block the
  // whole app shell indefinitely instead of surfacing an offline/retry state.
  {
    const { RowAuth } = makeAuthWithDom(() => Promise.resolve(OWNER_SESSION));
    const session = await RowAuth.ensure();
    cases.push(['ensure(): fast owner session resolves normally, unaffected by the timeout wrapper', session.user.email === 'carl.meyer.business@gmail.com']);
  }

  {
    let callCount = 0;
    const { RowAuth, triggerRetry } = makeAuthWithDom(() => {
      callCount++;
      // First call hangs forever (simulates a stalled token refresh);
      // the retried call succeeds.
      return callCount === 1 ? new Promise(() => {}) : Promise.resolve(OWNER_SESSION);
    });
    const start = Date.now();
    const ensurePromise = RowAuth.ensure();
    // Wait past the 10s bound for the first attempt to time out and show
    // the offline-retry overlay, then simulate clicking Retry.
    await new Promise((resolve) => setTimeout(resolve, 10200));
    const elapsed = Date.now() - start;
    triggerRetry();
    const session = await ensurePromise;
    cases.push(['ensure(): hung getSession times out near 10s instead of hanging forever', elapsed < 10800 && elapsed >= 10000]);
    cases.push(['ensure(): retry after timeout resolves with the real session once the connection recovers', session.user.email === 'carl.meyer.business@gmail.com']);
    cases.push(['ensure(): getSession was called twice -- once timed out, once via retry', callCount === 2]);
  }

  let failed = 0;
  for (const [label, ok] of cases) {
    if (!ok) { console.error('FAIL:', label); failed++; }
  }
  if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
  console.log(`row-auth getAccessToken timeout: all ${cases.length} cases pass`);
}

run();
