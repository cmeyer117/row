# Prep Readiness Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a phase-aware guardrail panel to `weekly-review.html` — volume vs. target, recovery trend, cardio/posing completion, mobility exceptions, peak-week freeze status, and a "needs coach decision" flag — reusing data the app already collects.

**Architecture:** One new pure-function module (`gym-readiness-logic.js`) computes the recovery-trend average and formats the mobility-exception list. `weekly-review.html`'s existing `fetchGymState()` gains one extra field (the Season Engine's phase, not currently exposed to this page) and a new `renderReadinessPanel()` function assembles everything into one new section, called alongside the existing closeout/new-decision rendering on page load.

**Tech Stack:** Vanilla JS, no framework. Tests follow this repo's `*.selfcheck.cjs` vm-sandbox convention (`node scripts/run-tests.mjs` auto-discovers them).

---

### Task 1: Expose `PHASES` labels from `gym-season-logic.js`

**Files:**
- Modify: `gym-season-logic.js`
- Test: `gym-season-logic.selfcheck.cjs`

`gym.html`'s Season Engine IIFE currently hardcodes `var PHASES = { cut: 'Cut', ... }` inline rather than in the shared, testable `gym-season-logic.js` module. The readiness panel needs the same label map — expose it from the shared module instead of a third hardcoded copy.

- [ ] **Step 1: Write the failing assertion**

Read `gym-season-logic.selfcheck.cjs` first to see its exact existing structure (vm-sandbox setup, `assertEqual` helper), then add, before its final `console.log`:

```javascript
// PHASES -- shared label map, single source of truth (previously
// duplicated inline in gym.html's Season Engine IIFE).
assertEqual(PHASES.cut, 'Cut', 'PHASES: cut label');
assertEqual(PHASES.reverse_diet, 'Reverse Diet', 'PHASES: reverse_diet label');
assertEqual(PHASES.growth, 'Growth', 'PHASES: growth label');
assertEqual(PHASES.peak, 'Peak Week', 'PHASES: peak label');
assertEqual(PHASES.show_prep, 'Show Prep', 'PHASES: show_prep label');
```

Add `PHASES` to the destructured import line near the top of the file (find the existing `const { daysSince, todayKey } = ...` or equivalent line and add `PHASES`).

- [ ] **Step 2: Run to verify it fails**

Run: `node gym-season-logic.selfcheck.cjs`
Expected: FAIL — `PHASES` is `undefined`.

- [ ] **Step 3: Add the export**

In `gym-season-logic.js`, add the map and export it:

```javascript
  var PHASES = { cut: 'Cut', reverse_diet: 'Reverse Diet', growth: 'Growth', peak: 'Peak Week', show_prep: 'Show Prep' };

  if (typeof window !== 'undefined') {
    window.GymSeasonLogic = { daysSince: daysSince, todayKey: todayKey, PHASES: PHASES };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { daysSince: daysSince, todayKey: todayKey, PHASES: PHASES };
  }
```

(Replace the existing final `if (typeof window...)`/`if (typeof module...)` block — same shape, just with `PHASES` added to both exported objects.)

- [ ] **Step 4: Run to verify it passes**

Run: `node gym-season-logic.selfcheck.cjs`
Expected: pass, exit code 0.

- [ ] **Step 5: Update `gym.html`'s Season Engine to use the shared map**

In `gym.html`, find (around line 7471):

```javascript
  var PHASES = { cut: 'Cut', reverse_diet: 'Reverse Diet', growth: 'Growth', peak: 'Peak Week', show_prep: 'Show Prep' };
```

Replace with:

```javascript
  var PHASES = window.GymSeasonLogic.PHASES;
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all files `PASS`.

- [ ] **Step 7: Commit**

```bash
git add gym-season-logic.js gym-season-logic.selfcheck.cjs gym.html
git commit -m "refactor(season): expose PHASES label map from gym-season-logic.js, dedupe from gym.html"
```

---

### Task 2: `gym-readiness-logic.js` — recovery trend and mobility exceptions

**Files:**
- Create: `gym-readiness-logic.js`
- Test: `gym-readiness-logic.selfcheck.cjs`

- [ ] **Step 1: Write the failing test file**

Create `gym-readiness-logic.selfcheck.cjs`:

```javascript
// Run with: node gym-readiness-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-readiness-logic.js'), 'utf8'), sandbox);
const R = sandbox.window.GymReadinessLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

const RECOVERY_SCORE = { low: 1, med: 2, high: 3 };

