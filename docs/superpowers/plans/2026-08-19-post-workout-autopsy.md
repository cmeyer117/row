# Post-Workout Autopsy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two separate modals that fire on "Mark Done" (the LLM-based `fireDebrief()` and the pain/recovery/pump checkin modal) with one merged, deterministic 30-45s autopsy modal — no LLM call on the default path.

**Architecture:** Two new pure-function modules (`gym-autopsy-logic.js`, a small addition to `gym-volume-logic.js`) compute a beat/met/missed classification per exercise and pick the single highest-priority suggested change from data `getRx()` already produces. `gym.html`'s existing checkin modal gains new fields for this data and a conditional "why it changed" picker; the Mark Done handler computes the autopsy payload and passes it in instead of firing `fireDebrief()` automatically.

**Tech Stack:** Vanilla JS, no framework. Tests follow this repo's `*.selfcheck.cjs` vm-sandbox convention (`node scripts/run-tests.mjs` auto-discovers them).

---

### Task 1: Add a `priority` field to `volumeAdvisory()`

**Files:**
- Modify: `gym-volume-logic.js`
- Test: `gym-volume-logic.selfcheck.cjs`

`pickSuggestedChange()` (Task 3) needs to rank multiple flagged exercises against each other. `volumeAdvisory()` already distinguishes 4 cases internally but only returns `{suggestion, reason}` — add a `priority` number so callers can rank without re-deriving the case from `reason` text.

- [ ] **Step 1: Write the failing assertions**

Add to `gym-volume-logic.selfcheck.cjs`, after the existing `pull_back`/MRV assertions (after line 214):

```javascript
// volumeAdvisory — priority field ranks the 4 cases: pull_back (MRV) highest,
// then under-MEV add, then phase-target add, then stall-based add lowest.
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 25), false).priority, 3, 'volumeAdvisory: MRV pull_back has priority 3');
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 3), false).priority, 2, 'volumeAdvisory: under-MEV add_set has priority 2');
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 9, 'cut'), false, 'cut').priority, 1, 'volumeAdvisory: phase-target add_set has priority 1');
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 15), true).priority, 0, 'volumeAdvisory: stall-based add_set has priority 0');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node gym-volume-logic.selfcheck.cjs`
Expected: FAIL — `priority` is `undefined`, not `3`/`2`/`1`/`0`.

- [ ] **Step 3: Add the field**

In `gym-volume-logic.js`, `volumeAdvisory()` (around line 194), add `priority` to each returned object:

```javascript
  function volumeAdvisory(band, stalled, phase) {
    if (!band) return null;
    if (band.label === 'under') {
      return { suggestion: 'add_set', priority: 2, reason: 'Under MEV (' + band.mev + ' sets/wk) for this muscle -- there\'s real room to add volume here before load progression is even the limiting factor.' };
    }
    if (band.label === 'mrv') {
      return { suggestion: 'pull_back', priority: 3, reason: 'At or above MRV (' + band.mrv + ' sets/wk) for this muscle -- more volume here is more likely to add fatigue than drive further growth.' };
    }
    if (band.belowTarget) {
      if (phase === 'growth') {
        return { suggestion: 'add_set', priority: 1, reason: 'Growth phase target is ' + band.target + ' sets/wk for this muscle -- still room to push toward MAV, and this phase is where added volume is a real lever.' };
      }
      return { suggestion: 'add_set', priority: 1, reason: 'This phase\'s minimum-effective target is ' + band.target + ' sets/wk for this muscle -- worth adding a set to hold there while other levers do the heavy lifting.' };
    }
    if (stalled) {
      return { suggestion: 'add_set', priority: 0, reason: 'Stalled on load, but still under MRV (' + band.mrv + ' sets/wk) for this muscle -- a plateau here is often a volume problem, not purely a load problem. Consider adding a set before assuming a deload is the only fix.' };
    }
    return null;
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `node gym-volume-logic.selfcheck.cjs`
Expected: `All ... self-checks passed.` (or equivalent pass output — check the file's final `console.log` line), exit code 0.

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `npm test`
Expected: all files still `PASS`, including `gym-volume-logic.selfcheck.cjs`.

- [ ] **Step 6: Commit**

```bash
git add gym-volume-logic.js gym-volume-logic.selfcheck.cjs
git commit -m "feat(volume): add priority field to volumeAdvisory() for cross-exercise ranking"
```

---

### Task 2: `gym-autopsy-logic.js` — pure classification and ranking functions

**Files:**
- Create: `gym-autopsy-logic.js`
- Test: `gym-autopsy-logic.selfcheck.cjs`

- [ ] **Step 1: Write the failing test file**

Create `gym-autopsy-logic.selfcheck.cjs`:

```javascript
// Run with: node gym-autopsy-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-autopsy-logic.js'), 'utf8'), sandbox);
const A = sandbox.window.GymAutopsyLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

