# Chronic Muscle-Volume Mismatch Detection — Design

**Date:** 2026-08-29
**Status:** Approved (revised post-Codex review — see "Revision note" below)
**Owner:** Row (`C:\Users\gregm\row`)

**Revision note:** a Codex review of this spec (`Codex Outputs/2026-08-29-chronic-muscle-volume-spec-review.md`) caught two real bugs in the first draft, both fixed below: (1) the original 6-week window included the current in-progress week, which could false-positive or falsely break a run before the week was even over; (2) the original confidence field (`run < labels.length`) had the logic backwards — a run that fills the whole window is *more* evidence, not less. Confidence is now tied to real observed-week coverage instead. A third finding (add a first-class "deprioritized/maintenance" suppression mechanism) was deliberately not applied — that's a real feature, not a bug fix, and out of scope for this pass; the existing `reviewQuestion` field already asks rather than asserts.

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
// ('under'|'mav'|'mrv') for each trailing COMPLETED week, oldest first
// (never the current in-progress week -- see the weekly-review.html section
// below). band: that muscle's { mev, mrv } from GymVolumeLogic.MUSCLE_BANDS
// (for the observation text's numbers) -- plain data, not a live handle to
// the other module, so this file stays dependency-free. observedWeeks: how
// many of the windowed weeks had ANY real logged session (any exercise) --
// distinguishes "genuine multi-week signal" from "brand-new user, mostly
// zero-padded history." Caught by Codex review, 2026-08-29: confidence must
// track real data coverage, not run length -- a run spanning the full
// window is MORE evidence, not less.
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

Exported from the `api` object alongside the other detectors. **Not** added to `runInsightEngine()` itself — that function takes single-muscle-agnostic input (`weeklySets` is a flat total) and is called once per review. This new detector is called once per muscle instead (see below), so it stays a standalone export, same as `detectStalledExercise` is called once per exercise by its own caller rather than folded into the aggregate.

### 2. `weekly-review.html` — per-muscle wiring

**File:** `weekly-review.html`, in the same `try` block as the existing `runInsightEngine()` call (~line 708-748), immediately after the existing `weeklySets` total-per-week loop.

Build a parallel per-muscle version of that same loop — **using 6 completed weeks, not the current in-progress one** (Codex catch: the original draft's window started at `thisMonday`, the CURRENT week, so checking on a Monday or Tuesday could see a near-zero count for a week that isn't over yet, either falsely starting an "under" run or falsely breaking a real "mrv" run):

```javascript
const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
const lastCompleteMonday = new Date(thisMonday.getTime() - oneWeekMs); // most recent fully-elapsed week
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
```

`sessionDates` is already computed earlier in this same block (line 725: `Array.from(new Set(allEntries.map(...)))`) — reused here, not recomputed, to determine `observedWeeks`.

Placed **after** `const findings = window.TrainingInsightEngine.runInsightEngine({...})` and **before** the `if (findings.length > 0)` write block — so the new findings ride the exact same write to `row:training_trajectory` with zero changes to that block, and zero changes on the Vision/`gym.ts` side (it already reads `findings[]` generically by shape, per the 2026-08-27 spec).

`weeklySetsByMuscle(exercises, logs, refDate)`'s third argument buckets by the Monday-of-week containing `refDate` — passing each loop iteration's `wkMonday` reuses the exact convention `gym-volume-logic.js` already establishes (confirmed via its own doc comment and existing call sites in this same file at lines 260, 460, 567).

### Why 3 consecutive weeks, not 2 or 4

3 weeks is the shortest run that can't plausibly be a single busy/light week bleeding into a neighbor (2 adjacent weeks with correlated logging patterns — e.g. a deload week followed by a slow return-to-volume week — could both land "under" without being a real multi-week pattern). 4+ is available as `severity: 'medium'` rather than a separate threshold, so nothing observable is lost by picking 3 as the floor.

### Edge cases

