# Judge's-Eye Readiness Index — Design

**Date:** 2026-08-20
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

Posing has a practice-session log (`posing:log`, shipped 2026-08-14) but no scored check-in — no way to see "how is my posing actually trending" month over month. Carl wants a manual, monthly 3-pose self-score, with no AI judging in v1.

## Ground truth (verified in-session)

- `posing.html` already has cloud sync wired: `initCloudSync({ appKey: 'posing', syncedKeys: ['posing:log'], onApplied: renderPosingLog })` at the bottom of its script block, plus local `_get`/`_set` helpers and an `upsertByDate(list, date, fields)` helper.
- `weekly-review.html` already pulls in per-domain logic modules as plain `<script src="...-logic.js"></script>` tags (`gym-volume-logic.js`, `gym-season-logic.js`, `gym-readiness-logic.js`) and reads their pure functions inline — this is the established pattern for surfacing a metric there.
- `gym-readiness-logic.js` is an unrelated existing "readiness" concept (workout-day gym readiness) — this feature uses a distinct key (`posing:readiness`) and file name (`readiness-index-logic.js`) to avoid collision.

## Scope

A manual monthly check-in: date, up to 3 pose name + 1-5 score pairs, optional note. A small pure-logic module computes the average and trend so `weekly-review.html` can surface one line every week regardless of whether a new check-in happened that week. No AI judging, no photo/video capture, no per-pose history charting — v1 is score-in, one-line-summary-out.

## Data model

New `posing:readiness` localStorage key — array of:

```js
{ date, scores: [{ pose, score }, { pose, score }, { pose, score }], note }
```

Pose names are free text (matches `posing:log`'s existing free-text-over-enum choice). Rows with an empty pose name or empty score are dropped on save (same null/empty filtering `upsertByDate` already applies to `posing:log` fields). `scores` itself is never empty-filtered by `upsertByDate` (it's an array, not `null`/`undefined`/`''`), so at least one non-empty row must exist for an Add to do anything.

Synced via the same `initCloudSync` call already on `posing.html` — add `'posing:readiness'` to the existing `syncedKeys` array, no new call, no migration.

## `readiness-index-logic.js`

Pure functions, `<script>`-tag module (browser global + `module.exports` for Node, matching `gym-readiness-logic.js`'s shape):

```js
function averageScore(entry) {
  const vals = (entry.scores || []).map(s => s.score).filter(n => typeof n === 'number');
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function trend(currentAvg, previousAvg) {
  if (currentAvg == null || previousAvg == null) return null;
  if (currentAvg > previousAvg) return 'up';
  if (currentAvg < previousAvg) return 'down';
  return 'flat';
}

function latestCheckin(list) {
  if (!list || !list.length) return null;
  return list.slice().sort((a, b) => a.date.localeCompare(b.date))[list.length - 1];
}

function daysSince(dateStr, today) {
  const ms = new Date(today) - new Date(dateStr);
  return Math.round(ms / 86400000);
}
```

`.selfcheck.cjs` alongside it (same pattern as `gym-readiness-logic.selfcheck.cjs`): asserts average/trend/daysSince against a couple of hand-built fixtures, including the "only one prior check-in" (`trend` returns `null`) and "empty scores" (`averageScore` returns `null`) edge cases.

## UI (posing.html)

New section directly below the existing practice-log section (`#poseLogList` block), above the `.mob-tabs` Competition/Content tabs:

- Date input (defaults to today, same as the practice log)
- 3 fixed row pairs: pose-name text input + 1-5 `<select>`
- Optional note text input
- Add button → `upsertByDate(getReadinessLog(), date, { scores: collectedRows, note })`
- Reverse-chronological list below, each item showing date + the 3 pose/score pairs + note, with a delete control (mirrors `renderPosingLog`'s `data-del-date` pattern)

`getReadinessLog()`/`setReadinessLog()` wrap `_get('posing:readiness')`/`_set`, same shape as `getPosingLog`/`setPosingLog`. `renderReadinessLog()` also gets called from `onApplied` (alongside `renderPosingLog`) so a cross-device sync re-renders both logs.

## weekly-review.html surfacing

Add `<script src="readiness-index-logic.js"></script>` next to the other `-logic.js` includes. On render, read `posing:readiness` from the synced app state:

```js
const list = getReadinessLog(); // or however weekly-review reads posing's synced state
const latest = latestCheckin(list);
if (latest) {
  const avg = averageScore(latest);
  const prev = list.length > 1 ? averageScore(list[list.length - 2]) : null;
  const t = trend(avg, prev); // 'up' | 'down' | 'flat' | null
  const age = daysSince(latest.date, todayStr);
  // "Posing: 3.7/5 (↑) — checked in 12 days ago"
}
```

If `posing:readiness` is empty (no check-in ever logged), no line renders — same first-run silence as other weekly-review cards.

## Error handling

- No check-ins yet → posing.html list renders empty; weekly-review shows nothing (not an error state).
- A check-in with fewer than 3 filled pose rows → still saved, `averageScore` just averages whatever's present.
- Only one check-in ever logged → `trend` returns `null`, weekly-review line omits the arrow.

## Out of scope

- AI/vision-based pose judging (the separate, larger Posing & Lift-Form Coach camera project).
- Per-pose historical charting/sparklines.
- Adherence targets or reminders beyond the plain "days since" number already surfaced.
- Any change to `posing:log` (the existing practice-session log) or `gym-readiness-logic.js`.

## Testing

- `readiness-index-logic.selfcheck.cjs` — pure function assertions (average, trend incl. single-entry/empty-scores edge cases, daysSince).
- Browser verification: log a 3-pose check-in on `posing.html`, confirm it appears above the tabs and below the practice log, confirm it persists on reload and syncs. Log a second check-in with a lower average, confirm `weekly-review.html` shows a `↓` trend line with the correct days-since count. Delete a check-in, confirm the list and weekly-review line update.
