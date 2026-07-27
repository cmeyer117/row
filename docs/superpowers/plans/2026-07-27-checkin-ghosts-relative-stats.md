# Adaptive Check-In, Ghosts, and Relative Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tap-to-accept ghost logging, relative-strength/stalled-lift stats, and a pain/recovery/pump check-in that adjusts `getRx()`'s next-session prescription — to `gym.html`, Row's progressive-overload coach.

**Architecture:** All three features extend existing structures rather than adding new subsystems: ghosts reuse the existing `quickLog()` text-parser via the already-rendered `#rxWrap` card; relative stats reuse `estimate1RM()` and the already-tracked `po_coach_weights` localStorage array; the check-in is looked up *inside* `getRx()` from `state.checkins[dateKey]` keyed by each log's own date, so no call site's signature needs to change. Spec: `docs/superpowers/specs/2026-07-27-adaptive-checkin-ghosts-relative-stats-design.md` (Codex-reviewed).

**Tech Stack:** Plain HTML/CSS/vanilla JS, no build step, no framework, no test runner (this codebase verifies via `preview_start` + manual browser console checks — see existing plans in this directory for the established pattern).

**Out of scope:** The post-workout debrief bug (`fireDebrief()`) — separate `systematic-debugging` task. Any change to the joint-pain system.

---

### Task 1: Ghosts — tap-to-accept on the Rx card

**Files:**
- Modify: `gym.html:3747-3768` (`renderRx()`)
- Modify: `gym.html:4508+` (EVENT WIRING section — add one listener)

- [ ] **Step 1: Add tap-target data attributes to the Rx card markup**

In `renderRx()`, find the two `wrap.innerHTML = ...` assignments (the "no rx / starting point" branch and the normal branch). Replace both to add a `data-*` payload the tap handler will read, plus a `po-rx-tappable` class.

Find this exact text (the "no rx" branch, lines 3753-3762):

```javascript
    if (!rx) {
      const sw = ex.startWeight, sr = ex.repMin;
      const head = ex.bw
        ? '<span class="po-accent">' + sr + '</span> reps'
        : '<span class="po-accent">' + (sw || 0) + unit() + '</span> × ' + sr + ' reps';
      const reason = ex.bw
        ? 'Aim for ' + ex.repMin + '-' + ex.repMax + ' clean reps. Once you hit ' + ex.repMax + '+, push for more.'
        : 'Hit ' + ex.repMin + '-' + ex.repMax + ' reps. Once logged, the coach will start prescribing.';
      wrap.innerHTML = '<div class="po-rx-card"><div class="po-rx-label">' + escape(ex.name) + ' · starting point</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag hold">Start here</span><p class="po-rx-reason">' + reason + '</p></div>';
      return;
    }
```

Replace with:

```javascript
    if (!rx) {
      const sw = ex.startWeight, sr = ex.repMin;
      const head = ex.bw
        ? '<span class="po-accent">' + sr + '</span> reps'
        : '<span class="po-accent">' + (sw || 0) + unit() + '</span> × ' + sr + ' reps';
      const reason = ex.bw
        ? 'Aim for ' + ex.repMin + '-' + ex.repMax + ' clean reps. Once you hit ' + ex.repMax + '+, push for more.'
        : 'Hit ' + ex.repMin + '-' + ex.repMax + ' reps. Once logged, the coach will start prescribing.';
      wrap.innerHTML = '<div class="po-rx-card po-rx-tappable" data-tap-reps="' + sr + '"' + (ex.bw ? ' data-tap-bw="1"' : ' data-tap-weight="' + (sw || 0) + '"') + '><div class="po-rx-label">' + escape(ex.name) + ' · starting point</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag hold">Start here</span><p class="po-rx-reason">' + reason + ' Tap to log it.</p></div>';
      return;
    }
```

Then find this exact text (the normal branch, lines 3764-3767):

