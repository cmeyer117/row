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

  let failed = 0;
  for (const [label, ok] of cases) {
    if (!ok) { console.error('FAIL:', label); failed++; }
  }
  if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
  console.log(`row-auth getAccessToken timeout: all ${cases.length} cases pass`);
}

run();
