# Coach Tab Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Row's Coach section into two fully independent pages/tabs — Posing Coach (camera + pose list + practice log + readiness check-in) and Form Coach (camera + stubbed form-info area) — replacing today's scroll-stacked `coach.html` and the internal tab switcher currently bundled inside `form-coach.html`.

**Architecture:** Move the live posing camera (currently a mode inside `form-coach.html`'s `FormCoachCamera` module) into `posing.html`, above its existing pose-list/log content. Simplify `form-coach.html` down to just its lift camera (drop the mode-keying now that each page has exactly one camera). Rebuild `coach.html` as a real JS tab switcher over two iframes, with a `postMessage` protocol so the parent can lazy-load the inactive tab's iframe and tell each child page when to start/stop its camera — replacing the same-page `CustomEvent` handshake (`form-coach-camera-ready` / `form-coach-tab-active`) that today's internal switcher uses, with a cross-frame equivalent.

**Tech Stack:** Plain HTML/CSS/vanilla JS (no build step), MediaPipe Tasks Vision (`PoseLandmarker`, loaded from CDN), Supabase (existing sync, untouched).

---

## Design note: why the camera module loses its mode-keying

Today's `FormCoachCamera` in `form-coach.html` keys all state by mode (`'posing'` / `'lift'`) because one page hosts both cameras. After this split, each page hosts exactly one camera — carrying the mode dimension forward would be unused generality (YAGNI). Each page gets its own single-camera module (same careful stop-before-start sequencing, same cached-model-promise behavior that `03a79c2` and today's `730d13d` fix already proved out — just without the mode key).

## Design note: postMessage protocol between coach.html and its iframes

