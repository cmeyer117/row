# Row Evening Shutdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing 17:00 Evening Close block in `main.html` into a full Evening Shutdown panel: mover/Today review + a Win/Push/Miss verdict, rendered for every session status (completed, draft, skipped, absent), not just completed.

**Architecture:** Extend, don't fork. Two pure-logic additions to `morning-launch-logic.js` (`buildEveningShutdown`, `validateEveningClose`); `mlRender()` in `main.html` refactored to a single append path so the evening panel renders once regardless of which primary card view was built; the mover-list rendering already inside `mlBuildCompleted` is extracted into a shared `mlBuildMoverList()` helper so the evening panel can reuse it instead of duplicating it. No new storage key — `session.evening` gains `verdict`/`verdictNote`, which `vaultExportProjection` already exports for free (it exports the whole `evening` object).

**Tech Stack:** Vanilla JS, existing `morning-launch-logic.js`/`.selfcheck.cjs` pattern, no build step, no new dependencies.

---

### Task 1: Pure logic — verdict validation + shutdown projection

**Files:**
- Modify: `C:\Users\gregm\row\morning-launch-logic.js`
- Modify: `C:\Users\gregm\row\morning-launch-logic.selfcheck.cjs`

- [ ] **Step 1: Add failing assertions to the selfcheck file** (append before the final `console.log` line)

