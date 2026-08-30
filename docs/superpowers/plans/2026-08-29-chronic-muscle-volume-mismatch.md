# Chronic Muscle-Volume Mismatch Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flag a muscle group that's been stuck under MEV or at/above MRV for 3+ consecutive *completed* weeks — a persistent per-muscle imbalance invisible to Row's existing whole-body volume-trend check — and surface it to Vision's gym coach through the pipe that already exists.

**Architecture:** One new pure detector function in `training-insight-engine.js` (`detectChronicMuscleVolume`), fed by new per-muscle, per-week wiring in `weekly-review.html` that reuses `gym-volume-logic.js`'s existing `weeklySetsByMuscle()`/`classifyMuscleVolume()`. The new findings are pushed into the same `findings` array that already gets written to `app_state.row:training_trajectory` and read by Vision — no changes needed outside these two files.

**Tech Stack:** Plain browser JS (no framework, no build step), Node-based `.selfcheck.cjs` test harness (no test framework — hand-rolled `assert`/`assertEqual`).

---

## Spec reference

`docs/superpowers/specs/2026-08-29-chronic-muscle-volume-mismatch-design.md` (committed `row@4c4d88a`, already revised post-Codex-review). Read it if anything below is unclear about *why* — this plan implements it verbatim.

## File Structure

- Modify: `training-insight-engine.js` — add `detectChronicMuscleVolume()`, export it from the existing `api` object.
- Modify: `training-insight-engine.selfcheck.cjs` — add test cases for the new function (this file has no test *framework*, just a hand-rolled assert script — extend it in place).
- Modify: `weekly-review.html` — add per-muscle weekly-count computation and wire the new detector's findings into the existing `findings` array.

