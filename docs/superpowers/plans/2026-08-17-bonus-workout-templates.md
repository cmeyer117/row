# Bonus Workout Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Carl build reusable named "bonus workout" templates (Shoulders & Arms, Chest & Back, Push, Pull) from his real exercise catalog, kept fully separate from his coach's plan days, so an off-plan session is pick-and-log instead of type-every-exercise-from-scratch every time.

**Architecture:** New pure-logic module (`gym-bonus-templates-logic.js`) handles template CRUD as plain data operations. `gym.html` gets new state (`bonusTemplates`, `viewMode`, `filterBonusTemplateId`, `bonusSessionDates`), a "Bonus" toggle next to the existing day-selector that swaps which list `getFiltered()`/`renderWorkoutList()` read from, and a "Manage Bonus Workouts" view for building templates from the existing exercise catalog. Because templates reference exercises by name into `state.exercises` (not duplicated objects), logging, history, and `getRx()` progression need zero changes — they already work on real exercise ids.

**Tech Stack:** Vanilla JS (matches gym.html's existing style — no framework), `localStorage`-backed state (existing `po_coach_v1` key), Node `.selfcheck.cjs` test convention (matches every other `gym-*-logic.js` module in this repo).

---

## Spec reference

Full design: `docs/superpowers/specs/2026-08-17-bonus-workout-templates-design.md`.

## Investigation findings (resolving the spec's "verify at plan time" item)

Read before writing tasks, since these determine the actual mechanism:

1. **`normalize()` (gym.html:3239-3240) force-resets `state.filterDay` to a valid plan day if it isn't found in `state.days`.** A second identical guard exists at gym.html:6443. Reusing `filterDay` to point at a bonus template id (as the spec's design summary loosely suggested) would get silently reset on every state load — a real landmine, not a hypothetical one. **Resolution: bonus mode uses its own separate state fields (`viewMode`, `filterBonusTemplateId`), never touching `filterDay`.** Plan-day code paths are completely untouched by this feature.

2. **`getFiltered()` (gym.html:3397-3402) is the single source of truth exercise-selection function** — `getCurrentEx()` calls it, and nothing else needs to change once it returns the right list. Branching bonus-mode logic into `getFiltered()` alone makes logging, `getRx()`, and history work in bonus mode with no other changes to those systems.

