# Cardio Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6th "Cardio" tab to `health.html`, logging `{ date, type, durationMin, intensity }` entries, mirroring the existing Sleep tab's shape exactly — per the approved design at `docs/superpowers/specs/2026-08-14-cardio-tracking-design.md`.

**Architecture:** One file (`health.html`), four edits: a new tab button, a new view `<div>`, new `getCardio`/`setCardio`/`renderCardio` functions plus their form/list/chart event wiring, and two one-line additions (the tab-switch array, the sync key list). No new pure-logic module — this mirrors an existing UI pattern exactly, same as every other tab on this page.

**Tech Stack:** Vanilla JS, no build step. No automated tests — matches this page's existing convention (no dedicated test file for any of its 5 existing tabs either); verified by browser only.

---

### Task 1: Tab button and view markup

**Files:**
- Modify: `C:\Users\gregm\row\health.html:745-751` (tab buttons)
- Modify: `C:\Users\gregm\row\health.html:825-841` (view divs)

- [ ] **Step 1: Add the tab button**

In `health.html`, change (currently lines 745-751):

```html
    <div class="hm-tabs" id="hmTabs">
      <button class="hm-tab-btn hm-tab-active" data-hm-tab="vitals">Vitals</button>
      <button class="hm-tab-btn" data-hm-tab="labs">Labs</button>
      <button class="hm-tab-btn" data-hm-tab="measurements">Measurements</button>
      <button class="hm-tab-btn" data-hm-tab="sleep">Sleep</button>
      <button class="hm-tab-btn" data-hm-tab="recomp">Recomp</button>
    </div>
```
to:
```html
    <div class="hm-tabs" id="hmTabs">
      <button class="hm-tab-btn hm-tab-active" data-hm-tab="vitals">Vitals</button>
      <button class="hm-tab-btn" data-hm-tab="labs">Labs</button>
      <button class="hm-tab-btn" data-hm-tab="measurements">Measurements</button>
      <button class="hm-tab-btn" data-hm-tab="sleep">Sleep</button>
      <button class="hm-tab-btn" data-hm-tab="cardio">Cardio</button>
      <button class="hm-tab-btn" data-hm-tab="recomp">Recomp</button>
    </div>
```

- [ ] **Step 2: Add the view div**

In `health.html`, change (currently lines 825-841, the sleep view's closing tag through the recomp view's opening):

```html
    <div id="hmView-sleep" class="hm-view" hidden>
      <div class="hm-form-row">
        <input id="hmSleepDate" type="date" class="stack-input" />
        <input id="hmSleepHours" type="number" step="0.1" placeholder="Hours" class="stack-input" />
        <input id="hmSleepQuality" type="number" step="1" min="1" max="5" placeholder="Quality (1-5)" class="stack-input" />
        <button id="hmSleepAddBtn" class="stack-add-btn">+ Log</button>
      </div>
      <div class="hm-chart-wrap">
        <select id="hmSleepMetric" class="stack-input stack-select">
          <option value="hours">Hours</option>
          <option value="quality">Quality</option>
        </select>
        <div id="hmSleepChart" class="hm-chart"></div>
      </div>
      <div id="hmSleepList" class="hm-list"></div>
    </div>

    <div id="hmView-recomp" class="hm-view" hidden>
```
to:
```html
    <div id="hmView-sleep" class="hm-view" hidden>
      <div class="hm-form-row">
        <input id="hmSleepDate" type="date" class="stack-input" />
        <input id="hmSleepHours" type="number" step="0.1" placeholder="Hours" class="stack-input" />
        <input id="hmSleepQuality" type="number" step="1" min="1" max="5" placeholder="Quality (1-5)" class="stack-input" />
        <button id="hmSleepAddBtn" class="stack-add-btn">+ Log</button>
      </div>
      <div class="hm-chart-wrap">
        <select id="hmSleepMetric" class="stack-input stack-select">
          <option value="hours">Hours</option>
          <option value="quality">Quality</option>
        </select>
        <div id="hmSleepChart" class="hm-chart"></div>
      </div>
      <div id="hmSleepList" class="hm-list"></div>
    </div>

    <div id="hmView-cardio" class="hm-view" hidden>
      <div class="hm-form-row">
        <input id="hmCardioDate" type="date" class="stack-input" />
        <input id="hmCardioType" type="text" placeholder="Type (e.g. Incline Walk)" class="stack-input" />
        <input id="hmCardioDuration" type="number" step="1" placeholder="Minutes" class="stack-input" />
        <input id="hmCardioIntensity" type="number" step="1" min="1" max="10" placeholder="Intensity (1-10)" class="stack-input" />
        <button id="hmCardioAddBtn" class="stack-add-btn">+ Log</button>
      </div>
      <div class="hm-chart-wrap">
        <select id="hmCardioMetric" class="stack-input stack-select">
          <option value="durationMin">Duration</option>
          <option value="intensity">Intensity</option>
        </select>
        <div id="hmCardioChart" class="hm-chart"></div>
      </div>
      <div id="hmCardioList" class="hm-list"></div>
    </div>

    <div id="hmView-recomp" class="hm-view" hidden>
```

- [ ] **Step 3: Commit**

```bash
git add health.html
git commit -m "feat: cardio tab markup (tab button + view div, mirrors the sleep tab's shape)"
```

