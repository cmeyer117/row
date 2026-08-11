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

  function markAuthed() { try { sessionStorage.setItem(AUTH_KEY, '1'); } catch (e) {} }

  function appendWhenReady(node) {
    if (document.body) { document.body.appendChild(node); }
    else { document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(node); }, { once: true }); }
  }

  function showLogin(supa) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.id = 'row-auth-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:#080808;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;';
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
        markAuthed();
        overlay.remove();
        resolve(res.data.session);
      });
    });
  }

  window.RowAuth = {
    // Resolves once the owner has a real Supabase Auth session. Caller is
    // responsible for hiding page content until this resolves.
    ensure: async function () {
      if (!window.supabase) throw new Error('RowAuth.ensure() called before the Supabase CDN script loaded');
      var supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      var got = await supa.auth.getSession();
      if (got.data.session) { markAuthed(); return got.data.session; }
      return showLogin(supa);
    },
  };
})();
