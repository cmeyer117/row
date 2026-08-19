# Morning readiness card — design spec

## Problem

Row already collects the two signals a training-readiness read needs — sleep
(`health:sleep`, logged manually on health.html) and post-workout
recovery/pain/pump (`state.checkins`, captured via gym.html's post-workout
checkin modal, and already consumed by `getRx()`/`applyCheckinOverride()` to
shape the next prescription). But they're siloed on two different pages, and
nothing shows them together before training. Item 3 of the 2026-08-18
future-features review: "the missing piece is one daily card surfacing both
before training so the input is reliable... gets most of a wearable's value
now, without buying hardware or adding an API."

## Scope

Add a small readiness card at the top of gym.html — sleep + last checkin,
glanceable in one look, with an inline quick-add for sleep when today's isn't
logged yet. No new data system: reuses `health:sleep` and `state.checkins`
exactly as they exist today.

Explicitly out of scope: no change to `getRx()` or `applyCheckinOverride()`'s
mechanism (they keep reacting to the last post-workout checkin, same as
today); no second pain/recovery/pump capture point before training (confirmed
with Carl — a pre-training capture would create two competing sources for
what `getRx()` should trust, not worth the ambiguity for this pass).

## Design

**Placement:** `<div id="readinessCard"></div>` inserted in the markup
immediately after `.po-header` (gym.html:2749) and before the `.card` wrapper
holding the gym/day filters (gym.html:2751) — the first thing visible on page
load, above the exercise picker. Populated by a new `renderReadinessCard()`
function, called alongside the existing `renderRx()`/`renderStats()`/
`renderSparkline()`/`renderHistory()` group (gym.html:4524).

**Content — two rows, one combined tag:**

1. **Sleep.** Look up today's entry via the existing `getSleepEntryForDate`
   helper (gym.html:3634-3638) with `wtDateKey(new Date())` as the date key
   (same local-calendar-date convention gym.html already uses everywhere
   else — not health.html's UTC-default form, to stay consistent with how
   this page already reads that data).
   - If found: `"Last night: 7.5h · quality 4/5"` (omit either half if that
     field is null, matching `isPoorSleepEntry`'s existing "independently
     nullable" handling).
   - If missing: inline quick-add — reuses the exact checkin-modal markup
     pattern (gym.html:2994-3011): a `.po-quick-input` number field for hours
     (step 0.5, matching health.html's `hmSleepHours` field) plus a
     `.po-checkin-row`/`.po-checkin-btn` 1-5 button row for quality, with a
     Save button that writes to `health:sleep` via
     `upsertByDate(getSleep(), wtDateKey(new Date()), {hours, quality})`
     (same upsert helper health.html's own add-button already uses) and
     re-renders the card.

2. **Last checkin.** Find the most recent entry in `state.checkins`:
   `Object.keys(state.checkins).sort().pop()` (ISO `YYYY-MM-DD` keys sort
   correctly lexically). Display `"Last session: recovery high · pain low ·
   pump med"` (omit any null field). If `state.checkins` is empty, show
   `"No checkin yet"`. This is **display only** — no new capture point here;
   it's the exact value `applyCheckinOverride()` already reads.

3. **Combined tag.** `"Watch it"` if `GymSleepCheckLogic.isPoorSleepEntry`
   returns true for today's sleep entry, OR the last checkin's
   `recovery === 'low'`, OR `pain === 'high'`; otherwise `"Good"`. Reuses
   existing thresholds inline (matches this file's existing convention —
   `applyCheckinOverride`'s own `recoveryLow`/`sleepPoor` checks are inline,
   not a separate module; this file's logic modules are for the
   server-side, unit-tested nudge functions, not client-side render helpers).

**Sync — the part that needs care.** health.html's `initCloudSync` call
(health.html:1799-1807) syncs 9 localStorage keys under one Supabase
`app_state` row (`key: 'health'`) as a single JSON blob. Each
`initCloudSync` caller's `pushNow()` collects **only the keys it was told to
watch** and **replaces the entire blob** on upsert (`sync.js:130-143`). If
gym.html registered a second `initCloudSync({appKey: 'health', syncedKeys:
['health:sleep']})` call, its next push would silently overwrite the other 8
health.html-owned fields (vitals/labs/measurements/cardio/stack) for any
device that hasn't independently opened health.html recently — the same
silent-data-loss class this codebase has already hit more than once (see
`sync.js`'s own `syncReady`/tombstone comments).

Fix: gym.html registers its own `initCloudSync` call with the **identical**
`syncedKeys` list health.html uses:

```js
if (window.initCloudSync) {
  window.initCloudSync({
    appKey: 'health',
    syncedKeys: ['stack:items', 'stack:version', 'stack:low', 'macro_targets', 'health:vitals', 'health:labs', 'health:measurements', 'health:sleep', 'health:cardio'],
    syncedPrefixes: ['stack:taken:'],
  });
}
```

placed the same way gym.html already registers a second independent
`initCloudSync` instance for `appKey: 'hype-audio'` (gym.html:6949-6951) —
this is an established pattern in this file, just with a longer key list.
`onApplied` is set to `renderReadinessCard` (not health.html's
`RowHealthMarkers.rerenderAll()` callback, which doesn't exist on this page)
so a remote sleep/checkin update re-renders the card live.

This list duplicating health.html's is a real, accepted maintenance coupling
(same tradeoff already made for `hype-audio`) — if health.html's synced-keys
list changes, gym.html's copy needs the matching update. Not a full
generalization (e.g. exporting the list from a shared file) because only 2
pages need it and `sync.js`'s existing pattern doesn't have a shared-config
mechanism to hook into without changing 3+ files for a 9-item array.

## Testing

No new logic module, so no new `node:test` file — this is client-side render
code in gym.html, matching the file's existing convention (`renderRx()`,
`applyCheckinOverride()`, etc. have no unit tests either; only the
server-side nudge logic modules do). Verified via `/verify` in-browser
against a live macros/gym session before shipping (see Rollout below).

## Rollout

Ship, then manually verify in-browser: log a sleep entry via the new inline
quick-add on gym.html, confirm it appears on health.html's sleep list/chart
on reload (proves the sync fix works), and confirm the combined tag reacts
correctly to a low-recovery/high-pain checkin.
