# coachSnapshot Phase-Aware Weekly Verdict — Design

**Date:** 2026-08-20
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

BACKLOG.md's "Full phase-expert coachSnapshot layer" (originally envisioned in Codex's 2026-08-14 audit) has had all five data inputs shipped for a week — cardio, sleep, posing, macro-adherence, bodyweight trend — but nothing synthesizes them. `weekly-review.html`'s Prep Readiness panel shows them side by side (raw counts, a 7-day recovery average) with no phase-aware read of how the week is actually going.

## Ground truth (verified in-session)

- `gym.html`'s `getRx()`/`applyCheckinOverride()` already do phase-aware per-exercise threshold biasing (`gym-rx-phase-logic.js`: cut/show_prep tightens, growth loosens, reverse_diet loosens stall tolerance) and a peak-phase freeze (`gym-peak-phase-logic.js`). This feature is a week-level synthesis layer, not a rebuild of that per-exercise logic.
- `weekly-review.html`'s `renderReadinessPanel()` (~line 503) already fetches `gymState`, `health`, `posing` app-state and computes `cardioCount`/`posingCount`/`recoveryTrend`. This build extends that same function and its already-fetched data — one more Supabase read (`recomp-signal` weight/waist series) is the only new fetch.
- Reusable pure functions already exist for every signal except the new phase-verdict math itself: `matchesCountTarget()` (weekly-review.html, cardio/posing), `GymSleepCheckLogic.isPoorSleepEntry()`, `MacroCalc.isPoorMacroAdherence()`, `RecompSignalLogic.computeRecompDelta()`.
- Real exercise-benchmark gap and enhanced-lifter bodyweight thresholds were verified separately this session (Supabase query against `po-coach` exercises; Gemini consult on off-season gain-rate guidelines) — the latter is load-bearing for this spec's bodyweight scoring bands below.

## Scope

A new pure logic module (`coach-snapshot-logic.js`) that scores 5 signals (cardio, posing, sleep, macro adherence, bodyweight trend) each 0/1/2/null for the current week, applies phase-priority weighting, and returns a 3-state verdict (`on_track` / `needs_attention` / `off_track` / `not_enough_data`). Surfaced as a new headline line at the top of `weekly-review.html`'s existing Prep Readiness panel. No changes to `getRx()`/`applyCheckinOverride()` — this is read-only synthesis, not a new autonomous-decision path.

## Signal scoring

Each signal returns `0` (off) / `1` (partial) / `2` (good) / `null` (no data — excluded from both numerator and denominator of the final ratio, not counted as 0).