- **New muscle group / no exercises tagged for it**: `weeklySetsByMuscle()` already returns 0 for every `MUSCLE_BANDS` key even with zero logged sets (confirmed in its own doc comment) — a muscle with real zero volume for 3+ weeks flags as `chronic-muscle-under`, gated on `observedWeeks >= 3` (real training history exists, this muscle specifically just isn't in it). Zero volume isn't automatically a mistake — it could be deliberate deprioritization, maintenance, or an injury constraint (Codex review, 2026-08-29) — which is exactly why `reviewQuestion` asks rather than asserts, and why no suppression mechanism is being built for it here (see "Out of scope").
- **Phase change mid-window**: `classifyMuscleVolume()`'s `label` (under/mav/mrv) depends only on the raw MEV/MRV band, not on `phase` (phase only affects the separate `target`/`belowTarget` fields, unused here) — so a phase change mid-window doesn't retroactively reclassify old weeks or create a phantom run. Confirmed by reading `classifyMuscleVolume()`'s implementation, and independently confirmed by Codex review.
- **New user / thin history**: the loop always produces exactly 6 label entries (zero-padding weeks before Row was in use), which could otherwise let a brand-new user's first partial week look like a 6-week "chronic" pattern. Fixed with the `observedWeeks < 3` gate (real logged-session weeks, not zero-padding) — a muscle can't be flagged as chronic until there's real multi-week training history behind the window at all, independent of which specific muscle is under/over.
- **Current in-progress week**: fixed by windowing on 6 *completed* weeks (`lastCompleteMonday` above) — a run can never be started or broken by a week that hasn't finished yet.
- **Deleted/renamed exercises retroactively zero out historical muscle counts**: `weeklySetsByMuscle()` maps logs through the *current* `gymState.exercises` list, so a log for an exercise that's since been deleted or renamed silently drops out of that week's muscle count (confirmed in `gym-volume-logic.js:123-134`, flagged by Codex review). This is an existing, inherited limitation of `weeklySetsByMuscle()` itself — already true today for every other caller (the Progress tab, `volumeAdvisory`) — not something this pass introduces or needs to solve. Accepted as a known limitation, same posture as this codebase's other documented-not-fixed edge cases (e.g. the DST case in `localDateKey`, accepted tonight in a separate build).

### Out of scope (this pass)

- Exercise-selection quality critique (compound/isolation balance, stretch-focused variant coverage) — a different axis than volume, not what "chronic mismatch" means here.
- Forward-looking mesocycle/block planning (proactively scheduling a specialization block) — this stays a backward-looking pattern detector, consistent with every other finding in this file.
- A UI surface in `weekly-review.html` itself for these findings (badges, a dedicated panel) — the existing `findingsHtml` rendering already displays whatever `runInsightEngine()`-shaped findings exist generically; confirm during implementation whether it needs the new `muscle`/type strings added to its display logic, but no new UI is being designed here.

## Testing

**`training-insight-engine.selfcheck.cjs`**: extend with `detectChronicMuscleVolume()` cases —
- `observedWeeks < 3` with an otherwise-qualifying 3-week "under" run → `null` (not enough real training history)
- `observedWeeks >= 3`, 2 consecutive "under" weeks → `null` (run too short)
- `observedWeeks >= 3`, exactly 3 consecutive "under" weeks → fires, `severity: 'low'`
- `observedWeeks >= 3`, 4+ consecutive "under" weeks → fires, `severity: 'medium'`
- `observedWeeks >= 3`, 3 consecutive "mrv" weeks → fires as `chronic-muscle-over`
- most recent week is "mav" (even after a prior "under" run) → `null` (broken streak, matches trailing-run-only semantics)
- `observedWeeks >= 5` → `confidence: 'medium'`; `observedWeeks` 3-4 → `confidence: 'low'` (independent of run length — a run spanning the full window is never penalized for it)

**`weekly-review.html`**: no existing test harness for this file (matches this session's other Row builds — verification is manual tracing + a local static-server browser check). Trace:
- Seed `gymState.logs` with 3+ **completed** weeks of a single muscle's sets below its `MUSCLE_BANDS` MEV, real sessions logged each week — confirm a `chronic-muscle-under` finding appears in the `findings` array passed to the `app_state` write, alongside (not replacing) any `detectVolumePhaseSignal`/`detectStalledExercise` findings already firing.
- Seed the same scenario but with only 1-2 weeks of real logged sessions (rest zero-padded, simulating a new user) — confirm no `chronic-muscle-*` finding fires despite the label run being long enough.
- Confirm the window excludes today's in-progress week: seed a near-empty current week for a muscle otherwise well within MAV for the prior 6 completed weeks — confirm no false "under" run starts.
