# Progress Card Graph Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a Progress-tab exercise card opens an expanded modal (bigger chart + full session history) instead of jumping to the Log tab; that jump-to-Log action moves to a small icon button on the card.

**Architecture:** Reuse the existing `.sub-modal-bg`/`.sub-modal` bottom-sheet CSS pattern with a new container (`progModalBg`/`progModal`). One new render function (`renderProgressModal(exId)`) recomputes full session history for that exercise from `state.logs`/`state.exercises` (same grouping logic `renderProgress()` already uses, just not sliced to last 10). The existing `.prog-card` click listener is replaced: the whole-card click now opens the modal, a new icon button does what the old click did.

**Tech Stack:** Plain HTML/CSS/JS in `gym.html`, no build step, no framework.

---

### Task 1: Modal markup + CSS

**Files:**
- Modify: `gym.html:2608-2621` (insert new modal markup right after the existing `subModalBg` block, before `<!-- PROGRESS VIEW -->`)
- Modify: `gym.html` `<style>` block (add new rules right after the existing `.sub-modal-actions` rule, ~line 1889)

- [ ] **Step 1: Add the modal markup**

Find (around line 2608-2622):
```html
  <!-- SUBSTITUTION PICKER MODAL -->
  <div class="sub-modal-bg" id="subModalBg">
    <div class="sub-modal">
      <div class="sub-modal-title" id="subModalTitle">Choose variation</div>
      <div id="subModalOptions"></div>
      <div class="sub-modal-actions">
        <button class="sub-set-default" id="subSetDefault">Set as default</button>
        <button class="sub-cancel" id="subCancel">Cancel</button>
      </div>
    </div>
  </div>

  <!-- PROGRESS VIEW -->
```

Replace with (adds the new modal right after, before Progress View):
```html
  <!-- SUBSTITUTION PICKER MODAL -->
  <div class="sub-modal-bg" id="subModalBg">
    <div class="sub-modal">
      <div class="sub-modal-title" id="subModalTitle">Choose variation</div>
      <div id="subModalOptions"></div>
      <div class="sub-modal-actions">
        <button class="sub-set-default" id="subSetDefault">Set as default</button>
        <button class="sub-cancel" id="subCancel">Cancel</button>
      </div>
    </div>
  </div>

  <!-- PROGRESS CARD EXPANDED-GRAPH MODAL -->
  <div class="sub-modal-bg" id="progModalBg">
    <div class="sub-modal">
      <div class="sub-modal-title" id="progModalTitle">Exercise</div>
      <div id="progModalChart"></div>
      <div id="progModalSessions"></div>
      <div class="sub-modal-actions">
        <button class="sub-cancel" id="progModalClose">Close</button>
      </div>
    </div>
  </div>

  <!-- PROGRESS VIEW -->
```

- [ ] **Step 2: Add the CSS**

Find (around line 1886-1889):
```css
.sub-modal-actions {
  display: flex; gap: 8px; margin-top: 14px;
}
```

Add new rules right after that block (search for the end of the `.sub-set-default`/`.sub-cancel` rules that follow it, and add after them):
```css
#progModalChart {
  margin-bottom: 16px;
}
#progModalChart svg {
  width: 100%; height: 120px; display: block;
}
#progModalSessions {
  display: flex; flex-direction: column; gap: 8px;
  max-height: 40vh; overflow-y: auto;
}
.prog-modal-session {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 10px 12px;
}
.prog-modal-session-date {
  font-family: var(--font-mono); font-size: 11px; color: var(--text-3);
  margin-bottom: 6px;
}
.prog-modal-session-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
}
```

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "feat(gym): add progress-card expanded-graph modal markup + CSS (not yet wired)"
```

---

### Task 2: Render + open/close logic

**Files:**
- Modify: `gym.html:3813-3827` (replace the existing `.prog-card` click handler)
- Modify: `gym.html:3796-3810` (add the log-icon button to the card markup)
- Modify: `gym.html` (add `renderProgressModal()` near `renderProgress()`, and open/close wiring near the existing `subModalBg` outside-click handler at line 4143)

- [ ] **Step 1: Add the log-icon button to the card markup**

Find (around line 3796-3800):
```javascript
      return '<div class="prog-card" data-exid="' + ex.id + '">'
        + '<div class="prog-card-top">'
        +   '<div class="prog-card-name">' + escape(ex.name) + '</div>'
        +   (dayName ? '<div class="prog-card-badge">' + escape(dayName) + '</div>' : '')
        + '</div>'
