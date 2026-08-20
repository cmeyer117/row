# Perfect Day Template + Planner — Design

**Date:** 2026-08-20
**Status:** Draft — pending Carl's review
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

`main.html`'s Goals tab is a flat, manually-typed daily list — no reusable structure for "what does an ideal day actually look like," and no way to schedule something ahead of the day it's due. Carl wants both: a fixed, time-blocked Perfect Day template he builds once and can revise, auto-applied and scored each day; and a forward-looking Planner for one-off future items that show up on Goals the day they're due.

## Ground truth (verified in-session)

- `main.html`'s Goals tab (`goals:<date>` key, array of `{text, done, id}`) is the bottom-bar "Goals" tab and the only daily hub — confirmed this is where "today" always gets checked, so Planner items must land here, not in a second place to check.
- `rollover()` (main.html:1021) runs once at boot: for every `goals:<date>` key older than today, it carries **undone** items forward into today's list by text-match, then **deletes the old date's key outright** (`storeDelete(k)`). This is destructive by design — old dates don't persist once rolled.
- `processStreak()` (main.html:1053) already computes a coarse "perfect day" signal — a day counts toward `goal_streak_v1` if **every** goal in that day's list was done, no distinction by source. This is a different, retroactive, all-goals metric from the Perfect-Day-template score this feature adds (template-items-only, computed live for today) — the two coexist, not replace each other.
- There's already a one-day-ahead staging list: `tomorrowKey()` returns the fixed key `important_v1` (not date-based), rendered as a second "Tomorrow" column next to Today, populated via a manual "Push remaining" button. Nothing ever auto-merges it into a `goals:<date>`. This is a static holding pen, unrelated to (and not replaced by) the date-anchored Planner below — worth knowing so the two aren't confused.
- Sync: `initCloudSync({ appKey: 'goals', syncedKeys: ['morning_outcomes_v1'], syncedPrefixes: ['goals:', 'morning_launch:', 'routine_checklist:'] })` (main.html:2526). New keys need adding to this call.
- `storeSet()` fires a `goals-changed` event whenever a `goals:` key is written — existing UI already listens for this to re-render; template/planner writes into `goals:<date>` get this for free.

## Scope

1. A **Perfect Day template**: a fixed, time-blocked list of items (`{time, label}`) that Carl builds once and edits from main.html. Every day, if not already seeded, today's list gets these items injected automatically, tagged so they're identifiable and scorable separately from manual/planned goals. **Fresh reset daily** — an unfinished template item does not roll forward; tomorrow gets a clean copy of the template regardless of what happened today.
2. A **Planner** (`planner.html`, new page): a forward-looking calendar for scheduling one-off items on a future date. On the day an item is due, it appears in that day's Goals list automatically (auto-merge, not a separate view to check).
3. A **Perfect Day score**: completed template items ÷ total template items, for today, shown on the Goals tab.

Out of scope for this pass: editing/removing an already-scheduled Planner item after its date has passed and rolled into Goals (it becomes an ordinary goal at that point, editable the normal way); a Planner month view (week view only); any change to the existing `important_v1` Tomorrow list or `goal_streak_v1` streak mechanic.

## Data model

**`perfectDay:template`** — new key, array of:
```js
{ id, time, label }   // time: "HH:MM" 24h, label: free text
```
Sorted by `time` on render, not necessarily on storage. Edited from a new collapsible section on main.html (add/edit/delete/reorder-by-time — no drag-and-drop, just re-sort on time edit).

**Goal items get two new optional fields** (existing shape `{text, done, id}` stays the base):
```js
{ text, done, id, source, time }
// source: 'template' | 'planned' | undefined (undefined = manual, today's existing behavior)
// time: "HH:MM", only present when source === 'template' (carried from the template item for display/sort)
```
`text` is still the display label for template/planned items (copied from the template's `label` or the planner item's title at seed time) — the rest of Goals' rendering, done-toggling, and delete logic needs zero changes, since `source`/`time` are just extra fields it can ignore or read.

**`planner:items`** — new key, array of:
```js
{ id, date, title, note }   // date: "YYYY-MM-DD", note optional
```
This is the *authoring* store — items live here from creation until their date arrives. Once merged into `goals:<date>` (see below), the planner entry is marked consumed (`mergedAt` timestamp) rather than deleted immediately, so the Planner's own calendar view can still show "this was scheduled and it landed" instead of the item just vanishing from Planner's history the moment it's due. A consumed item is inert — Planner never re-merges it.

**Sync**: both `perfectDay:template` and `planner:items` are single fixed keys (not date-varying), so they're added to the existing `initCloudSync` call's `syncedKeys` array (main.html:2528, alongside `morning_outcomes_v1`) — not `syncedPrefixes`, which is for the `goals:<date>`-style varying keys.

## Daily seed + merge (main.html boot sequence)

Two new functions, called in `main.html`'s existing boot block (main.html:2507) right after `rollover()` and before `processStreak()` — both need to see the day's final goal list, and streak scoring should reflect a day that already has its template/planned items seeded:

