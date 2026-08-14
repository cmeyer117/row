# Macro-Adherence Bridge — Design

**Date:** 2026-08-14
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

The last piece of the `coachSnapshot` backlog. Unlike cardio/posing (net-new tracking, `BACKLOG.md` had this right) or sleep (existing localStorage data just needed wiring), macro adherence turns out to be a genuine third shape: **the computation already exists, but the underlying data lives in a live Supabase table, not localStorage** — and `getRx()`/`applyCheckinOverride()` are fully synchronous today, called repeatedly per render with no `await` anywhere in them.

## Ground truth (verified in-session)

- `macro-calc.js`'s `remainingBudget(targets, entries)` already computes exactly what's needed — consumed totals per macro and the remaining gap against target. Pure, already used by `macros.html`, no new math to write.
- `food_log` (macros.html's daily entries) is a live Supabase table queried directly (`client.from('food_log').select('*').eq('log_date', ...)`), not synced through the `app_state`/localStorage mechanism every other bridge this session relied on. `macro_targets` (the target values themselves) *is* a synced localStorage key already (`syncedKeys` in both `health.html` and `macros.html`), so `gym.html` can already read it directly the same way it reads `po_coach_season`/`health:sleep` — only the logged entries require a live query.
- `getRx()`'s two call sites and `applyCheckinOverride()` have zero `await` in them today. Making them async to support a live query would ripple into all three call sites — a materially bigger change than anything else built today.

## Approach

**Prefetch once at page load, cache synchronously-readable results, no changes to `getRx()`'s signature or call sites.** A new async function runs once when `gym.html` loads: reads `macro_targets` from localStorage, queries `food_log` for **yesterday's** date (not today's — see below), computes `MacroCalc.remainingBudget()`, classifies adherence, and stores the result in a module-level cache variable. `applyCheckinOverride()` reads that cache synchronously — if the fetch hasn't completed yet (or found nothing), the cache is `null` and the check no-ops, the same "no data = no override" fallback every other signal (checkin, sleep) already uses.

**Yesterday, not today.** Sleep's signal is same-day (how did you sleep going into today's session). Food is different: today's log is still accumulating during the day, so querying it mid-session would show a misleadingly large "remaining" gap for anyone training before their day's meals are logged. Yesterday's log is complete and answers the actually-relevant question — was recovery fueled going into today.

**Zero entries ≠ poor adherence.** If `food_log` has no rows at all for yesterday, that's most likely "didn't use the app that day," not "ate nothing" — treating it as poor would falsely flag every day Carl doesn't log meticulously. The prefetch glue treats zero entries as "no signal" (cache stays `null`), same as a missing sleep entry or missing checkin.

### `macro-calc.js` addition

```js
// consumed: { protein_g, carb_g, fat_g, calories } (remainingBudget(...).consumed).
// targets: { proteinG, carbG, fatG, calories }. Poor adherence = calories or
// protein fell meaningfully short (< 80%) of target -- these two drive
// training performance/recovery most directly; carb/fat gaps alone don't
// trigger this on their own.
function isPoorMacroAdherence(consumed, targets) {
  if (!consumed || !targets) return false;
  const calLow = (targets.calories || 0) > 0 && consumed.calories < 0.8 * targets.calories;
  const proteinLow = (targets.proteinG || 0) > 0 && consumed.protein_g < 0.8 * targets.proteinG;
  return calLow || proteinLow;
}
```

Exported alongside `remainingBudget` etc. `gym.html` gains a `<script src="macro-calc.js">` tag (new to that page, already loaded by `macros.html`) — reuses the existing module rather than duplicating the math.

### `gym.html` changes

- New module-level `let macroAdherencePoor = null;` (three states: `null` = no data yet/unknown, `true`/`false` = classified).
- New async function, run once at page init (same section as the existing `pcInitCloudSync` IIFE): reads `macro_targets` from localStorage, queries `food_log` for yesterday's `log_date`, and — only if `entries.length > 0` — computes `remainingBudget` then `isPoorMacroAdherence`, storing the boolean into `macroAdherencePoor`. Any failure (not signed in, query error, no targets) leaves it `null`.
- `applyCheckinOverride()`'s trigger condition becomes `(recoveryLow || sleepPoor || macroAdherencePoor) && result.type === 'up'`.
- Reason-text building changes from the sleep bridge's nested ternary (which only scaled to 2 signals) to collecting an array of fired-signal fragments and joining them — this scales cleanly to 3 signals without a ternary explosion, and is a direct improvement to the exact function this bridge extends further (not an unrelated refactor):
  ```js
  const reasons = [];
  if (recoveryLow) reasons.push('recovery was low last time');
  if (sleepPoor) reasons.push('sleep was short/poor last night');
  if (macroAdherencePoor) reasons.push('macros were under target yesterday');
  const reasonSource = reasons.join(' and ');
  ```

## Error handling

- Not signed in / query fails / no `macro_targets` set / zero entries yesterday → `macroAdherencePoor` stays `null`, `applyCheckinOverride()` behaves exactly as it does today for that signal (falls through to whatever `recoveryLow`/`sleepPoor` alone decide).
- The prefetch itself never throws into the page — same try/catch-to-null convention every other localStorage/Supabase read in this codebase already uses.

## Out of scope

- Any UI display of macro adherence inside `gym.html` (Rx card text is the only surface — no new dashboard).
- Re-fetching mid-session if `food_log` changes after page load (single fetch at load, matching the "good enough for a single-user app" tradeoff already accepted elsewhere in this codebase).
- Carb/fat-only shortfalls triggering the cap on their own (calories/protein are the two most directly tied to training performance; a real carb/fat gap alone doesn't cap an upgrade here).

## Testing

`macro-calc.selfcheck.cjs` already exists — extend it with `isPoorMacroAdherence` cases: both above target → false; calories under 80% → true; protein under 80% → true; both under 80% → true; carb/fat under target alone (calories/protein fine) → false; null consumed or targets → false.

`gym.html`'s prefetch/wiring stays untested glue, consistent with every other page-level integration this session (`getRx()`, `applyCheckinOverride()` themselves have no dedicated test file; only the pure logic they call does).

Browser verification: log a low-calorie, low-protein day in `macros.html` for yesterday's date (if the UI allows backdating; otherwise verify the query logic against a manually-inserted `food_log` row for yesterday via the Supabase dashboard). Load `gym.html`, wait for the prefetch to resolve, and confirm an exercise that would normally show "Add weight" now shows the capped hold with a reason mentioning macros. Confirm a day with zero `food_log` rows yesterday behaves identically to today's code (no macro-driven override). Confirm the existing sleep-only and recovery-only cases from the sleep bridge still produce their original single-reason text (regression check on the reason-building refactor).
