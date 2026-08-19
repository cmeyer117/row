# Meal-log nudge — design spec

## Problem

`food_log` has had zero rows since the app shipped (~08-05) through the RLS/auth
write-path fix (08-15) and 4 days after it (checked live via Supabase MCP,
2026-08-19: `count(*) = 0`). The write path itself is confirmed sound — real
Supabase Auth session required, RLS-gated, insert errors surface via `alert()`
(macros.html:319-338). Carl confirmed (2026-08-19) he's opened macros.html but
not logged: the blocker is a mix of (a) no fast match when a meal isn't a saved
Coach Plan/Recent/Favorite, and (b) nothing prompts him at the moment he's
actually eating.

The "poor adherence" mislabeling this task originally worried about is **already
fixed**: `prefetchMacroAdherence()` (gym.html:7498-7503) treats zero food_log
rows for yesterday as `null` ("no data"), and `applyCheckinOverride()`
(gym.html:3668-3673) only surfaces the "macros were under target" reason when
`macroAdherencePoor` is strictly `true`. No further work needed there.

Per the original review, this is an activation/UX problem, not a missing
feature — the fix here is a trigger, not a new logging mechanism. Deliberately
NOT building a faster ad-hoc entry path yet; that's justified only if nudges
alone don't get to the 14-day success bar.

## Scope

Add a `meal-log` push nudge, fired at Carl's actual eating windows (per his
2026-08-19 answer): ~10:30am, ~1pm, ~3pm (pre-gym), ~7:30pm (post-gym) Eastern.
Each fire checks today's `food_log` row count; skips if Carl has already
logged at least as many meals today as this window's index, so a caught-up day
doesn't nag. Deep-links to `/macros.html` (Quick Add is already the default
view there).

Out of scope: any change to macros.html/gym.html UI, any new logging
mechanism, any change to the existing `macro-drift` nudge.

## Design

**Logic module** — `api/_lib/meal-log-nudge-logic.js` (mirrors
`workout-nudge-logic.js`/`macro-drift-logic.js`'s split: pure functions, no I/O):

```js
export function shouldSendMealNudge(rowCountToday, mealIndex) {
  return rowCountToday < mealIndex;
}
```

`mealIndex` is 1-4, matching cron-fire order (breakfast=1, ... post-gym=4).
Ponytail: this is a coarse heuristic (total count vs. slot index, not "was
*this specific* meal logged") — correct enough for a nudge-or-not decision,
wrong tool if this needs to know *which* meal was skipped.

**Nudge function** — `mealLog(mealIndex, force)` in `api/_lib/nudges.js`,
following the existing `workout`/`morningLaunch` shape:

```js
async function mealLog(mealIndex, force) {
  if (!force) {
    const today = todayEasternKey();
    const rows = await fetchFoodLogCount(today);
    if (!shouldSendMealNudge(rows, mealIndex)) {
      return { status: 200, body: { message: 'Already logged enough today, no push sent' } };
    }
  }
  return push({ body: 'Log a meal — quick add', url: '/macros.html' });
}
```

`fetchFoodLogCount(date)` — new helper alongside the existing `fetchFoodLog`,
using Supabase's `Prefer: count=exact` / `select=id` to avoid pulling full rows.

Registered in `NUDGES` as `'meal-log'`, taking `mealIndex` from
`req.query.meal` (parsed int, 1-4) in `send-nudge.js` and passed through.
`send-nudge.js` currently only threads `force`; add `meal` the same way,
defaulting to a validation error if missing/out of range for this type only
(other nudge types ignore it).

**Cron** — one workflow file, `.github/workflows/meal-log-nudge.yml`, with 4
`schedule:` entries (14:30, 17:00, 19:00, 23:30 UTC — DST drift accepted
un-corrected, same as the existing nudges). A bash step maps the current UTC
hour to a meal index (1/2/3/4) and calls
`/api/send-nudge?type=meal-log&meal=N`. Mirrors `macro-drift-nudge.yml`'s
response-checking (200 + sent==total or fail the job).

## Testing

`api/_lib/meal-log-nudge-logic.test.js` — same style as
`macro-drift-logic.test.js`: table of `(rowCountToday, mealIndex) → expected`
covering under/equal/over the threshold.

## Rollout / success check

Ship, then re-check `food_log` row count via Supabase MCP after 14 days
(2026-09-02): 10+ distinct `log_date`s with real entries = activation worked,
keep the nudge as-is. Fewer = the friction is deeper than "not top of mind"
(matches Carl's own "little mix of 2 and 3" answer) and the ad-hoc-entry
option (Approach B, deferred) is next.
