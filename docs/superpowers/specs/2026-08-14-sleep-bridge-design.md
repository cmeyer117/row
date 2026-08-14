# Sleep Bridge — Design

**Date:** 2026-08-14
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

`health.html` already tracks sleep as real Row-local state (`health:sleep`, an array of `{ date, hours, quality }` entries, manually logged — `quality` on a 1-5 scale, either field independently nullable). None of that reaches `gym.html`'s coach logic today. `getRx()`'s `applyCheckinOverride()` already caps a suggested weight increase when a same-day pain/recovery check-in says `recovery: 'low'`, but sleep — a genuinely independent recovery-capacity signal, logged on a completely separate page — has no path into that decision at all.

This is the first slice of the deferred full `coachSnapshot` vision (backlogged earlier this session): the only piece of it where the data already exists as real Row state, so it's buildable now without inventing new tracking UI. Cardio, posing, and macro-adherence stay backlogged (`BACKLOG.md`) until they have equivalent tracked data.

## Ground truth (verified in-session)

- `health:sleep` entries: `{ date: 'YYYY-MM-DD', hours: number|null, quality: number(1-5)|null }`. Either field can be null independently — Carl might log just one.
- `applyCheckinOverride(result, last, ex, stuck)` (`gym.html:3527`) currently opens with `const checkin = state.checkins[dateKey]; if (!checkin) return result;` — a **blanket early return** before the pain/recovery branches even run. Since sleep data lives in a different localStorage key entirely (not `state.checkins`), this early return would silently skip a sleep check on any day Carl logs sleep but skips the separate pain/recovery check-in — the two systems aren't currently reconcilable without restructuring this guard.
- The existing `recovery === 'low' && result.type === 'up'` branch (`gym.html:3539-3544`) caps an upgrade down to a same-weight, one-more-rep hold — this is the exact severity tier sleep should join, not the pain-tier deload (one bad night's sleep isn't a joint-pain-equivalent signal).
- `localStorage` is per-origin, not per-page — `gym.html` can already read `health:sleep` directly the same way it already reads `po_coach_season` (a different page's key), no cross-page API needed.

## Behavior

New pure module `gym-sleep-check-logic.js`, mirroring `gym-rx-deload-logic.js`'s exact convention:

```js
function isPoorSleepEntry(entry) {
  if (!entry) return false;
  var hoursLow = typeof entry.hours === 'number' && entry.hours < 6;
  var qualityLow = typeof entry.quality === 'number' && entry.quality <= 2;
  return hoursLow || qualityLow;
}
```

`applyCheckinOverride()` changes:

1. Remove the blanket `if (!checkin) return result;` early return. `checkin` may now be `undefined` for the rest of the function.
2. Pain check becomes `if (checkin && checkin.pain === 'high') { ... }` (unchanged behavior — checkin absent behaves identically to today, since the pain branch never fired without a checkin anyway).
3. Add a same-day sleep lookup: read `health:sleep` from localStorage, find the entry (if any) matching `dateKey`, pass it through `window.GymSleepCheckLogic.isPoorSleepEntry()`.
4. The recovery-low branch's condition becomes `(recoveryLow || sleepPoor) && result.type === 'up'`, where `recoveryLow = !!checkin && checkin.recovery === 'low'`. Reason text names whichever signal(s) actually fired:
   - both: "recovery was low and sleep was short/poor last time"
   - recovery only: "recovery was low last time" (today's exact existing wording, unchanged)
   - sleep only: "sleep was short/poor last night"

## Error handling

- No sleep entry for `dateKey`, or `health:sleep` missing/unparseable → `isPoorSleepEntry(null)` returns `false`, falls through exactly like today's no-checkin case.
- `window.GymSleepCheckLogic` not loaded (script failed) → guarded fallback, `sleepPoor` defaults to `false`, matching this codebase's existing `window.X ? ... : ...` defensive pattern.
- A day with a pain='high' checkin: unchanged — pain still takes priority (checked first, returns before the recovery/sleep branch is ever reached).
- A future wearable sync (backlogged, not this build) writing into the same `health:sleep` key requires zero changes here — this logic reads whatever's in that key regardless of how it got there.

## Out of scope

- Macro-adherence, cardio, posing bridges — no equivalent tracked data yet, stay in `BACKLOG.md`.
- Any change to the pain-deload branch, to volume-target phase logic, or to peak-phase freeze — untouched.
- A dedicated sleep-logging UI in `gym.html` itself — `health.html` already owns that, this only reads it.

## Testing

`gym-sleep-check-logic.selfcheck.cjs`: `isPoorSleepEntry(null)` → `false`; an entry with `hours: 5` → `true`; `hours: 7` → `false`; `quality: 2` → `true`; `quality: 3` → `false`; an entry with only `hours` set (quality `null`) and `hours: 4` → `true`; an entry with both fields `null` → `false`.

`applyCheckinOverride()`'s wiring stays untested glue, consistent with how it's already integrated today (no dedicated test file for the function itself, only for the extracted pure pieces it now calls).

Browser verification: log a `health:sleep` entry for today with `hours: 5` and no quality, no pain/recovery check-in for today. Confirm an exercise that would normally show "Add weight" now shows the capped hold with the sleep-only reason text. Then also log a `recovery: 'low'` check-in for the same day and confirm the reason text switches to the "both" wording. Confirm a day with neither sleep nor checkin data still behaves exactly as it does today.
