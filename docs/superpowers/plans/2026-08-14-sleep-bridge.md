# Sleep Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `getRx()`'s `applyCheckinOverride()` caps a suggested weight increase when same-day sleep data (logged in `health.html`, read from `health:sleep`) shows poor sleep, joining the existing pain/recovery check-in system as an independent signal — per the approved design at `docs/superpowers/specs/2026-08-14-sleep-bridge-design.md`.

**Architecture:** A new pure module `gym-sleep-check-logic.js` (mirrors `gym-rx-deload-logic.js`'s exact convention) provides `isPoorSleepEntry()`. `applyCheckinOverride()` in `gym.html` is restructured to remove its blanket "no checkin, return early" guard (which would otherwise skip sleep entirely on days with no separate pain/recovery check-in) and gains a same-day `health:sleep` lookup feeding into the existing recovery-low cap.

**Tech Stack:** Vanilla JS, no build step. Tests via `node gym-sleep-check-logic.selfcheck.cjs`.

---

### Task 1: `isPoorSleepEntry()` pure module

**Files:**
- Create: `C:\Users\gregm\row\gym-sleep-check-logic.js`
- Create: `C:\Users\gregm\row\gym-sleep-check-logic.selfcheck.cjs`

- [ ] **Step 1: Write the failing test**

Create `gym-sleep-check-logic.selfcheck.cjs`:

```javascript
// Run with: node gym-sleep-check-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-sleep-check-logic.js'), 'utf8'), sandbox);
const { isPoorSleepEntry } = sandbox.window.GymSleepCheckLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// No entry at all — not poor.
assertEqual(isPoorSleepEntry(null), false, 'isPoorSleepEntry: null entry is not poor');
assertEqual(isPoorSleepEntry(undefined), false, 'isPoorSleepEntry: undefined entry is not poor');

// hours threshold — below 6 is poor, 6 and above is not.
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: 5, quality: null }), true, 'isPoorSleepEntry: 5 hours is poor');
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: 7, quality: null }), false, 'isPoorSleepEntry: 7 hours is not poor');
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: 6, quality: null }), false, 'isPoorSleepEntry: exactly 6 hours is not poor');

// quality threshold — 2 or below is poor, 3 and above is not.
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: null, quality: 2 }), true, 'isPoorSleepEntry: quality 2 is poor');
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: null, quality: 3 }), false, 'isPoorSleepEntry: quality 3 is not poor');

// Either field alone can trigger it -- both null means no signal at all.
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: 4, quality: null }), true, 'isPoorSleepEntry: only hours logged, still triggers on a low value');
assertEqual(isPoorSleepEntry({ date: '2026-08-14', hours: null, quality: null }), false, 'isPoorSleepEntry: both fields null is not poor (no data, not "poor")');

console.log('gym-sleep-check-logic.selfcheck.cjs: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node C:\Users\gregm\row\gym-sleep-check-logic.selfcheck.cjs`
Expected: FAIL — `gym-sleep-check-logic.js` doesn't exist yet (`ENOENT` file-read error).

- [ ] **Step 3: Write the implementation**

Create `gym-sleep-check-logic.js`:

```javascript
// gym-sleep-check-logic.js — pure poor-sleep-night predicate for
// applyCheckinOverride(). Mirrors gym-rx-deload-logic.js's exact convention
// (no DOM, no Supabase, dual window/module.exports). See
// docs/superpowers/specs/2026-08-14-sleep-bridge-design.md.
(function () {
  'use strict';

  // entry: a single health:sleep record ({ date, hours, quality }) or
  // null/undefined if no entry exists for the date in question. hours and
  // quality (1-5 scale) are independently nullable -- Carl might log just
  // one. Either field alone crossing its threshold counts as poor.
  function isPoorSleepEntry(entry) {
    if (!entry) return false;
    var hoursLow = typeof entry.hours === 'number' && entry.hours < 6;
    var qualityLow = typeof entry.quality === 'number' && entry.quality <= 2;
    return hoursLow || qualityLow;
  }

  var api = { isPoorSleepEntry: isPoorSleepEntry };
  if (typeof window !== 'undefined') window.GymSleepCheckLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node C:\Users\gregm\row\gym-sleep-check-logic.selfcheck.cjs`
Expected: `gym-sleep-check-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add gym-sleep-check-logic.js gym-sleep-check-logic.selfcheck.cjs
git commit -m "feat: gym-sleep-check-logic.js -- pure poor-sleep-night predicate"
```

---

### Task 2: Load the script and wire sleep into `applyCheckinOverride()`

**Files:**
- Modify: `C:\Users\gregm\row\gym.html:6549-6550` (script tags)
- Modify: `C:\Users\gregm\row\gym.html:3527-3546` (`applyCheckinOverride()`)

- [ ] **Step 1: Add the script tag**

In `gym.html`, change (currently lines 6549-6550):

```html
<script src="gym-rx-deload-logic.js"></script>
<script src="gym-peak-phase-logic.js"></script>
```
to:
```html
<script src="gym-rx-deload-logic.js"></script>
<script src="gym-peak-phase-logic.js"></script>
<script src="gym-sleep-check-logic.js"></script>
```

- [ ] **Step 2: Restructure `applyCheckinOverride()`**

In `gym.html`, replace the full function (currently lines 3527-3546):

```javascript
  function applyCheckinOverride(result, last, ex, stuck) {
    const dateKey = last.date.slice(0, 10);
    const checkin = state.checkins[dateKey];
    if (!checkin) return result;
    const { repMin, repMax, step } = ex;
    if (checkin.pain === 'high') {
      if (ex.bw) {
        return { type: 'hold', weight: 0, reps: repMin, tag: 'Pain — repeat', reason: 'Logged high pain last session. Repeat at ' + repMin + ' reps, don\'t push.', bw: true, stuck: stuck };
      }
      const { weight: dl, pct } = window.GymRxDeloadLogic.deloadWeight(last.weight, step, repMin);
      return { type: 'down', weight: dl, reps: repMax, tag: 'Pain — deload', reason: 'Logged high pain last session. Drop ' + pct + '%, reset, and reassess.', stuck: stuck };
    }
    if (checkin.recovery === 'low' && result.type === 'up') {
      if (ex.bw) {
        return { type: 'hold', weight: 0, reps: last.reps + 1, tag: 'Add a rep', reason: last.reps + ' reps — strong, but recovery was low last time. Hold the push, aim for ' + (last.reps + 1) + '.', bw: true, stuck: stuck };
      }
      return { type: 'hold', weight: last.weight, reps: last.reps + 1, tag: 'Add a rep', reason: last.reps + ' reps — solid, but recovery was low last time. Hold at ' + last.weight + unit() + ', push for ' + (last.reps + 1) + '.', stuck: stuck };
    }
    return result;
  }
```
with:
```javascript
  // Looks up the health:sleep entry (a separate page's localStorage key --
  // health.html, not gym.html's own state) submitted for the same day as
  // `last`. Same date-matching convention as state.checkins.
  function getSleepEntryForDate(dateKey) {
    try {
      const list = JSON.parse(localStorage.getItem('health:sleep') || '[]');
      return (Array.isArray(list) ? list : []).find(function (e) { return e && e.date === dateKey; }) || null;
    } catch (e) { return null; }
  }

  function applyCheckinOverride(result, last, ex, stuck) {
    const dateKey = last.date.slice(0, 10);
    const checkin = state.checkins[dateKey]; // may be undefined -- each branch below guards its own use
    const { repMin, repMax, step } = ex;
    if (checkin && checkin.pain === 'high') {
      if (ex.bw) {
        return { type: 'hold', weight: 0, reps: repMin, tag: 'Pain — repeat', reason: 'Logged high pain last session. Repeat at ' + repMin + ' reps, don\'t push.', bw: true, stuck: stuck };
      }
      const { weight: dl, pct } = window.GymRxDeloadLogic.deloadWeight(last.weight, step, repMin);
      return { type: 'down', weight: dl, reps: repMax, tag: 'Pain — deload', reason: 'Logged high pain last session. Drop ' + pct + '%, reset, and reassess.', stuck: stuck };
    }
    const recoveryLow = !!checkin && checkin.recovery === 'low';
    const sleepEntry = getSleepEntryForDate(dateKey);
    const sleepPoor = window.GymSleepCheckLogic ? window.GymSleepCheckLogic.isPoorSleepEntry(sleepEntry) : false;
    if ((recoveryLow || sleepPoor) && result.type === 'up') {
      const reasonSource = recoveryLow && sleepPoor
        ? 'recovery was low and sleep was short/poor last time'
        : recoveryLow
        ? 'recovery was low last time'
        : 'sleep was short/poor last night';
      if (ex.bw) {
        return { type: 'hold', weight: 0, reps: last.reps + 1, tag: 'Add a rep', reason: last.reps + ' reps — strong, but ' + reasonSource + '. Hold the push, aim for ' + (last.reps + 1) + '.', bw: true, stuck: stuck };
      }
      return { type: 'hold', weight: last.weight, reps: last.reps + 1, tag: 'Add a rep', reason: last.reps + ' reps — solid, but ' + reasonSource + '. Hold at ' + last.weight + unit() + ', push for ' + (last.reps + 1) + '.', stuck: stuck };
    }
    return result;
  }
```

Note: the function's leading comment (lines 3522-3526, just above the function) references the same pain/recovery design doc and stays accurate — it isn't part of either code block above so it's untouched, but if your editor shows it, leave it as-is (it still correctly describes the pain/recovery half of this function; the sleep addition is new enough that a doc-comment update isn't required by the design, which doesn't call for touching that comment).

- [ ] **Step 3: Run the sleep-check-logic selfcheck (regression check)**

Run: `node C:\Users\gregm\row\gym-sleep-check-logic.selfcheck.cjs`
Expected: `gym-sleep-check-logic.selfcheck.cjs: all assertions passed` (this task doesn't touch the pure module, just its caller).

- [ ] **Step 4: Run the other selfcheck suites (broader regression check)**

Run: `node C:\Users\gregm\row\gym-peak-phase-logic.selfcheck.cjs && node C:\Users\gregm\row\gym-volume-logic.selfcheck.cjs`
Expected: both print their own "all assertions passed" line — confirms this task's gym.html edit didn't disturb anything the peak-phase or volume-progression pure modules depend on (it doesn't touch either file, but this is a cheap confirmation given all three now share the same `getRx()`/`applyCheckinOverride()` neighborhood).

- [ ] **Step 5: Browser verification**

Open `gym.html`, sign in. In a separate tab, open `health.html` and log a sleep entry for today with hours `5` and quality left blank. Back in `gym.html`, pick an exercise that would normally show "Add weight" (last session hit the upgrade-rep threshold) and confirm it now shows the capped hold with reason text ending in "sleep was short/poor last night." Then also submit a pain/recovery check-in for today with `recovery: low` (via whatever UI path sets that) and confirm the reason text switches to "recovery was low and sleep was short/poor last time." Finally, clear both the sleep entry and the check-in for today and confirm the exercise's Rx returns to its normal, uncapped behavior (regression check).

- [ ] **Step 6: Commit**

```bash
git add gym.html
git commit -m "feat: applyCheckinOverride() caps an upgrade on poor same-day sleep, not just a low-recovery check-in"
```