// --- recoveryTrend ---
// checkins: { 'YYYY-MM-DD': { recovery: 'low'|'med'|'high'|null, ... } }.
// refSunday: the Sunday the trailing 7-day window ends on (inclusive).
const checkins14 = {
  '2026-08-03': { recovery: 'low' }, '2026-08-04': { recovery: 'low' }, '2026-08-05': { recovery: 'med' },
  '2026-08-06': { recovery: 'low' }, '2026-08-07': { recovery: 'med' }, '2026-08-08': { recovery: 'low' }, '2026-08-09': { recovery: 'low' },
  '2026-08-10': { recovery: 'high' }, '2026-08-11': { recovery: 'high' }, '2026-08-12': { recovery: 'med' },
  '2026-08-13': { recovery: 'high' }, '2026-08-14': { recovery: 'med' }, '2026-08-15': { recovery: 'high' }, '2026-08-16': { recovery: 'high' },
};
const trend = R.recoveryTrend(checkins14, '2026-08-16', RECOVERY_SCORE);
assertEqual(trend.direction, 'up', 'recoveryTrend: second week averaged higher than first -- direction up');

const flatCheckins = {
  '2026-08-10': { recovery: 'med' }, '2026-08-11': { recovery: 'med' }, '2026-08-12': { recovery: 'med' },
  '2026-08-13': { recovery: 'med' }, '2026-08-14': { recovery: 'med' }, '2026-08-15': { recovery: 'med' }, '2026-08-16': { recovery: 'med' },
};
const flatTrend = R.recoveryTrend(flatCheckins, '2026-08-16', RECOVERY_SCORE);
assertEqual(flatTrend.direction, 'flat', 'recoveryTrend: identical weeks (no prior data to compare) -- flat, not up/down');

const noData = R.recoveryTrend({}, '2026-08-16', RECOVERY_SCORE);
assertEqual(noData.direction, null, 'recoveryTrend: no checkin data at all -- direction null');
assertEqual(noData.avgLast7, null, 'recoveryTrend: no data -- avgLast7 null');

// entries with no recovery rating (null) are excluded from the average, not
// treated as 0.
const partialCheckins = { '2026-08-16': { recovery: 'high' }, '2026-08-15': { pain: 'low' } };
const partialTrend = R.recoveryTrend(partialCheckins, '2026-08-16', RECOVERY_SCORE);
assertEqual(partialTrend.avgLast7, 3, 'recoveryTrend: entries with no recovery field are excluded, not counted as 0');

// --- mobilityExceptionsInWeek ---
const jointPain = [
  { joint: 'knee', severity: 'med', date: '2026-08-11' },
  { joint: 'shoulder', severity: 'low', date: '2026-08-13' },
  { joint: 'knee', severity: 'high', date: '2026-08-03' }, // outside the window
];
const exceptions = R.mobilityExceptionsInWeek(jointPain, '2026-08-10', '2026-08-16');
assertEqual(exceptions.length, 2, 'mobilityExceptionsInWeek: only entries within the Monday-Sunday window');
assertEqual(exceptions[0].joint, 'knee', 'mobilityExceptionsInWeek: preserves entry shape/order');

assertEqual(R.mobilityExceptionsInWeek([], '2026-08-10', '2026-08-16').length, 0, 'mobilityExceptionsInWeek: empty input returns empty array');
assertEqual(R.mobilityExceptionsInWeek(null, '2026-08-10', '2026-08-16').length, 0, 'mobilityExceptionsInWeek: null input returns empty array, does not crash');

