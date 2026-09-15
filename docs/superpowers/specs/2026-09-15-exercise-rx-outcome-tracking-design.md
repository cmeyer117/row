# Per-exercise Rx outcome tracking — design

**Date:** 2026-09-15
**Status:** Approved in brainstorming, pending spec review

## Context

Row already computes a per-exercise, before-you-lift suggestion every session via `getRx()` (`gym.html:3763`) — a `type` (`up`/`hold`/`down`), suggested `weight`/`reps`, a `tag` ("Add weight"/"Deload"/"Reassess"/etc), a `reason` string, and a `stalled` boolean (`gym.html:3837`). The shared `decisions` table (`docs/superpowers/specs/2026-08-17-shared-decision-memory-design.md`) already runs a weekly, per-muscle version of propose → decide → later-evaluate for the Weekly Coach Decision Loop (`decisions.js`, category `weekly-coach-loop`). What's missing is the same propose → evaluate loop at the individual exercise-exposure level — fully automatic, since Carl explicitly chose to infer accept/edit/reject from what actually gets logged rather than add a confirmation tap, and getRx() already fires "every exposure, always."

## Decisions

| Fork | Choice | Why |
|---|---|---|
| Proposal + classification timing | One write, at log time | No separate "open proposal" state to manage in between. The moment a set is logged, compute what `getRx()` would have suggested (from `priorLogs`, already in scope in `saveSet()`) and classify it against the actual logged values in the same write. |
| Classification mechanism | Inferred from logged weight/reps vs. the Rx, not a UI tap | Carl's explicit choice — zero added friction to the actual workout. |
| Storage | Reuse the shared `decisions` table, new category `'exercise-rx'` | Same infra the weekly loop already uses (`decisions.js`'s `recordDecision`/`closeDecision`). No new table, no new Supabase client setup. |
| Verdict timing | Resolved automatically on the *next* exposure to that same exercise | Reuses `getRx()`'s own existing `stalled` determination rather than inventing new "did it work" logic — one exposure's stall/no-stall signal grades the *previous* exposure's decision. |
| Hook point | `saveSet()` (`gym.html:6798-6854`) only | The one real logging path (the main Log button). `quickLog()` and the ghost-tap path are separate entry points — v0 explicitly does not track those (see Non-goals). |

## Non-goals (v0)

- No visible UI (badge, review page) — pure background data collection. Same "prove it's worth looking at before building a UI for it" reasoning already applied to other recent specs in this fleet.
- `quickLog()` / ghost-tap logging are not tracked. A set logged through either produces no `exercise-rx` row; their existing behavior is otherwise completely unchanged. A real, acceptable gap for v0 — most real training happens through the main Log button.
- No manual accept/edit/reject UI anywhere.
- No change to `getRx()`'s own suggestion logic — this only reads its output.
- Bodyweight exercises (`ex.bw`) and peak-phase-frozen exposures (`seasonPhase === 'peak'`, where `getRx()` itself returns a hold-only "no autonomous changes" result) are excluded from classification — there's no real accept/edit/reject distinction to make in either case.

## Data model

Reuses the existing `decisions` table schema verbatim, with a new `category` and a new `details` shape:

```
category: 'exercise-rx'
details: {
  exerciseId, exerciseName,
  rxType, rxWeight, rxReps,        // getRx()'s suggestion, computed from priorLogs
  actualWeight, actualReps,        // what was actually logged
  classification: 'accepted' | 'edited' | 'rejected',
}
status: 'open' -> 'reviewed'        // flips automatically on the next exposure, not manually
verdict: 'worked' | 'partly_worked' | 'wrong' | 'inconclusive'   // same shared vocabulary the weekly loop uses
```

## Classification logic (pure function, TDD target)

`classifyRxOutcome(rx, actual)`:

- **`accepted`** — actual `weight`/`reps` match `rx`'s suggestion exactly (Row's own weight `step` increments are the real granularity here; no fuzzy tolerance needed).
- **`rejected`** — actual weight/reps move in the *opposite* direction from `rx.type` (e.g. `rx.type === 'down'` but Carl logged at or above the pre-Rx weight; `rx.type === 'up'` but Carl held or dropped weight).
- **`edited`** — everything else: different from the Rx but not contradicting its direction (e.g. `rx.type === 'up'` suggested a full `step`, Carl added less than that but still moved up).

## Verdict resolution (pure function, TDD target)

`resolvePriorRxDecision(priorDecision, nextRxStalled)` — called from `saveSet()` right before writing the new exposure's own decision row. Looks up the most recent **open** `exercise-rx` decision for this exercise (scoped by `details->>exerciseId`), and resolves it using the `stalled` boolean `getRx()` already computes for the exposure about to be logged:

| Prior classification | This exposure stalled? | Verdict |
|---|---|---|
| `accepted` or `edited` | No | `worked` |
| `accepted` or `edited` | Yes | `wrong` |
| `rejected` | No | `partly_worked` (Carl's own deviation didn't cause a problem — not proof it was right, just that it didn't hurt) |
| `rejected` | Yes | `inconclusive` (can't attribute the stall to Carl's deviation vs. something else — no overclaiming causation) |

If no open decision exists for this exercise (first tracked exposure, or the prior one was already resolved), skip resolution — nothing to grade yet.

## Components

- **New file `exercise-rx-tracking.js`** (matches Row's existing convention of one small pure-logic file per feature: `gym-volume-logic.js`, `gym-rx-phase-logic.js`, `gym-rx-deload-logic.js`) — exports `classifyRxOutcome()` and `resolvePriorRxDecision()`. Pure functions, no DOM, no Supabase, loaded the same way as its siblings (a `<script>` tag before `gym.html`'s main inline script, attached to `window`).
- **`saveSet()` wiring** (`gym.html`, inside the existing function at lines 6798-6854): right after `const priorLogs = arr.slice()` (line 6811) and before the `arr.push(...)` at line 6829 — call `getRx(ex, priorLogs)` to get this exposure's Rx, query the most recent open `exercise-rx` decision for `ex.id` (a direct Supabase read via the anon client, same pattern `decisions.js`'s `getOpenDueDecision` already uses), resolve it via `resolvePriorRxDecision` if one exists (calling `closeDecision` from `decisions.js`), classify this exposure via `classifyRxOutcome`, and write the new row via `window.recordDecision` (already shipped in `decisions.js`). Both the resolve-prior and record-new calls are fire-and-forget from `saveSet()`'s perspective — never block or fail the actual logging flow if either write fails (same "must never block the real feature" principle the weekly-review design already applies to its Vision-narrative fetch).

## Testing

`exercise-rx-tracking.selfcheck.cjs` (matching Row's plain-Node, assert-based convention — `gym-volume-logic.selfcheck.cjs`, `weekly-review-suggestions.selfcheck.cjs`): table-driven cases for `classifyRxOutcome` across all three classifications and each `rx.type` (up/hold/down), and for `resolvePriorRxDecision` covering all four verdict combinations in the table above, plus the "no open decision" no-op case. No live-browser verification needed for the pure logic. A manual smoke test after wiring (log two consecutive real exposures to a tracked exercise, confirm two `decisions` rows appear with `category='exercise-rx'` and the first one auto-resolved) covers the `saveSet()` integration.

## Out of scope

- Vessel/Content Manager's own writers into the shared `decisions` table — unrelated, a separate future task if ever picked up (see the idea-ledger's "Shared decision-memory" entry).
- Any visible surface for this data — deferred until there's evidence the recorded data is worth looking at.
- `quickLog()`/ghost-tap coverage — a real, deliberate v0 gap, not an oversight (see Non-goals).