3. **`renderWorkoutList()` (gym.html:3752-3760) independently re-implements the same program/adhoc filtering** `getFiltered()` does, with one real behavioral difference (its `adhoc` list is NOT day-filtered, unlike `getFiltered()`'s). This is pre-existing duplication, not something this plan introduces — Task 3 does not consolidate the two functions (that would risk changing existing plan-day behavior, out of scope), it adds the equivalent bonus-mode branch to both independently.

4. **Compliance-exclusion (spec item 5) turns out to need much less than the spec speculated.** `doneDays` (gym.html:4670+) is a plain per-date boolean with no day/split awareness — bonus-marked-done days can safely set it too, no exclusion needed there. `renderPastWorkouts()` (gym.html:4782) derives its display purely from logged sets grouped by date, never looks up `state.days` by name — so there's no "wrong day name" risk to guard against. Volume/phase tracking (`gym-volume-logic.js`, `gym-rx-phase-logic.js`) key off each *exercise's* `day` field, which bonus templates never modify — extra sets logged via a bonus template correctly count as real extra volume for that exercise, which is desired, not a compliance leak. **The only real gap is visibility**: Past Workouts should show a small "Bonus" badge so Carl can tell which sessions were bonus work at a glance. **The upcoming decision-to-execution scoreboard doesn't exist as running code yet** — nothing to guard against there today; whoever builds that feature should read `state.bonusSessionDates` (added in Task 6) to exclude bonus dates from plan-day compliance math, but that's that feature's job, not this plan's.

## File structure

- **Create:** `gym-bonus-templates-logic.js` — pure CRUD: `createTemplate`, `renameTemplate`, `deleteTemplate`, `addExerciseToTemplate`, `removeExerciseFromTemplate`, `resolveTemplateExercises`. Same IIFE/`window.GymBonusTemplatesLogic`/`module.exports` dual-export convention as `gym-sleep-check-logic.js`.
- **Create:** `gym-bonus-templates-logic.selfcheck.cjs` — same `node`-runnable assert-based convention as `gym-sleep-check-logic.selfcheck.cjs`.
- **Modify:** `gym.html` — state defaults/seed (`normalize()`), `getFiltered()`, `renderWorkoutList()`, `renderFilters()` + a new "Bonus" toggle, a new "Manage Bonus Workouts" modal, `renderPastWorkouts()` badge, the `poTwDoneBtn` handler (stamps `bonusSessionDates`), new `<script src="gym-bonus-templates-logic.js">` tag.

---

### Task 1: Pure template CRUD logic — TDD

**Files:**
- Create: `gym-bonus-templates-logic.js`
- Create: `gym-bonus-templates-logic.selfcheck.cjs`

- [ ] **Step 1: Write the failing selfcheck**

Create `gym-bonus-templates-logic.selfcheck.cjs`:

```js
// Run with: node gym-bonus-templates-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-bonus-templates-logic.js'), 'utf8'), sandbox);
const {
  createTemplate, renameTemplate, deleteTemplate,
  addExerciseToTemplate, removeExerciseFromTemplate, resolveTemplateExercises,
} = sandbox.window.GymBonusTemplatesLogic;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

// createTemplate — appends with a fresh id, name trimmed, starts empty.
let templates = [];
templates = createTemplate(templates, '  Shoulders & Arms  ');
assertEqual(templates.length, 1, 'createTemplate: appends one template');
assertEqual(templates[0].name, 'Shoulders & Arms', 'createTemplate: trims the name');
assertEqual(templates[0].exerciseNames, [], 'createTemplate: starts with no exercises');
const id1 = templates[0].id;

templates = createTemplate(templates, 'Chest & Back');
assertEqual(templates.length, 2, 'createTemplate: second call appends, does not replace');
assertEqual(templates[0].id, id1, 'createTemplate: first template keeps its id');

// renameTemplate — only touches the matching id.
templates = renameTemplate(templates, id1, 'Shoulders + Arms');
assertEqual(templates[0].name, 'Shoulders + Arms', 'renameTemplate: renames the matching template');
assertEqual(templates[1].name, 'Chest & Back', 'renameTemplate: leaves other templates untouched');

// addExerciseToTemplate — no duplicates.
templates = addExerciseToTemplate(templates, id1, 'Dumbbell Lateral Raise');
templates = addExerciseToTemplate(templates, id1, 'Dumbbell Lateral Raise');
assertEqual(templates[0].exerciseNames, ['Dumbbell Lateral Raise'], 'addExerciseToTemplate: adding the same name twice does not duplicate');
templates = addExerciseToTemplate(templates, id1, 'Machine Preacher Curl');
assertEqual(templates[0].exerciseNames, ['Dumbbell Lateral Raise', 'Machine Preacher Curl'], 'addExerciseToTemplate: second distinct exercise appends');

// removeExerciseFromTemplate
templates = removeExerciseFromTemplate(templates, id1, 'Dumbbell Lateral Raise');
assertEqual(templates[0].exerciseNames, ['Machine Preacher Curl'], 'removeExerciseFromTemplate: removes only the named exercise');

// deleteTemplate
templates = deleteTemplate(templates, id1);
assertEqual(templates.length, 1, 'deleteTemplate: removes the matching template');
assertEqual(templates[0].name, 'Chest & Back', 'deleteTemplate: leaves the other template');

// resolveTemplateExercises — maps names to real exercise objects for the
// active gym, preserving template order, skipping names with no match
// (e.g. an exercise Carl later deleted from his catalog).
const catalog = [
  { id: 'ex1', name: 'Lat Pulldown', gym: 'comm' },
  { id: 'ex2', name: 'Cable Rear Delt Fly', gym: 'comm' },
  { id: 'ex3', name: 'Lat Pulldown', gym: 'home' },
];
const resolved = resolveTemplateExercises(
  { id: 't1', name: 'Pull', exerciseNames: ['Cable Rear Delt Fly', 'Nonexistent Exercise', 'Lat Pulldown'] },
  catalog,
  'comm'
);
assertEqual(resolved.map(e => e.id), ['ex2', 'ex1'], 'resolveTemplateExercises: resolves in template order, skips unmatched names, matches active gym');

const resolvedBothGym = resolveTemplateExercises(
  { id: 't2', name: 'Test', exerciseNames: ['Lat Pulldown'] },
  [{ id: 'ex4', name: 'Lat Pulldown', gym: 'both' }],
  'comm'
);
assertEqual(resolvedBothGym.map(e => e.id), ['ex4'], 'resolveTemplateExercises: an exercise tagged gym "both" matches any active gym');

console.log('gym-bonus-templates-logic.selfcheck.cjs: all assertions passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node gym-bonus-templates-logic.selfcheck.cjs`
Expected: FAIL — `gym-bonus-templates-logic.js` does not exist / `window.GymBonusTemplatesLogic` is undefined.

- [ ] **Step 3: Write the implementation**

Create `gym-bonus-templates-logic.js`:

```js
// gym-bonus-templates-logic.js — pure CRUD for Carl's reusable bonus-workout
// templates (Shoulders & Arms, Chest & Back, Push, Pull, etc.). No DOM, no
// Supabase. Templates reference exercises BY NAME into the real exercise
// catalog (state.exercises) rather than duplicating exercise objects, so
// logging/history/getRx() progression work unchanged once resolved to real
// exercise ids. See docs/superpowers/specs/2026-08-17-bonus-workout-templates-design.md.
(function () {
  'use strict';

  function makeId() {
    return 'bonus_tmpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function createTemplate(templates, name) {
    var trimmed = (name || '').trim();
    return templates.concat([{ id: makeId(), name: trimmed, exerciseNames: [] }]);
  }

  function renameTemplate(templates, id, newName) {
    var trimmed = (newName || '').trim();
    return templates.map(function (t) {
      return t.id === id ? Object.assign({}, t, { name: trimmed }) : t;
    });
  }

  function deleteTemplate(templates, id) {
    return templates.filter(function (t) { return t.id !== id; });
  }

  function addExerciseToTemplate(templates, id, exerciseName) {
    return templates.map(function (t) {
      if (t.id !== id) return t;
      if (t.exerciseNames.indexOf(exerciseName) !== -1) return t;
      return Object.assign({}, t, { exerciseNames: t.exerciseNames.concat([exerciseName]) });
    });
  }

  function removeExerciseFromTemplate(templates, id, exerciseName) {
    return templates.map(function (t) {
      if (t.id !== id) return t;
      return Object.assign({}, t, {
        exerciseNames: t.exerciseNames.filter(function (n) { return n !== exerciseName; }),
      });
    });
  }

  // Maps a template's stored exercise names to real exercise objects from
  // the current catalog, in template order. An exercise Carl later renamed
  // or deleted from his catalog simply drops out silently rather than
  // crashing the workout list -- same "guard, don't throw" posture as
  // applyCheckinOverride()'s own undefined-checkin handling elsewhere in
  // this codebase.
  function resolveTemplateExercises(template, exerciseCatalog, activeGym) {
    var byName = {};
    exerciseCatalog.forEach(function (ex) {
      if (ex.gym !== activeGym && ex.gym !== 'both') return;
      if (!(ex.name in byName)) byName[ex.name] = ex;
    });
    return template.exerciseNames
      .map(function (name) { return byName[name]; })
      .filter(Boolean);
  }

  var api = {
    createTemplate: createTemplate,
    renameTemplate: renameTemplate,
    deleteTemplate: deleteTemplate,
    addExerciseToTemplate: addExerciseToTemplate,
    removeExerciseFromTemplate: removeExerciseFromTemplate,
    resolveTemplateExercises: resolveTemplateExercises,
  };
  if (typeof window !== 'undefined') window.GymBonusTemplatesLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node gym-bonus-templates-logic.selfcheck.cjs`
Expected: `gym-bonus-templates-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add gym-bonus-templates-logic.js gym-bonus-templates-logic.selfcheck.cjs
git commit -m "feat: pure CRUD logic for bonus workout templates"
```

---

### Task 2: State wiring — seed templates, viewMode, script tag

**Files:**
- Modify: `gym.html:3213-3260` (`normalize()`)
- Modify: `gym.html:6585` (script tags, alongside the other `gym-*-logic.js` includes)

- [ ] **Step 1: Add the script tag**

In `gym.html`, find this line (context from the existing script-tag block):
```html
<script src="gym-sleep-check-logic.js"></script>
```
Add immediately after it:
```html
<script src="gym-bonus-templates-logic.js"></script>
```

- [ ] **Step 2: Seed default templates and new state fields in `normalize()`**

In `gym.html`, find (inside `normalize()`, right after the `s.checkins` block):
```js
    if (!s.checkins || typeof s.checkins !== 'object') s.checkins = {};
```
Add immediately after it:
```js
    // Bonus workout templates -- separate from the coach's plan (state.days
    // stays untouched). Seeded once, empty, with stable ids so re-seeding
    // never duplicates them. Carl fills in exercises himself via the
    // Manage Bonus Workouts view -- CONFIG.defaultExercises is stale
    // first-run seed data, not a reliable source to pre-fill from.
    if (!Array.isArray(s.bonusTemplates)) {
      s.bonusTemplates = [
        { id: 'bonus_seed_shoulders_arms', name: 'Shoulders & Arms', exerciseNames: [] },
        { id: 'bonus_seed_chest_back', name: 'Chest & Back', exerciseNames: [] },
        { id: 'bonus_seed_push', name: 'Push', exerciseNames: [] },
        { id: 'bonus_seed_pull', name: 'Pull', exerciseNames: [] },
      ];
    }
    // 'plan' (default) shows the coach's day tabs; 'bonus' shows bonus
    // templates instead. Deliberately NOT reusing filterDay for this --
    // normalize() itself (below) and a second guard at the modal-day-picker
    // reset filterDay to a valid plan day whenever it isn't found in
    // s.days, which would silently clobber a bonus template id every load.
    if (s.viewMode !== 'plan' && s.viewMode !== 'bonus') s.viewMode = 'plan';
    if (typeof s.filterBonusTemplateId !== 'string' || !s.bonusTemplates.find(function (t) { return t.id === s.filterBonusTemplateId; })) {
      s.filterBonusTemplateId = s.bonusTemplates[0].id;
    }
    // Dates where a bonus (not plan-day) session was marked done -- purely
    // for the Past Workouts "Bonus" badge today; a future plan-compliance
    // feature should read this to exclude bonus dates from plan-day math.
    if (!s.bonusSessionDates || typeof s.bonusSessionDates !== 'object') s.bonusSessionDates = {};
```

- [ ] **Step 3: Manual smoke check**

Open `gym.html` in a browser (or via the existing dev preview), open DevTools console, run:
```js
JSON.parse(localStorage.getItem('po_coach_v1')).bonusTemplates
```
Expected: an array of 4 objects with `name` "Shoulders & Arms", "Chest & Back", "Push", "Pull", each with `exerciseNames: []`.

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "feat: seed bonus workout template state"
```

---

### Task 3: Bonus-mode branch in `getFiltered()` and `renderWorkoutList()`

**Files:**
- Modify: `gym.html:3397-3402` (`getFiltered()`)
- Modify: `gym.html:3752-3771` (`renderWorkoutList()`)

- [ ] **Step 1: Branch `getFiltered()`**

In `gym.html`, replace:
```js
  function getFiltered() {
    const program = state.exercises.filter(e =>
      (e.gym === state.filterGym || e.gym === 'both') && e.day === state.filterDay);
    const adhoc = getAdhocExercises().filter(a => a.day === state.filterDay);
    return [...program, ...adhoc];
  }
```
with:
```js
  function getFiltered() {
    if (state.viewMode === 'bonus') {
      const tmpl = state.bonusTemplates.find(t => t.id === state.filterBonusTemplateId);
      if (!tmpl) return [];
      return window.GymBonusTemplatesLogic.resolveTemplateExercises(tmpl, state.exercises, state.filterGym);
    }
    const program = state.exercises.filter(e =>
      (e.gym === state.filterGym || e.gym === 'both') && e.day === state.filterDay);
    const adhoc = getAdhocExercises().filter(a => a.day === state.filterDay);
    return [...program, ...adhoc];
  }
```

- [ ] **Step 2: Branch `renderWorkoutList()`**

In `gym.html`, replace:
```js
  function renderWorkoutList() {
    const listEl = document.getElementById('wlList');
    if (!listEl) return;

    // Program-only (no adhoc) for the selected gym+day
    const exercises = state.exercises.filter(e =>
      (e.gym === state.filterGym || e.gym === 'both') && e.day === state.filterDay);
    // Today's extras — all adhoc for today regardless of day tag
    const adhoc = getAdhocExercises();

    listEl.innerHTML = '';

    const programItems = exercises.map(ex => ({ ex, isAdhoc: false }));
    const adhocItems   = adhoc.map(a  => ({ ex: a,  isAdhoc: true  }));

    if (!programItems.length && !adhocItems.length) {
      listEl.innerHTML = '<div class="po-no-ex">No exercises for this day — add one below.</div>';
      return;
    }
```
with:
```js
  function renderWorkoutList() {
    const listEl = document.getElementById('wlList');
    if (!listEl) return;

    let exercises, adhoc;
    if (state.viewMode === 'bonus') {
      // No adhoc concept in bonus mode -- templates reference the real
      // catalog by design, so there's nothing to type-in-a-name for here.
      const tmpl = state.bonusTemplates.find(t => t.id === state.filterBonusTemplateId);
      exercises = tmpl ? window.GymBonusTemplatesLogic.resolveTemplateExercises(tmpl, state.exercises, state.filterGym) : [];
      adhoc = [];
    } else {
      // Program-only (no adhoc) for the selected gym+day
      exercises = state.exercises.filter(e =>
        (e.gym === state.filterGym || e.gym === 'both') && e.day === state.filterDay);
      // Today's extras — all adhoc for today regardless of day tag
      adhoc = getAdhocExercises();
    }

    listEl.innerHTML = '';

    const programItems = exercises.map(ex => ({ ex, isAdhoc: false }));
    const adhocItems   = adhoc.map(a  => ({ ex: a,  isAdhoc: true  }));

    if (!programItems.length && !adhocItems.length) {
      listEl.innerHTML = state.viewMode === 'bonus'
        ? '<div class="po-no-ex">No exercises in this template yet — add some in Manage Bonus Workouts.</div>'
        : '<div class="po-no-ex">No exercises for this day — add one below.</div>';
      return;
    }
```

- [ ] **Step 2: Type-check by eye / manual smoke test**

No build step for this file (plain script, no bundler) — open in a browser, confirm no console errors on load. Full behavioral verification happens in Task 6 once the toggle UI exists to actually reach `viewMode === 'bonus'`.

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "feat: source the workout list from a bonus template when in bonus mode"
```

---

### Task 4: "Bonus" toggle UI

**Files:**
- Modify: `gym.html:2700-2708` (day-selector HTML)
- Modify: `gym.html:3717-3739` (`renderFilters()` + `daySeg` click handler)

- [ ] **Step 1: Add the toggle button to the HTML**

In `gym.html`, replace:
```html
      <div class="po-seg-control" id="gymSeg" style="display:none"></div>
      <div class="po-seg-row">
        <span class="po-seg-label">Day</span>
        <div class="po-seg-control" id="daySeg"></div>
      </div>
      <div class="po-seg-row">
        <span class="po-seg-label">Tag</span>
        <button class="po-seg-btn" id="sessionTagBtn" type="button">+ Tag session</button>
      </div>
```
with:
```html
      <div class="po-seg-control" id="gymSeg" style="display:none"></div>
      <div class="po-seg-row">
        <span class="po-seg-label" id="daySegLabel">Day</span>
        <div class="po-seg-control" id="daySeg"></div>
        <button class="po-seg-btn" id="bonusModeToggle" type="button">Bonus</button>
      </div>
      <div class="po-seg-row">
        <span class="po-seg-label">Tag</span>
        <button class="po-seg-btn" id="sessionTagBtn" type="button">+ Tag session</button>
      </div>
```

- [ ] **Step 2: Rewrite `renderFilters()` to render bonus templates when in bonus mode, and wire the toggle**

In `gym.html`, replace:
```js
  function renderFilters() {
    $('gymSeg').innerHTML = state.gyms.map(g =>
      '<button class="po-seg-btn ' + (g.id === state.filterGym ? 'active' : '') + '" data-gym="' + g.id + '">' + escape(g.name) + '</button>'
    ).join('');
    $('daySeg').innerHTML = state.days.map(d =>
      '<button class="po-seg-btn ' + (d.id === state.filterDay ? 'active' : '') + '" data-day="' + d.id + '">' + escape(d.name) + '</button>'
    ).join('');
    $('gymSeg').querySelectorAll('.po-seg-btn').forEach(b => {
      b.addEventListener('click', () => { state.filterGym = b.dataset.gym; state.currentEx = null; saveState(); renderAll(); });
    });
    $('daySeg').querySelectorAll('.po-seg-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.filterDay = b.dataset.day;
        state.currentEx = null;
        // User has now manually picked a day — stop auto-overriding to today's split.
        state._userPickedDay = true;
        state._userPickedDayKey = getActiveDate();
        saveState(); renderAll();
      });
    });
    const tag = (state.sessionTags || {})[getActiveDate()];
    $('sessionTagBtn').textContent = tag ? ('🏷 ' + tag) : '+ Tag session';
  }
```
with:
```js
  function renderFilters() {
    $('gymSeg').innerHTML = state.gyms.map(g =>
      '<button class="po-seg-btn ' + (g.id === state.filterGym ? 'active' : '') + '" data-gym="' + g.id + '">' + escape(g.name) + '</button>'
    ).join('');
    $('bonusModeToggle').classList.toggle('active', state.viewMode === 'bonus');
    if (state.viewMode === 'bonus') {
      $('daySegLabel').textContent = 'Bonus';
      $('daySeg').innerHTML = state.bonusTemplates.map(t =>
        '<button class="po-seg-btn ' + (t.id === state.filterBonusTemplateId ? 'active' : '') + '" data-bonus-template="' + t.id + '">' + escape(t.name) + '</button>'
      ).join('');
      $('daySeg').querySelectorAll('.po-seg-btn').forEach(b => {
        b.addEventListener('click', () => {
          state.filterBonusTemplateId = b.dataset.bonusTemplate;
          state.currentEx = null;
          saveState(); renderAll();
        });
      });
    } else {
      $('daySegLabel').textContent = 'Day';
      $('daySeg').innerHTML = state.days.map(d =>
        '<button class="po-seg-btn ' + (d.id === state.filterDay ? 'active' : '') + '" data-day="' + d.id + '">' + escape(d.name) + '</button>'
      ).join('');
      $('daySeg').querySelectorAll('.po-seg-btn').forEach(b => {
        b.addEventListener('click', () => {
          state.filterDay = b.dataset.day;
          state.currentEx = null;
          // User has now manually picked a day — stop auto-overriding to today's split.
          state._userPickedDay = true;
          state._userPickedDayKey = getActiveDate();
          saveState(); renderAll();
        });
      });
    }
    $('gymSeg').querySelectorAll('.po-seg-btn').forEach(b => {
      b.addEventListener('click', () => { state.filterGym = b.dataset.gym; state.currentEx = null; saveState(); renderAll(); });
    });
    const tag = (state.sessionTags || {})[getActiveDate()];
    $('sessionTagBtn').textContent = tag ? ('🏷 ' + tag) : '+ Tag session';
  }
  $('bonusModeToggle').addEventListener('click', function() {
    state.viewMode = state.viewMode === 'bonus' ? 'plan' : 'bonus';
    state.currentEx = null;
    saveState(); renderAll();
  });
```

- [ ] **Step 3: Manual browser verification**

Open the app locally, tap "Bonus" — the day row should switch to showing "Shoulders & Arms / Chest & Back / Push / Pull" pills, and the workout list below should show the "No exercises in this template yet" message (since templates are still empty at this point in the plan). Tap "Bonus" again — confirm it switches back to the normal plan-day pills with no console errors.

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "feat: add Bonus mode toggle next to the day selector"
```

---

### Task 5: "Manage Bonus Workouts" view — add exercises to templates

**Files:**
- Modify: `gym.html` — new modal HTML (near the existing modal markup), new render/handler functions, a "Manage" entry point button placed in the bonus-mode `daySeg` row area.

- [ ] **Step 1: Add a "Manage" button, shown only in bonus mode**

In `gym.html`, in the `renderFilters()` function written in Task 4, extend the bonus-mode branch's `daySeg` line — replace:
```js
      $('daySeg').innerHTML = state.bonusTemplates.map(t =>
        '<button class="po-seg-btn ' + (t.id === state.filterBonusTemplateId ? 'active' : '') + '" data-bonus-template="' + t.id + '">' + escape(t.name) + '</button>'
      ).join('');
```
with:
```js
      $('daySeg').innerHTML = state.bonusTemplates.map(t =>
        '<button class="po-seg-btn ' + (t.id === state.filterBonusTemplateId ? 'active' : '') + '" data-bonus-template="' + t.id + '">' + escape(t.name) + '</button>'
      ).join('') + '<button class="po-seg-btn" id="manageBonusBtn" type="button">⚙ Manage</button>';
```
and add the click handler right after the existing `$('daySeg').querySelectorAll('.po-seg-btn')...` block inside that same `if (state.viewMode === 'bonus')` branch:
```js
      const manageBtn = document.getElementById('manageBonusBtn');
      if (manageBtn) manageBtn.addEventListener('click', openManageBonusModal);
```

- [ ] **Step 2: Add the modal HTML**

In `gym.html`, find the existing `<div id="debriefModal">` block (used as an anchor — same top-level modal-container pattern):
```html
  <div id="debriefModal">
```
Add immediately before it:
```html
  <div id="manageBonusModal">
    <div class="po-debrief-sheet">
      <div class="po-debrief-title">Manage Bonus Workouts</div>
      <div id="manageBonusTemplateList"></div>
      <div id="manageBonusExercisePicker" style="display:none">
        <input type="text" id="manageBonusSearchInput" placeholder="Search exercises…" />
        <div id="manageBonusMuscleChips"></div>
        <div id="manageBonusExerciseResults"></div>
        <button class="po-debrief-close" id="manageBonusPickerDone" type="button">Done</button>
      </div>
      <button class="po-debrief-close" id="manageBonusClose" type="button">Close</button>
    </div>
  </div>
```

- [ ] **Step 3: Add matching CSS**

In `gym.html`, find (the existing debrief modal's CSS, used as the style pattern to match):
```css
#debriefModal {
```
Add immediately before it:
```css
#manageBonusModal {
  display: none; position: fixed; inset: 0; z-index: 9100;
  background: rgba(0,0,0,0.6); align-items: flex-end; justify-content: center;
}
#manageBonusModal.show { display: flex; }
#manageBonusTemplateList { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
.po-bonus-tmpl-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; }
.po-bonus-tmpl-row-name { font-weight: 600; }
.po-bonus-tmpl-row-count { color: var(--text-3); font-size: 12px; }
#manageBonusExerciseResults { max-height: 40vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.po-bonus-ex-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; }
```

- [ ] **Step 4: Write the render + handler functions**

In `gym.html`, add near `renderFilters()` (right after its closing `}` from Task 4, before the `$('bonusModeToggle')` listener):

```js
  let _manageBonusEditingId = null;

  function openManageBonusModal() {
    _manageBonusEditingId = null;
    renderManageBonusTemplateList();
    document.getElementById('manageBonusExercisePicker').style.display = 'none';
    document.getElementById('manageBonusModal').classList.add('show');
  }

  function renderManageBonusTemplateList() {
    const listEl = document.getElementById('manageBonusTemplateList');
    listEl.innerHTML = state.bonusTemplates.map(t =>
      '<div class="po-bonus-tmpl-row" data-tmpl-id="' + t.id + '">'
      + '<div><div class="po-bonus-tmpl-row-name">' + escape(t.name) + '</div>'
      + '<div class="po-bonus-tmpl-row-count">' + t.exerciseNames.length + ' exercises</div></div>'
      + '<div><button class="po-seg-btn" data-action="edit">Edit</button> '
      + '<button class="po-seg-btn" data-action="delete">Delete</button></div>'
      + '</div>'
    ).join('') + '<button class="po-seg-btn" id="manageBonusAddTmpl" type="button">+ New template</button>';

    listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.po-bonus-tmpl-row').dataset.tmplId;
        _manageBonusEditingId = id;
        renderManageBonusExercisePicker();
      });
    });
    listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.po-bonus-tmpl-row').dataset.tmplId;
        if (!confirm('Delete this bonus template? This does not delete any logged history.')) return;
        state.bonusTemplates = window.GymBonusTemplatesLogic.deleteTemplate(state.bonusTemplates, id);
        if (state.filterBonusTemplateId === id) state.filterBonusTemplateId = state.bonusTemplates[0] ? state.bonusTemplates[0].id : null;
        saveState();
        renderManageBonusTemplateList();
        renderAll();
      });
    });
    const addBtn = document.getElementById('manageBonusAddTmpl');
    addBtn.addEventListener('click', () => {
      const name = prompt('New bonus workout name (e.g. "Arms & Abs"):');
      if (!name || !name.trim()) return;
      state.bonusTemplates = window.GymBonusTemplatesLogic.createTemplate(state.bonusTemplates, name);
      saveState();
      renderManageBonusTemplateList();
      renderAll();
    });
  }

  function renderManageBonusExercisePicker() {
    document.getElementById('manageBonusExercisePicker').style.display = 'block';
    const tmpl = state.bonusTemplates.find(t => t.id === _manageBonusEditingId);
    if (!tmpl) return;

    const muscles = Array.from(new Set(state.exercises.map(e => e.muscle).filter(Boolean))).sort();
    const chipsEl = document.getElementById('manageBonusMuscleChips');
    let activeMuscle = null;
    chipsEl.innerHTML = muscles.map(m => '<button class="po-seg-btn" data-muscle="' + escape(m) + '">' + escape(m) + '</button>').join('');

    function renderResults(filterText, filterMuscle) {
      const seen = new Set();
      const catalog = state.exercises.filter(e => {
        if (seen.has(e.name)) return false;
        seen.add(e.name);
        if (filterMuscle && e.muscle !== filterMuscle) return false;
        if (filterText && e.name.toLowerCase().indexOf(filterText.toLowerCase()) === -1) return false;
        return true;
      });
      const resultsEl = document.getElementById('manageBonusExerciseResults');
      resultsEl.innerHTML = catalog.map(e => {
        const checked = tmpl.exerciseNames.indexOf(e.name) !== -1;
        return '<label class="po-bonus-ex-row"><input type="checkbox" data-ex-name="' + escape(e.name) + '" ' + (checked ? 'checked' : '') + ' /> ' + escape(e.name) + '</label>';
      }).join('');
      resultsEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
          const name = cb.dataset.exName;
          state.bonusTemplates = cb.checked
            ? window.GymBonusTemplatesLogic.addExerciseToTemplate(state.bonusTemplates, tmpl.id, name)
            : window.GymBonusTemplatesLogic.removeExerciseFromTemplate(state.bonusTemplates, tmpl.id, name);
          saveState();
        });
      });
    }
    renderResults('', null);

    document.getElementById('manageBonusSearchInput').oninput = (e) => renderResults(e.target.value, activeMuscle);
    chipsEl.querySelectorAll('[data-muscle]').forEach(chip => {
      chip.addEventListener('click', () => {
        activeMuscle = activeMuscle === chip.dataset.muscle ? null : chip.dataset.muscle;
        chipsEl.querySelectorAll('[data-muscle]').forEach(c => c.classList.toggle('active', c.dataset.muscle === activeMuscle));
        renderResults(document.getElementById('manageBonusSearchInput').value, activeMuscle);
      });
    });
  }

  document.getElementById('manageBonusPickerDone').addEventListener('click', () => {
    document.getElementById('manageBonusExercisePicker').style.display = 'none';
    renderManageBonusTemplateList();
    renderAll();
  });
  document.getElementById('manageBonusClose').addEventListener('click', () => {
    document.getElementById('manageBonusModal').classList.remove('show');
    renderAll();
  });