```javascript
    const head = rx.bw
      ? '<span class="po-accent">' + rx.reps + '</span> reps'
      : '<span class="po-accent">' + (rx.plates != null ? (rx.plates + (rx.plates===1?' plate':' plates') + (rx.extraLbs ? '+'+rx.extraLbs : '')) : rx.weight + unit()) + '</span> × ' + rx.reps + ' reps';
    wrap.innerHTML = '<div class="po-rx-card po-rx-' + rx.type + '"><div class="po-rx-label">' + escape(ex.name) + '</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag ' + rx.type + '">' + rx.tag + '</span><p class="po-rx-reason">' + rx.reason + '</p></div>';
```

Replace with:

```javascript
    const head = rx.bw
      ? '<span class="po-accent">' + rx.reps + '</span> reps'
      : '<span class="po-accent">' + (rx.plates != null ? (rx.plates + (rx.plates===1?' plate':' plates') + (rx.extraLbs ? '+'+rx.extraLbs : '')) : rx.weight + unit()) + '</span> × ' + rx.reps + ' reps';
    var tapAttrs = 'data-tap-reps="' + rx.reps + '"' + (rx.bw ? ' data-tap-bw="1"' : (rx.plates != null ? ' data-tap-plates="' + rx.plates + '" data-tap-extralbs="' + (rx.extraLbs || 0) + '"' : ' data-tap-weight="' + rx.weight + '"'));
    wrap.innerHTML = '<div class="po-rx-card po-rx-' + rx.type + ' po-rx-tappable" ' + tapAttrs + '><div class="po-rx-label">' + escape(ex.name) + '</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag ' + rx.type + '">' + rx.tag + '</span><p class="po-rx-reason">' + rx.reason + ' Tap to log it.</p></div>';
```

- [ ] **Step 2: Wire the tap handler**

In the EVENT WIRING section, immediately after the existing `$('poTwDoneBtn').addEventListener(...)` block (ends at line 4498), add:

```javascript
  // Ghost tap-to-accept: tapping the Rx card logs its exact suggestion via
  // the same quickLog() text parser everything else uses — data attributes
  // set by renderRx() carry the values, so no re-computation happens here.
  $('rxWrap').addEventListener('click', function(e) {
    const card = e.target.closest('.po-rx-tappable');
    if (!card) return;
    const ex = getCurrentEx();
    if (!ex) return;
    const reps = card.getAttribute('data-tap-reps');
    let raw;
    if (card.hasAttribute('data-tap-bw')) {
      raw = ex.name + ' ' + reps;
    } else if (card.hasAttribute('data-tap-plates')) {
      const plates = card.getAttribute('data-tap-plates');
      const extraLbs = card.getAttribute('data-tap-extralbs');
      raw = ex.name + ' ' + plates + 'p' + (extraLbs && extraLbs !== '0' ? '+' + extraLbs : '') + '×' + reps;
    } else {
      raw = ex.name + ' ' + card.getAttribute('data-tap-weight') + '×' + reps;
    }
    const result = quickLog(raw, getActiveDate());
    if (!result.ok) { console.warn('[ghost-tap]', result.msg); }
  });
```

- [ ] **Step 3: Verify in browser**

Start the dev server (`preview_start { "name": "row" }`), open `http://localhost:5555/gym.html`, go to the Log tab, pick an exercise with no logs yet. Confirm the "starting point" Rx card shows "Tap to log it." Tap the card. Confirm a new set appears in that exercise's log matching the displayed weight/reps, and the Rx card updates to a real prescription (no longer "starting point"). Tap the new Rx card again — confirm a second set logs with the newly-prescribed values. Confirm no console errors.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "feat(gym): tap-to-accept ghost logging on the Rx card"
```

---

### Task 2: Relative stats — e1RM/bodyweight and stalled-lift badge

**Files:**
- Modify: `gym.html:3257-3260` (near `estimate1RM`, add bodyweight helper)
- Modify: `gym.html:3293-3315` (`getRx()` — expose `stuck` on all live return paths)
- Modify: `gym.html:4090-4174` (`renderProgress()` — stalled badge on card)
- Modify: `gym.html:2886-2891` (progress modal markup — add relative-stat line)
- Modify: `gym.html:4198-4253` (`renderProgressModal()` — populate it)

- [ ] **Step 1: Add the bodyweight lookup helper**

Find this exact text:

```javascript
  function estimate1RM(w, r) { if (r < 2) return w; return w * (1 + r / 30); }
  // gym-weight-photos.js is a separate script (own scope) and calls this —
  // expose it on window, same pattern as window.__gym.pcSupa below.
  window.estimate1RM = estimate1RM;
