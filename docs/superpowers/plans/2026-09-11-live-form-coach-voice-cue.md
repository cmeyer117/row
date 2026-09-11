# Live Form Coach Voice Cue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speak one voice cue ("Velocity dropping on rep N") the first time a set's live velocity-flag fires, gated behind a new off-by-default checkbox, using the existing free-TTS `RowVoice.speak()` primitive.

**Architecture:** No new scoring logic, no new TTS infrastructure. Adds one new recording-scoped state variable (a one-way latch), one new checkbox + its localStorage-backed read, and one guarded `RowVoice.speak()` call inside the existing `renderLiveResult()` function.

**Tech Stack:** Plain browser JS (no framework, no build step). No test framework for this file (matches the parent live-feedback build) — verification is a live browser trace with a real camera.

**Spec reference:** `docs/superpowers/specs/2026-09-11-live-form-coach-voice-cue-design.md` (committed `row@be350e0`). This plan implements it verbatim, including its two Codex-review corrections (the null-check latch, not a `>` comparison; the accepted mid-recording-toggle edge case).

---

## File Structure

- Modify: `form-coach.html` — the existing checkbox-free HTML near the record button (line 113), and the existing IIFE that already contains `recordBtn`'s click handler and `renderLiveResult` (lines ~270-590).
- No other files change; `form-coach-logic.js` and `voice-helpers.js` are unchanged and reused as-is.

One task: the whole change is a handful of small edits inside one file, small enough not to need decomposition.

---

### Task 1: Voice cue on first velocity flag

**Files:**
- Modify: `form-coach.html:113` (new checkbox), `form-coach.html:283-284` (new state variable), `form-coach.html:515-528` (`renderLiveResult`), `form-coach.html:581-582` (reset on record-start)

- [ ] **Step 1: Add the checkbox HTML**

Find this exact existing code (`form-coach.html:113-114`):

```html
  <button class="fc-btn fc-btn-primary" id="recordSetBtn" type="button">Record Set</button>
  <div id="liftResult"></div>
```

Replace with:

```html
  <button class="fc-btn fc-btn-primary" id="recordSetBtn" type="button">Record Set</button>
  <label class="fc-voice-toggle" style="display:flex;align-items:center;gap:6px;margin:8px 0;font-size:13px;color:var(--text-2);">
    <input type="checkbox" id="voiceCoachToggle"> 🔊 Voice cue on velocity drop
  </label>
  <div id="liftResult"></div>
```

- [ ] **Step 2: Add the state variable and the checkbox's localStorage wiring**

Find this exact existing code (`form-coach.html:283-284`):

```javascript
  var liveMinAmplitude = null; // frozen once calibrated, reset per recording -- see liveScoreTick
  var liveCalPrev = null; // previous tick's { range, usedBenchmark } while calibrating, reset per recording
```

Replace with:

```javascript
  var liveMinAmplitude = null; // frozen once calibrated, reset per recording -- see liveScoreTick
  var liveCalPrev = null; // previous tick's { range, usedBenchmark } while calibrating, reset per recording
  var lastSpokenVelocityFlagIndex = null; // one-way latch: null until the first velocity-flag cue speaks this recording, then never re-fires -- reset per recording, see recordBtn handler

  var voiceCoachToggle = document.getElementById('voiceCoachToggle');
  // Private-browsing/storage-restricted contexts can throw on localStorage
  // access -- degrading to "toggle doesn't persist, defaults to off" is an
  // acceptable failure mode here (see design spec's toggle section).
  try {
    voiceCoachToggle.checked = localStorage.getItem('row:voice-coach-enabled') === '1';
  } catch (e) {}
  voiceCoachToggle.addEventListener('change', function () {
    try { localStorage.setItem('row:voice-coach-enabled', voiceCoachToggle.checked ? '1' : '0'); } catch (e) {}
  });
```

- [ ] **Step 3: Reset the latch at record-start**

Find this exact existing code (`form-coach.html:581-582`):

```javascript
      liveMinAmplitude = null; // recalibrate fresh for this recording
      liveCalPrev = null;
```

Replace with:

```javascript
      liveMinAmplitude = null; // recalibrate fresh for this recording
      liveCalPrev = null;
      lastSpokenVelocityFlagIndex = null; // fresh latch for this recording
```

- [ ] **Step 4: Speak the cue in `renderLiveResult`**

Find this exact existing code (`form-coach.html:515-517`):

```javascript
  function renderLiveResult(scored, exerciseName) {
    var fatigueRep = scored.slice().reverse().find(function (r) { return r.velocityFlag; });
    var rows = scored.map(function (r) {
```

Replace with:

```javascript
  function renderLiveResult(scored, exerciseName) {
    var fatigueRep = scored.slice().reverse().find(function (r) { return r.velocityFlag; });
    if (fatigueRep && voiceCoachToggle.checked && lastSpokenVelocityFlagIndex === null) {
      lastSpokenVelocityFlagIndex = fatigueRep.index; // set before speak() -- defensive ordering
      window.RowVoice.speak('Velocity dropping on rep ' + fatigueRep.index);
    }
    var rows = scored.map(function (r) {
```

- [ ] **Step 5: Live browser trace verification**

`form-coach.html` has no test harness — verify live, with a real camera, per the design spec's Testing section:

1. Load the page fresh (clear `localStorage` key `row:voice-coach-enabled` first if it's set from a prior manual test). Confirm the new checkbox is present, unchecked by default.
2. Check the box. Name an exercise, start recording, perform reps slowly enough on the last few to trigger a real velocity drop (>20% slower concentric than the set's first 2 reps' average). Confirm: the existing visual banner ("⚠ Velocity dropped on rep N...") appears as it always has, AND exactly one spoken cue ("Velocity dropping on rep N") plays within one tick (≤1.5s) of the banner first appearing.
3. Keep the set going with velocity staying low (or dropping further). Confirm no second spoken cue fires, even as later reps also show the visual flag.
4. Stop the set, start a new one with the toggle still checked. Trigger a fresh velocity drop. Confirm a cue speaks again (the latch reset for the new recording, no carryover from the previous set).
5. Start a new set with the toggle unchecked, trigger a real velocity drop. Confirm the visual banner appears but no cue speaks.
6. Reproduce the accepted mid-recording-toggle edge case on purpose: start a set with the toggle OFF, trigger a velocity drop (visual banner appears, no cue), then check the toggle ON mid-recording. Confirm exactly one cue speaks on the next tick (the accepted "late" cue, per the spec's documented edge case) and no further cues speak for the rest of that recording.
7. Refresh the page. Confirm the toggle's checked state persisted (read back from `localStorage`).

Report: which of the 7 checks passed, any deviation from expected behavior, and (if anything didn't match) whether it's a real bug to fix before calling this done or a documented, accepted limitation from the spec.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/gregm/row
git add form-coach.html
git commit -m "feat(gym): voice cue on live velocity-drop detection in form coach"
```