```

- [ ] **Step 5: Manual browser verification**

Open the app, switch to Bonus mode, tap "⚙ Manage". Confirm: the 4 seed templates list with "0 exercises" each; tapping "Edit" on one opens a searchable exercise picker; typing part of an exercise name filters the list; tapping a muscle chip filters by muscle; checking a box adds it (confirm via `JSON.parse(localStorage.getItem('po_coach_v1')).bonusTemplates` in the console); tapping "Done" then "Close" returns to the day view, and the newly-checked exercises now appear in that template's workout list.

- [ ] **Step 6: Commit**

```bash
git add gym.html
git commit -m "feat: Manage Bonus Workouts view — build templates from the real exercise catalog"
```

---

### Task 6: "Bonus" badge in Past Workouts

**Files:**
- Modify: `gym.html:4856-4871` (`poTwDoneBtn` click handler)
- Modify: `gym.html:4782-4821` (`renderPastWorkouts()`)

- [ ] **Step 1: Stamp `bonusSessionDates` when marking a bonus session done**

In `gym.html`, replace:
```js
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
with:
```js
  $('poTwDoneBtn').addEventListener('click', () => {
    const todayKey = wtDateKey(new Date());
    const wasUndone = !doneDays[todayKey];
    if (doneDays[todayKey]) {
      delete doneDays[todayKey];
    } else {
      doneDays[todayKey] = new Date().toISOString();
      if (state.viewMode === 'bonus') {
        state.bonusSessionDates[todayKey] = true;
        saveState();
      }
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

- [ ] **Step 2: Show the badge in Past Workouts**

In `gym.html`, replace:
```js
      return '<div class="po-tw-past-day" data-dk="' + dk + '">'
        + '<div class="po-tw-past-day-h">'
        +   '<span class="po-tw-past-day-date">' + fmtPastDate(dk) + '</span>'
        +   '<span class="po-tw-past-day-summary">'
        +     sum.totalSets + ' sets'
        +     (isDone ? ' <span class="po-tw-past-day-done">DONE</span>' : '')
        +   '</span>'
