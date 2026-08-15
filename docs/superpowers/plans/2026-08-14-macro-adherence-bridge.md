# Macro-Adherence Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `applyCheckinOverride()` caps a suggested weight increase when yesterday's macro log (queried live from `food_log`) shows calories or protein meaningfully under target, joining the existing recovery/sleep signals — per the approved design at `docs/superpowers/specs/2026-08-14-macro-adherence-bridge-design.md`.

**Architecture:** `macro-calc.js` gains one pure function, `isPoorMacroAdherence(consumed, targets)`. `gym.html` loads that module for the first time, adds a one-time async prefetch (queries `food_log` for yesterday, computes `remainingBudget`, classifies adherence into a module-level cache) run alongside the existing `pcInitCloudSync` init, and `applyCheckinOverride()` reads that cache synchronously. The reason-text builder changes from a 2-way ternary to an array-join so it scales past 2 signals.

**Tech Stack:** Vanilla JS, no build step. `food_log` requires an authenticated Supabase session (confirmed live: `owner full access to food_log` policy, `authenticated` role only) — a plain `createClient()` call picks up the already-persisted session from localStorage, same as every other authenticated client this session already relies on.

---

### Task 1: `isPoorMacroAdherence()` in `macro-calc.js`

**Files:**
- Modify: `C:\Users\gregm\row\macro-calc.js` (add function + export)
- Modify: `C:\Users\gregm\row\macro-calc.selfcheck.cjs` (add tests)

- [ ] **Step 1: Write the failing tests**

In `macro-calc.selfcheck.cjs`, add these cases anywhere after the existing `remainingBudget` tests (find them by searching for `remainingBudget(` in the file, then append after that block):

```javascript
// isPoorMacroAdherence — both calories and protein at/above target: not poor.
assertEqual(isPoorMacroAdherence({ protein_g: 280, carb_g: 397, fat_g: 58, calories: 3201 }, { proteinG: 280, carbG: 397, fatG: 58, calories: 3201 }), false, 'isPoorMacroAdherence: exactly at target is not poor');

// isPoorMacroAdherence — calories under 80% of target: poor.
assertEqual(isPoorMacroAdherence({ protein_g: 280, carb_g: 397, fat_g: 58, calories: 2000 }, { proteinG: 280, carbG: 397, fatG: 58, calories: 3201 }), true, 'isPoorMacroAdherence: calories under 80% of target is poor');

// isPoorMacroAdherence — protein under 80% of target: poor.
assertEqual(isPoorMacroAdherence({ protein_g: 150, carb_g: 397, fat_g: 58, calories: 3201 }, { proteinG: 280, carbG: 397, fatG: 58, calories: 3201 }), true, 'isPoorMacroAdherence: protein under 80% of target is poor');

// isPoorMacroAdherence — both calories and protein under 80%: still poor (not double-counted, just true).
assertEqual(isPoorMacroAdherence({ protein_g: 100, carb_g: 397, fat_g: 58, calories: 1800 }, { proteinG: 280, carbG: 397, fatG: 58, calories: 3201 }), true, 'isPoorMacroAdherence: both under 80% is poor');

// isPoorMacroAdherence — carb/fat shortfall alone (calories/protein fine) does NOT trigger it.
assertEqual(isPoorMacroAdherence({ protein_g: 280, carb_g: 50, fat_g: 10, calories: 3201 }, { proteinG: 280, carbG: 397, fatG: 58, calories: 3201 }), false, 'isPoorMacroAdherence: carb/fat shortfall alone does not trigger poor');

// isPoorMacroAdherence — missing consumed or targets returns false, doesn't throw.
assertEqual(isPoorMacroAdherence(null, { proteinG: 280, carbG: 397, fatG: 58, calories: 3201 }), false, 'isPoorMacroAdherence: null consumed is not poor');
assertEqual(isPoorMacroAdherence({ protein_g: 280, carb_g: 397, fat_g: 58, calories: 3201 }, null), false, 'isPoorMacroAdherence: null targets is not poor');
```

Also add `isPoorMacroAdherence` to the destructured import at the top of the file (currently line 19):

