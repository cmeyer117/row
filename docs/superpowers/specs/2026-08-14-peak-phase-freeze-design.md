# Peak-Phase Freeze + Escalation — Design

**Date:** 2026-08-14
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

`peak` is one of Row's five season phases (`PHASES = { cut, reverse_diet, growth, peak, show_prep }`, `gym.html:7117`), but it currently gets **zero special handling** anywhere in the codebase:

- `gym-rx-phase-logic.js`'s `phaseAdjustedThresholds()` explicitly falls through unchanged for `peak` (documented as "unchanged, today's exact behavior" in its own design doc).
- The just-shipped volume-progression `phaseTarget()` also returns `null` for `peak` (same "no target, falls back to stall-only" behavior as no phase set at all).

This means during peak week — the highest-stakes, lowest-error-tolerance week of a prep — Row behaves *exactly* like it does with no season set: it still suggests weight increases on a good session, still triggers algorithmic deloads on a stall pattern, still surfaces volume `add_set`/`pull_back` advisories. Codex's 2026-08-14 project audit flagged this directly: peak week should "cease autonomous progression... run a checklist for consistency... clear escalation to Carl/the human coach... no algorithmic peak-week manipulation." Today's code does the opposite of that by default.

This is scoped narrowly (peak-phase freeze only) rather than Codex's full 4-phase `coachSnapshot` vision, because most of the inputs that vision needs (cardio dose/completion, sleep, posing checks, macro adherence as trackable state) don't exist as Row-local data today — they only reach Jarvis via its own tool call at chat time. Growth/cut/reverse_diet already have real phase-aware behavior from the load-threshold and volume-target work already shipped; peak is the one phase where "phase-aware" currently means "identical to no phase," and it's the phase where getting that wrong carries the most risk.

## Behavior

New pure module `gym-peak-phase-logic.js`, mirroring the existing `gym-rx-deload-logic.js`/`gym-rx-phase-logic.js` convention (no DOM, no Supabase, dual `window`/`module.exports`):

```js
function peakFreezeResult(ex, last, stuck) {
  if (ex.bw) {
    return { type: 'hold', weight: 0, reps: last.reps, tag: 'Peak — hold', bw: true, stuck: stuck };
  }
  return { type: 'hold', weight: last.weight, reps: last.reps, tag: 'Peak — hold', stuck: stuck };
}
```

`getRx()` changes: immediately after `stuck`/`stuckAvgRir` are computed (`gym.html:3451`) and before the bodyweight/weighted decision trees run, add:

```js
if (seasonPhase === 'peak') {
  const frozen = window.GymPeakPhaseLogic
    ? window.GymPeakPhaseLogic.peakFreezeResult(ex, last, stuck)
    : { type: 'hold', weight: bw ? 0 : weight, reps: bw ? reps : reps, tag: 'Peak — hold', bw: bw, stuck: stuck };
  frozen.reason = bw
    ? 'Peak week: holding at ' + last.reps + ' reps, no autonomous changes. Flag anything off (pain, unusual fatigue, missed lifts) to your coach directly.'
    : 'Peak week: holding at ' + last.weight + unit() + ' \u00d7 ' + last.reps + ', no autonomous changes. Flag anything off (pain, unusual fatigue, missed lifts) to your coach directly.';
  return applyCheckinOverride(frozen, last, ex, stuck);
}
```

This is an early return — the exact same control-flow shape the existing `bw` branch already uses (`gym.html:3452-3464`, also an early return before the volume-advisory block). Three consequences fall out of that for free, without extra guards:

1. **No autonomous progression.** The frozen result is always `type: 'hold'` at exactly last session's weight/reps — never `'up'` (no suggested increase), never `'down'`/`'Reassess'` from a stall pattern (no algorithmic deload/reassess).
2. **No volume advisory during peak.** `getRx()`'s volume-advisory block (`gym.html:3503-3509`) sits *after* this new early return, in the same position the `bw` branch already skips it from. Peak-phase Rx cards get no `add_set`/`pull_back` suggestion at all — reusing the existing skip mechanism rather than adding a new phase check.
3. **Safety overrides still apply.** `applyCheckinOverride()` still runs on the frozen result, unchanged. A logged `pain: 'high'` still triggers its existing deload branch — freezing autonomous *progression* isn't the same as suppressing an injury-prevention circuit-breaker, and peak week is exactly when that safety check matters most. The `recovery: 'low'` branch (which only fires when `result.type === 'up'`) is naturally inert during peak, since the frozen result is never `'up'` — no extra guard needed there either.

## Escalation

No new notification/messaging mechanism — Row has none today, and building one is out of scope. "Escalate to your coach" is carried entirely by the Rx reason text itself (above), which explicitly tells Carl this is a hold-steady, non-autonomous week and to flag anything off directly rather than expect the app to react to it.

## Out of scope

- Codex's full `coachSnapshot`/4-phase deterministic policy layer (cardio, sleep, posing, macro adherence as tracked inputs) — deferred; most of that data doesn't exist as Row state yet.
- A static posing/GI/sodium/carb checklist UI — Row tracks none of that data today, so a checklist would be inert. Deferred until/unless that data gets tracked at all.
- Any change to `growth`/`cut`/`reverse_diet`/`show_prep` phase behavior — untouched, already phase-aware from prior work.

## Testing

`gym-peak-phase-logic.selfcheck.cjs`: `peakFreezeResult()` for a bodyweight exercise returns `{ type: 'hold', weight: 0, reps: last.reps, bw: true }`; for a weighted exercise returns `{ type: 'hold', weight: last.weight, reps: last.reps }`; `stuck` passes through unchanged in both cases (informational only, doesn't drive the frozen decision).

`getRx()`'s wiring itself stays untested glue, consistent with how `gym-rx-phase-logic.js`/`gym-rx-deload-logic.js` are already integrated (the extracted pure function gets a test file, the call site doesn't).

Browser verification: set `po_coach_season` to `{ phase: 'peak' }` in localStorage, reload `gym.html`, and confirm an exercise that would normally show an "Add weight" or "Deload" Rx now shows "Peak — hold" at last session's exact numbers with the coach-escalation reason text, and that its volume-advisory line (if it had one before) is gone. Then log a high-pain check-in for that day and confirm the pain-deload override still fires despite the peak freeze.