```javascript
// --- evening shutdown ---
assertEqual(L.validateEveningClose(null).ok, false, 'validateEveningClose fails on null');
assertEqual(L.validateEveningClose({}).ok, false, 'validateEveningClose fails with no verdict');
assertEqual(L.validateEveningClose({ verdict: 'nope' }).ok, false, 'validateEveningClose fails on an invalid verdict value');
assertEqual(L.validateEveningClose({ verdict: 'win' }).ok, true, 'validateEveningClose succeeds with verdict win');
assertEqual(L.validateEveningClose({ verdict: 'push' }).ok, true, 'validateEveningClose succeeds with verdict push');
assertEqual(L.validateEveningClose({ verdict: 'miss' }).ok, true, 'validateEveningClose succeeds with verdict miss');

const launchSession = { needleMovers: completeMovers, evening: null };
const launchProj = L.buildEveningShutdown(launchSession, [{ id: 'g1', text: 'unrelated today item' }]);
assertEqual(launchProj.source, 'launch', 'buildEveningShutdown uses launch movers when a session has needleMovers');
assertEqual(launchProj.movers.length, 3, 'buildEveningShutdown returns all three movers for a launch session');
assertEqual(launchProj.todayGoals.length, 0, 'buildEveningShutdown does not return todayGoals when movers exist');

const noLaunchSession = { needleMovers: [], evening: null };
const todayFallback = [{ id: 'g1', text: 'Ad-hoc task' }];
const fallbackProj = L.buildEveningShutdown(noLaunchSession, todayFallback);
assertEqual(fallbackProj.source, 'today', 'buildEveningShutdown falls back to today when there are no movers');
assertEqual(fallbackProj.movers.length, 0, 'buildEveningShutdown returns no movers in the today fallback');
assertEqual(fallbackProj.todayGoals.length, 1, 'buildEveningShutdown returns todayGoals in the fallback case');

assertEqual(L.buildEveningShutdown(L.newSession('2026-08-06'), []).source, 'today', 'a fresh (absent-day) session falls back to today with zero items, not an error');

// old records without verdict/verdictNote still export cleanly (backward compatibility)
const oldStyleSession = Object.assign({}, result.session, { evening: { moved: 'a', interference: 'b', tomorrowChange: 'c', completedAt: '2026-08-01T22:00:00.000Z' } });
const oldProjection = L.vaultExportProjection(oldStyleSession);
assertEqual(oldProjection.evening.moved, 'a', 'vault export projection still includes evening fields from an old-format record with no verdict');
assertEqual(oldProjection.evening.verdict, undefined, 'old-format evening record has no verdict field, and none is fabricated');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node C:\Users\gregm\row\morning-launch-logic.selfcheck.cjs`
Expected: `FAIL: validateEveningClose fails on null` (function doesn't exist yet — actually will throw `TypeError: L.validateEveningClose is not a function`; either failure mode confirms the test is exercising new, unimplemented code)

- [ ] **Step 3: Implement in `morning-launch-logic.js`** — add above the `var api = {` block:

```javascript
  var EVENING_VERDICTS = ['win', 'push', 'miss'];

  function validateEveningClose(evening) {
    var errors = [];
    if (!evening || EVENING_VERDICTS.indexOf(evening.verdict) === -1) {
      errors.push('A Win/Push/Miss verdict is required.');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  // Projection of what the Evening Shutdown panel shows: the day's movers
  // when a launch exists, otherwise today's Goals list as a fallback so the
  // ritual still works on skipped/no-launch days. vaultExportProjection
  // needs no separate change for verdict/verdictNote -- it already exports
  // the whole evening object, so any new fields on it ride along for free.
  function buildEveningShutdown(session, todayGoals) {
    var hasMovers = !!(session && Array.isArray(session.needleMovers) && session.needleMovers.length > 0);
    return {
      source: hasMovers ? 'launch' : 'today',
      movers: hasMovers ? session.needleMovers : [],
      todayGoals: hasMovers ? [] : (todayGoals || []),
      evening: (session && session.evening) || null
    };
  }
```

Then add both to the `api` object:

```javascript
    validateEveningClose: validateEveningClose,
    buildEveningShutdown: buildEveningShutdown
```

- [ ] **Step 4: Run to verify it passes**

Run: `node C:\Users\gregm\row\morning-launch-logic.selfcheck.cjs`
Expected: `morning-launch-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row && git add morning-launch-logic.js morning-launch-logic.selfcheck.cjs && git commit -m "feat(evening-shutdown): add verdict validation + shutdown projection logic"
```

### Task 2: Extract shared mover-list renderer

**Files:**
- Modify: `C:\Users\gregm\row\main.html`

- [ ] **Step 1: Find `mlBuildCompleted`'s inline mover-list block** (currently lines ~2095-2127: `const goalsByDateKey = mlGoalsByDateKey(); const list = el('ul', 'ml-outcome-list'); session.needleMovers.slice()...forEach(...); wrap.appendChild(list);`)

- [ ] **Step 2: Extract it into a new function placed immediately above `mlBuildCompleted`**

```javascript
  function mlBuildMoverList(session) {
    const ML = window.MorningLaunchLogic;
    const goalsByDateKey = mlGoalsByDateKey();
    const list = el('ul', 'ml-outcome-list');
    session.needleMovers.slice().sort((a, b) => a.order - b.order).forEach(m => {
      const ref = ML.resolveMoverReference(m, goalsByDateKey);
      const row = el('li', 'ml-outcome-item');
      if (ref.status === 'missing') {
        row.appendChild(el('span', 'ml-error', (m.textSnapshot || 'Needle mover') + ' — task unavailable.'));
        const recreate = el('button', 'ml-skip-btn', 'Recreate');
        recreate.type = 'button';
        recreate.addEventListener('click', () => mlRecreateMoverGoal(session, m));
        row.appendChild(recreate);
        const replaceSel = document.createElement('select');
        replaceSel.className = 'gm-input';
        const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Replace with…'; replaceSel.appendChild(blank);
        getGoals(todayKey()).forEach(g => {
          const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.text; replaceSel.appendChild(opt);
        });
        replaceSel.addEventListener('change', () => {
          if (!replaceSel.value) return;
          const g = getGoals(todayKey()).find(x => x.id === replaceSel.value);
          if (g) mlReplaceMoverGoal(session, m, g);
        });
        row.appendChild(replaceSel);
      } else {
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = !!ref.goal.done;
        cb.addEventListener('change', () => mlToggleMoverDone(session, m, cb.checked));
        row.appendChild(cb);
        row.appendChild(el('span', null, (m.textSnapshot || ref.goal.text) + (m.id === session.winMoverId ? ' ★' : '')));
      }
      list.appendChild(row);
    });
    return list;
  }
```

- [ ] **Step 3: Replace the extracted block in `mlBuildCompleted` with a single call**

Replace:
```javascript
    const goalsByDateKey = mlGoalsByDateKey();
    const list = el('ul', 'ml-outcome-list');
    session.needleMovers.slice().sort((a, b) => a.order - b.order).forEach(m => {
      /* ...entire block... */
    });
    wrap.appendChild(list);
```
With:
```javascript
    wrap.appendChild(mlBuildMoverList(session));
```

- [ ] **Step 4: Manual check** — open `main.html` in the browser (see Task 5), navigate to a day with a completed Morning Launch, confirm the movers list still renders and checkboxes still toggle Today items. (No automated test for this step — pure DOM refactor with no logic change; Task 5's browser pass covers it.)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row && git add main.html && git commit -m "refactor(evening-shutdown): extract mlBuildMoverList from mlBuildCompleted"
```

### Task 3: Rewrite the evening panel + verdict CSS

**Files:**
- Modify: `C:\Users\gregm\row\main.html`

- [ ] **Step 1: Add verdict pill CSS** — near line 631, after `.ml-evening { ... }`:

```css
.ml-verdict-row { display: flex; gap: 8px; margin: 10px 0; }
.ml-verdict-btn { flex: 1; background: transparent; border: 1px solid rgba(255,255,255,0.14); color: var(--text-secondary); border-radius: 10px; padding: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
.ml-verdict-btn.active { background: rgba(110,231,183,0.14); border-color: rgba(110,231,183,0.4); color: var(--accent); }
```

- [ ] **Step 2: Replace `mlBuildEvening` in full** (currently the `mlEveningDue`/`mlBuildEvening` pair around line 2150-2174):

```javascript
  function mlEveningDue() { return new Date().getHours() >= 17; }

  function mlBuildEvening(session) {
    if (!mlEveningDue()) return null;
    const ML = window.MorningLaunchLogic;
    const proj = ML.buildEveningShutdown(session, getGoals(todayKey()));
    const wrap = el('div', 'ml-evening');
    wrap.appendChild(el('div', 'ml-phase-title', 'Evening Shutdown'));

    if (proj.source === 'launch') {
      wrap.appendChild(mlBuildMoverList(session));
    } else if (proj.todayGoals.length) {
      const list = el('ul', 'ml-outcome-list');
      proj.todayGoals.forEach((g, i) => list.appendChild(buildGoalRow(g, i, todayKey(), false, () => { loadToday(); mlRender(); })));
      wrap.appendChild(list);
    } else {
      wrap.appendChild(el('div', 'ml-sub', 'No tasks logged today.'));
    }

    const evening = session.evening;
    if (evening && evening.completedAt) {
      const verdictLabel = evening.verdict ? evening.verdict.toUpperCase() : '—';
      wrap.appendChild(el('div', 'ml-sub', 'Verdict: ' + verdictLabel + (evening.verdictNote ? ' — ' + evening.verdictNote : '')));
      wrap.appendChild(el('div', 'ml-sub', 'Moved: ' + evening.moved));
      wrap.appendChild(el('div', 'ml-sub', 'Interfered: ' + evening.interference));
      wrap.appendChild(el('div', 'ml-sub', 'Tomorrow: ' + evening.tomorrowChange));
      return wrap;
    }

    let selectedVerdict = evening ? evening.verdict : null;
    const verdictRow = el('div', 'ml-verdict-row');
    [['win', 'Win'], ['push', 'Push'], ['miss', 'Miss']].forEach(pair => {
      const val = pair[0], label = pair[1];
      const btn = el('button', 'ml-verdict-btn' + (selectedVerdict === val ? ' active' : ''), label);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        selectedVerdict = val;
        verdictRow.querySelectorAll('.ml-verdict-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      verdictRow.appendChild(btn);
    });
    wrap.appendChild(verdictRow);

    const verdictErr = el('div', 'ml-error', '');
    verdictErr.style.display = 'none';

    const noteInput = document.createElement('input');
    noteInput.type = 'text'; noteInput.className = 'gm-input'; noteInput.placeholder = 'One-line note (optional)';
    if (evening && evening.verdictNote) noteInput.value = evening.verdictNote;
    wrap.appendChild(noteInput);

    const moved = document.createElement('input'); moved.type = 'text'; moved.className = 'gm-input'; moved.placeholder = 'What moved today?';
    const interf = document.createElement('input'); interf.type = 'text'; interf.className = 'gm-input'; interf.placeholder = 'What interfered?';
    const change = document.createElement('input'); change.type = 'text'; change.className = 'gm-input'; change.placeholder = 'What changes tomorrow?';
    if (evening) { moved.value = evening.moved || ''; interf.value = evening.interference || ''; change.value = evening.tomorrowChange || ''; }
    [moved, interf, change].forEach(i => wrap.appendChild(i));
    wrap.appendChild(verdictErr);

    const saveBtn = el('button', 'gm-add', 'Save evening close');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', () => {
      const candidate = { verdict: selectedVerdict, verdictNote: noteInput.value.trim(), moved: moved.value.trim(), interference: interf.value.trim(), tomorrowChange: change.value.trim() };
      const check = ML.validateEveningClose(candidate);
      if (!check.ok) { verdictErr.textContent = check.errors[0]; verdictErr.style.display = 'block'; return; }
      candidate.completedAt = new Date().toISOString();
      session.evening = candidate;
      mlSessionSave(session);
    });
    wrap.appendChild(saveBtn);
    return wrap;
  }
```

- [ ] **Step 3: Refactor `mlRender()` to a single append path.** Replace the current function body:

```javascript
  function mlRender() {
    const card = document.getElementById('mlCard');
    if (!card || !window.MorningLaunchLogic) return;
    const outcomesState = mlOutcomesLoad();
    const session = mlSessionLoad();
    card.innerHTML = '';

    if (session.status === 'skipped') { card.appendChild(mlBuildSkipped(session)); return; }
    if (session.status === 'completed') { card.appendChild(mlBuildCompleted(session)); return; }
    if (!mlExpanded) { card.appendChild(mlBuildEntry(session)); return; }

    if (session.currentPhase === 'align') {
      mlAlignRevealed = mlAlignRevealed || (Array.isArray(session.recalledOutcomes) && session.recalledOutcomes.length === 5);
    } else {
      mlAlignRevealed = false;
    }

    if (session.currentPhase === 'clear') card.appendChild(mlBuildClear(session));
    else if (session.currentPhase === 'align') card.appendChild(mlBuildAlign(session, outcomesState));
    else if (session.currentPhase === 'visualize') card.appendChild(mlBuildVisualize(session));
    else if (session.currentPhase === 'commit') card.appendChild(mlBuildCommit(session, outcomesState));
    else card.appendChild(mlBuildEntry(session));
  }
```

With:

```javascript
  function mlRender() {
    const card = document.getElementById('mlCard');
    if (!card || !window.MorningLaunchLogic) return;
    const outcomesState = mlOutcomesLoad();
    const session = mlSessionLoad();
    card.innerHTML = '';

    let primary;
    if (session.status === 'skipped') {
      primary = mlBuildSkipped(session);
    } else if (session.status === 'completed') {
      primary = mlBuildCompleted(session);
    } else if (!mlExpanded) {
      primary = mlBuildEntry(session);
    } else {
      if (session.currentPhase === 'align') {
        mlAlignRevealed = mlAlignRevealed || (Array.isArray(session.recalledOutcomes) && session.recalledOutcomes.length === 5);
      } else {
        mlAlignRevealed = false;
      }
      if (session.currentPhase === 'clear') primary = mlBuildClear(session);
      else if (session.currentPhase === 'align') primary = mlBuildAlign(session, outcomesState);
      else if (session.currentPhase === 'visualize') primary = mlBuildVisualize(session);
      else if (session.currentPhase === 'commit') primary = mlBuildCommit(session, outcomesState);
      else primary = mlBuildEntry(session);
    }
    card.appendChild(primary);

    const eveningEl = mlBuildEvening(session);
    if (eveningEl) card.appendChild(eveningEl);
  }
```

- [ ] **Step 4: Remove the now-duplicate internal evening call inside `mlBuildCompleted`.** Find and delete these two lines near the end of `mlBuildCompleted` (just before its `return wrap;`):

```javascript
    const eveningEl = mlBuildEvening(session);
    if (eveningEl) wrap.appendChild(eveningEl);
```

(`mlRender()` now appends the evening panel once, centrally, for every branch — leaving this in would double-render it under `mlBuildCompleted`.)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row && git add main.html && git commit -m "feat(evening-shutdown): render Evening Shutdown for every session status with Win/Push/Miss verdict"
```

### Task 4: Vault export line (adherence to spec — small, optional-scope check)

**Files:**
- Read only: `C:\Users\gregm\.claude\scheduled-tasks\row-vessel-vault-sync\SKILL.md`

- [ ] **Step 1: Read the section 4 (Morning Launch export) block** and confirm it renders `evening.moved`/`evening.interference`/`evening.tomorrowChange` from the export projection without hardcoding a field allowlist (i.e. it either already forwards the whole `evening` object generically, or needs one added line).

- [ ] **Step 2: If it hardcodes fields (not generic),** add one line rendering `Verdict: <WIN|PUSH|MISS> — <verdictNote>` when `evening.verdict` is present, immediately after the existing Tomorrow-change line, matching the file's existing Markdown formatting conventions exactly. If it already forwards the object generically, no change needed — note that in the commit-less session log instead.

- [ ] **Step 3: If changed, commit** (claude-config / claude-workspace repo, not `row`):

```bash
cd "/g/My Drive/Claude" && git add .claude/scheduled-tasks/row-vessel-vault-sync/SKILL.md && git commit -m "feat(evening-shutdown): include verdict in the Morning Launch vault export"
```

### Task 5: Browser verification

- [ ] **Step 1: Start a local static server** for `C:\Users\gregm\row` (e.g. `npx serve` or Python's `http.server`) and open it in the Browser pane.

- [ ] **Step 2: Force evening-due for testing** — in the browser console: confirm current hour ≥ 17, or temporarily monkey-patch via devtools (`Date.prototype` is not to be edited in source; test only at/after 5 PM local, or simulate by editing `mlEveningDue` to `return true` locally in a scratch copy, never commit that).

- [ ] **Step 3: Verify all 4 states:**
  - **Absent/fresh day:** clear localStorage `morning_launch:<today>`, reload — Evening Shutdown shows either today's Goals list (if any) or "No tasks logged today.", verdict pills unselected, save works, reload persists.
  - **Draft (launch started, not completed):** start a Morning Launch, stop mid-phase — Evening Shutdown still renders (today-fallback source, since `needleMovers` is empty until Commit).
  - **Completed:** finish a full Morning Launch — Evening Shutdown shows the 3 real movers with live checkboxes; checking one there updates the Today list and vice versa (existing bidirectional reconciliation, now exercised via the extracted `mlBuildMoverList`).
  - **Skipped:** skip a launch — Evening Shutdown still renders below the skip/resume card.

- [ ] **Step 4: Verify no verdict selected → inline error, nothing saved.** Select a verdict, save, reload — verdict/note/moved/interfered/tomorrow all persist and the panel switches to its read-only summary view.

- [ ] **Step 5: Verify before-17:00 renders nothing** (temporarily check the DOM has no `.ml-evening` element when `mlEveningDue()` is false — either test before 5 PM or note this was verified logically via the unchanged `mlEveningDue` gate, unit-testable behavior already covered by the pre-existing function being untouched).

- [ ] **Step 6: Verify 375px width has no horizontal overflow** via `resize_window` to mobile preset.

### Task 6: Finish

- [ ] **Step 1: Run the full selfcheck suite one more time** to confirm nothing regressed:

```bash
node C:\Users\gregm\row\morning-launch-logic.selfcheck.cjs
```

- [ ] **Step 2: Push**

```bash
cd /c/Users/gregm/row && git push
```