```javascript
const { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData, sumIngredients, dedupeByRecency, rankByFrequency, rankByFrecency, isPoorMacroAdherence } = sandbox.window.MacroCalc;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node C:\Users\gregm\row\macro-calc.selfcheck.cjs`
Expected: FAIL — `isPoorMacroAdherence is not a function` (or `TypeError: isPoorMacroAdherence is not defined`), since it doesn't exist in `macro-calc.js` yet.

- [ ] **Step 3: Write the implementation**

In `macro-calc.js`, add this function directly after `remainingBudget` (currently ending at line 105, right before the `sumIngredients` comment block):

```javascript
  // consumed: { protein_g, carb_g, fat_g, calories } (remainingBudget(...).consumed).
  // targets: { proteinG, carbG, fatG, calories }. Poor adherence = calories
  // or protein fell meaningfully short (< 80%) of target -- these two drive
  // training performance/recovery most directly; a carb/fat gap alone
  // (calories/protein still on target) does not trigger this on its own.
  function isPoorMacroAdherence(consumed, targets) {
    if (!consumed || !targets) return false;
    const calLow = (targets.calories || 0) > 0 && consumed.calories < 0.8 * targets.calories;
    const proteinLow = (targets.proteinG || 0) > 0 && consumed.protein_g < 0.8 * targets.proteinG;
    return calLow || proteinLow;
  }
```

Then add it to the exported `api` object (currently line 218):

```javascript
  const api = { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData, sumIngredients, dedupeByRecency, rankByFrequency, rankByFrecency, isPoorMacroAdherence };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node C:\Users\gregm\row\macro-calc.selfcheck.cjs`
Expected: `macro-calc.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add macro-calc.js macro-calc.selfcheck.cjs
git commit -m "feat: isPoorMacroAdherence() -- calories/protein-under-80%-of-target predicate"
```

---

### Task 2: Wire the prefetch and the third signal into `gym.html`

**Files:**
- Modify: `C:\Users\gregm\row\gym.html:6578` (script tags — add `macro-calc.js`)
- Modify: `C:\Users\gregm\row\gym.html:7101` (new prefetch IIFE, after `pcInitCloudSync`)
- Modify: `C:\Users\gregm\row\gym.html:3539-3568` (`applyCheckinOverride`)

- [ ] **Step 1: Load `macro-calc.js`**

In `gym.html`, change (currently line 6578):

```html
<script src="gym-volume-logic.js"></script>
```
to:
```html
<script src="gym-volume-logic.js"></script>
<script src="macro-calc.js"></script>
```

- [ ] **Step 2: Add the module-level cache variable**

In `gym.html`, change (currently line 6645):

```javascript
  let pcAccessToken = null;
```
to:
```javascript
  let pcAccessToken = null;
  // Cached result of the one-time macro-adherence prefetch below -- null
  // means "no data yet, or nothing to classify" (query hasn't resolved,
  // not signed in, no target set, or zero food_log rows yesterday), true/
  // false is a real classification. applyCheckinOverride() reads this
  // synchronously; it is never awaited directly.
  let macroAdherencePoor = null;
```

- [ ] **Step 3: Add the prefetch IIFE**

In `gym.html`, change (currently ending at line 7101-7103):

```javascript
      .subscribe();
  })();

  document.addEventListener('focusout', () => {
```
to:
```javascript
      .subscribe();
  })();

  // One-time macro-adherence prefetch. Queries yesterday's food_log (not
  // today's -- today's log is still accumulating during the day, which
  // would show a misleadingly large "remaining" gap for anyone training
  // before their meals are logged). Zero rows for yesterday is treated as
  // "no data" (most likely the app just wasn't used that day), not "poor" --
  // leaves macroAdherencePoor at null rather than falsely flagging it.
  (async function prefetchMacroAdherence() {
    if (!window.supabase || !window.MacroCalc) return;
    try {
      const targets = JSON.parse(localStorage.getItem('macro_targets') || 'null');
      if (!targets) return;
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
      const { data, error } = await client.from('food_log').select('*').eq('log_date', yesterdayKey);
      if (error || !data || data.length === 0) return;
      const { consumed } = window.MacroCalc.remainingBudget(targets, data);
      macroAdherencePoor = window.MacroCalc.isPoorMacroAdherence(consumed, targets);
    } catch (e) { /* macroAdherencePoor stays null */ }
  })();

  document.addEventListener('focusout', () => {
```