1. **Cardio** — `matchesCountTarget(target, actualCount)` result: `matched`→2, `partly_matched`→1, `not_matched`→0, `null` target (no Rx set)→null.
2. **Posing** — same function/bands against `posing:log` count vs. Rx. (The new `posing:readiness` Judge's-Eye Index is separate context, not double-counted into this verdict — a deliberate v1 scoping choice, revisit if the readiness index accumulates enough history to be its own signal.)
3. **Sleep** — over this week's `health:sleep` entries (Mon-Sun), count how many are flagged poor via `GymSleepCheckLogic.isPoorSleepEntry()`. 0 poor nights→2, 1→1, 2+→0. Zero entries logged this week→null.
4. **Macro adherence** — same banding over this week's `food_log` days via `MacroCalc.isPoorMacroAdherence()`. Zero days logged→null.
5. **Bodyweight trend** — `RecompSignalLogic.computeRecompDelta(weightSeries, waistSeries, 14, now)` (14-day window — matches the module's own flat-threshold calibration, noisier at 7 days). If `ok: false` (not enough weigh-ins), signal is null. Otherwise convert `weightDelta` (absolute change over 14 days) to a %-of-bodyweight-per-week rate: `rate = (weightDelta / currentWeight) / 2` (14 days = 2 weeks), then band by phase:
   - **growth**: `0 <= rate <= 0.5` → 2 (good); `-0.5 < rate < 0` or `0.5 < rate <= 1` → 1 (partial); `rate <= -0.5` or `rate > 1` → 0 (bad). Thresholds sourced from a 2026-08-20 Gemini consult on enhanced/PED-assisted bodybuilder off-season guidance (J3University/Revive Stronger consensus): 0.25-0.5%/week is the standard target rate, >0.5-1%/week sustained is the commonly-cited "too fast" flag. **Not the natural-lifter thresholds** (which are roughly 5x stricter) — Carl trains enhanced.
   - **cut / show_prep**: `rate < -0.1` → 2; `-0.1 <= rate <= 0.1` → 1; `rate > 0.1` → 0 (gaining during a cut is the bad direction).
   - **reverse_diet / peak / null-phase**: `abs(rate) <= 0.15` → 2; `0.15 < abs(rate) <= 0.35` → 1; `abs(rate) > 0.35` → 0 (stability is the goal, drift either direction is the flag).

## Phase-priority weighting

Two signals get 2x weight (the phase's priority pair), the other three get 1x — every signal still counts, per Carl's explicit call not to zero out non-priority signals.

| Phase | Priority pair (2x) |
|---|---|
| growth | bodyweight, macro |
| cut / show_prep | macro, cardio |
| peak | sleep, posing |
| reverse_diet / null | none — all 5 signals equal weight |

## Verdict computation

```js
function computeVerdict(signals, phase, painHigh) {
  if (painHigh) return { verdict: 'off_track', reason: 'pain_override' };
  var weights = PRIORITY_PAIRS[phase] || {};
  var num = 0, denom = 0;
  Object.keys(signals).forEach(function (key) {
    var score = signals[key];
    if (score == null) return; // excluded, not counted as 0
    var w = weights[key] ? 2 : 1;
    num += score * w;
    denom += 2 * w; // max possible score per signal is 2
  });
  if (denom === 0) return { verdict: 'not_enough_data' };
  var ratio = num / denom;
  var verdict = ratio >= 0.75 ? 'on_track' : ratio >= 0.4 ? 'needs_attention' : 'off_track';
  return { verdict: verdict, ratio: round2(ratio) };
}
```

`painHigh` reads the same `state.checkins[dateKey].pain === 'high'` check `applyCheckinOverride()` already uses, sourced from the most recent checkin in the week window — matches the existing precedent of pain short-circuiting everything else.

## UI (weekly-review.html)

New headline line at the very top of the existing Prep Readiness panel (`renderReadinessPanel()`, inside the `el.innerHTML` template, above the phase/day line):

```
On track  |  Needs attention — sleep, macro adherence  |  Off track — pain flagged  |  Not enough data yet
```

`needs_attention`/`off_track` list which signals scored 0 or 1 (plain English names, not raw keys), so Carl knows what to look at without decoding the ratio. Color-coded with the existing `--good`/`--warn`/`--bad` CSS variables.

## Error handling

- Any/all signals null (new user, no phase set, nothing logged this week) → `not_enough_data`, shown as neutral gray text, not a false "off track."
- Pain=high always wins regardless of how good the other 4 signals look — same precedent as `applyCheckinOverride()`.
- A phase not in `PRIORITY_PAIRS` (reverse_diet, or no phase set) → all-equal weighting, not a crash.

## Out of scope

- No changes to `getRx()`/`applyCheckinOverride()` — this doesn't feed back into autonomous per-exercise decisions, it's a weekly informational read only (matches Carl's "still compute a real verdict during peak" answer — informational, not action-triggering).
- No new UI for adjusting the phase-priority weighting or verdict thresholds — hardcoded constants for v1, matches how `gym-rx-phase-logic.js`'s phase biases are also hardcoded.
- Exercise-benchmark widening (the separate Supabase-verified gap from earlier this session) is explicitly NOT part of this build — flagged as its own follow-up.

## Testing

- `coach-snapshot-logic.selfcheck.cjs` — pure function assertions: each signal-scoring function's bands (incl. null-on-no-data), the weighted-ratio math (incl. all-null → `not_enough_data`, pain override wins regardless of ratio, a phase with no priority pair defined), and the bodyweight rate-conversion math against the Gemini-sourced thresholds.
- Browser verification: load `weekly-review.html` signed in, confirm the new headline line renders above the existing phase/day line, confirm it lists the right signal names when `needs_attention`/`off_track`, confirms `not_enough_data` shows correctly for a fresh state.