---

### Task 2: `getCardio`/`setCardio`/`renderCardio` + wiring

**Files:**
- Modify: `C:\Users\gregm\row\health.html:1012-1020` (`hmSwitchTab`)
- Modify: `C:\Users\gregm\row\health.html:1259` (add cardio functions after `renderSleep()`'s call)
- Modify: `C:\Users\gregm\row\health.html:1737` (`initCloudSync` syncedKeys)

- [ ] **Step 1: Add `'cardio'` to the tab-switch array**

In `health.html`, change (currently lines 1012-1015):

```javascript
  function hmSwitchTab(tab) {
    ['vitals', 'labs', 'measurements', 'sleep', 'recomp'].forEach((t) => {
      document.getElementById('hmView-' + t).hidden = t !== tab;
    });
```
to:
```javascript
  function hmSwitchTab(tab) {
    ['vitals', 'labs', 'measurements', 'sleep', 'cardio', 'recomp'].forEach((t) => {
      document.getElementById('hmView-' + t).hidden = t !== tab;
    });
```

- [ ] **Step 2: Add the cardio get/set/render functions and event wiring**

In `health.html`, immediately after the existing sleep block's last line (currently `renderSleep();` at line 1259), insert:

```javascript
  function getCardio() { return _get('health:cardio') || []; }
  function setCardio(list) { _set('health:cardio', list); }

  function renderCardio() {
    const list = getCardio();
    const listEl = document.getElementById('hmCardioList');
    listEl.innerHTML = list.slice().reverse().map((e) =>
      '<div class="hm-list-row"><span>' + e.date +
      ' — ' + (e.type ?? '—') + ' · ' + (e.durationMin ?? '—') + 'min · intensity ' + (e.intensity ?? '—') +
      '</span><span class="hm-list-del" data-del-date="' + e.date + '">✕</span></div>'
    ).join('');

    const metric = document.getElementById('hmCardioMetric').value;
    const vals = list.filter((e) => e[metric] != null).map((e) => e[metric]);
    const chartEl = document.getElementById('hmCardioChart');
    chartEl.innerHTML = vals.length >= 2
      ? buildMiniSpark(vals, 300, 90)
      : '<div class="hm-chart-empty">Need 2+ entries for a trend</div>';
  }

  document.getElementById('hmCardioAddBtn').addEventListener('click', () => {
    const date = document.getElementById('hmCardioDate').value || new Date().toISOString().slice(0, 10);
    const fields = {
      type: document.getElementById('hmCardioType').value || null,
      durationMin: document.getElementById('hmCardioDuration').value ? Number(document.getElementById('hmCardioDuration').value) : null,
      intensity: document.getElementById('hmCardioIntensity').value ? Number(document.getElementById('hmCardioIntensity').value) : null,
    };
    setCardio(upsertByDate(getCardio(), date, fields));
    document.getElementById('hmCardioType').value = '';
    document.getElementById('hmCardioDuration').value = '';
    document.getElementById('hmCardioIntensity').value = '';
    renderCardio();
  });

  document.getElementById('hmCardioMetric').addEventListener('change', renderCardio);

  document.getElementById('hmCardioList').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del-date]');
    if (!del) return;
    setCardio(getCardio().filter((entry) => entry.date !== del.dataset.delDate));
    renderCardio();
  });

  renderCardio();
```

Note: `type` uses `|| null` (not the `? Number(...) : null` pattern the numeric fields use) since it's a text field — an empty string should also normalize to `null`, and `upsertByDate()`'s own filtering (`fields[k] !== null && fields[k] !== undefined && fields[k] !== ''`) already treats `null`/`''`/`undefined` identically, so this is equivalent to leaving it as `''` but more consistent with how `null` reads in the entry list's `?? '—'` fallback display.

- [ ] **Step 3: Add `'health:cardio'` to the synced keys**

In `health.html`, change (currently line 1737):

```javascript
    syncedKeys: ['stack:items', 'stack:version', 'stack:low', 'macro_targets', 'health:vitals', 'health:labs', 'health:measurements', 'health:sleep'],
```
to:
```javascript
    syncedKeys: ['stack:items', 'stack:version', 'stack:low', 'macro_targets', 'health:vitals', 'health:labs', 'health:measurements', 'health:sleep', 'health:cardio'],
```

- [ ] **Step 4: Browser verification**

Open `health.html`, click the new "Cardio" tab — confirm it switches views correctly (only the cardio view visible, tab button highlighted) and every other tab still switches correctly too (regression check on the array edit from Step 1). Log an entry: today's date, type "Incline Walk", duration 30, intensity 6. Confirm it appears in the list as "today — Incline Walk · 30min · intensity 6". Log a second entry on a different date with only duration filled in (no type, no intensity) — confirm it shows "— · Nmin · intensity —" and the duration sparkline now renders (2+ entries with that metric). Delete one entry, confirm it's removed from the list and the chart updates. Reload the page, confirm both remaining entries persist. If signed in with cloud sync active, confirm the entries appear under `app_state`'s `health` key in Supabase (or on a second device/tab) after the sync round-trip.

- [ ] **Step 5: Commit**

```bash
git add health.html
git commit -m "feat: cardio get/set/render functions, tab-switch wiring, and cloud sync"
```
