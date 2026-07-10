# Rest timer + reminder, and cue enrichment — design

## Goal
Two related additions to `gym.html`'s Log tab, both sourced from Carl's
existing Obsidian vault (`03 - Bodybuilding/Exercise Cues/`, 34 notes, one
per exercise — already the source `DEFAULT_CUES` in code was built from):

1. A rest timer that auto-starts after logging a set, with a muscle-specific
   "squeeze and hold" reminder.
2. A richer, more consistent tempo/squeeze/stretch cue added to each of the
   34 existing `DEFAULT_CUES` entries.

No exercise data, logging logic, or sync logic changes. No external research
needed — every vault note already has a `**Primary:**` muscle field and a
Form Cues section covering squeeze/stretch/eccentric principles; this is a
sourcing/condensing task, not new research.

## Scope

### 1. `MUSCLE_PRIMARY` lookup
New static object, same pattern as `DEFAULT_CUES` (`gym.html` ~line 4158),
34 entries, one short muscle label per exercise condensed from each vault
note's `**Primary:**` field. Examples (not exhaustive — full list built
during implementation from the 34 vault notes):
- `'Lat Pulldown': 'lats'`
- `'Machine Preacher Curl': 'biceps'`
- `'Leg Extension': 'quads'`
- `'Standing Calf Raise': 'calves'`

### 2. Rest timer
- **Trigger:** auto-starts the instant a set is logged (hooks into the
  existing log-set flow — same place `renderTodaysWorkout()`/`saveState()`
  already get called after a log action).
- **Duration default:** keyed off the exercise's existing `repMin` field
  (already in `CONFIG.exercises`, no new data) — `repMin` 4-8 (heavy/compound)
  defaults to 2:30, `repMin` 8-16 (isolation) defaults to 1:15.
- **Adjustable:** +/-15s tap controls, live during the countdown.
- **UI:** a sticky banner pinned near the top of the Log tab (new
  `#restTimerBar` element, shown/hidden via display toggle like the existing
  `#cuesSection`/`#warmupToggle` pattern), showing the countdown (`M:SS`) and
  the reminder line built from `MUSCLE_PRIMARY[ex.name]`, e.g. "Squeeze your
  lats — hold the peak contraction." Dismissible early (tap to stop) if
  Carl's ready to go again before it ends.
- **Implementation:** plain `setInterval`, no persistence — if the page
  reloads mid-rest the timer resets. Acceptable for v1 (YAGNI — no
  cross-reload state needed for a rest countdown).

### 3. Cue enrichment
Each of the 34 `DEFAULT_CUES` entries (currently 3 short cue lines) gets a
4th line: a consolidated tempo/squeeze/stretch cue, sourced from that
exercise's own vault note (Form Cues + Science sections already state the
principle — this makes it explicit/numeric where the vault doesn't already
quantify it). Example, Machine Preacher Curl — vault note already says
"Controlled slow eccentric; squeeze hard at the top" and "the stretch at the
bottom is where the short head gets loaded"; the new 4th cue line
consolidates this into the same short style as the existing 3:
`'3-sec controlled eccentric, squeeze 1 sec at peak, full stretch at bottom'`.
Every exercise's new line is grounded in that exercise's own vault note, not
generic boilerplate repeated 34 times.

## Data flow
- `MUSCLE_PRIMARY` and the enriched `DEFAULT_CUES` are both static objects,
  same file, same pattern as the existing `DEFAULT_CUES` — no schema change,
  no new localStorage keys, no sync changes.
- Rest timer state is in-memory only (a few module-scope variables:
  countdown remaining, interval handle) — nothing persisted.

## Out of scope (flagged, not built here)
Carl asked for two further, unrelated pieces right after this: (1) a Fable
run-through of the Row app (content/voice-mode session, not a code task),
(2) enriching the app's underlying training knowledge via book deep-dives
(same pattern as Vessel's faith/psychology deep-dives — a content-research
task, not this code change). Both are queued as next steps after this ships,
not part of this spec.

## Risk containment
- Single file (`gym.html`), additive: one new lookup object, one new
  timer/banner component, one new cue line per existing `DEFAULT_CUES` entry
  (extending existing arrays, not restructuring them).
- No changes to `state.logs`, `state.exercises`, `state.cues` (user's custom
  cue overrides via `saveCues` are untouched — the enrichment only changes
  the *default* fallback, same as today).
