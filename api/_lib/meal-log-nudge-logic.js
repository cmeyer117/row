// Pure function (exported for testing) — no I/O here, mirrors
// workout-nudge-logic.js / macro-drift-logic.js's split.
//
// Coarse heuristic: total food_log rows logged today vs. this cron fire's
// meal-slot index (1=breakfast ... 4=post-gym). Correct enough to decide
// "nudge or not" without nagging on a caught-up day; it does NOT know
// whether the *specific* meal for this window was logged, only the count.
export function shouldSendMealNudge(rowCountToday, mealIndex) {
  return rowCountToday < mealIndex;
}