```
with:
```js
      const isBonus = !!(state.bonusSessionDates || {})[dk];
      return '<div class="po-tw-past-day" data-dk="' + dk + '">'
        + '<div class="po-tw-past-day-h">'
        +   '<span class="po-tw-past-day-date">' + fmtPastDate(dk) + '</span>'
        +   '<span class="po-tw-past-day-summary">'
        +     sum.totalSets + ' sets'
        +     (isBonus ? ' <span class="po-tw-past-day-done">BONUS</span>' : '')
        +     (isDone ? ' <span class="po-tw-past-day-done">DONE</span>' : '')
        +   '</span>'
```

- [ ] **Step 3: Manual browser verification**

Log a set against a bonus template, tap "Mark Done" while in Bonus mode, open Past Workouts — confirm today's entry shows both "BONUS" and "DONE" badges. Switch back to Plan mode and mark a plan day done on a different date — confirm that entry shows only "DONE", no "BONUS" badge.

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "feat: badge bonus sessions in Past Workouts"
```

---

### Task 7: Full end-to-end manual verification

Not a code task — no commit. Given today's session found two real bugs that only surfaced in an actual browser console (a cross-`<script>`-tag scoping `ReferenceError`, then a Node-runtime `AbortController` crash), do not skip this step or treat the individual task-level browser checks above as sufficient on their own.

