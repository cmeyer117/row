# Per-exercise Rx Outcome Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically classify every real logged set against what `getRx()` would have suggested, and auto-resolve the previous exposure's classification into a verdict — recorded as rows in the shared `decisions` table, with zero new UI.

**Architecture:** One new pure-logic file (`exercise-rx-tracking.js`, matching Row's `gym-*-logic.js` convention), one new query helper added to `decisions.js`, a one-line change to `getRx()` to expose its already-computed `stalled` flag, and a wiring block inside `saveSet()` in `gym.html`.

**Tech Stack:** Plain browser JS (no build step), Supabase JS v2 (CDN), Node `assert`-based self-check scripts (Row's existing test convention, no framework).

---

### Task 1: Expose `stalled` on `getRx()`'s return value

**Files:**
- Modify: `C:\Users\gregm\row\gym.html:3838`

- [ ] **Step 1: Make the one-line change**

`getRx()` already computes a local `stalled` boolean at line 3837 (`const stalled = result.type === 'down' || result.tag === 'Reassess';`) but never attaches it to the object it returns. Add one line right after the existing line 3838:

```js
    const finalResult = applyCheckinOverride(result, last, ex, stuck);
    finalResult.stalled = stalled;
```

This is additive only — every existing consumer of `getRx()`'s return value is unaffected, since nothing reads `.stalled` today. The `bw` branch (line ~3807) and the peak-phase branch (line ~3794) are deliberately NOT touched — per the design spec's Non-goals, bodyweight exercises and peak-phase-frozen exposures are excluded from Rx-outcome tracking entirely, and Task 5's wiring uses the presence of `.stalled` (`typeof rx.stalled === 'boolean'`) as the gate to skip those branches automatically.

- [ ] **Step 2: Manual verification**

Open `gym.html` in a browser (or via the `run` skill), select any non-bodyweight tracked exercise with at least one logged set, and in the browser console run:

```js
getRx(getCurrentEx(), state.logs[getCurrentEx().id])
```

Expected: the returned object now includes a `stalled: true` or `stalled: false` key alongside the existing `type`/`weight`/`reps`/`tag`/`reason` keys.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "feat(rx): expose stalled flag on getRx()'s return value

One-line addition, no existing behavior changed -- prerequisite for
per-exercise Rx outcome tracking (see docs/superpowers/specs/2026-09-15-exercise-rx-outcome-tracking-design.md).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `classifyRxOutcome()` — pure classification logic

**Files:**
- Create: `C:\Users\gregm\row\exercise-rx-tracking.js`
- Create: `C:\Users\gregm\row\exercise-rx-tracking.selfcheck.cjs`

- [ ] **Step 1: Write the failing self-check**

Create `exercise-rx-tracking.selfcheck.cjs`:

```js
// Run with: node exercise-rx-tracking.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'exercise-rx-tracking.js'), 'utf8'), sandbox);
const { classifyRxOutcome } = sandbox.window.ExerciseRxTracking;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// classifyRxOutcome(rx, actual, priorWeight) -- priorWeight is the weight
// logged in the exposure BEFORE this one (what getRx() based its
// suggestion on), needed to tell "moved less than suggested" (edited) apart
// from "didn't move at all" (rejected) -- rx.weight alone can't distinguish
// those two cases.

// --- classifyRxOutcome: 'up' rx, priorWeight 100 ---
assertEqual(
  classifyRxOutcome({ type: 'up', weight: 105, reps: 5 }, { weight: 105, reps: 5 }, 100),
  'accepted',
  "up rx: logging exactly the suggested weight/reps is accepted"
);
assertEqual(
  classifyRxOutcome({ type: 'up', weight: 105, reps: 5 }, { weight: 102, reps: 5 }, 100),
  'edited',
  "up rx: logging a smaller increase than suggested (but still up from priorWeight) is edited"
);
assertEqual(
  classifyRxOutcome({ type: 'up', weight: 105, reps: 5 }, { weight: 100, reps: 5 }, 100),
  'rejected',
  "up rx: holding at priorWeight instead of adding is rejected"
);
assertEqual(
  classifyRxOutcome({ type: 'up', weight: 105, reps: 5 }, { weight: 95, reps: 5 }, 100),
  'rejected',
  "up rx: dropping below priorWeight when rx said add is rejected"
);

// --- classifyRxOutcome: 'down' rx (deload), priorWeight 100 ---
assertEqual(
  classifyRxOutcome({ type: 'down', weight: 90, reps: 8 }, { weight: 90, reps: 8 }, 100),
  'accepted',
  "down rx: logging exactly the suggested deload weight/reps is accepted"
);
assertEqual(
  classifyRxOutcome({ type: 'down', weight: 90, reps: 8 }, { weight: 95, reps: 8 }, 100),
  'edited',
  "down rx: logging a smaller deload than suggested (but still down from priorWeight) is edited"
);
assertEqual(
  classifyRxOutcome({ type: 'down', weight: 90, reps: 8 }, { weight: 100, reps: 8 }, 100),
  'rejected',
  "down rx: holding at priorWeight instead of deloading is rejected"
);
assertEqual(
  classifyRxOutcome({ type: 'down', weight: 90, reps: 8 }, { weight: 105, reps: 8 }, 100),
  'rejected',
  "down rx: adding weight above priorWeight when rx said deload is rejected"
);

// --- classifyRxOutcome: 'hold' rx, priorWeight 100 ---
assertEqual(
  classifyRxOutcome({ type: 'hold', weight: 100, reps: 7 }, { weight: 100, reps: 7 }, 100),
  'accepted',
  "hold rx: logging exactly the suggested weight/reps is accepted"
);
assertEqual(
  classifyRxOutcome({ type: 'hold', weight: 100, reps: 7 }, { weight: 100, reps: 6 }, 100),
  'edited',
  "hold rx: same weight, different reps than suggested is edited (not a direction change)"
);
assertEqual(
  classifyRxOutcome({ type: 'hold', weight: 100, reps: 7 }, { weight: 105, reps: 7 }, 100),
  'edited',
  "hold rx: a 'hold' has no up/down direction to contradict, so any deviation is edited, never rejected"
);

console.log('exercise-rx-tracking.selfcheck.cjs: all classifyRxOutcome cases passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd C:\Users\gregm\row && node exercise-rx-tracking.selfcheck.cjs`
Expected: FAIL — `exercise-rx-tracking.js` does not exist yet, so `require`/`fs.readFileSync` throws `ENOENT`.

- [ ] **Step 3: Write `exercise-rx-tracking.js`**

```js
// =============================================================
// Per-exercise Rx outcome tracking -- classifies a logged set
// against what getRx() would have suggested, and resolves the
// PRIOR exposure's classification into a verdict using this
// exposure's stalled signal. Pure logic, no DOM, no Supabase --
// see docs/superpowers/specs/2026-09-15-exercise-rx-outcome-tracking-design.md.
// =============================================================
(function () {
  'use strict';

  // rx: { type: 'up'|'hold'|'down', weight, reps } -- getRx()'s suggestion.
  // actual: { weight, reps } -- what was actually logged.
  // priorWeight: the weight logged in the exposure BEFORE this one (what
  // getRx() based its suggestion on) -- rx.weight alone can't distinguish
  // "moved less than suggested" (edited) from "didn't move at all"
  // (rejected), since both differ from rx.weight the same way.
  function classifyRxOutcome(rx, actual, priorWeight) {
    if (rx.weight === actual.weight && rx.reps === actual.reps) return 'accepted';
    if (rx.type === 'up') return actual.weight > priorWeight ? 'edited' : 'rejected';
    if (rx.type === 'down') return actual.weight < priorWeight ? 'edited' : 'rejected';
    // 'hold' has no up/down direction to contradict -- any deviation is edited.
    return 'edited';
  }

  // priorClassification: 'accepted' | 'edited' | 'rejected' -- the PRIOR
  // exposure's classification. nextRxStalled: getRx()'s stalled boolean
  // computed for THIS (the new) exposure.
  function resolvePriorRxDecision(priorClassification, nextRxStalled) {
    const followed = priorClassification === 'accepted' || priorClassification === 'edited';
    if (followed) return nextRxStalled ? 'wrong' : 'worked';
    return nextRxStalled ? 'inconclusive' : 'partly_worked';
  }

  window.ExerciseRxTracking = {
    classifyRxOutcome: classifyRxOutcome,
    resolvePriorRxDecision: resolvePriorRxDecision,
  };
})();
```

- [ ] **Step 4: Run the self-check again**

Run: `cd C:\Users\gregm\row && node exercise-rx-tracking.selfcheck.cjs`
Expected: `exercise-rx-tracking.selfcheck.cjs: all classifyRxOutcome cases passed`

- [ ] **Step 5: Commit**

```bash
cd C:\Users\gregm\row
git add exercise-rx-tracking.js exercise-rx-tracking.selfcheck.cjs
git commit -m "feat(rx): add classifyRxOutcome pure function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `resolvePriorRxDecision()` — verdict resolution self-check coverage

**Files:**
- Modify: `C:\Users\gregm\row\exercise-rx-tracking.selfcheck.cjs`

(The function itself was already written in Task 2's Step 3 alongside `classifyRxOutcome` — this task adds its test coverage, kept separate so each self-check addition stays reviewable as its own diff.)

- [ ] **Step 1: Add the failing assertions**

Insert before the final `console.log` line in `exercise-rx-tracking.selfcheck.cjs`, and change that line's text (it currently only names `classifyRxOutcome`) to `console.log('exercise-rx-tracking.selfcheck.cjs: all classifyRxOutcome and resolvePriorRxDecision cases passed');`:

```js
const { resolvePriorRxDecision } = sandbox.window.ExerciseRxTracking;

// --- resolvePriorRxDecision ---
assertEqual(
  resolvePriorRxDecision('accepted', false),
  'worked',
  "accepted + not stalled next time = worked"
);
assertEqual(
  resolvePriorRxDecision('edited', false),
  'worked',
  "edited + not stalled next time = worked"
);
assertEqual(
  resolvePriorRxDecision('accepted', true),
  'wrong',
  "accepted + stalled next time = wrong"
);
assertEqual(
  resolvePriorRxDecision('edited', true),
  'wrong',
  "edited + stalled next time = wrong"
);
assertEqual(
  resolvePriorRxDecision('rejected', false),
  'partly_worked',
  "rejected (Carl's own call) + not stalled = partly_worked"
);
assertEqual(
  resolvePriorRxDecision('rejected', true),
  'inconclusive',
  "rejected + stalled = inconclusive, no causation claimed"
);
```

- [ ] **Step 2: Run and confirm all pass**

Run: `cd C:\Users\gregm\row && node exercise-rx-tracking.selfcheck.cjs`
Expected: `exercise-rx-tracking.selfcheck.cjs: all classifyRxOutcome and resolvePriorRxDecision cases passed` with no FAIL lines above it (`resolvePriorRxDecision` was implemented in Task 2, so these should pass immediately — if any fails, fix `resolvePriorRxDecision` in `exercise-rx-tracking.js` to match the design spec's table exactly, not the test).

- [ ] **Step 3: Commit**

```bash
cd C:\Users\gregm\row
git add exercise-rx-tracking.selfcheck.cjs
git commit -m "test(rx): cover resolvePriorRxDecision's four verdict cases

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Add `getOpenDecisionForExercise()` to `decisions.js`

**Files:**
- Modify: `C:\Users\gregm\row\decisions.js:53` (insert a new function after `getOpenDueDecision`)

No test file exists for `decisions.js` today (it has zero existing coverage — verified via `find`/`grep` before this plan was written). This task does not add one; the new function is verified via Task 5's manual smoke test, consistent with the design spec's own testing scope ("no live-browser verification needed for the pure logic ... a manual smoke test ... covers the saveSet() integration").

- [ ] **Step 1: Add the function**

Insert immediately after the existing `getOpenDueDecision` function (after line 53, before the `getLatestOpenDecision` comment on line 55):

```js
  // Returns the most recent OPEN decision for a specific exercise within a
  // category, filtering the JSONB details column -- distinct from
  // getOpenDueDecision/getLatestOpenDecision, which only filter by category
  // and are keyed to the single-row-per-category weekly-coach-loop shape.
  // exercise-rx has many concurrent open rows (one per tracked exercise),
  // so this scopes down to exactly one exercise's most recent open row.
  window.getOpenDecisionForExercise = function (category, exerciseId) {
    if (!window.supabase) return Promise.reject(new Error('supabase-js not loaded'));
    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supa.from('decisions')
      .select('*')
      .eq('app', 'row')
      .eq('category', category)
      .eq('status', 'open')
      .eq('details->>exerciseId', exerciseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(function (res) {
        if (res.error) throw new Error('getOpenDecisionForExercise failed: ' + res.error.message);
        return res.data && res.data[0] ? res.data[0] : null;
      });
  };
```

- [ ] **Step 2: Manual verification**

This can't be verified in isolation without a live Supabase row. Verification happens as part of Task 5's smoke test. Proceed directly to commit.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\gregm\row
git add decisions.js
git commit -m "feat(decisions): add getOpenDecisionForExercise query helper

Filters the shared decisions table by details->>exerciseId, for
categories (like exercise-rx) with many concurrent open rows rather
than the single-row-per-category shape getOpenDueDecision assumes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire into `saveSet()` and load the new scripts in `gym.html`

**Files:**
- Modify: `C:\Users\gregm\row\gym.html:16` (add `decisions.js` script tag)
- Modify: `C:\Users\gregm\row\gym.html:7712` (add `exercise-rx-tracking.js` script tag, alongside the other `gym-*-logic.js` tags)
- Modify: `C:\Users\gregm\row\gym.html:6798-6854` (`saveSet()` function body)

- [ ] **Step 1: Add the two script tags**

`gym.html` does not currently load `decisions.js` at all (only `weekly-review.html` does). Add it right after the Supabase CDN script, matching `weekly-review.html`'s own script order:

At `gym.html:16`, change:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="sync.js" defer></script>
```
to:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="decisions.js"></script>
<script src="sync.js" defer></script>
```

At `gym.html:7712` (immediately after the existing `gym-volume-logic.js` tag), add:
```html
<script src="gym-volume-logic.js"></script>
<script src="exercise-rx-tracking.js"></script>
```

- [ ] **Step 2: Wire `saveSet()`**

In `gym.html`, inside `saveSet()` (currently lines 6798-6854), the relevant existing lines are:

```js
    const arr = state.logs[ex.id] || [];
    const priorLogs = arr.slice();
```

These are the existing lines 6810-6811 — do not duplicate them, insert after.

Immediately after the existing `const priorLogs = arr.slice();` line (line 6811) and before the existing `weightBasis`/`outlier` computation that follows it, insert:

```js
    // Per-exercise Rx outcome tracking -- fire-and-forget, must never block
    // or fail the actual logging flow. See
    // docs/superpowers/specs/2026-09-15-exercise-rx-outcome-tracking-design.md.
    if (window.ExerciseRxTracking && window.getOpenDecisionForExercise && window.recordDecision && window.closeDecision) {
      try {
        const rxForTracking = getRx(ex, priorLogs);
        if (rxForTracking && typeof rxForTracking.stalled === 'boolean') {
          // priorLogs.length > 0 is guaranteed here -- getRx() returns null
          // (via its own `if (!logs.length) return null` guard) when there's
          // no prior exposure, which the outer `if` above already excludes.
          const priorWeightForTracking = priorLogs[priorLogs.length - 1].weight;
          window.getOpenDecisionForExercise('exercise-rx', ex.id).then(function (prior) {
            if (prior) {
              const verdict = window.ExerciseRxTracking.resolvePriorRxDecision(
                prior.details.classification,
                rxForTracking.stalled
              );
              window.closeDecision(prior.id, verdict, null).catch(function (err) {
                console.error('[exercise-rx-tracking] closeDecision failed', err);
              });
            }
            const classification = window.ExerciseRxTracking.classifyRxOutcome(
              { type: rxForTracking.type, weight: rxForTracking.weight, reps: rxForTracking.reps },
              { weight: w, reps: reps },
              priorWeightForTracking
            );
            window.recordDecision({
              category: 'exercise-rx',
              decision_text: ex.name + ': ' + rxForTracking.tag,
              details: {
                exerciseId: ex.id,
                exerciseName: ex.name,
                rxType: rxForTracking.type,
                rxWeight: rxForTracking.weight,
                rxReps: rxForTracking.reps,
                actualWeight: w,
                actualReps: reps,
                classification: classification,
              },
            }).catch(function (err) {
              console.error('[exercise-rx-tracking] recordDecision failed', err);
            });
          }).catch(function (err) {
            console.error('[exercise-rx-tracking] getOpenDecisionForExercise failed', err);
          });
        }
      } catch (err) {
        console.error('[exercise-rx-tracking] tracking block failed', err);
      }
    }
```

This block:
- Guards on all four globals existing (defensive against script-load ordering issues, matches the codebase's existing `window.GymVolumeLogic &&` style guards elsewhere in `getRx()`).
- Recomputes `getRx(ex, priorLogs)` deliberately rather than reusing any cached Rx, since `priorLogs` here is the exact pre-this-set log list `saveSet()` already has in scope — this IS "what Row would have suggested right before this set."
- Gates on `typeof rxForTracking.stalled === 'boolean'` — Task 1 only sets `.stalled` on the main (non-bw, non-peak) branch, so this single check correctly skips bodyweight exercises and peak-phase-frozen exposures per the design's Non-goals, with no separate `ex.bw`/season-phase check needed.
- Resolves the PRIOR open decision (if any) before recording the new one, matching the spec's "look up the most recent open decision, resolve it, then classify and record this exposure" order.
- Never awaits or blocks — every promise has a `.catch()` that only logs, so a Supabase failure here can never prevent the real set from being logged and saved (`saveSet()`'s existing `saveState(); renderAll();` calls later in the function are completely unaffected).

- [ ] **Step 3: Manual smoke test**

Start Row locally (use the `run` skill, or `npx serve` at repo root per the repo's own convention seen in prior sessions' verification steps). In the browser:

1. Open a tracked, non-bodyweight exercise with existing logged sets, not in a peak-phase season.
2. Log a new set.
3. Open the browser console and query Supabase directly (or check the Network tab for the `decisions` POST): confirm one new row with `category: 'exercise-rx'`, `details.exerciseId` matching the exercise, `status: 'open'`.
4. Log a second set for the SAME exercise.
5. Confirm: the row from step 3 now has `status: 'reviewed'` and a `verdict` set, AND a new second row exists with `status: 'open'` for this second exposure.

Expected: exactly this sequence. If step 3's row never appears, check the browser console for one of the three `[exercise-rx-tracking]` error logs added in Step 2 to localize the failure (script load order, missing global, or a Supabase error) before treating this step as done.

- [ ] **Step 4: Run the full existing test suite**

Run: `cd C:\Users\gregm\row && npm test` (or the repo's documented test command — check `package.json`'s `scripts.test` if unsure)
Expected: all existing tests still pass — this task did not modify any function with existing test coverage (Task 1's one-line addition to `getRx()` has no existing test asserting on its return shape's exact key set).

- [ ] **Step 5: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "feat(rx): wire exercise-rx outcome tracking into saveSet()

Every real logged set (main Log button only -- quickLog/ghost-tap are
a deliberate v0 gap) now gets classified against getRx()'s suggestion
and recorded to the shared decisions table; the prior exposure's
decision auto-resolves into a verdict at the same time. Fire-and-forget
throughout -- a Supabase failure here can never block real logging.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Push and update the spec's status

**Files:**
- Modify: `C:\Users\gregm\row\docs\superpowers\specs\2026-09-15-exercise-rx-outcome-tracking-design.md:4`

- [ ] **Step 1: Mark the spec implemented**

Change line 4 from:
```
**Status:** Approved in brainstorming, pending spec review
```
to:
```
**Status:** Implemented 2026-09-15.
```

- [ ] **Step 2: Commit and push everything**

```bash
cd C:\Users\gregm\row
git add docs/superpowers/specs/2026-09-15-exercise-rx-outcome-tracking-design.md
git commit -m "docs: mark exercise-rx-outcome-tracking spec implemented

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: Confirm the push landed**

Run: `git log origin/main..HEAD --oneline`
Expected: no output (local and origin match — everything from Tasks 1-6 is now live on `main`).
