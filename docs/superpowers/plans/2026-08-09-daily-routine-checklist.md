# Daily Routine Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a morning routine checklist (sunlight, cold shower/exercise, delayed caffeine, live Vessel devotional+prayer checks) inside Morning Launch's commit phase, and an evening routine checklist (dim lights, cool room, casein snack, melatonin, live Vessel journal check) inside Evening Shutdown — both in `main.html`.

**Architecture:** A new pure logic file (`daily-routine-checklist-logic.js`, browser-global `window.DailyRoutineChecklistLogic`, same convention as `morning-launch-logic.js`) owns the two item lists and the merge/live-check logic. `main.html` gets a small `getSupa()` helper (mirrors `state-of-me.html`'s exact pattern), a `renderRoutineChecklist(kind)` function called once from `mlBuildCommit` and once from `mlBuildEvening`, and a new `routine_checklist:` sync prefix.

**Tech Stack:** Vanilla JS/HTML (Row has no build step), Node's built-in `vm` module for the `.selfcheck.cjs` test convention already used by `morning-launch-logic.selfcheck.cjs`.

---

### Task 1: Logic file — item lists and pure helpers

**Files:**
- Create: `daily-routine-checklist-logic.js`
- Test: `daily-routine-checklist-logic.selfcheck.cjs`

- [ ] **Step 1: Write the logic file**

```javascript
(function () {
  'use strict';

  const MORNING_ITEMS = [
    { id: 'sunlight', label: 'Sunlight/bright light within 60 min of waking', kind: 'checkbox' },
    { id: 'cold_or_exercise', label: 'Cold shower or exercise', kind: 'checkbox' },
    { id: 'caffeine_delay', label: 'Delayed caffeine ~90-120 min', kind: 'checkbox' },
    { id: 'devotional', label: 'Devotional read today', kind: 'live', vesselKey: 'devotional_log' },
    { id: 'prayer', label: 'Prayer today', kind: 'live', vesselKey: 'prayer_log' },
  ];

  const EVENING_ITEMS = [
    { id: 'dim_lights', label: 'Dim lights the last 1-2 hours before bed', kind: 'checkbox' },
    { id: 'cool_room', label: 'Cool room temperature', kind: 'checkbox' },
    { id: 'casein_snack', label: 'Casein snack (cottage cheese/Greek yogurt)', kind: 'checkbox' },
    { id: 'melatonin', label: '1mg melatonin', kind: 'checkbox' },
    { id: 'journal', label: 'Journal today', kind: 'live', vesselKey: 'journal' },
  ];

  // vesselData is the raw `data` object of an app_state row (e.g. { 'vessel:prayer_log': [...] }).
  // Handles both real Vessel shapes: a bare date-string array (devotional_log/prayer_log)
  // and an array of {date, ...} objects (journal).
  function hasVesselActivityToday(vesselData, vesselKey, todayKey) {
    if (!vesselData) return false;
    const arr = vesselData['vessel:' + vesselKey];
    if (!Array.isArray(arr)) return false;
    return arr.some(function (entry) {
      const d = typeof entry === 'string' ? entry : (entry && entry.date);
      return d === todayKey;
    });
  }

  // items: MORNING_ITEMS or EVENING_ITEMS.
  // savedChecks: { [itemId]: boolean } from localStorage -- only used for 'checkbox' items.
  // vesselReads: { [vesselKey]: rawAppStateDataObjectOrNull } -- only used for 'live' items.
  // todayKey: 'YYYY-MM-DD' string.
  function buildChecklistState(items, savedChecks, vesselReads, todayKey) {
    return items.map(function (item) {
      if (item.kind === 'checkbox') {
        return Object.assign({}, item, { checked: !!(savedChecks && savedChecks[item.id]) });
      }
      const raw = vesselReads ? vesselReads[item.vesselKey] : undefined;
      const known = raw !== undefined;
      const checked = known ? hasVesselActivityToday(raw, item.vesselKey, todayKey) : false;
      return Object.assign({}, item, { checked: checked, unknown: !known });
    });
  }

  const api = {
    MORNING_ITEMS: MORNING_ITEMS,
    EVENING_ITEMS: EVENING_ITEMS,
    hasVesselActivityToday: hasVesselActivityToday,
    buildChecklistState: buildChecklistState,
  };
  if (typeof window !== 'undefined') window.DailyRoutineChecklistLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 2: Write the selfcheck test file**

```javascript
// Run with: node daily-routine-checklist-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'daily-routine-checklist-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.DailyRoutineChecklistLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

// --- hasVesselActivityToday ---
assertEqual(L.hasVesselActivityToday(null, 'prayer_log', '2026-08-09'), false, 'null data -> false');
assertEqual(L.hasVesselActivityToday({}, 'prayer_log', '2026-08-09'), false, 'missing key -> false');
assertEqual(
  L.hasVesselActivityToday({ 'vessel:prayer_log': ['2026-08-08', '2026-08-09'] }, 'prayer_log', '2026-08-09'),
  true,
  'bare date-string array, today present -> true'
);
assertEqual(
  L.hasVesselActivityToday({ 'vessel:prayer_log': ['2026-08-08'] }, 'prayer_log', '2026-08-09'),
  false,
  'bare date-string array, today absent -> false'
);
assertEqual(
  L.hasVesselActivityToday({ 'vessel:journal': [{ id: 'j1', date: '2026-08-09' }] }, 'journal', '2026-08-09'),
  true,
  'object array with date field, today present -> true'
);
assertEqual(
  L.hasVesselActivityToday({ 'vessel:journal': [{ id: 'j1', date: '2026-08-05' }] }, 'journal', '2026-08-09'),
  false,
  'object array with date field, today absent -> false'
);

// --- buildChecklistState ---
const morningState = L.buildChecklistState(
  L.MORNING_ITEMS,
  { sunlight: true, cold_or_exercise: false },
  { devotional_log: { 'vessel:devotional_log': ['2026-08-09'] }, prayer_log: { 'vessel:prayer_log': [] } },
  '2026-08-09'
);
assertEqual(morningState.find(function (i) { return i.id === 'sunlight'; }).checked, true, 'sunlight checkbox reflects saved true');
assertEqual(morningState.find(function (i) { return i.id === 'cold_or_exercise'; }).checked, false, 'cold_or_exercise checkbox reflects saved false');
assertEqual(morningState.find(function (i) { return i.id === 'caffeine_delay'; }).checked, false, 'unsaved checkbox defaults to false');
assertEqual(morningState.find(function (i) { return i.id === 'devotional'; }).checked, true, 'devotional live item true when today present in read');
assertEqual(morningState.find(function (i) { return i.id === 'prayer'; }).checked, false, 'prayer live item false when today absent in read');
assertEqual(morningState.find(function (i) { return i.id === 'prayer'; }).unknown, false, 'prayer read resolved (empty array is a known result, not unknown)');

const morningStateNoReads = L.buildChecklistState(L.MORNING_ITEMS, {}, {}, '2026-08-09');
assertEqual(morningStateNoReads.find(function (i) { return i.id === 'devotional'; }).unknown, true, 'live item with no read entry at all is unknown, not false');
assertEqual(morningStateNoReads.find(function (i) { return i.id === 'devotional'; }).checked, false, 'unknown live item defaults checked to false');

const eveningState = L.buildChecklistState(L.EVENING_ITEMS, { melatonin: true }, { journal: { 'vessel:journal': [{ id: 'j1', date: '2026-08-09' }] } }, '2026-08-09');
assertEqual(eveningState.find(function (i) { return i.id === 'melatonin'; }).checked, true, 'evening melatonin checkbox reflects saved true');
assertEqual(eveningState.find(function (i) { return i.id === 'journal'; }).checked, true, 'evening journal live item true');
assertEqual(eveningState.length, 5, 'evening item list has 5 items');
assertEqual(L.MORNING_ITEMS.length, 5, 'morning item list has 5 items');

console.log('All daily-routine-checklist-logic tests passed.');
```

- [ ] **Step 3: Run the selfcheck and verify it passes**

Run: `cd /c/Users/gregm/row && node daily-routine-checklist-logic.selfcheck.cjs`
Expected: `All daily-routine-checklist-logic tests passed.` (exit code 0, no FAIL lines)

- [ ] **Step 4: Commit**

```bash
cd /c/Users/gregm/row
git add daily-routine-checklist-logic.js daily-routine-checklist-logic.selfcheck.cjs
git commit -m "feat: add daily routine checklist logic (morning/evening items, Vessel live checks)"
```

---

### Task 2: Wire the logic file into `main.html`

**Files:**
- Modify: `main.html:905` (script tag block)

- [ ] **Step 1: Add the script tag**

At `main.html:905`, immediately after the existing `<script src="morning-launch-logic.js"></script>` line, add:

```html
<script src="daily-routine-checklist-logic.js"></script>
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/gregm/row
git add main.html
git commit -m "feat: load daily-routine-checklist-logic.js in main.html"
```

---

### Task 3: `getSupa()` helper and localStorage read/write in `main.html`

**Files:**
- Modify: `main.html` (inside the existing `(function () { 'use strict'; ... })()` IIFE that starts near line 905's script content — add near the other top-level consts, e.g. right after the `storeSet` function at `main.html:917-922`)

- [ ] **Step 1: Add the Supabase client helper and checklist storage helpers**

Insert immediately after the existing `storeSet` function (`main.html:917-922`):

```javascript
  // --- Daily routine checklist: Vessel read + local checkbox state ---
  const RC_SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const RC_SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
  let rcSupa = null;
  function rcGetSupa() {
    if (!rcSupa && window.supabase) rcSupa = window.supabase.createClient(RC_SUPABASE_URL, RC_SUPABASE_KEY);
    return rcSupa;
  }
  function rcChecklistKey(date) { return 'routine_checklist:' + date; }
  function rcLoadSavedChecks(date) {
    const v = storeGet(rcChecklistKey(date));
    return (v && typeof v === 'object') ? v : {};
  }
  function rcSaveChecked(date, itemId, checked) {
    const saved = rcLoadSavedChecks(date);
    saved[itemId] = checked;
    storeSet(rcChecklistKey(date), saved);
  }
  // Fetches one app_state row's data, wrapped so a failure never throws --
  // caller treats a missing/failed read the same as "not yet known" (renders unknown).
  function rcFetchVesselKey(key) {
    const client = rcGetSupa();
    if (!client) return Promise.resolve(undefined);
    return client.from('app_state').select('data').eq('key', key).maybeSingle()
      .then(function (res) { return (res && res.data) ? res.data.data : undefined; })
      .catch(function () { return undefined; });
  }
```

Note this mirrors `state-of-me.html`'s exact `SUPABASE_URL`/`SUPABASE_KEY`/`getSupa()` pattern (same project, same publishable key already used read-only elsewhere in this codebase) and `storeGet`/`storeSet` from `main.html:914-922` for local persistence, same convention `getGoals`/`initSleepQuick` already use.

- [ ] **Step 2: Commit**

```bash
cd /c/Users/gregm/row
git add main.html
git commit -m "feat: add routine checklist Vessel-read and localStorage helpers to main.html"
```

---

### Task 4: `renderRoutineChecklist(kind)` render function

**Files:**
- Modify: `main.html` (add new function near `mlBuildCommit`/`mlBuildEvening`, e.g. immediately before `function mlBuildCommit(session, outcomesState) {` at `main.html:2049`)

- [ ] **Step 1: Add the render function**

Insert immediately before `main.html:2049`'s `function mlBuildCommit(...)`:

```javascript
  // kind: 'morning' | 'evening'. Appends a checklist block into `wrap` once
  // the relevant Vessel reads resolve (checkbox items render immediately from
  // localStorage; live items render as "..." until their read resolves, then
  // re-render in place -- no full-page re-render, keeps focus/scroll stable).
  function mlAppendRoutineChecklist(wrap, kind) {
    const RC = window.DailyRoutineChecklistLogic;
    if (!RC) return;
    const items = kind === 'morning' ? RC.MORNING_ITEMS : RC.EVENING_ITEMS;
    const date = getActiveDateString();
    const savedChecks = rcLoadSavedChecks(date);

    const section = el('div', 'ml-phase');
    section.appendChild(el('div', 'ml-phase-title', kind === 'morning' ? 'Morning Routine' : 'Evening Routine'));
    const list = el('div', 'ml-outcome-list');
    section.appendChild(list);
    wrap.appendChild(section);

    function renderList(vesselReads) {
      list.innerHTML = '';
      const state = RC.buildChecklistState(items, savedChecks, vesselReads || {}, date);
      state.forEach(function (item) {
        const row = el('label', 'ml-outcome-item');
        if (item.kind === 'checkbox') {
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = item.checked;
          cb.addEventListener('change', function () {
            savedChecks[item.id] = cb.checked;
            rcSaveChecked(date, item.id, cb.checked);
          });
          row.appendChild(cb);
          row.appendChild(el('span', null, item.label));
        } else {
          const status = item.unknown ? '…' : (item.checked ? '✓' : '—');
          row.appendChild(el('span', null, status + ' ' + item.label));
        }
        list.appendChild(row);
      });
    }

    renderList({});
    const liveItems = items.filter(function (i) { return i.kind === 'live'; });
    Promise.all(liveItems.map(function (i) { return rcFetchVesselKey(i.vesselKey).then(function (data) { return [i.vesselKey, data]; }); }))
      .then(function (pairs) {
        const vesselReads = {};
        pairs.forEach(function (pair) { vesselReads[pair[0]] = pair[1]; });
        renderList(vesselReads);
      });
  }
```

- [ ] **Step 2: Call it from `mlBuildCommit`**

In `mlBuildCommit` (`main.html:2049-2096`), immediately before the final `return wrap;` (currently `main.html:2095`), add:

```javascript
    mlAppendRoutineChecklist(wrap, 'morning');
```

- [ ] **Step 3: Call it from `mlBuildEvening`**

In `mlBuildEvening` (`main.html:2162` onward), immediately after the line `wrap.appendChild(el('div', 'ml-phase-title', 'Evening Shutdown'));` (`main.html:2167`), add:

```javascript
    mlAppendRoutineChecklist(wrap, 'evening');
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/gregm/row
git add main.html
git commit -m "feat: render morning/evening routine checklist inside Morning Launch and Evening Shutdown"
```

---

### Task 5: Add `routine_checklist:` to the cloud-sync prefix list

**Files:**
- Modify: `main.html:2288` (the `initCloudSync` config block)

- [ ] **Step 1: Add the prefix**

At `main.html:2288`, change:

```javascript
    syncedPrefixes: ['goals:', 'morning_launch:'],
```

to:

```javascript
    syncedPrefixes: ['goals:', 'morning_launch:', 'routine_checklist:'],
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/gregm/row
git add main.html
git commit -m "feat: sync routine_checklist: keys through Row's existing cloud sync"
```

---

### Task 6: Browser verification

- [ ] **Step 1: Start the preview and open the hub -> Goals**

Use `preview_start` with `name: "row"`, navigate to `main.html`. If Morning Launch hasn't been started today, start it and advance to the Commit phase (or use whatever state gets `session.currentPhase === 'commit'`).

- [ ] **Step 2: Verify the morning checklist renders**

Confirm a "Morning Routine" section appears in the Commit phase with 5 rows: 3 checkboxes (Sunlight, Cold shower or exercise, Delayed caffeine) and 2 live-status rows (Devotional, Prayer) that initially show "…" and settle to "✓"/"—" within a second or two.

- [ ] **Step 3: Verify checkbox persistence**

Check one of the checkbox items, reload the page, navigate back to the Commit phase. Confirm the checkbox is still checked (round-tripped through `routine_checklist:<date>` in localStorage).

- [ ] **Step 4: Verify the evening checklist renders**

If the current time is past 5pm (`mlEveningDue()`'s existing gate), confirm the Evening Shutdown section shows an "Evening Routine" block with 4 checkboxes (Dim lights, Cool room, Casein snack, Melatonin) and 1 live-status row (Journal). If it's before 5pm, this step can be verified by temporarily checking `mlEveningDue()`'s logic against the system clock rather than forcing the time — note the result either way, don't fabricate a pass.

- [ ] **Step 5: Verify no console errors**

Use `read_console_messages` — confirm zero new errors introduced (a failed Vessel read should silently render "…"/unknown, never throw).

- [ ] **Step 6: Check network requests**

Use `read_network_requests` filtered to `app_state` — confirm exactly 2 Vessel reads fire on the Commit phase (devotional_log, prayer_log) and 1 on the Evening Shutdown (journal), each a simple GET, no writes to Vessel's data (read-only boundary preserved, matching the design doc's stated boundary).

---

### Task 7: Push

- [ ] **Step 1: Review the full diff**

```bash
cd /c/Users/gregm/row
git log --oneline -7
git diff origin/main..HEAD --stat
```

- [ ] **Step 2: Push**

```bash
cd /c/Users/gregm/row
git push
```
