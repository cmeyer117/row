# Hype Audio × Row Fusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two manual-tap hype-audio buttons to Row's `gym.html` rest timer — a general "mid-set" clip button that appears after every logged set, and a "PR Rant" button that appears only when the just-logged set is a personal record.

**Architecture:** All client-side, no backend/schema changes. One new pure helper (`pickMidSetClip`) added to the shared `hype-audio.js` core lib (already loaded by `gym.html`). `gym.html` threads the already-computed PR/grind/miss classification through to `startRestTimer`, storing it in a new module-level var so the rest-timer bar's render logic can gate the PR button on it. Both buttons call the existing `HypeAudio.playClip()`.

**Tech Stack:** Plain JS (no build step, no framework), static HTML, Node-based selfcheck scripts (`node *.selfcheck.js`) for pure-function coverage — matches the existing pattern in this repo (`gym-workout-events.js`, `hype-audio.selfcheck.js`).

Spec: `docs/superpowers/specs/2026-07-27-hype-audio-row-fusion-design.md`

---

### Task 1: Add `pickMidSetClip()` + auto-play wrappers to hype-audio.js, with tests

**Files:**
- Modify: `hype-audio.js:53-63` (near `pickRandom`)
- Modify: `hype-audio.js:328-357` (both `window.HypeAudio` and `module.exports` blocks)
- Test: `hype-audio.selfcheck.js`

`pickMidSetClip` is the one piece of non-trivial logic in this feature (fallback ordering), so it gets a real pure-function test, following the existing pattern in this file. `playMidSetHype`/`playPrRant` are thin pick+play wrappers (not unit tested — they call `playClip`, which constructs a real `Audio` object; this repo's convention, per `hypeMeUpBtn`'s existing handler, is to verify audio playback live in a browser, not in the Node selfcheck). `AUTO_PLAY_HYPE` lives here (not duplicated per-page) so gym.html's two separate `<script>` scopes (the big rest-timer IIFE and the later `DOMContentLoaded` button-wiring block) both read the same single source of truth via `window.HypeAudio`.

- [ ] **Step 1: Write the failing test**

Add to the end of `hype-audio.selfcheck.js`, before the final `console.log` line:

```js
// pickMidSetClip — tries moment:'mid_set' first, falls back to the
// iron/mindset/carl pillar pool (same pool "Hype Me Up" already uses)
// when mid_set has no clips, returns null only if both come up empty.
HypeAudio.addClip({ id: '10', title: 'MidSet', mentality: 'dorian', moment: 'mid_set', play_count: 0 });
assertEqual(HypeAudio.pickMidSetClip().id, '10', 'pickMidSetClip prefers a mid_set clip when one exists');

HypeAudio.deleteClip('10');
HypeAudio.addClip({ id: '11', title: 'IronClip', mentality: 'dorian', pillar: 'iron', play_count: 0 });
assertEqual(HypeAudio.pickMidSetClip().id, '11', 'pickMidSetClip falls back to the pillar pool when mid_set is empty');

HypeAudio.deleteClip('11');
assertEqual(HypeAudio.pickMidSetClip(), null, 'pickMidSetClip returns null when both mid_set and the pillar pool are empty');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node hype-audio.selfcheck.js`
Expected: FAIL — `TypeError: HypeAudio.pickMidSetClip is not a function`

- [ ] **Step 3: Write minimal implementation**

In `hype-audio.js`, add this function immediately after `pickRandom` (after line 63, i.e. right after its closing `}`):

```js
  // Rest-timer "hype me up" button: prefers a mid_set-tagged clip; falls
  // back to the same iron/mindset/carl pillar pool the "Hype Me Up" home
  // button already draws from, so the button isn't dead on arrival while
  // the mid_set pool is still empty (see docs/superpowers/specs/2026-07-27-hype-audio-row-fusion-design.md).
  function pickMidSetClip() {
    return pickRandom({ moment: 'mid_set' }) || pickRandom({ pillar: ['iron', 'mindset', 'carl'] });
  }

  // ponytail: false by default because Carl doesn't want playback cutting
  // off music he already has going mid-workout. Flip to true to have the
  // rest-timer clip and PR rant play automatically instead of requiring a
  // tap -- both call sites (gym.html's startRestTimer) already check this
  // flag, so flipping it is the only change needed.
  const AUTO_PLAY_HYPE = false;

  function playMidSetHype() {
    const clip = pickMidSetClip();
    if (clip) playClip(clip);
    return clip;
  }

  function playPrRant() {
    const clip = pickRandom({ pillar: 'carl' });
    if (clip) playClip(clip);
    return clip;
  }
```

Then add these four lines to both export blocks — in the `window.HypeAudio = { ... }` block (right after the `pickRandom: pickRandom,` line currently at 335) and in the `module.exports = { ... }` block (right after its own `pickRandom: pickRandom,` line currently at 365):

