// Supabase Auth gate for the owner dashboard pages (coaching.html,
// coaching-plan.html). Blocks the page until the owner is signed in. The
// coaching tables are now owner-only at the DB layer, so an unauthenticated
// visitor gets nothing even if this overlay were bypassed — this is the UX.
(function () {
  'use strict';

  function markAuthed() { try { sessionStorage.setItem('row_auth', '1'); } catch (e) {} }

  function appendWhenReady(node) {
    if (document.body) { document.body.appendChild(node); }
    else { document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(node); }, { once: true }); }
  }

  function showLogin(supa) {
    return new Promise(function (resolve) {
      document.documentElement.style.visibility = 'hidden';
      var overlay = document.createElement('div');
      overlay.id = 'coaching-auth-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:#080808;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;';
      overlay.innerHTML =
        '<form id="ca-form" style="width:100%;max-width:340px;padding:36px 30px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:12px;">' +
        '<div style="color:#FAFAFA;font-size:18px;font-weight:700;">Coaching — sign in</div>' +
        '<input id="ca-email" type="email" placeholder="Email" autocomplete="username" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<input id="ca-pass" type="password" placeholder="Password" autocomplete="current-password" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;">' +
        '<div id="ca-error" style="color:#FF6B6B;font-size:12px;display:none;"></div>' +
        '<button type="submit" style="padding:12px;border-radius:12px;border:0;background:#FAFAFA;color:#0A0A0B;font-size:14px;font-weight:700;cursor:pointer;">Sign in</button>' +
        '</form>';
      appendWhenReady(overlay);
      document.documentElement.style.visibility = '';
      overlay.addEventListener('submit', async function (e) {
        e.preventDefault();
        var errEl = overlay.querySelector('#ca-error');
        var res = await supa.auth.signInWithPassword({
          email: overlay.querySelector('#ca-email').value.trim(),
          password: overlay.querySelector('#ca-pass').value,
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

  window.CoachingAuth = {
    // Resolves once the owner has a session. Call before loading any data.
    ensure: async function (supa) {
      var got = await supa.auth.getSession();
      if (got.data.session) { markAuthed(); return got.data.session; }
      return showLogin(supa);
    },
  };
})();
