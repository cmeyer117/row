# Evening Checklist Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two evidence-backed items (a screens/phone cutoff, a training-cutoff-time reminder) to Row's already-live Evening Shutdown checklist.

**Architecture:** Pure data addition — two new entries in the existing `EVENING_ITEMS` array. No new logic; the generic `checkbox`-kind renderer already handles any item in the array.

**Tech Stack:** Plain Node/browser JS, hand-rolled `assert`/`assertEqual` selfcheck harness (no test framework).

---

## Spec reference

`docs/superpowers/specs/2026-08-30-evening-checklist-additions-design.md` (committed `row@c6fa30e`).

## File Structure

- Modify: `daily-routine-checklist-logic.js` — add 2 items to `EVENING_ITEMS`.
- Modify: `daily-routine-checklist-logic.selfcheck.cjs` — update the hardcoded item-count assertion, add 2 new item assertions.

One task — the whole change is 2 array entries plus their test coverage.

---

### Task 1: Add the two evening checklist items

**Files:**
- Modify: `daily-routine-checklist-logic.js:12-18` (the `EVENING_ITEMS` array)
- Modify: `daily-routine-checklist-logic.selfcheck.cjs:62-66` (evening-state assertions)

- [ ] **Step 1: Write the failing tests**

Find this exact existing code in `daily-routine-checklist-logic.selfcheck.cjs` (lines 62-66):

```javascript
const eveningState = L.buildChecklistState(L.EVENING_ITEMS, { melatonin: true }, { journal: { 'vessel:journal': [{ id: 'j1', date: '2026-08-09' }] } }, '2026-08-09');
assertEqual(eveningState.find(function (i) { return i.id === 'melatonin'; }).checked, true, 'evening melatonin checkbox reflects saved true');
assertEqual(eveningState.find(function (i) { return i.id === 'journal'; }).checked, true, 'evening journal live item true');
assertEqual(eveningState.length, 5, 'evening item list has 5 items');
assertEqual(L.MORNING_ITEMS.length, 5, 'morning item list has 5 items');
```

Replace with (the `melatonin`/`journal` lines are unchanged; only the count assertion and two new item assertions are added):

```javascript
const eveningState = L.buildChecklistState(L.EVENING_ITEMS, { melatonin: true, screens_off: true }, { journal: { 'vessel:journal': [{ id: 'j1', date: '2026-08-09' }] } }, '2026-08-09');
assertEqual(eveningState.find(function (i) { return i.id === 'melatonin'; }).checked, true, 'evening melatonin checkbox reflects saved true');
assertEqual(eveningState.find(function (i) { return i.id === 'journal'; }).checked, true, 'evening journal live item true');
assertEqual(eveningState.find(function (i) { return i.id === 'screens_off'; }).checked, true, 'evening screens_off checkbox reflects saved true');
assertEqual(eveningState.find(function (i) { return i.id === 'no_late_training'; }).checked, false, 'unsaved no_late_training checkbox defaults to false');
assertEqual(eveningState.length, 7, 'evening item list has 7 items (5 original + screens_off + no_late_training)');
assertEqual(L.MORNING_ITEMS.length, 5, 'morning item list has 5 items');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node daily-routine-checklist-logic.selfcheck.cjs`
Expected: `FAIL: evening screens_off checkbox reflects saved true` (or a similar early failure), since `EVENING_ITEMS` doesn't have a `screens_off` item yet — `eveningState.find(...)` returns `undefined`, and `.checked` on `undefined` throws a `TypeError`. Either way, the script does not print `All daily-routine-checklist-logic tests passed.` and exits non-zero.

- [ ] **Step 3: Add the two items to `EVENING_ITEMS`**

Find this exact existing code in `daily-routine-checklist-logic.js` (lines 12-18):

```javascript
  const EVENING_ITEMS = [
    { id: 'dim_lights', label: 'Dim lights the last 1-2 hours before bed', kind: 'checkbox' },
    { id: 'cool_room', label: 'Cool room temperature', kind: 'checkbox' },
    { id: 'casein_snack', label: 'Casein snack (cottage cheese/Greek yogurt)', kind: 'checkbox' },
    { id: 'melatonin', label: '1mg melatonin', kind: 'checkbox' },
    { id: 'journal', label: 'Journal today', kind: 'live', vesselKey: 'journal' },
  ];
```

Replace with:

```javascript
  const EVENING_ITEMS = [
    { id: 'dim_lights', label: 'Dim lights the last 1-2 hours before bed', kind: 'checkbox' },
    { id: 'cool_room', label: 'Cool room temperature', kind: 'checkbox' },
    { id: 'casein_snack', label: 'Casein snack (cottage cheese/Greek yogurt)', kind: 'checkbox' },
    { id: 'melatonin', label: '1mg melatonin', kind: 'checkbox' },
    { id: 'screens_off', label: 'Phone/screens away 60-90 min before bed', kind: 'checkbox' },
    { id: 'no_late_training', label: 'No training within 2-3 hrs of bed', kind: 'checkbox' },
    { id: 'journal', label: 'Journal today', kind: 'live', vesselKey: 'journal' },
  ];
```

(The two new checkbox items are inserted before the `journal` live item, keeping `journal` last — matches `MORNING_ITEMS`'s own convention of ordering its one `live`-kind item last in the array.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node daily-routine-checklist-logic.selfcheck.cjs`
Expected: `All daily-routine-checklist-logic tests passed.` printed, exit code 0.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row
git add daily-routine-checklist-logic.js daily-routine-checklist-logic.selfcheck.cjs
git commit -m "feat: add screens-off and training-cutoff items to evening checklist"
```

- [ ] **Step 6: Manual browser check**

The Evening Shutdown panel that renders `EVENING_ITEMS` only appears after 5pm local time, gated by `mlEveningDue()` in `main.html` (`function mlEveningDue() { return new Date().getHours() >= 17; }`). If checking before 5pm, temporarily change that line to `return true;` for local verification only — **revert it before committing anything else**, this is not a real code change, just a local override to see the panel outside its normal hours.

With a real signed-in session: open `main.html`, navigate to wherever Morning Launch/Evening Shutdown renders, confirm both new items ("Phone/screens away 60-90 min before bed" and "No training within 2-3 hrs of bed") appear as checkboxes alongside the 5 existing items, in the same visual style. Check one, reload the page, confirm it's still checked (persistence via `rcSaveChecked`/localStorage, unchanged mechanism). If this requires real auth you don't have, disclose it as an unverified gap rather than skipping or faking — same posture as every other real-auth-gated feature this session.

---

## Completion

After Task 1: hand off to `superpowers:finishing-a-development-branch` — working directly on `main`, no branch to merge, so this mainly checks whether a pre-push code-review ask is warranted before pushing to `origin/main` (this project's own standing convention).