```

Replace with:

```javascript
  function estimate1RM(w, r) { if (r < 2) return w; return w * (1 + r / 30); }
  // gym-weight-photos.js is a separate script (own scope) and calls this —
  // expose it on window, same pattern as window.__gym.pcSupa below.
  window.estimate1RM = estimate1RM;
  // Reads the same localStorage key the bodyweight tracker (po_coach_weights)
  // already writes to. Returns null if nothing's been logged yet — callers
  // must handle that, never divide by a fabricated default.
  function getLatestBodyweight() {
    try {
      const entries = JSON.parse(localStorage.getItem('po_coach_weights') || '[]');
      if (!Array.isArray(entries) || !entries.length) return null;
      const sorted = entries.slice().sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      return sorted[sorted.length - 1].weight || null;
    } catch (e) { return null; }
  }
```

- [ ] **Step 2: Run in browser console to verify the helper**

Start the dev server, open `http://localhost:5555/gym.html`, open the console, run:

```javascript
getLatestBodyweight()
```

Expected: a number (the most recent seeded/logged bodyweight), not `null` or `NaN`.

- [ ] **Step 3: Expose `stuck` on every live `getRx()` return path**

Find this exact text (the full function):

```javascript
  function getRx(ex, logs) {
    if (!logs.length) return null;
    const last = logs[logs.length - 1];
    const { weight, reps } = last;
    const { repMin, repMax, step, bw } = ex;
    const upgradeAt = Math.min(CONFIG.upgradeAtReps || 8, repMax);
    let stuck = 0;
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].weight === weight) stuck++; else break;
    }
    if (bw) {
      if (reps >= upgradeAt) return { type: 'up', weight: 0, reps: reps + 1, tag: 'Push for more', reason: reps + ' reps — strong. Push for ' + (reps + 1) + ' next time.', bw: true };
      if (reps >= repMin) return { type: 'hold', weight: 0, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps. Push for ' + (reps + 1) + ' next session.', bw: true };
      return { type: 'hold', weight: 0, reps: repMin, tag: 'Repeat', reason: reps + ' reps fell short. Repeat until you hit ' + repMin + '+.', bw: true };
    }
    if (stuck >= 3 && reps < repMin) {
      const dl = roundToStep(weight * 0.9, step);
      return { type: 'down', weight: dl, reps: repMax, tag: 'Deload', reason: 'Stuck at ' + weight + unit() + ' for ' + stuck + ' sessions. Drop 10%, reset, build back cleaner.' };
    }
    if (reps >= upgradeAt) return { type: 'up', weight: weight + step, reps: repMin, tag: 'Add weight', reason: 'You hit ' + reps + ' reps — time to add ' + step + unit() + '. Expect ' + repMin + '-' + (repMin + 1) + ' next session.' };
    if (reps >= repMin && reps < upgradeAt) return { type: 'hold', weight: weight, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps in target. Stay at ' + weight + unit() + ', push for ' + (reps + 1) + '.' };
    return { type: 'hold', weight: weight, reps: repMin, tag: 'Repeat', reason: reps + ' reps short of ' + repMin + '-' + upgradeAt + '. Repeat ' + weight + unit() + ' until you hit ' + repMin + '+ clean.' };
  }
```

