# Chronic Muscle-Volume Mismatch Detection — Design

**Date:** 2026-08-29
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

This session's north-star note (`Carl Meyer/02 - Projects/ROW Dashboard.md`) flagged "hypertrophy-mastermind-level programming guidance" as an unscoped gap. Auditing before designing (this session's own recurring discipline) found the premise mostly false — two real mechanisms already exist and already reach Vision's gym coach live:

1. **Per-exercise, in-the-moment**: `getRx()` attaches `volumeAdvisory` (MEV/MAV/MRV-based, phase-aware) to its debrief, per `docs/superpowers/specs/2026-08-13-volume-progression-advisory-design.md`.
2. **Whole-body, multi-week trend**: `training-insight-engine.js`'s `detectVolumePhaseSignal()` flags a 20%+ shift in *total* logged sets against the current phase, written to `app_state.row:training_trajectory` and read by Vision (`docs/superpowers/specs/2026-08-27-training-trajectory-coach-integration-design.md`).

The real gap sits between these two: nothing tracks **one muscle group's volume over multiple weeks**. A total-sets trend can look flat while one muscle has been chronically under-trained and another over-trained — the exact kind of imbalance a real hypertrophy coach would catch, and Carl currently has no way to see.

## Approach

Add one new finding type, `detectChronicMuscleVolume()`, to `training-insight-engine.js`. Reuses `gym-volume-logic.js`'s already-tested `weeklySetsByMuscle()` and `classifyMuscleVolume()` — no new volume math, only a new time-dimension over existing per-muscle classification.

