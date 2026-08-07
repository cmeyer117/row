# Phase-Aware Rx — Design

**Date:** 2026-08-07
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Goal

Row Upgrades ranking #4. `getRx()` in `gym.html` already prescribes per-exercise weight/reps (double progression, stuck-streak detection, RIR-aware stall softening) but is phase-blind — it treats a cut, a growth phase, and a reverse diet identically, despite Row's own `PHASES`/season tracking (`po_coach_season`) already knowing which one is active. This makes the prescription phase-correct.

## Ground truth (verified in-session, 2026-08-07)

- `getRx(ex, logs)` (`gym.html:3456`) is called from 3 sites (lines 3970, 4365, 5447), all within the same module scope. `loadSeason()` (`gym.html:7089`) reads `po_coach_season` from localStorage but is **not** in scope where `getRx()` lives — it's defined inside a separate IIFE in a later `<script>` block. **Correction found during implementation:** `getRx()` reads `po_coach_season` directly via its own one-line `localStorage.getItem`/`JSON.parse` instead of calling `loadSeason()`, rather than exposing a new cross-block global for a single field read.
- Current non-bw logic: `upgradeAt = Math.min(CONFIG.upgradeAtReps || 8, repMax)`; deload/reassess triggers at `stuck >= 3` consecutive same-weight sessions.
- Jarvis's own `coach-read.ts` (`checkExerciseStall`) already groups phases the same way this design does: `cut`/`show_prep` share one branch, `growth` and `reverse_diet` are each distinct, `peak`/null return no check. This design reuses that exact grouping rather than inventing a new one.
- No existing pure-logic module covers Rx thresholds — `gym-season-logic.js` is unrelated (pure date math for the season banner only).
- Bodyweight (`bw`) exercises use `upgradeAt` in their own branch but have no deload/stall branch at all (bodyweight can't be reduced) — the stall-threshold bias is inapplicable there.

## Behavior

New pure module `gym-rx-phase-logic.js`:

```javascript
function phaseAdjustedThresholds(baseUpgradeAt, baseStuckThreshold, phase, repMax) {
  var upgradeAt = baseUpgradeAt;
  var stuckThreshold = baseStuckThreshold;
  if (phase === 'cut' || phase === 'show_prep') {
    upgradeAt += 1;
    stuckThreshold = Math.max(1, stuckThreshold - 1);
  } else if (phase === 'growth') {
    upgradeAt -= 1;
  } else if (phase === 'reverse_diet') {
    stuckThreshold += 1;
  }
  // peak, null, or any unrecognized phase: unchanged (today's exact behavior)
  upgradeAt = Math.max(1, Math.min(upgradeAt, repMax));
  return { upgradeAt: upgradeAt, stuckThreshold: stuckThreshold };
}
```

`getRx()` changes:
1. Read `po_coach_season` directly (try/catch JSON parse) into `seasonPhase` at the top — not via `loadSeason()` (out of scope, see above).
2. Compute `thresholds` via `window.GymRxPhaseLogic.phaseAdjustedThresholds(Math.min(CONFIG.upgradeAtReps || 8, repMax), 3, seasonPhase, repMax)`, guarded with an inline fallback to today's exact defaults if the script somehow hasn't loaded (defensive, matches this codebase's existing `window.X ? ... : ...` guard pattern elsewhere).
3. Replace the hardcoded `stuck >= 3` condition (the deload/reassess branch) with `stuck >= stuckThreshold`.
4. The bodyweight branch reuses the same phase-adjusted `upgradeAt` (already shared) — no other bw change, since bw has no stall/deload branch to adjust.
5. No signature change to `getRx(ex, logs)` and no call-site edits.

## Error handling

- No season set (`loadSeason()` returns `null`) → `phase = null` → thresholds unchanged, matching today's exact behavior for anyone without an active season (backward compatible).
- Unrecognized/future phase string → falls through to the unchanged default, same as `null` (fail-safe, never crashes on an unexpected value).
- `upgradeAt` is clamped to `[1, repMax]` after the phase delta so a cut's `+1` can never push the threshold past what's achievable for that exercise's rep range.

## Non-goals

- No change to `applyCheckinOverride` (pain/recovery pause logic) — orthogonal, stays phase-blind.
- No new UI surface — this only changes the thresholds feeding Row's existing prescription text.
- No new season phases, no change to `PHASES`/the season picker.
- Exact numeric deltas (±1 rep, ±1 session) are not sourced from Eastman's specific guidance — they're the audit's small structural nudges mirroring Jarvis's existing phase philosophy. If Eastman later sends explicit ramp/volume numbers (tracked separately as an open item, expected to flow in via the Eastman Auto-Sync task), those recalibrate these deltas — not a new mechanism, just new numbers.

## Verification

- `gym-rx-phase-logic.selfcheck.cjs`: default/no-phase unchanged; cut and show_prep both get `upgradeAt+1`/`stuckThreshold-1`; growth gets `upgradeAt-1`/`stuckThreshold` unchanged; reverse_diet gets `stuckThreshold+1`/`upgradeAt` unchanged; peak unchanged; unrecognized phase string unchanged; `upgradeAt` never exceeds `repMax` or drops below 1; `stuckThreshold` never drops below 1.
- Browser: for one exercise, seed a stall (2 same-weight sessions) under `cut` — confirm Row now suggests reassess/deload at 2, not 3; under default/no-season, confirm the same 2-session stall does NOT yet trigger (still requires 3) — this is the regression check that nothing changed for existing users without a season set.
