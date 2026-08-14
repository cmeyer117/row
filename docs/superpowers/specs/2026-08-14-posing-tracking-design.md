# Posing Tracking — Design

**Date:** 2026-08-14
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

`posing.html` is the last piece of the `coachSnapshot` backlog trio (cardio and the sleep bridge both shipped earlier today). It's currently pure reference content — 7 competition poses + 14 content poses, each with a detail card and photo/diagram — with zero tracking of any kind.

## Ground truth (verified in-session)

- `posing.html` already has the standard page boilerplate — `supabase-js` CDN, `row-auth.js`, `topbar.js` — but **no `sync.js` script tag and no `initCloudSync()` call**. It has nothing to sync today, so this is the first time the page needs cloud sync at all, not a bridge into existing sync wiring.
- `mobility.html`'s `MobilitySelfAssessment` (a multi-step pass/fail test-runner UI per body area) is the wrong precedent to mirror — that's a periodic structured assessment, not what a practice log needs. This build is closer in spirit to `health.html`'s simple date-logged entries (cardio, sleep) than to mobility's self-assessment.
- The page's own existing tip text ("film it weekly — you will notice a difference") already frames this as session-based practice tracking, not per-pose scoring.

## Scope

A simple practice-session log — date, which poses were practiced (free text, not a checkbox multi-select against all 21 named poses — matches the same free-text-over-enum judgment call cardio's `type` field already made, avoids wiring a dynamic pose-picker UI for something Carl can just type), and an optional note. **Not** in scope: per-pose self-assessment/scoring (mobility's pattern), photo/video capture or AI analysis (the separate, much bigger "Row Posing & Lift-Form Coach" camera project already tracked in `HANDOFF.md`), or any adherence/target system (same deferred-until-real-data reasoning as cardio and sleep).

## Approach

New `posing:log` localStorage key (array of `{ date, poses: string|null, note: string|null }`), synced via a **new** `initCloudSync()` call with its own `appKey: 'posing'` (distinct from `health.html`'s `'health'` appKey — matches how `gym.html`/`finance.html`/`main.html`/`macros.html` each use their own dedicated appKey rather than sharing one). Same `upsertByDate()`-style dedup-by-date convention `health.html` already established (one entry per date).

### UI

A new log section placed **above the Competition/Content tabs** (`.mob-tabs`), not nested inside either tab — the log applies to a practice session regardless of which pose set was practiced, so it shouldn't live inside one tab's content and disappear when Carl switches to the other. Same visual shape as `health.html`'s form-row/list pattern (adapted to this page's own `.mob-*` class names, not `.hm-*`, since this page's CSS is a different design system): a form-row (date + poses text input + note text input + Add button), and a reverse-chronological list with a delete control per entry. No chart/sparkline needed — this isn't a numeric metric to trend, just a practice log.

### Functions

```js
function getPosingLog() { return _get('posing:log') || []; }
function setPosingLog(list) { _set('posing:log', list); }
function renderPosingLog() { /* list render + delete wiring, same shape as health.html's list renders */ }
```

`_get`/`_set` are the same tiny localStorage-JSON wrappers `health.html` already defines locally — `posing.html` needs its own copies (no shared module between pages for this trivial a helper, matching how `health.html` and `macros.html` each define their own rather than importing one).

## Error handling

- No entries yet → list renders empty, no special empty-state needed (no chart to gate on entry count, unlike cardio/sleep).
- A log with only `poses` filled (no note) or vice versa → same null/undefined/empty-string filtering pattern as every other page's date-keyed log.

## Out of scope

- Per-pose self-assessment or scoring.
- Photo/video capture, storage, or AI-based pose analysis — belongs to the separate camera-based Posing & Lift-Form Coach project.
- Any wiring into `gym.html`'s coach logic (`getRx()`, `applyCheckinOverride()`) — this is tracking-only, matching cardio's same deferred-bridge sequencing.

## Testing

No pure logic module — UI + localStorage glue mirroring an established pattern, same as `health.html`'s tabs (no dedicated test files there either).

Browser verification: open `posing.html`, confirm the new log section renders above the tabs regardless of which tab (Competition/Content) is active. Log an entry (today's date, poses "front double biceps, side chest", no note). Confirm it appears in the list. Switch between Competition/Content tabs and confirm the log section stays visible and unaffected. Reload the page, confirm the entry persists. If signed in with cloud sync active, confirm the entry syncs (check `app_state` under the `posing` key, or a second device/tab).
