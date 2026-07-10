# gym.html Visual Rehaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `gym.html`'s visual language in line with `index.html`'s glass/glow tile design (already shipped), and add a read-only week-strip widget showing rotation status per day, without touching any exercise data, logging logic, or sync logic.

**Architecture:** Two independent layers on one file (`gym.html`, all inline `<style>`/`<script>`, single page). Layer 1 is a mechanical CSS background swap plus targeted border/glow additions on the handful of most-visible cards. Layer 2 is one new render function (`renderWeekStrip`) called from the existing `renderAll()`, reading exclusively from state that already exists (`state.splitRotation`, `state.splitAnchor`, `state.exercises`, `logsByDay()`, `doneDays`).

**Tech Stack:** Plain HTML/CSS/JS, no build step, no framework. Branch: `gym-rehaul` (already created, based off `main` at commit `686e0e4`).

---

### Task 1: Glass-card background swap (mechanical, all cards)

**Files:**
- Modify: `gym.html` (15 occurrences of one exact CSS line)

The literal line `background: rgba(255,255,255,0.025);` appears exactly 15 times in `gym.html`, each inside a card-like rule (`.po-no-ex`, `.po-last-set`, `.po-rx-card`, `.po-stat-box`, `.po-warmup-item`, `.po-set-row`, `.po-add-row-btn`, a grid-row rule near line 894, `.po-tw-row`, `.po-tw-past-day`, `.wt-comp`, a row rule near line 1544, `.wt-hist-toggle`, a rule near line 1728, a rule near line 1802). Confirmed via `grep -c` — no non-card usage of this exact line exists in the file, so a global replace is safe here (this is NOT true of the border line — see Task 2).

- [ ] **Step 1: Confirm current count**

Run: `grep -c "background: rgba(255,255,255,0.025);" gym.html`
Expected: `15`

- [ ] **Step 2: Replace every occurrence with the glass gradient**

Using the Edit tool with `replace_all: true`:

```
old_string: "background: rgba(255,255,255,0.025);"
new_string: "background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);"
```

- [ ] **Step 3: Verify the swap landed everywhere and nothing else changed**

Run: `grep -c "background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);" gym.html`
Expected: `15`

