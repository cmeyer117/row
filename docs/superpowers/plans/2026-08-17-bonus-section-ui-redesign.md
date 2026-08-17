# Bonus Section UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Bonus-mode filter row in gym.html so template pills don't clip, and give "Manage" a distinct, always-reachable affordance.

**Architecture:** Pure CSS + a small markup/JS change confined to `renderFilters()` and its surrounding CSS in `gym.html`. Bonus template pills move from the equal-flex `.po-seg-control` into a new horizontally-scrollable chip strip; `⚙ Manage` becomes a fixed icon button outside that strip. Day mode is untouched.

**Tech Stack:** Vanilla HTML/CSS/JS (single-file app, no build step).

---

### Task 1: Add chip-strip and manage-icon CSS

**Files:**
- Modify: `C:\Users\gregm\row\gym.html` — CSS block near `.po-seg-btn` (~line 328-353) and the mobile breakpoint (~line 1103-1109)

- [ ] **Step 1: Add the new CSS rules**

Insert after the existing `#bonusModeToggle` rule (after line 348, before `.po-seg-btn.active`):

```css
/* ----- Bonus template chip strip (horizontally scrollable, unbounded
   count/length — unlike day pills, template names are user-typed and the
   list can grow, so equal-flex squeeze/ellipsis breaks down here) ----- */
.po-bonus-chip-row {
  display: flex; flex: 1; overflow-x: auto; gap: 6px;
  scrollbar-width: none; -ms-overflow-style: none;
  background: rgba(110,231,183,0.05);
  border: 1px solid var(--border);
  border-left: 2px solid rgba(110,231,183,0.5);
  border-radius: 12px; padding: 4px 4px 4px 8px;
}
.po-bonus-chip-row::-webkit-scrollbar { display: none; }
.po-bonus-chip-row .po-seg-btn {
  flex: 0 0 auto; white-space: nowrap;
}
#manageBonusIconBtn {
  flex: none; width: 42px; height: 42px; min-width: 42px;
  display: flex; align-items: center; justify-content: center;
  padding: 0; margin-left: 6px; font-size: 16px;
}
```

- [ ] **Step 2: Exclude the chip row from the mobile-breakpoint ellipsis rule**

Read the mobile breakpoint block at ~line 1103-1109. It currently applies `min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap` to all `.po-seg-btn`. That's fine to keep as-is (harmless on chips since they're no longer squeezed — `flex:0 0 auto` means `min-width:0` never triggers), so no change needed here. Just re-read the rendered result after Task 2 to confirm no unwanted truncation on chips.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "style: add scrollable bonus-chip-row and manage-icon CSS"
```

---

### Task 2: Move Manage out of the pill list, wire up the icon button

**Files:**
- Modify: `C:\Users\gregm\row\gym.html:2738-2740` (markup) and `:3784-3802` (`renderFilters()`)

- [ ] **Step 1: Update the filter-row markup**

Current (line 2738-2740):

```html
        <div class="po-seg-control" id="daySeg"></div>
        <button class="po-seg-btn" id="bonusModeToggle" type="button">Bonus</button>
```

Replace with:

```html
        <div class="po-seg-control" id="daySeg"></div>
        <button class="po-icon-btn" id="manageBonusIconBtn" type="button" title="Manage bonus workouts" aria-label="Manage bonus workouts" style="display:none">⚙</button>
        <button class="po-seg-btn" id="bonusModeToggle" type="button">Bonus</button>
```

(`manageBonusIconBtn` starts hidden; `renderFilters()` shows it only in Bonus mode, and it needs to sit outside `#daySeg` since `#daySeg`'s `innerHTML` gets fully replaced on every render.)

- [ ] **Step 2: Update `renderFilters()` to render bonus pills into a chip strip and drop the inline Manage pill**

Current bonus branch (line 3789-3802):

```javascript
    if (state.viewMode === 'bonus') {
      $('daySegLabel').textContent = 'Bonus';
      $('daySeg').innerHTML = state.bonusTemplates.map(t =>
        '<button class="po-seg-btn ' + (t.id === state.filterBonusTemplateId ? 'active' : '') + '" data-bonus-template="' + t.id + '">' + escape(t.name) + '</button>'
      ).join('') + '<button class="po-seg-btn" id="manageBonusBtn" type="button">⚙ Manage</button>';
      $('daySeg').querySelectorAll('[data-bonus-template]').forEach(b => {
        b.addEventListener('click', () => {
          state.filterBonusTemplateId = b.dataset.bonusTemplate;
          state.currentEx = null;
          saveState(); renderAll();
        });
      });
      const manageBtn = document.getElementById('manageBonusBtn');
      if (manageBtn) manageBtn.addEventListener('click', openManageBonusModal);
    } else {
```

Replace with:

```javascript
    if (state.viewMode === 'bonus') {
      $('daySegLabel').textContent = 'Bonus';
      $('daySeg').className = 'po-bonus-chip-row';
      $('daySeg').innerHTML = state.bonusTemplates.map(t =>
        '<button class="po-seg-btn ' + (t.id === state.filterBonusTemplateId ? 'active' : '') + '" data-bonus-template="' + t.id + '">' + escape(t.name) + '</button>'
      ).join('');
      $('daySeg').querySelectorAll('[data-bonus-template]').forEach(b => {
        b.addEventListener('click', () => {
          state.filterBonusTemplateId = b.dataset.bonusTemplate;
          state.currentEx = null;
          saveState(); renderAll();
        });
      });
      document.getElementById('manageBonusIconBtn').style.display = 'flex';
    } else {
      $('daySeg').className = 'po-seg-control';
```

