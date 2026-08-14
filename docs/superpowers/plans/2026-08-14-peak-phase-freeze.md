# Peak-Phase Freeze + Escalation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During Row's `peak` season phase, `getRx()` freezes at last session's exact weight/reps instead of suggesting autonomous weight/deload changes, and volume advisories are suppressed — per the approved design at `docs/superpowers/specs/2026-08-14-peak-phase-freeze-design.md`.

**Architecture:** A new pure module `gym-peak-phase-logic.js` (mirrors `gym-rx-deload-logic.js`'s exact convention) computes the frozen Rx decision. `getRx()` in `gym.html` checks `seasonPhase === 'peak'` right after `stuck`/`stuckAvgRir` are computed and, if true, returns the frozen result early — the same early-return shape the existing `bw` branch already uses, which is what makes the volume-advisory suppression fall out for free (that block sits after this new check, same as it already sits after the `bw` branch's return).

**Tech Stack:** Vanilla JS, no build step. Tests via `node gym-peak-phase-logic.selfcheck.cjs`.

---

### Task 1: `peakFreezeResult()` pure module

**Files:**
- Create: `C:\Users\gregm\row\gym-peak-phase-logic.js`
- Create: `C:\Users\gregm\row\gym-peak-phase-logic.selfcheck.cjs`

- [ ] **Step 1: Write the failing test**

Create `gym-peak-phase-logic.selfcheck.cjs`:

```javascript
// Run with: node gym-peak-phase-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-peak-phase-logic.js'), 'utf8'), sandbox);
const { peakFreezeResult } = sandbox.window.GymPeakPhaseLogic;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// peakFreezeResult — a weighted exercise freezes at last session's exact weight/reps.
const weightedResult = peakFreezeResult({ bw: false }, { weight: 185, reps: 8 }, 2);
assertEqual(weightedResult.type, 'hold', 'peakFreezeResult (weighted): type is hold');
assertEqual(weightedResult.weight, 185, 'peakFreezeResult (weighted): weight matches last session exactly');
assertEqual(weightedResult.reps, 8, 'peakFreezeResult (weighted): reps match last session exactly');
assertEqual(weightedResult.tag, 'Peak — hold', 'peakFreezeResult (weighted): tag is Peak — hold');
assertEqual(weightedResult.bw, undefined, 'peakFreezeResult (weighted): bw field is not set for a weighted exercise');
assertEqual(weightedResult.stuck, 2, 'peakFreezeResult (weighted): stuck count passes through unchanged');

// peakFreezeResult — a bodyweight exercise freezes at last session's exact reps, weight 0.
const bwResult = peakFreezeResult({ bw: true }, { weight: 0, reps: 12 }, 0);
assertEqual(bwResult.type, 'hold', 'peakFreezeResult (bw): type is hold');
assertEqual(bwResult.weight, 0, 'peakFreezeResult (bw): weight is 0');
assertEqual(bwResult.reps, 12, 'peakFreezeResult (bw): reps match last session exactly');
assertEqual(bwResult.bw, true, 'peakFreezeResult (bw): bw field is true');
assertEqual(bwResult.tag, 'Peak — hold', 'peakFreezeResult (bw): tag is Peak — hold');
assertEqual(bwResult.stuck, 0, 'peakFreezeResult (bw): stuck count passes through unchanged');

console.log('gym-peak-phase-logic.selfcheck.cjs: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node C:\Users\gregm\row\gym-peak-phase-logic.selfcheck.cjs`
Expected: FAIL — `gym-peak-phase-logic.js` doesn't exist yet (`Cannot find module` or file-read error).

- [ ] **Step 3: Write the implementation**

Create `gym-peak-phase-logic.js`:

```javascript
// gym-peak-phase-logic.js — pure peak-week freeze decision for getRx().
// Mirrors gym-rx-deload-logic.js's exact convention (no DOM, no Supabase,
// dual window/module.exports). See
// docs/superpowers/specs/2026-08-14-peak-phase-freeze-design.md.
(function () {
  'use strict';

  // ex: { bw, ... }. last: the most recent logged set ({ weight, reps }).
  // stuck: the caller's already-computed consecutive-same-weight/reps
  // streak, passed through unchanged (informational only -- it does not
  // drive this decision, unlike the normal load-progression branches).
  // Freezes at exactly last session's numbers -- no autonomous 'up'
  // (weight increase) or 'down'/stall-driven 'Reassess' during peak week.
  // Reason text is built by the caller (getRx()), which has unit() in
  // scope -- same split gym-rx-deload-logic.js's deloadWeight() already
  // uses (returns bare numbers, caller builds the sentence).
  function peakFreezeResult(ex, last, stuck) {
    if (ex.bw) {
      return { type: 'hold', weight: 0, reps: last.reps, tag: 'Peak — hold', bw: true, stuck: stuck };
    }
    return { type: 'hold', weight: last.weight, reps: last.reps, tag: 'Peak — hold', stuck: stuck };
  }

  var api = { peakFreezeResult: peakFreezeResult };
  if (typeof window !== 'undefined') window.GymPeakPhaseLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node C:\Users\gregm\row\gym-peak-phase-logic.selfcheck.cjs`
