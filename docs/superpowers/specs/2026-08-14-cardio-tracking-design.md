# Cardio Tracking — Design

**Date:** 2026-08-14
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

Cardio has zero tracking infrastructure in Row today — no UI, no data model. It's one of the pieces backlogged from the deferred `coachSnapshot` vision (`BACKLOG.md`). Unlike sleep (which already existed in `health.html`, just wasn't wired into `gym.html`'s coach logic — closed earlier today by the sleep bridge), cardio needs a real net-new build.

## Scope

Just the log — date, type, duration, optional intensity. No target/prescription system, no adherence computation, no wiring into `getRx()`/coach logic. That's a deliberate deferral, not an oversight: sleep followed the exact same sequencing (tracking existed first, the phase-policy bridge came later once there was real data to bridge). Building a cardio target/adherence system now, before any real cardio data exists to calibrate against, would be designing in a vacuum. Once cardio has been logged for a while, a future "cardio bridge" build (mirroring the sleep bridge) can wire it into the coach layer the same way.

## Approach

Follow `health.html`'s existing tab pattern exactly — this page already has 5 tabs (Vitals, Labs, Measurements, Sleep, Recomp), each with the identical shape: a form-row (date + fields + Add button), a chart-wrap (metric selector + sparkline), and a delete-capable list. Cardio becomes a 6th tab, reusing every piece of that shape rather than inventing a new one.

### Data

New localStorage key `health:cardio`, an array of entries:
```js
{ date: 'YYYY-MM-DD', type: string|null, durationMin: number|null, intensity: number|null }
```
- `type`: free text (e.g. "Incline Walk", "Bike", "Stairmaster") — not a fixed dropdown. Row's cardio modalities vary enough that a free-text field avoids maintaining an enum, and no other health.html field uses a dropdown for a category like this.
- `durationMin`: minutes, numeric.
- `intensity`: RPE 1-10 (standard convention, distinct from sleep quality's 1-5 scale — different domains, no reason to force the same range).
- Same `upsertByDate()` dedup convention as every other health.html metric (one entry per date, re-logging the same date merges non-null fields in rather than duplicating).

### UI

New tab button (`data-hm-tab="cardio"`, label "Cardio") added to `#hmTabs`, positioned after Sleep. New `#hmView-cardio` div, hidden by default like every other non-first tab, containing:
- Form row: date input, type text input, duration number input, intensity number input (1-10), "+ Log" button — exact same input/button classes (`stack-input`, `stack-add-btn`) every other tab already uses.
- Chart-wrap: a metric selector (`durationMin` / `intensity`) driving a sparkline, same `buildMiniSpark()` helper every other metric already uses.
- List: reverse-chronological entries with a delete (✕) control per row, same shape as every other tab's list.

`hmSwitchTab()`'s tab array gains `'cardio'`. `initCloudSync()`'s `syncedKeys` gains `'health:cardio'` so it syncs across devices the same way vitals/labs/measurements/sleep already do.

### Functions (mirroring `getSleep`/`setSleep`/`renderSleep` exactly)

```js
function getCardio() { return _get('health:cardio') || []; }
function setCardio(list) { _set('health:cardio', list); }
function renderCardio() { /* same list + chart render shape as renderSleep() */ }
```

## Error handling

- No entries yet → list renders empty, chart shows the existing "Need 2+ entries for a trend" empty state (same `buildMiniSpark`/chart-wrap convention every other tab already has).
- A log with only some fields filled (e.g. duration but no intensity) → `upsertByDate()`'s existing null/undefined/empty-string filtering already handles this correctly, no new logic needed.

## Out of scope

- Any target/prescription concept, adherence computation, or wiring into `gym.html`'s coach logic (`getRx()`, `applyCheckinOverride()`, volume/phase logic) — deferred to a future cardio bridge, same sequencing as sleep.
- A dropdown/enum for cardio type — free text, as above.

## Testing

No pure logic module needed — this is UI + localStorage glue mirroring an established pattern exactly, same as the rest of `health.html` (vitals/labs/measurements/sleep have no dedicated test files either; `upsertByDate`/`buildMiniSpark` are the only pure-ish pieces here and they're already shared, untouched, existing code).

Browser verification: switch to the new Cardio tab, log an entry (type + duration, no intensity), confirm it appears in the list and the duration sparkline renders once a second entry exists. Delete an entry, confirm it's removed. Reload the page, confirm the entry persists (localStorage) and, if signed in with sync active, confirm it syncs to `app_state` under the `health` key.