console.log('All gym-readiness-logic self-checks passed.');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node gym-readiness-logic.selfcheck.cjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'recoveryTrend')`.

- [ ] **Step 3: Write the implementation**

Create `gym-readiness-logic.js`:

```javascript
// gym-readiness-logic.js — pure math for the Prep Readiness panel
// (weekly-review.html). No DOM, no Supabase. See
// docs/superpowers/specs/2026-08-19-prep-readiness-panel-design.md.
(function () {
  'use strict';

  // checkins: { dateKey: { recovery: 'low'|'med'|'high'|null, ... } }.
  // refSunday: 'YYYY-MM-DD', the last day of the trailing 7-day window.
  // scoreMap: { low: 1, med: 2, high: 3 } -- injected rather than hardcoded
  // so the caller's rating scale stays the single source of truth.
  // Returns { avgLast7: number|null, avgPrior7: number|null, direction:
  // 'up'|'down'|'flat'|null }. direction is null only when avgLast7 itself
  // has no data; it's 'flat' (not null) when both weeks have data but are
  // equal, or when the prior week has no data to compare against.
  function recoveryTrend(checkins, refSunday, scoreMap) {
    function windowAvg(endDateKey, daysBack) {
      const end = new Date(endDateKey + 'T00:00:00Z');
      let sum = 0, count = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() - (daysBack + i));
        const key = d.toISOString().slice(0, 10);
        const entry = checkins && checkins[key];
        const score = entry && entry.recovery ? scoreMap[entry.recovery] : null;
        if (score != null) { sum += score; count++; }
      }
      return count ? sum / count : null;
    }
    const avgLast7 = windowAvg(refSunday, 0);
    const avgPrior7 = windowAvg(refSunday, 7);
    let direction = null;
    if (avgLast7 != null) {
      direction = (avgPrior7 == null || avgLast7 === avgPrior7) ? 'flat' : (avgLast7 > avgPrior7 ? 'up' : 'down');
    }
    return { avgLast7: avgLast7, avgPrior7: avgPrior7, direction: direction };
  }

  // jointPain: state.jointPain array ({ joint, severity, date }). Returns
  // entries with date within [monday, sunday] inclusive, same shape/order,
  // for display as a flag list. Tolerates null/missing input.
  function mobilityExceptionsInWeek(jointPain, monday, sunday) {
    return (jointPain || []).filter(function (e) {
      return e && e.date && e.date >= monday && e.date <= sunday;
    });
  }

  const api = { recoveryTrend: recoveryTrend, mobilityExceptionsInWeek: mobilityExceptionsInWeek };
  if (typeof window !== 'undefined') window.GymReadinessLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `node gym-readiness-logic.selfcheck.cjs`
Expected: `All gym-readiness-logic self-checks passed.`, exit code 0.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all files `PASS`.

- [ ] **Step 6: Commit**

```bash
git add gym-readiness-logic.js gym-readiness-logic.selfcheck.cjs
git commit -m "feat(readiness): add pure recovery-trend and mobility-exception functions"
```

---

### Task 3: Extend `fetchGymState()` to include the Season Engine phase

**Files:**
- Modify: `weekly-review.html:73-86`