Expected: `gym-peak-phase-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add gym-peak-phase-logic.js gym-peak-phase-logic.selfcheck.cjs
git commit -m "feat: gym-peak-phase-logic.js -- pure peak-week freeze decision"
```

---

### Task 2: Load the script and wire the freeze into `getRx()`

**Files:**
- Modify: `C:\Users\gregm\row\gym.html:6539-6543` (script tags)
- Modify: `C:\Users\gregm\row\gym.html:3451-3452` (`getRx()`)

- [ ] **Step 1: Add the script tag**

In `gym.html`, change (currently lines 6539-6540):

```html
<script src="gym-rx-phase-logic.js"></script>
<script src="gym-rx-deload-logic.js"></script>
```
to:
```html
<script src="gym-rx-phase-logic.js"></script>
<script src="gym-rx-deload-logic.js"></script>
<script src="gym-peak-phase-logic.js"></script>
```

- [ ] **Step 2: Short-circuit `getRx()` for the peak phase**

In `gym.html`, change (currently lines 3451-3452):

```javascript
    const stuckAvgRir = stuckRirs.length ? stuckRirs.reduce((a, b) => a + b, 0) / stuckRirs.length : null;
    if (bw) {
```
to:
```javascript
    const stuckAvgRir = stuckRirs.length ? stuckRirs.reduce((a, b) => a + b, 0) / stuckRirs.length : null;
    if (seasonPhase === 'peak') {
      const frozen = window.GymPeakPhaseLogic
        ? window.GymPeakPhaseLogic.peakFreezeResult(ex, last, stuck)
        : { type: 'hold', weight: bw ? 0 : weight, reps: reps, tag: 'Peak — hold', bw: bw, stuck: stuck };
      frozen.reason = bw
        ? 'Peak week: holding at ' + last.reps + ' reps, no autonomous changes. Flag anything off (pain, unusual fatigue, missed lifts) to your coach directly.'
        : 'Peak week: holding at ' + last.weight + unit() + ' \u00d7 ' + last.reps + ', no autonomous changes. Flag anything off (pain, unusual fatigue, missed lifts) to your coach directly.';
      return applyCheckinOverride(frozen, last, ex, stuck);
    }
    if (bw) {
```

Note: the fallback branch (when `window.GymPeakPhaseLogic` is undefined, matching this codebase's existing defensive `window.X ? ... : ...` pattern) sets `bw: bw` even for a non-bw exercise, where `bw` is `false` — this is harmless since every other branch of `getRx()` only checks truthiness of a result's `bw` field, never its exact value, and `false` is falsy just like `undefined`.

- [ ] **Step 3: Run the peak-phase-logic selfcheck (regression check)**

Run: `node C:\Users\gregm\row\gym-peak-phase-logic.selfcheck.cjs`
Expected: `gym-peak-phase-logic.selfcheck.cjs: all assertions passed` (this task doesn't touch the pure module, just its caller — re-running confirms nothing broke).

- [ ] **Step 4: Browser verification**

Open `gym.html`, sign in. In DevTools console, set peak phase: `localStorage.setItem('po_coach_season', JSON.stringify({ phase: 'peak', startDate: new Date().toISOString().slice(0,10) }))`, reload. Pick an exercise that would normally show "Add weight" (last session hit the upgrade-rep threshold) or "Deload" (a real stall pattern in its log history) — confirm its Rx card now shows "Peak — hold" at exactly last session's weight/reps, with the coach-escalation reason text, and no volume-advisory line even if one would normally appear. Then log a high-pain check-in for today (`checkins[today] = { pain: 'high' }` via whatever UI path sets that, or directly via localStorage for a quick check) and confirm the same exercise's Rx now shows the existing pain-deload override instead of the frozen hold — proving the safety exception still fires through the freeze. Finally, switch the season back to a non-peak phase (e.g. `growth`) and confirm the exercise returns to normal Rx behavior (regression check — nothing about growth/cut/reverse_diet changed).

- [ ] **Step 5: Commit**

```bash
git add gym.html
git commit -m "feat: peak phase freezes getRx() at last session's numbers, suppresses volume advisories, keeps pain-safety override active"
```