```

Replace with (adds a log button next to the day badge):
```javascript
      return '<div class="prog-card" data-exid="' + ex.id + '">'
        + '<div class="prog-card-top">'
        +   '<div class="prog-card-name">' + escape(ex.name) + '</div>'
        +   '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">'
        +     (dayName ? '<div class="prog-card-badge">' + escape(dayName) + '</div>' : '')
        +     '<button type="button" class="prog-card-log-btn" data-exid="' + ex.id + '" aria-label="Log a set" title="Log a set" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);border-radius:8px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:var(--text-2);cursor:pointer;">'
        +       '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'
        +     '</button>'
        +   '</div>'
        + '</div>'
```

- [ ] **Step 2: Replace the click handler**

Find (around line 3813-3827):
```javascript
    // Tap card → switch to log tab and select that exercise
    listEl.querySelectorAll('.prog-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var exId = card.dataset.exid;
        state.currentEx = exId;
        // Switch to log tab
        switchTab('log');
        saveState(); renderAll();
        // Scroll to top of form
        setTimeout(function() {
          var el = $('logFormWrap');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      });
    });
  }
```

Replace with (log button keeps the old behavior; the rest of the card opens the modal):
```javascript
    // Log button → switch to log tab and select that exercise (old card-tap behavior)
    listEl.querySelectorAll('.prog-card-log-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var exId = btn.dataset.exid;
        state.currentEx = exId;
        switchTab('log');
        saveState(); renderAll();
        setTimeout(function() {
          var el = $('logFormWrap');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      });
    });
    // Tap anywhere else on the card → open the expanded graph modal
    listEl.querySelectorAll('.prog-card').forEach(function(card) {
      card.addEventListener('click', function() {
        renderProgressModal(card.dataset.exid);
      });
    });
  }
```

- [ ] **Step 3: Add `renderProgressModal()`**

Find (around line 3829, right after the closing `}` of `renderProgress()`):
```javascript
  // ============================================================
```

Insert the new function right before that comment block (i.e. directly after `renderProgress()`'s closing brace):
```javascript
  function renderProgressModal(exId) {
    var ex = (state.exercises || []).find(function(e) { return e.id === exId; });
    if (!ex) return;
    var logs = (state.logs[exId] || []).slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
    if (!logs.length) return;

    var sessions = {};
    logs.forEach(function(l) {
      var dk = l.date.slice(0, 10);
      if (!sessions[dk]) sessions[dk] = [];
      sessions[dk].push(l);
    });
    var sessionKeys = Object.keys(sessions).sort();

    var prLog = logs.reduce(function(best, l) {
      return (l.weight || 0) > (best.weight || 0) ? l : best;
    }, logs[0]);
    var prStr = ex.bw
      ? (Math.max.apply(null, logs.map(function(l) { return l.reps; }))) + ' reps'
      : (prLog.plates != null
          ? prLog.plates + 'p' + (prLog.extraLbs ? '+' + prLog.extraLbs : '') + ' × ' + prLog.reps
          : (prLog.weight || 0) + unit() + ' × ' + prLog.reps);

    $('progModalTitle').textContent = ex.name + ' — PR ' + prStr;

    // Bigger chart: same buildSparkPath helper, full history (not sliced to last 10)
    var sessionTops = sessionKeys.map(function(dk) {
      return Math.max.apply(null, sessions[dk].map(function(l) { return l.weight || 0; }));
    });
    var chartEl = $('progModalChart');
    if (sessionTops.length >= 2) {
      var path = buildSparkPath(sessionTops, 600, 120);
      chartEl.innerHTML = '<svg viewBox="0 0 600 120" preserveAspectRatio="none">'
        + '<path d="' + path + '" stroke="#6ee7b7" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        + '</svg>';
    } else {
      chartEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-4);">Need 2+ sessions for a trend line.</div>';
    }

    // Full session list, newest first — same per-set chip format renderPastWorkouts() uses
    var u = unit();
    var rows = sessionKeys.slice().reverse().map(function(dk) {
      var chips = sessions[dk].map(function(l) {
        var label;
        if (ex.bw) label = l.reps + ' reps';
        else if (l.plates != null) label = l.plates + 'p' + (l.extraLbs ? '+' + l.extraLbs : '') + '×' + l.reps;
        else label = l.weight + u + '×' + l.reps;
        return '<span class="po-tw-past-set-chip">' + escape(label) + '</span>';
      }).join('');
      return '<div class="prog-modal-session">'
        + '<div class="prog-modal-session-date">' + fmtPastDate(dk) + '</div>'
        + '<div class="prog-modal-session-chips">' + chips + '</div>'
        + '</div>';
    }).join('');
    $('progModalSessions').innerHTML = rows;

    $('progModalBg').classList.add('show');
  }
