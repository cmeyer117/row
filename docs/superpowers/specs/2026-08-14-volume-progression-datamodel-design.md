# Volume-Progression Data-Model Upgrade — Design

**Date:** 2026-08-14
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

`gym-volume-logic.js` (shipped 2026-08-13) already tracks weekly set counts per muscle against static MEV/MAV/MRV bands and feeds an `add_set`/`pull_back` advisory into `getRx()`. It's a real first pass, but three gaps remain, all flagged independently by Codex's 2026-08-14 project audit (`Downloads/row-audit-2026-08-14.md`):

1. **Every logged set counts equally**, regardless of how close to failure it was. A set left with 5+ reps in reserve doesn't drive the same hypertrophy stimulus as a genuinely hard set, so counting them the same overstates real training volume.
2. **Only the exercise's single tagged `.muscle` counts.** A press or row also meaningfully loads a secondary muscle group (triceps on presses, biceps on pulls) — that contribution is currently invisible to the volume count entirely.
3. **The bands are phase-blind population defaults.** The same MEV/MAV/MRV numbers apply whether Carl is in a growth phase (where climbing volume is a real lever) or a cut (where preserving minimum-effective volume while other levers — diet — do the work is the right call). `gym-rx-phase-logic.js` already phase-adjusts *load* thresholds; volume targets don't get the same treatment.

This is the data-model half of a two-part build (queued next: a phase-expert gym coach that depends on this data model, and later a week-review UI surface that consumes it — both explicitly out of scope here).

## Scope

In scope: `gym-volume-logic.js`'s counting/classification/advisory logic, and the two existing `gym.html` call sites that already consume it (`getRx()`'s inline advisory, the Progress-tab volume panel). No new UI, no new Supabase tables, no schema changes — this upgrades what the existing wiring computes and displays, it doesn't add a new surface.

