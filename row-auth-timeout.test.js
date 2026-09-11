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
      SUPABASE_CONFIG: { URL: 'https://example.supabase.co', KEY: 'test-key' },
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

// Minimal DOM stub for ensure()'s offline-retry overlay -- captures BOTH
// buttons' click handlers, keyed by selector (a real querySelector) so the
// test can invoke either directly instead of needing a real DOM/click
// simulation. Was a single shared stub before the "Continue offline" button
// existed -- with two buttons, a shared stub would have let the second
// addEventListener call silently clobber the first's handler.
function makeAuthWithDom(getSessionImpl) {
  const handlers = {};
  const overlayStub = {
    style: {}, innerHTML: '',
    querySelector: (sel) => ({ addEventListener: (evt, fn) => { handlers[sel] = fn; } }),
    remove: () => {},
  };
  const sandbox = {
    window: {
      supabase: { createClient: () => ({ auth: { getSession: getSessionImpl, signOut: () => Promise.resolve() } }) },
      SUPABASE_CONFIG: { URL: 'https://example.supabase.co', KEY: 'test-key' },
    },
    document: { createElement: () => overlayStub, body: { appendChild: () => {} } },
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return {
    RowAuth: sandbox.window.RowAuth,
    triggerRetry: () => handlers['#ra-offline-retry'](),
    triggerContinueOffline: () => handlers['#ra-offline-continue'](),
  };
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

  // ensure() -- a retry that itself fails must reject, not leave the
  // promise (and _ensurePromise) permanently pending (Codex layered
  // review catch, 2026-08-20). Reuses the one 10s hang from the case
  // above's timeout instead of waiting through a second one: call 1 hangs
  // (forces the offline-retry overlay), call 2 (the retry) rejects, call 3
  // (a fresh ensure() after the rejection) succeeds immediately.
  {
    let callCount = 0;
    const { RowAuth, triggerRetry } = makeAuthWithDom(() => {
      callCount++;
      if (callCount === 1) return new Promise(() => {});
      if (callCount === 2) return Promise.reject(new Error('retry failed too'));
      return Promise.resolve(OWNER_SESSION);
    });
    const ensurePromise = RowAuth.ensure();
    await new Promise((resolve) => setTimeout(resolve, 10200));
    triggerRetry();
    let rejected = false;
    try { await ensurePromise; } catch (e) { rejected = true; }
    cases.push(['ensure(): a retry that itself fails rejects instead of hanging forever', rejected]);

    // _ensurePromise must have cleared -- a fresh ensure() call after the
    // rejection should try again (call 3), not return the same stuck promise.
    const session = await RowAuth.ensure();
    cases.push(['ensure(): a new call after a rejected retry tries again and can still succeed', session.user.email === 'carl.meyer.business@gmail.com']);
    cases.push(['ensure(): getSession called exactly 3 times -- hang, failed retry, fresh success', callCount === 3]);
  }

  // Offline-first sync (2026-09-11 idea ledger item): "Continue offline"
  // resolves ensure() with null -- never a fake session -- letting the page
  // become visible for local-only logging without pretending auth
  // succeeded. Real callers either ignore ensure()'s resolved value (just
  // await it as a gate) or separately call getAccessToken(), which already
  // degrades to null offline on its own independent bound.
  {
    const { RowAuth, triggerContinueOffline } = makeAuthWithDom(() => new Promise(() => {})); // permanently hung
    const ensurePromise = RowAuth.ensure();
    await new Promise((resolve) => setTimeout(resolve, 10200)); // past the 10s bound
    triggerContinueOffline();
    const session = await ensurePromise;
    cases.push(['ensure(): Continue offline resolves with null, not a fake session', session === null]);
  }

  // luna Codex catch: a null (offline-continue) resolution must clear
  // _ensurePromise too, same as a rejection already does -- otherwise every
  // later ensure() call for the rest of the page's lifetime keeps returning
  // that same cached null, even once connectivity genuinely returns.
  {
    let callCount = 0;
    const { RowAuth, triggerContinueOffline } = makeAuthWithDom(() => {
      callCount++;
      // First call hangs (forces the offline-retry overlay); a LATER,
      // separate ensure() call (simulating connectivity having returned)
      // succeeds immediately.
      return callCount === 1 ? new Promise(() => {}) : Promise.resolve(OWNER_SESSION);
    });
    const firstEnsure = RowAuth.ensure();
    await new Promise((resolve) => setTimeout(resolve, 10200));
    triggerContinueOffline();
    const firstResult = await firstEnsure;
    cases.push(['ensure(): first call resolves null after Continue offline', firstResult === null]);

    const secondResult = await RowAuth.ensure();
    cases.push(['ensure(): a later call after Continue offline re-attempts real auth instead of returning the same cached null', secondResult !== null && secondResult.user.email === 'carl.meyer.business@gmail.com']);
    cases.push(['ensure(): getSession called exactly twice -- the hang, then a fresh real attempt', callCount === 2]);
  }

  let failed = 0;
  for (const [label, ok] of cases) {
    if (!ok) { console.error('FAIL:', label); failed++; }
  }
  if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
  console.log(`row-auth getAccessToken timeout: all ${cases.length} cases pass`);
}

run();
