# Live In-Session Form Coach Feedback — Design

**Date:** 2026-08-30
**Status:** Approved (revised post-TDD — see "Revision note" below)
**Owner:** Row (`C:\Users\gregm\row`)

**Revision note:** implementation's own verification step (the Node trace this spec calls for below) caught a real bug the original design missed: re-running `scoreSet()` with a `minAmplitude` freshly recomputed from the buffer's own still-growing `range` let the jitter-filter threshold drift, retroactively reinterpreting where earlier rep boundaries were — not just the most recent rep. Digging further found something deeper: `romFlag`/`tempoFlag`/`stabilityFlag` (and the `romPct`/`tempoRatio`/`avgJitter` they're derived from) are all computed relative to the AVERAGE across every rep in the set — a moving target by definition until the set ends, not something any calibration fix can stabilize. `rom`/`durationMs`/`eccentricMs`/`concentricMs`/`depthDeg`/`depthMet` are NOT relative to other reps (raw values, or absolute vs. a fixed benchmark) and stay genuinely stable. Sections below are updated to reflect the corrected design: freeze the amplitude threshold once per recording (after a ~4s calibration floor), hold back the most recent (still-provisional) rep, and only show the absolute fields live — the set-relative quality flags stay exactly as they are today, shown only at Stop. Verified via a Node trace against the real `form-coach-logic.js` functions across 4 seeded-noise datasets.

## Problem

Carl's north-star note (`Carl Meyer/02 - Projects/ROW Dashboard.md`) named "active in-session form coaching, not just post-hoc critique" as untested territory. Auditing `form-coach.html` before designing found the premise only half true: the camera and pose-detection pipeline are already fully real-time (`startDetectionLoop` runs MediaPipe's `PoseLandmarker` on every frame via `requestAnimationFrame`, buffering `{t, landmarks}` live while "Record Set" is active) — but nothing is computed or shown until the user clicks "Stop Recording." A whole set can be lifted with zero feedback, then everything (rep segmentation, ROM/tempo/stability scoring, AI critique) fires at once at the end.

The real gap isn't camera/detection infrastructure — it's that the existing, already-tested scoring pipeline (`buildPrimarySignal` → `buildStabilitySamples` → `window.FormCoachLogic.scoreSet` → `renderResult`) only ever runs once, at stop.

## Approach

Run the exact same pipeline on a timer while recording, instead of only at stop. `segmentReps()` (inside `scoreSet`) already only returns a rep once its full start→mid→end extrema are found — it never returns a "rep" still in progress — so calling it repeatedly on a growing buffer is already correct with zero changes to the scoring logic itself.

1. **Move exercise-name lookup to record-start.** Currently read from `#liftExerciseName` only at stop (`form-coach.html:508`). Read it when recording starts instead, so `matchedBenchmark` is available for live depth-scoring on every interval tick, not just the final one.

2. **Add a recording-scoped interval, gated on a calibration floor.** In the `recordBtn` click handler's "start recording" branch, after setting `recording = true`, start `setInterval` at 1500ms. Each tick returns immediately if `buffer.length < 40` (~4s at the 100ms detection interval) — not enough data yet for the buffer's own observed range to reflect the exercise's true range. Once past that floor, compute `minAmplitude` from `primary.range * 0.15` **once** and freeze it in a variable that's reset only at the next record-start — never recomputed mid-recording. (Original draft recomputed it every tick; a Node trace caught this letting the threshold drift and retroactively reinterpret earlier rep boundaries.)

3. **Hold back the most recent rep.** `segmentReps`'s trailing extremum is always "whatever's most extreme when the buffer ran out," not a confirmed reversal — so the last-formed rep's end boundary can still shift on a later tick even with `minAmplitude` frozen. Every earlier rep was confirmed by a real amplitude-reversal and is provably stable once frozen (verified via Node trace). Live ticks render `scored.slice(0, -1)`, never the full array.

4. **Show only the absolute fields live, not the set-relative quality flags.** `romFlag`/`tempoFlag`/`stabilityFlag` (and `romPct`/`tempoRatio`/`avgJitter`) are computed relative to the average across every rep scoreReps()/scoreStability() are given — inherently provisional until the set ends, no calibration fix changes that. A new `renderLiveResult()` shows rep index, raw tempo (down/up seconds), and depth-vs-benchmark (`depthDeg`/`targetDeg`/`depthMet` — absolute, not relative) with a note that full ROM/tempo/stability flags appear at Stop. The existing `renderResult()` (used only at Stop, unchanged) still shows everything, exactly as today.

5. **Stop-time behavior is unchanged except reading `exerciseName` from the record-start capture, not re-reading the input.** The existing stop-click code clears the interval first, then re-runs the full pipeline one final time (all fields, via unchanged `renderResult()`) and fires the AI critique exactly as today — no new API cost.

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
- **Benchmark match unavailable** (unrecognized exercise name): identical to today's existing fallback — `buildPrimarySignal` falls back to Y-position tracking when no benchmark match exists or angle data is too sparse (`form-coach.html:392-404`, unchanged), so live updates during an unmatched exercise show tempo without a depth line (`renderLiveResult`'s `depthStr` is empty when `depthMet` isn't in the rep), same as a post-hoc unmatched-exercise result omits the depth line today.

## Out of scope (this pass)

- Spoken/audio cues — Carl chose visual-only for this pass (zero marginal cost, no new interruption/volume handling to design).
- Any change to the AI critique call — stays exactly as it is today: one call, at stop, unchanged frequency and cost.
- Posing-mode's equivalent (`critique-pose.ts`) — a separate, purely photo/video-review flow (single image or short clip, not a live rep-by-rep set), not touched by this design. If posing ever wants a live equivalent, that's a distinct scoping question — the two camera modes track meaningfully different things (rep sets vs. a static/held pose).

## Testing

`form-coach.html` has no test harness (matches this session's other Row static-page builds) — the scoring functions themselves (`segmentReps`, `scoreSet`, etc.) are already covered by `form-coach-logic.selfcheck.cjs` and are unchanged by this design. Verification for the new wiring:

- **Manual trace (Node)** — this is what actually caught the bug described in the Revision note, not just a formality: simulate a growing buffer by calling `buildPrimarySignal`/`buildStabilitySamples`/`scoreSet` on `buffer.slice(0, n)` for increasing `n`, with `minAmplitude` frozen (not recomputed per-`n`) and the trailing rep dropped, confirming that the STABLE FIELD SUBSET (`rom`, `durationMs`, `eccentricMs`, `concentricMs`, `depthDeg`, `targetDeg`, `depthMet` — explicitly excluding `romPct`/`romFlag`/`tempoRatio`/`tempoFlag`/`avgJitter`/`stabilityFlag`) never changes for an already-reported rep as more frames are added. Run against multiple seeded-noise datasets, not just one clean synthetic signal — the original bug didn't reproduce with every seed/threshold combination on the first attempt.
- Live browser trace (real camera, since this feature has no meaningful way to verify without one): start a set, confirm nothing renders for the first ~4s (calibration floor), then confirm a rep row (tempo + depth, no quality flags) appears within ~1.5-3s of each completed rep after that, then confirm stopping produces the full final list (now including ROM/tempo/stability flags) plus the AI critique exactly as today.
- Confirm rapid start/stop/start clicking doesn't leave two intervals running simultaneously, and that `liveMinAmplitude` resets to `null` on each new recording (a stale frozen value from a prior set must never carry into the next one).