```

- [ ] **Step 4: Wire close behavior**

Find (around line 4143-4144, the existing sub-modal outside-click handler):
```javascript
  document.getElementById('subModalBg').addEventListener('click', e => {
    if (e.target === document.getElementById('subModalBg')) closeSubPicker();
```

Insert right after that block's closing (find where it ends with its closing `});` and add these two new listeners immediately after):
```javascript
  document.getElementById('progModalBg').addEventListener('click', e => {
    if (e.target === document.getElementById('progModalBg')) {
      document.getElementById('progModalBg').classList.remove('show');
    }
  });
  document.getElementById('progModalClose').addEventListener('click', () => {
    document.getElementById('progModalBg').classList.remove('show');
  });
```

- [ ] **Step 5: Commit**

```bash
git add gym.html
git commit -m "feat(gym): wire up progress-card expanded-graph modal"
```

---

### Task 3: Manual verification in the browser preview

**Files:** none (verification only)

- [ ] **Step 1: Start the preview server**

Use the `row` launch config (`npx serve -l 5555 C:/Users/gregm/row`) already registered in `.claude/launch.json`.

- [ ] **Step 2: Load gym.html, switch to Progress tab, confirm no console errors**

Navigate, click the Progress tab button (`#gymTabProgress`), check `preview_console_logs`/`read_console_messages` for errors.

- [ ] **Step 3: Confirm tapping a card (not the log button) opens the modal**

Via `read_page`/`find` or `javascript_tool` eval: click a `.prog-card` (not the `.prog-card-log-btn`), confirm `#progModalBg` gains class `show`, `#progModalTitle` shows the exercise name + PR, `#progModalSessions` has at least one `.prog-modal-session` row.

- [ ] **Step 4: Confirm the log-icon button still does the old behavior**

Click `.prog-card-log-btn` on a card, confirm it does NOT open the modal (event propagation stopped), and instead switches to the Log tab with that exercise selected (`state.currentEx` matches, `#gymTabLog` has class `active`).

- [ ] **Step 5: Confirm close behavior**

Click `#progModalClose`, confirm `#progModalBg` loses class `show`. Reopen, click on `#progModalBg` itself (outside the sheet), confirm it also closes.

- [ ] **Step 6: Stop the preview server**

No commit needed — verification only. Fix inline and re-run the specific failing step if anything fails.

---

### Task 4: Push (no PR needed — already on `main`, small enough for a direct push)

**Files:** none

- [ ] **Step 1: Push directly to `main`**

```bash
git push origin main
```

This work was done directly on `main` (not a feature branch) since it's small and additive — matches how the two prior specs' checkpoint commits were pushed once verified. If a review pass is wanted first, run `/code-review` before this step.
