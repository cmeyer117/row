// Pure functions (exported for testing) — no I/O, no Supabase/web-push calls here.

// Rest-day check uses REAL Eastern time (America/New_York) — this is Carl's
// actual calendar day, unlike the UTC-keyed workout data below. Do not
// simplify this to date.getUTCDay() — that would check the wrong weekday
// near the UTC/Eastern day boundary (see the boundary test case).
export function isRestDay(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(date);
  return weekday === 'Thursday' || weekday === 'Sunday';
}

// Matches gym.html's wtDateKey exactly. wtDateKey (gym-weight-photos.js:31-33)
// builds the key from LOCAL Date components (getFullYear/getMonth/getDate),
// not UTC — and gym.html runs in Carl's own browser (Eastern time), so the
// key is effectively an Eastern-time calendar date. doneDays[todayKey] at
// gym.html:4242-4247 is keyed by wtDateKey(new Date()). This function must
// reproduce that same Eastern-time date or the lookup misses near the
// UTC/Eastern day boundary. Do not use date.toISOString() here — that's UTC.
export function todayEasternKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function hasLoggedToday(workoutDone, date = new Date()) {
  if (!workoutDone) return false;
  return Boolean(workoutDone[todayEasternKey(date)]);
}
