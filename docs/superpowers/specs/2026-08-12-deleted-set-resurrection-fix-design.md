# Deleted Workout Set Resurrection — Design

**Date:** 2026-08-12
**Status:** approved, ready for implementation
**Author:** Claude (brainstorming session with Carl)

## Context

Discovered live during the voice-logging debugging saga (see `2026-08-10-po-coach-push-merge-race-design.md` and `2026-08-11`/`2026-08-12` HANDOFF entries): after that spec's merge-before-push fix landed, a previously-deleted workout set reappeared once Carl closed and reopened `gym.html`.

Root cause, traced through the real code:

- The workout-history delete button (`gym.html`, the `po-hist-del` click handler, ~line 4118) does a real, hard local removal: `arr.splice(origIdx, 1)`. No tombstone, no marker — the entry is just gone from `state.logs[exId]` locally.
- `GymStateMergeLogic.mergeLogs()` (`gym-state-merge-logic.js`) is a pure union: `merged[exId] = [...remoteArr, ...localOnly]`. It has zero concept of deletion — every remote entry always survives a merge.
- `pcPushNow()` (fixed 2026-08-11 to call `await pcPullRemote()` before collecting/pushing, to protect against losing a concurrent writer's addition) means **every push now pulls remote first** — and remote still has the entry the user just deleted, since nothing ever told it otherwise. The merge reintroduces it into local state before the push even happens.
- The same failure mode already existed independent of that fix, on any *regular* pull (e.g. a page reload's initial `pcPullRemote()` call) — last night's fix just added another trigger point that surfaces it far more often.

This is the classic distributed-tombstone problem: deleting by omission doesn't propagate, because nothing distinguishes "never existed" from "existed and was removed."

## Goals

- A deleted workout set stays deleted through a push, a pull, and a page reload.
- Minimal surface area — this file has dozens of call sites that read `state.logs` directly (PR calculations, history rendering, today's-workout summaries, etc.); none of them should need to change.
- Reuse the existing merge-before-push architecture rather than inventing a new sync path.

## Non-goals

- Not building `sync.js`'s forever-tombstone convention (used today for `po_coach_weights`/`po_coach_photos`) for `po_coach_v1.logs`. That pattern requires every reader to filter `deleted: true` entries — a large, risky diff across a 7,000-line file for a gap only one delete button actually exercises.
- Not adding tombstone support to `mergeJointPain()` or `mergeCheckins()`. Checked: there's no delete UI for joint-pain entries at all (only `logJointPain()` — add-only), so that merge function has nothing to fix.
- Not solving the residual multi-device edge case described below — accepted as out of scope given this app's real usage pattern (see Error handling).

## Architecture

### 1. `gym-state-merge-logic.js` — `stableKey()` ignores `deleted`, `mergeLogs()` becomes tombstone-aware but never persists tombstones

**Prerequisite fix, caught during this design's own self-review:** `stableKey()` today is `JSON.stringify(entry, Object.keys(entry).sort())` — since a tombstoned entry has an extra `deleted` field, it would hash to a *different* key than its live counterpart, so the two would never be recognized as "the same entry" and both would survive a merge, silently defeating the whole fix. `stableKey()` must strip `deleted` before hashing:

```javascript
function stableKey(entry) {
  if (entry && 'deleted' in entry) {
    const rest = Object.assign({}, entry);
    delete rest.deleted;
    return JSON.stringify(rest, Object.keys(rest).sort());
  }
  return JSON.stringify(entry, Object.keys(entry).sort());
}
```

This is safe everywhere else `stableKey()` is already used (`mergeJointPain()`, `sync.js`'s tombstone-aware `mergeArrays()` for weights/photos) — none of those entries have ever had a `deleted` field before, so the `'deleted' in entry` branch simply never fires for them; behavior is unchanged.

```javascript
function mergeLogs(remoteLogs, localLogs) {
  remoteLogs = remoteLogs || {};
  localLogs = localLogs || {};
  const merged = {};
  const allExIds = new Set([...Object.keys(remoteLogs), ...Object.keys(localLogs)]);
  for (const exId of allExIds) {
    const remoteArr = Array.isArray(remoteLogs[exId]) ? remoteLogs[exId] : [];
    const localArr = Array.isArray(localLogs[exId]) ? localLogs[exId] : [];
    const byKey = new Map();
    // Local first, then remote -- remote can overwrite a live local entry,
    // but a local tombstone must survive being overwritten by remote's
    // still-live copy of the same entry (checked next). Both now hash to
    // the SAME key via the fixed stableKey() above, so this comparison
    // actually recognizes them as the same entry.
    for (const e of localArr) byKey.set(stableKey(e), e);
    for (const e of remoteArr) {
      const k = stableKey(e);
      const existing = byKey.get(k);
      if (!existing || !existing.deleted) byKey.set(k, e);
      // else: local tombstone wins, remote's live copy is dropped
    }
    const result = Array.from(byKey.values()).filter((e) => !e.deleted);
    if (result.length) merged[exId] = result;
  }
  return merged;
}
```

Key property: the function's **return value never contains a `deleted: true` entry** — tombstones are used only internally, during de-duplication, to decide which side of a same-identity pair wins. Once that's decided, the tombstoned entry is filtered out of the output entirely, same as if it had simply never existed.

### 2. `gym.html` — the delete handler marks instead of splices

```javascript
wrap.querySelectorAll('.po-hist-del').forEach(b => {
  b.addEventListener('click', () => {
    if (!confirm('Delete this log?')) return;
    const realIdx = parseInt(b.dataset.idx, 10);
    const entry = logs[logs.length - 1 - realIdx];
    if (!entry) return;
    const arr = state.logs[state.currentEx] || [];
    const origIdx = arr.indexOf(entry);
    if (origIdx === -1) return;
    if (!state.recentlyDeleted) state.recentlyDeleted = [];
    state.recentlyDeleted.push({ exId: state.currentEx, entry: entry });
    if (state.recentlyDeleted.length > 20) state.recentlyDeleted.shift();
    // fix (2026-08-12): mark deleted instead of splicing, so a sync
    // merge-before-push can correctly out-rank remote's still-live copy
    // instead of silently reintroducing it. mergeLogs() strips this from
    // its own output, so every other reader of state.logs is unaffected --
    // by the time anything else looks at state.logs after the next
    // save+merge cycle, the entry is genuinely gone, not just flagged.
    arr[origIdx] = Object.assign({}, entry, { deleted: true });
    state.logs[state.currentEx] = arr;
    saveState(); renderAll();
  });
});
```

This still triggers the existing `localStorage.setItem` interceptor → `pcSchedulePush()` → `pcPushNow()` → `await pcPullRemote()` (merges, tombstone wins, writes the *entry-free* result back to local storage) → `pcCollectState()`/push (now correctly propagates the omission to remote). No changes needed to `pcPushNow()`, `pcPullRemote()`, or `pcApplyRemoteState()` — they already do the right sequence; they just needed `mergeLogs()` to know about tombstones.

One consequence worth naming: between the `arr[origIdx] = {...deleted:true}` line and the next successful push+merge cycle, `state.logs[exId]` locally contains a tombstoned entry. Any reader that doesn't already filter would show a "ghost" entry for that narrow window (milliseconds to ~250ms debounce). Checked: every existing reader (`getTodaySets`, `logsByDay`, PR/history calculations) iterates raw array entries and would display `deleted: true` fields as if they were real — e.g. a weight/reps pair would still render. This is a real, if brief, visual glitch worth closing.

**Resolved in the same change:** immediately after setting the tombstone, splice it out of the *local, in-memory `arr`* for rendering purposes, while still writing the tombstoned marker to `localStorage` (via `saveState()`) so the sync layer sees it:

```javascript
    arr[origIdx] = Object.assign({}, entry, { deleted: true });
    state.logs[state.currentEx] = arr;
    saveState(); // writes the tombstoned array to localStorage, triggers the sync push
    arr.splice(origIdx, 1); // in-memory only, past this point -- immediate correct render
    renderAll();
```

This keeps the on-screen behavior identical to today (entry vanishes immediately on delete) while still giving the sync layer the tombstone it needs on its next merge cycle.

## Error handling / known residual gap

**Two-device staleness:** if a second device/tab pulled *before* the delete and pushes *after* Carl's device has already propagated the tombstone-stripped state to remote, that second device's stale local copy (still has the live entry, no tombstone) will be treated as "local-only, add it" by `mergeLogs()` on ITS next merge, resurrecting the entry once more. This is the fundamental limit of omission-based deletion in an eventually-consistent system without permanent tombstones. Accepted as out of scope: Carl's real usage is single-primary-device (his phone); the risk is a leftover open tab on another device, which is a narrow, low-frequency case. If it ever becomes a real problem, the fix is `sync.js`'s existing forever-tombstone pattern, ported to `po_coach_v1.logs` — a larger follow-up, not this spec.

**Codex review caught a real integration gap during implementation, fixed same session:** `pcPullRemote()`'s "no-change-since-last-sync" shortcut (an optimization so a UI-refresh pull doesn't do unnecessary work) also short-circuited `pcPushNow()`'s reuse of that same function as its pre-push merge/strip step — since deleting a set doesn't itself change *remote*, the shortcut fired on essentially every delete, skipping the merge entirely and letting a raw un-stripped tombstone reach both localStorage and the eventual push. Fixed by giving `pcPullRemote()` an `opts.force` parameter; `pcPushNow()` now calls it with `{ force: true }` so its merge always runs, while the other 3 call sites (boot pull, voice-log post-reply refresh, wake/visibility re-pulls) stay unforced since they're genuinely UI-refresh pulls, not pre-push merges.

**Remaining narrow residual, accepted, not fixed:** `pcFlushPushOnUnload()` (the fire-and-forget tab-close backup push, already a documented accepted tradeoff in `2026-08-11-po-coach-push-merge-race-design.md` since it can't afford an async round trip before the page closes) reads localStorage directly with no merge step. If a delete happens and the tab is closed/backgrounded within the 250ms debounce window before `pcPushNow({ force: true })` gets to run, the raw tombstoned entry could reach remote via this path instead. Assessed as non-destructive: any later merge (next reopen, next pull) still correctly strips it from what any reader ever sees — the deletion still sticks, the entry just sits as an inert tombstone marker in remote's raw JSON until the next real sync cycle, the same tolerance `sync.js`'s own weights/photos tombstones already have by design. Given the tight timing window and self-healing worst case, not worth touching `pcFlushPushOnUnload()`'s synchronous constraints for.

## Testing

No test framework in `gym.html` (matches its existing convention). `gym-state-merge-logic.js` *does* have prior art for pure-function testing (`gym-voice-logic.test.js`, since deleted) and this repo generally test-covers pure logic files via `vm`-sandboxed `.test.js` files run with `node` directly (see `gym-state-merge-logic.test.js` if one exists, or the now-deleted voice-logic test for the pattern). Add `gym-state-merge-logic.test.js` cases for `mergeLogs()`:

1. Local tombstone + remote still-live copy of the same entry → merged output omits it entirely.
2. Remote tombstone (a second device already deleted and pushed) + local still-live copy → merged output omits it (remote's tombstone wins too, not just local's).
3. A genuine local-only new entry (no remote counterpart) → still included, unaffected by tombstone logic.
4. A genuine remote-only entry (no local counterpart) → still included, unaffected.
5. Existing non-deletion merge behavior (two different entries for the same exercise, no tombstones involved) → unchanged from today.

Live verification: delete a set on the real deployed app, confirm (a) it vanishes immediately in the UI, (b) ask Vision directly ("what have I logged today") to confirm server-side it's actually gone after the next push completes — the only reliable read path left, since RLS lockdown blocks direct anon-key verification now.

## Migration / rollout

No data migration — this only changes behavior for deletions that happen after the fix ships. Any already-resurrected entries from tonight's incident need a one-time manual re-delete by Carl after this deploys; not worth automating for what's likely 1-2 entries.
