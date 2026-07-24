// =============================================================
// Persistent dashboard top bar + bottom tab bar.
// Drop this on any page with:
//     <script src="topbar.js" defer></script>
// It self-injects HTML + CSS and renders the Main/Health/Fitness
// bottom tabs. Skips chrome on finance.html and inside iframes.
// =============================================================
(function () {
  'use strict';

  // -------- Auth gate — blocks page until correct passphrase entered --------
  const AUTH_PASS = '007007';
  const AUTH_KEY  = 'row_auth';

  function authGate() {
    if (window.self !== window.top) return; // skip iframes
    // coaching.html/coaching-plan.html have real Supabase Auth login (coaching-auth.js)
    // enforced at the DB layer since the 2026-07-24 RLS lockdown — this passphrase is
    // redundant there now, not a security control on those two pages anymore.
    var path = (window.location.pathname || '').toLowerCase();
    if (path.endsWith('coaching.html') || path.endsWith('coaching-plan.html')) return;
    if (sessionStorage.getItem(AUTH_KEY) === '1') return; // already authed this session

    // Hide page content immediately
    document.documentElement.style.visibility = 'hidden';

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:99999',
      'display:flex;align-items:center;justify-content:center',
      'background:#080808',
      'font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif',
    ].join(';');

    overlay.innerHTML = `
      <div style="width:100%;max-width:340px;padding:40px 32px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);display:flex;flex-direction:column;align-items:center;gap:20px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:22px;">🔒</div>
        <div style="text-align:center;">
          <div style="color:#FAFAFA;font-size:18px;font-weight:700;margin-bottom:4px;">Carl's Dashboard</div>
          <div style="color:rgba(255,255,255,0.35);font-size:13px;">Enter passphrase to continue</div>
        </div>
        <form id="auth-form" style="width:100%;display:flex;flex-direction:column;gap:10px;">
          <input id="auth-input" type="password" placeholder="Passphrase" autocomplete="current-password"
            style="width:100%;box-sizing:border-box;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:#FAFAFA;font-size:14px;outline:none;font-family:inherit;" />
          <div id="auth-error" style="color:#FF6B6B;font-size:12px;text-align:center;display:none;">Incorrect passphrase — try again</div>
          <button type="submit"
            style="width:100%;padding:12px;border-radius:12px;border:0;background:#FAFAFA;color:#0A0A0B;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">
            Unlock
          </button>
        </form>
      </div>`;

    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(overlay);
      document.documentElement.style.visibility = '';
      const input = document.getElementById('auth-input');
      const error = document.getElementById('auth-error');
      if (input) input.focus();
      document.getElementById('auth-form').addEventListener('submit', function (e) {
        e.preventDefault();
        if (input.value === AUTH_PASS) {
          sessionStorage.setItem(AUTH_KEY, '1');
          overlay.remove();
        } else {
          error.style.display = 'block';
          input.value = '';
          input.focus();
        }
      });
    });
  }

  authGate();

  // -------- Service worker --------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // -------- CSS --------
  const css = `
.topbar {
  position: sticky; top: 0; z-index: 40;
  display: flex; justify-content: flex-end; align-items: center;
  gap: 8px;
  padding: max(10px, env(safe-area-inset-top)) 14px 8px;
  background: #0a0a0b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
}
.topbar-home-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  border: 1px solid rgba(110, 231, 183, 0.18);
  background: rgba(110, 231, 183, 0.07);
  border-radius: 10px; text-decoration: none; margin-right: auto;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, border-color 0.15s;
}
.topbar-home-btn:hover { background: rgba(110, 231, 183, 0.14); border-color: rgba(110, 231, 183, 0.32); }
.topbar-home-icon { font-size: 17px; line-height: 1; }
.topbar-finance-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px; text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.topbar-finance-btn:hover { background: rgba(255, 255, 255, 0.08); }
.topbar-finance-icon {
  font-size: 20px; line-height: 1;
  filter: grayscale(100%) brightness(1.4); opacity: 0.85;
}
.topbar-coaching-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px; text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.topbar-coaching-btn:hover { background: rgba(255, 255, 255, 0.08); }
.topbar-coaching-icon {
  font-size: 20px; line-height: 1;
  filter: grayscale(100%) brightness(1.4); opacity: 0.85;
}
.bottombar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  display: flex; justify-content: space-around; align-items: stretch;
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
  background: #0a0a0b;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
}
.bottombar-tab {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; padding: 6px 0 4px; text-decoration: none;
  color: rgba(255, 255, 255, 0.45);
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
  -webkit-tap-highlight-color: transparent; transition: color 0.15s;
}
.bottombar-tab-icon {
  font-size: 24px; line-height: 1;
  filter: grayscale(100%) brightness(1.2); opacity: 0.55;
  transition: opacity 0.15s, filter 0.15s, transform 0.10s;
}
.bottombar-tab.active { color: #6EE7B7; }
.bottombar-tab.active .bottombar-tab-icon {
  filter: grayscale(0%) brightness(1.2); opacity: 1;
}
.bottombar-tab:active .bottombar-tab-icon { transform: scale(0.92); }
body.has-bottombar {
  padding-bottom: calc(72px + env(safe-area-inset-bottom)) !important;
}
@media (max-width: 480px) {
  .topbar { padding-left: 10px; padding-right: 10px; gap: 6px; }
  .topbar-finance-btn { width: 40px; height: 38px; }
  .topbar-finance-icon { font-size: 18px; }
  .topbar-coaching-btn { width: 40px; height: 38px; }
  .topbar-coaching-icon { font-size: 18px; }
  .bottombar-tab-icon { font-size: 22px; }
  .bottombar-tab { font-size: 10px; }
}
html, body { -webkit-text-size-adjust: 100%; }
@media (max-width: 768px) {
  html { touch-action: pan-y; }
  ::-webkit-scrollbar { width: 0; height: 0; display: none; }
  html, body { scrollbar-width: none; -ms-overflow-style: none; }
}
.modal-bg, .modal, .po-modal-bg, .po-modal, .wt-overlay, .wt-viewer {
  overscroll-behavior: contain;
}
body.topbar-modal-open { overflow: hidden; touch-action: none; }
@media (max-width: 480px) {
  .modal-bg, .po-modal-bg {
    padding: 0 !important;
    align-items: stretch !important;
    justify-content: stretch !important;
  }
  .modal, .po-modal {
    width: 100% !important; max-width: 100% !important;
    max-height: 100vh !important; height: 100vh !important;
    border-radius: 0 !important;
    padding-top: max(20px, env(safe-area-inset-top)) !important;
    padding-bottom: max(28px, env(safe-area-inset-bottom)) !important;
    overflow-y: auto !important; overscroll-behavior: contain;
  }
}
`;

  const topbarHtml = `
<header class="topbar" id="topbar" role="navigation" aria-label="Quick actions">
  <a href="index.html" class="topbar-home-btn" aria-label="Dashboard hub">
    <span class="topbar-home-icon">⌂</span>
  </a>
  <a href="finance.html" class="topbar-finance-btn" id="topbarFinance" aria-label="Finance">
    <span class="topbar-finance-icon">📊</span>
  </a>
  <a href="coaching.html" class="topbar-coaching-btn" id="topbarCoaching" aria-label="Coaching">
    <span class="topbar-coaching-icon">🏋️</span>
  </a>
</header>`;

  const bottombarHtml = `
<nav class="bottombar" id="bottombar" role="navigation" aria-label="Main tabs">
  <a href="main.html" class="bottombar-tab" data-page="main">
    <span class="bottombar-tab-icon">🎯</span><span>Goals</span>
  </a>
  <a href="health.html" class="bottombar-tab" data-page="health">
    <span class="bottombar-tab-icon">💊</span><span>Health</span>
  </a>
  <a href="gym.html" class="bottombar-tab" data-page="fitness">
    <span class="bottombar-tab-icon">💪</span><span>Fitness</span>
  </a>
</nav>`;

  function isEmbedded() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  function shouldShowChrome() {
    if (isEmbedded()) return false;
    const p = (window.location.pathname || '').toLowerCase();
    if (p.endsWith('index.html') || p === '/' || p.endsWith('/row/')) return false;
    return true;
  }
  function currentPageKey() {
    const p = (window.location.pathname || '').toLowerCase();
    if (p.endsWith('health.html') || p.endsWith('/health')) return 'health';
    if (p.endsWith('gym.html') || p.endsWith('/gym') || p.endsWith('mobility.html') || p.endsWith('/mobility')) return 'fitness';
    if (p.endsWith('main.html') || p.endsWith('/main')) return 'main';
    if (p.endsWith('finance.html')) return '';
    if (p.endsWith('index.html') || p === '/' || p.endsWith('/row/')) return '';
    return 'main';
  }

  function injectStyleAndHTML() {
    if (document.getElementById('topbar') || document.getElementById('bottombar')) return;
    if (!shouldShowChrome()) return;
    const style = document.createElement('style');
    style.id = 'topbar-style';
    style.textContent = css;
    document.head.appendChild(style);
    const topWrap = document.createElement('div');
    topWrap.innerHTML = topbarHtml.trim();
    document.body.insertBefore(topWrap.firstChild, document.body.firstChild);
    const bottomWrap = document.createElement('div');
    bottomWrap.innerHTML = bottombarHtml.trim();
    document.body.appendChild(bottomWrap.firstChild);
    const active = currentPageKey();
    document.querySelectorAll('.bottombar-tab').forEach((t) => {
      t.classList.toggle('active', t.getAttribute('data-page') === active);
    });
    document.body.classList.add('has-bottombar');
  }

  function blockGesture(e) { e.preventDefault(); }
  function lockGestures() {
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('gestureend', blockGesture, { passive: false });
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }
  function startModalLock() {
    const MODAL_SELECTORS = ['.modal-bg', '.po-modal-bg', '.wt-overlay', '.wt-viewer', '.wt-cam'];
    function anyOpen() {
      for (const sel of MODAL_SELECTORS) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.classList.contains('show') || el.classList.contains('is-open')) return true;
        }
      }
      return false;
    }
    function sync() { document.body.classList.toggle('topbar-modal-open', anyOpen()); }
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    sync();
  }

  function boot() {
    injectStyleAndHTML();
    lockGestures();
    startModalLock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
