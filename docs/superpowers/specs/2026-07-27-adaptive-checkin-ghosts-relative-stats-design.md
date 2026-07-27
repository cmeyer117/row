# Adaptive Check-In, Ghosts, and Relative Stats — Design

Date: 2026-07-27
Status: Approved, ready for implementation plan

## Context

Three small features for `gym.html`'s progressive-overload coach, sourced from a GitHub survey of open-source workout trackers (FitnessTrack's check-in loop, `bndct-devops/forge`'s ghost-logging UX, ASAP's relative-strength stats). All three are additive to the existing prescription engine (`getRx()`), not replacements.

Separately reported: the post-workout debrief (`fireDebrief()`) "didn't really work last time" — this is a bug, out of scope for this design, to be traced separately via `systematic-debugging`.

## 1. Adaptive check-in

**Trigger:** once per day, right before "Mark Done" — not per-exercise (too much friction, degrades data quality) and not folded into the existing joint-pain picker (different signal: joint pain is injury-risk on a specific joint, this is whole-muscle-group training readiness — keep them separate inputs).

**Input:** three independent 3-point taps — pain / recovery / pump, each Low / Med / High. One screen, ~3 taps total.

**Effect on `getRx()`, applied in this order (pain checked first, recovery only if pain didn't already override):**
1. **Pain = High** → always forces `down` — same shape as the existing 3-stuck-sessions deload path (drop 10%, reset reps to `repMax`), regardless of what the rep-based logic would have said. Safety gate, not a suggestion. This check runs first and short-circuits the rest — if pain is High, recovery's rule below never runs. **Bodyweight exercises need their own High-pain path**: the `bw` branch of `getRx()` has no weight to drop 10% off of — High pain on a bodyweight exercise should fall back to that branch's existing "repeat" behavior (hold at `repMin` reps) instead of trying to force a weight-based deload that doesn't apply.
2. **Recovery = Low** (only checked if pain isn't High) → downgrades an `up` result to `hold`. Doesn't touch `hold` or `down` results. **Must replace the entire prescription object** (weight, reps, tag, reason) when downgrading, not just flip `type` — otherwise the card could say "hold" while still showing the upgraded weight/reps text. Med/High recovery leaves existing logic untouched.
3. **Pump** → informational only, independent of the above. Logged and shown as a note on the exercise's Rx card next time it's viewed. No rule modifies the prescription from pump — there's no honest weight/rep adjustment for a signal this fuzzy, and a fake-precise rule would be worse than none.

**Scope note:** the check-in is once per calendar day, applied uniformly to every exercise trained that day — it is not tracked per individual muscle group within a mixed-muscle-group day, despite "adaptive check-in" implying per-group granularity. One check-in = one day's signal for everything logged that day.

**Timing:** the check-in is collected at the end of today's session and affects `getRx()` for the *next* time each of today's exercises is trained (which may not be "tomorrow" — could be days later depending on the split). Store it keyed by the date it was collected (`state.checkins[dateKey]`), and have `getRx()` look up the most recent checkin *prior to* the session currently being prescribed for — not blindly "today's checkin," which would incorrectly reapply to the same day's own already-completed logs if `getRx()` is called again later that day.

**Data:** new state array, `state.checkins[dateKey] = { pain, recovery, pump }`, one entry per session day. `getRx()` needs to accept the relevant checkin (if any) as an added parameter and apply the pain/recovery modifiers after computing its normal result, before returning. Every `getRx()` return path — including the bodyweight branch and the early `null`-on-no-logs branch — must consistently expose the `stuck` counter (see Section 3), not just the paths that already happen to compute it.

## 2. Ghosts (tap-to-accept)

Row's quick-log is freeform text (`"bench 225×8"`), not a structured form — so a literal "last session's numbers as a ghost" doesn't map directly onto the input. Instead: make the existing `renderRx()` card (currently static text showing the computed suggestion) tappable. One tap calls `quickLog()` with that exact weight/reps for the current exercise, using the existing logging pipeline unchanged.

This is arguably better than a raw last-session ghost, since Row's Rx is already the forward-looking adaptive target, not a repeat of history.

No new state. Click handler on the existing `#rxWrap` card.

## 3. Relative stats

- **e1RM ÷ bodyweight**: one new line in `renderStats()`, dividing the existing `estimate1RM()` output by the most recent entry in `po_coach_weights` (already tracked, synced via the legacy `PC_SYNCED_KEYS` path). No new tracking needed.
- **Stalled-lift alert**: `getRx()` already computes a `stuck` counter (consecutive sessions at the same weight) for its 3-session deload trigger. Expose that count on the returned Rx object, and add a "stalled" badge to the Progress tab's per-exercise cards when `stuck >= 4` — separate from the existing PR badge, no new computation. **Suppress the badge whenever the current Rx type is already `down`** — once the existing deload logic (or the new pain-driven override above) has fired, showing "stalled" alongside it is redundant, not informative. The badge only adds value while the lift is stuck but *not yet* in an active deload.

## Out of scope

- Post-workout debrief bug (separate debugging task)
- Any change to the joint-pain system's own logic or thresholds
- Bodyweight *input* UI — already exists via `po_coach_weights`, this only reads it