// --- classifyRxOutcome ---
assertEqual(A.classifyRxOutcome(null), null, 'null rx (first session) classifies as null');
assertEqual(A.classifyRxOutcome({ type: 'up', tag: 'Add weight' }), 'beat', 'type up classifies as beat');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Add a rep' }), 'met', 'hold + Add a rep classifies as met');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Push for more' }), 'met', 'hold + Push for more (bodyweight) classifies as met');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Peak — hold' }), 'met', 'peak-week hold classifies as met');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Repeat' }), 'missed', 'hold + Repeat (fell short of repMin) classifies as missed');
assertEqual(A.classifyRxOutcome({ type: 'down', tag: 'Deload' }), 'missed', 'type down (deload) classifies as missed');
assertEqual(A.classifyRxOutcome({ type: 'hold', tag: 'Reassess' }), 'missed', 'Reassess (stall) classifies as missed');

// --- sessionNeedsReason ---
assertEqual(A.sessionNeedsReason(['beat', 'met']), false, 'all beat/met: no reason needed');
assertEqual(A.sessionNeedsReason(['beat', 'missed']), true, 'any missed: reason needed');
assertEqual(A.sessionNeedsReason([null, null]), false, 'all null (first sessions only): no reason needed');
assertEqual(A.sessionNeedsReason([]), false, 'empty list: no reason needed');

// --- pickSuggestedChange: ranks by volumeAdvisory.priority, highest wins ---
const low = { volumeAdvisory: { suggestion: 'add_set', priority: 0, reason: 'stall reason' } };
const high = { volumeAdvisory: { suggestion: 'pull_back', priority: 3, reason: 'mrv reason' } };
const mid = { volumeAdvisory: { suggestion: 'add_set', priority: 1, reason: 'phase reason' } };
assertEqual(A.pickSuggestedChange([low, high, mid]), 'mrv reason', 'picks the highest-priority advisory reason across exercises');
assertEqual(A.pickSuggestedChange([low]), 'stall reason', 'single flagged exercise: its own reason wins');
assertEqual(A.pickSuggestedChange([{ volumeAdvisory: null }, { volumeAdvisory: null }]), null, 'no exercise flagged: null');
assertEqual(A.pickSuggestedChange([]), null, 'no exercises logged: null');
assertEqual(A.pickSuggestedChange([null, high]), 'mrv reason', 'tolerates null rx entries (first-ever sessions) mixed in');

