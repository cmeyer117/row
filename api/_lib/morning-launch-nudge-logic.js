import { todayEasternKey } from './workout-nudge-logic.js';

// goalsAppState is the `data` object of the app_state row keyed 'goals'
// (main.html's initCloudSync({ appKey: 'goals', ... })) -- session state is
// stored under the literal localStorage key 'morning_launch:<date>' inside it,
// same convention hasLoggedToday uses for 'po-coach'/po_coach_workout_done.
export function hasStartedToday(goalsAppState, date = new Date()) {
  if (!goalsAppState) return false;
  const key = 'morning_launch:' + todayEasternKey(date);
  return Boolean(goalsAppState[key]);
}