```js
      pickMidSetClip: pickMidSetClip,
      AUTO_PLAY_HYPE: AUTO_PLAY_HYPE,
      playMidSetHype: playMidSetHype,
      playPrRant: playPrRant,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node hype-audio.selfcheck.js`
Expected: `hype-audio.selfcheck.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add hype-audio.js hype-audio.selfcheck.js
git commit -m "feat(hype-audio): add pickMidSetClip + auto-play-gated play wrappers"
```

---

### Task 2: Thread `eventType` through the rest timer

**Files:**
- Modify: `gym.html:4851-4887` (rest timer state + `startRestTimer`/`stopRestTimer`)
- Modify: `gym.html:5262-5277` (Log Set click handler)
- Modify: `gym.html:5414-5427` (`quickLog` — no change needed, see note below)

`eventType` (`'pr'`/`'grind'`/`'miss'`/`null`) is currently a local variable inside the Log Set click handler, gated behind an `if (window.GymWorkoutEvents && window.__gym && ...)` check that only exists to guard the network call to `logWorkoutEvent`. It needs to be computed unconditionally and passed into `startRestTimer` so the PR button (Task 4) can read it.

- [ ] **Step 1: Add the module-level var**

In `gym.html`, at line 4852 (right after `let restTimerEndAt = 0;`), add:

```js
  let restTimerEventType = null; // 'pr' | 'grind' | 'miss' | null — set by startRestTimer, read by the PR-rant button's visibility check
```

- [ ] **Step 2: Update `startRestTimer` to accept and store it**

Replace the current `startRestTimer` (gym.html:4875-4887):

```js
  function startRestTimer(ex) {
    stopRestTimer();
    const repMin = parseInt(ex.repMin, 10) || 8;
    const secs = repMin <= 6 ? 150 : 75; // heavy (repMin 4-8) = 2:30, isolation (8-16) = 1:15
    restTimerEndAt = Date.now() + secs * 1000;
    $('restTimerMsg').textContent = restTimerMessage(ex);
    $('restTimerBar').style.display = 'flex';
    updateRestTimerDisplay();
    restTimerInterval = setInterval(function() {
      if (restTimerRemainingSecs() <= 0) { stopRestTimer(); return; }
      updateRestTimerDisplay();
    }, 1000);
  }
```

with:

```js
  function startRestTimer(ex, eventType) {
    stopRestTimer();
    restTimerEventType = eventType || null;
    const repMin = parseInt(ex.repMin, 10) || 8;
    const secs = repMin <= 6 ? 150 : 75; // heavy (repMin 4-8) = 2:30, isolation (8-16) = 1:15
    restTimerEndAt = Date.now() + secs * 1000;
    $('restTimerMsg').textContent = restTimerMessage(ex);
    $('restTimerBar').style.display = 'flex';
    updateRestTimerDisplay();
    $('restTimerPrBtn').style.display = restTimerEventType === 'pr' ? '' : 'none';
    if (window.HypeAudio && window.HypeAudio.AUTO_PLAY_HYPE) {
      window.HypeAudio.playMidSetHype();
      if (restTimerEventType === 'pr') window.HypeAudio.playPrRant();
    }
    restTimerInterval = setInterval(function() {
      if (restTimerRemainingSecs() <= 0) { stopRestTimer(); return; }
      updateRestTimerDisplay();
    }, 1000);
  }
```