**Kept dependency-free** (matching this file's existing design — see its own header comment): the new function takes plain classified labels and band numbers as input; it never calls into `GymVolumeLogic` itself. `weekly-review.html` (which already loads both scripts) does the classification and passes results in.

### 1. `training-insight-engine.js` — the detector

```javascript
// Chronic per-muscle volume mismatch. Unlike detectVolumePhaseSignal (a
// blunt whole-body total), this walks one muscle's own weekly classification
// and flags it stuck under MEV or at/above MRV for 3+ consecutive trailing
// weeks -- a persistent imbalance invisible in the whole-body total (one
// muscle's deficit can hide behind another's surplus). One-off weeks are
// excluded on purpose: classifyMuscleVolume() already surfaces those in
// real time via volumeAdvisory() on the exercise itself; this is for the
// pattern that survives across weeks.
//
// muscle: e.g. 'Chest'. labels: this muscle's classifyMuscleVolume() label
// ('under'|'mav'|'mrv') for each trailing week, oldest first. band: that
// muscle's { mev, mrv } from GymVolumeLogic.MUSCLE_BANDS (for the
// observation text's numbers) -- plain data, not a live handle to the
// other module, so this file stays dependency-free.
function detectChronicMuscleVolume(muscle, labels, band) {
  if (!labels.length || !band) return null;
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
    observation: `${muscle} has been ${isUnder ? `under MEV (${band.mev} sets/wk)` : `at or above MRV (${band.mrv} sets/wk)`} for ${run} straight weeks -- persistently ${isUnder ? 'under-trained' : 'over-trained (likely fatigue, not more growth)'}.`,
    evidenceWindow: { start: `trailing ${run} weeks`, end: 'most recent week' },
    confidence: labels.length >= 6 ? 'medium' : 'low',
    reviewQuestion: isUnder
      ? `Is ${muscle} deliberately deprioritized right now, or worth adding a set to this week?`
      : `Is the extra ${muscle} volume intentional (a specialization block), or worth pulling back?`,
  };
}
```

Exported from the `api` object alongside the other detectors. **Not** added to `runInsightEngine()` itself — that function takes single-muscle-agnostic input (`weeklySets` is a flat total) and is called once per review. This new detector is called once per muscle instead (see below), so it stays a standalone export, same as `detectStalledExercise` is called once per exercise by its own caller rather than folded into the aggregate.

### 2. `weekly-review.html` — per-muscle wiring

**File:** `weekly-review.html`, in the same `try` block as the existing `runInsightEngine()` call (~line 708-748), immediately after the existing `weeklySets` total-per-week loop.

Build a parallel per-muscle version of that same loop:

```javascript
const musclesToCheck = Object.keys(window.GymVolumeLogic.MUSCLE_BANDS);
const weeklyCountsByMuscle = {};
musclesToCheck.forEach(m => { weeklyCountsByMuscle[m] = []; });
for (let w = 5; w >= 0; w--) {
  const wkMonday = new Date(thisMonday); wkMonday.setUTCDate(thisMonday.getUTCDate() - w * 7);
  const counts = window.GymVolumeLogic.weeklySetsByMuscle(gymState.exercises || [], gymState.logs || {}, wkMonday);
  musclesToCheck.forEach(m => { weeklyCountsByMuscle[m].push(counts[m] || 0); });
}
const chronicFindings = musclesToCheck.map(m => {
  const labels = weeklyCountsByMuscle[m].map(c => {
    const band = window.GymVolumeLogic.classifyMuscleVolume(m, c, phase);
    return band ? band.label : null;
  });
  const band = window.GymVolumeLogic.MUSCLE_BANDS[m];
  return window.TrainingInsightEngine.detectChronicMuscleVolume(m, labels, band);
}).filter(Boolean);
findings.push(...chronicFindings);
```

Placed **after** `const findings = window.TrainingInsightEngine.runInsightEngine({...})` and **before** the `if (findings.length > 0)` write block — so the new findings ride the exact same write to `row:training_trajectory` with zero changes to that block, and zero changes on the Vision/`gym.ts` side (it already reads `findings[]` generically by shape, per the 2026-08-27 spec).

`weeklySetsByMuscle(exercises, logs, refDate)`'s third argument buckets by the Monday-of-week containing `refDate` — passing each loop iteration's `wkMonday` reuses the exact convention `gym-volume-logic.js` already establishes (confirmed via its own doc comment and existing call sites in this same file at lines 260, 460, 567).

### Why 3 consecutive weeks, not 2 or 4

3 weeks is the shortest run that can't plausibly be a single busy/light week bleeding into a neighbor (2 adjacent weeks with correlated logging patterns — e.g. a deload week followed by a slow return-to-volume week — could both land "under" without being a real multi-week pattern). 4+ is available as `severity: 'medium'` rather than a separate threshold, so nothing observable is lost by picking 3 as the floor.

### Edge cases

- **New muscle group / no exercises tagged for it**: `weeklySetsByMuscle()` already returns 0 for every `MUSCLE_BANDS` key even with zero logged sets (confirmed in its own doc comment) — a muscle with real zero volume for 3+ weeks correctly flags as `chronic-muscle-under`. This is accurate, not a false positive: if nothing in the current routine trains a muscle (directly or via `EXERCISE_MUSCLE_CONTRIBUTIONS`'s secondary-mover weighting), that's exactly the kind of gap a real coach would flag.
- **Phase change mid-window**: `classifyMuscleVolume()`'s `label` (under/mav/mrv) depends only on the raw MEV/MRV band, not on `phase` (phase only affects the separate `target`/`belowTarget` fields, unused here) — so a phase change mid-window doesn't retroactively reclassify old weeks or create a phantom run. Confirmed by reading `classifyMuscleVolume()`'s implementation.
- **Fewer than 6 weeks of real history**: the loop always produces exactly 6 entries (padding early weeks with 0 for muscles with no logs yet, same as the existing whole-body `weeklySets` loop does today) — a brand-new user could see a spurious 6-week-old "chronic under" for every muscle. Mitigated by `confidence: labels.length >= 6 ? 'medium' : 'low'` already existing in the design above, but since the loop is hardcoded to 6 the confidence field can never actually be `'low'` via that check. **Fix folded in**: confidence instead reflects whether the *flagged run itself* has room to have been shorter than the full window — i.e., use `confidence: run < labels.length ? 'medium' : 'low'`, so a run spanning the entire available window (no visibility into whether it started earlier or is a brand-new user) is marked lower-confidence than a run that demonstrably started partway through real data.

### Out of scope (this pass)

- Exercise-selection quality critique (compound/isolation balance, stretch-focused variant coverage) — a different axis than volume, not what "chronic mismatch" means here.
- Forward-looking mesocycle/block planning (proactively scheduling a specialization block) — this stays a backward-looking pattern detector, consistent with every other finding in this file.
- A UI surface in `weekly-review.html` itself for these findings (badges, a dedicated panel) — the existing `findingsHtml` rendering already displays whatever `runInsightEngine()`-shaped findings exist generically; confirm during implementation whether it needs the new `muscle`/type strings added to its display logic, but no new UI is being designed here.

## Testing

**`training-insight-engine.selfcheck.cjs`**: extend with `detectChronicMuscleVolume()` cases —
- 2 consecutive "under" weeks → `null` (run too short)
- exactly 3 consecutive "under" weeks → fires, `severity: 'low'`
- 4+ consecutive "under" weeks → fires, `severity: 'medium'`
- 3 consecutive "mrv" weeks → fires as `chronic-muscle-over`
- most recent week is "mav" (even after a prior "under" run) → `null` (broken streak, matches trailing-run-only semantics)
- run length equals full label array length → `confidence: 'low'`; a run shorter than the array → `confidence: 'medium'` (given `labels.length >= 6`)

**`weekly-review.html`**: no existing test harness for this file (matches this session's other Row builds — verification is manual tracing + a local static-server browser check). Trace: seed `gymState.logs` with 3+ weeks of a single muscle's sets below its `MUSCLE_BANDS` MEV, confirm a `chronic-muscle-under` finding appears in the `findings` array passed to the `app_state` write, alongside (not replacing) any `detectVolumePhaseSignal`/`detectStalledExercise` findings already firing.
