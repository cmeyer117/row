# Structured weekly-review verdicts (anchor lifts, cardio, posing, pain)

2026-08-20. Follow-up to item 4 of the 2026-08-18 future-features pass
(`Claude Outputs/2026-08-18-future-features-pass.md`, section 3 "Row").

## Problem

Volume decisions already get a structured payload (`{action, baseline}`) and
an auto matched/not-matched check at closeout (`gym-volume-logic.js`'s
`matchesVolumeDecision`, wired into `weekly-review.html`). Anchor lifts,
cardio Rx, posing Rx, and pain notes are still single free-text fields in
`decisions.details`, and closeout only asks for one whole-decision verdict
(`worked`/`partly_worked`/`wrong`/`inconclusive`). `weekly-review.html:228`
says outright that anchor-lift/pain calls aren't auto-checked because there's
no structured target to compare against.

## Payload shape (`decisions.details`, written by the new-decision form)

```js
anchor_lifts: [{ lift: string, call: 'progress'|'hold'|'regress', guardrail: string|null }]
cardio_rx:  { target: number /* sessions/week */, guardrail: string|null }
posing_rx:  { target: number /* sessions/week */, guardrail: string|null }
pain_flags: [{ note: string, guardrail: string|null }]
```

- `muscle_groups` and top-level `review_date` are unchanged.
- Anchor lifts is a repeatable list, added to/removed from the form like the
  muscle rows already are — a week's decision can plausibly touch more than
  one lift.
- `guardrail` is optional free text on every item (the condition that would
  make Carl back off — e.g. "skip if left shoulder flares"). Not used in
  auto-scoring; carried through to closeout for context only.

## Closeout scoring (`weekly-review.html`)

- **Cardio/posing** — auto-derived the same way volume already renders a
  badge: compare the actual session count (already fetched in
  `computeScorecard`) against `.target`.
  - `matched` if `actual >= target`
  - `not_matched` if `actual === 0`
  - `partly_matched` otherwise
  - No manual input; rendered as a badge next to the existing raw count.
- **Anchor lifts & pain** — no reliable auto-check exists (no rep/weight log
  tied to a lift name, no signal for pain resolution), so each entry renders
  a **required** `matched | partly_matched | not_matched` `<select>` at
  closeout. "Save & Continue" validates all are filled, same pattern the
  existing overall-verdict-required check already uses.
- The existing whole-decision `verdict` field is unchanged — it stays the
  coach's overall gestalt call, now made with the itemized scorecard visible
  above it (same relationship the volume rows already have to it).

## Data write

- `closeDecision(id, verdict, outcomeNote)` gains a 4th param,
  `itemVerdicts` (object keyed by field: `cardio_rx`, `posing_rx`, per-index
  key for `anchor_lifts`/`pain_flags` entries). The closeout handler merges
  `itemVerdicts` into the existing `decision.details` (already in scope) and
  sends the merged object as `details` in the same Supabase update, alongside
  the existing `verdict`/`outcome_note`/`status`/`reviewed_at` columns. No
  new table or column.

## Legacy decisions

A decision recorded before this ships has `anchor_lifts`/`cardio_rx`/
`posing_rx` as plain strings and `pain_flags` as an array of strings. Closeout
must not crash on these — same `typeof` degrade `muscle_groups` already uses
for pre-fix rows (`entry && typeof entry === 'object' ? ... : entry`).
Legacy fields render as plain text with no auto badge and no required
verdict (nothing to score against).

## Out of scope

- Changing volume's existing binary matched/not-matched logic to 3-state —
  it already works, not touching it.
- A separate "target" field for pain (no natural numeric target; the note
  itself is the guardrail).
- Any new Supabase table/column — everything lives in the existing
  `decisions.details` jsonb.
