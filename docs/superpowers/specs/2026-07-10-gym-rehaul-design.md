# gym.html visual rehaul — design

## Goal
Bring `gym.html` in line with the glass/glow tile visual language already
shipped on `index.html` (itself ported from the real `RowanThistlebrooke/
vitality-base` reference), plus one new read-only widget. No exercise data,
logging logic, sync logic, or rotation logic changes.

## Scope

### 1. Visual reskin (CSS only)
Apply the glass/glow recipe already proven on `index.html` and the
`.po-tw` card (done as a checkpoint commit, `686e0e4`):
- Translucent gradient card background (`linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%)`)
- Soft mint border (`rgba(167,243,208,.10)`), mint glow on hover
- Per-card radial aurora wash pseudo-element
- Buttons/badges/pills get the same treatment as index.html's `.tile-badge`

Applies to: exercise log cards, weight/photo cards (in `gym-weight-photos.js`
or wherever that markup lives), mobility page cards (shared CSS, per the
HANDOFF note that `mobility.html` duplicates some of this CSS).

No markup restructuring in this part — same DOM, same classes, new rules only.

### 2. New: read-only week strip
A new section above the existing "Today's Workout" card (`.po-tw`).

**What it shows:** the last 5 rotation days (today + 4 prior), each as a small
glass card:
- Day name, pulled from the real `state.splitRotation` (e.g. "Push", "Pull",
  "Legs A", "Rest", "Upper", "Legs B") — not hardcoded.
- Status pill: `TODAY` (mint, glowing) for the current day, `DONE` (mint,
  checkmark) if `doneDays[dateKey]` is true, `REST` (muted) for rest days,
  otherwise blank/past.
- Progress bar: sets logged that day ÷ that day's total configured exercises
  (both already computable from `logsByDay()` + `CONFIG.exercises` filtered
  by `day`), same math the existing summary already does per-day.

**Interaction:** tapping today's card scrolls to the existing `.po-tw` card
(no new log UI). Tapping a past day expands it in the existing past-workouts
list (`renderPastWorkouts()`'s expand behavior) — reuses that component,
does not duplicate it.

**Explicitly NOT included:** no manual day-switching, no drag-reorder, no new
localStorage keys, no schema change. The rotation is auto-computed from
`splitAnchor` + `splitRotation` today via `todaysSplit()` (~line 3456) — this
widget is a read-only view over that, matching how the reference's own
day-picker would desync a date-anchored rotation if it allowed picking days
freely.

## Data flow
New render function `renderWeekStrip()`, called alongside the existing
`renderTodaysWorkout()`/`renderPastWorkouts()` calls. Reads:
- `state.splitRotation`, `state.splitAnchor` (existing)
- `logsByDay()` (existing)
- `doneDays` (existing)

No new state, no new sync keys, no changes to `PC_SYNCED_KEYS`.

## Out of scope (flagged, not built here)
Carl raised a separate concern mid-session: possibly extracting gym.html's
data model and reloading it "correctly" — a state/schema cleanup question,
unrelated to this visual task. Not addressed here; backlog it separately if
he wants to pursue it.

## Risk containment
- Branch `gym-rehaul`, not `main` — `main` stays at `8dc9f59`/`686e0e4`
  untouched; if the result isn't wanted, just don't merge.
- Additive only: new CSS rules, one new render function + its markup.
  `renderTodaysWorkout()` and `renderPastWorkouts()` are called, not rewritten.
- No changes to `CONFIG.exercises`, `PC_SYNCED_KEYS`, `po_coach_weights`,
  `po_coach_v1`, or any sync/push logic.