```js
function seedTemplateIfNeeded() {
  const todayK = todayKey();
  const today = getGoals(todayK);
  if (today.some(g => g.source === 'template')) return; // already seeded today
  const template = getGoals('perfectDay:template'); // reuse getGoals -- same array-or-[] shape
  if (!template.length) return;
  template.forEach(t => {
    today.push({ text: t.label, done: false, id: newId('pd'), source: 'template', time: t.time });
  });
  setGoals(todayK, today);
}

function mergeDuePlannerItems() {
  const todayDateStr = getActiveDateString();
  const items = storeGet('planner:items') || [];
  const due = items.filter(p => p.date === todayDateStr && !p.mergedAt);
  if (!due.length) return;
  const today = getGoals(todayKey());
  due.forEach(p => {
    today.push({ text: p.title, done: false, id: newId('pl'), source: 'planned' });
    p.mergedAt = new Date().toISOString();
  });
  setGoals(todayKey(), today);
  storeSet('planner:items', items);
}
```

Idempotency: `seedTemplateIfNeeded` checks for an existing `source: 'template'` item before seeding, so re-running boot mid-day (tab refocus, etc.) never double-seeds. `mergeDuePlannerItems` checks `mergedAt` per-item for the same reason. Both are safe to call on every boot, same as `rollover()` already is.

**`rollover()` needs one change**: its carry-forward filter (main.html:1035, `if (!g.done && g.text && !texts.has(g.text))`) must exclude template-sourced items so they reset fresh instead of chasing an incomplete day forward:
```js
if (!g.done && g.text && !texts.has(g.text) && g.source !== 'template') {
```
Planned items are *not* excluded — an undone planned item rolling forward like a normal goal is the right behavior (it was a real commitment for that date, not a recurring template slot). Since `mergeDuePlannerItems` already stamped `mergedAt` when it landed on its due date, rollover won't double-process it from `planner:items` again either way — rollover only ever touches `goals:` keys.

## Perfect Day score

Pure function, small enough to inline in main.html rather than a new `-logic.js` file (no separate test-runnable module needed — this is a two-line reduction over an array Row's tests wouldn't meaningfully exercise beyond what a manual smoke-check already covers):
```js
function perfectDayScore(goals) {
  const items = goals.filter(g => g.source === 'template');
  if (!items.length) return null; // no template configured yet
  return { done: items.filter(g => g.done).length, total: items.length };
}
```
Displayed as "Perfect Day: 6/9" near the top of the Goals tab, next to (not replacing) the existing streak display. `null` (no template yet) renders nothing — same first-run-silence convention `readiness-index-logic.js` uses elsewhere in this app.

## UI

**main.html — Perfect Day template editor**: new collapsible section (collapsed by default, matches `gym.html`'s `.poster-section` expand/collapse pattern) above or below the goal list. Each row: time input + label input + delete. An "Add item" row at the bottom. Saves straight to `perfectDay:template` on blur/change — no separate Save button, matching Goals' own inline-edit convention.

**main.html — Goals list rendering**: template/planned items render inline in the same list as manual goals (no visual separation into sub-sections — a flat list keeps "what do I need to do today" as one glance, per the earlier decision to auto-merge rather than fragment views). A small time chip (e.g. "7:00") prefixes template items so the time-blocked intent is visible; planned items get no special marker beyond being present.

**`planner.html` — new page**: week-view calendar (7-day strip, matches `gym.html`'s existing `#weekStrip` pattern for visual consistency — read this component before building, don't reinvent the strip). Tap a day to see/add its scheduled items (title + optional note). No time-of-day field for planner items (v1 — Planner is "this is due this day," not time-blocked like the template). Reachable from main.html via a small link/button in the Perfect Day template section's header (same treatment as gym.html's "🏆 Posing" quick-link pill added earlier this session) — not a new topbar/bottombar entry, to avoid re-introducing the clutter that was just removed from Row's global nav.

## Error handling

- No template configured yet → `seedTemplateIfNeeded` no-ops, `perfectDayScore` returns `null`, nothing renders. Not an error state.
- Template edited mid-day (a row added/removed) → does not retroactively touch today's already-seeded items; takes effect starting the next day that hasn't been seeded yet. Matches the "seed once per day" idempotency check.
- A Planner item's date arrives while the app was never opened that day → next boot's `rollover()` runs first (for the *previous* stale day, if any) then `mergeDuePlannerItems` checks against *today's* real date, so a due item still lands correctly regardless of how many days the app sat unopened.
- Deleting a Planner item before its date arrives → straightforward removal from `planner:items`, no merge ever happens. Deleting one *after* it merged is just deleting the resulting goal item normally (no `planner:items` cleanup needed since `mergedAt` already marked it inert).

## Testing

No new `-logic.js` module is introduced (the two boot functions and the score function are small and directly coupled to `main.html`'s existing storage helpers, matching how `rollover()`/`processStreak()` themselves are untested inline functions today, not pulled into a separate testable file). Verification is manual/browser-based per Row's existing convention for `main.html`-local logic:

- Add 2-3 Perfect Day template items, confirm they seed into today's Goals list with time chips, confirm the score line appears and updates as items are checked.
- Leave a template item unchecked, reload the next day (or force `getActiveDateString()` forward in devtools), confirm it does NOT carry forward and today gets a fresh unchecked copy.
- Add a Planner item for 2 days out, confirm it does not appear in Goals until that date, confirm it appears automatically (no manual action) once the date arrives, confirm it behaves like a normal goal afterward (checkable, rolls forward if undone).
- Confirm existing manual-goal add/check/delete/rollover/streak behavior is unchanged (regression pass on the existing Goals flow).
