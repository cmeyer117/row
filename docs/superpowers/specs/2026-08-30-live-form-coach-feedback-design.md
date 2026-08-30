# Live In-Session Form Coach Feedback — Design

**Date:** 2026-08-30
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

Carl's north-star note (`Carl Meyer/02 - Projects/ROW Dashboard.md`) named "active in-session form coaching, not just post-hoc critique" as untested territory. Auditing `form-coach.html` before designing found the premise only half true: the camera and pose-detection pipeline are already fully real-time (`startDetectionLoop` runs MediaPipe's `PoseLandmarker` on every frame via `requestAnimationFrame`, buffering `{t, landmarks}` live while "Record Set" is active) — but nothing is computed or shown until the user clicks "Stop Recording." A whole set can be lifted with zero feedback, then everything (rep segmentation, ROM/tempo/stability scoring, AI critique) fires at once at the end.

The real gap isn't camera/detection infrastructure — it's that the existing, already-tested scoring pipeline (`buildPrimarySignal` → `buildStabilitySamples` → `window.FormCoachLogic.scoreSet` → `renderResult`) only ever runs once, at stop.

## Approach

Run the exact same pipeline on a timer while recording, instead of only at stop. `segmentReps()` (inside `scoreSet`) already only returns a rep once its full start→mid→end extrema are found — it never returns a "rep" still in progress — so calling it repeatedly on a growing buffer is already correct with zero changes to the scoring logic itself.

1. **Move exercise-name lookup to record-start.** Currently read from `#liftExerciseName` only at stop (`form-coach.html:508`). Read it when recording starts instead, so `matchedBenchmark` is available for live depth-scoring on every interval tick, not just the final one.

2. **Add a recording-scoped interval.** In the `recordBtn` click handler's "start recording" branch (`form-coach.html:494-499`), after setting `recording = true`, start `setInterval` at 1500ms that re-runs the scoring pipeline on the current `buffer` and calls `renderResult`. Store the interval id so the "stop recording" branch can `clearInterval` it (mirroring the existing `LiftCamera.cancelLoop` pattern already used for the detection loop).

3. **Guard the empty-result case during live updates.** `renderResult([])` shows "No clear reps detected — make sure your full body stays in frame through the whole set" (`form-coach.html:435`) — correct wording for the end of a set, misleading if shown 1.5s into the first rep before anything's completed yet. The live interval's tick skips calling `renderResult` entirely when `scored.length === 0`, leaving the existing empty `resultEl` (cleared at record-start, `form-coach.html:497`) as-is until the first rep actually completes.

4. **Stop-time behavior is unchanged.** The existing stop-click code (`form-coach.html:500-531`) already re-runs the full pipeline one final time and fires the AI critique — this still happens exactly as today, catching the very last rep (which may have completed in the gap since the last 1500ms tick) and unchanged for the post-hoc AI critique (no new API cost — the critique call stays exactly where and how often it already runs, once per set).

### Why 1500ms, not per-frame

The detection loop already samples at 100ms (`form-coach.html:466`); re-running full-buffer rep segmentation at that same cadence would be pure waste — a rep takes on the order of 1-3+ seconds, so nothing changes fast enough to need sub-second UI updates, and re-scanning a several-hundred-frame buffer 10x/second for no visible benefit is needless work for a lazy-battery/lazy-CPU mobile browser context. 1500ms is fast enough to feel "live" (roughly one update per rep for a typical tempo) without meaningfully taxing a phone browser tied to a live camera feed.

### Why not incremental/streaming rep segmentation

`segmentReps`'s extrema-finding is a single linear scan (`O(n)` over the buffer). At 100ms sampling, even a 90-second set is under 1000 frames — trivial to rescan in full every 1.5s. Building true incremental segmentation (tracking extrema state across calls instead of rescanning) would add real complexity and a second code path to keep in sync with the existing pure `segmentReps`, for a performance problem that doesn't exist at this scale.

## Files touched

- Modify: `form-coach.html` (the `recordBtn` click handler and its enclosing scope, ~lines 279-533) — no other file changes. No new pure-logic functions needed in `form-coach-logic.js`; this is purely a call-timing change in the page's own wiring.

## Edge cases

- **Recording stopped before any rep completes** (buffer too short, `form-coach.html:504-507`'s existing `buffer.length < 10` guard): unaffected — the live interval simply never rendered anything (per the empty-result guard above), so stopping early looks identical to today's "too short" message, no stale live UI left behind.
- **Interval outliving the recording** (e.g. rapid start/stop clicking): `clearInterval` runs in the same "stop recording" branch that already resets `recording = false`, so there's no window where a stale interval fires after recording has stopped and mutates `resultEl` out from under the stop-branch's own final render. Order matters: `clearInterval` must run, then the stop-branch's own final scoring pass, so the final pass is always the last write to `resultEl`.
- **Tab backgrounded mid-set**: `startDetectionLoop`'s existing `isActiveFn` guard (`form-coach.html:466`, tied to `isTabActive`) already stops feeding new frames to the buffer when the tab isn't active — the live-scoring interval keeps ticking on whatever's already in the buffer (harmless, just re-renders the same result until the tab is active again), no new interaction to design for.
- **Benchmark match unavailable** (unrecognized exercise name): identical to today's existing fallback — `buildPrimarySignal` falls back to Y-position tracking when no benchmark match exists or angle data is too sparse (`form-coach.html:392-404`, unchanged), so live updates during an unmatched exercise show tempo/stability flags without a depth target, same as a post-hoc unmatched-exercise result does today.

## Out of scope (this pass)

- Spoken/audio cues — Carl chose visual-only for this pass (zero marginal cost, no new interruption/volume handling to design).
- Any change to the AI critique call — stays exactly as it is today: one call, at stop, unchanged frequency and cost.
- Posing-mode's equivalent (`critique-pose.ts`) — a separate, purely photo/video-review flow (single image or short clip, not a live rep-by-rep set), not touched by this design. If posing ever wants a live equivalent, that's a distinct scoping question — the two camera modes track meaningfully different things (rep sets vs. a static/held pose).

## Testing

`form-coach.html` has no test harness (matches this session's other Row static-page builds) — the scoring functions themselves (`segmentReps`, `scoreSet`, etc.) are already covered by `form-coach-logic.selfcheck.cjs` and are unchanged by this design. Verification for the new wiring:

- Manual trace (Node, same technique used for tonight's earlier Row build): simulate a growing buffer by calling `buildPrimarySignal`/`buildStabilitySamples`/`scoreSet` on `buffer.slice(0, n)` for increasing `n`, confirming the returned `scored` array only grows (never shrinks or changes past entries) as more frames are added — this is the core correctness property the live-interval design depends on.
- Live browser trace (real camera, since this feature has no meaningful way to verify without one): start a set, confirm the rep-card list is empty (not showing the "no reps detected" message) for the first partial rep, then confirm a new row appears within ~1.5s of completing each subsequent rep, then confirm stopping produces the same final list plus the AI critique exactly as today.
- Confirm rapid start/stop/start clicking doesn't leave two intervals running simultaneously (would double-render, though harmlessly, since `renderResult` is idempotent for a given `scored` array — but the interval leak itself would be a real bug worth catching).