**Context:** `po_coach_season` (phase + startDate) is a sibling top-level key alongside `po_coach_v1` within the same `app_state` row's `data` object (`gym.html`'s `PC_SYNCED_KEYS` confirms both are pushed there). `checkins` and `jointPain` are already nested inside `po_coach_v1` itself (both live on `gym.html`'s single `state` object, which `saveState()` serializes wholesale) — so they're already reachable as `gymState.checkins`/`gymState.jointPain` today, no change needed for those two.

- [ ] **Step 1: Replace `fetchGymState()`**

Find (lines 73-86):

```javascript
async function fetchGymState() {
  if (_gymStatePromise) return _gymStatePromise;
  _gymStatePromise = (async () => {
    const res = await fetch('https://vikpcejlyxieguorwysf.supabase.co/rest/v1/app_state?key=eq.po-coach&select=data', {
      headers: {
        apikey: 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv',
        Authorization: 'Bearer sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv',
      },
    });
    const rows = await res.json();
    return (rows[0] && rows[0].data && rows[0].data.po_coach_v1) || { exercises: [], logs: {} };
  })();
  return _gymStatePromise;
}
```

Replace with:

```javascript
async function fetchGymState() {
  if (_gymStatePromise) return _gymStatePromise;
  _gymStatePromise = (async () => {
    const res = await fetch('https://vikpcejlyxieguorwysf.supabase.co/rest/v1/app_state?key=eq.po-coach&select=data', {
      headers: {
        apikey: 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv',
        Authorization: 'Bearer sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv',
      },
    });
    const rows = await res.json();
    const data = rows[0] && rows[0].data;
    const base = (data && data.po_coach_v1) || { exercises: [], logs: {} };
    // po_coach_season is a sibling key to po_coach_v1 within the same
    // app_state row (see gym.html's PC_SYNCED_KEYS), not nested inside
    // it -- merge it in under `season` so callers get everything from one
    // fetch. checkins/jointPain are already inside po_coach_v1 itself.
    return Object.assign({}, base, { season: (data && data.po_coach_season) || null });
  })();
  return _gymStatePromise;
}
```

- [ ] **Step 2: Commit**

```bash
git add weekly-review.html
git commit -m "feat(readiness): merge Season Engine phase into fetchGymState()'s result"
```

---

### Task 4: Add the readiness panel section and `renderReadinessPanel()`

**Files:**
- Modify: `weekly-review.html:14-19` (script includes)
- Modify: `weekly-review.html:59-64` (body markup)
- Modify: `weekly-review.html:341-349` (`DOMContentLoaded` handler)

- [ ] **Step 1: Load the two new scripts**

Find (lines 14-19):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="row-auth.js" defer></script>
<script src="topbar.js" defer></script>
<script src="gym-volume-logic.js"></script>
<script src="decisions.js"></script>
```

Replace with:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="row-auth.js" defer></script>
<script src="topbar.js" defer></script>
<script src="gym-volume-logic.js"></script>
<script src="gym-season-logic.js"></script>
<script src="gym-readiness-logic.js"></script>
<script src="decisions.js"></script>
```

- [ ] **Step 2: Add the panel container to the body**

Find (lines 59-64):

```html
<div id="app" style="max-width:640px;margin:0 auto;padding:24px 16px 100px;">
  <h1 style="font-family:var(--font);font-size:22px;color:var(--text-1);">Weekly Coach Decision Loop</h1>
  <div id="loading" style="color:var(--text-3);">Loading...</div>
  <div id="closeoutSection" style="display:none;"></div>
  <div id="newDecisionSection" style="display:none;"></div>
</div>
```

Replace with:

```html
<div id="app" style="max-width:640px;margin:0 auto;padding:24px 16px 100px;">
  <h1 style="font-family:var(--font);font-size:22px;color:var(--text-1);">Weekly Coach Decision Loop</h1>
  <div id="loading" style="color:var(--text-3);">Loading...</div>
  <div id="readinessSection" style="display:none;"></div>
  <div id="closeoutSection" style="display:none;"></div>
  <div id="newDecisionSection" style="display:none;"></div>
</div>
```

- [ ] **Step 3: Write `renderReadinessPanel()`**

Add this function before the existing `document.addEventListener('DOMContentLoaded', ...)` block (i.e. just after `renderNewDecisionForm()`'s closing `}` around line 339):

```javascript
// Prep Readiness Panel -- phase-aware guardrail view, not a peak-week
// engine. See docs/superpowers/specs/2026-08-19-prep-readiness-panel-design.md.
const RECOVERY_SCORE = { low: 1, med: 2, high: 3 };
const TREND_ARROW = { up: '↑', down: '↓', flat: '→' };

async function renderReadinessPanel() {
  const el = document.getElementById('readinessSection');
  const [gymState, existingDecision] = await Promise.all([
    fetchGymState(),
    window.getOpenDueDecision('weekly-coach-loop'),
  ]);

  const phase = gymState.season && gymState.season.phase;
  const phaseLabel = phase ? window.GymSeasonLogic.PHASES[phase] : null;
  const day = phase && gymState.season.startDate ? window.GymSeasonLogic.daysSince(gymState.season.startDate) : null;

  const counts = window.GymVolumeLogic.weeklySetsByMuscle(gymState.exercises || [], gymState.logs || {});
  const volumeHtml = MUSCLES.map(m => {
    const band = window.GymVolumeLogic.classifyMuscleVolume(m, counts[m] || 0, phase);
    if (!band || !band.belowTarget) return '';
    return `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;">
      <span style="color:var(--text-2);">${m}</span>
      <span style="color:var(--warn);">${counts[m] || 0} / ${band.target} target</span>
    </div>`;
  }).join('');

  const { monday, sunday } = weekWindow(easternCalendarDate(new Date()));
  const trend = window.GymReadinessLogic.recoveryTrend(gymState.checkins || {}, sunday, RECOVERY_SCORE);
  const trendHtml = trend.direction
    ? `<span style="color:var(--text-1);">${trend.avgLast7.toFixed(1)}/3 ${TREND_ARROW[trend.direction]}</span>`
    : `<span style="color:var(--text-3);">No recovery data logged this week</span>`;

  const [health, posing] = await Promise.all([fetchAppStateKey('health'), fetchAppStateKey('posing')]);
  const cardioCount = countEntriesInWeek((health && health['health:cardio']) || [], monday, sunday);
  const posingCount = countEntriesInWeek((posing && posing['posing:log']) || [], monday, sunday);

  const exceptions = window.GymReadinessLogic.mobilityExceptionsInWeek(gymState.jointPain || [], monday, sunday);
  const exceptionsHtml = exceptions.length
    ? exceptions.map(e => `<div style="font-size:12px;color:var(--warn);padding:2px 0;">${e.joint} — ${e.severity} (${e.date})</div>`).join('')
    : `<div style="font-size:12px;color:var(--text-3);">None logged this week</div>`;

  const peakBanner = phase === 'peak'
    ? `<div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:8px 12px;margin:8px 0;font-size:13px;color:var(--warn);">Holding — no autonomous changes.</div>`
    : '';

  const decisionFlagHtml = existingDecision
    ? `<div style="font-size:13px;color:var(--warn);padding:6px 0;">Needs coach decision — last week's is open and due.</div>`
    : '';

  el.style.display = 'block';
  el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-size:15px;color:var(--text-1);font-weight:600;">${phaseLabel || 'No season set'}</span>
        ${day != null ? `<span style="font-size:12px;color:var(--text-3);">Day ${day}</span>` : ''}
      </div>
      ${peakBanner}
      ${volumeHtml ? `<p style="color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:12px 0 4px;">Below phase target</p>${volumeHtml}` : ''}
      <p style="color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:12px 0 4px;">Recovery trend (7-day)</p>
      ${trendHtml}
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;margin-top:8px;">
        <span style="color:var(--text-1);">Cardio / posing this week</span>
        <span style="color:var(--text-2);">${cardioCount} / ${posingCount}</span>
      </div>
      ${existingDecision && existingDecision.details && (existingDecision.details.cardio_rx || existingDecision.details.posing_rx) ? `
      <div style="font-size:12px;color:var(--text-3);padding:2px 0;">
        ${existingDecision.details.cardio_rx ? `Cardio Rx: ${existingDecision.details.cardio_rx}` : ''}
        ${existingDecision.details.posing_rx ? `<br>Posing Rx: ${existingDecision.details.posing_rx}` : ''}
      </div>` : ''}
      <p style="color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:12px 0 4px;">Mobility exceptions</p>
      ${exceptionsHtml}
      ${decisionFlagHtml}
    </div>`;
}
```

- [ ] **Step 4: Call it from `DOMContentLoaded`**

Find (lines 341-349):

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  const existing = await window.getOpenDueDecision('weekly-coach-loop');
  document.getElementById('loading').style.display = 'none';
  if (existing) {
    renderCloseout(existing);
  } else {
    renderNewDecisionForm();
  }
});
```

Replace with:

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  const existing = await window.getOpenDueDecision('weekly-coach-loop');
  document.getElementById('loading').style.display = 'none';
  renderReadinessPanel();
  if (existing) {
    renderCloseout(existing);
  } else {
    renderNewDecisionForm();
  }
});
```