Note the added `$('daySeg').className = 'po-seg-control';` as the first line of the `else` branch — `#daySeg` starts with `po-seg-control` in the HTML (line 2738), but since the bonus branch now overwrites `className` to `po-bonus-chip-row`, switching back to Day mode must restore it explicitly.

- [ ] **Step 3: Hide the icon button in Day mode**

In the same `else` branch, immediately after the line just added, keep the existing Day-mode body unchanged, but add one line to hide the icon button. Full `else` branch becomes:

```javascript
    } else {
      $('daySeg').className = 'po-seg-control';
      document.getElementById('manageBonusIconBtn').style.display = 'none';
      $('daySegLabel').textContent = 'Day';
      $('daySeg').innerHTML = state.days.map(d =>
        '<button class="po-seg-btn ' + (d.id === state.filterDay ? 'active' : '') + '" data-day="' + d.id + '">' + escape(d.name) + '</button>'
      ).join('');
      $('daySeg').querySelectorAll('.po-seg-btn').forEach(b => {
        b.addEventListener('click', () => {
          state.filterDay = b.dataset.day;
          state.currentEx = null;
          state._userPickedDay = true;
          state._userPickedDayKey = getActiveDate();
          saveState(); renderAll();
        });
      });
    }
```

- [ ] **Step 4: Wire the new icon button's click handler once, outside `renderFilters()`**

Find the existing one-time listener registration for `#bonusModeToggle` (line 3825-3829):

```javascript
  $('bonusModeToggle').addEventListener('click', function() {
    state.viewMode = state.viewMode === 'bonus' ? 'plan' : 'bonus';
    state.currentEx = null;
    saveState(); renderAll();
  });
```

Add immediately after it:

```javascript
  $('manageBonusIconBtn').addEventListener('click', openManageBonusModal);
```

(`openManageBonusModal` is defined just below this point in the file — safe to reference here since this line only registers a callback, it doesn't call the function immediately.)

- [ ] **Step 5: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "feat(gym): move Manage out of bonus pill row into a fixed icon button"
```

---

### Task 3: Verify live in browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server if not already running**

Use the Claude_Browser preview tool with the `row` launch config (port 5555), or confirm it's already running from the design phase.

- [ ] **Step 2: Load gym.html at mobile width (375x812) and switch to Bonus mode**

Navigate to `http://localhost:5555/gym.html`, resize to the `mobile` preset, click `#bonusModeToggle` if not already in Bonus mode.

- [ ] **Step 3: Verify no chip overflow via computed layout**

Run in the page:

```javascript
(function(){
  const chips = [...document.querySelectorAll('#daySeg .po-seg-btn')];
  const overflow = chips.filter(c => c.scrollWidth > c.getBoundingClientRect().width);
  return JSON.stringify({chipCount: chips.length, overflowingCount: overflow.length, rowClass: document.getElementById('daySeg').className});
})()
```

Expected: `overflowingCount: 0`, `rowClass: "po-bonus-chip-row"`.

- [ ] **Step 4: Verify Manage icon button is visible, correctly placed, and functional**

```javascript
(function(){
  const btn = document.getElementById('manageBonusIconBtn');
  const r = btn.getBoundingClientRect();
  return JSON.stringify({visible: getComputedStyle(btn).display !== 'none', w: Math.round(r.width), h: Math.round(r.height)});
})()
```

Expected: `visible: true`, roughly `w: 42, h: 42`.

Click it (`computer` tool or `element.click()` via javascript_tool) and confirm `#manageBonusModal` gains the `show` class:

```javascript
document.getElementById('manageBonusIconBtn').click();
document.getElementById('manageBonusModal').classList.contains('show')
```

Expected: `true`. Then close the modal (`#manageBonusClose`) to reset state.

- [ ] **Step 5: Verify Day mode is unaffected (regression check)**

Click `#bonusModeToggle` again to return to Day mode, then re-run the Step 3 overflow check and confirm:

```javascript
document.getElementById('daySeg').className
document.getElementById('manageBonusIconBtn').style.display
```

Expected: `"po-seg-control"` and `"none"`.

- [ ] **Step 6: No commit needed for this task** — verification only. If any check fails, fix the relevant code in Task 1 or 2 and re-verify before proceeding.

---

### Task 4: Update HANDOFF.md

**Files:**
- Modify: `G:\My Drive\Claude\HANDOFF.md` (Edit only — never full-file Write, per project convention)

- [ ] **Step 1: Replace the "Bonus Workout Templates shipped" Active Focus entry**

Find the existing entry (added in commit `7af52d88`) referencing the layout bug and "UI audit queued." Update it to note the redesign is complete: chip-strip + icon-button fix shipped, spec at `docs/superpowers/specs/2026-08-17-bonus-section-ui-redesign-design.md`, verified live in browser (no chip overflow, Day mode unaffected).

- [ ] **Step 2: Commit and push**

```bash
cd "G:\My Drive\Claude"
git add HANDOFF.md
git commit -m "docs: Bonus section UI redesign shipped"
git push
```