- [ ] **Step 4: Extend `applyCheckinOverride()` with the third signal**

In `gym.html`, replace the full function (currently lines 3539-3568, `applyCheckinOverride` through its closing brace — read the file first to confirm the exact current end of the function, since line numbers may have shifted slightly from earlier edits this session):

```javascript
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
    if (result.type === 'up') {
      // Sleep lookup only runs when it could actually matter -- no point
      // parsing health:sleep on a 'hold'/'down' result that this branch
      // never touches.
      const sleepEntry = getSleepEntryForDate(dateKey);
      const sleepPoor = window.GymSleepCheckLogic ? window.GymSleepCheckLogic.isPoorSleepEntry(sleepEntry) : false;
      if (recoveryLow || sleepPoor) {
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
    }
```

with:

```javascript
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
    if (result.type === 'up') {
      // Sleep lookup only runs when it could actually matter -- no point
      // parsing health:sleep on a 'hold'/'down' result that this branch
      // never touches. macroAdherencePoor is already a cached boolean/null
      // from the page-load prefetch above -- no lookup cost here at all.
      const sleepEntry = getSleepEntryForDate(dateKey);
      const sleepPoor = window.GymSleepCheckLogic ? window.GymSleepCheckLogic.isPoorSleepEntry(sleepEntry) : false;
      if (recoveryLow || sleepPoor || macroAdherencePoor) {
        const reasons = [];
        if (recoveryLow) reasons.push('recovery was low last time');
        if (sleepPoor) reasons.push('sleep was short/poor last night');
        if (macroAdherencePoor) reasons.push('macros were under target yesterday');
        const reasonSource = reasons.join(' and ');
        if (ex.bw) {
          return { type: 'hold', weight: 0, reps: last.reps + 1, tag: 'Add a rep', reason: last.reps + ' reps — strong, but ' + reasonSource + '. Hold the push, aim for ' + (last.reps + 1) + '.', bw: true, stuck: stuck };
        }
        return { type: 'hold', weight: last.weight, reps: last.reps + 1, tag: 'Add a rep', reason: last.reps + ' reps — solid, but ' + reasonSource + '. Hold at ' + last.weight + unit() + ', push for ' + (last.reps + 1) + '.', stuck: stuck };
      }
    }
```

- [ ] **Step 5: Run regression checks**

Run: `node C:\Users\gregm\row\gym-sleep-check-logic.selfcheck.cjs && node C:\Users\gregm\row\gym-peak-phase-logic.selfcheck.cjs && node C:\Users\gregm\row\gym-volume-logic.selfcheck.cjs && node C:\Users\gregm\row\macro-calc.selfcheck.cjs`
Expected: all four print their own "all assertions passed" line.

- [ ] **Step 6: Browser verification**

Open `gym.html`, sign in, wait a few seconds for the prefetch to resolve. In DevTools console, check `macroAdherencePoor`'s value isn't accessible directly (it's inside a closure) — instead, verify indirectly: if you have real `food_log` rows for yesterday, pick an exercise that would normally show "Add weight" and check whether its Rx now mentions macros (only fires if yesterday's totals were genuinely under 80% of target). To force a deterministic test, temporarily insert a row into `food_log` via the Supabase dashboard for yesterday's date with low `calories`/`protein_g` values (e.g. `calories: 800, protein_g: 20`), reload `gym.html`, and confirm the capped Rx now appears with reason text including "macros were under target yesterday" — then delete that test row afterward so it doesn't pollute real tracking data. Confirm a day with zero `food_log` rows yesterday (the normal case before this test) behaves exactly as before (no macro-driven cap). Confirm the existing sleep-only and recovery-only test cases from the sleep bridge still produce their original single-reason wording (regression check on the reason-array refactor) — e.g. sleep-only should read "...but sleep was short/poor last night...", not "...but sleep was short/poor last night and...".

- [ ] **Step 7: Commit**

```bash
git add gym.html
git commit -m "feat: macro-adherence bridge -- applyCheckinOverride() caps an upgrade on poor macro adherence too"
```
