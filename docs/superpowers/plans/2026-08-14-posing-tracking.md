# Posing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a practice-session log to `posing.html` — date, poses practiced (free text), optional note — persisted to `posing:log` and synced via a new `initCloudSync()` call, per the approved design at `docs/superpowers/specs/2026-08-14-posing-tracking-design.md`.

**Architecture:** Four edits to one file (`posing.html`): a `sync.js` script tag (the page has none today), new CSS for the log card (this page has no existing form/list styling to reuse — different design system than `health.html`), the log card's HTML placed above the Competition/Content tabs, and a new self-contained `<script>` block with `getPosingLog`/`setPosingLog`/`renderPosingLog` plus the `initCloudSync()` call.

**Tech Stack:** Vanilla JS, no build step. No automated tests — matches this page's existing convention (it has zero JS logic files or tests today, purely inline).

---

### Task 1: Load `sync.js`

**Files:**
- Modify: `C:\Users\gregm\row\posing.html:15-17` (head scripts)

- [ ] **Step 1: Add the script tag**

In `posing.html`, change (currently lines 15-17):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="row-auth.js" defer></script>
<script src="topbar.js" defer></script>
```
to:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="row-auth.js" defer></script>
<script src="topbar.js" defer></script>
<script src="sync.js" defer></script>
```

- [ ] **Step 2: Commit**

```bash
git add posing.html
git commit -m "feat: load sync.js on posing.html (needed for the new practice log)"
```

---

### Task 2: Log card CSS + markup

**Files:**
- Modify: `C:\Users\gregm\row\posing.html:155-158` (CSS, after the `.mob-divider` rule)
- Modify: `C:\Users\gregm\row\posing.html:196-204` (HTML, between the header and the tabs)

- [ ] **Step 1: Add the CSS**

In `posing.html`, change (currently lines 155-158):

```css
/* ── Divider ── */
.mob-divider {
  height: 1px; background: var(--border); margin: 20px 0;
}
```
to:
```css
/* ── Divider ── */
.mob-divider {
  height: 1px; background: var(--border); margin: 20px 0;
}

/* ── Posing practice log ── */
.pose-log-card {
  background: rgba(255,255,255,0.025); border: 1px solid var(--border);
  border-radius: 16px; padding: 16px 18px; margin-bottom: 16px;
}
.pose-log-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.pose-log-input {
  flex: 1; min-width: 100px; padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--border);
  color: var(--text-1); font-size: 13px; font-family: inherit;
}
.pose-log-add-btn {
  padding: 8px 14px; border-radius: 8px; background: rgba(110,231,183,0.12);
  border: 1px solid rgba(110,231,183,0.3); color: var(--accent);
  font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
}
.pose-log-list { display: flex; flex-direction: column; gap: 6px; }
.pose-log-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 10px; background: rgba(255,255,255,0.02);
  border: 1px solid var(--border); border-radius: 8px;
  font-size: 12px; color: var(--text-2);
}
.pose-log-del { color: var(--text-3); cursor: pointer; padding: 0 4px; }
```

- [ ] **Step 2: Add the log card markup**

In `posing.html`, change (currently lines 196-204):

```html
<div class="mob-shell">
  <div class="mob-header">
    <div>
      <h1 class="mob-title">Posing</h1>
      <div class="mob-subtitle">Mandatory pose practice</div>
    </div>
  </div>

  <div class="mob-tabs">
```
to:
```html
<div class="mob-shell">
  <div class="mob-header">
    <div>
      <h1 class="mob-title">Posing</h1>
      <div class="mob-subtitle">Mandatory pose practice</div>
    </div>
  </div>

  <div class="pose-log-card">
    <div class="pose-log-row">
      <input id="poseLogDate" type="date" class="pose-log-input" />
      <input id="poseLogPoses" type="text" placeholder="Poses practiced" class="pose-log-input" />
      <input id="poseLogNote" type="text" placeholder="Note (optional)" class="pose-log-input" />
      <button id="poseLogAddBtn" class="pose-log-add-btn" type="button">+ Log</button>
    </div>
    <div id="poseLogList" class="pose-log-list"></div>
  </div>

  <div class="mob-tabs">
```