Replace with (this step only adds `stuck` to the bw branch's own rep-based counter and to every return object — the pain/recovery override logic is added in Task 3, not here, so this step is a pure additive change with no behavior difference yet):

```javascript
  function getRx(ex, logs) {
    if (!logs.length) return null;
    const last = logs[logs.length - 1];
    const { weight, reps } = last;
    const { repMin, repMax, step, bw } = ex;
    const upgradeAt = Math.min(CONFIG.upgradeAtReps || 8, repMax);
    let stuck = 0;
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].weight === weight) stuck++; else break;
    }
    if (bw) {
      // Bodyweight exercises track reps, not weight — "stalled" here means
      // consecutive sessions logging the same rep count, not the same weight.
      let bwStuck = 0;
      for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].reps === reps) bwStuck++; else break;
      }
      if (reps >= upgradeAt) return { type: 'up', weight: 0, reps: reps + 1, tag: 'Push for more', reason: reps + ' reps — strong. Push for ' + (reps + 1) + ' next time.', bw: true, stuck: bwStuck };
      if (reps >= repMin) return { type: 'hold', weight: 0, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps. Push for ' + (reps + 1) + ' next session.', bw: true, stuck: bwStuck };
      return { type: 'hold', weight: 0, reps: repMin, tag: 'Repeat', reason: reps + ' reps fell short. Repeat until you hit ' + repMin + '+.', bw: true, stuck: bwStuck };
    }
    if (stuck >= 3 && reps < repMin) {
      const dl = roundToStep(weight * 0.9, step);
      return { type: 'down', weight: dl, reps: repMax, tag: 'Deload', reason: 'Stuck at ' + weight + unit() + ' for ' + stuck + ' sessions. Drop 10%, reset, build back cleaner.', stuck: stuck };
    }
    if (reps >= upgradeAt) return { type: 'up', weight: weight + step, reps: repMin, tag: 'Add weight', reason: 'You hit ' + reps + ' reps — time to add ' + step + unit() + '. Expect ' + repMin + '-' + (repMin + 1) + ' next session.', stuck: stuck };
    if (reps >= repMin && reps < upgradeAt) return { type: 'hold', weight: weight, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps in target. Stay at ' + weight + unit() + ', push for ' + (reps + 1) + '.', stuck: stuck };
    return { type: 'hold', weight: weight, reps: repMin, tag: 'Repeat', reason: reps + ' reps short of ' + repMin + '-' + upgradeAt + '. Repeat ' + weight + unit() + ' until you hit ' + repMin + '+ clean.', stuck: stuck };
  }
```

- [ ] **Step 4: Run in browser console to verify `stuck` is present**

With an exercise selected that has at least one log, run in console:

```javascript
getRx(getCurrentEx(), getLogs())
```

Expected: the returned object has a numeric `stuck` field (0 or higher), in addition to the existing `type`/`weight`/`reps`/`tag`/`reason` fields.

- [ ] **Step 5: Add the stalled badge to `renderProgress()`'s card template**

Find this exact text:

```javascript
      // Day badge
      var dayObj = (state.days || []).find(function(d){ return d.id === ex.day; });
      var dayName = dayObj ? dayObj.name : (ex.isAdhoc ? 'Extra' : '');
```

Replace with:

```javascript
      // Day badge
      var dayObj = (state.days || []).find(function(d){ return d.id === ex.day; });
      var dayName = dayObj ? dayObj.name : (ex.isAdhoc ? 'Extra' : '');

      // Stalled badge — only meaningful while stuck but NOT already in an
      // active deload (getRx's own 'down' type already communicates that).
      var rxForBadge = getRx(ex, logs);
      var showStalled = rxForBadge && rxForBadge.stuck >= 4 && rxForBadge.type !== 'down';
```

Then find this exact text:

```javascript
        +     (dayName ? '<div class="prog-card-badge">' + escape(dayName) + '</div>' : '')
```

Replace with:

```javascript
        +     (dayName ? '<div class="prog-card-badge">' + escape(dayName) + '</div>' : '')
        +     (showStalled ? '<div class="prog-card-badge prog-card-badge-stalled" title="' + rxForBadge.stuck + ' sessions at the same ' + (ex.bw ? 'rep count' : 'weight') + '">Stalled</div>' : '')
```

- [ ] **Step 6: Add the `.prog-card-badge-stalled` style**

Find the existing `.prog-card-badge` CSS rule (search for `.prog-card-badge {` in the `<style>` block) and add a sibling rule immediately after it:

```css
.prog-card-badge-stalled { background: rgba(251, 191, 36, 0.14); color: #fbbf24; border-color: rgba(251, 191, 36, 0.24); }
```

- [ ] **Step 7: Add the relative-stat line to the progress modal markup**

Find this exact text:

```html
      <div class="sub-modal-title" id="progModalTitle">Exercise</div>
      <div id="progModalChart"></div>
```

Replace with:

```html
      <div class="sub-modal-title" id="progModalTitle">Exercise</div>
      <div id="progModalRelative" style="font-family:var(--font-mono);font-size:11px;color:var(--text-3);margin:-4px 0 8px;"></div>
      <div id="progModalChart"></div>
```

- [ ] **Step 8: Populate it in `renderProgressModal()`**

Find this exact text:

```javascript
    $('progModalTitle').textContent = ex.name + ' — PR ' + prStr;
```

Replace with:

```javascript
    $('progModalTitle').textContent = ex.name + ' — PR ' + prStr;
    var relEl = $('progModalRelative');
    var bw = getLatestBodyweight();
    if (ex.bw || !bw) {
      relEl.textContent = '';
    } else {
      var ratio = estimate1RM(prLog.weight || 0, prLog.reps) / bw;
      relEl.textContent = 'e1RM ÷ bodyweight: ' + ratio.toFixed(2) + '×';
    }
```

- [ ] **Step 9: Verify in browser**

Reload `http://localhost:5555/gym.html`, go to the Progress tab. Confirm no visible layout change yet on cards unless an exercise is genuinely stalled (find or create one by logging the same weight 4+ times for a test exercise — confirm the amber "Stalled" badge appears; log a 5th session at the same weight to trigger the existing deload, confirm the badge disappears once `type` becomes `'down'`). Tap a card to open the modal — confirm the "e1RM ÷ bodyweight" line appears under the title for a weighted exercise, and is blank for a bodyweight exercise (e.g. pullups). Confirm no console errors.

- [ ] **Step 10: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "feat(gym): relative-strength stat and stalled-lift badge"
```

---

### Task 3: Adaptive check-in — pain/recovery/pump

**Files:**
- Modify: `gym.html:3108-3145` (`normalize()` — init `state.checkins`)
- Modify: `gym.html:3293-3315` (`getRx()` — apply pain/recovery override, as amended by Task 2)
- Modify: `gym.html:2886` region (add check-in modal markup, mirroring the existing `.sub-modal` pattern)
- Modify: `gym.html:4486-4498` (`poTwDoneBtn` click handler — trigger the check-in modal)
- Modify: `gym.html:3747-3768` (`renderRx()` — surface the pump note)

- [ ] **Step 1: Initialize `state.checkins` in `normalize()`**

Find this exact text:

```javascript
    s.logs = (s.logs && typeof s.logs === 'object') ? s.logs : {};
    if (!s.sessions || typeof s.sessions !== 'object') s.sessions = {};
```

Replace with:

```javascript
    s.logs = (s.logs && typeof s.logs === 'object') ? s.logs : {};
    if (!s.sessions || typeof s.sessions !== 'object') s.sessions = {};
    // One entry per day a check-in was submitted: { pain, recovery, pump },
    // each 'low'|'med'|'high'. Keyed by the date the check-in was collected
    // (same day as that day's last logged set) — getRx() looks this up by
    // each exercise's own last-log date, not "today", so it stays correct
    // no matter how many days later that exercise is next trained.
    if (!s.checkins || typeof s.checkins !== 'object') s.checkins = {};
```

- [ ] **Step 2: Apply the pain/recovery override in `getRx()`**

This modifies the function as it exists after Task 2's Step 3. Find this exact text (the end of the function, both return-object families):

```javascript
    if (stuck >= 3 && reps < repMin) {
      const dl = roundToStep(weight * 0.9, step);
      return { type: 'down', weight: dl, reps: repMax, tag: 'Deload', reason: 'Stuck at ' + weight + unit() + ' for ' + stuck + ' sessions. Drop 10%, reset, build back cleaner.', stuck: stuck };
    }
    if (reps >= upgradeAt) return { type: 'up', weight: weight + step, reps: repMin, tag: 'Add weight', reason: 'You hit ' + reps + ' reps — time to add ' + step + unit() + '. Expect ' + repMin + '-' + (repMin + 1) + ' next session.', stuck: stuck };
    if (reps >= repMin && reps < upgradeAt) return { type: 'hold', weight: weight, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps in target. Stay at ' + weight + unit() + ', push for ' + (reps + 1) + '.', stuck: stuck };
    return { type: 'hold', weight: weight, reps: repMin, tag: 'Repeat', reason: reps + ' reps short of ' + repMin + '-' + upgradeAt + '. Repeat ' + weight + unit() + ' until you hit ' + repMin + '+ clean.', stuck: stuck };
  }
```

Replace with:

```javascript
    let result;
    if (stuck >= 3 && reps < repMin) {
      const dl = roundToStep(weight * 0.9, step);
      result = { type: 'down', weight: dl, reps: repMax, tag: 'Deload', reason: 'Stuck at ' + weight + unit() + ' for ' + stuck + ' sessions. Drop 10%, reset, build back cleaner.', stuck: stuck };
    } else if (reps >= upgradeAt) {
      result = { type: 'up', weight: weight + step, reps: repMin, tag: 'Add weight', reason: 'You hit ' + reps + ' reps — time to add ' + step + unit() + '. Expect ' + repMin + '-' + (repMin + 1) + ' next session.', stuck: stuck };
    } else if (reps >= repMin && reps < upgradeAt) {
      result = { type: 'hold', weight: weight, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps in target. Stay at ' + weight + unit() + ', push for ' + (reps + 1) + '.', stuck: stuck };
    } else {
      result = { type: 'hold', weight: weight, reps: repMin, tag: 'Repeat', reason: reps + ' reps short of ' + repMin + '-' + upgradeAt + '. Repeat ' + weight + unit() + ' until you hit ' + repMin + '+ clean.', stuck: stuck };
    }
    return applyCheckinOverride(result, last, ex, stuck);
  }

  // Looks up the check-in submitted on the same day as `last` (the log this
  // prescription is based on) and, if present, applies the pain/recovery
  // rules from docs/superpowers/specs/2026-07-27-adaptive-checkin-ghosts-relative-stats-design.md.
  // Pain=high short-circuits: recovery is never checked once pain overrides.
  // Pump is never applied here — it's informational only, surfaced in renderRx().
  function applyCheckinOverride(result, last, ex, stuck) {
    const dateKey = last.date.slice(0, 10);
    const checkin = state.checkins[dateKey];
    if (!checkin) return result;
    const { repMin, repMax, step } = ex;
    if (checkin.pain === 'high') {
      if (ex.bw) {
        return { type: 'hold', weight: 0, reps: repMin, tag: 'Pain — repeat', reason: 'Logged high pain last session. Repeat at ' + repMin + ' reps, don\'t push.', bw: true, stuck: stuck };
      }
      const dl = roundToStep(last.weight * 0.9, step);
      return { type: 'down', weight: dl, reps: repMax, tag: 'Pain — deload', reason: 'Logged high pain last session. Drop 10%, reset, and reassess.', stuck: stuck };
    }
    if (checkin.recovery === 'low' && result.type === 'up') {
      if (ex.bw) {
        return { type: 'hold', weight: 0, reps: last.reps + 1, tag: 'Add a rep', reason: last.reps + ' reps — strong, but recovery was low last time. Hold the push, aim for ' + (last.reps + 1) + '.', bw: true, stuck: stuck };
      }
      return { type: 'hold', weight: last.weight, reps: last.reps + 1, tag: 'Add a rep', reason: last.reps + ' reps — solid, but recovery was low last time. Hold at ' + last.weight + unit() + ', push for ' + (last.reps + 1) + '.', stuck: stuck };
    }
    return result;
  }
```

- [ ] **Step 3: Verify the override logic in browser console**

Reload the page. With an exercise selected whose last log would normally produce an `'up'` result (reps >= upgradeAt), run in console:

```javascript
const ex = getCurrentEx();
const logs = getLogs();
const lastDateKey = logs[logs.length-1].date.slice(0,10);
state.checkins[lastDateKey] = { pain: 'low', recovery: 'low', pump: 'med' };
saveState();
getRx(ex, logs);
```

Expected: `type` is now `'hold'`, not `'up'`, and `reason` mentions "recovery was low." Then run:

```javascript
state.checkins[lastDateKey] = { pain: 'high', recovery: 'low', pump: 'med' };
saveState();
getRx(ex, logs);
```

Expected: `type` is `'down'` (or the bw-specific `'hold'`/repMin shape if `ex.bw`), `reason` mentions "high pain" — confirming pain short-circuits before recovery is checked. Clean up: `delete state.checkins[lastDateKey]; saveState();`

- [ ] **Step 4: Add the check-in modal markup**

Find this exact text (the progress-modal markup added in Task 2, now the last `.sub-modal-bg` block):

```html
  <!-- PROGRESS CARD EXPANDED-GRAPH MODAL -->
  <div class="sub-modal-bg" id="progModalBg">
```

Insert immediately before it:

```html
  <!-- POST-WORKOUT CHECK-IN MODAL -->
  <div class="sub-modal-bg" id="checkinModalBg">
    <div class="sub-modal">
      <div class="sub-modal-title">How'd that session feel?</div>
      <div class="po-checkin-row" data-checkin-field="pain">
        <div class="po-checkin-row-label">Pain</div>
        <button type="button" class="po-checkin-btn" data-val="low">Low</button>
        <button type="button" class="po-checkin-btn" data-val="med">Med</button>
        <button type="button" class="po-checkin-btn" data-val="high">High</button>
      </div>
      <div class="po-checkin-row" data-checkin-field="recovery">
        <div class="po-checkin-row-label">Recovery</div>
        <button type="button" class="po-checkin-btn" data-val="low">Low</button>
        <button type="button" class="po-checkin-btn" data-val="med">Med</button>
        <button type="button" class="po-checkin-btn" data-val="high">High</button>
      </div>
      <div class="po-checkin-row" data-checkin-field="pump">
        <div class="po-checkin-row-label">Pump</div>
        <button type="button" class="po-checkin-btn" data-val="low">Low</button>
        <button type="button" class="po-checkin-btn" data-val="med">Med</button>
        <button type="button" class="po-checkin-btn" data-val="high">High</button>
      </div>
      <div class="sub-modal-actions">
        <button type="button" class="po-btn-secondary" id="checkinSkip">Skip</button>
        <button type="button" class="po-btn-primary" id="checkinSave">Save</button>
      </div>
    </div>
  </div>

```

- [ ] **Step 5: Add the check-in row/button CSS**

Add near the existing `.po-jointpain-*` rules (search for `.po-jointpain-row {` in the `<style>` block) — insert after that rule block:

```css
.po-checkin-row { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
.po-checkin-row-label { width: 64px; font-size: 12px; color: var(--text-2); font-weight: 600; flex-shrink: 0; }
.po-checkin-btn { flex: 1; padding: 8px 0; border-radius: 8px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.04); color: var(--text-2); font-size: 12px; cursor: pointer; }
.po-checkin-btn:hover { background: rgba(255,255,255,0.08); }
.po-checkin-btn.selected { background: rgba(110,231,183,0.16); border-color: rgba(110,231,183,0.35); color: #6ee7b7; }
```

- [ ] **Step 6: Wire the modal's selection and save/skip behavior**

In the EVENT WIRING section, after the ghost-tap listener added in Task 1 Step 2, add:

```javascript
  (function initCheckinModal() {
    const bg = $('checkinModalBg');
    const selections = { pain: null, recovery: null, pump: null };
    bg.querySelectorAll('.po-checkin-row').forEach(function(row) {
      const field = row.getAttribute('data-checkin-field');
      row.querySelectorAll('.po-checkin-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          selections[field] = btn.getAttribute('data-val');
          row.querySelectorAll('.po-checkin-btn').forEach(function(b) { b.classList.remove('selected'); });
          btn.classList.add('selected');
        });
      });
    });
    function reset() {
      selections.pain = null; selections.recovery = null; selections.pump = null;
      bg.querySelectorAll('.po-checkin-btn').forEach(function(b) { b.classList.remove('selected'); });
    }
    $('checkinSkip').addEventListener('click', function() {
      bg.classList.remove('show');
      reset();
    });
    $('checkinSave').addEventListener('click', function() {
      // Only record fields the user actually tapped — a partial check-in
      // (e.g. pain + recovery, no pump opinion) is still useful data.
      if (selections.pain || selections.recovery || selections.pump) {
        const dateKey = getActiveDate();
        state.checkins[dateKey] = {
          pain: selections.pain, recovery: selections.recovery, pump: selections.pump
        };
        saveState();
      }
      bg.classList.remove('show');
      reset();
    });
    window.__gym_openCheckinModal = function() { bg.classList.add('show'); };
  })();
