// Pure functions (exported for testing) — no I/O, no Supabase/web-push
// calls here. Mirrors workout-nudge-logic.js's split.

import { todayCentralKey } from './workout-nudge-logic.js';

const DRIFT_MARGIN = 0.15; // >15% miss on either macro counts as an off day
const EPSILON = 1e-9; // guards the exact-15% boundary against float rounding

// Returns the last 3 completed Central-calendar-days (yesterday, 2 days
// ago, 3 days ago) relative to `date` — today is excluded since it isn't
// over yet. Subtracting whole days in UTC ms and re-deriving the Central
// key is safe for calendar-date purposes even across a DST boundary day.
export function last3CentralDates(date = new Date()) {
  const dates = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(date.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(todayCentralKey(d));
  }
  return dates;
}

export function sumDay(entries) {
  return entries.reduce(
    (sum, e) => ({
      protein_g: sum.protein_g + (e.protein_g || 0),
      calories: sum.calories + (e.calories || 0),
    }),
    { protein_g: 0, calories: 0 }
  );
}

export function isOffDay(daySum, targets) {
  const proteinMiss = Math.abs(daySum.protein_g - targets.proteinG) / targets.proteinG;
  const calorieMiss = Math.abs(daySum.calories - targets.calories) / targets.calories;
  return proteinMiss > DRIFT_MARGIN + EPSILON || calorieMiss > DRIFT_MARGIN + EPSILON;
}

// True only if the last 3 Central-calendar-days were ALL logged (at
// least one food_log row each) AND all 3 were off-target. A day with no
// rows doesn't count as off — it just fails to complete the streak, so
// under-logging doesn't falsely trigger this nudge.
export function isDrifting(foodLogRows, targets, date = new Date()) {
  const dates = last3CentralDates(date);
  const byDate = {};
  for (const row of foodLogRows) {
    if (!byDate[row.log_date]) byDate[row.log_date] = [];
    byDate[row.log_date].push(row);
  }
  const loggedDays = dates.filter((d) => byDate[d] && byDate[d].length > 0);
  if (loggedDays.length !== 3) return false;
  return loggedDays.every((d) => isOffDay(sumDay(byDate[d]), targets));
}