console.log('All gym-autopsy-logic self-checks passed.');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node gym-autopsy-logic.selfcheck.cjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'classifyRxOutcome')` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `gym-autopsy-logic.js`:

```javascript
// gym-autopsy-logic.js — pure classification/ranking for the merged
// post-workout autopsy modal. No DOM, no Supabase. See
// docs/superpowers/specs/2026-08-19-post-workout-autopsy-design.md.
(function () {
  'use strict';

  // rx: a getRx() result object, or null (first-ever logged session for
  // this exercise -- getRx() returns null when there's no prior log to
  // prescribe from). Returns 'beat' | 'met' | 'missed' | null.
  //
  // type 'up' always means the prior session's target was cleared (beat).
  // type 'down' (Deload) and the 'Reassess'/'Repeat' tags both mean the
  // session came in under what was asked (missed). Everything else --
  // 'Add a rep', 'Push for more' (bodyweight), 'Peak — hold' -- landed
  // exactly where the Rx expected (met).
  function classifyRxOutcome(rx) {
    if (!rx) return null;
    if (rx.type === 'up') return 'beat';
    if (rx.type === 'down') return 'missed';
    if (rx.tag === 'Reassess' || rx.tag === 'Repeat') return 'missed';
    return 'met';
  }

  // outcomes: array of classifyRxOutcome() results for today's logged
  // exercises. The "why it changed" picker only shows when something
  // actually needs explaining.
  function sessionNeedsReason(outcomes) {
    return (outcomes || []).indexOf('missed') !== -1;
  }

  // rxList: array of getRx() results (may include null entries for
  // first-ever sessions) for today's logged exercises. Picks the single
  // highest-priority volumeAdvisory reason across all of them -- mirrors
  // getRx()'s own priority order (MRV pull-back > under-MEV add > phase-
  // target add > stall-based add), just applied across exercises instead
  // of within one. Returns null when nothing was flagged.
  function pickSuggestedChange(rxList) {
    let best = null;
    (rxList || []).forEach(function (rx) {
      const advisory = rx && rx.volumeAdvisory;
      if (!advisory) return;
      if (!best || advisory.priority > best.priority) best = advisory;
    });
    return best ? best.reason : null;
  }

  const api = {
    classifyRxOutcome: classifyRxOutcome,
    sessionNeedsReason: sessionNeedsReason,
    pickSuggestedChange: pickSuggestedChange,
  };
  if (typeof window !== 'undefined') window.GymAutopsyLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `node gym-autopsy-logic.selfcheck.cjs`
Expected: `All gym-autopsy-logic self-checks passed.`, exit code 0.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all files `PASS`, including the two new ones.

- [ ] **Step 6: Commit**

```bash
git add gym-autopsy-logic.js gym-autopsy-logic.selfcheck.cjs
git commit -m "feat(autopsy): add pure Rx-outcome classification and suggested-change ranking"
```

---

### Task 3: Load the new script in `gym.html`

**Files:**
- Modify: `gym.html:6835-6837`

- [ ] **Step 1: Add the script tag**

In `gym.html`, find (around line 6835-6837):

```html
<script src="gym-debrief-logic.js"></script>
<script src="gym-season-logic.js"></script>
<script src="gym-volume-logic.js"></script>
```

Replace with:

```html
<script src="gym-debrief-logic.js"></script>
<script src="gym-season-logic.js"></script>
<script src="gym-volume-logic.js"></script>
<script src="gym-autopsy-logic.js"></script>
```

- [ ] **Step 2: Commit**

```bash
git add gym.html
git commit -m "chore: load gym-autopsy-logic.js in gym.html"
```

---

### Task 4: Extend the checkin modal HTML with autopsy fields

**Files:**
- Modify: `gym.html:2988-3018`

- [ ] **Step 1: Replace the modal markup**

Find the existing `#checkinModalBg` block (lines 2985-3018):

```html
  <!-- POST-WORKOUT CHECK-IN MODAL. z-index above #debriefModal (9000) since
       both can open from the same "Mark Done" tap and .sub-modal-bg's base
       z-index (200) would otherwise leave this one hidden behind it. -->
  <div class="sub-modal-bg" id="checkinModalBg" style="z-index:9500;">
    <div class="sub-modal">
      <div class="sub-modal-title">How'd that session feel?</div>
      <div class="po-checkin-row" data-checkin-field="pain">
        <div class="po-checkin-row-label">Pain</div>
        <button type="button" class="po-checkin-btn" data-val="low">Low</button>
        <button type="button" class="po-checkin-btn" data-val="med">Med</button>
        <button type="button" class="po-checkin-btn" data-val="high">High</button>
      </div>
      <div class="po-checkin-row" data-checkin-field="recovery">
        <div class="po-checkin-row-label">Recovery</div>
        <button type="button" class="po-checkin-btn" data-val="low">Low</button>
        <button type="button" class="po-checkin-btn" data-val="med">Med</button>
        <button type="button" class="po-checkin-btn" data-val="high">High</button>
      </div>
      <div class="po-checkin-row" data-checkin-field="pump">
        <div class="po-checkin-row-label">Pump</div>
        <button type="button" class="po-checkin-btn" data-val="low">Low</button>
        <button type="button" class="po-checkin-btn" data-val="med">Med</button>
        <button type="button" class="po-checkin-btn" data-val="high">High</button>
      </div>
      <div class="po-checkin-row">
        <div class="po-checkin-row-label">Steps today</div>
        <input class="po-quick-input" id="checkinSteps" type="number" inputmode="numeric" placeholder="8000" style="max-width:100px">
      </div>
      <div class="sub-modal-actions">
        <button type="button" class="po-btn-secondary" id="checkinSkip">Skip</button>
        <button type="button" class="po-btn-primary" id="checkinSave">Save</button>
      </div>
    </div>
  </div>
```

Replace with:

```html
  <!-- POST-WORKOUT AUTOPSY MODAL (formerly the checkin modal -- now also
       carries the Rx-vs-actual summary, why-it-changed reason, and
       suggested change that used to be a separate LLM-driven debrief
       modal. z-index above #debriefModal (9000), which is now reached
       only via the "Ask Vision" button below, not fired automatically. -->
  <div class="sub-modal-bg" id="checkinModalBg" style="z-index:9500;">
    <div class="sub-modal">
      <div class="sub-modal-title">Session Autopsy</div>
      <div id="autopsyRxSummary" class="po-checkin-row-label" style="margin-bottom:8px;"></div>
      <div class="po-checkin-row" data-checkin-field="pain">
        <div class="po-checkin-row-label">Pain</div>
        <button type="button" class="po-checkin-btn" data-val="low">Low</button>
        <button type="button" class="po-checkin-btn" data-val="med">Med</button>
        <button type="button" class="po-checkin-btn" data-val="high">High</button>
      </div>
      <div class="po-checkin-row" data-checkin-field="recovery">
        <div class="po-checkin-row-label">Recovery</div>
        <button type="button" class="po-checkin-btn" data-val="low">Low</button>
        <button type="button" class="po-checkin-btn" data-val="med">Med</button>
        <button type="button" class="po-checkin-btn" data-val="high">High</button>
      </div>
      <div class="po-checkin-row" data-checkin-field="pump">
        <div class="po-checkin-row-label">Pump</div>
        <button type="button" class="po-checkin-btn" data-val="low">Low</button>
        <button type="button" class="po-checkin-btn" data-val="med">Med</button>
        <button type="button" class="po-checkin-btn" data-val="high">High</button>
      </div>
      <div class="po-checkin-row">
        <div class="po-checkin-row-label">Steps today</div>
        <input class="po-quick-input" id="checkinSteps" type="number" inputmode="numeric" placeholder="8000" style="max-width:100px">
      </div>
      <div id="autopsyReasonSection" style="display:none;">
        <div class="po-checkin-row-label" id="autopsyReasonLabel" style="margin-top:10px;">Why'd it come up short?</div>
        <div class="po-checkin-row" id="autopsyReasonRow">
          <button type="button" class="po-checkin-btn" data-reason="fatigue">Low energy</button>
          <button type="button" class="po-checkin-btn" data-reason="time">Time crunch</button>
          <button type="button" class="po-checkin-btn" data-reason="pain">Pain/injury</button>
          <button type="button" class="po-checkin-btn" data-reason="stress">Life stress</button>
        </div>
        <textarea id="autopsyDeviationNote" class="po-quick-input" placeholder="Optional note" style="width:100%;margin-top:6px;min-height:40px;"></textarea>
      </div>
      <div id="autopsySuggestedChange" class="po-checkin-row-label" style="display:none;margin-top:10px;"></div>
      <div class="sub-modal-actions">
        <button type="button" class="po-btn-secondary" id="checkinSkip">Skip</button>
        <button type="button" class="po-btn-primary" id="checkinSave">Save</button>
      </div>
      <button type="button" class="po-btn-secondary" id="autopsyAskVision" style="width:100%;margin-top:8px;">Ask Vision for deeper analysis</button>
    </div>
  </div>
```

- [ ] **Step 2: Commit**

```bash
git add gym.html
git commit -m "feat(autopsy): extend checkin modal markup with Rx summary/reason/suggested-change fields"
```

---

### Task 5: Wire the new fields into `initCheckinModal()`

**Files:**
- Modify: `gym.html:5130-5189` (the `initCheckinModal` IIFE)

- [ ] **Step 1: Replace the IIFE**

Find the existing `initCheckinModal` IIFE (lines 5130-5189):

```javascript
  (function initCheckinModal() {
    const bg = $('checkinModalBg');
    const selections = { pain: null, recovery: null, pump: null };
    bg.querySelectorAll('.po-checkin-row').forEach(function(row) {
      const field = row.getAttribute('data-checkin-field');
      row.querySelectorAll('.po-checkin-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          selections[field] = btn.getAttribute('data-val');
          row.querySelectorAll('.po-checkin-btn').forEach(function(b) { b.classList.remove('selected'); });
          btn.classList.add('selected');
        });
      });
    });
    function reset() {
      selections.pain = null; selections.recovery = null; selections.pump = null;
      $('checkinSteps').value = '';
      bg.querySelectorAll('.po-checkin-btn').forEach(function(b) { b.classList.remove('selected'); });
    }
    $('checkinSkip').addEventListener('click', function() {
      bg.classList.remove('show');
      reset();
    });
    $('checkinSave').addEventListener('click', function() {
      // Only record fields the user actually tapped/filled this time — merge
      // into any existing same-day entry so reopening the modal later (e.g.
      // just to add steps) doesn't clobber an already-saved pain/recovery/pump
      // rating back to null.
      const stepsVal = $('checkinSteps').value;
      const steps = stepsVal ? parseInt(stepsVal, 10) : null;
      if (selections.pain != null || selections.recovery != null || selections.pump != null || steps != null) {
        const dateKey = getActiveDate();
        const existing = state.checkins[dateKey] || {};
        state.checkins[dateKey] = {
          pain: selections.pain != null ? selections.pain : (existing.pain != null ? existing.pain : null),
          recovery: selections.recovery != null ? selections.recovery : (existing.recovery != null ? existing.recovery : null),
          pump: selections.pump != null ? selections.pump : (existing.pump != null ? existing.pump : null),
          steps: steps != null ? steps : (existing.steps != null ? existing.steps : null)
        };
        saveState();
      }
      bg.classList.remove('show');
      reset();
    });
    window.__gym_openCheckinModal = function() {
      // Pre-populate from any existing same-day entry so reopening shows
      // what's already saved instead of a blank form.
      const existing = state.checkins[getActiveDate()];
      if (existing) {
        ['pain', 'recovery', 'pump'].forEach(function(field) {
          if (existing[field] == null) return;
          selections[field] = existing[field];
          const row = bg.querySelector('.po-checkin-row[data-checkin-field="' + field + '"]');
          const btn = row && row.querySelector('.po-checkin-btn[data-val="' + existing[field] + '"]');
          if (btn) btn.classList.add('selected');
        });
        if (existing.steps != null) $('checkinSteps').value = existing.steps;
      }
      bg.classList.add('show');
    };
  })();
```

Replace with:

```javascript
  (function initCheckinModal() {
    const bg = $('checkinModalBg');
    const selections = { pain: null, recovery: null, pump: null, reason: null };
    let autopsyPayload = { rxSummary: null, suggestedChange: null };
    bg.querySelectorAll('.po-checkin-row[data-checkin-field]').forEach(function(row) {
      const field = row.getAttribute('data-checkin-field');
      row.querySelectorAll('.po-checkin-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          selections[field] = btn.getAttribute('data-val');
          row.querySelectorAll('.po-checkin-btn').forEach(function(b) { b.classList.remove('selected'); });
          btn.classList.add('selected');
        });
      });
    });
    $('autopsyReasonRow').querySelectorAll('.po-checkin-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        selections.reason = btn.getAttribute('data-reason');
        $('autopsyReasonRow').querySelectorAll('.po-checkin-btn').forEach(function(b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
    });
    function reset() {
      selections.pain = null; selections.recovery = null; selections.pump = null; selections.reason = null;
      $('checkinSteps').value = '';
      $('autopsyDeviationNote').value = '';
      bg.querySelectorAll('.po-checkin-btn').forEach(function(b) { b.classList.remove('selected'); });
      $('autopsyReasonSection').style.display = 'none';
      $('autopsySuggestedChange').style.display = 'none';
      $('autopsyRxSummary').textContent = '';
      autopsyPayload = { rxSummary: null, suggestedChange: null };
    }
    $('checkinSkip').addEventListener('click', function() {
      bg.classList.remove('show');
      reset();
    });
    $('autopsyAskVision').addEventListener('click', function() {
      fireDebrief();
    });
    $('checkinSave').addEventListener('click', function() {
      // Only record fields the user actually tapped/filled this time — merge
      // into any existing same-day entry so reopening the modal later (e.g.
      // just to add steps) doesn't clobber an already-saved pain/recovery/pump
      // rating back to null.
      const stepsVal = $('checkinSteps').value;
      const steps = stepsVal ? parseInt(stepsVal, 10) : null;
      const deviationNote = $('autopsyDeviationNote').value || null;
      const hasAutopsyData = autopsyPayload.rxSummary != null || autopsyPayload.suggestedChange != null;
      if (selections.pain != null || selections.recovery != null || selections.pump != null || steps != null
          || selections.reason != null || deviationNote != null || hasAutopsyData) {
        const dateKey = getActiveDate();
        const existing = state.checkins[dateKey] || {};
        state.checkins[dateKey] = {
          pain: selections.pain != null ? selections.pain : (existing.pain != null ? existing.pain : null),
          recovery: selections.recovery != null ? selections.recovery : (existing.recovery != null ? existing.recovery : null),
          pump: selections.pump != null ? selections.pump : (existing.pump != null ? existing.pump : null),
          steps: steps != null ? steps : (existing.steps != null ? existing.steps : null),
          rxSummary: autopsyPayload.rxSummary != null ? autopsyPayload.rxSummary : (existing.rxSummary != null ? existing.rxSummary : null),
          deviationReason: selections.reason != null ? selections.reason : (existing.deviationReason != null ? existing.deviationReason : null),
          deviationNote: deviationNote != null ? deviationNote : (existing.deviationNote != null ? existing.deviationNote : null),
          suggestedChange: autopsyPayload.suggestedChange != null ? autopsyPayload.suggestedChange : (existing.suggestedChange != null ? existing.suggestedChange : null)
        };
        saveState();
      }
      bg.classList.remove('show');
      reset();
    });
    // autopsy: { rxSummary: 'beat'|'met'|'missed'|null, needsReason: bool,
    // suggestedChange: string|null } -- computed by the Mark Done handler
    // from today's logged exercises via GymAutopsyLogic. Omit/pass nothing
    // to open with no autopsy data (matches the old no-arg call shape).
    window.__gym_openCheckinModal = function(autopsy) {
      // Pre-populate from any existing same-day entry so reopening shows
      // what's already saved instead of a blank form.
      const existing = state.checkins[getActiveDate()];
      if (existing) {
        ['pain', 'recovery', 'pump'].forEach(function(field) {
          if (existing[field] == null) return;
          selections[field] = existing[field];
          const row = bg.querySelector('.po-checkin-row[data-checkin-field="' + field + '"]');
          const btn = row && row.querySelector('.po-checkin-btn[data-val="' + existing[field] + '"]');
          if (btn) btn.classList.add('selected');
        });
        if (existing.steps != null) $('checkinSteps').value = existing.steps;
      }
      if (autopsy) {
        autopsyPayload = { rxSummary: autopsy.rxSummary || null, suggestedChange: autopsy.suggestedChange || null };
        const RX_LABEL = { beat: 'Beat the Rx today.', met: 'Met the Rx today.', missed: 'Came up short of the Rx today.' };
        $('autopsyRxSummary').textContent = autopsy.rxSummary ? RX_LABEL[autopsy.rxSummary] : '';
        if (autopsy.needsReason) {
          $('autopsyReasonLabel').textContent = (autopsy.missedNames && autopsy.missedNames.length)
            ? 'Why\'d ' + autopsy.missedNames.join(', ') + ' come up short?'
            : 'Why\'d it come up short?';
          $('autopsyReasonSection').style.display = 'block';
        }
        if (autopsy.suggestedChange) {
          $('autopsySuggestedChange').textContent = 'Suggested change: ' + autopsy.suggestedChange;
          $('autopsySuggestedChange').style.display = 'block';
        }
      }
      bg.classList.add('show');
    };
  })();
```

- [ ] **Step 2: Commit**

```bash
git add gym.html
git commit -m "feat(autopsy): wire Rx summary/reason/suggested-change into checkin modal JS"
```

---

### Task 6: Compute the autopsy payload on Mark Done, drop the automatic LLM call

**Files:**
- Modify: `gym.html:5089-5108` (the `poTwDoneBtn` click handler)

- [ ] **Step 1: Replace the handler**

Find (lines 5089-5108):

```javascript
  $('poTwDoneBtn').addEventListener('click', () => {
    const todayKey = wtDateKey(new Date());
    const wasUndone = !doneDays[todayKey];
    if (doneDays[todayKey]) {
      delete doneDays[todayKey];
    } else {
      doneDays[todayKey] = new Date().toISOString();
      if (state.viewMode === 'bonus') {
        state.bonusSessionDates[todayKey] = true;
        saveState();
      }
    }
    saveDoneDays(doneDays);
    renderTodaysWorkout();
    renderPastWorkouts();
    if (wasUndone) {
      fireDebrief();
      if (typeof window.__gym_openCheckinModal === 'function') window.__gym_openCheckinModal();
    }
  });
```

Replace with:

```javascript
  // Builds the autopsy payload for today's logged exercises: per-exercise
  // getRx() (same priorLogs-excludes-today convention fireDebrief() already
  // established) feeds GymAutopsyLogic's outcome classifier and suggested-
  // change ranker. Returns null if nothing was logged today (nothing to
  // autopsy -- the checkin modal still opens for a manual pain/recovery/
  // pump entry, just with no Rx summary).
  function buildAutopsyPayload() {
    if (!window.GymAutopsyLogic) return null;
    const today = getActiveDate();
    const allLogs = state.logs || {};
    const exercises = (state.exercises || []).concat(getAdhocExercises());
    const rxList = [];
    const names = [];
    exercises.forEach(function(ex) {
      const allExLogs = allLogs[ex.id] || [];
      const loggedToday = allExLogs.some(function(l) { return l.date.slice(0, 10) === today; });
      if (!loggedToday) return;
      const priorLogs = allExLogs.filter(function(l) { return l.date.slice(0, 10) < today; });
      rxList.push(getRx(ex, priorLogs));
      names.push(ex.name);
    });
    if (!rxList.length) return null;
    const outcomes = rxList.map(window.GymAutopsyLogic.classifyRxOutcome);
    const overall = outcomes.indexOf('missed') !== -1 ? 'missed' : (outcomes.indexOf('beat') !== -1 ? 'beat' : (outcomes.indexOf('met') !== -1 ? 'met' : null));
    const missedNames = outcomes.map(function(o, i) { return o === 'missed' ? names[i] : null; }).filter(Boolean);
    return {
      rxSummary: overall,
      needsReason: window.GymAutopsyLogic.sessionNeedsReason(outcomes),
      missedNames: missedNames,
      suggestedChange: window.GymAutopsyLogic.pickSuggestedChange(rxList)
    };
  }

  $('poTwDoneBtn').addEventListener('click', () => {
    const todayKey = wtDateKey(new Date());
    const wasUndone = !doneDays[todayKey];
    if (doneDays[todayKey]) {
      delete doneDays[todayKey];
    } else {
      doneDays[todayKey] = new Date().toISOString();
      if (state.viewMode === 'bonus') {
        state.bonusSessionDates[todayKey] = true;
        saveState();
      }
    }
    saveDoneDays(doneDays);
    renderTodaysWorkout();
    renderPastWorkouts();
    if (wasUndone && typeof window.__gym_openCheckinModal === 'function') {
      window.__gym_openCheckinModal(buildAutopsyPayload());
    }
  });
```

Note: `fireDebrief()` is no longer called here — it's only reached via the modal's "Ask Vision for deeper analysis" button (Task 5).

- [ ] **Step 2: Commit**

```bash
git add gym.html
git commit -m "feat(autopsy): compute deterministic autopsy payload on Mark Done, drop automatic LLM call"
```

---

### Task 7: Manual verification

This repo has no automated DOM/browser test infrastructure (confirmed during brainstorming — the existing checkin modal has none either), and `gym.html` is behind Row's real auth. Verify by hand:

- [ ] **Step 1: Run the full test suite one more time**

Run: `npm test`
Expected: all files `PASS`, including `gym-volume-logic.selfcheck.cjs` and `gym-autopsy-logic.selfcheck.cjs`.

- [ ] **Step 2: Click-through on the live app**

1. Log at least one set for an exercise with prior history (so `getRx()` returns non-null) today.
2. Tap "Mark Done."
3. Confirm exactly one modal opens (not two) — no separate Vision debrief modal auto-appears.
4. Confirm the Rx summary line shows "Beat the Rx today" / "Met the Rx today" / "Came up short of the Rx today" matching what was actually logged.
5. If the session missed the Rx, confirm the "Why'd it come up short?" section is visible with 4 reason buttons + optional note; if it beat/met, confirm that section is hidden.
6. If any exercise had a volume flag (e.g. under MEV or at MRV for that muscle), confirm "Suggested change:" shows one sentence, not a list.
7. Tap "Ask Vision for deeper analysis" — confirm the old debrief modal opens and behaves as before.
8. Tap "Save" — reopen the checkin modal (undo Mark Done, redo it) and confirm the saved pain/recovery/pump/reason selections re-populate.

- [ ] **Step 3: Report back**

Note any mismatches between expected and actual behavior for follow-up — do not silently fix and re-declare done without surfacing what broke.