- [ ] **Step 1: Open DevTools console before starting**

Keep it open through the whole walkthrough below — watch for any red errors.

- [ ] **Step 2: Full bonus-workout flow**

1. Switch to Bonus mode, add 4-5 real exercises to "Shoulders & Arms" via Manage Bonus Workouts.
2. Return to the day view, confirm those exercises appear in the workout list with real `getRx()` suggestions (weight/reps), not blank defaults.
3. Log a set against one of them — confirm it logs exactly like a plan-day exercise (last-set display, history).
4. Tap "Mark Done" — confirm the debrief modal still works normally (it should, since bonus-mode doesn't touch `fireDebrief()`'s exercise-iteration logic, which reads `state.exercises`/`state.logs` directly, not `getFiltered()`).
5. Switch back to Plan mode — confirm the coach's plan days, `filterDay`, and existing exercises are completely unaffected (this is the actual regression risk this plan carries — verify it explicitly, don't assume).

- [ ] **Step 3: Confirm no plan-day regression**

Log a set on a real plan day (Push, Pull, etc.) after having used Bonus mode earlier in the same session — confirm it logs correctly and `getRx()` still reflects real progression history, unaffected by anything done in Bonus mode.

---

## Self-review notes

- **Spec coverage:** all 5 numbered items in the spec's "What this build is" have a task — templates/state (Tasks 1-2), UI toggle (Task 4), exercise-picker/management (Task 5), compliance/badge (Task 6, scoped down per the Investigation Findings section above, which resolves the spec's own flagged open question). `getFiltered()`/`renderWorkoutList()` (Task 3) is the mechanism that makes logging/history/`getRx()` work unchanged, matching the spec's core design claim.
- **Type consistency:** `GymBonusTemplatesLogic`'s function names/signatures (Task 1) match every call site in Tasks 3-6 exactly (`resolveTemplateExercises(template, exerciseCatalog, activeGym)`, `createTemplate(templates, name)`, etc.).
- **No placeholders:** all steps show complete code; Task 7 is intentionally manual/non-code.