- [ ] **Step 3: Commit**

```bash
git add posing.html
git commit -m "feat: posing practice log card (CSS + markup, above the tabs)"
```

---

### Task 3: Log logic + cloud sync

**Files:**
- Modify: `C:\Users\gregm\row\posing.html:612-613` (new script block, before `</body>`)

- [ ] **Step 1: Add the log logic and sync wiring**

In `posing.html`, change (currently lines 612-613):

```html
</script>
</body>
```
to:
```html
</script>
<script>
(function () {
  'use strict';

  const _get = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const _set = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  function upsertByDate(list, date, fields) {
    const cleanFields = {};
    Object.keys(fields).forEach((k) => {
      if (fields[k] !== null && fields[k] !== undefined && fields[k] !== '') cleanFields[k] = fields[k];
    });
    if (Object.keys(cleanFields).length === 0) return list;
    const existing = list.find((e) => e.date === date);
    if (existing) {
      Object.assign(existing, cleanFields);
    } else {
      list.push(Object.assign({ date: date }, cleanFields));
    }
    return list;
  }

  function getPosingLog() { return _get('posing:log') || []; }
  function setPosingLog(list) { _set('posing:log', list); }

  function renderPosingLog() {
    const list = getPosingLog();
    const listEl = document.getElementById('poseLogList');
    listEl.innerHTML = list.slice().reverse().map((e) =>
      '<div class="pose-log-item"><span>' + e.date +
      ' — ' + (e.poses ?? '—') + (e.note ? ' · ' + e.note : '') +
      '</span><span class="pose-log-del" data-del-date="' + e.date + '">✕</span></div>'
    ).join('');
  }

  document.getElementById('poseLogAddBtn').addEventListener('click', () => {
    const date = document.getElementById('poseLogDate').value || new Date().toISOString().slice(0, 10);
    const fields = {
      poses: document.getElementById('poseLogPoses').value || null,
      note: document.getElementById('poseLogNote').value || null,
    };
    setPosingLog(upsertByDate(getPosingLog(), date, fields));
    document.getElementById('poseLogPoses').value = '';
    document.getElementById('poseLogNote').value = '';
    renderPosingLog();
  });

  document.getElementById('poseLogList').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del-date]');
    if (!del) return;
    setPosingLog(getPosingLog().filter((entry) => entry.date !== del.dataset.delDate));
    renderPosingLog();
  });

  renderPosingLog();

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof initCloudSync !== 'function') return;
    initCloudSync({
      appKey: 'posing',
      syncedKeys: ['posing:log'],
      onApplied: renderPosingLog,
    });
  });
})();
</script>
</body>
```

Note: this block defines its own `_get`/`_set`/`upsertByDate` rather than importing them from `health.html` — matching the design's explicit call that these pages don't share a module for helpers this small, same as `health.html` and `macros.html` each defining their own copies today. `initCloudSync` itself comes from the newly-loaded `sync.js` (Task 1); it's undefined until that script parses, hence the `typeof initCloudSync !== 'function'` guard, matching every other page's exact defensive pattern for this same call.

- [ ] **Step 2: Browser verification**

Open `posing.html`, sign in. Confirm the new log card renders above the Competition/Content tabs and stays visible when switching between them. Log an entry: today's date, poses "front double biceps, side chest", no note. Confirm it appears in the list as "today — front double biceps, side chest". Log a second entry on a different date with only a note filled in (no poses) — confirm it shows "— · <note text>". Delete one entry, confirm it's removed. Reload the page, confirm both remaining entries persist. If signed in with cloud sync active, confirm the entry appears under `app_state`'s `posing` key in Supabase (or on a second device/tab) after the sync round-trip.

- [ ] **Step 3: Commit**

```bash
git add posing.html
git commit -m "feat: posing practice log persistence + cloud sync"
```