```

- [ ] **Step 7: Trigger the modal from "Mark workout done"**

Find this exact text:

```javascript
  $('poTwDoneBtn').addEventListener('click', () => {
    const todayKey = wtDateKey(new Date());
    const wasUndone = !doneDays[todayKey];
    if (doneDays[todayKey]) {
      delete doneDays[todayKey];
    } else {
      doneDays[todayKey] = new Date().toISOString();
    }
    saveDoneDays(doneDays);
    renderTodaysWorkout();
    renderPastWorkouts();
    if (wasUndone) fireDebrief();
  });
```

Replace with:

```javascript
  $('poTwDoneBtn').addEventListener('click', () => {
    const todayKey = wtDateKey(new Date());
    const wasUndone = !doneDays[todayKey];
    if (doneDays[todayKey]) {
      delete doneDays[todayKey];
    } else {
      doneDays[todayKey] = new Date().toISOString();
    }
    saveDoneDays(doneDays);
    renderTodaysWorkout();
    renderPastWorkouts();
    if (wasUndone) {
      fireDebrief();
      if (typeof window.__gym_openCheckinModal === 'function') window.__gym_openCheckinModal();
    }
  });
```

- [ ] **Step 8: Surface the pump note (informational only) in `renderRx()`**

Find this exact text (from Task 1's already-modified normal branch):

```javascript
    wrap.innerHTML = '<div class="po-rx-card po-rx-' + rx.type + ' po-rx-tappable" ' + tapAttrs + '><div class="po-rx-label">' + escape(ex.name) + '</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag ' + rx.type + '">' + rx.tag + '</span><p class="po-rx-reason">' + rx.reason + ' Tap to log it.</p></div>';