No new files. Two tasks: the pure-function detector (fully testable in Node), then the browser wiring (no test harness exists for this file — verified by manual trace instead, matching this session's other Row builds).

---

### Task 1: `detectChronicMuscleVolume()` in `training-insight-engine.js`

**Files:**
- Modify: `training-insight-engine.js:173` (insert the new function immediately after `detectVolumePhaseSignal`, before the `detectRecoverySignal` comment at line 200) and `training-insight-engine.js:258-267` (add to the `api` export object)
- Test: `training-insight-engine.selfcheck.cjs` (append new test block; this file has no separate test runner — it's a self-contained Node script you run directly)

- [ ] **Step 1: Write the failing tests**

Open `training-insight-engine.selfcheck.cjs` and insert this new block immediately before the final `// --- orchestrator: never throws on thin/partial input ---` section (currently at line 190):

```javascript
// --- chronic per-muscle volume mismatch ---
{
  const band = { mev: 8, mrv: 22 };

  // observedWeeks < 3 with an otherwise-qualifying 3-week "under" run -> null
  assertEqual(
    E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'under', 'under', 'under'], band, 2),
    null,
    'a qualifying 3-week run is suppressed when fewer than 3 weeks have any real training history'
  );

  // observedWeeks >= 3, only 2 consecutive "under" weeks -> null
  assertEqual(
    E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'mav', 'under', 'under'], band, 6),
    null,
    'a 2-week run is too short to call chronic, even with plenty of real history'
  );

  // observedWeeks >= 3, exactly 3 consecutive "under" weeks -> fires, severity low
  {
    const f = E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'under', 'under', 'under'], band, 6);
    assert(f, 'a real 3-week under-MEV run should fire');
    assertEqual(f.type, 'chronic-muscle-under', 'chronic-muscle-under finding type');
    assertEqual(f.muscle, 'Chest', 'finding carries the muscle name');
    assertEqual(f.severity, 'low', 'exactly 3 weeks is low severity');
  }

  // observedWeeks >= 3, 4+ consecutive "under" weeks -> fires, severity medium
  {
    const f = E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'under', 'under', 'under', 'under'], band, 6);
    assert(f, 'a real 4-week under-MEV run should fire');
    assertEqual(f.severity, 'medium', '4+ weeks escalates to medium severity');
  }

  // observedWeeks >= 3, 3 consecutive "mrv" weeks -> fires as chronic-muscle-over
  {
    const f = E.detectChronicMuscleVolume('Back', ['mav', 'mav', 'mav', 'mrv', 'mrv', 'mrv'], band, 6);
    assert(f, 'a real 3-week at/above-MRV run should fire');
    assertEqual(f.type, 'chronic-muscle-over', 'chronic-muscle-over finding type');
  }

  // most recent week is "mav" (even after a prior "under" run) -> null (broken streak)
  assertEqual(
    E.detectChronicMuscleVolume('Chest', ['under', 'under', 'under', 'mav'], band, 4),
    null,
    'the streak must be current -- an under-run that ended is not a chronic mismatch today'
  );

  // confidence tracks observedWeeks, not run length
  {
    const highCoverage = E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'under', 'under', 'under'], band, 6);
    assertEqual(highCoverage.confidence, 'medium', 'observedWeeks >= 5 -> medium confidence');
    const lowCoverage = E.detectChronicMuscleVolume('Chest', ['mav', 'mav', 'mav', 'under', 'under', 'under'], band, 3);
    assertEqual(lowCoverage.confidence, 'low', 'observedWeeks 3-4 -> low confidence, even with the same 3-week run');
  }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node training-insight-engine.selfcheck.cjs`
Expected: a `TypeError` (something like `E.detectChronicMuscleVolume is not a function`), since the function doesn't exist yet. The script exits non-zero and does **not** print `All training-insight-engine self-checks passed.`

- [ ] **Step 3: Implement `detectChronicMuscleVolume()`**

In `training-insight-engine.js`, insert this new function immediately after `detectVolumePhaseSignal` closes (after the `}` on line 198) and before the `detectRecoverySignal` doc comment (line 200):

```javascript
  // Chronic per-muscle volume mismatch. Unlike detectVolumePhaseSignal (a
  // blunt whole-body total), this walks one muscle's own weekly
  // classification and flags it stuck under MEV or at/above MRV for 3+
  // consecutive trailing COMPLETED weeks -- a persistent imbalance
  // invisible in the whole-body total (one muscle's deficit can hide
  // behind another's surplus). One-off weeks are excluded on purpose:
  // classifyMuscleVolume() already surfaces those in real time via
  // volumeAdvisory() on the exercise itself; this is for the pattern that
  // survives across weeks.
  //
  // muscle: e.g. 'Chest'. labels: this muscle's classifyMuscleVolume()
  // label ('under'|'mav'|'mrv') for each trailing COMPLETED week, oldest
  // first (never the current in-progress week -- enforced by the caller in
  // weekly-review.html). band: that muscle's { mev, mrv } from
  // GymVolumeLogic.MUSCLE_BANDS (for the observation text's numbers) --
  // plain data, not a live handle to the other module, so this file stays
  // dependency-free. observedWeeks: how many of the windowed weeks had ANY
  // real logged session (any exercise) -- distinguishes "genuine
  // multi-week signal" from "brand-new user, mostly zero-padded history."
  // Confidence tracks this, not run length -- a run spanning the full
  // window is MORE evidence, not less (Codex review, 2026-08-29).
  function detectChronicMuscleVolume(muscle, labels, band, observedWeeks) {
    if (!labels.length || !band) return null;
    if (observedWeeks < 3) return null; // not enough real training history to call anything "chronic"
    const last = labels[labels.length - 1];
    if (last !== 'under' && last !== 'mrv') return null;
    let run = 0;
    for (let i = labels.length - 1; i >= 0 && labels[i] === last; i--) run++;
    if (run < 3) return null;

    const isUnder = last === 'under';
    return {
      type: isUnder ? 'chronic-muscle-under' : 'chronic-muscle-over',
      muscle: muscle,
      severity: run >= 4 ? 'medium' : 'low',
      observation: `${muscle} has been ${isUnder
        ? `under MEV (${band.mev} sets/wk) for ${run} straight completed weeks -- persistently under-trained.`
        : `at or above MRV (${band.mrv} sets/wk) for ${run} straight completed weeks -- worth assessing fatigue, performance, and whether this is an intentional specialization block.`}`,
      evidenceWindow: { start: `trailing ${run} completed weeks`, end: 'most recent completed week' },
      confidence: observedWeeks >= 5 ? 'medium' : 'low',
      reviewQuestion: isUnder
        ? `Is ${muscle} deliberately deprioritized right now, or worth adding a set to this week?`
        : `Is the extra ${muscle} volume intentional (a specialization block), or worth pulling back?`,
    };
  }

```

Then add it to the `api` export object (currently `training-insight-engine.js:258-267`):

```javascript
  const api = {
    repBracketOf: repBracketOf,
    isolateTrailingRun: isolateTrailingRun,
    looksLikeIntentionalDeload: looksLikeIntentionalDeload,
    detectStalledExercise: detectStalledExercise,
    detectMissedSessionTrend: detectMissedSessionTrend,
    detectVolumePhaseSignal: detectVolumePhaseSignal,
    detectChronicMuscleVolume: detectChronicMuscleVolume,
    detectRecoverySignal: detectRecoverySignal,
    runInsightEngine: runInsightEngine,
  };
```

(Only change: the new `detectChronicMuscleVolume: detectChronicMuscleVolume,` line, inserted after `detectVolumePhaseSignal` to match the order functions are defined in the file.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node training-insight-engine.selfcheck.cjs`
Expected: `All training-insight-engine self-checks passed.` printed, exit code 0.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row
git add training-insight-engine.js training-insight-engine.selfcheck.cjs
git commit -m "feat: add detectChronicMuscleVolume for per-muscle volume trend detection"
```

---

### Task 2: Wire it into `weekly-review.html`

**Files:**
- Modify: `weekly-review.html:748-750` (insert new code between the existing `runInsightEngine()` call and the `row:training_trajectory` write block)

- [ ] **Step 1: Add the per-muscle wiring**

In `weekly-review.html`, find this exact existing code (currently lines 741-750):

```javascript
      const findings = window.TrainingInsightEngine.runInsightEngine({
        exercises: exposuresByName,
        sessionDates: sessionDates,
        weeklySets: weeklySets,
        phase: phase,
        sleepEntries: allSleepEntries,
        now: nowRef,
      });

      // Feed the gym coach -- see docs/superpowers/specs/
      // 2026-08-27-training-trajectory-coach-integration-design.md.
```

Replace it with (the `runInsightEngine()` call is unchanged — only the new block is inserted between it and the existing comment):

```javascript
      const findings = window.TrainingInsightEngine.runInsightEngine({
        exercises: exposuresByName,
        sessionDates: sessionDates,
        weeklySets: weeklySets,
        phase: phase,
        sleepEntries: allSleepEntries,
        now: nowRef,
      });

      // Per-muscle chronic volume mismatch -- see docs/superpowers/specs/
      // 2026-08-29-chronic-muscle-volume-mismatch-design.md. Uses 6
      // COMPLETED weeks (excludes the current in-progress week -- a run
      // must never be started or broken by a week that isn't over yet).
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const lastCompleteMonday = new Date(thisMonday.getTime() - oneWeekMs);
      const musclesToCheck = Object.keys(window.GymVolumeLogic.MUSCLE_BANDS);
      const weeklyCountsByMuscle = {};
      musclesToCheck.forEach(m => { weeklyCountsByMuscle[m] = []; });
      let observedWeeks = 0;
      for (let w = 5; w >= 0; w--) {
        const wkMonday = new Date(lastCompleteMonday); wkMonday.setUTCDate(lastCompleteMonday.getUTCDate() - w * 7);
        const wkSunday = new Date(wkMonday); wkSunday.setUTCDate(wkMonday.getUTCDate() + 6);
        const mKey = wkMonday.toISOString().slice(0, 10), sKey = wkSunday.toISOString().slice(0, 10);
        if (sessionDates.some(d => d >= mKey && d <= sKey)) observedWeeks++;
        const counts = window.GymVolumeLogic.weeklySetsByMuscle(gymState.exercises || [], gymState.logs || {}, wkMonday);
        musclesToCheck.forEach(m => { weeklyCountsByMuscle[m].push(counts[m] || 0); });
      }
      const chronicFindings = musclesToCheck.map(m => {
        const labels = weeklyCountsByMuscle[m].map(c => {
          const band = window.GymVolumeLogic.classifyMuscleVolume(m, c, phase);
          return band ? band.label : null;
        });
        const band = window.GymVolumeLogic.MUSCLE_BANDS[m];
        return window.TrainingInsightEngine.detectChronicMuscleVolume(m, labels, band, observedWeeks);
      }).filter(Boolean);
      findings.push(...chronicFindings);

      // Feed the gym coach -- see docs/superpowers/specs/
      // 2026-08-27-training-trajectory-coach-integration-design.md.
```

This is inserted **before** the `if (findings.length > 0) { ... }` write block (unchanged) — so `chronicFindings` rides the exact same `app_state` write with zero further changes needed.

- [ ] **Step 2: Verify the file still parses**

Run: `node -e "new Function(require('fs').readFileSync('weekly-review.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s => s.replace(/<\/?script>/g, '')).join('\n'))"`

This is a syntax-only check (matches the verification approach used for this file in other builds this session, since it has no real test harness). Expected: no output, exit code 0. If it throws a `SyntaxError`, re-check the inserted block for a typo before continuing.

- [ ] **Step 3: Manual trace #1 — a real chronic-under finding fires**

In a browser console on `weekly-review.html` (or by temporarily adding a `console.log(chronicFindings)` right after the new block and reloading the page with real data), seed 3+ **completed** weeks of a muscle's sets below its `MUSCLE_BANDS` MEV, with real sessions logged in each of those weeks (so `observedWeeks >= 3`). Confirm:
- `chronicFindings` contains one entry with `type: 'chronic-muscle-under'` for that muscle.
- `findings` (the array passed to the `app_state` write) contains it too, alongside any `detectVolumePhaseSignal`/`detectStalledExercise` findings already present — not replacing them.

- [ ] **Step 4: Manual trace #2 — new-user gate suppresses a false positive**

Using the same seeded data as Step 3, but with only 1-2 of those weeks containing any real logged session (the rest zero-padded, simulating a new Row user), confirm `chronicFindings` is empty for that muscle — the `observedWeeks < 3` gate suppresses it even though the label run itself would otherwise qualify.

- [ ] **Step 5: Manual trace #3 — the in-progress week is excluded**

With the muscle otherwise well within its MAV range for all 6 prior completed weeks, seed a near-empty *current* week (today) for that muscle. Confirm no `chronic-muscle-under` finding starts — the window computation (`lastCompleteMonday`) must never include today's partial week.

- [ ] **Step 6: Remove any temporary debug logging**

If a `console.log` was added for Steps 3-5, remove it now — it was for manual verification only, not part of the shipped code.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/gregm/row
git add weekly-review.html
git commit -m "feat: surface chronic per-muscle volume mismatches to the gym coach"
```

---

## Completion

After both tasks: run `node training-insight-engine.selfcheck.cjs` one more time to confirm nothing regressed, then hand off to `superpowers:finishing-a-development-branch` per the plan-execution flow (working directly on `main`, no branch to merge — this step mainly checks whether a pre-push code-review ask is warranted before pushing to `origin/main`).
