# Coach-response closeout — design

**Date:** 2026-08-22
**Status:** Approved, ready for planning

## Origin

Codex's 2026-08-20 Row pass, ranked-backlog items #4 ("Structured weekly
coach-response closeout and next-week comparison") and #7 ("Explicit
decision completion/hold/modified state"). Both were flagged as needing
their own brainstorm before building — this is that brainstorm.

## Context clarified with Carl

Carl has a real external human coach (weekly check-in over text/DM) *and*
uses Row's own weekly decision loop (`weekly-review.html`) as a deliberately
separate "second eyes" opinion. The coach's plan (diet/macros/training
calls) and Row's own generated Rx are **not** meant to intertwine — the
coach takes precedence when they differ, and today nothing in Row records
what the coach actually said. Item #7's proposed "hold" state turned out
to have no real use case Carl could name (not "waiting on coach," not
anything else concrete) — cut per YAGNI, keeping only item #4.

## What this feature is

A small addition to the existing per-decision closeout flow in
`weekly-review.html`'s `renderCloseout()`: a place to record what Carl's
coach actually said about that week, alongside (not instead of) Row's own
follow-through scorecard and verdict. Purely a record for Carl's own
reference/pattern-tracking (e.g. how often his coach's read differs from
Row's) — no automatic override, no effect on what gets scored or suggested
the following week.

## Data model

No new table. Two new optional fields on the existing `decisions` row's
`details` JSON (same object `computeScorecard`/`renderCloseout` already
read/write):

```
details.coach_response = {
  status: 'approved' | 'modified' | 'hold' | 'needs_more_data',
  note: string,       // pasted/summarized text from the coach's DM
}
```

Both fields are optional — a decision closed out before this feature
shipped, or a week with no coach check-in, simply has no
`coach_response` key. No migration needed (JSON column, no schema change).

## UI

One new block in `renderCloseout()`'s existing closeout card, between the
scorecard and the verdict `<select>`:

```
Coach's response this week (optional)
[ Approved | Modified | Hold | Needs more data ]  <- select, blank default
[ textarea: what did your coach actually say? ]
```

- Both fields optional — leaving them blank omits `coach_response` from
  the saved `details` entirely (matches the existing pattern for
  legacy/optional fields elsewhere on this page, e.g. `rxInfo`'s
  graceful degradation).
- Saved in the same `closeoutSave` click handler, same `window.closeDecision`
  call — just one more key merged into `details` before the call, no new
  save path.
- No display surface beyond the closeout card itself for v1 (no history
  view, no divergence-pattern report) — Carl didn't ask for one; add later
  if the recorded data turns out to be worth surfacing.

## Non-goals (explicitly cut)

- No "hold" lifecycle state that suppresses the "open and due" warning —
  item #7 as originally scoped. No concrete use case exists yet; the
  `status: 'hold'` option above is just one of 4 plain labels describing
  the coach's reaction that week, not a state machine change.
- No linkage from the coach's response into next week's suggested Rx or
  scoring target. Coach and Row stay deliberately separate systems, per
  Carl.
- No structured "final prescription" field distinct from the free-text
  note — Carl's coach's plan already flows into Row's existing inputs
  (macro targets, etc.) through Carl's own normal usage; this feature
  only needs to capture *what was said*, not re-model the coach's plan
  as structured data.

## Testing

Extend `weekly-review-scorecard.test.js`'s pattern (or a new
`weekly-review-closeout.test.js` if the existing file's fixture scope
doesn't fit) with one case: `closeoutSave`'s details-merging logic
includes `coach_response` when the fields are filled, and omits the key
entirely when both are left blank.
