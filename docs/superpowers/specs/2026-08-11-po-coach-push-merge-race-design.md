# `po-coach` Push/Write Race Fix — Design

**Date:** 2026-08-11
**Status:** approved, ready for implementation
**Author:** Claude (brainstorming session with Carl)

## Context

Last night's voice-logging on-device test (`2026-08-10-voice-log-vision-talk-design.md`) surfaced a real data-loss bug: Vision's `log_workout` action reported success (confirmed via `vision_turns` history), but the logged set never appeared in the `po_coach_v1` cloud state — confirmed via a direct Supabase read, no trace anywhere.

Initial diagnosis (last night, under time pressure) assumed the generic `sync.js` helper (`initCloudSync`/`applyRemote`) was responsible and does a blind overwrite. Re-checked this session with the actual code: `sync.js` isn't even wired up for `po_coach_v1` in `gym.html` — it's only used for the unrelated `hype-audio` sub-feature. `gym.html` has its own bespoke, more sophisticated sync (`pc*` functions, ~`gym.html:6668-7060`), including a real merge-on-pull (`pcApplyRemoteState`) that unions log entries via `GymStateMergeLogic.mergeLogs()` and never drops a remote entry. That part was never broken.

**The actual gap:** the push side. `pcPushNow()` collects local `localStorage` and does a blind `upsert()` — no check against what's currently on the server. Vision's `logWorkout()` (`vision/src/_jarvis/tools/log-workout.ts`) does the same on its side: read Supabase → modify → write back, no version check. Two blind writers, no coordination. `pcPushNow()` fires on a 250ms debounce after *any* local change to a synced key, so the race window is open essentially continuously whenever Row's tab is open — not a rare edge case.

Sequence that actually happened: Row's tab was open while Carl used voice logging. Vision wrote the new set directly to Supabase. Sometime after that (but before Row's tab ever pulled/merged it in), Row's own debounced push fired, built from a local snapshot that didn't yet know about Vision's addition, and silently overwrote the Supabase row — including Vision's set — with the older local view.

## Goals

- Close the specific observed failure: a concurrent server-side writer's change (Vision's `log_workout`, or in principle another device) surviving a subsequent local push instead of being silently erased.
- Reuse existing, already-correct merge logic — no new merge functions.
- Minimal diff, matching the actual risk (single-user personal app, not a high-concurrency system).

## Non-goals

- Not building full optimistic-concurrency/compare-and-swap (`updated_at`-conditioned writes). The residual TOCTOU window after this fix (milliseconds between pull and push, inside one `pcPushNow()` call) is far narrower than today's open-ended gap and not worth the added complexity for this app's actual usage pattern.
- Not touching `pcFlushPushOnUnload()` (the fire-and-forget tab-close backup push). It's deliberately unawaited/synchronous-ish because the page is closing — no time for a round-trip pull first. A small residual race remains there; accepted, matches the file's existing tradeoffs elsewhere (e.g. the documented `syncReady`/first-pull guards).
- Not changing Vision's `logWorkout()` — the higher-leverage fix is on Row's side, since Row's push fires far more often (every local edit) than Vision's writes (only on `/talk` actions).

## Architecture

Single change, `gym.html`, `pcPushNow()`:

```js
async function pcPushNow() {
  if (!pcSupa) return;
  // fix (2026-08-11): merge remote first so a concurrent writer (Vision's
  // log_workout, another device) that landed since our last pull isn't
  // silently overwritten by this blind push. pcPullRemote() already pulls,
  // merges via the proven mergeLogs/mergeJointPain/mergeCheckins union
  // logic, and writes the merged result to localStorage.
  await pcPullRemote();
  const state = pcCollectState();
  const json = JSON.stringify(state);
  if (json === pcLastSyncedJson) return;
  pcWarnIfShrinking(state);
  const weightCount = Array.isArray(state.po_coach_weights) ? state.po_coach_weights.length : 0;
  try {
    const { error } = await pcSupa
      .from('app_state')
      .upsert(
        { key: APP_KEY, data: state, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    if (!error) { pcLastSyncedJson = json; pcDebug('push-success', { weightCount }); }
    else pcDebug('push-returned-error', { msg: error.message, weightCount });
  } catch (e) { pcDebug('push-threw', { msg: e && e.message, weightCount }); }
}
```

Only the new `await pcPullRemote();` line at the top; everything below is unchanged.

**Self-trigger note:** `pcPullRemote()` can itself call `pcSchedulePush()` if the merge changed local state (existing behavior, unchanged). That schedules a *second*, later `pcPushNow()` call via the normal 250ms debounce timer — not a synchronous recursion. When that second call runs, `pcPullRemote()` will find nothing new to merge and `pcCollectState()` will match `pcLastSyncedJson` (already updated by the first call's successful push), so it no-ops immediately. One harmless extra SELECT, no loop.

## Data flow after the fix

1. Local edit → `pcSchedulePush()` → 250ms later → `pcPushNow()`.
2. `pcPushNow()` awaits `pcPullRemote()`: SELECT current remote row. If it differs from what Row last saw, merge it into `localStorage` via the existing `pcApplyRemoteState` (logs/jointPain/checkins unioned, other keys remote-wins) and re-render.
3. `pcCollectState()` now reads the post-merge `localStorage` — includes anything a concurrent writer added.
4. Upsert the merged state. `pcLastSyncedJson` updated only on success.

## Error handling

Unchanged from today — `pcPullRemote()` already has its own try/catch and `pcDebug()` tracing (network failure, empty remote row, first-pull-vs-wake-repull distinction all already handled). If the pull itself throws, `pcPullRemote()`'s existing catch block handles it and returns; `pcPushNow()` then proceeds to `pcCollectState()`/push using whatever local state already existed (same behavior as today when nothing has changed remotely) — a failed merge-pull degrades to today's existing (imperfect but working) behavior, not a new failure mode.

## Testing

No test framework for this file (matches its existing convention — no `gym.html` inline logic has automated coverage, verification is live/manual). Live-verification plan:

1. Re-run last night's exact failing sequence: voice-log a set via Vision's `/talk` while Row's gym.html tab is open and has recently pushed (e.g. right after toggling a favorite or logging something else locally, so a push is in-flight or was recent). Confirm via a direct Supabase read (same method used to catch the original bug) that the set survives.
2. Confirm a normal local edit (e.g. logging a set the regular way) still pushes correctly and shows up on a second device/tab.
3. Watch `pcDebug` trail (`po-coach-sync-debug` row) for a live session to confirm no unexpected push-storm from the self-trigger behavior described above.

## Migration / rollout

No data migration. Pure client-side logic change, takes effect on next page load/deploy.
