// Real Supabase Auth gate for every Row page — replaces the old shared
// client-side passphrase (topbar.js's AUTH_PASS). Blocks the page until the
// owner has a real session. Once that session exists, it's persisted by the
// Supabase JS client in localStorage (keyed to this project's URL) and
// automatically picked up by every OTHER client instance the app creates
// (sync.js's internal client, gym.html's/macros.html's own inline clients,
// etc.) — no shared client object needed, no changes required to any of
// those files.
(function () {
  'use strict';
  const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
  const AUTH_KEY = 'row_auth';
  // Matches coaching_is_owner()'s check server-side -- this client-side
  // check is defense-in-depth (RLS is the real boundary), but the gate's
  // whole point is to represent "signed in as the owner," not just "signed
  // in as anyone," so it has to actually check who, not just whether.
  const OWNER_EMAIL = 'carl.meyer.business@gmail.com';

  function isOwner(session) {
    return !!(session && session.user && session.user.email === OWNER_EMAIL);
  }

  function markAuthed() { try { sessionStorage.setItem(AUTH_KEY, '1'); } catch (e) {} }

  // getSession() isn't the cheap localStorage read it looks like -- when the
  // cached token is expired or near expiry, it makes a real network call to
  // refresh it. Under weak signal that call can hang well past any caller's
  // own timeout, since callers only ever wrap their *fetch* in an
  // AbortController, not this. Bound it here once, at the source, instead of
  // in every caller (2026-08-13: root cause of "Could not reach Jarvis" on
  // gym.html's debrief -- the request never even left the browser, Vercel
  // logs showed zero invocations).
  function withTimeout(promise, ms, fallback) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; resolve(fallback); }
      }, ms);
      promise.then(function (v) {
        if (!settled) { settled = true; clearTimeout(timer); resolve(v); }
      }, function () {
        if (!settled) { settled = true; clearTimeout(timer); resolve(fallback); }
      });
    });
  }

  function appendWhenReady(node) {
    if (document.body) { document.body.appendChild(node); }
    else { document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(node); }, { once: true }); }
  }

  function showLogin(supa) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.id = 'row-auth-overlay';
      // visibility:visible overrides the inherited hidden state that
      // topbar.js's authGate() sets on documentElement while waiting for
      // this promise to resolve -- without it, the login form itself would
      // be invisible (visibility is an inherited CSS property). Caught via
      // a real live check, not assumed correct from reading the code.
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:#080808;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;visibility:visible;';
      overlay.innerHTML =
        '<form id="ra-form" style="width:100%;max-width:340px;padding:36px 30px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:12px;">' +
        '<div style="color:#FAFAFA;font-size:18px;font-weight:700;">Carl&#39;s Dashboard &mdash; sign in</div>' +
        '<input id="ra-email" type="email" placeholder="Email" autocomplete="username" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<input id="ra-pass" type="password" placeholder="Password" autocomplete="current-password" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<div id="ra-error" style="color:#FF6B6B;font-size:12px;display:none;"></div>' +
        '<button type="submit" style="padding:12px;border-radius:12px;border:0;background:#FAFAFA;color:#0A0A0B;font-size:14px;font-weight:700;cursor:pointer;">Sign in</button>' +
        '</form>';
      appendWhenReady(overlay);
      overlay.addEventListener('submit', async function (e) {
        e.preventDefault();
        var errEl = overlay.querySelector('#ra-error');
        var res = await supa.auth.signInWithPassword({
          email: overlay.querySelector('#ra-email').value.trim(),
          password: overlay.querySelector('#ra-pass').value,
        });
        if (res.error || !res.data.session) {
          errEl.textContent = res.error ? res.error.message : 'Sign-in failed';
          errEl.style.display = 'block';
          return;
        }
        if (!isOwner(res.data.session)) {
          await supa.auth.signOut();
          errEl.textContent = 'This account is not authorized.';
          errEl.style.display = 'block';
          return;
        }
        markAuthed();
        overlay.remove();
        resolve(res.data.session);
      });
    });
  }

  // Memoized so concurrent callers (topbar.js's own page-wide authGate()
  // plus any page's own explicit RowAuth.ensure() call, e.g. gym.html/
  // macros.html) share one in-flight/resolved result instead of each
  // independently calling showLogin() and rendering its own overlay --
  // found live 2026-08-15 on macros.html (two stacked login forms).
  // Cleared on rejection, not just left unresolved forever, so a transient
  // failure (e.g. Supabase CDN script not yet loaded) can be retried by a
  // later call rather than permanently wedging every future ensure() call
  // -- same "permanently-cached auth failure" class already fixed once for
  // Vessel's equivalent gate.
  var _ensurePromise = null;

  window.RowAuth = {
    // Resolves once the owner has a real Supabase Auth session. Caller is
    // responsible for hiding page content until this resolves.
    ensure: function () {
      if (_ensurePromise) return _ensurePromise;
      _ensurePromise = (async function () {
        if (!window.supabase) throw new Error('RowAuth.ensure() called before the Supabase CDN script loaded');
        var supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        var got = await supa.auth.getSession();
        if (got.data.session && isOwner(got.data.session)) { markAuthed(); return got.data.session; }
        if (got.data.session) await supa.auth.signOut();
        return showLogin(supa);
      })().catch(function (err) {
        _ensurePromise = null;
        throw err;
      });
      return _ensurePromise;
    },
    // Real session token for server-side verifyOwner() checks (paid-API
    // proxies, etc.) -- replaces the old client-visible ROW_APP_SECRET
    // shared-secret pattern, which anyone reading the page source could
    // read and reuse to burn paid API calls (2026-08-12 audit finding).
    // getSession() reads Supabase JS's own in-memory/localStorage cache, no
    // network round trip on the common case. Returns null if the page
    // somehow reaches this before authGate() resolved -- callers should
    // treat that as "not authenticated" (server rejects with 401 either way).
    getAccessToken: async function () {
      if (!window.supabase) return null;
      var supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      var got = await withTimeout(supa.auth.getSession(), 6000, null);
      if (!got) return null;
      return (got.data.session && isOwner(got.data.session)) ? got.data.session.access_token : null;
    },
  };
})();