(`$('restTimerPrBtn')` is added to the DOM in Task 3 — this function will throw if run before that task's HTML is in place, so do Task 3 before manually testing this one in a browser. The Node selfcheck in Task 1 doesn't touch the DOM so it's unaffected by ordering.)

- [ ] **Step 3: Reset it in `stopRestTimer`**

Replace `stopRestTimer` (gym.html:4870-4873):

```js
  function stopRestTimer() {
    if (restTimerInterval) { clearInterval(restTimerInterval); restTimerInterval = null; }
    $('restTimerBar').style.display = 'none';
  }
```

with:

```js
  function stopRestTimer() {
    if (restTimerInterval) { clearInterval(restTimerInterval); restTimerInterval = null; }
    restTimerEventType = null;
    $('restTimerBar').style.display = 'none';
  }
```

- [ ] **Step 4: Compute `eventType` unconditionally in the Log Set handler and pass it to `startRestTimer`**

Replace this block in the `$('logBtn').addEventListener('click', ...)` handler (gym.html:5270-5276):

```js
    if (window.GymWorkoutEvents && window.__gym && typeof window.__gym.logWorkoutEvent === 'function') {
      const eventType = window.GymWorkoutEvents.classifyWorkoutEvent({ weight: w, reps: reps }, priorLogs, ex);
      if (eventType) window.__gym.logWorkoutEvent(ex.name, eventType, w, reps, !!ex.bw);
    }
    if (plateMode) { plateCounts = {}; updatePlateUI(); }
    resetChipToToday('logDateChip', 'logDateInput');
    startRestTimer(ex);
```

with:

```js
    const eventType = window.GymWorkoutEvents
      ? window.GymWorkoutEvents.classifyWorkoutEvent({ weight: w, reps: reps }, priorLogs, ex)
      : null;
    if (eventType && window.__gym && typeof window.__gym.logWorkoutEvent === 'function') {
      window.__gym.logWorkoutEvent(ex.name, eventType, w, reps, !!ex.bw);
    }
    if (plateMode) { plateCounts = {}; updatePlateUI(); }
    resetChipToToday('logDateChip', 'logDateInput');
    startRestTimer(ex, eventType);
```

This is behavior-preserving for the existing `logWorkoutEvent` network call (same guard conditions, just reordered) — the only change is `eventType` is now computed regardless of whether `window.__gym` exists, and passed to `startRestTimer`.

**Note on `quickLog` (gym.html:5414-5427):** this path already doesn't call `startRestTimer` at all today (confirmed in the spec's Codex review) — quick-logged sets never show the rest timer bar, so there's nothing to wire here. No change to this function in this plan.

- [ ] **Step 5: Commit**

```bash
git add gym.html
git commit -m "feat(gym.html): thread eventType through the rest timer"
```