(`renderReadinessPanel()` and `renderCloseout`/`renderNewDecisionForm` both call `getOpenDueDecision`/`fetchGymState` — the former is cheap to call twice, the latter is memoized via `_gymStatePromise`, so no duplicate network cost worth avoiding here.)

- [ ] **Step 5: Commit**

```bash
git add weekly-review.html
git commit -m "feat(readiness): add Prep Readiness Panel to weekly-review.html"
```

---

### Task 5: Manual verification

No automated DOM test infrastructure in this repo (same as the autopsy plan) and the page is behind real auth. Verify by hand:

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all files `PASS`, including `gym-season-logic.selfcheck.cjs`, `gym-readiness-logic.selfcheck.cjs`.

- [ ] **Step 2: Click-through on the live app**

1. Open `weekly-review.html`.
2. Confirm the readiness panel renders above the existing closeout/new-decision section, with a phase badge (or "No season set" if none is configured — set one via `gym.html`'s "Set Season" button first if needed).
3. If any muscle is below its phase target, confirm it's listed under "Below phase target" with real counts.
4. Confirm the recovery trend shows a number + arrow if any checkins exist this/last week, or the "No recovery data logged" fallback if not.
5. Confirm cardio/posing counts match what's logged in `health.html`/the posing tracker for the current week.
6. Log a joint-pain entry in `gym.html` this week, reload `weekly-review.html`, confirm it appears under "Mobility exceptions."
7. If phase is `peak`, confirm the "Holding — no autonomous changes" banner shows; if not, confirm it's absent.
8. If there's an open, due weekly decision, confirm the "Needs coach decision" line appears.

- [ ] **Step 3: Report back**

Note any mismatches for follow-up rather than silently patching and re-declaring done.