Out of scope (explicitly deferred, not forgotten): a week-review UI showing planned-vs-performed and proposing one change per muscle; per-muscle "priority" weighting (Carl has no specific weak points to weight differently yet); auto-ramping reverse-diet targets from `mavLow` toward `mavHigh` as recovery data accumulates (needs its own design once there's real phase-transition data to calibrate against).

## Design decisions (confirmed with Carl)

- **Hard-set threshold:** a set with RIR explicitly logged at ≥4 is excluded from the count. A set with no RIR logged, or RIR <4, counts. This reuses the exact RIR≥3 "not near failure" threshold already established in `getRx()`'s stall-reassessment logic (rounds up to 4 as the exclusion floor so a logged RIR of exactly 3 — "one more clean rep left" — still counts as hard), and defaulting missing-RIR to "counts" avoids retroactively invalidating months of pre-RIR-field historical data.
- **Contribution weights:** primary muscle gets weight 1.0 per hard set; a curated secondary-muscle map (below) adds 0.5 where the synergist relationship is a well-established, textbook one (EMG-supported) — not every minor stabilizer — except RDL-pattern glute credit, bumped to 0.7 after an independent Gemini fact-check (see the map's own comment). Carl asked for these to be scientifically defensible defaults he can hand-tune later, not an exhaustive biomechanical model.
- **Known simplification, not fixed for this pass:** biceps secondary credit on rows/pulldowns is a flat 0.5 regardless of grip, even though a pronated/overhand pull recruits meaningfully less biceps than a neutral or supinated one (Gemini fact-check caveat, 2026-08-14). Modeling grip would need a new per-exercise dimension — deferred until the flat weights have been used in practice for a while. Ceiling: this overstates true biceps volume specifically for overhand-grip pulls (of the six biceps-tagged rows here, `Lat Pulldown` — the one entry with no explicit grip in its name, as distinct from the separately-tagged `Neutral Grip Lat Pulldown` — is the most likely candidate for a wide/pronated grip and therefore the most likely to be overstated).
- **Phase targets:** applied uniformly across all muscles (no per-muscle priority weighting yet). `growth` → target = `mavHigh` (climb toward the top of the effective range). `cut`/`show_prep`/`reverse_diet` → target = `mavLow` (hold at minimum-effective; reverse diet does not auto-ramp toward `mavHigh` in this pass — that's the deferred auto-ramp feature above). `peak`/no season set/unrecognized phase → no target (falls back to today's exact stall-only behavior, unchanged).

## Data model

### `EXERCISE_MUSCLE_CONTRIBUTIONS` (new, in `gym-volume-logic.js`)

Name-keyed map, same convention as `coaching-exercise-meta.js`'s `META` (keyed by exercise name, not id — names are stable, ids are seed-generated). Only exercises with a real secondary contribution appear; everything else implicitly has none.

```js
var EXERCISE_MUSCLE_CONTRIBUTIONS = {
  // Pressing compounds -- triceps is the standard secondary mover in all
  // horizontal/incline/overhead pressing (EMG-established, e.g. Barnett
  // et al. and standard ACE/NSCA compound-lift synergist tables).
  'Neutral Grip Shoulder Press Machine': { muscle: 'Triceps', weight: 0.5 },
  'Smith Machine Flat Chest Press':      { muscle: 'Triceps', weight: 0.5 },
  'Chest Dip':                           { muscle: 'Triceps', weight: 0.5 },
  'Dumbbell Incline Chest Press':        { muscle: 'Triceps', weight: 0.5 },
  // Narrow-grip/close-grip bench is triceps-primary by design, but still
  // loads the chest substantially (well-documented -- it's a pressing
  // pattern, not a triceps isolation move).
  'Smith Machine Narrow Grip Bench':     { muscle: 'Chest', weight: 0.5 },

  // Rowing/pulldown compounds -- biceps is the standard secondary mover in
  // all pulling patterns (elbow flexion is a real, load-bearing component,
  // not incidental).
  'Lat Pulldown':                    { muscle: 'Biceps', weight: 0.5 },
  'Cable Seated Row (Neutral Grip)': { muscle: 'Biceps', weight: 0.5 },
  'Machine High Row':                { muscle: 'Biceps', weight: 0.5 },
  'Machine Low Row':                 { muscle: 'Biceps', weight: 0.5 },
  'Chest Supported T-Bar Row':       { muscle: 'Biceps', weight: 0.5 },
  'Neutral Grip Lat Pulldown':       { muscle: 'Biceps', weight: 0.5 },

  // Hip-hinge/squat patterns -- glutes are a major, well-documented
  // secondary mover in RDLs (often near-primary) and squat-pattern moves.
  // Weight is lower (0.3) for squat/press-style leg moves where quads
  // clearly dominate, higher (0.7) for RDLs, where hip extension is the
  // PRIMARY joint action of the movement -- glutes and hamstrings are
  // closer to co-primary than primary/secondary in a true hip hinge
  // (Gemini fact-check, 2026-08-14: flagged an initial 0.5 as an
  // underweight for exactly this reason -- 0.7 lands between its
  // suggested 0.8-1.0 and the "still secondary in this app's bookkeeping"
  // constraint of not fully double-counting one set as full credit toward
  // two separate muscles' MEV/MAV/MRV progressions).
  'Hack Squat':                   { muscle: 'Glutes', weight: 0.3 },
  'Cybex Leg Press':              { muscle: 'Glutes', weight: 0.3 },
  'Dumbbell Heel Elevated Lunge': { muscle: 'Glutes', weight: 0.2 }, // heel-elevated is deliberately quad-biased
  'Dumbbell B-Stance RDL':        { muscle: 'Glutes', weight: 0.7 },
  'Smith Machine RDL':            { muscle: 'Glutes', weight: 0.7 },

  // Everything else (isolation moves: flies, raises, curls, extensions,
  // leg extension/curl, calf raises; and quad-biased-by-design moves like
  // Sissy Leg Press and the Hip Adduction Machine) has no meaningful
  // secondary mover and is intentionally absent from this map.
};
```

### `weeklySetsByMuscle(exercises, logs)` — rewritten in place

Same name and signature (no call-site changes needed). Behavior change: for each exercise's logs in the current week, a set only counts if `log.rir == null || log.rir < 4`. A counting set adds `1.0` to its primary muscle (`ex.muscle`) and, if `EXERCISE_MUSCLE_CONTRIBUTIONS[ex.name]` exists, adds that entry's `weight` to that entry's `muscle`. Untagged/adhoc exercises remain excluded, unchanged. Result values become fractional (e.g. `6.5`) rather than always-integer — bands/comparisons already work on plain numbers, no downstream change needed for that.

### `phaseTarget(muscle, phase)` — new

```js
function phaseTarget(muscle, phase) {
  var band = MUSCLE_BANDS[muscle];
  if (!band) return null;
  if (phase === 'growth') return band.mavHigh;
  if (phase === 'cut' || phase === 'show_prep' || phase === 'reverse_diet') return band.mavLow;
  return null; // peak, null, or any unrecognized phase -- no target, today's behavior
}
```

### `classifyMuscleVolume(muscle, count, phase)` — gains `phase` param

Returns the existing fields (`label`, `mev`, `mavLow`, `mavHigh`, `mrv`) plus `target` (from `phaseTarget`, possibly `null`) and `belowTarget` (`target != null && count < target`).

### `volumeAdvisory(band, stalled, phase)` — gains `phase` param

- `band.label === 'under'` → `add_set` (unchanged — a real gap below MEV regardless of phase).
- `band.label === 'mrv'` → `pull_back` (unchanged — fatigue risk regardless of phase).
- `band.label === 'mav'`:
  - `band.belowTarget` → `add_set`, with phase-flavored wording: `growth` frames it as "this phase wants volume, push toward MAV"; `cut`/`show_prep`/`reverse_diet` frames it as "hold at minimum-effective volume while other levers do the work."
  - else if `stalled` → `add_set` (today's existing stall-driven case, unchanged reason text).
  - else → `null` (unchanged).

## `gym.html` wiring changes

Both existing call sites already read `po_coach_season` (or can trivially, matching the exact one-line pattern `gym-rx-phase-logic.js` already established for `getRx()`) and pass `phase` through to `classifyMuscleVolume`/`volumeAdvisory`:

1. `getRx()` (~line 3506) — already reads `po_coach_season` for phase-adjusted load thresholds; reuse that same value for the volume calls instead of re-reading it.
2. Progress-tab volume panel (~line 4497) — currently doesn't read phase at all; add the same one-line `localStorage.getItem('po_coach_season')` read used elsewhere, so the dashboard's per-muscle status agrees with what `getRx()`'s advisory is using for the same muscle.

## Error handling

- Unknown muscle name → `classifyMuscleVolume` returns `null`, unchanged from today.
- No season set → `phase` is `null` → `phaseTarget` returns `null` for every muscle → `belowTarget` is always `false` → advisory falls back to today's exact stall-only behavior. This is the regression guard: nothing changes for the no-season case.
- Untagged/adhoc/custom exercises → excluded from both primary and secondary counting, unchanged from today.
- An exercise name that doesn't match any key in `EXERCISE_MUSCLE_CONTRIBUTIONS` → no secondary contribution, not an error (this is the expected case for ~55% of the exercise library — isolation moves genuinely have no meaningful secondary mover).

## Testing

Extend `gym-volume-logic.selfcheck.cjs`:
- `weeklySetsByMuscle`: a set with RIR 4 is excluded; a set with RIR 3 counts; a set with no RIR counts; a set on an exercise with a secondary-muscle entry adds the correct weight to the secondary muscle in the same week; an exercise with no map entry contributes only to its primary muscle; untagged/adhoc exercises stay excluded (existing case, re-verified against the new logic).
- `phaseTarget`: growth → `mavHigh`; cut/show_prep/reverse_diet → `mavLow`; peak/null/unrecognized string → `null`; unknown muscle → `null`.
- `classifyMuscleVolume`: `target`/`belowTarget` correctly populated per phase; unknown muscle still returns `null`; label thresholds unchanged from today's existing cases.
- `volumeAdvisory`: under-MEV → `add_set` regardless of phase argument; at-MRV → `pull_back` regardless of phase argument; in-MAV + `belowTarget` under `growth` → `add_set` with growth-flavored reason text; in-MAV + `belowTarget` under `cut` → `add_set` with cut-flavored reason text; in-MAV + not-`belowTarget` + `stalled` → `add_set` (today's existing case, reason text unchanged); in-MAV + not-`belowTarget` + not-`stalled` + `phase=null` → `null` (today's exact no-season behavior, the core regression check).

Browser verification: log a hard set (no RIR) and an RIR-5 set on the same exercise in the same week; confirm the Progress-tab count only reflects the hard one. Set `po_coach_season` to `growth` in localStorage; confirm an in-MAV, non-stalled exercise now shows an `add_set` advisory it didn't show before. Set it to `cut`; confirm the same exercise's advisory reads the cut-flavored reason instead.
