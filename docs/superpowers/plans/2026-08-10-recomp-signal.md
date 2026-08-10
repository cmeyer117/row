# Recomp Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Carl a weight-vs-waist "recomp signal" — a two-line chart in Health Markers and a text card in State of Me — so bodyweight alone doesn't mislead him during a recomp.

**Architecture:** One new pure-logic file (`recomp-signal-logic.js`, no DOM/Supabase) computing a 30-day editorial delta and an all-time two-line SVG chart from data that's already in `localStorage` on every Row page. Two thin UI call sites: a new "Recomp" tab in `health.html`'s Health Markers card, and a new card in `state-of-me.html`.

**Tech Stack:** Static HTML/vanilla JS (no framework, no build step), Node `vm`-sandboxed selfcheck script (matches `row-wrapped-logic.selfcheck.cjs`'s convention — no test framework).

**Spec:** `docs/superpowers/specs/2026-08-10-recomp-signal-design.md`

---

## File Structure

- **Create:** `recomp-signal-logic.js` — pure functions: `computeRecompDelta()`, `buildRecompChart()`.
- **Create:** `recomp-signal-logic.selfcheck.cjs` — assert-based Node test, no framework.
- **Modify:** `health.html` — new "Recomp" tab (HTML + `hmSwitchTab` wiring + `renderRecomp()` + script include + small CSS for the legend).
- **Modify:** `state-of-me.html` — new `renderRecomp()` card + script include.

---

### Task 1: `computeRecompDelta` — 30-day editorial delta

**Files:**
- Create: `recomp-signal-logic.js`
- Test: `recomp-signal-logic.selfcheck.cjs`

- [ ] **Step 1: Write the selfcheck test file (will fail — module doesn't exist yet)**

```js
// Run with: node recomp-signal-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'recomp-signal-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.RecompSignalLogic;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}
function assertTrue(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); process.exit(1); }
}

const NOW = new Date('2026-08-10T12:00:00Z'); // cutoff for a 30-day window is 2026-07-11

// --- computeRecompDelta: classifications ---

// Good recomp signal: waist down, weight flat
let r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 200 }, { date: '2026-08-10', value: 200.3 }],
  [{ date: '2026-07-15', value: 35.0 }, { date: '2026-08-10', value: 34.0 }],
  30, NOW
);
assertEqual(r.ok, true, 'good-recomp case resolves');
assertEqual(r.label, 'Good recomp signal', 'waist down + weight flat = good recomp signal');
assertEqual(r.weightDelta, 0.3, 'weight delta computed correctly');
assertEqual(r.waistDelta, -1, 'waist delta computed correctly');

// Cutting: weight down, waist down
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 205 }, { date: '2026-08-10', value: 200 }],
  [{ date: '2026-07-15', value: 36 }, { date: '2026-08-10', value: 34 }],
  30, NOW
);
assertEqual(r.label, 'Cutting', 'weight down + waist down = cutting');

// Bulking — watch waist pace: weight up, waist up
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 195 }, { date: '2026-08-10', value: 200 }],
  [{ date: '2026-07-15', value: 33 }, { date: '2026-08-10', value: 34.5 }],
  30, NOW
);
assertEqual(r.label, 'Bulking — watch waist pace', 'weight up + waist up = bulking watch');

// Worth watching: weight down, waist up
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 205 }, { date: '2026-08-10', value: 200 }],
  [{ date: '2026-07-15', value: 33 }, { date: '2026-08-10', value: 34 }],
  30, NOW
);
assertEqual(r.label, 'Worth watching', 'weight down + waist up = worth watching');

// Holding steady: both flat
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 200 }, { date: '2026-08-10', value: 200.4 }],
  [{ date: '2026-07-15', value: 34 }, { date: '2026-08-10', value: 34.1 }],
  30, NOW
);
assertEqual(r.label, 'Holding steady', 'both flat = holding steady');

// Waist is the primary axis: waist flat wins even if weight is clearly moving
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 195 }, { date: '2026-08-10', value: 205 }],
  [{ date: '2026-07-15', value: 34 }, { date: '2026-08-10', value: 34.1 }],
  30, NOW
);
assertEqual(r.label, 'Holding steady', 'waist flat outranks a moving weight (waist is the primary axis)');

// --- computeRecompDelta: insufficient data ---

// Only 1 waist point in the window (an earlier point falls before the cutoff)
r = L.computeRecompDelta(
  [{ date: '2026-07-15', value: 200 }, { date: '2026-08-10', value: 200.3 }],
  [{ date: '2020-01-01', value: 40 }, { date: '2026-08-01', value: 34 }],
  30, NOW
);
assertEqual(r.ok, false, 'insufficient waist data returns ok:false');
assertTrue(/waist/i.test(r.reason), 'insufficient-waist reason names waist specifically');

// Only 1 weight point in the window
r = L.computeRecompDelta(
  [{ date: '2020-01-01', value: 210 }, { date: '2026-08-01', value: 200 }],
  [{ date: '2026-07-15', value: 35 }, { date: '2026-08-10', value: 34 }],
  30, NOW
);
assertEqual(r.ok, false, 'insufficient weight data returns ok:false');
assertTrue(/weigh/i.test(r.reason), 'insufficient-weight reason names weigh-ins specifically');

// Both empty
r = L.computeRecompDelta([], [], 30, NOW);
assertEqual(r.ok, false, 'both series empty returns ok:false');

console.log('recomp-signal-logic.selfcheck.cjs: all assertions passed (Task 1)');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node recomp-signal-logic.selfcheck.cjs`
Expected: throws — `recomp-signal-logic.js` doesn't exist yet (`ENOENT`).

- [ ] **Step 3: Write `recomp-signal-logic.js`**

```js
// recomp-signal-logic.js — pure functions for the "recomp signal": a
// weight-vs-waist read that's more honest than bodyweight alone during a
// recomp (rising/flat weight can still mean fat loss if muscle is being
// added). No DOM, no Supabase, no canvas/SVG rendering side effects beyond
// returning a plain SVG string. Dual export like row-wrapped-logic.js.
(function () {
  'use strict';

  var WEIGHT_FLAT_THRESHOLD = 1.0; // lbs — below this, treat weight as flat
  var WAIST_FLAT_THRESHOLD = 0.25; // inches — below this, treat waist as flat

  // series: [{date: 'YYYY-MM-DD', value: number}]. Filters to the last
  // windowDays relative to `now`, sorted ascending by date.
  function filterWindow(series, windowDays, now) {
    var cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    var cutoffKey = cutoff.toISOString().slice(0, 10);
    return (series || [])
      .filter(function (p) { return p.date >= cutoffKey; })
      .slice()
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  // Waist is the primary axis (it's the actual fat-loss proxy), weight is
  // the tie-break only when waist itself is trending. When waist is flat,
  // the read is "holding steady" regardless of what weight is doing.
  function classify(weightDelta, waistDelta) {
    var weightFlat = Math.abs(weightDelta) < WEIGHT_FLAT_THRESHOLD;
    var waistFlat = Math.abs(waistDelta) < WAIST_FLAT_THRESHOLD;
    var weightDir = weightFlat ? 'flat' : (weightDelta > 0 ? 'up' : 'down');
    var waistDir = waistFlat ? 'flat' : (waistDelta > 0 ? 'up' : 'down');

    if (waistDir === 'down') {
      return weightDir === 'down'
        ? { label: 'Cutting', detail: 'Weight and waist both trending down together.' }
        : { label: 'Good recomp signal', detail: 'Leaning out while holding/gaining size.' };
    }
    if (waistDir === 'up') {
      return weightDir === 'up'
        ? { label: 'Bulking — watch waist pace', detail: 'Both trending up — keep an eye on the ratio.' }
        : { label: 'Worth watching', detail: 'Waist up while weight isn\'t rising to match.' };
    }
    return { label: 'Holding steady', detail: 'No meaningful change in waist over this window.' };
  }

  // weightSeries/waistSeries: [{date, value}], already normalized by the
  // caller (weight comes from po_coach_weights's {dateKey, weight}, waist
  // from health:measurements's {date, waist} — different field names).
  function computeRecompDelta(weightSeries, waistSeries, windowDays, now) {
    now = now || new Date();
    var w = filterWindow(weightSeries, windowDays, now);
    var waist = filterWindow(waistSeries, windowDays, now);

    if (w.length < 2 && waist.length < 2) {
      return { ok: false, reason: 'Not enough weigh-ins or waist measurements in the last ' + windowDays + ' days.' };
    }
    if (w.length < 2) {
      return { ok: false, reason: 'Not enough weigh-ins in the last ' + windowDays + ' days.' };
    }
    if (waist.length < 2) {
      return { ok: false, reason: 'Not enough waist measurements in the last ' + windowDays + ' days.' };
    }

    var weightDelta = Math.round((w[w.length - 1].value - w[0].value) * 10) / 10;
    var waistDelta = Math.round((waist[waist.length - 1].value - waist[0].value) * 10) / 10;
    var result = classify(weightDelta, waistDelta);
    return {
      ok: true,
      weightDelta: weightDelta,
      waistDelta: waistDelta,
      label: result.label,
      detail: result.detail
    };
  }

  var api = {
    WEIGHT_FLAT_THRESHOLD: WEIGHT_FLAT_THRESHOLD,
    WAIST_FLAT_THRESHOLD: WAIST_FLAT_THRESHOLD,
    computeRecompDelta: computeRecompDelta
  };
  if (typeof window !== 'undefined') window.RecompSignalLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run the selfcheck to verify it passes**

Run: `node recomp-signal-logic.selfcheck.cjs`
Expected: `recomp-signal-logic.selfcheck.cjs: all assertions passed (Task 1)`

- [ ] **Step 5: Commit**

```bash
git add recomp-signal-logic.js recomp-signal-logic.selfcheck.cjs
git commit -m "feat(recomp-signal): computeRecompDelta pure logic + selfcheck"
```

---

### Task 2: `buildRecompChart` — two-line SVG

**Files:**
- Modify: `recomp-signal-logic.js`
- Test: `recomp-signal-logic.selfcheck.cjs`

- [ ] **Step 1: Append the failing assertions to the selfcheck file**

Add to the end of `recomp-signal-logic.js`'s selfcheck, before the final `console.log`:

```js
// --- buildRecompChart ---

// Both series present (2+ points each) — both lines render
let svg = L.buildRecompChart(
  [{ date: '2026-07-01', value: 200 }, { date: '2026-08-01', value: 202 }],
  [{ date: '2026-07-01', value: 35 }, { date: '2026-08-01', value: 34 }],
  300, 90
);
assertTrue(svg.indexOf('<svg') !== -1, 'chart with two full series returns an svg tag');
assertEqual((svg.match(/<polyline/g) || []).length, 2, 'chart with two full series draws two polylines');

// One series short (waist has only 1 point) — only the weight line renders
svg = L.buildRecompChart(
  [{ date: '2026-07-01', value: 200 }, { date: '2026-08-01', value: 202 }],
  [{ date: '2026-08-01', value: 34 }],
  300, 90
);
assertTrue(svg.indexOf('<svg') !== -1, 'chart with one short series still returns an svg tag');
assertEqual((svg.match(/<polyline/g) || []).length, 1, 'chart with one short series draws exactly one polyline');

// Both series empty — returns empty string, not a broken/empty svg tag
svg = L.buildRecompChart([], [], 300, 90);
assertEqual(svg, '', 'chart with no data at all returns an empty string');

console.log('recomp-signal-logic.selfcheck.cjs: all assertions passed (Task 2)');
```

(This replaces the `console.log('...Task 1')` line from Task 1 — keep only one final `console.log` at the end of the file.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `node recomp-signal-logic.selfcheck.cjs`
Expected: throws — `L.buildRecompChart is not a function`.

- [ ] **Step 3: Add `buildRecompChart` to `recomp-signal-logic.js`**

Add this function above the `var api = {` line, and add `buildRecompChart: buildRecompChart` to the `api` object:

```js
  // weightSeries/waistSeries: [{date, value}]. All-time range (not
  // window-limited) — matches the other Health Markers charts. Each line
  // is normalized to its own min/max since weight (~200s lbs) and waist
  // (~30s in) aren't comparable on one scale. A series with fewer than 2
  // points is simply omitted rather than erroring. Returns an SVG string
  // (with a small legend) or '' if there's nothing to plot at all.
  function buildRecompChart(weightSeries, waistSeries, w, h) {
    var weight = (weightSeries || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var waist = (waistSeries || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (weight.length < 2 && waist.length < 2) return '';

    var pad = 6;
    var allDates = weight.concat(waist).map(function (p) { return p.date; }).sort();
    var minT = new Date(allDates[0] + 'T00:00:00Z').getTime();
    var maxT = new Date(allDates[allDates.length - 1] + 'T00:00:00Z').getTime();
    var spanT = maxT - minT || 1;

    function xFor(date) {
      var t = new Date(date + 'T00:00:00Z').getTime();
      return pad + ((t - minT) / spanT) * (w - pad * 2);
    }
    function lineFor(series, color) {
      if (series.length < 2) return '';
      var vals = series.map(function (p) { return p.value; });
      var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
      var range = max - min || 1;
      var points = series.map(function (p) {
        var y = h - pad - ((p.value - min) / range) * (h - pad * 2);
        return xFor(p.date).toFixed(1) + ',' + y.toFixed(1);
      });
      return '<polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + points.join(' ') + '" />';
    }

    var weightLine = lineFor(weight, 'var(--text-primary)');
    var waistLine = lineFor(waist, 'var(--accent)');
    var legend = '<div class="recomp-legend">' +
      '<span class="recomp-legend-item"><span class="recomp-swatch" style="background:var(--text-primary)"></span>Weight</span>' +
      '<span class="recomp-legend-item"><span class="recomp-swatch" style="background:var(--accent)"></span>Waist</span>' +
      '</div>';
    return legend +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' + weightLine + waistLine + '</svg>';
  }
```

- [ ] **Step 4: Run the selfcheck to verify it passes**

Run: `node recomp-signal-logic.selfcheck.cjs`
Expected: `recomp-signal-logic.selfcheck.cjs: all assertions passed (Task 2)`

- [ ] **Step 5: Commit**

```bash
git add recomp-signal-logic.js recomp-signal-logic.selfcheck.cjs
git commit -m "feat(recomp-signal): buildRecompChart two-line SVG + selfcheck"
```

---

### Task 3: Health Markers — new "Recomp" tab

**Files:**
- Modify: `health.html:18` (script include)
- Modify: `health.html:577-586` (CSS — add legend styles near `.hm-chart`)
- Modify: `health.html:735-833` (Health Markers tab bar + views)
- Modify: `health.html:999-1006` (`hmSwitchTab`)
- Modify: `health.html:1214-1217` (`window.RowHealthMarkers.rerenderAll`)

- [ ] **Step 1: Add the script include**

In `health.html`, change line 18 from:

```html
<script src="topbar.js" defer></script>
```

to:

```html
<script src="topbar.js" defer></script>
<script src="recomp-signal-logic.js"></script>
```

- [ ] **Step 2: Add legend CSS**

In `health.html`, find this block (around line 577-579):

```css
.hm-chart-wrap { margin-bottom: 14px; }
.hm-chart { width: 100%; height: 90px; margin-top: 8px; }
.hm-chart svg { width: 100%; height: 100%; display: block; }
```

Add immediately after it:

```css
.recomp-legend { display: flex; gap: 14px; font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }
.recomp-legend-item { display: flex; align-items: center; gap: 5px; }
.recomp-swatch { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.recomp-detail { font-size: 13px; color: var(--text-secondary); margin-top: 10px; line-height: 1.4; }
.recomp-label { font-weight: 700; color: var(--text-primary); }
```

(`--text-secondary` is already defined in this file's `:root` at line 33 — confirmed, no fallback needed.)

- [ ] **Step 3: Add the tab button**

In `health.html`, change:

```html
    <div class="hm-tabs" id="hmTabs">
      <button class="hm-tab-btn hm-tab-active" data-hm-tab="vitals">Vitals</button>
      <button class="hm-tab-btn" data-hm-tab="labs">Labs</button>
      <button class="hm-tab-btn" data-hm-tab="measurements">Measurements</button>
      <button class="hm-tab-btn" data-hm-tab="sleep">Sleep</button>
    </div>
```

to:

```html
    <div class="hm-tabs" id="hmTabs">
      <button class="hm-tab-btn hm-tab-active" data-hm-tab="vitals">Vitals</button>
      <button class="hm-tab-btn" data-hm-tab="labs">Labs</button>
      <button class="hm-tab-btn" data-hm-tab="measurements">Measurements</button>
      <button class="hm-tab-btn" data-hm-tab="sleep">Sleep</button>
      <button class="hm-tab-btn" data-hm-tab="recomp">Recomp</button>
    </div>
```

- [ ] **Step 4: Add the tab panel**

In `health.html`, find the closing of the sleep view (around line 832):

```html
    </div>
  </div>

  <div class="attribution">// editable template · all data stays in your browser</div>
```

Change to:

```html
    </div>

    <div id="hmView-recomp" class="hm-view" hidden>
      <div id="recompChart" class="hm-chart" style="height:110px;"></div>
      <div id="recompDetail" class="recomp-detail"></div>
    </div>
  </div>

  <div class="attribution">// editable template · all data stays in your browser</div>
```

- [ ] **Step 5: Wire `hmSwitchTab` to know about the new tab**

In `health.html`, change:

```js
  function hmSwitchTab(tab) {
    ['vitals', 'labs', 'measurements', 'sleep'].forEach((t) => {
      document.getElementById('hmView-' + t).hidden = t !== tab;
    });
    document.querySelectorAll('.hm-tab-btn').forEach((btn) => {
      btn.classList.toggle('hm-tab-active', btn.dataset.hmTab === tab);
    });
  }
```

to:

```js
  function hmSwitchTab(tab) {
    ['vitals', 'labs', 'measurements', 'sleep', 'recomp'].forEach((t) => {
      document.getElementById('hmView-' + t).hidden = t !== tab;
    });
    document.querySelectorAll('.hm-tab-btn').forEach((btn) => {
      btn.classList.toggle('hm-tab-active', btn.dataset.hmTab === tab);
    });
    if (tab === 'recomp') renderRecomp();
  }
```

- [ ] **Step 6: Write `renderRecomp()`**

In `health.html`, in the same `<script>` block as `renderMeasurements()` (the one defining `getMeasurements`/`setMeasurements`), add this function right after `renderMeasurements()`'s closing brace (around line 1145):

```js
  function loadWeightSeries() {
    let weights = [];
    try { weights = JSON.parse(localStorage.getItem('po_coach_weights') || '[]'); } catch {}
    return weights
      .filter((w) => w && w.dateKey && w.weight != null)
      .map((w) => ({ date: w.dateKey, value: w.weight }));
  }
  function loadWaistSeries() {
    return getMeasurements()
      .filter((e) => e && e.date && e.waist != null)
      .map((e) => ({ date: e.date, value: e.waist }));
  }

  function renderRecomp() {
    const weightSeries = loadWeightSeries();
    const waistSeries = loadWaistSeries();

    const chartEl = document.getElementById('recompChart');
    const chartHtml = window.RecompSignalLogic.buildRecompChart(weightSeries, waistSeries, 300, 90);
    chartEl.innerHTML = chartHtml || '<div class="hm-chart-empty">Need weight + waist data to chart a trend</div>';

    const detailEl = document.getElementById('recompDetail');
    const result = window.RecompSignalLogic.computeRecompDelta(weightSeries, waistSeries, 30, new Date());
    if (!result.ok) {
      detailEl.textContent = result.reason;
      return;
    }
    const weightStr = (result.weightDelta >= 0 ? '+' : '') + result.weightDelta + ' lbs';
    const waistStr = (result.waistDelta >= 0 ? '+' : '') + result.waistDelta + ' in';
    detailEl.innerHTML = '<span class="recomp-label">' + result.label + '</span> — ' + result.detail +
      ' <br>Weight ' + weightStr + ' · Waist ' + waistStr + ' (last 30 days)';
  }
```

- [ ] **Step 7: Wire into `rerenderAll` (used by the sync-applied callback)**

In `health.html`, change:

```js
  window.RowHealthMarkers = {
    _get, _set, upsertByDate, buildMiniSpark,
    rerenderAll: () => { renderVitals(); renderLabs(); renderMeasurements(); renderSleep(); }
  };
```

to:

```js
  window.RowHealthMarkers = {
    _get, _set, upsertByDate, buildMiniSpark,
    rerenderAll: () => { renderVitals(); renderLabs(); renderMeasurements(); renderSleep(); renderRecomp(); }
  };
```

- [ ] **Step 8: Manual verification**

Open `health.html` in a browser (via the `run` skill / local dev server), click the "Recomp" tab, confirm:
- Chart renders with visible weight + waist lines (if Carl has both types of data logged already) or the "Need weight + waist data" empty state (if not).
- The detail line shows a label + the two deltas, or the correct insufficient-data sentence.
- Switching to/from the other 4 tabs still works exactly as before (no regression to `hmSwitchTab`).

- [ ] **Step 9: Commit**

```bash
git add health.html
git commit -m "feat(health): add Recomp tab to Health Markers"
```

---

### Task 4: State of Me — new card

**Files:**
- Modify: `state-of-me.html:17` (script include)
- Modify: `state-of-me.html:114-128` (add `renderRecomp` near `renderWeight`)
- Modify: `state-of-me.html:183-186` (wire into the render sequence)

- [ ] **Step 1: Add the script include**

In `state-of-me.html`, change:

```html
<script src="gym-volume-logic.js"></script>
<script src="macro-calc.js"></script>
```

to:

```html
<script src="gym-volume-logic.js"></script>
<script src="macro-calc.js"></script>
<script src="recomp-signal-logic.js"></script>
```

- [ ] **Step 2: Add a waist-series loader + `renderRecomp()`**

In `state-of-me.html`, right after the existing `loadSleep()` function (around line 89):

```js
  function loadMeasurements() {
    try { return JSON.parse(localStorage.getItem('health:measurements') || '[]'); } catch (e) { return []; }
  }
```

Then, right after the existing `renderWeight()` function (around line 128):

```js
  function renderRecomp() {
    var weightSeries = loadWeights()
      .filter(function (w) { return w && w.dateKey && w.weight != null; })
      .map(function (w) { return { date: w.dateKey, value: w.weight }; });
    var waistSeries = loadMeasurements()
      .filter(function (e) { return e && e.date && e.waist != null; })
      .map(function (e) { return { date: e.date, value: e.waist }; });

    var result = window.RecompSignalLogic.computeRecompDelta(weightSeries, waistSeries, 30, new Date());
    if (!result.ok) return card('Recomp Signal (30 days)', '—', result.reason);

    var weightStr = (result.weightDelta >= 0 ? '+' : '') + result.weightDelta + ' lbs';
    var waistStr = (result.waistDelta >= 0 ? '+' : '') + result.waistDelta + ' in';
    return card('Recomp Signal (30 days)', esc(result.label), 'Weight ' + weightStr + ' · Waist ' + waistStr);
  }
```

- [ ] **Step 3: Wire into the render sequence**

In `state-of-me.html`, change:

```js
  Promise.all([renderMacros(), renderFaithIron()]).then(function (results) {
    var html = renderVolume() + renderWeight() + renderSleep() + results[0] + results[1];
    document.getElementById('somContent').innerHTML = html;
  });
```

to:

```js
  Promise.all([renderMacros(), renderFaithIron()]).then(function (results) {
    var html = renderVolume() + renderWeight() + renderRecomp() + renderSleep() + results[0] + results[1];
    document.getElementById('somContent').innerHTML = html;
  });
```

- [ ] **Step 4: Manual verification**

Open `state-of-me.html` in a browser, confirm the new "Recomp Signal (30 days)" card renders between Weight Trend and Sleep, with either a real label + deltas or the correct insufficient-data sentence (never a blank/broken card).

- [ ] **Step 5: Commit**

```bash
git add state-of-me.html
git commit -m "feat(state-of-me): add Recomp Signal card"
```

---

### Task 5: Live verification against real production data

**Files:** none (verification only)

- [ ] **Step 1: Verify against Carl's real data**

Open both `health.html` (Recomp tab) and `state-of-me.html` against the real deployed/synced data (not seeded test data). Confirm:
- Chart and card both reflect real numbers that match what's actually in the Measurements tab and gym.html's weight tracker.
- If Carl doesn't have 2+ waist entries in the last 30 days yet (likely, since Measurements is manual and probably logged less often than weight), confirm the insufficient-data message actually renders — this is the realistic first-run state, not an edge case to gloss over.

- [ ] **Step 2: Seeded edge-case check**

Temporarily add a second `health:measurements` localStorage entry via the browser console (or the Measurements tab's own form) to get 2+ waist points in-window, confirm the chart and detail line both switch from the degraded state to a real reading. Remove the temporary entry afterward if it's not real data.

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** `computeRecompDelta` (Task 1), `buildRecompChart` (Task 2), Health Markers tab (Task 3), State of Me card (Task 4), selfcheck testing (Tasks 1-2), manual browser verification (Task 5) — all spec sections have a task.
- **Ambiguity resolved during planning:** the spec's classification table didn't cover all 9 weight-direction × waist-direction combinations. Resolved with a waist-first priority rule (waist is the primary fat-loss proxy; weight only tie-breaks when waist itself is trending; waist-flat always reads "Holding steady" regardless of weight) — implemented in `classify()` and covered by the "waist flat outranks a moving weight" selfcheck assertion in Task 1.
- **Type consistency:** `{date, value}` shape used consistently by both callers (`loadWeightSeries`/`loadWaistSeries` in `health.html`, the inline mapping in `state-of-me.html`) and by both logic functions.