```

Replace with:

```javascript
    const lastLog = logs[logs.length - 1];
    const lastCheckin = lastLog ? state.checkins[lastLog.date.slice(0, 10)] : null;
    const pumpNote = lastCheckin && lastCheckin.pump
      ? '<p class="po-rx-reason" style="opacity:0.7;font-size:11px;">Pump last time: ' + lastCheckin.pump + '</p>'
      : '';
    wrap.innerHTML = '<div class="po-rx-card po-rx-' + rx.type + ' po-rx-tappable" ' + tapAttrs + '><div class="po-rx-label">' + escape(ex.name) + '</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag ' + rx.type + '">' + rx.tag + '</span><p class="po-rx-reason">' + rx.reason + ' Tap to log it.</p>' + pumpNote + '</div>';
```

- [ ] **Step 9: Verify the full flow in browser**

Reload `http://localhost:5555/gym.html`. Log a set for any exercise, switch to the Today's Workout view, tap "Mark workout done." Confirm the check-in modal appears (in addition to the existing debrief). Tap Low/Med/High for pain, recovery, and pump, then tap Save. Confirm no console errors. Run in console: `state.checkins[wtDateKey(new Date())]` — expected: an object with the three selections. Reload, go back to the Log tab for the exercise you logged, confirm the Rx card now shows a "Pump last time" note if pump was selected. Tap "Mark workout done" again (to toggle it off, then on again) and tap "Skip" in the check-in modal this time — confirm no error and no check-in overwritten.

- [ ] **Step 10: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "feat(gym): adaptive pain/recovery check-in, overrides getRx()"
```

---

## Post-implementation

Update `C:\Users\gregm\.claude\projects\G--My-Drive-Claude\memory\project-row-dashboard.md` with a dated entry summarizing what shipped (mirrors how the 2026-06-28 and 2026-07-25 gym.html changes are already documented there) — not part of this plan's tasks since it's a memory update, not code, but flag it in the completion report.
