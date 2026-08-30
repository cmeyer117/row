# Live In-Session Form Coach Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `form-coach.html`'s existing rep-scoring pipeline run live during recording (every 1.5s), instead of only once when "Stop Recording" is clicked, so a rep card appears within ~1.5s of each completed rep instead of the whole set going unreviewed until it ends.

**Architecture:** No new scoring logic, no new detection code. Adds a `setInterval` inside the existing `recordBtn` click handler's "start recording" branch that re-runs the exact same `buildPrimarySignal → buildStabilitySamples → scoreSet → renderResult` pipeline the "stop recording" branch already runs once — on the buffer as it grows. `segmentReps()` (inside `scoreSet`) only ever returns a rep once its full start→mid→end extrema exist, so calling it on a growing buffer is already correct with zero logic changes.

**Tech Stack:** Plain browser JS (no framework, no build step). No test framework for this file — verification is a standalone Node script using `vm` (same technique this session's other Row builds used) plus a live browser trace with a real camera.

**Post-execution note:** Task 1's verification step (exactly as planned below) caught a real bug in the code shown here — `minAmplitude` recomputed fresh every tick let the jitter-filter threshold drift and retroactively reinterpret earlier rep boundaries, and `romFlag`/`tempoFlag`/`stabilityFlag` turned out to be relative-to-set-average values that are inherently provisional mid-set. What actually shipped (`row@e04322f`) differs from the code blocks below: `minAmplitude` freezes once per recording after a ~4s calibration floor, the most recent rep is always held back, and live rendering shows only the absolute fields (tempo, depth) via a new `renderLiveResult()`, never the set-relative quality flags. See the spec's own Revision note (`docs/superpowers/specs/2026-08-30-live-form-coach-feedback-design.md`) for the full root-cause writeup. This plan's steps are left as originally written below — a record of what was planned, not what ultimately shipped.

---

## Spec reference

`docs/superpowers/specs/2026-08-30-live-form-coach-feedback-design.md` (committed `row@894b422`). This plan implements it verbatim.

## File Structure

- Modify: `form-coach.html` — the single existing IIFE that already contains `recordBtn`'s click handler (lines 271-533). No other files change; `form-coach-logic.js`'s pure functions are unchanged and reused as-is.

One task: the whole change is inside one click handler and its enclosing scope, small enough not to need decomposition into multiple files/tasks.

---

### Task 1: Live-score during recording

**Files:**
- Modify: `form-coach.html:281-282` (new variable declarations), `form-coach.html:492-533` (the `recordBtn` click handler)

- [ ] **Step 1: Add the two new state variables**

Find this exact existing code (`form-coach.html:281-282`):

```javascript
  var recording = false;
  var buffer = []; // [{ t, landmarks }]
```

Replace with:

```javascript
  var recording = false;
  var buffer = []; // [{ t, landmarks }]
  var recordingExerciseName = ''; // read at record-start, used by both the live-scoring interval and the stop branch
  var liveScoreInterval = null;
```

- [ ] **Step 2: Add the live-scoring interval to the "start recording" branch**

Find this exact existing code (`form-coach.html:492-499`):

```javascript
  recordBtn.addEventListener('click', function () {
    if (!cameraStarted) return;
    if (!recording) {
      recording = true;
      buffer = [];
      resultEl.innerHTML = '';
      recordBtn.textContent = 'Stop Recording';
      recordBtn.className = 'fc-btn fc-btn-secondary';
    } else {
```

Replace with:

```javascript
  function liveScoreTick() {
    if (buffer.length < 10) return; // same floor as the stop-branch's own "too short" guard
    var matchedBenchmark = window.FormCoachLogic.matchBenchmark(recordingExerciseName, window.EXERCISE_BENCHMARKS);
    var primary = buildPrimarySignal(buffer, matchedBenchmark);
    var stabilitySamples = buildStabilitySamples(buffer);
    var minAmplitude = primary.range * 0.15;
    var scored = window.FormCoachLogic.scoreSet(primary.samples, stabilitySamples, minAmplitude, primary.usedBenchmark ? matchedBenchmark : null);
    // Skip rendering on zero reps -- renderResult([]) shows "No clear reps
    // detected... through the whole set," worded for the END of a set. That
    // message would be misleading shown 1.5s into the first rep, before
    // anything has actually gone wrong. Leave resultEl as its cleared state
    // (from record-start below) until a real rep completes.
    if (scored.length) renderResult(scored, recordingExerciseName);
  }

  recordBtn.addEventListener('click', function () {
    if (!cameraStarted) return;
    if (!recording) {
      recording = true;
      buffer = [];
      resultEl.innerHTML = '';
      recordBtn.textContent = 'Stop Recording';
      recordBtn.className = 'fc-btn fc-btn-secondary';
      recordingExerciseName = document.getElementById('liftExerciseName').value.trim();
      liveScoreInterval = setInterval(liveScoreTick, 1500);
    } else {
```

- [ ] **Step 3: Clear the interval at the start of the "stop recording" branch**

Find this exact existing code (`form-coach.html:500-508`, now shifted a few lines later by Step 2's insertion but with identical content):

```javascript
    } else {
      recording = false;
      recordBtn.textContent = 'Record Set';
      recordBtn.className = 'fc-btn fc-btn-primary';
      if (buffer.length < 10) {
        resultEl.innerHTML = '<div class="mob-card"><div class="mob-card-body">Recording too short — try a longer set.</div></div>';
        return;
      }
      var exerciseName = document.getElementById('liftExerciseName').value.trim();
```

Replace with:

```javascript
    } else {
      clearInterval(liveScoreInterval);
      liveScoreInterval = null;
      recording = false;
      recordBtn.textContent = 'Record Set';
      recordBtn.className = 'fc-btn fc-btn-primary';
      if (buffer.length < 10) {
        resultEl.innerHTML = '<div class="mob-card"><div class="mob-card-body">Recording too short — try a longer set.</div></div>';
        return;
      }
      var exerciseName = recordingExerciseName;
```

Note the last line: `exerciseName` is now assigned from `recordingExerciseName` (captured at record-start) instead of re-reading `#liftExerciseName` at stop-time — the input's value shouldn't be re-read here since the user could have edited the text field mid-set, and the live ticks throughout the recording already used `recordingExerciseName` for their benchmark matching, so the final stop-time pass must match the same value for depth-scoring to stay consistent across the whole set's rep list.

The rest of the stop branch (`buildPrimarySignal` through the AI critique fetch, currently lines 509-531) is **unchanged** — it already re-runs the full pipeline one final time and fires the critique exactly as before.

- [ ] **Step 4: Verify the file still parses**

Run:
```bash
node -e "new Function(require('fs').readFileSync('form-coach.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s => s.replace(/<\/?script>/g, '')).join('\n'))"
```
Expected: no output, exit code 0. This file uses `import`/module syntax in its first `<script type="module">` block for MediaPipe — if the regex above pulls that block in and errors on `import`, restrict the match to non-module `<script>` tags only, or run the check against `form-coach.html` with the module-type script's content excluded. Confirm no `SyntaxError` from the actual edited block before continuing.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row
git add form-coach.html
git commit -m "feat: score and render reps live during recording, not just at stop"
```

- [ ] **Step 6: Node trace — growing-buffer correctness property**

The spec's core assumption is that re-running `scoreSet()` on a growing buffer only ever appends new reps, never mutates or drops earlier ones. Verify this directly against the real `form-coach-logic.js`, since this file has no test harness of its own.

Create a temporary script (delete after running — this is a verification step, not a permanent test file) at your scratchpad path, e.g. `trace-live-form-coach.cjs`:

```javascript
'use strict';
const fs = require('fs');
const vm = require('vm');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('C:\\Users\\gregm\\row\\form-coach-logic.js', 'utf8'), sandbox);
const FormCoachLogic = sandbox.window.FormCoachLogic;

// Synthetic landmarks: a wrist Y-position oscillating in a sine wave to
// simulate 3 press reps over ~30 frames at 100ms sampling (~3s).
function makeFrame(t, wristY) {
  var lm = new Array(33).fill({ x: 0.5, y: 0.5 });
  lm[15] = { x: 0.5, y: wristY }; // L_WRIST
  lm[16] = { x: 0.5, y: wristY }; // R_WRIST
  lm[23] = { x: 0.5, y: 0.6 };    // L_HIP
  lm[24] = { x: 0.5, y: 0.6 };    // R_HIP
  return { t: t, landmarks: lm };
}

var frames = [];
for (var i = 0; i < 60; i++) {
  var wristY = 0.5 + 0.2 * Math.sin(i / 3); // 3 full oscillations over 60 frames
  frames.push(makeFrame(i * 100, wristY));
}

function buildPrimarySignal(fr) {
  var values = fr.map(function (f) { return (f.landmarks[15].y + f.landmarks[16].y) / 2; });
  var range = Math.max.apply(null, values) - Math.min.apply(null, values);
  var samples = fr.map(function (f, idx) { return { t: f.t, value: values[idx] }; });
  return { samples: samples, range: range, usedBenchmark: false };
}
function buildStabilitySamples(fr) {
  var out = [];
  for (var i = 1; i < fr.length; i++) {
    var dx = 0, dy = 0; // hips stationary in this synthetic data
    out.push({ t: fr[i].t, jitter: Math.sqrt(dx * dx + dy * dy) });
  }
  return out;
}

var prevScored = [];
for (var n = 10; n <= frames.length; n += 5) {
  var slice = frames.slice(0, n);
  var primary = buildPrimarySignal(slice);
  var stability = buildStabilitySamples(slice);
  var minAmplitude = primary.range * 0.15;
  var scored = FormCoachLogic.scoreSet(primary.samples, stability, minAmplitude, null);
  // Every previously-seen rep must still be present, unchanged, at the same index.
  for (var i = 0; i < prevScored.length; i++) {
    if (JSON.stringify(scored[i]) !== JSON.stringify(prevScored[i])) {
      console.error('FAIL: rep ' + i + ' changed between n=' + (n - 5) + ' and n=' + n);
      process.exit(1);
    }
  }
  if (scored.length < prevScored.length) {
    console.error('FAIL: scored array shrank at n=' + n);
    process.exit(1);
  }
  prevScored = scored;
}
console.log('PASS: scored array only grows and never mutates past entries as the buffer grows (' + prevScored.length + ' reps found in the full 60-frame buffer)');
```

Run: `node trace-live-form-coach.cjs`
Expected: `PASS: scored array only grows and never mutates past entries...` with a nonzero rep count. If it prints a `FAIL` line, stop and re-examine `segmentReps`'s extrema logic before proceeding — the live-interval design depends on this property holding.

Delete the temporary script once it passes (`rm trace-live-form-coach.cjs` or the Windows equivalent) — it was for verification only, not a permanent test file for a codebase that doesn't otherwise have one for this area.

- [ ] **Step 7: Live browser trace**

This feature has no meaningful way to verify without a real camera and a real set. On a device with a webcam, open `form-coach.html` (or navigate to it through `coach.html`'s Lift Form tab), type a recognized exercise name, and:

1. Click "Record Set," perform a rep slowly enough to see the UI between reps.
2. Confirm `resultEl` stays in its cleared (empty) state for the first ~1-2 seconds — NOT showing "No clear reps detected..." before the first rep is even done.
3. Confirm a new rep row appears within roughly 1.5-3 seconds of completing each rep (one interval tick's worth of latency, plus however long the rep itself took).
4. Click "Stop Recording" after 3-4 reps — confirm the final list matches what was building up live (same rep count, same flags), and the AI critique card still appears and resolves exactly as it did before this change.
5. Click "Record Set" then immediately "Stop Recording" (before 1.5s passes) — confirm no live tick fired and the existing "Recording too short" message still shows correctly.
6. Rapidly click Record/Stop/Record/Stop a few times in a row — confirm only one set of rep cards ever renders at a time (no doubled-up or interleaved output from a leaked interval that Step 3's `clearInterval` should have stopped).

If any of 2-6 fails, the bug is almost certainly in `liveScoreTick`'s guard logic or the `clearInterval` ordering in Step 3 — re-check those before looking elsewhere.

---

## Completion

After Task 1: run the Node trace (Step 6) one more time to confirm it's still clean, then hand off to `superpowers:finishing-a-development-branch` — working directly on `main`, no branch to merge, so this mainly checks whether a pre-push code-review ask is warranted before pushing to `origin/main` (this project's own standing convention).
