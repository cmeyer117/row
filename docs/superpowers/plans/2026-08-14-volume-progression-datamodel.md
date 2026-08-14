# Volume-Progression Data-Model Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `gym-volume-logic.js`'s per-muscle weekly volume counting from "every logged set, primary muscle only, static bands" to "hard sets only (RIR-gated), primary + weighted secondary muscle, phase-adjusted targets" — per the approved design at `docs/superpowers/specs/2026-08-14-volume-progression-datamodel-design.md`.

**Architecture:** All logic changes live in the existing `gym-volume-logic.js` module. `weeklySetsByMuscle()` is rewritten in place (same name/signature). `classifyMuscleVolume()` and `volumeAdvisory()` gain an optional trailing `phase` parameter — when omitted (`undefined`), both behave exactly as they do today, so every existing 2-argument call and test stays valid with zero changes; new behavior is purely additive. `gym.html`'s two existing call sites are updated to pass phase through.

**Tech Stack:** Vanilla JS, no build step. Tests via `node gym-volume-logic.selfcheck.cjs` (plain assertions, no framework — matches this repo's established convention for pure-logic modules).

---

### Task 1: Hard-set filtering + secondary-muscle contribution weights

**Files:**
- Modify: `C:\Users\gregm\row\gym-volume-logic.js:74-99` (`weeklySetsByMuscle`)
- Test: `C:\Users\gregm\row\gym-volume-logic.selfcheck.cjs`

- [ ] **Step 1: Write the failing tests**

Add these cases to `gym-volume-logic.selfcheck.cjs`, right after the existing `weeklySetsByMuscle` block (after the line ending `'weeklySetsByMuscle only counts sets from the current week, ignoring prior weeks.'` — currently line 114):

```javascript
// weeklySetsByMuscle — a set with RIR >= 4 is excluded (not a hard set).
const rirExercises = [{ id: 'chest1', muscle: 'Chest' }];
const rirLogsExcluded = { chest1: [
  { date: sameWeekA, weight: 100, reps: 10, rir: 4 },
  { date: sameWeekB, weight: 100, reps: 8, rir: 5 },
] };
assertEqual(weeklySetsByMuscle(rirExercises, rirLogsExcluded).Chest, 0, 'weeklySetsByMuscle excludes sets with RIR >= 4');

// weeklySetsByMuscle — a set with RIR 3 (or lower) counts as hard.
const rirLogsIncluded = { chest1: [
  { date: sameWeekA, weight: 100, reps: 10, rir: 3 },
  { date: sameWeekB, weight: 100, reps: 8, rir: 0 },
] };
assertEqual(weeklySetsByMuscle(rirExercises, rirLogsIncluded).Chest, 2, 'weeklySetsByMuscle counts sets with RIR 3 or below as hard');

// weeklySetsByMuscle — a set with no RIR logged counts (missing RIR defaults to hard).
const rirLogsMissing = { chest1: [{ date: sameWeekA, weight: 100, reps: 10 }] };
assertEqual(weeklySetsByMuscle(rirExercises, rirLogsMissing).Chest, 1, 'weeklySetsByMuscle counts a set with no RIR logged as hard');

// weeklySetsByMuscle — an exercise in EXERCISE_MUSCLE_CONTRIBUTIONS adds
// weighted secondary credit alongside full primary credit, same week.
const secondaryExercises = [{ id: 'bench', name: 'Smith Machine Flat Chest Press', muscle: 'Chest' }];
const secondaryLogs = { bench: [{ date: sameWeekA, weight: 200, reps: 8 }] };
const secondaryCounts = weeklySetsByMuscle(secondaryExercises, secondaryLogs);
assertEqual(secondaryCounts.Chest, 1, 'weeklySetsByMuscle gives full primary credit to Chest for a chest press');
assertEqual(secondaryCounts.Triceps, 0.5, 'weeklySetsByMuscle gives 0.5 secondary credit to Triceps for a chest press');

// weeklySetsByMuscle — an exercise with no contribution-map entry only
// contributes to its primary muscle (no secondary credit anywhere).
const noSecondaryExercises = [{ id: 'ext', name: 'Leg Extension', muscle: 'Quads' }];
const noSecondaryLogs = { ext: [{ date: sameWeekA, weight: 100, reps: 12 }] };
const noSecondaryCounts = weeklySetsByMuscle(noSecondaryExercises, noSecondaryLogs);
assertEqual(noSecondaryCounts.Quads, 1, 'weeklySetsByMuscle gives full primary credit for an exercise with no secondary mapping');
assertEqual(noSecondaryCounts.Hamstrings, 0, 'weeklySetsByMuscle adds no secondary credit for an exercise with no contribution-map entry');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node C:\Users\gregm\row\gym-volume-logic.selfcheck.cjs`
Expected: FAIL — `weeklySetsByMuscle excludes sets with RIR >= 4` (current code counts every set regardless of RIR, and `Triceps`/secondary-mapped values won't exist since `EXERCISE_MUSCLE_CONTRIBUTIONS` doesn't exist yet).

- [ ] **Step 3: Add the contribution map and rewrite `weeklySetsByMuscle`**

In `gym-volume-logic.js`, insert this new constant directly after the closing `};` of `MUSCLE_BANDS` (currently ending at line 72):

```javascript
  // Name-keyed map of exercises with a well-established (EMG-supported),
  // textbook secondary muscle mover -- not an exhaustive biomechanical
  // model, just the strong/obvious cases. Keyed by exercise .name (stable),
  // same convention as coaching-exercise-meta.js's META. An exercise absent
  // from this map contributes only to its primary (.muscle) -- that's the
  // expected case for isolation moves, not an omission.
  // Sourced 2026-08-14, see docs/superpowers/specs/2026-08-14-volume-progression-datamodel-design.md
  // for the full citation/reasoning trail (includes a Gemini independent
  // fact-check pass -- confirmed the RIR>=4 threshold and the pressing/
  // rowing secondary-mover claims as scientifically standard; the RDL
  // glute weight below was revised from an initial 0.5 to 0.7 after that
  // check argued 0.5 underweights glutes, since hip extension is the
  // PRIMARY joint action in a hip hinge, not a secondary one).
  var EXERCISE_MUSCLE_CONTRIBUTIONS = {
    'Neutral Grip Shoulder Press Machine': { muscle: 'Triceps', weight: 0.5 },
    'Smith Machine Flat Chest Press':      { muscle: 'Triceps', weight: 0.5 },
    'Chest Dip':                           { muscle: 'Triceps', weight: 0.5 },
    'Dumbbell Incline Chest Press':        { muscle: 'Triceps', weight: 0.5 },
    'Smith Machine Narrow Grip Bench':     { muscle: 'Chest', weight: 0.5 },

    // Flat 0.5 regardless of grip -- a known simplification (a pronated/
    // overhand pull recruits meaningfully less biceps than neutral/
    // supinated; plain 'Lat Pulldown' with no grip in its name, as
    // distinct from 'Neutral Grip Lat Pulldown' below, is the likeliest
    // candidate to be overstated by this). Revisit if grip ever becomes
    // its own tracked exercise attribute.
    'Lat Pulldown':                    { muscle: 'Biceps', weight: 0.5 },
    'Cable Seated Row (Neutral Grip)': { muscle: 'Biceps', weight: 0.5 },
    'Machine High Row':                { muscle: 'Biceps', weight: 0.5 },
    'Machine Low Row':                 { muscle: 'Biceps', weight: 0.5 },
    'Chest Supported T-Bar Row':       { muscle: 'Biceps', weight: 0.5 },
    'Neutral Grip Lat Pulldown':       { muscle: 'Biceps', weight: 0.5 },

    'Hack Squat':                   { muscle: 'Glutes', weight: 0.3 },
    'Cybex Leg Press':              { muscle: 'Glutes', weight: 0.3 },
    'Dumbbell Heel Elevated Lunge': { muscle: 'Glutes', weight: 0.2 },
    'Dumbbell B-Stance RDL':        { muscle: 'Glutes', weight: 0.7 },
    'Smith Machine RDL':            { muscle: 'Glutes', weight: 0.7 }
  };
```

Then replace `weeklySetsByMuscle` (currently lines 79-99) with:

```javascript
  // exercises: [{ id, name, muscle, ... }]. logs: same shape as
  // weeklyVolumeByDay. Counts weighted HARD sets (one log entry = 1.0 to
  // its primary muscle, plus EXERCISE_MUSCLE_CONTRIBUTIONS[name]'s weight
  // to its secondary muscle if mapped), current week only. A set with
  // log.rir explicitly >= 4 is excluded (not near enough to failure to
  // count as training volume) -- missing RIR or RIR < 4 counts. Every
  // muscle in MUSCLE_BANDS is present in the result even at 0.
  function weeklySetsByMuscle(exercises, logs) {
    var exByI = {};
    (exercises || []).forEach(function (ex) {
      if (ex && ex.muscle) exByI[ex.id] = ex;
    });

    var counts = {};
    Object.keys(MUSCLE_BANDS).forEach(function (m) { counts[m] = 0; });

    var thisMonday = mondayOfDate(new Date());
    Object.keys(logs || {}).forEach(function (exId) {
      var ex = exByI[exId];
      if (!ex) return; // untagged (custom/adhoc) exercise — excluded, not bucketed
      var secondary = EXERCISE_MUSCLE_CONTRIBUTIONS[ex.name];
      (logs[exId] || []).forEach(function (log) {
        if (!log || !log.date) return;
        if (mondayOfDate(new Date(log.date)) !== thisMonday) return;
        if (log.rir != null && log.rir >= 4) return; // not a hard set
        counts[ex.muscle] = (counts[ex.muscle] || 0) + 1;
        if (secondary) counts[secondary.muscle] = (counts[secondary.muscle] || 0) + secondary.weight;
      });
    });
    return counts;
  }
```

Add `EXERCISE_MUSCLE_CONTRIBUTIONS: EXERCISE_MUSCLE_CONTRIBUTIONS` to the `api` object at the bottom of the file (alongside the existing `MUSCLE_BANDS: MUSCLE_BANDS`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node C:\Users\gregm\row\gym-volume-logic.selfcheck.cjs`
Expected: all assertions pass, ending with `gym-volume-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add gym-volume-logic.js gym-volume-logic.selfcheck.cjs
git commit -m "feat: weeklySetsByMuscle counts hard sets (RIR-gated) with weighted secondary-muscle credit"
```

---

### Task 2: Phase-adjusted volume targets

**Files:**
- Modify: `C:\Users\gregm\row\gym-volume-logic.js` (new `phaseTarget` function, `classifyMuscleVolume`, `volumeAdvisory`)
- Test: `C:\Users\gregm\row\gym-volume-logic.selfcheck.cjs`

- [ ] **Step 1: Write the failing tests**

Add after the `weeklySetsByMuscle` tests from Task 1:

```javascript
// phaseTarget — growth targets mavHigh, cut/show_prep/reverse_diet target
// mavLow, peak/null/unrecognized has no target (falls back to static bands).
assertEqual(classifyMuscleVolume('Chest', 15, 'growth').target, 20, 'classifyMuscleVolume: growth phase targets mavHigh');
assertEqual(classifyMuscleVolume('Chest', 15, 'cut').target, 12, 'classifyMuscleVolume: cut phase targets mavLow');
assertEqual(classifyMuscleVolume('Chest', 15, 'show_prep').target, 12, 'classifyMuscleVolume: show_prep phase targets mavLow');
assertEqual(classifyMuscleVolume('Chest', 15, 'reverse_diet').target, 12, 'classifyMuscleVolume: reverse_diet phase targets mavLow');
assertEqual(classifyMuscleVolume('Chest', 15, 'peak').target, null, 'classifyMuscleVolume: peak phase has no target');
assertEqual(classifyMuscleVolume('Chest', 15, null).target, null, 'classifyMuscleVolume: no phase has no target');
assertEqual(classifyMuscleVolume('Chest', 15, 'not_a_real_phase').target, null, 'classifyMuscleVolume: unrecognized phase string has no target');
assertEqual(classifyMuscleVolume('Chest', 15).target, null, 'classifyMuscleVolume: omitted phase argument has no target (backward compatible)');

// classifyMuscleVolume — belowTarget compares count against the phase target.
assertEqual(classifyMuscleVolume('Chest', 15, 'growth').belowTarget, true, 'classifyMuscleVolume: 15 sets is below growth\'s target of 20');
assertEqual(classifyMuscleVolume('Chest', 20, 'growth').belowTarget, false, 'classifyMuscleVolume: 20 sets is not below growth\'s target of 20');
assertEqual(classifyMuscleVolume('Chest', 15, null).belowTarget, false, 'classifyMuscleVolume: belowTarget is always false with no phase target');

// volumeAdvisory — in MAV range, below the phase target: add_set with
// phase-flavored wording, even when NOT stalled (the new proactive case).
const growthAdvisory = volumeAdvisory(classifyMuscleVolume('Chest', 15, 'growth'), false, 'growth');
assertEqual(growthAdvisory.suggestion, 'add_set', 'volumeAdvisory: below growth target suggests add_set even when not stalled');
assertEqual(growthAdvisory.reason.indexOf('growth') !== -1 || growthAdvisory.reason.toLowerCase().indexOf('push') !== -1, true, 'volumeAdvisory: growth-phase reason is phase-flavored');

const cutAdvisory = volumeAdvisory(classifyMuscleVolume('Chest', 9, 'cut'), false, 'cut');
assertEqual(cutAdvisory.suggestion, 'add_set', 'volumeAdvisory: below cut target suggests add_set even when not stalled');
assertEqual(cutAdvisory.reason.toLowerCase().indexOf('minimum') !== -1, true, 'volumeAdvisory: cut-phase reason mentions minimum-effective framing');

// volumeAdvisory — in MAV, AT/ABOVE the phase target, not stalled: same
// today's-behavior null (the regression guard for the common growth case
// where volume is already at the phase's ceiling).
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 20, 'growth'), false, 'growth'), null, 'volumeAdvisory: at growth target and not stalled returns null');

