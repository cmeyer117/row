# Progress card expanded-graph modal — design

## Goal
Tapping a Progress-tab exercise card currently jumps straight to the Log tab
with that exercise selected (existing behavior in `renderProgress()`,
`gym.html` ~line 3813-3827) — surprising, since Carl expects it to show a
bigger view of the graph. Replace that: tapping the card opens an expanded
modal (bigger chart + full session history); the jump-to-Log action moves to
a small icon button on the card.

## Scope

### 1. Card change
- Remove the click listener currently on `.prog-card` itself.
- Add a small icon button (pencil/log glyph, reusing the app's existing
  glyph-icon visual language) in the card's top-right corner, next to the
  existing `.prog-card-badge` (day badge). Tapping it does exactly what the
  whole-card tap used to do: set `state.currentEx`, `switchTab('log')`,
  `saveState()`, `renderAll()`, scroll to `#logFormWrap` — same code, just
  triggered by the new button instead of the card.
- Tapping anywhere else on the card opens the new modal for that exercise.

### 2. Modal
Reuses the existing bottom-sheet modal pattern already in `gym.html`
(`.sub-modal-bg`/`.sub-modal` classes — same CSS, new container ids
`progModalBg`/`progModal` so nothing is duplicated). Contents, top to
bottom:
- Header: exercise name + PR stat (same `prStr` logic already computed in
  `renderProgress()`).
- A bigger chart: `buildSparkPath(vals, W, H)` (already fully parameterized,
  `gym.html:3665`) called again with a **larger W/H** and the **full**
  session-tops array (not the `.slice(-10)` the card's mini sparkline uses).
- A scrollable session list below the chart: every past session for that
  exercise, date + per-set weight×reps, reusing the exact chip-rendering
  logic already in `renderPastWorkouts()`'s expanded-day rows (`gym.html`
  ~3879-3893) rather than rewriting it — same chip markup/classes.
- Dismiss: tap outside (reusing the existing `subModalBg` outside-click
  pattern at `gym.html:4143-4144`) or an explicit close button.

### 3. Data
No new state, no schema change. Everything needed already exists in
`state.logs[ex.id]` — the modal just renders more of what `renderProgress()`
already computes per card (full session list instead of a 10-session slice).

## Out of scope (flagged, not built here)
Carl asked for a second, unrelated feature right after approving this design:
per-exercise mental cues to review before each lift, plus a between-set
"squeeze the muscle" reminder. That's a separate feature — different data
(needs real per-exercise cue content, likely evidence-backed per the AI
Coach's fitness-science nudge), different UI surface (the Log tab's per-set
flow, not the Progress tab). Will get its own brainstorm/spec once this modal
ships.

## Risk containment
- Single file (`gym.html`), additive: new modal markup/CSS (reusing existing
  classes), one new button per card, one relocated event listener.
- `renderPastWorkouts()`'s existing chip-rendering code is called/reused, not
  duplicated or rewritten.
- No changes to `state.logs`, `state.exercises`, sync keys, or any other
  render function.
