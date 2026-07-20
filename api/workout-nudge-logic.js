// Pure functions (exported for testing) — no I/O, no Supabase/web-push calls here.

// Rest-day check uses REAL Central time (America/Chicago) — this is Carl's
// actual calendar day, unlike the UTC-keyed workout data below. Do not
// simplify this to date.getUTCDay() — that would check the wrong weekday
// near the UTC/Central day boundary (see the boundary test case).
export function isRestDay(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long' }).format(date);
  return weekday === 'Thursday' || weekday === 'Sunday';
}

// Matches gym.html's wtDateKey exactly: UTC ISO date, NOT Central-converted.
// Row's own workout-done data is keyed this way (gym.html:5085,
// doneDays[todayKey] = new Date().toISOString() at gym.html:4247) — this
// function must produce the identical key format or the lookup always misses.
export function todayUtcKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function hasLoggedToday(workoutDone, date = new Date()) {
  if (!workoutDone) return false;
  return Boolean(workoutDone[todayUtcKey(date)]);
}