- **Parent → child:** `{ type: 'coach-tab-active' }` (start camera) / `{ type: 'coach-tab-inactive' }` (stop camera). Sent to the iframe's `contentWindow` via `postMessage(msg, window.location.origin)`.
- **Child → parent:** `{ type: 'coach-child-ready' }`, posted once on page load (after the DOM and camera module are wired up, mirroring today's `form-coach-camera-ready` timing). The parent only sends the first `coach-tab-active` after hearing this — otherwise a message posted before the child's listener is registered is silently dropped.
- **Lazy iframe loading:** `coach.html` does NOT set both iframes' `src` on page load. Only the default tab (Posing Coach) gets its `src` set immediately; the other iframe has no `src` until its tab is clicked for the first time. This mirrors the same "don't pay the MediaPipe model-load cost for a tab nobody opened" reasoning behind `03a79c2`.
- **Origin check:** every receiving `message` listener (in `coach.html` and both child pages) must verify `event.origin === window.location.origin` before acting — same-origin iframes, but a listener that skips this check would happily act on a message from any embedding page.

---

### Task 1: Add the posing camera to posing.html

**Files:**
- Modify: `C:\Users\gregm\row\posing.html`

- [ ] **Step 1: Add the camera CSS block**

Insert this block into `posing.html`'s `<style>` section, right after the existing `.mob-divider` rule (currently ending around line 171, immediately before the `/* ── Posing practice log ── */` comment):

```css
/* ── Camera + capture (moved from form-coach.html, 2026-08-25) ── */
.fc-camera-wrap { position: relative; width: 100%; aspect-ratio: 3 / 4; background: #050506; border-radius: 16px; overflow: hidden; margin-bottom: 12px; }
.fc-camera-wrap video, .fc-camera-wrap canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.fc-camera-wrap canvas { pointer-events: none; }
.fc-hold-ring { position: absolute; top: 12px; right: 12px; width: 44px; height: 44px; }
.fc-hold-ring circle { fill: none; stroke-width: 4; }
.fc-hold-ring .bg { stroke: rgba(255,255,255,0.15); }
.fc-hold-ring .fg { stroke: var(--accent); stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 0.1s linear; }
.fc-status-banner { position: absolute; left: 12px; right: 12px; bottom: 12px; padding: 8px 12px; border-radius: 10px; background: rgba(0,0,0,0.65); font-size: 12px; color: var(--text-2); text-align: center; }
.fc-status-banner.warn { color: var(--warn); }
.fc-status-banner.bad { color: var(--bad); }
.fc-compare { display: flex; gap: 8px; margin-bottom: 12px; }
.fc-compare > div { flex: 1; }
.fc-compare img, .fc-compare canvas { width: 100%; border-radius: 10px; display: block; }
.fc-compare .fc-compare-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); margin-bottom: 4px; }
.fc-pose-picker { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 12px; scrollbar-width: none; }
.fc-pose-picker::-webkit-scrollbar { display: none; }
.fc-pose-chip { flex-shrink: 0; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--text-2); background: rgba(255,255,255,0.04); border: 1px solid var(--border); cursor: pointer; -webkit-tap-highlight-color: transparent; font-family: inherit; }
.fc-pose-chip.active { color: var(--text-1); background: rgba(110,231,183,0.10); border-color: rgba(110,231,183,0.30); }
.fc-btn { width: 100%; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: inherit; border: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.fc-btn-primary { background: var(--accent); color: #04150e; }
.fc-btn-secondary { background: rgba(255,255,255,0.06); color: var(--text-1); border: 1px solid var(--border); }
```

- [ ] **Step 2: Add the `<script>` includes**

In `posing.html`'s `<head>`, immediately after the existing `<script src="posing-checklists.js" defer></script>` line (line 21), add:

```html
<script src="form-coach-logic.js" defer></script>
```

(`form-coach-logic.js` provides `POSE_CONFIGS`, `createHoldTracker`, `trackedAngles`, `updateHoldTracker`, `computeSymmetry` — all needed by the camera capture flow below. `benchmarks.js` is NOT needed here — that's lift-exercise-only data.)

- [ ] **Step 3: Add the camera markup**

In `posing.html`'s `<body>`, insert this immediately after the closing `</div>` of `.mob-header` (right before the existing pose-log-card / pose list content that currently starts the page body):

```html
  <div class="mob-rule"><strong>How it works:</strong> pick a pose, hold it steady for ~1.5s and the camera auto-captures a still to compare against the reference photo.</div>

  <div class="fc-pose-picker" id="posePicker"></div>

  <div class="fc-camera-wrap" id="posingCameraWrap">
    <video id="posingVideo" autoplay playsinline muted></video>
    <svg class="fc-hold-ring" id="holdRing" viewBox="0 0 44 44">
      <circle class="bg" cx="22" cy="22" r="18"></circle>
      <circle class="fg" cx="22" cy="22" r="18" stroke-dasharray="113" stroke-dashoffset="113"></circle>
    </svg>
    <div class="fc-status-banner" id="posingStatus">Requesting camera…</div>
  </div>

  <div id="posingResult"></div>
```

- [ ] **Step 4: Add the camera module + posing capture script**

Add this before `posing.html`'s closing `</body>` tag, after all existing `<script>` blocks (i.e. after the practice-log/readiness-log script that currently ends the file, before `</body></html>`):

```html
<script type="module">
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

// Single-camera module (2026-08-25 Coach tab split) -- unlike form-coach.html's
// old FormCoachCamera, no mode key is needed: this page owns exactly one
// camera. Model load is cached forever once started; the camera STREAM is
// acquired fresh each time the parent (coach.html) tells us we're the active
// tab, and explicitly torn down when told we're not -- same stop-before-start
// discipline as form-coach.html's Codex-reviewed fix (730d13d), just
// triggered by postMessage from the parent frame instead of a same-page tab
// click.
var PosingCamera = { landmarker: null, landmarkerPromise: null, stream: null, ready: false, error: null, cancelLoop: null };

function loadLandmarker(statusEl) {
  if (!PosingCamera.landmarkerPromise) {
    PosingCamera.landmarkerPromise = (async function () {
      try {
        var vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        PosingCamera.landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        return true;
      } catch (err) {
        PosingCamera.error = 'model-load-failed';
        if (statusEl) { statusEl.textContent = 'Pose detection failed to load — check your connection and reload.'; statusEl.classList.add('bad'); }
        return false;
      }
    })();
  }
  return PosingCamera.landmarkerPromise;
}

async function initCamera(videoEl, statusEl) {
  var modelOk = await loadLandmarker(statusEl);
  if (!modelOk) return false;
  try {
    PosingCamera.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch (err) {
    PosingCamera.error = 'camera-denied';
    if (statusEl) { statusEl.textContent = 'Camera access denied. Allow camera access in your browser settings, then reload.'; statusEl.classList.add('bad'); }
    return false;
  }
  PosingCamera.ready = true;
  videoEl.srcObject = PosingCamera.stream;
  await new Promise(function (resolve) { videoEl.onloadedmetadata = resolve; });
  if (statusEl) { statusEl.textContent = ''; statusEl.classList.remove('bad', 'warn'); }
  return true;
}

function stopCamera(videoEl) {
  if (PosingCamera.stream) {
    PosingCamera.stream.getTracks().forEach(function (t) { t.stop(); });
    PosingCamera.stream = null;
  }
  if (videoEl) videoEl.srcObject = null;
  PosingCamera.ready = false;
  if (PosingCamera.cancelLoop) { PosingCamera.cancelLoop(); PosingCamera.cancelLoop = null; }
}

function startDetectionLoop(videoEl, onResult, intervalMs, isActiveFn) {
  var lastRun = 0;
  var cancelled = false;
  function tick(nowMs) {
    if (cancelled) return;
    if (isActiveFn() && PosingCamera.ready && PosingCamera.landmarker && nowMs - lastRun >= intervalMs) {
      lastRun = nowMs;
      var result = PosingCamera.landmarker.detectForVideo(videoEl, performance.now());
      var landmarks = (result.landmarks && result.landmarks.length) ? result.landmarks[0] : null;
      onResult(landmarks, nowMs);
    }
    requestAnimationFrame(tick);
  }
  PosingCamera.cancelLoop = function () { cancelled = true; };
  requestAnimationFrame(tick);
}

window.PosingCamera = PosingCamera;
window.PosingCamera.initCamera = initCamera;
window.PosingCamera.stopCamera = stopCamera;
window.PosingCamera.startDetectionLoop = startDetectionLoop;
window.dispatchEvent(new Event('posing-camera-module-ready'));
</script>
<script>
(function () {
  var POSE_SLUGS = Object.keys(window.FormCoachLogic.POSE_CONFIGS);
  var activeSlug = POSE_SLUGS[0];
  var holdTracker = window.FormCoachLogic.createHoldTracker();
  var HOLD_TOLERANCE_DEG = 6;
  var HOLD_DURATION_MS = 1500;
  var frozen = false;
  var isTabActive = false; // set true/false by the coach-tab-active/inactive postMessage handler below

  async function fetchPoseCritique(imageBase64) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 25000);
    try {
      var token = await window.RowAuth.getAccessToken();
      var res = await fetch('/api/vision-pose-critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ imageBase64: imageBase64, mediaType: 'image/jpeg' }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      var data = await res.json();
      return (data && typeof data.critique === 'string') ? data : null;
    } catch (err) {
      console.warn('[posing] pose critique fetch failed:', err && err.message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  var picker = document.getElementById('posePicker');
  POSE_SLUGS.forEach(function (slug) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'fc-pose-chip' + (slug === activeSlug ? ' active' : '');
    chip.textContent = window.FormCoachLogic.POSE_CONFIGS[slug].label;
    chip.dataset.slug = slug;
    chip.addEventListener('click', function () {
      activeSlug = slug;
      holdTracker = window.FormCoachLogic.createHoldTracker();
      frozen = false;
      document.querySelectorAll('.fc-pose-chip').forEach(function (c) { c.classList.toggle('active', c.dataset.slug === activeSlug); });
      document.getElementById('posingResult').innerHTML = '';
    });
    picker.appendChild(chip);
  });

  var video = document.getElementById('posingVideo');
  var statusEl = document.getElementById('posingStatus');
  var ring = document.querySelector('#holdRing .fg');
  var RING_CIRCUMFERENCE = 113;

  function renderSymmetry(symmetry) {
    if (!symmetry.length) return '<div class="mob-card-body">No side-to-side comparison for this pose — hold time confirmed above.</div>';
    return symmetry.map(function (s) {
      if (s.diffDeg === null) return '<div class="fc-symmetry-row"><span>' + s.joint + '</span><span>Not fully visible</span></div>';
      var side = s.diffDeg > 0 ? 'left higher' : (s.diffDeg < 0 ? 'right higher' : 'even');
      return '<div class="fc-symmetry-row"><span>' + s.joint + '</span><span>' + Math.abs(s.diffDeg) + '&deg; ' + side + '</span></div>';
    }).join('');
  }

  var lastLandmarks = null;

  function captureFreeze(holdMs) {
    frozen = true;
    var capturedSlug = activeSlug;
    var canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    var symmetry = window.FormCoachLogic.computeSymmetry(lastLandmarks, capturedSlug);
    document.getElementById('posingResult').innerHTML =
      '<div class="fc-compare">' +
        '<div><div class="fc-compare-label">You</div></div>' +
        '<div><div class="fc-compare-label">Reference</div><img src="assets/mobility/' + capturedSlug + '.png" alt=""></div>' +
      '</div>' +
      '<div class="mob-card"><div class="mob-card-body"><strong>Held ' + (holdMs / 1000).toFixed(1) + 's</strong></div></div>' +
      '<div class="mob-card">' + renderSymmetry(symmetry) + '</div>' +
      '<div class="mob-card" id="poseCritiqueCard"><div class="mob-card-body">Getting AI critique&hellip;</div></div>' +
      '<button class="fc-btn fc-btn-secondary" id="tryAgainBtn" type="button">Try Again</button>';
    document.querySelector('.fc-compare > div:first-child').appendChild(canvas);
    document.getElementById('tryAgainBtn').addEventListener('click', function () {
      frozen = false;
      holdTracker = window.FormCoachLogic.createHoldTracker();
      document.getElementById('posingResult').innerHTML = '';
    });
    var imageBase64 = canvas.toDataURL('image/jpeg', 0.85).replace(/^data:image\/jpeg;base64,/, '');
    fetchPoseCritique(imageBase64).then(function (result) {
      var card = document.getElementById('poseCritiqueCard');
      if (result) {
        if (card) card.querySelector('.mob-card-body').textContent = result.pose ? (result.pose + ': ' + result.critique) : result.critique;
        if (window.FormCoachHistory) window.FormCoachHistory.logSession('posing', { pose: capturedSlug, holdTimeMs: holdMs, symmetry: symmetry, poseCritique: result });
      } else {
        if (card) card.remove();
        if (window.FormCoachHistory) window.FormCoachHistory.logSession('posing', { pose: capturedSlug, holdTimeMs: holdMs, symmetry: symmetry });
      }
    });
  }

  function startPosingCamera() {
    window.PosingCamera.initCamera(video, statusEl).then(function (ok) {
      if (!ok) return;
      window.PosingCamera.startDetectionLoop(video, function (landmarks, nowMs) {
        if (frozen) return;
        lastLandmarks = landmarks;
        if (!landmarks) {
          statusEl.textContent = 'Step back so your full body is visible';
          statusEl.classList.add('warn');
          holdTracker = window.FormCoachLogic.createHoldTracker();
          ring.style.strokeDashoffset = RING_CIRCUMFERENCE;
          return;
        }
        statusEl.textContent = '';
        statusEl.classList.remove('warn');
        var tracked = window.FormCoachLogic.trackedAngles(landmarks, activeSlug);
        var step = window.FormCoachLogic.updateHoldTracker(holdTracker, tracked.values, nowMs, HOLD_TOLERANCE_DEG, HOLD_DURATION_MS);
        holdTracker = step.tracker;
        var progress = Math.min(1, step.elapsedMs / HOLD_DURATION_MS);
        ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
        if (step.ready) captureFreeze(step.elapsedMs);
      }, 120, function () { return isTabActive; });
    });
  }

  // Cross-frame handshake with coach.html, replacing form-coach.html's
  // same-page CustomEvent pair. Origin-checked (Codex review pattern from
  // the earlier same-page split, re-applied here since this is now a real
  // cross-frame boundary where an unchecked listener would act on a message
  // from any embedding page, not just our own coach.html).
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'coach-tab-active') {
      isTabActive = true;
      startPosingCamera();
    } else if (event.data.type === 'coach-tab-inactive') {
      isTabActive = false;
      window.PosingCamera.stopCamera(video);
    }
  });

  window.addEventListener('posing-camera-module-ready', function () {
    if (window.parent !== window) window.parent.postMessage({ type: 'coach-child-ready' }, window.location.origin);
  });
})();
</script>
```

- [ ] **Step 5: Update the bottom nav link**

Edit the `posing.html` gym-tabbar block (around line 626-629):

```html
    <a class="gym-tab" href="form-coach.html">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="8" cy="6.5" r="1.6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M2 13h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      Form Coach
    </a>
```

becomes:

```html
    <a class="gym-tab" href="coach.html">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="8" cy="6.5" r="1.6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M2 13h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      Coach
    </a>
```

- [ ] **Step 6: Run the existing self-check**

```bash
node "C:\Users\gregm\row\posing-checklists.selfcheck.cjs"
```
Expected: passes (unchanged logic, only the page around it changed).

- [ ] **Step 7: Commit**

```bash
git -C "C:\Users\gregm\row" add posing.html
git -C "C:\Users\gregm\row" commit -m "feat: add live posing camera to posing.html (Coach tab split)"
```

---

### Task 2: Strip the Form Coach page down to lift-only, add the form-info stub

**Files:**
- Modify: `C:\Users\gregm\row\form-coach.html`

- [ ] **Step 1: Remove the posing-only CSS**

Delete these rules from `form-coach.html`'s `<style>` block (they move to `posing.html` in Task 1 and are not needed here): `.fc-hold-ring`, `.fc-hold-ring circle`, `.fc-hold-ring .bg`, `.fc-hold-ring .fg`, `.fc-compare` and its children, `.fc-pose-picker` and its children, `.mob-tabs`/`.mob-tab-btn`/`.mob-section` (no longer needed — this page no longer has internal tabs). Keep `.fc-camera-wrap`, `.fc-status-banner`, `.fc-btn`, `.fc-input`, `.fc-rep-row`, `.fc-rep-flag` — all still used by the lift section.

Add this new rule for the stub form-info area:

```css
.fc-info-stub { padding: 16px 18px; border: 1px dashed var(--border-strong); border-radius: 16px; color: var(--text-3); font-size: 13px; text-align: center; }
```

- [ ] **Step 2: Replace the body markup**

Replace everything from `<div class="mob-tabs">` through the closing `</div>` of `#section-lift` (currently lines 123-157) with:

```html
  <div class="mob-rule"><strong>How it works:</strong> name the exercise, record a set, get a rep-by-rep readout of ROM/tempo/stability scored against your own average for that set.</div>

  <input class="fc-input" id="liftExerciseName" type="text" placeholder="Exercise name (e.g. Hack Squat)">

  <div class="fc-camera-wrap" id="liftCameraWrap">
    <video id="liftVideo" autoplay playsinline muted></video>
    <div class="fc-status-banner" id="liftStatus">Requesting camera…</div>
  </div>

  <button class="fc-btn fc-btn-primary" id="recordSetBtn" type="button">Record Set</button>
  <div id="liftResult"></div>

  <div class="mob-divider"></div>
  <div class="fc-info-stub">Form cues and technique breakdowns are coming here — planned separately.</div>
```

- [ ] **Step 3: Replace the camera module + tab-switcher scripts with a single-camera version**

Replace the entire `<script type="module">...FormCoachCamera...</script>` block and the `<script>...tab-switcher...</script>` block that follows it (currently lines 223-386) with:

```html
<script type="module">
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

// Single-camera module (2026-08-25 Coach tab split) -- this page now owns
// only the lift camera (posing moved to posing.html), so the old mode-keyed
// FormCoachCamera is replaced with an unkeyed equivalent. Same
// stop-before-start discipline as before (730d13d), now triggered by
// postMessage from the parent coach.html frame instead of a same-page tab
// click.
var LiftCamera = { landmarker: null, landmarkerPromise: null, stream: null, ready: false, error: null, cancelLoop: null };

function loadLandmarker(statusEl) {
  if (!LiftCamera.landmarkerPromise) {
    LiftCamera.landmarkerPromise = (async function () {
      try {
        var vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        LiftCamera.landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        return true;
      } catch (err) {
        LiftCamera.error = 'model-load-failed';
        if (statusEl) { statusEl.textContent = 'Pose detection failed to load — check your connection and reload.'; statusEl.classList.add('bad'); }
        return false;
      }
    })();
  }
  return LiftCamera.landmarkerPromise;
}

async function initCamera(videoEl, statusEl) {
  var modelOk = await loadLandmarker(statusEl);
  if (!modelOk) return false;
  try {
    LiftCamera.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch (err) {
    LiftCamera.error = 'camera-denied';
    if (statusEl) { statusEl.textContent = 'Camera access denied. Allow camera access in your browser settings, then reload.'; statusEl.classList.add('bad'); }
    return false;
  }
  LiftCamera.ready = true;
  videoEl.srcObject = LiftCamera.stream;
  await new Promise(function (resolve) { videoEl.onloadedmetadata = resolve; });
  if (statusEl) { statusEl.textContent = ''; statusEl.classList.remove('bad', 'warn'); }
  return true;
}

function stopCamera(videoEl) {
  if (LiftCamera.stream) {
    LiftCamera.stream.getTracks().forEach(function (t) { t.stop(); });
    LiftCamera.stream = null;
  }
  if (videoEl) videoEl.srcObject = null;
  LiftCamera.ready = false;
  if (LiftCamera.cancelLoop) { LiftCamera.cancelLoop(); LiftCamera.cancelLoop = null; }
}

function startDetectionLoop(videoEl, onResult, intervalMs, isActiveFn) {
  var lastRun = 0;
  var cancelled = false;
  function tick(nowMs) {
    if (cancelled) return;
    if (isActiveFn() && LiftCamera.ready && LiftCamera.landmarker && nowMs - lastRun >= intervalMs) {
      lastRun = nowMs;
      var result = LiftCamera.landmarker.detectForVideo(videoEl, performance.now());
      var landmarks = (result.landmarks && result.landmarks.length) ? result.landmarks[0] : null;
      onResult(landmarks, nowMs);
    }
    requestAnimationFrame(tick);
  }
  LiftCamera.cancelLoop = function () { cancelled = true; };
  requestAnimationFrame(tick);
}

window.LiftCamera = LiftCamera;
window.LiftCamera.initCamera = initCamera;
window.LiftCamera.stopCamera = stopCamera;
window.LiftCamera.startDetectionLoop = startDetectionLoop;
window.dispatchEvent(new Event('lift-camera-module-ready'));
</script>
```

- [ ] **Step 4: Update the lift-section script to use the new module + postMessage handshake**

In the remaining lift-section `<script>` block (the one starting `(function () { function escape(s) {...` — currently the last script before `</body>`), make these changes:

Replace:
```javascript
  var cameraStarted = false;
```
with:
```javascript
  var cameraStarted = false;
  var isTabActive = false; // set true/false by the coach-tab-active/inactive postMessage handler below
```

Replace the entire block from `// Own camera, own model, own data -- no longer shared with Posing Coach` through the two `window.addEventListener('form-coach-tab-active', ...)` calls (currently lines 655-679) with:

```javascript
  function startLiftCamera() {
    window.LiftCamera.initCamera(video, statusEl).then(function (ok) {
      cameraStarted = ok;
      if (!ok) return;
      window.LiftCamera.startDetectionLoop(video, function (landmarks, nowMs) {
        lastLandmarks = landmarks;
        if (recording && landmarks) buffer.push({ t: nowMs, landmarks: landmarks });
      }, 100, function () { return isTabActive; });
    });
  }

  // Cross-frame handshake with coach.html -- see posing.html's identical
  // pattern for the full rationale (origin check, child-ready timing).
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'coach-tab-active') {
      isTabActive = true;
      startLiftCamera();
    } else if (event.data.type === 'coach-tab-inactive') {
      isTabActive = false;
      window.LiftCamera.stopCamera(video);
    }
  });

  window.addEventListener('lift-camera-module-ready', function () {
    if (window.parent !== window) window.parent.postMessage({ type: 'coach-child-ready' }, window.location.origin);
  });
```

- [ ] **Step 5: Update the bottom nav link**

Same edit as Task 1 Step 5, applied to `form-coach.html`'s gym-tabbar block (currently lines 166-169) — change `href="form-coach.html"` to `href="coach.html"`, `active` class removed (this page is no longer a direct nav destination), and label text `Form Coach` → `Coach`:

```html
    <a class="gym-tab" href="coach.html">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="8" cy="6.5" r="1.6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M2 13h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      Coach
    </a>
```

- [ ] **Step 6: Run the existing self-check**

```bash
node "C:\Users\gregm\row\form-coach-logic.selfcheck.cjs"
```
Expected: passes (`form-coach-logic.js` itself is untouched — only which page loads it changed).

- [ ] **Step 7: Commit**

```bash
git -C "C:\Users\gregm\row" add form-coach.html
git -C "C:\Users\gregm\row" commit -m "feat: strip form-coach.html to lift-only, add form-info stub"
```

---

### Task 3: Rebuild coach.html as a real tab switcher

**Files:**
- Modify: `C:\Users\gregm\row\coach.html`

- [ ] **Step 1: Replace the whole file**

`coach.html` is only 78 lines and every part of it changes (stacked sections → tabs, static iframes → lazy-loaded + postMessage-driven). Replace the entire file with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#050506">
<meta name="color-scheme" content="dark">
<link rel="manifest" href="/manifest.json" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Row" />
<title>Coach — Row</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="sync.js" defer></script>
<script src="row-auth.js" defer></script>
<script src="topbar.js" defer></script>
<style>
:root {
  --bg: #000000;
  --text-primary: #F4F1EA;
  --text-tertiary: rgba(184, 182, 176, 0.55);
  --accent: #6ee7b7;
  --border: rgba(255,255,255,0.08);
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SF Mono, Menlo, Consolas, monospace;
}
html, body {
  margin: 0; padding: 0;
  background: var(--bg);
  color: var(--text-primary);
  font-family: var(--font);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
main {
  position: relative; z-index: 2;
  max-width: 720px; margin: 0 auto;
  padding: 56px 20px calc(140px + env(safe-area-inset-bottom));
  padding-top: max(56px, env(safe-area-inset-top, 56px));
  padding-left: max(20px, env(safe-area-inset-left));
  padding-right: max(20px, env(safe-area-inset-right));
}
.coach-tabs { display: flex; gap: 6px; margin-bottom: 20px; }
.coach-tab-btn {
  flex: 1; padding: 10px 16px; border-radius: 999px;
  font-size: 14px; font-weight: 600; letter-spacing: 0.01em;
  color: var(--text-tertiary); background: rgba(255,255,255,0.04);
  border: 1px solid var(--border); cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  -webkit-tap-highlight-color: transparent; font-family: inherit;
}
.coach-tab-btn.active { color: var(--text-primary); background: rgba(110,231,183,0.10); border-color: rgba(110,231,183,0.30); }
.coach-iframe-wrap { display: none; }
.coach-iframe-wrap.active { display: block; }
.coach-iframe {
  display: block; width: 100%; height: 1600px; border: 0;
  background: transparent; border-radius: 16px;
}
</style>
</head>
<body>

<main>
  <div class="coach-tabs">
    <button class="coach-tab-btn active" data-tab="posing" type="button">Posing Coach</button>
    <button class="coach-tab-btn" data-tab="form" type="button">Form Coach</button>
  </div>

  <div class="coach-iframe-wrap active" id="tabWrapPosing">
    <iframe id="iframePosing" src="posing.html" class="coach-iframe" title="Posing Coach"></iframe>
  </div>
  <div class="coach-iframe-wrap" id="tabWrapForm">
    <iframe id="iframeForm" class="coach-iframe" title="Form Coach"></iframe>
  </div>
</main>

<script>
(function () {
  var FRAMES = {
    posing: { src: 'posing.html', el: document.getElementById('iframePosing'), wrap: document.getElementById('tabWrapPosing'), loaded: true, ready: false, pendingActive: true },
    form: { src: 'form-coach.html', el: document.getElementById('iframeForm'), wrap: document.getElementById('tabWrapForm'), loaded: false, ready: false, pendingActive: false },
  };
  var activeTab = 'posing';

  // A child page posts 'coach-child-ready' once its own camera module has
  // wired up its listeners. Until then, an 'active' message posted at us
  // clicking its tab would be dropped -- so we remember "this tab wants to
  // be active" (pendingActive) and send the real activation the moment
  // 'coach-child-ready' arrives instead.
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type !== 'coach-child-ready') return;
    var frame = (event.source === FRAMES.posing.el.contentWindow) ? FRAMES.posing
      : (event.source === FRAMES.form.el.contentWindow) ? FRAMES.form : null;
    if (!frame) return;
    frame.ready = true;
    if (frame.pendingActive) {
      frame.el.contentWindow.postMessage({ type: 'coach-tab-active' }, window.location.origin);
    }
  });

  function activateTab(tabName) {
    if (tabName === activeTab) return;
    var outgoing = FRAMES[activeTab];
    var incoming = FRAMES[tabName];

    if (outgoing.ready) {
      outgoing.el.contentWindow.postMessage({ type: 'coach-tab-inactive' }, window.location.origin);
    }
    outgoing.pendingActive = false;
    outgoing.wrap.classList.remove('active');

    document.querySelectorAll('.coach-tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tabName); });
    incoming.wrap.classList.add('active');

    if (!incoming.loaded) {
      incoming.loaded = true;
      incoming.pendingActive = true;
      incoming.el.src = incoming.src; // first visit -- lazy-load, don't pay the MediaPipe model cost until the tab is actually opened
    } else if (incoming.ready) {
      incoming.el.contentWindow.postMessage({ type: 'coach-tab-active' }, window.location.origin);
    } else {
      incoming.pendingActive = true;
    }

    activeTab = tabName;
  }

  document.querySelectorAll('.coach-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.dataset.tab); });
  });
})();
</script>