Run: `git diff --stat gym.html`
Expected: only `gym.html` listed, insertions == deletions == 15 (a pure 1:1 line swap).

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "style(gym): swap flat card backgrounds for the glass gradient"
```

---

### Task 2: Mint border + glow on the 4 highest-visibility cards

**Files:**
- Modify: `gym.html:587-591` (`.po-rx-card` — the main prescription/exercise card)
- Modify: `gym.html:625-629` (`.po-stat-box` — the stat boxes under the prescription card)
- Modify: `gym.html:1107-1110` (`.po-tw-past-day` — each past-workout row)
- Modify: `gym.html:1247-1251` (`.wt-comp` — composition estimate card)

`border: 1px solid var(--border);` appears 40 times in the file (buttons, inputs, chips — not just cards), so this one is NOT a safe global replace. Do these 4 by hand, each is a small 2-line change (border color + add a shadow line).

- [ ] **Step 1: `.po-rx-card`**

Find (around line 587-591):
```css
.po-rx-card {
  padding: 18px 20px; border-radius: 14px;
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid var(--border);
  position: relative;
```

Replace the border line and add a shadow line right after it:
```css
.po-rx-card {
  padding: 18px 20px; border-radius: 14px;
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid rgba(167, 243, 208, 0.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 22px 50px -30px rgba(0,0,0,.75);
  position: relative;
```

- [ ] **Step 2: `.po-stat-box`**

Find (around line 625-629):
```css
.po-stat-box {
  padding: 14px 12px;
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid var(--border);
  border-radius: 12px; text-align: center;
```

Replace with:
```css
.po-stat-box {
  padding: 14px 12px;
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid rgba(167, 243, 208, 0.10);
  border-radius: 12px; text-align: center;
```

- [ ] **Step 3: `.po-tw-past-day`**

Find (around line 1107-1110):
```css
.po-tw-past-day {
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid var(--border);
  border-radius: 10px;
```

Replace with:
```css
.po-tw-past-day {
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid rgba(167, 243, 208, 0.10);
  border-radius: 10px;
  transition: border-color 0.2s;
```

Also add, right after the existing `.po-tw-past-day:hover { background: rgba(255,255,255,0.04); }` rule (search for it — it's a few lines below):
```css
.po-tw-past-day:hover { border-color: rgba(110, 231, 183, 0.28); }
```

- [ ] **Step 4: `.wt-comp`**

Find (around line 1247-1251):
```css
.wt-comp {
  margin-top: 18px; padding: 14px 16px;
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid var(--border);
  border-radius: 12px;
```

Replace with:
```css
.wt-comp {
  margin-top: 18px; padding: 14px 16px;
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid rgba(167, 243, 208, 0.10);
  border-radius: 12px;
```

- [ ] **Step 5: Commit**

```bash
git add gym.html
git commit -m "style(gym): mint border + glow on the 4 highest-visibility cards"
```

---

### Task 3: Week strip — markup + CSS

**Files:**
- Modify: `gym.html:2151-2155` (insert new section right after the existing `#dayPill` button)
- Modify: `gym.html` `<style>` block (add new rules near the `.po-tw` rules added in the earlier checkpoint commit, i.e. near line 1000-1020)

- [ ] **Step 1: Add the markup**

Find (around line 2150-2156):
```html
<div class="po-shell">
  <button class="po-day-pill" type="button" id="dayPill" title="Tap to switch the day filter to today's split">
    <span class="po-day-date" id="dayPillDate">—</span>
    <span class="po-day-sep">·</span>
    <span class="po-day-split" id="dayPillSplit">—</span>
  </button>

  <!-- Quick Log Bar -->
```

Replace with (adds the new strip container right after the existing day pill, before the Quick Log Bar comment):
```html
<div class="po-shell">
  <button class="po-day-pill" type="button" id="dayPill" title="Tap to switch the day filter to today's split">
    <span class="po-day-date" id="dayPillDate">—</span>
    <span class="po-day-sep">·</span>
    <span class="po-day-split" id="dayPillSplit">—</span>
  </button>

  <!-- Week strip — read-only status/progress per rotation day, last 5 days
       including today. Tapping today scrolls to Today's Workout; tapping a
       past day expands it in the existing past-workouts list. No manual
       day-switching — the rotation is date-anchored (see todaySplit()) and
       letting a user tap ahead would desync it. -->
  <div class="week-strip" id="weekStrip"></div>

  <!-- Quick Log Bar -->
```

- [ ] **Step 2: Add the CSS**

Find the `.tile-spark { width: 64px; ... }`-equivalent marker in gym.html — actually find the existing `.po-tw` glass rules added in the checkpoint commit (search for `.po-tw::before`), and add the new rules directly after that block:

```css
.week-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin: 14px 0 18px;
}
.week-card {
  position: relative;
  padding: 10px 8px;
  border-radius: 12px;
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid rgba(167, 243, 208, 0.10);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.week-card:hover { border-color: rgba(110, 231, 183, 0.28); }
.week-card.is-today {
  border-color: rgba(110, 231, 183, 0.4);
  box-shadow: 0 0 24px rgba(110,231,183,0.14);
}
.week-card-name {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--text-1);
  margin-bottom: 4px;
}
.week-card-status {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 8.5px; font-weight: 700;
  letter-spacing: 0.10em;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: var(--text-3);
}
.week-card.is-today .week-card-status { background: rgba(110,231,183,0.14); color: var(--good); }
.week-card.is-done .week-card-status { background: rgba(110,231,183,0.10); color: var(--good); }
.week-card.is-rest .week-card-status { background: rgba(255,255,255,0.05); color: var(--text-4); }
.week-card-bar {
  height: 4px; border-radius: 999px;
  background: rgba(255,255,255,0.08);
  margin-top: 8px; overflow: hidden;
}
.week-card-bar-fill {
  height: 100%; border-radius: 999px;
  background: var(--good);
}
@media (max-width: 480px) {
  .week-strip { grid-template-columns: repeat(5, minmax(0,1fr)); gap: 5px; }
  .week-card { padding: 8px 4px; }
  .week-card-name { font-size: 11px; }
}
```

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "feat(gym): add week-strip markup + CSS (not yet wired to data)"
```

---

### Task 4: Week strip — render logic

**Files:**
- Modify: `gym.html:3492-3496` (add two new helper functions right after the existing `todaySplit()`/`splitLabel()` functions)
- Modify: `gym.html:3861` area (add `renderWeekStrip()` right before `renderPastWorkouts()`)
- Modify: `gym.html:3540-3553` (`renderAll()` — add one call)

- [ ] **Step 1: Add `splitForOffset()` and `splitDisplayName()` helpers**

Find (around line 3492-3496, right after `todaySplit()` and before `todayDateLabel()`):
```javascript
  function isRestName(name) { return /^rest\b/i.test(name || ''); }
  function splitLabel(name) {
```

Insert two new functions right before `isRestName`:
```javascript
  // Same rotation math as todaySplit(), parametrized by how many days ago.
  // daysAgo=0 is today. Used by the week strip to show the last 5 days.
  function splitForOffset(daysAgo) {
    try {
      const rot = state.splitRotation;
      if (!rot || !rot.length) return null;
      const [ay, am, ad] = state.splitAnchor.date.split('-').map(Number);
      const a = new Date(ay, am - 1, ad);
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      t.setDate(t.getDate() - daysAgo);
      const diffDays = Math.round((t - a) / 86400000);
      const idx = ((state.splitAnchor.index + diffDays) % rot.length + rot.length) % rot.length;
      return { name: rot[idx], index: idx, dateKey: wtDateKey(t) };
    } catch (e) {
      return null;
    }
  }
  // "legsA" -> "Legs A", "push" -> "Push", etc. Matches the lowercase ids
  // used in state.splitRotation / state.exercises[].day.
  function splitDisplayName(name) {
    if (!name) return '—';
    if (/^legs/i.test(name)) return 'Legs ' + name.slice(4).toUpperCase();
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  function isRestName(name) { return /^rest\b/i.test(name || ''); }
  function splitLabel(name) {
```

- [ ] **Step 2: Add `renderWeekStrip()`**

Find (around line 3861):
```javascript
  function renderPastWorkouts() {
```

Insert the new function right before it:
```javascript
  // Read-only week strip: last 5 rotation days (today + 4 prior), each a
  // small card with day name, status, and a per-exercise completion bar.
  // No day-switching — see the comment on #weekStrip in the markup.
  function renderWeekStrip() {
    const strip = $('weekStrip');
    if (!strip) return;
    const all = logsByDay();
    const cards = [];
    for (let i = 4; i >= 0; i--) {
      const s = splitForOffset(i);
      if (!s) continue;
      const isToday = i === 0;
      const isRest = isRestName(s.name);
      const daySets = all[s.dateKey] || [];
      const loggedIds = new Set(daySets.map(x => x.ex.id));
      const totalForDay = state.exercises.filter(e => e.day === s.name).length;
      const pct = totalForDay ? Math.min(100, Math.round((loggedIds.size / totalForDay) * 100)) : 0;
      const done = !!doneDays[s.dateKey];
      const statusText = isToday ? 'TODAY' : (isRest ? 'REST' : (done ? 'DONE' : ''));
      const statusCls = isToday ? 'is-today' : (isRest ? 'is-rest' : (done ? 'is-done' : ''));
      cards.push(
        '<div class="week-card ' + statusCls + '" data-dk="' + s.dateKey + '" data-today="' + isToday + '">'
        + '<div class="week-card-name">' + escape(splitDisplayName(s.name)) + '</div>'
        + (statusText ? '<span class="week-card-status">' + statusText + '</span>' : '')
        + (!isRest ? '<div class="week-card-bar"><div class="week-card-bar-fill" style="width:' + pct + '%"></div></div>' : '')
        + '</div>'
      );
    }
    strip.innerHTML = cards.join('');
  }

  function renderPastWorkouts() {
```

- [ ] **Step 3: Wire the click handler**

Find (around line 3913, right before the existing `$('poTwDoneBtn').addEventListener(...)` block):
```javascript
  $('poTwDoneBtn').addEventListener('click', () => {
```

Insert right before it:
```javascript
  // Today's card scrolls to the existing Today's Workout section. A past
  // day's card opens the past-workouts list (if closed) and expands that
  // specific day's row, reusing the existing expand behavior verbatim.
  $('weekStrip').addEventListener('click', (e) => {
    const card = e.target.closest('.week-card');
    if (!card || card.classList.contains('is-rest')) return;
    if (card.dataset.today === 'true') {
      $('poTw').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const dk = card.dataset.dk;
    const pastBody = $('poTwPastBody');
    const toggle = $('poTwPastToggle');
    if (pastBody.style.display === 'none') toggle.click();
    requestAnimationFrame(() => {
      const row = pastBody.querySelector('.po-tw-past-day[data-dk="' + dk + '"]');
      if (row) {
        row.classList.add('expanded');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  $('poTwDoneBtn').addEventListener('click', () => {
```

- [ ] **Step 4: Call it from `renderAll()`**

Find (around line 3540-3553):
```javascript
  function renderAll() {
    renderWorkoutList();
    // Show undo only if current exercise has sets logged today
    const undoBtn = $('undoBtn');
    if (undoBtn) {
      const ex = getCurrentEx();
      undoBtn.style.display = (ex && getTodaySets(ex.id).length > 0) ? 'block' : 'none';
    }
    renderDayPill();
    renderFilters(); renderSelect(); renderForm(); renderLastSet();
    renderRepsRow();
    renderRx(); renderStats(); renderSparkline(); renderHistory();
    renderTodaysWorkout();
    renderPastWorkouts();
```

Replace with (adds one call, right after `renderDayPill()`):
```javascript
  function renderAll() {
    renderWorkoutList();
    // Show undo only if current exercise has sets logged today
    const undoBtn = $('undoBtn');
    if (undoBtn) {
      const ex = getCurrentEx();
      undoBtn.style.display = (ex && getTodaySets(ex.id).length > 0) ? 'block' : 'none';
    }
    renderDayPill();
    renderWeekStrip();
    renderFilters(); renderSelect(); renderForm(); renderLastSet();
    renderRepsRow();
    renderRx(); renderStats(); renderSparkline(); renderHistory();
    renderTodaysWorkout();
    renderPastWorkouts();
```

- [ ] **Step 5: Commit**

```bash
git add gym.html
git commit -m "feat(gym): wire up renderWeekStrip() — read-only rotation status/progress"
```

---

### Task 5: Manual verification in the browser preview

**Files:** none (verification only)

- [ ] **Step 1: Start the preview server**

Use the `row` launch config already in `.claude/launch.json` (project: `npx serve -l 5555 C:/Users/gregm/row`), pointed at `gym.html`.

- [ ] **Step 2: Seed test data and load the page**

In the browser console (via eval), seed a few days of logs so the week strip has non-empty cards to show, then navigate to `gym.html`. Confirm no console errors (`preview_console_logs`, level `error`).

- [ ] **Step 3: Check the week strip renders 5 cards with real rotation names**

Via eval: `document.getElementById('weekStrip').children.length` should be `5`. Check `.week-card-name` text content matches real rotation entries (e.g. "Push", "Pull", "Legs A", "Rest", "Upper") — not literal `push`/`legsA`.

- [ ] **Step 4: Check today's card is highlighted and clicking it scrolls**

Via eval: confirm exactly one `.week-card.is-today` exists. Click it (via `preview_click` or dispatching a click in eval) and confirm `#poTw` is in view (`getBoundingClientRect().top` near 0 after scroll).

- [ ] **Step 5: Check a past day expands the past-workouts list**

Click a non-today, non-rest card with logged data seeded in. Confirm `#poTwPastBody` is no longer `display:none` and the matching `.po-tw-past-day[data-dk="..."]` has class `expanded`.

- [ ] **Step 6: Confirm the reskinned cards look right**

Via `preview_inspect` on `.po-rx-card`, `.wt-comp`, `.po-tw-past-day`: confirm `background-image` is the glass gradient and `border-color` is the mint-tinted rgba, matching Task 1/2.

- [ ] **Step 7: Stop the preview server**

No commit needed for this task — verification only. If any check fails, fix inline and re-run the specific failing step before moving on.

---

### Task 6: Push and open a PR (does not merge)

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push origin gym-rehaul
```

- [ ] **Step 2: Open a PR against `main` for Carl to review at his own pace**

```bash
gh pr create --title "gym.html visual rehaul: glass cards + week strip" --body "$(cat <<'EOF'
## Summary
- Reskins gym.html's cards to the same glass/glow language as index.html (mechanical background swap + targeted border/glow on the 4 most-visible cards).
- Adds a read-only week strip above Today's Workout: last 5 rotation days, real day names, status (today/done/rest), and a per-exercise completion bar. No day-switching, no new storage, no schema change.

## Test plan
- [ ] Load gym.html, confirm the week strip shows 5 real day names
- [ ] Confirm today's card is glowing/highlighted and scrolls to Today's Workout on tap
- [ ] Confirm a past day expands in the past-workouts list on tap
- [ ] Confirm no console errors
- [ ] Visual check against index.html's glass card look
EOF
)"
```

Do NOT merge — Carl reviews on his own time. `main` stays untouched at `686e0e4` regardless of what happens on this branch.