// volumeAdvisory — no phase set, in MAV, not stalled: unchanged from today
// (the core no-regression check for users without an active season).
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 15, null), false, null), null, 'volumeAdvisory: no phase, in MAV, not stalled returns null (unchanged)');

// volumeAdvisory — under MEV and at/above MRV are phase-independent.
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 3, 'growth'), false, 'growth').suggestion, 'add_set', 'volumeAdvisory: under MEV suggests add_set regardless of phase');
assertEqual(volumeAdvisory(classifyMuscleVolume('Chest', 25, 'cut'), false, 'cut').suggestion, 'pull_back', 'volumeAdvisory: at/above MRV suggests pull_back regardless of phase');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node C:\Users\gregm\row\gym-volume-logic.selfcheck.cjs`
Expected: FAIL — `classifyMuscleVolume(...).target` is `undefined` (no such field exists yet).

- [ ] **Step 3: Add `phaseTarget` and update `classifyMuscleVolume`/`volumeAdvisory`**

In `gym-volume-logic.js`, add this new function directly after `EXERCISE_MUSCLE_CONTRIBUTIONS` (from Task 1) and before `weeklyVolumeByDay`:

```javascript
  // Maps a muscle + training phase to a specific weekly-hard-set target, or
  // null if this phase shouldn't push a target (falls back to the static
  // band's stall-only advisory behavior). growth climbs toward the top of
  // the effective range; cut/show_prep/reverse_diet hold at the bottom
  // (minimum-effective) rather than chasing more volume while other levers
  // (diet) are doing the work. peak/null/any unrecognized phase: no target,
  // today's exact pre-phase behavior.
  function phaseTarget(muscle, phase) {
    var band = MUSCLE_BANDS[muscle];
    if (!band) return null;
    if (phase === 'growth') return band.mavHigh;
    if (phase === 'cut' || phase === 'show_prep' || phase === 'reverse_diet') return band.mavLow;
    return null;
  }