(This task alone doesn't produce a runnable page — `restTimerPrBtn` doesn't exist in the DOM yet, so step 2's `$('restTimerPrBtn')` line will throw at runtime. Task 3 must land before verifying in a browser. That's fine for a single-session build; don't stop to verify between these two tasks.)

---

### Task 3: Add CSS + HTML markup for the two buttons

**Files:**
- Modify: `gym.html:696-703` (CSS, next to `.po-rest-timer-adj`)
- Modify: `gym.html:2673-2681` (the `restTimerBar` markup)

- [ ] **Step 1: Add CSS**

After the existing rule at gym.html:703 (`.po-rest-timer-adj:hover, .po-rest-timer-dismiss:hover { background: rgba(255,255,255,0.10); }`), add:

```css
.po-rest-timer-hype {
  font-family: var(--font-mono); font-size: 11px; font-weight: 700;
  padding: 6px 10px; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(224,51,47,0.35); background: rgba(224,51,47,0.10); color: #ff6b66;
}
.po-rest-timer-hype:hover, .po-rest-timer-hype:active { background: rgba(224,51,47,0.2); }
.po-rest-timer-pr {
  font-family: var(--font-mono); font-size: 11px; font-weight: 700;
  padding: 6px 10px; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(255,193,7,0.4); background: rgba(255,193,7,0.12); color: #ffc107;
}
.po-rest-timer-pr:hover, .po-rest-timer-pr:active { background: rgba(255,193,7,0.22); }
```

(Colors: red/`.hype` matches the existing `.po-coach-btn.hype` accent used by "🔥 Hype Me Up"; gold/`#ffc107` is new, reserved for the PR button so it reads as distinct from the general hype button.)

- [ ] **Step 2: Add the button markup**

Replace the `restTimerBar` block (gym.html:2673-2681):

```html
    <div class="po-rest-timer" id="restTimerBar" style="display:none">
      <span class="po-rest-timer-count" id="restTimerCount">0:00</span>
      <span class="po-rest-timer-msg" id="restTimerMsg"></span>
      <div class="po-rest-timer-actions">
        <button type="button" class="po-rest-timer-adj" data-delta="-15">-15s</button>
        <button type="button" class="po-rest-timer-adj" data-delta="15">+15s</button>
        <button type="button" class="po-rest-timer-dismiss" id="restTimerDismiss">Skip</button>
      </div>
    </div>
```

with:

```html
    <div class="po-rest-timer" id="restTimerBar" style="display:none">
      <span class="po-rest-timer-count" id="restTimerCount">0:00</span>
      <span class="po-rest-timer-msg" id="restTimerMsg"></span>
      <div class="po-rest-timer-actions">
        <button type="button" class="po-rest-timer-adj" data-delta="-15">-15s</button>
        <button type="button" class="po-rest-timer-adj" data-delta="15">+15s</button>
        <button type="button" class="po-rest-timer-hype" id="restTimerHypeBtn">🔥 Hype</button>
        <button type="button" class="po-rest-timer-pr" id="restTimerPrBtn" style="display:none">🏆 PR</button>
        <button type="button" class="po-rest-timer-dismiss" id="restTimerDismiss">Skip</button>
      </div>
    </div>
```

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "feat(gym.html): add rest-timer hype/PR button markup + styling"
```

---

### Task 4: Wire the button click handlers

**Files:**
- Modify: `gym.html:6028-6040` (the existing `DOMContentLoaded` block that wires `hypeMeUpBtn`)

- [ ] **Step 1: Add the two handlers alongside the existing `hypeMeUpBtn` wiring**

Replace this block (gym.html:6028-6040):

```js
document.addEventListener('DOMContentLoaded', function () {
  if (window.initCloudSync) {
    window.initCloudSync({ appKey: 'hype-audio', syncedKeys: ['hype_audio'] });
  }
  const hypeBtn = document.getElementById('hypeMeUpBtn');
  if (hypeBtn) {
    hypeBtn.onclick = function () {
      const clip = window.HypeAudio.pickRandom({ pillar: ['iron', 'mindset', 'carl'] });
      if (!clip) { alert('No hype clips yet — add some from the hype-audio app.'); return; }
      window.HypeAudio.playClip(clip);
    };
  }
});
```

with:

```js
document.addEventListener('DOMContentLoaded', function () {
  if (window.initCloudSync) {
    window.initCloudSync({ appKey: 'hype-audio', syncedKeys: ['hype_audio'] });
  }
  const hypeBtn = document.getElementById('hypeMeUpBtn');
  if (hypeBtn) {
    hypeBtn.onclick = function () {
      const clip = window.HypeAudio.pickRandom({ pillar: ['iron', 'mindset', 'carl'] });
      if (!clip) { alert('No hype clips yet — add some from the hype-audio app.'); return; }
      window.HypeAudio.playClip(clip);
    };
  }
  const restHypeBtn = document.getElementById('restTimerHypeBtn');
  if (restHypeBtn) {
    restHypeBtn.onclick = function () {
      if (!window.HypeAudio.playMidSetHype()) alert('No hype clips yet — add some from the hype-audio app.');
    };
  }
  const restPrBtn = document.getElementById('restTimerPrBtn');
  if (restPrBtn) {
    restPrBtn.onclick = function () {
      if (!window.HypeAudio.playPrRant()) alert('No hype clips yet — add some from the hype-audio app.');
    };
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add gym.html
git commit -m "feat(gym.html): wire rest-timer hype/PR button click handlers"
```

---

### Task 5: Live-verify in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the local static server**

Use the `row` launch config (`.claude/launch.json`, already present — `npx serve -l 5555 .`) via the Browser pane's `preview_start`, then navigate to `http://localhost:5555/gym.html`.

- [ ] **Step 2: Log a normal (non-PR) set**

Pick any exercise with existing log history, log a set that's neither a new best nor a grind/miss (e.g. a mid-range rep count matching a typical prior set). Confirm:
- The rest timer bar appears with `-15s`/`+15s`/`🔥 Hype`/`Skip` visible.
- `🏆 PR` is **not** visible.
- Tapping `🔥 Hype` plays a clip (or shows the "No hype clips yet" alert if the library is empty on this device/browser profile).

- [ ] **Step 3: Log a PR set**

Log a set that beats the prior best (higher weight/reps than any prior log for that exercise, or higher reps for a bodyweight exercise). Confirm:
- `🏆 PR` **is** visible alongside `🔥 Hype`.
- Tapping `🏆 PR` plays a `pillar:'carl'` clip (spot-check via the hype-audio app's own clip list, or by ear if you recognize Carl's own clips).

- [ ] **Step 4: Check for mobile overflow**

Resize the Browser pane to a narrow mobile width (e.g. 375px). Confirm the five buttons (`-15s`, `+15s`, `🔥 Hype`, `🏆 PR` when a PR, `Skip`) don't overflow the row or get clipped. If they do, that's a follow-up fix, not a blocker for this plan — note it in the session close-out.

- [ ] **Step 5: Confirm no regressions**

Confirm the existing "🔥 Hype Me Up" home-area button (unrelated to this feature) still works, and that `-15s`/`+15s`/`Skip` still behave as before.

- [ ] **Step 6: Confirm `AUTO_PLAY_HYPE` defaults off**

Log a set and confirm nothing plays automatically — only tapping `🔥 Hype` or `🏆 PR` starts playback. To test the auto-play path itself (optional, not required to ship), temporarily flip `AUTO_PLAY_HYPE` to `true` in `hype-audio.js`, reload, log a set, confirm it plays without a tap, then revert the flag back to `false` before committing anything else.

---

### Task 6: Final commit + push

**Files:** none (repo-level)

- [ ] **Step 1: Confirm all prior task commits are in place**

```bash
git log --oneline -6
```

Expected: the 4 feature commits from Tasks 1-4 (pickMidSetClip, thread eventType, button markup, click handlers), most-recent-first.

- [ ] **Step 2: Push**

```bash
git push
```
