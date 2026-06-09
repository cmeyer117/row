# Workout List Redesign — Structured Day View with Substitutions

## Overview

Replace the exercise dropdown on the Fitness tab with a structured, ordered workout list. Each day's exercises appear in program order as tappable rows. Any exercise can be logged in any order. Each exercise slot supports substitutions with star ratings. Ad-hoc exercises can be appended mid-workout.

---

## Data Model

### Exercise entries — add `subs` and `sets` fields to CONFIG.defaultExercises

Each exercise in `CONFIG.defaultExercises` gains an optional `subs` array:

```js
{
  name: "Hack Squat",
  gym: "comm", day: "legsA",
  repMin: 4, repMax: 8, step: 5, startWeight: 60,
  numSets: 2,   // 2 for most exercises; 4 for calf raises + triceps overhead ext + cable curls
  subs: [
    { name: "Pendulum Squat",                  stars: 5 },
    { name: "Smith Machine Squat (Quad Bias)", stars: 5 },
    { name: "Barbell Squat (Quad Bias)",       stars: 4 }
  ]
}
```

All 35 exercises in the Lift Lab mesocycle will have their substitutions populated from the program document.

### Per-session state (localStorage, existing `po_coach_v1` key)

A new `sessions` map is added to the stored state:

```js
sessions: {
  "2026-06-09": {
    "exercise-id-123": {
      activeVariant: null,          // null = primary; string = sub name
      sets: [{ weight, reps, ts }]  // sets logged this session
    },
    "adhoc_1718900000": {           // ad-hoc exercise
      name: "Cable Crunch",
      isAdhoc: true,
      activeVariant: null,
      sets: [{ weight, reps, ts }]
    }
  }
}
```

Session key is the active date string (rolls over at 6 AM, same as rest of app). Ad-hoc exercises are stored inline in the session — they do not appear in the permanent exercise list unless explicitly saved.

---

## UI — Workout List

### Replaces: exercise dropdown + prescription card section
### Keeps: Gym + Day segmented filters, weight chart, progress photos, settings

**Layout (per day):**

```
[ Gym filter ]  [ Day filter ]

1  Hack Squat                    [Alt ▾]   0/2 ○
2  Sissy Leg Press               [Alt ▾]   0/2 ○
3  Seated Hamstrings Curl        [Alt ▾]   0/2 ○
   ...

   ┌─────────────────────────────────────────┐
   │ ▼ Hack Squat  (expanded)               │
   │   Last: 70kg × 6  ·  2 sessions ago    │
   │   Prescription: aim for 70kg, 6–8 reps │
   │   [ − ] [ 70 kg ] [ + ]                │
   │   [ 4 ][ 5 ][ 6 ][ 7 ][ 8 ][ 9 ][ 10 ]│
   │   [ Log Set ]                          │
   │   Set 1: 70kg × 6  ✓                   │
   └─────────────────────────────────────────┘

   [ + Add exercise ]
```

**Row states:**
- Default: exercise name + Alt button + `0/2 ○` badge
- Expanded: inline log form (weight stepper, rep pills, Log Set, last-set info, prescription, session sets logged so far)
- Sets in progress: badge updates to `1/2`
- Prescribed sets complete: green checkmark, row dims to 60% opacity, still tappable
- Using a sub: exercise name shows sub name + star count (e.g. `Pendulum Squat ★★★★★`)

**Only one row is expanded at a time.** Tapping a second row collapses the first.

---

## Substitution Picker

Triggered by tapping **Alt ▾** on any row. Opens a compact modal.

**Modal layout:**
```
  Choose variation

  ● Hack Squat (primary)
  ○ Pendulum Squat          ★★★★★
  ○ Smith Machine Squat     ★★★★★
  ○ Barbell Squat           ★★★★

  [Set as default]   [Cancel]
```

- Currently active variant is pre-selected
- Tapping any option closes modal and updates the row immediately
- **Set as default** permanently updates the exercise's `name` in localStorage (the sub becomes the primary for future sessions)
- **Cancel** closes without changing anything
- Picker is session-scoped by default: variant resets to the stored default next session

---

## Ad-hoc Exercise Addition

**"+ Add exercise"** button at the bottom of the day's list.

Tapping opens a small inline form:
- Text input: exercise name (required)
- Rep range inputs: min / max (pre-filled with 8/12)
- **Add** button appends the exercise to the bottom of today's list

Ad-hoc exercises:
- Work exactly like program exercises (weight stepper, rep pills, log, history)
- Tagged `isAdhoc: true` — they appear in session history but not in the permanent exercise list
- Do not show an Alt button (no substitutions)

---

## Completion Tracking

- Set count badge (`X/N`) is derived from: `session[date][exerciseId].sets.length` vs `exercise.numSets`. Most exercises have `numSets: 2`; calf raises, Cable Triceps Overhead Extension, and cable curl exercises have `numSets: 4` (per the program document)
- No "finish workout" gate — user logs as many or few sets as they want
- Green checkmark + dim at prescribed set count, but logging more sets is always allowed

---

## What Does Not Change

- Progression logic: hit `repMax` at prescribed RIR → app recommends adding `step` weight next session
- Set history storage (existing `po_coach_v1` localStorage key, extended with `sessions` map)
- Weight chart, composition estimate, progress photos
- Supabase cloud sync (existing synced keys)
- Day pill auto-rotation
- Settings panel (export/import/reset)

---

## Affected Files

- `gym.html` — all changes contained here (single-file app, no build step)
  - CONFIG.defaultExercises: add `subs` arrays to all 35 exercises
  - `normalize()`: initialise `state.sessions`
  - Replace exercise picker UI with workout list
  - Add substitution picker modal
  - Add ad-hoc exercise form
  - Update set-logging logic to write to `sessions[date][id].sets`