```

Replace `classifyMuscleVolume` (currently the function right after `weeklySetsByMuscle`) with:

```javascript
  // Classifies a weekly set count against a muscle's evidence-based band,
  // optionally against a phase-specific target too. Returns
  // { label: 'under'|'mav'|'mrv', mev, mavLow, mavHigh, mrv, target,
  // belowTarget } -- label is 'under' below MEV, 'mav' from MEV through
  // MRV-1, 'mrv' at or above MRV. target is phaseTarget(muscle, phase),
  // possibly null (no phase, peak, or unrecognized phase). belowTarget is
  // true only when a target exists AND count is below it. Unknown muscle
  // name returns null. phase is optional -- omitting it (or passing an
  // unrecognized value) reproduces today's exact pre-phase behavior.
  function classifyMuscleVolume(muscle, count, phase) {
    var band = MUSCLE_BANDS[muscle];
    if (!band) return null;
    var label = count < band.mev ? 'under' : (count >= band.mrv ? 'mrv' : 'mav');
    var target = phaseTarget(muscle, phase);
    var belowTarget = target != null && count < target;
    return { label: label, mev: band.mev, mavLow: band.mavLow, mavHigh: band.mavHigh, mrv: band.mrv, target: target, belowTarget: belowTarget };
  }
```

Replace `volumeAdvisory` with:

```javascript
  // Turns a classifyMuscleVolume() band + whether getRx() detected a stall
  // for this exercise into a prescriptive suggestion. Advisory only -- the
  // caller (getRx()) attaches this alongside its existing load-based
  // recommendation, never replaces it. phase is optional and only affects
  // the in-MAV-range case: when the band carries a phase target
  // (band.belowTarget), that takes priority over the stall check, with
  // phase-flavored wording -- growth frames it as pushing toward the top
  // of the range, cut/show_prep/reverse_diet frames it as holding at the
  // minimum-effective floor. With no phase target, behavior is identical
  // to before phase-awareness existed (stall-only).
  function volumeAdvisory(band, stalled, phase) {
    if (!band) return null;
    if (band.label === 'under') {
      return { suggestion: 'add_set', reason: 'Under MEV (' + band.mev + ' sets/wk) for this muscle -- there\'s real room to add volume here before load progression is even the limiting factor.' };
    }
    if (band.label === 'mrv') {
      return { suggestion: 'pull_back', reason: 'At or above MRV (' + band.mrv + ' sets/wk) for this muscle -- more volume here is more likely to add fatigue than drive further growth.' };
    }
    if (band.belowTarget) {
      if (phase === 'growth') {
        return { suggestion: 'add_set', reason: 'Growth phase target is ' + band.target + ' sets/wk for this muscle -- still room to push toward MAV, and this phase is where added volume is a real lever.' };
      }
      return { suggestion: 'add_set', reason: 'This phase\'s minimum-effective target is ' + band.target + ' sets/wk for this muscle -- worth adding a set to hold there while other levers do the heavy lifting.' };
    }
    if (stalled) {
      return { suggestion: 'add_set', reason: 'Stalled on load, but still under MRV (' + band.mrv + ' sets/wk) for this muscle -- a plateau here is often a volume problem, not purely a load problem. Consider adding a set before assuming a deload is the only fix.' };
    }
    return null;
  }
