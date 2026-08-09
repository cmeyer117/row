# Daily Routine Checklist (Morning + Evening) — Design

**Date:** 2026-08-09
**Status:** Approved, ready for planning

## Problem

Carl wants a structured, evidence-based morning and evening routine — the sleep
protocol pieces researched this session (light exposure, temperature/cold shower,
delayed caffeine, wind-down light, melatonin, casein snack) plus Vessel faith
activities (devotional, prayer, journal) — surfaced somewhere he'll actually see it
daily. Morning Launch and Evening Shutdown (both already shipped in `main.html`) are
the two moments in the day already solving the "will Carl actually open this"
problem (Morning Launch now has an 8am push nudge). This is a checklist riding
inside those two existing flows, not a new page.

## Goal

A small, separate-but-connected checklist component: its own logic/render function,
but rendered inside Morning Launch's existing flow (morning items) and Evening
Shutdown's existing flow (evening items). Some items are live checks against
Vessel's real data (no self-reporting needed); the rest are simple checkboxes.

## Item split (Carl-approved)

**Morning** (rendered inside Morning Launch, after the existing align/obstacle
phases, before or alongside commit):
- Sunlight/bright light exposure within 60 min of waking (checkbox)
- Cold shower or exercise (checkbox) — either satisfies it, single checkbox
- Delayed caffeine ~90-120 min (checkbox)
- Devotional read today — **live check** against Vessel `vessel:devotional_log`
- Prayer today — **live check** against Vessel `vessel:prayer_log`

**Evening** (rendered inside Evening Shutdown):
- Dim lights the last 1-2 hours before bed (checkbox)
- Cool room temperature (checkbox)
- Casein snack (cottage cheese/Greek yogurt) before bed (checkbox)
- 1mg melatonin (checkbox)
- Journal today — **live check** against Vessel `vessel:journal`

Item lists are a plain array of objects (`{id, label, kind: 'checkbox'|'live', ...}`)
in the logic file — editing the routine later (add/remove/reword an item) is a
one-line array edit, not a schema change.

## Components

**`daily-routine-checklist-logic.js`** (new, pure, unit tested)
- `MORNING_ITEMS` / `EVENING_ITEMS` — the two item arrays above.
- `hasVesselActivityToday(vesselData, todayKey)` — handles both real Vessel shapes
  confirmed in the codebase: a bare date-string array (`devotional_log`,
  `prayer_log`) and an array of `{date, ...}` objects (`journal`). Returns boolean.
- `buildChecklistState(items, savedChecks, vesselReads)` — merges the static item
  list with saved checkbox state (from localStorage) and live-check results (from
  the three Vessel reads) into one render-ready array. Pure, no I/O.

**`main.html` changes**
- New localStorage key `routine_checklist:<date>`, storing `{[itemId]: boolean}`
  for the checkbox-type items only (live items are never stored, always
  re-derived from the Vessel read that render).
- Added to the existing `syncedPrefixes: [..., 'routine_checklist:']` array
  (same convention `morning_launch:` already uses) so it round-trips through
  Row's existing cloud sync — no new sync mechanism.
- Three new client-side Supabase reads (`client.from('app_state').select('data')
  .eq('key', 'devotional_log'|'prayer_log'|'journal').maybeSingle()`), identical
  in shape to the existing `vision:faith_iron` read in `state-of-me.html`. Each
  wrapped independently (a failed/missing read renders that one live item as
  "unknown," never blocks the rest of the checklist — same defensive pattern
  `getMissionControlSignals()` already established for independently-sourced
  signals).
- A new `renderRoutineChecklist(kind)` function, called once from Morning
  Launch's existing render path and once from Evening Shutdown's — appends a
  small checklist block (checkboxes + live-check rows shown as done/not-done,
  no interaction needed on live items) into the existing phase's DOM.

## Data flow

1. Page loads Morning Launch or Evening Shutdown phase as it already does today.
2. `renderRoutineChecklist(kind)` fires: loads `routine_checklist:<date>` from
   localStorage, fires the relevant Vessel reads (2 for morning, 1 for evening),
   calls `buildChecklistState` once reads resolve, renders.
3. Checking a box writes straight to `routine_checklist:<date>` (mirrors how
   `initSleepQuick`'s hub widget already writes/reads localStorage) and re-syncs
   via the existing cloud-sync loop — no new persistence pattern.

## Testing

`daily-routine-checklist-logic.selfcheck.cjs` (matches `morning-launch-logic.selfcheck.cjs`'s
convention, the file this checklist rides alongside) — unit tests for
`hasVesselActivityToday` (both array shapes, empty/missing data, today vs. a
different date) and `buildChecklistState` (merges correctly, live items never
read from `savedChecks`). `main.html`'s render wiring gets browser verification
only, matching the rest of Morning Launch/Evening Shutdown's own testing
convention (no unit tests for DOM-building code in this file historically).

## Out of scope

- No new page — everything rides inside the two existing flows.
- No changes to Vessel itself — purely a read-only cross-app consumer, same
  boundary `faith-workout-thread.js` already established in the other direction.
- No notification/nudge for the checklist itself — it inherits Morning Launch's
  existing 8am push and Evening Shutdown's existing trigger; no new cron.
- No historical/streak view of checklist completion — just today's state, matching
  the scope Carl actually asked for (a routine, not a new analytics surface).
