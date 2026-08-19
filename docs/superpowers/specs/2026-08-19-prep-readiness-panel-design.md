# Prep Readiness Panel — Design

## Context

Row's #3 ranked pick from the 2026-08-17/08-18 future-upgrades passes: a phase-aware guardrail view — volume vs. target, recovery trend, cardio/posing completion, mobility exceptions, peak-week freeze status, "needs coach decision" flags. Explicitly **not** a full peak-week engine — that stays deferred until a real contest date and coach process exist. No `contest_date` field exists anywhere in the codebase today (confirmed by grep during brainstorming).

**What already exists:** `gym.html` runs a "Season Engine" (`po_coach_season` in `localStorage`, synced through the `po-coach` app_state row) tracking a coach-directed phase (`cut` / `reverse_diet` / `growth` / `peak` / `show_prep`) and days elapsed in that phase — no calendar date, moved by coach call. `gym-volume-logic.js`'s `classifyMuscleVolume()`/`volumeAdvisory()` already accept this phase and compute phase-target bands. `weekly-review.html` already fetches the full `po-coach` state once per load and already computes `cardioCount`/`posingCount` for the week. None of this is currently surfaced as a single guardrail view — it's scattered across `gym.html`'s Rx cards and `weekly-review.html`'s scorecard.

## Approach

Add a new section to `weekly-review.html`, reusing its existing single `fetchGymState()` call — no new page, no new route, no new sync plumbing.

### Panel contents

1. **Phase badge.** Reads `po_coach_season` from the fetched state: phase label + days-in-phase, same display `gym.html`'s season banner already uses.
2. **Volume vs. target.** The existing `volumeRows` computation, now passing the season phase into `classifyMuscleVolume()` so bands below their phase target are visually flagged — same function, phase argument it already optionally accepts.
3. **Recovery trend.** 7-day average of the `recovery` checkin rating (now populated by the Post-Workout Autopsy) vs. the prior 7-day average, shown as an up/down arrow. Pure arithmetic over `state.checkins`, no new data source.
4. **Cardio/posing completion.** The existing `cardioCount`/`posingCount` for the week, displayed alongside the `cardio_rx`/`posing_rx` free-text prescription from the currently open/due weekly decision, when one exists. `decisions.js` only exposes a lookup for the single open-and-due decision (`getOpenDueDecision`), not a general "most recent regardless of status" query — once a decision is closed out, the Rx text pairing simply doesn't show until the next one opens. No fabricated numeric target either way — the Rx is coach-written free text today, so this stays a display pairing, not a red/green pass/fail (a structured cardio/posing target is a real future upgrade, not invented here).
5. **Mobility exceptions.** Any `state.jointPain` entries logged within the current week, surfaced as a short flag list (joint + severity + date). Reuses the exact data `gym.html`'s joint-pain buttons already write.
6. **Peak-week freeze banner.** When phase is `peak`: "Holding — no autonomous changes," reusing the exact copy `gym.html`'s Rx card already shows during peak week (`gym.html:3544-3545`).
7. **Needs coach decision.** Reuses the existing `getOpenDueDecision('weekly-coach-loop')` check `weekly-review.html` already runs for its closeout gate — if a decision is open and due, flag it here too instead of only gating the closeout section below.

### What's explicitly out of scope

- No full peak-week engine (load/volume auto-tapering, structured peak-week schedule) — gated on a real contest date + coach process per the original pick.
- No structured cardio/posing numeric targets — the Rx stays free text until that's a separate, deliberate upgrade.
- No new Supabase table or schema change — everything here reads data `weekly-review.html` or `gym.html` already writes.
- No changes to the Season Engine itself (`gym.html`'s phase-setting UI) — this panel only reads `po_coach_season`, never writes it.

## Testing

The new phase-target volume filtering reuses `classifyMuscleVolume()` as-is (already tested). The recovery-trend average and the "needs coach decision" flag are small pure functions over `state.checkins`/`state.decisions`-shaped input — covered with the same vm-sandbox `*.selfcheck.cjs` pattern `weekly-review.html`'s existing logic already follows, if any of this ends up extracted rather than left inline (matches how `weekly-review.html`'s existing scorecard math is structured today).
