# Morning Readiness Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a readiness card at the top of gym.html showing today's sleep (with an inline quick-add if not yet logged) and the last post-workout checkin's recovery/pain/pump, so both signals are visible in one glance before training — no new data system, no change to `getRx()`'s mechanism.

**Architecture:** One new `<div class="card" id="readinessCard">` inserted above the existing filters card, populated by a new `renderReadinessCard()` function called from `renderAll()` and after every checkin save. Sleep quick-add writes to the existing `health:sleep` localStorage key via a small local `getSleepList`/`setSleepList`/`upsertSleepByDate` trio (mirroring health.html's own `upsertByDate`). Cross-device sync for that write is handled by a second `initCloudSync` registration in gym.html using the identical key list health.html already syncs, to avoid a partial-blob overwrite.

**Tech Stack:** Plain inline JS in gym.html (no build step, no framework), existing `sync.js` cloud-sync helper, existing `gym-sleep-check-logic.js` for the poor-sleep threshold.

**Spec:** `docs/superpowers/specs/2026-08-19-morning-readiness-card-design.md`

---

### Task 1: Card markup + core render (sleep display + last checkin + combined tag)

**Files:**
- Modify: `gym.html`

- [ ] **Step 1: Insert the card markup**

Find this block (gym.html:2744-2751):

```html
  <div class="po-header">
    <h1 class="po-title" id="appTitle">Progressive Overload Coach</h1>
    <button class="po-icon-btn" id="settingsBtn" title="Settings" aria-label="Settings">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>
  </div>

  <div class="card">
```

Insert a new card between them (right after the closing `</div>` of `.po-header`, right before `<div class="card">`):

```html
  <div class="po-header">
    <h1 class="po-title" id="appTitle">Progressive Overload Coach</h1>
    <button class="po-icon-btn" id="settingsBtn" title="Settings" aria-label="Settings">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>
  </div>

  <div class="card" id="readinessCard"></div>

  <div class="card">
```

- [ ] **Step 2: Add `renderReadinessCard()`**

Add this function near `renderRx()` (gym.html:4250), right before it:

```js
  // Reads two signals that already exist (health:sleep, state.checkins) and
  // shows them together before training -- no new data system, no change to
  // getRx()/applyCheckinOverride()'s mechanism (they keep reacting to the
  // last post-workout checkin exactly as before). See
  // docs/superpowers/specs/2026-08-19-morning-readiness-card-design.md.
  function lastCheckinEntry() {
    const dates = Object.keys(state.checkins);
    if (!dates.length) return null;
    return state.checkins[dates.sort().pop()];
  }
  function renderReadinessCard() {
    const wrap = $('readinessCard');
    if (!wrap) return;
    const todaySleep = getSleepEntryForDate(wtDateKey(new Date()));
    const checkin = lastCheckinEntry();

    let sleepLine;
    if (todaySleep) {
      const parts = [];
      if (typeof todaySleep.hours === 'number') parts.push(todaySleep.hours + 'h');
      if (typeof todaySleep.quality === 'number') parts.push('quality ' + todaySleep.quality + '/5');
      sleepLine = '<div class="po-checkin-row-label">Last night: ' + (parts.join(' · ') || '—') + '</div>';
    } else {
      sleepLine = renderSleepQuickAdd();
    }

    let checkinLine;
    if (checkin) {
      const parts = [];
      if (checkin.recovery) parts.push('recovery ' + checkin.recovery);
      if (checkin.pain) parts.push('pain ' + checkin.pain);
      if (checkin.pump) parts.push('pump ' + checkin.pump);
      checkinLine = '<div class="po-checkin-row-label">Last session: ' + (parts.join(' · ') || '—') + '</div>';
    } else {
      checkinLine = '<div class="po-checkin-row-label">No checkin yet</div>';
    }

    const sleepPoor = window.GymSleepCheckLogic ? window.GymSleepCheckLogic.isPoorSleepEntry(todaySleep) : false;
    const checkinPoor = !!checkin && (checkin.recovery === 'low' || checkin.pain === 'high');
    const tag = (sleepPoor || checkinPoor) ? 'Watch it' : 'Good';

    wrap.innerHTML = '<div class="po-checkin-row-label" style="font-weight:600;margin-bottom:6px;">Readiness — ' + tag + '</div>' + sleepLine + checkinLine;
    wireSleepQuickAdd();
  }
```

- [ ] **Step 3: Stub `renderSleepQuickAdd()`/`wireSleepQuickAdd()` (real implementation in Task 2)**

Add right after `renderReadinessCard()`:

```js
  function renderSleepQuickAdd() {
    return '<div class="po-checkin-row-label">Sleep not logged yet today.</div>';
  }
  function wireSleepQuickAdd() {}
```

- [ ] **Step 4: Wire into `renderAll()`**

In the `renderAll()`-family function, find (gym.html:4524):

```js
    renderRx(); renderStats(); renderSparkline(); renderHistory();
```

Replace with:

```js
    renderReadinessCard();
    renderRx(); renderStats(); renderSparkline(); renderHistory();
```

- [ ] **Step 5: Expose `renderReadinessCard` across the script-tag boundary**

`renderReadinessCard` is defined inside the big IIFE that closes at gym.html:6923 — the hype-audio/health-sync registration block (Task 3) lives in a *separate* `<script>` tag starting at gym.html:6938 and can't see a bare `renderReadinessCard` reference (this file has hit exactly this bug before — see the `getSttPrompt` comment at gym.html:6919-6920). Find (gym.html:6919-6922):

```js
  // renderAll is called from the BOOT script below, which is now a
  // separate <script> tag (module split) and can't see this IIFE's scope.
  window.renderAll = renderAll;
})();
```

Replace with:

```js
  // renderAll is called from the BOOT script below, which is now a
  // separate <script> tag (module split) and can't see this IIFE's scope.
  // renderReadinessCard needs the same bridge -- Task 3's initCloudSync
  // onApplied callback lives in yet another later <script> tag.
  window.renderAll = renderAll;
  window.renderReadinessCard = renderReadinessCard;
})();
```

- [ ] **Step 6: Manual check — card shows on load**

Open gym.html in the browser (see Task 5 for the full verification pass). Confirm a card now appears above the Gym/Day filters showing "Readiness — Good" or "Readiness — Watch it", a sleep line, and a checkin line (or "No checkin yet" / "Sleep not logged yet today." if nothing's been recorded).

- [ ] **Step 7: Commit**

```bash
git add gym.html
git commit -m "feat(gym): morning readiness card — sleep + last checkin display"
```

---

### Task 2: Inline sleep quick-add

**Files:**
- Modify: `gym.html`

- [ ] **Step 1: Add the sleep-storage helpers**

Add near `getSleepEntryForDate` (gym.html:3634-3639), right after it:

```js
  function getSleepList() {
    try { return JSON.parse(localStorage.getItem('health:sleep') || '[]'); } catch (e) { return []; }
  }
  function setSleepList(list) {
    localStorage.setItem('health:sleep', JSON.stringify(list));
  }
  // Mirrors health.html's own upsertByDate exactly (health.html:1001-1010) --
  // duplicated rather than shared since it's 8 lines and the two pages don't
  // otherwise share a module.
  function upsertSleepByDate(list, date, fields) {
    const cleanFields = {};
    Object.keys(fields).forEach(function (k) {
      if (fields[k] !== null && fields[k] !== undefined && fields[k] !== '') cleanFields[k] = fields[k];
    });
    if (Object.keys(cleanFields).length === 0) return list;
    const existing = list.find(function (e) { return e.date === date; });
    if (existing) {
      Object.assign(existing, cleanFields);
      return list;
    }
    return list.concat([Object.assign({ date: date }, cleanFields)]);
  }
```

- [ ] **Step 2: Replace the stub `renderSleepQuickAdd()`/`wireSleepQuickAdd()` from Task 1**

Replace:

```js
  function renderSleepQuickAdd() {
    return '<div class="po-checkin-row-label">Sleep not logged yet today.</div>';
  }
  function wireSleepQuickAdd() {}
```

With:

```js
  function renderSleepQuickAdd() {
    return (
      '<div class="po-checkin-row-label">Log last night\'s sleep</div>' +
      '<div class="po-checkin-row">' +
      '<input class="po-quick-input" id="readinessSleepHours" type="number" inputmode="decimal" step="0.5" min="0" max="14" placeholder="hrs" style="max-width:70px">' +
      '<button type="button" class="po-checkin-btn" data-quality="1">1</button>' +
      '<button type="button" class="po-checkin-btn" data-quality="2">2</button>' +
      '<button type="button" class="po-checkin-btn" data-quality="3">3</button>' +
      '<button type="button" class="po-checkin-btn" data-quality="4">4</button>' +
      '<button type="button" class="po-checkin-btn" data-quality="5">5</button>' +
      '<button type="button" class="po-btn-primary" id="readinessSleepSave" style="padding:6px 14px;">Save</button>' +
      '</div>'
    );
  }
  function wireSleepQuickAdd() {
    const wrap = $('readinessCard');
    let selectedQuality = null;
    wrap.querySelectorAll('.po-checkin-btn[data-quality]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedQuality = Number(btn.dataset.quality);
        wrap.querySelectorAll('.po-checkin-btn[data-quality]').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
    });
    const saveBtn = $('readinessSleepSave');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', function () {
      const hoursInput = $('readinessSleepHours');
      const hours = hoursInput.value ? Number(hoursInput.value) : null;
      if (hours == null && selectedQuality == null) return;
      const dateKey = wtDateKey(new Date());
      setSleepList(upsertSleepByDate(getSleepList(), dateKey, { hours: hours, quality: selectedQuality }));
      renderReadinessCard();
    });
  }
```

- [ ] **Step 3: Manual check**

In the browser, with no sleep logged for today, use the card's inline form: enter hours, tap a quality button, tap Save. Confirm the card immediately switches to showing "Last night: Xh · quality Y/5" instead of the form.

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "feat(gym): inline sleep quick-add on the readiness card"
```

---

### Task 3: Cross-device sync for the sleep write

**Files:**
- Modify: `gym.html`

- [ ] **Step 1: Register a second `initCloudSync` call for the `health` app_state row**

Find gym.html's existing second sync registration (gym.html:6949-6951):

```js
  if (window.initCloudSync) {
    window.initCloudSync({ appKey: 'hype-audio', syncedKeys: ['hype_audio'] });
  }
```

Add a new registration right after it, in the same block:

```js
  if (window.initCloudSync) {
    window.initCloudSync({ appKey: 'hype-audio', syncedKeys: ['hype_audio'] });
    // Mirrors health.html's own initCloudSync call (health.html:1799-1807)
    // EXACTLY -- syncedKeys must match, not just include health:sleep. Each
    // initCloudSync instance replaces the WHOLE app_state row on push using
    // only the keys it's told to watch; a narrower list here would silently
    // drop health.html's other fields (vitals/labs/measurements/cardio/
    // stack) on this device's next push. See
    // docs/superpowers/specs/2026-08-19-morning-readiness-card-design.md.
    window.initCloudSync({
      appKey: 'health',
      syncedKeys: ['stack:items', 'stack:version', 'stack:low', 'macro_targets', 'health:vitals', 'health:labs', 'health:measurements', 'health:sleep', 'health:cardio'],
      syncedPrefixes: ['stack:taken:'],
      onApplied: window.renderReadinessCard,
    });
  }
```

- [ ] **Step 2: Manual check — cross-device sync round-trip**

This needs a real Supabase round-trip, not just local state, so verify live (also covered in Task 5's fuller pass): log a sleep entry via the readiness card's quick-add, then open health.html (same browser/device) and confirm the new entry shows up in the sleep list/chart without a manual refresh-triggering edit there.

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "fix(gym): sync readiness-card sleep writes to the health app_state row"
```

---

### Task 4: Refresh the card immediately after a checkin save

**Files:**
- Modify: `gym.html`

- [ ] **Step 1: Call `renderReadinessCard()` after both checkin-save paths**

Find (gym.html:5240-5248):

```js
    $('autopsyAskVision').addEventListener('click', function() {
      persistCheckin();
      fireDebrief();
    });
    $('checkinSave').addEventListener('click', function() {
      persistCheckin();
      bg.classList.remove('show');
      reset();
    });
```

Replace with:

```js
    $('autopsyAskVision').addEventListener('click', function() {
      persistCheckin();
      renderReadinessCard();
      fireDebrief();
    });
    $('checkinSave').addEventListener('click', function() {
      persistCheckin();
      renderReadinessCard();
      bg.classList.remove('show');
      reset();
    });
```

- [ ] **Step 2: Manual check**

Complete a workout ("Mark Done"), fill in the checkin modal (pain/recovery/pump), tap Save. Confirm the readiness card's "Last session" line updates immediately (don't need to reload the page).

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "fix(gym): readiness card refreshes immediately after a checkin save"
```

---

### Task 5: Full in-browser verification pass

**Files:** none (verification only)

- [ ] **Step 1: Start the dev preview and open gym.html**

Use the project's `run`/preview workflow to open gym.html live.

- [ ] **Step 2: Verify the "no data" state**

If today has no sleep entry and `state.checkins` has no recent entry, confirm the card reads "Readiness — Good" (no false "Watch it" from nulls), shows the sleep quick-add form, and shows "No checkin yet".

- [ ] **Step 3: Verify the sleep quick-add + sync**

Log sleep via the card (e.g. 5h, quality 2 — deliberately poor). Confirm:
- The card switches to "Last night: 5h · quality 2/5"
- The tag switches to "Readiness — Watch it" (poor-sleep threshold: hours < 6 OR quality <= 2, per `gym-sleep-check-logic.js`)
- Opening health.html (same browser) shows the same entry in its sleep list/chart

- [ ] **Step 4: Verify the checkin display + live refresh**

Log a set, tap "Mark Done", fill the checkin modal with recovery=low, pain=high, pump=med, Save. Confirm the readiness card immediately shows "Last session: recovery low · pain high · pump med" and the tag reads "Readiness — Watch it" (checkin-poor path, independent of the sleep entry).

- [ ] **Step 5: Take a screenshot for the record, then report done**

No code changes in this task — if any check in Steps 2-4 fails, go back to the relevant task, fix, re-verify from Step 1 of this task.