</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git -C "C:\Users\gregm\row" add coach.html
git -C "C:\Users\gregm\row" commit -m "feat: rebuild coach.html as a real tab switcher (postMessage camera handshake)"
```

---

### Task 4: Live browser verification

This behavior depends on real `getUserMedia`/camera device state and cross-frame `postMessage` timing — none of it is exercisable by the existing Node self-checks (which only cover the pure scoring/checklist logic, unchanged by this plan). Do this task with the `Claude_Browser` tools, not by inspection.

- [ ] **Step 1: Start the dev server and open coach.html**

Use `preview_start` with the row project's dev server config, navigate to `coach.html`.

- [ ] **Step 2: Verify the default Posing Coach tab**

- `read_page` or `get_page_text`: confirm "Posing Coach" tab shows active styling, "Form Coach" iframe wrap is not visible.
- `read_console_messages`: confirm no errors during load.
- `read_network_requests`: confirm only `posing.html`'s iframe loaded — `form-coach.html` should NOT have been requested yet (lazy-load check).
- Grant camera permission if prompted; confirm the video element shows a live feed and the status banner clears from "Requesting camera…".

- [ ] **Step 3: Switch to Form Coach, verify lazy load + camera handoff**

- `computer` click the "Form Coach" tab button.
- `read_network_requests`: confirm `form-coach.html` is now requested (first-time lazy load).
- Confirm the Posing Coach camera actually stops — check `read_console_messages` for no lingering errors, and if possible verify via `javascript_tool` that the posing iframe's video element's `srcObject` is now `null` (proves `stopCamera` ran, not just that the tab is hidden).
- Confirm the Form Coach camera starts (video element populates, status banner clears).

- [ ] **Step 4: Switch back to Posing Coach, verify revisit (not first-load) path**

- Click back to "Posing Coach".
- `read_network_requests`: confirm `posing.html`'s iframe is NOT re-requested (it's still loaded, just re-shown + re-activated via postMessage, not reloaded).
- Confirm its camera restarts (proves the `ready` + `postMessage('coach-tab-active')` revisit path works, not just the first-load path).

- [ ] **Step 5: Report results**

Summarize what was verified and any issues found. If anything fails, fix the root cause in the relevant task's file before considering this plan done — don't patch around it in `coach.html` alone if the bug is actually in a child page's message handler.

---

## Self-Review

**Spec coverage:** Camera move (Task 1) ✓, form-coach strip + stub (Task 2) ✓, real tab switcher + postMessage teardown (Task 3, using the postMessage approach the spec recommended over iframe-src-reload) ✓, nav relabel (Task 1 Step 5, Task 2 Step 5) ✓, existing self-checks preserved (Task 1 Step 6, Task 2 Step 6) ✓, live browser verification called out explicitly (Task 4) ✓, file renames avoided (posing.html/form-coach.html keep their names) ✓, Part B content/underlying logic untouched (only the stub container added, `form-coach-logic.js`/`posing-checklists.js`/`benchmarks.js` unmodified) ✓.

**Placeholder scan:** No TBD/TODO. The Task 2 stub text ("Form cues and technique breakdowns are coming here — planned separately.") is an intentional user-facing placeholder per the spec's explicit Part B deferral, not a plan placeholder.

**Type/naming consistency:** `FormCoachCamera` (mode-keyed, old) → `PosingCamera` (posing.html) / `LiftCamera` (form-coach.html), each unkeyed — consistent within each file, no leftover references to the old mode-keyed API in either rewritten script block. `posing-camera-module-ready` / `lift-camera-module-ready` event names distinct per page (avoids any risk of the wrong page's listener firing if both were ever loaded in the same window, e.g. during testing). `coach-tab-active` / `coach-tab-inactive` / `coach-child-ready` message `type` strings used identically across `coach.html`, `posing.html`, and `form-coach.html`.
