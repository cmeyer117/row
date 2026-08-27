# Intensifiers Section — gym.html Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drop-set/cluster-set/superset reference info and tap-to-log tracking to gym.html's per-exercise Rx card, gated by a per-exercise toggle (defaulted from an `isolation` tag on single-joint exercises).

**Architecture:** Extend the existing seed-exercise data (`CONFIG.defaultExercises`) with a new `isolation` field, backfilled the same way `formTip`/`setReps` already are in `normalize()`. Add a new persisted `state.intensifierEnabled` map for per-exercise overrides. Add a `pendingTechnique` field to the existing per-day `state.sessions[dk][exId]` bucket (same object `activeVariant` already lives in) so it auto-clears on day change for free. Extend `renderRx()` to render the new row and `saveSet()` to consume `pendingTechnique` into the logged entry.

**Tech Stack:** Vanilla JS, inline in `gym.html` (Row's existing pattern — no build step, no framework, no test framework for this file).

Spec: `docs/superpowers/specs/2026-08-27-gym-html-intensifiers-design.md`

---

### Task 1: Tag isolation exercises in seed data + backfill existing state

**Files:**
- Modify: `gym.html:80-185` (`CONFIG.defaultExercises` array)
- Modify: `gym.html:3393-3403` (`normalize()`'s per-exercise backfill loop)

**Classification rule used (single-joint movements only — presses/rows/pulldowns/squats/hinges/lunges/dips are multi-joint and excluded even when machine-based):**

- [ ] **Step 1: Add `isolation: true,` to the 17 single-joint exercise objects**

Add the field as the first property after `name:` on each of these lines (exact text to match, so the edit is unambiguous):

| Line | Exercise name (match text) |
|---|---|
| 89 | `Incline Cable Pec Fly` |
| 92 | `Dumbbell Lateral Raise` |
| 95 | `Cable Front Raise` |
| 98 | `Cable Triceps Overhead Extension` |
| 114 | `Cable Lat Pushdown/Pullover` |
| 117 | `Cable Rear Delt Fly` |
| 120 | `Seated Behind-the-Back Cable Curl` |
| 130 | `Seated Hamstrings Curl` |
| 136 | `Hip Adduction Machine` |
| 139 | `Standing Calf Raise` |
| 155 | `Low Cable Lateral Raise` |
| 158 | `Dumbbell Front Raise` |
| 161 | `Machine Preacher Curl` |
| 164 | `Cable Triceps Pushdown` |
| 171 | `Lying Hamstrings Curl` |
| 180 | `Leg Extension` |
| 183 | `Seated Calf Raise` |

Example of the exact edit for the first one (line 89):

```js
// Before:
    { name: "Incline Cable Pec Fly",               gym: "comm", day: "push", muscle: "Chest", loadType: 'total', repMin: 8,  repMax: 12, step: 5,   startWeight: 52.5,numSets: 2,

// After:
    { name: "Incline Cable Pec Fly",               isolation: true, gym: "comm", day: "push", muscle: "Chest", loadType: 'total', repMin: 8,  repMax: 12, step: 5,   startWeight: 52.5,numSets: 2,
```

Apply the same `isolation: true,` insertion (right after the `name:` value, before `gym:`) to all 17 lines listed above. Every other exercise object in `CONFIG.defaultExercises` is left untouched (no `isolation` field — falsy by default, same as today).

- [ ] **Step 2: Backfill `isolation` onto already-persisted exercises in `normalize()`**

In `gym.html`, find this existing block (~line 3396-3402):

```js
      if (!ex.muscle) ex.muscle = seed.muscle;
      // Lift Lab M5 per-set rep windows / rest time / form cue -- backfilled
      // the same way `muscle` was, for exercises seeded before this field
      // existed.
      if (!ex.setReps && seed.setReps) ex.setReps = seed.setReps;
      if (ex.restMin == null && seed.restMin != null) ex.restMin = seed.restMin;
      if (!ex.formTip && seed.formTip) ex.formTip = seed.formTip;
```

Add one more backfill line immediately after the `formTip` line:

```js
      if (!ex.formTip && seed.formTip) ex.formTip = seed.formTip;
      // Intensifiers feature (2026-08-27) -- isolation is a new seed field;
      // without this backfill, anyone with existing localStorage state would
      // never see it since `ex` comes from their persisted array, not a
      // fresh buildDefaultExercises() call.
      if (ex.isolation == null && seed.isolation != null) ex.isolation = seed.isolation;
```

- [ ] **Step 3: Manually verify the edit**

Open gym.html in a text editor and search for `isolation: true` — expect exactly 17 matches in the seed array, plus the one `seed.isolation` reference in the backfill block (18 total occurrences of the substring `isolation`).

- [ ] **Step 4: Commit**

```bash
cd /c/Users/gregm/row
git add gym.html
git commit -m "feat(intensifiers): tag isolation exercises in seed data"
```

---

### Task 2: Add technique reference data and per-exercise enable state

**Files:**
- Modify: `gym.html` (near `CONFIG` object, ~line 76-78, add `INTENSIFIER_TECHNIQUES` as a sibling top-level `const`)
- Modify: `gym.html:3373-3379` (`normalize()`, add `s.intensifierEnabled` init)
- Modify: `gym.html:3486-3496` (add `intensifiersEnabledFor()` / `setIntensifierEnabled()` near `getSession`/`setSessionVariant`)

- [ ] **Step 1: Add the `INTENSIFIER_TECHNIQUES` reference data**

Find the line just before `const CONFIG = {` (search for `defaultExercises: [` at line 78 to locate the `CONFIG` object; the `const CONFIG = {` opening line is a few lines above it). Add this new constant immediately before `const CONFIG = {`:

```js
// Intensifiers feature (2026-08-27) -- wording sourced from the vault's
// "Intensifier Evidence Ranking" note. Deliberately states the "matches,
// not exceeds, straight-set growth" caveat inline so the in-app reference
// doesn't overstate what the research actually supports.
const INTENSIFIER_TECHNIQUES = {
  dropset: {
    label: 'Drop set',
    blurb: 'Same exercise, reduce the load and go again with no rest once you hit failure. Time-efficient -- matches straight-set growth, not extra growth.',
  },
  clusterset: {
    label: 'Cluster set',
    blurb: 'Same load, short (10-20s) intra-set rest breaks before continuing the set. Manages fatigue -- matches straight-set growth, not extra growth.',
  },
  superset: {
    label: 'Superset',
    blurb: 'Pair with a second exercise, little/no rest between them. Cuts session time -- matches straight-set growth for hypertrophy/strength.',
  },
};
```

- [ ] **Step 2: Initialize `s.intensifierEnabled` in `normalize()`**

Find this existing line (~3404):

```js
    s.logs = (s.logs && typeof s.logs === 'object') ? s.logs : {};
```

Add immediately after it:

```js
    // Intensifiers feature (2026-08-27) -- per-exercise override of the
    // seed-data `isolation` default. undefined means "no override, use the
    // seed default"; explicit true/false always wins.
    if (!s.intensifierEnabled || typeof s.intensifierEnabled !== 'object') s.intensifierEnabled = {};
```

- [ ] **Step 3: Add the enabled-check and setter functions**

Find `getSession`/`setSessionVariant` (~line 3486-3496):

```js
  function getSession(exId) {
    const dk = getActiveDate();
    return (state.sessions[dk] || {})[exId] || { activeVariant: null };
  }

  function setSessionVariant(exId, variant) {
    const dk = getActiveDate();
    if (!state.sessions[dk]) state.sessions[dk] = {};
    if (!state.sessions[dk][exId]) state.sessions[dk][exId] = { activeVariant: null };
    state.sessions[dk][exId].activeVariant = variant;
  }
```

Add these two new functions immediately after `setSessionVariant`:

```js
  // Intensifiers feature (2026-08-27) -- state.intensifierEnabled[exId] is
  // undefined by default (fall back to the seed's `isolation` tag); an
  // explicit true/false is the user's manual override via the Rx-card
  // toggle and always wins.
  function intensifiersEnabledFor(ex) {
    const override = state.intensifierEnabled[ex.id];
    return typeof override === 'boolean' ? override : !!ex.isolation;
  }
  function setIntensifierEnabled(exId, enabled) {
    state.intensifierEnabled[exId] = enabled;
    if (!enabled) clearPendingTechnique(exId); // don't leave an armed technique the UI no longer shows a way to see/cancel
  }
```

(`clearPendingTechnique` is defined in Task 3 — this function references it but Task 3 must land before this code path is exercised; both land in the same session so this is fine.)

- [ ] **Step 4: Commit**

```bash
cd /c/Users/gregm/row
git add gym.html
git commit -m "feat(intensifiers): add technique reference data and per-exercise enable state"
```

---

### Task 3: Add pending-technique arm/consume/clear functions

**Files:**
- Modify: `gym.html:3486-3496` (same area as Task 2, extends the session-state pattern)

- [ ] **Step 1: Add arm/get/clear functions for the per-day pending technique**

Immediately after the `setIntensifierEnabled` function added in Task 2, add:

```js
  // Intensifiers feature (2026-08-27) -- pendingTechnique lives in the same
  // per-day, per-exercise session bucket as activeVariant, so it clears
  // automatically on day change (state.sessions is keyed by date) without
  // any extra cleanup code needed for that case.
  function armPendingTechnique(exId, technique) {
    const dk = getActiveDate();
    if (!state.sessions[dk]) state.sessions[dk] = {};
    if (!state.sessions[dk][exId]) state.sessions[dk][exId] = { activeVariant: null };
    // Tapping the same chip again disarms it -- toggle, don't just set.
    state.sessions[dk][exId].pendingTechnique =
      state.sessions[dk][exId].pendingTechnique === technique ? null : technique;
    saveState();
  }
  function getPendingTechnique(exId) {
    return getSession(exId).pendingTechnique || null;
  }
  function clearPendingTechnique(exId) {
    const dk = getActiveDate();
    if (state.sessions[dk] && state.sessions[dk][exId]) {
      state.sessions[dk][exId].pendingTechnique = null;
    }
  }
```

- [ ] **Step 2: Update `getSession`'s default object to include `pendingTechnique`**

Find (this is the same function from Task 2's Step 3, now getting one more field in its fallback object):

```js
  function getSession(exId) {
    const dk = getActiveDate();
    return (state.sessions[dk] || {})[exId] || { activeVariant: null };
  }
```

Replace with:

```js
  function getSession(exId) {
    const dk = getActiveDate();
    return (state.sessions[dk] || {})[exId] || { activeVariant: null, pendingTechnique: null };
  }
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/gregm/row
git add gym.html
git commit -m "feat(intensifiers): add pending-technique arm/get/clear functions"
```

---

### Task 4: Render the intensifier row on the Rx card

**Files:**
- Modify: `gym.html:4549-4586` (`renderRx()`)
- Modify: `gym.html` (CSS block near line 685, add new styles after `.po-rx-reason`)

- [ ] **Step 1: Write the row-rendering function**

Immediately before `function renderRx() {` (~line 4549), add:

```js
  // Intensifiers feature (2026-08-27) -- renders the enable toggle + the
  // 3 technique chips. Absent entirely (empty string) when intensifiers
  // aren't enabled for this exercise, same pattern as liftLabInfo() being
  // absent when an exercise has no formTip.
  function intensifierRow(ex) {
    const enabled = intensifiersEnabledFor(ex);
    const toggleLabel = enabled ? 'Intensifiers on' : 'Enable intensifiers';
    const toggle = '<button type="button" class="intensifier-toggle' + (enabled ? ' on' : '') + '" data-ex-id="' + ex.id + '" data-enabled="' + enabled + '">' + toggleLabel + '</button>';
    if (!enabled) return '<div class="intensifier-row">' + toggle + '</div>';
    const pending = getPendingTechnique(ex.id);
    const chips = Object.keys(INTENSIFIER_TECHNIQUES).map(function (key) {
      const t = INTENSIFIER_TECHNIQUES[key];
      const armed = pending === key;
      return '<button type="button" class="intensifier-chip' + (armed ? ' armed' : '') + '" data-technique="' + key + '">' + t.label + '</button>';
    }).join('');
    const blurb = pending
      ? '<p class="intensifier-blurb">' + escape(INTENSIFIER_TECHNIQUES[pending].blurb) + '</p>'
      : '';
    return '<div class="intensifier-row">' + toggle + '<div class="intensifier-chips">' + chips + '</div>' + blurb + '</div>';
  }
```

- [ ] **Step 2: Call it from both `renderRx()` branches**

Find (~line 4556):

```js
    const liftLabNote = liftLabInfo(ex);
```

Replace with:

```js
    const liftLabNote = liftLabInfo(ex);
    const intensifierNote = intensifierRow(ex);
```

Then find the two `wrap.innerHTML = ...` lines (~4565 and ~4585) and append `intensifierNote` right after `liftLabNote` in the concatenation in both:

```js
// Line ~4565, before:
      wrap.innerHTML = '<div class="po-rx-card po-rx-tappable" data-tap-reps="' + sr + '"' + (ex.bw ? ' data-tap-bw="1"' : ' data-tap-weight="' + (sw || 0) + '"') + '><div class="po-rx-label">' + escape(displayName) + ' · starting point</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag hold">Start here</span><p class="po-rx-reason">' + reason + ' Tap to log it.</p>' + liftLabNote + '</div>';

// Line ~4565, after:
      wrap.innerHTML = '<div class="po-rx-card po-rx-tappable" data-tap-reps="' + sr + '"' + (ex.bw ? ' data-tap-bw="1"' : ' data-tap-weight="' + (sw || 0) + '"') + '><div class="po-rx-label">' + escape(displayName) + ' · starting point</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag hold">Start here</span><p class="po-rx-reason">' + reason + ' Tap to log it.</p>' + liftLabNote + intensifierNote + '</div>';
```

```js
// Line ~4585, before:
    wrap.innerHTML = '<div class="po-rx-card po-rx-' + rx.type + ' po-rx-tappable" ' + tapAttrs + '><div class="po-rx-label">' + escape(displayName) + '</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag ' + rx.type + '">' + rx.tag + '</span><p class="po-rx-reason">' + rx.reason + ' Tap to log it.</p>' + pumpNote + mesoNote + closeoutNote + liftLabNote + '</div>';

// Line ~4585, after:
    wrap.innerHTML = '<div class="po-rx-card po-rx-' + rx.type + ' po-rx-tappable" ' + tapAttrs + '><div class="po-rx-label">' + escape(displayName) + '</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag ' + rx.type + '">' + rx.tag + '</span><p class="po-rx-reason">' + rx.reason + ' Tap to log it.</p>' + pumpNote + mesoNote + closeoutNote + liftLabNote + intensifierNote + '</div>';
```

- [ ] **Step 3: Add CSS**

Find the existing `.po-rx-reason { ... }` block (~line 685-687):

```css
.po-rx-reason {
  margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-2);
}
```

Add immediately after it:

```css
/* Intensifiers feature (2026-08-27) */
.intensifier-row { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
.intensifier-toggle {
  display: inline-block; padding: 4px 10px; border-radius: 999px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
  background: rgba(255,255,255,0.06); color: var(--text-3);
  border: 1px solid var(--border); cursor: pointer;
}
.intensifier-toggle.on { background: rgba(110,231,183,0.14); color: var(--good); border-color: rgba(110,231,183,0.3); }
.intensifier-chips { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.intensifier-chip {
  padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
  background: rgba(255,255,255,0.05); color: var(--text-2);
  border: 1px solid var(--border); cursor: pointer;
}
.intensifier-chip.armed { background: rgba(110,231,183,0.14); color: var(--good); border-color: rgba(110,231,183,0.3); }
.intensifier-blurb { margin: 8px 0 0; font-size: 11px; line-height: 1.5; color: var(--text-3); }
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/gregm/row
git add gym.html
git commit -m "feat(intensifiers): render the intensifier row on the Rx card"
```

---

### Task 5: Wire click handling for the toggle and chips

**Files:**
- Modify: `gym.html:5504-5519` (existing `$('rxWrap').addEventListener('click', ...)`)

- [ ] **Step 1: Guard the existing tap-to-log listener against clicks inside the new row**

The whole `.po-rx-card` is `.po-rx-tappable`, so any click inside it -- including on the new toggle/chips -- currently bubbles into the existing tap-to-log handler. Find (~line 5504):

```js
  $('rxWrap').addEventListener('click', function(e) {
    const card = e.target.closest('.po-rx-tappable');
    if (!card) return;
```

Replace with:

```js
  $('rxWrap').addEventListener('click', function(e) {
    if (e.target.closest('.intensifier-row')) return; // handled by the listener below, not tap-to-log
    const card = e.target.closest('.po-rx-tappable');
    if (!card) return;
```

- [ ] **Step 2: Add the new delegated listener for the toggle and chips**

Immediately after the existing listener's closing `});` (~line 5519), add:

```js
  $('rxWrap').addEventListener('click', function(e) {
    const toggle = e.target.closest('.intensifier-toggle');
    if (toggle) {
      const exId = toggle.getAttribute('data-ex-id');
      const nowEnabled = toggle.getAttribute('data-enabled') !== 'true';
      setIntensifierEnabled(exId, nowEnabled);
      saveState();
      renderRx();
      return;
    }
    const chip = e.target.closest('.intensifier-chip');
    if (chip) {
      const ex = getCurrentEx();
      if (!ex) return;
      armPendingTechnique(ex.id, chip.getAttribute('data-technique'));
      renderRx();
    }
  });
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/gregm/row
git add gym.html
git commit -m "feat(intensifiers): wire toggle and chip click handling"
```

---

### Task 6: Consume the pending technique when a set is logged

**Files:**
- Modify: `gym.html:6483` (`saveSet()`)

- [ ] **Step 1: Read and clear the pending technique inside `saveSet()`**

Find the start of `saveSet` (~line 6483-6487):

```js
  function saveSet(ex, w, reps, entry) {
    entry = entry || {};
    const dateKey = getChipDate('logDateInput');
    const isoDate = new Date(dateKey + 'T12:00:00').toISOString();
    const arr = state.logs[ex.id] || [];
```

Replace with:

```js
  function saveSet(ex, w, reps, entry) {
    entry = entry || {};
    // Intensifiers feature (2026-08-27) -- consumes whatever technique was
    // armed via the Rx-card chips for THIS exercise, then clears it so it
    // only ever attaches to the one set it was armed for.
    const pendingTechnique = getPendingTechnique(ex.id);
    if (pendingTechnique) {
      entry.technique = pendingTechnique;
      clearPendingTechnique(ex.id);
    }
    const dateKey = getChipDate('logDateInput');
    const isoDate = new Date(dateKey + 'T12:00:00').toISOString();
    const arr = state.logs[ex.id] || [];
```

This covers both call sites (`$('logBtn')`'s click handler and the voice-logger path at ~line 6614) automatically, since both funnel through `saveSet()`.

- [ ] **Step 2: Commit**

```bash
cd /c/Users/gregm/row
git add gym.html
git commit -m "feat(intensifiers): consume the pending technique into the logged set"
```

---

### Task 7: Live-browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the local preview and open gym.html**

Use the `run` skill or `preview_start` to serve the Row app locally, navigate to gym.html, pick a gym/day that includes an isolation-tagged exercise (e.g. "Dumbbell Lateral Raise" on the push day) as the current exercise.

- [ ] **Step 2: Verify the row appears only where expected**

Confirm the intensifier row (toggle + chips once enabled) renders under the Rx card for "Dumbbell Lateral Raise" (isolation-tagged), and does NOT render for "Smith Machine Flat Chest Press" (not tagged) unless manually toggled on.

- [ ] **Step 3: Verify chip tap/blurb/arming**

Tap "Drop set" -- confirm the blurb text appears and the chip shows the `armed` style. Tap it again -- confirm it disarms (blurb disappears, chip un-highlights).

- [ ] **Step 4: Verify logging attaches the technique**

Arm "Cluster set", log a set (enter a weight/rep and tap Log). Open the browser devtools console and run `JSON.parse(localStorage.getItem('po_coach_v1')).logs['<that-exercise-id>']` -- confirm the most recent entry has `"technique":"clusterset"`. Log a second set with nothing armed -- confirm that entry has no `technique` field.

- [ ] **Step 5: Verify day-change clears the pending technique**

Arm a technique on an exercise, then change the logged date to a different day (via the date chip) without logging a set. Switch back or check the Rx card -- confirm the chip is no longer shown as armed (since `pendingTechnique` lives in the now-different day's session bucket).

- [ ] **Step 6: Verify the toggle persists across reload**

Manually enable intensifiers on a non-tagged (compound) exercise, reload the page, navigate back to that exercise -- confirm the toggle is still "on".

- [ ] **Step 7: Report results**

If all 6 checks pass, report done. If any fails, fix the specific issue and re-run only the failed check (not the full suite) before moving to Task 8.

---

### Task 8: Push

- [ ] **Step 1: Push all commits**

```bash
cd /c/Users/gregm/row
git push
```