```

Add `phaseTarget: phaseTarget` to the `api` object at the bottom of the file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node C:\Users\gregm\row\gym-volume-logic.selfcheck.cjs`
Expected: all assertions pass, ending with `gym-volume-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add gym-volume-logic.js gym-volume-logic.selfcheck.cjs
git commit -m "feat: phase-adjusted volume targets (growth climbs toward MAV, cut/reverse_diet hold at minimum-effective)"
```

---

### Task 3: Wire phase into gym.html's two call sites

**Files:**
- Modify: `C:\Users\gregm\row\gym.html:3503-3508` (`getRx()`'s volume advisory block)
- Modify: `C:\Users\gregm\row\gym.html:4497-4507` (Progress-tab volume panel)

- [ ] **Step 1: Pass the already-read phase into `getRx()`'s volume advisory**

`getRx()` already reads the season phase into `seasonPhase` at line 3436-3437 (used for load-threshold phase adjustment). Reuse that same variable — it's in scope at the volume-advisory block below it. In `gym.html`, change (currently lines 3503-3508):

```javascript
    if (ex.muscle && window.GymVolumeLogic) {
      const allEx = (state.exercises || []).concat(getAdhocExercises());
      const muscleCounts = window.GymVolumeLogic.weeklySetsByMuscle(allEx, state.logs || {});
      const band = window.GymVolumeLogic.classifyMuscleVolume(ex.muscle, muscleCounts[ex.muscle] || 0);
      const advisory = window.GymVolumeLogic.volumeAdvisory(band, stalled);
      if (advisory) finalResult.volumeAdvisory = advisory;
    }
```
to:
```javascript
    if (ex.muscle && window.GymVolumeLogic) {
      const allEx = (state.exercises || []).concat(getAdhocExercises());
      const muscleCounts = window.GymVolumeLogic.weeklySetsByMuscle(allEx, state.logs || {});
      const band = window.GymVolumeLogic.classifyMuscleVolume(ex.muscle, muscleCounts[ex.muscle] || 0, seasonPhase);
      const advisory = window.GymVolumeLogic.volumeAdvisory(band, stalled, seasonPhase);
      if (advisory) finalResult.volumeAdvisory = advisory;
    }
```

- [ ] **Step 2: Read phase in the Progress-tab volume panel and pass it through**

In `gym.html`, change (currently lines 4493-4507):

```javascript
    // Deliberately NOT passed volFilter — MEV/MAV/MRV bands are a whole-week
    // total across every training day a muscle gets hit, not a per-day
    // metric, so this section always reflects the full week regardless of
    // which day pill above is selected.
    var muscleCounts = window.GymVolumeLogic.weeklySetsByMuscle(allEx, state.logs || {});
    var muscleListEl = $('volMuscleList');
    var labelText = { under: 'under MEV', mav: 'in range', mrv: 'at/above MRV' };
    muscleListEl.innerHTML = Object.keys(muscleCounts).sort().map(function(muscle) {
      var count = muscleCounts[muscle];
      var band = window.GymVolumeLogic.classifyMuscleVolume(muscle, count);
      var rangeStr = band.mavLow + '-' + band.mavHigh;
      return '<div class="prog-card"><div class="prog-card-top"><span class="prog-card-name">' + escape(muscle) + '</span>'
        + '<div class="prog-card-badge' + (band.label === 'mrv' ? ' prog-card-badge-stalled' : '') + '">' + labelText[band.label] + '</div></div>'
        + '<div class="prog-stat"><span class="prog-stat-label">Sets this week</span><span class="prog-stat-val">' + count + '</span></div>'
        + '<div class="prog-stat"><span class="prog-stat-label">MEV / MAV / MRV</span><span class="prog-stat-val" style="font-size:12px;color:var(--text-2)">' + band.mev + ' / ' + rangeStr + ' / ' + band.mrv + '</span></div></div>';
    }).join('');
```
to:
```javascript
    // Deliberately NOT passed volFilter — MEV/MAV/MRV bands are a whole-week
    // total across every training day a muscle gets hit, not a per-day
    // metric, so this section always reflects the full week regardless of
    // which day pill above is selected.
    var muscleCounts = window.GymVolumeLogic.weeklySetsByMuscle(allEx, state.logs || {});
    var muscleListEl = $('volMuscleList');
    var labelText = { under: 'under MEV', mav: 'in range', mrv: 'at/above MRV' };
    var volSeasonPhase = null;
    try { var vs = JSON.parse(localStorage.getItem('po_coach_season') || 'null'); volSeasonPhase = vs ? vs.phase : null; } catch (e) {}
    muscleListEl.innerHTML = Object.keys(muscleCounts).sort().map(function(muscle) {
      var count = muscleCounts[muscle];
      var band = window.GymVolumeLogic.classifyMuscleVolume(muscle, count, volSeasonPhase);
      var rangeStr = band.mavLow + '-' + band.mavHigh;
      // Weighted secondary contributions can make count fractional (e.g.
      // 6.5) -- round to 1 decimal for display, but keep the raw count
      // feeding classifyMuscleVolume above unrounded so band comparisons
      // stay exact.
      var countDisplay = (Math.round(count * 10) / 10).toString();
      return '<div class="prog-card"><div class="prog-card-top"><span class="prog-card-name">' + escape(muscle) + '</span>'
        + '<div class="prog-card-badge' + (band.label === 'mrv' ? ' prog-card-badge-stalled' : '') + '">' + labelText[band.label] + '</div></div>'
        + '<div class="prog-stat"><span class="prog-stat-label">Sets this week</span><span class="prog-stat-val">' + countDisplay + '</span></div>'
        + '<div class="prog-stat"><span class="prog-stat-label">MEV / MAV / MRV</span><span class="prog-stat-val" style="font-size:12px;color:var(--text-2)">' + band.mev + ' / ' + rangeStr + ' / ' + band.mrv + '</span></div></div>';
    }).join('');
```

- [ ] **Step 3: Run the full selfcheck suite once more (regression check)**

Run: `node C:\Users\gregm\row\gym-volume-logic.selfcheck.cjs`
Expected: all assertions pass (this task doesn't touch the pure-logic module, just its two callers, but re-running confirms nothing else in the repo state broke).

- [ ] **Step 4: Browser verification**

Open `gym.html`, sign in. Log a hard set (no RIR) and, on the same exercise in the same week, log a second set with RIR 5 via the quick-log `@5` syntax — open the Progress tab's Volume panel and confirm the muscle's "Sets this week" count only reflects the hard one. In DevTools console, set a growth-phase season: `localStorage.setItem('po_coach_season', JSON.stringify({ phase: 'growth' }))`, reload, and confirm an in-MAV-range, non-stalled exercise's Rx card now shows an `add_set` volume advisory that mentions pushing toward MAV. Change it to `{ phase: 'cut' }`, reload, and confirm the same exercise's advisory (if still below its lower cut target) reads the minimum-effective framing instead.

- [ ] **Step 5: Commit**

```bash
git add gym.html
git commit -m "feat: wire phase-adjusted volume targets into getRx() and the Progress-tab volume panel"
```
