# Intensifiers Section — gym.html Design Spec

## Goal

Surface drop sets, cluster sets, and supersets — the intensifier techniques with genuine time-efficiency/fatigue-management value (per the 2026-08-27 vault research pass, [[Intensifier Evidence Ranking — What Actually Beats Traditional Sets]]) — directly inside Row's workout-logging flow, instead of leaving them as vault-only reference material. Not in scope for this pass: rest-pause and stretched-position exercise swaps (explicitly deferred by Carl).

## Non-goals

- No new exercise-management screen. No dedicated "browse all exercises, toggle intensifiers" list view.
- No cross-exercise linking for supersets (both exercises in a pair are tagged independently, not linked to each other).
- No automatic technique selection/recommendation of *which one* to use — the three options are always offered together; the lifter picks.
- No changes to `saveSet()`'s signature or the existing set-log data shape beyond one new optional field.

## Data model changes

### 1. Exercise definitions — new `isolation` field (default-eligibility signal)

Add `isolation: true` to exercise objects in the seed data (the array starting ~line 79) that are single-joint/machine movements: curls, extensions, flyes, raises, pushdowns, machine presses, cable rows, etc. Leave compounds (squats, deadlifts, barbell presses/rows, hack squat, RDL) untagged, same as today's default (`undefined`/falsy).

This is a one-time manual tagging pass across the 41 seed exercises — not inferred from `loadType` or name-matching (neither is a reliable enough signal; explicit tagging is correct here per the exercise count being small).

### 2. Per-exercise override — new persisted state

New state bucket, same shape/pattern as the existing `getSession(ex.id)` per-exercise state:

```js
// state.intensifierEnabled[ex.id] : boolean | undefined
// undefined -> fall back to ex.isolation (the seed-data default)
// true/false -> explicit user override, takes priority over the seed default
function intensifiersEnabledFor(ex) {
  const override = state.intensifierEnabled[ex.id];
  return typeof override === 'boolean' ? override : !!ex.isolation;
}
```

Persisted via the existing `saveState()`/state-serialization path — no new storage mechanism.

### 3. Set log entries — new optional field

No changes to `saveSet(ex, w, reps, entry)`'s signature. When a technique is armed, the caller passes `{ technique: 'dropset' | 'clusterset' | 'superset' }` as (part of) `entry`, which `saveSet` already merges into the logged row via `Object.assign(...)`. Sets logged without an armed technique are unaffected — `technique` is simply absent, same as every existing log entry today.

## UI changes

### Reference content — static data block

A new `INTENSIFIER_TECHNIQUES` object near the top of gym.html (alongside the other seed-data constants), one entry per technique:

```js
const INTENSIFIER_TECHNIQUES = {
  dropset: {
    label: 'Drop set',
    blurb: 'Same exercise, reduce the load and go again with no rest once you hit failure. Time-efficient — matches straight-set growth, not extra growth.',
  },
  clusterset: {
    label: 'Cluster set',
    blurb: 'Same load, short (10-20s) intra-set rest breaks before continuing the set. Manages fatigue — matches straight-set growth, not extra growth.',
  },
  superset: {
    label: 'Superset',
    blurb: 'Pair with a second exercise, little/no rest between them. Cuts session time — matches straight-set growth for hypertrophy/strength.',
  },
};
```

Wording sourced from the vault's Intensifier Evidence Ranking note — deliberately includes the "matches, not exceeds, straight-set growth" caveat inline so the in-app reference doesn't overstate what the research supports.

### Rx card — new intensifier row

In `renderRx()`, after the existing `liftLabInfo(ex)` output, for any exercise where `intensifiersEnabledFor(ex)` is true, render a new row:

- A small toggle/checkbox: "Enable intensifiers for this exercise" — reflects and writes to `state.intensifierEnabled[ex.id]`. This is what gives Carl manual pick-your-own control per exercise, independent of the `isolation` seed tag.
- Three tappable chips: Drop set / Cluster set / Superset (labels from `INTENSIFIER_TECHNIQUES`).
  - Tapping a chip toggles an expanded one-line `blurb` inline directly under the row (reference-lookup half of the feature).
  - Tapping a chip also arms that technique (`pendingTechnique = 'dropset' | 'clusterset' | 'superset'`) for the *next* `saveSet()` call on this exercise. Tapping the same chip again disarms it (toggle off).
  - Only one technique can be armed at a time per exercise (tapping a second chip replaces the first, doesn't stack).

For exercises where `intensifiersEnabledFor(ex)` is false, the row doesn't render at all — same as today (no `formTip` row shows when there's no tip).

### Arming/clearing lifecycle

- `pendingTechnique` state is per-exercise, held alongside other per-exercise session state (same object as `activeVariant` in `getSession(ex.id)`).
- Consumed (attached to `entry.technique`, then cleared) the moment `saveSet()` is called for that exercise — so it applies to exactly one logged set, not every subsequent set until manually cleared.
- Cleared (not just left stale) when switching to a different exercise or a different training day, so an armed chip never silently attaches to an unrelated set later in the session.

## Error handling / edge cases

- No technique armed → logging behaves exactly as it does today, zero behavior change.
- Superset: both exercises in the pair get `technique: 'superset'` tagged independently on their own logged sets — no shared ID, no cross-reference. If Carl wants linked-pair analysis later, that's a distinct future feature, not silently half-built here.
- Toggling "enable intensifiers" off while a technique is armed clears the pending state too (don't leave an armed technique that the UI no longer shows a way to see/cancel).
- Compound exercises never show the row by default (no `isolation` tag) — but Carl can still manually enable it via the toggle if he wants to log a technique on a compound (e.g., a deadlift superset), consistent with "override, don't hardcode block."

## Testing

Matches the existing precedent for this file's inline UI code (`formTip`/`liftLabInfo` and other Rx-card rendering have no automated test coverage) — no new test-framework requirement introduced here. Verification is live in-browser:
1. Row appears only for isolation-tagged (or manually-enabled) exercises, absent otherwise.
2. Tapping a chip shows/hides the correct blurb and arms/disarms the correct technique.
3. Logging a set with a technique armed produces a log entry with the correct `technique` field; logging without one armed produces no `technique` field (unchanged from today).
4. Switching exercises or the day clears any armed technique.
5. The per-exercise enable toggle persists across a page reload (state round-trips through `saveState()`/reload correctly).

## Related

- [[Intensifier Evidence Ranking — What Actually Beats Traditional Sets]] (vault) — source of the technique descriptions and the "time-efficiency not extra growth" framing
- `gym.html`'s existing `renderRx()`/`liftLabInfo()` (~line 4541-4548) and `saveSet()` (~line 6483) — the two functions this feature extends
