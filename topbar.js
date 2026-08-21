// =============================================================
// Persistent dashboard top bar + bottom tab bar.
// Drop this on any page with:
//     <script src="topbar.js" defer></script>
// It self-injects HTML + CSS and renders the Main/Health/Fitness
// bottom tabs. Skips chrome inside iframes.
// =============================================================
(function () {
  'use strict';

  // -------- Auth gate — blocks page until real Supabase Auth session --------
  function authGate() {
    if (window.self !== window.top) return; // skip iframes
    document.documentElement.style.visibility = 'hidden';
    window.RowAuth.ensure().then(function () {
      document.documentElement.style.visibility = '';
    }).catch(function (err) {
      // Fail open rather than permanently blanking the page on a network
      // hiccup — matches the old gate's behavior of never leaving Carl
      // locked out by something other than a wrong credential.
      console.error('RowAuth.ensure() failed:', err);
      document.documentElement.style.visibility = '';
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
.topbar-mission-clock {
  font-family: 'JetBrains Mono', ui-monospace, SF Mono, Menlo, Consolas, monospace;
  font-size: 11px; color: rgba(244,241,234,0.6); white-space: nowrap;
}
.topbar-review-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px; text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.topbar-review-btn:hover { background: rgba(255, 255, 255, 0.08); }
.topbar-review-icon {
  font-size: 20px; line-height: 1;
  filter: grayscale(100%) brightness(1.4); opacity: 0.85;
}
.topbar-sync-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px; position: relative;
  -webkit-tap-highlight-color: transparent; cursor: pointer; padding: 0;
}
.topbar-sync-dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: #6EE7B7; transition: background 0.2s;
}
.topbar-sync-dot.pending { background: #F2C063; }
.topbar-sync-dot.error { background: #FF6B6B; animation: topbar-sync-pulse 1.2s ease-in-out infinite; }
@keyframes topbar-sync-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.topbar-sync-popover {
  display: none; position: absolute; top: 46px; right: 0; z-index: 50;
  min-width: 220px; max-width: 280px;
  background: #121214; border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px; padding: 10px; font-size: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.topbar-sync-popover.show { display: block; }
.topbar-sync-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 5px 0; color: rgba(255,255,255,0.85); }
.topbar-sync-row-key { font-weight: 600; text-transform: capitalize; }
.topbar-sync-row-time { color: rgba(255,255,255,0.5); font-size: 11px; }
.topbar-sync-retry {
  background: rgba(255,107,107,0.15); border: 1px solid rgba(255,107,107,0.4);
  color: #FF6B6B; border-radius: 6px; padding: 2px 8px; font-size: 11px;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
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
  .topbar-review-btn { width: 40px; height: 38px; }
  .topbar-review-icon { font-size: 18px; }
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
  <span class="topbar-mission-clock" id="topbarMissionClock"></span>
  <button type="button" class="topbar-sync-btn" id="topbarSync" aria-label="Sync status">
    <span class="topbar-sync-dot" id="topbarSyncDot"></span>
    <div class="topbar-sync-popover" id="topbarSyncPopover"></div>
  </button>
  <a href="weekly-review.html" class="topbar-review-btn" id="topbarReview" aria-label="Weekly Review">
    <span class="topbar-review-icon">🗓️</span>
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
    renderMissionClock();
    const bottomWrap = document.createElement('div');
    bottomWrap.innerHTML = bottombarHtml.trim();
    document.body.appendChild(bottomWrap.firstChild);
    const active = currentPageKey();
    document.querySelectorAll('.bottombar-tab').forEach((t) => {
      t.classList.toggle('active', t.getAttribute('data-page') === active);
    });
    document.body.classList.add('has-bottombar');
  }

  // Mission Clock (ideation pass item 5.2) -- countdown-only cut, mirrors
  // jarvis/ui/src/lib/mission-clock.ts. Carl's Pro Card target is "middle to
  // end of 2027" (his words), kept as a range, not a fake precise date.
  // ponytail: current phase is manually configured here too -- same gap as
  // the Jarvis-side lib, no live app_state read wired up yet.
  function renderMissionClock() {
    const el = document.getElementById('topbarMissionClock');
    if (!el) return;
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const minWeeks = Math.round((new Date('2027-06-01T00:00:00') - now) / MS_PER_WEEK);
    const maxWeeks = Math.round((new Date('2027-12-31T00:00:00') - now) / MS_PER_WEEK);
    const phase = 'growth';
    el.textContent = minWeeks + '–' + maxWeeks + 'wk to Pro (' + phase + ')';
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

  // -------- Sync status badge --------
  // A page can run multiple initCloudSync() instances (different appKeys,
  // e.g. gym.html's hype-audio/health pattern) -- tracks each independently
  // and shows the worst status across all of them. See
  // docs/superpowers/specs/2026-08-20-visible-sync-status-design.md.
  function relTime(iso) {
    if (!iso) return 'never';
    const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (secs < 60) return 'just now';
    if (secs < 3600) return Math.round(secs / 60) + 'm ago';
    if (secs < 86400) return Math.round(secs / 3600) + 'h ago';
    return Math.round(secs / 86400) + 'd ago';
  }
  function initSyncBadge() {
    const btn = document.getElementById('topbarSync');
    const dot = document.getElementById('topbarSyncDot');
    const popover = document.getElementById('topbarSyncPopover');
    if (!btn || !dot || !popover) return;
    const state = {}; // appKey -> { status, lastSyncedAt }

    function worstStatus() {
      const statuses = Object.values(state).map((s) => s.status);
      if (statuses.some((s) => s === 'error')) return 'error';
      if (statuses.some((s) => s === 'pending')) return 'pending';
      return 'synced';
    }
    function render() {
      dot.className = 'topbar-sync-dot' + (worstStatus() !== 'synced' ? ' ' + worstStatus() : '');
      popover.innerHTML = Object.keys(state).length
        ? Object.keys(state).sort().map((key) => {
            const s = state[key];
            const retryBtn = s.status === 'error' ? `<button type="button" class="topbar-sync-retry" data-retry-key="${key}">Retry</button>` : '';
            return `<div class="topbar-sync-row"><span class="topbar-sync-row-key">${key}</span><span class="topbar-sync-row-time">${s.status === 'error' ? retryBtn : relTime(s.lastSyncedAt)}</span></div>`;
          }).join('')
        : '<div class="topbar-sync-row">No sync activity yet</div>';
    }
    window.addEventListener('row:sync-status', function (e) {
      const d = e.detail;
      if (!d || !d.appKey) return;
      state[d.appKey] = { status: d.status, lastSyncedAt: d.lastSyncedAt };
      render();
    });
    btn.addEventListener('click', function (e) {
      const retryKey = e.target && e.target.getAttribute && e.target.getAttribute('data-retry-key');
      if (retryKey) {
        e.stopPropagation();
        try { window.__rowSyncRetry && window.__rowSyncRetry[retryKey] && window.__rowSyncRetry[retryKey](); } catch (err) {}
        return;
      }
      popover.classList.toggle('show');
    });
    document.addEventListener('click', function (e) {
      if (!btn.contains(e.target)) popover.classList.remove('show');
    });
  }

  function boot() {
    injectStyleAndHTML();
    lockGestures();
    startModalLock();
    initSyncBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
