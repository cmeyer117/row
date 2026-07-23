import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRestDay, hasLoggedToday, todayEasternKey } from './workout-nudge-logic.js';

test('isRestDay: Thursday in Eastern time is a rest day', () => {
  // 2026-07-23 is a Thursday. Noon UTC on that date is still Thursday in Eastern time.
  const thursdayNoonUtc = new Date('2026-07-23T12:00:00Z');
  assert.equal(isRestDay(thursdayNoonUtc), true);
});

test('isRestDay: Sunday in Eastern time is a rest day', () => {
  // 2026-07-19 is a Sunday.
  const sundayNoonUtc = new Date('2026-07-19T12:00:00Z');
  assert.equal(isRestDay(sundayNoonUtc), true);
});

test('isRestDay: Tuesday is not a rest day', () => {
  // 2026-07-21 is a Tuesday.
  const tuesdayNoonUtc = new Date('2026-07-21T12:00:00Z');
  assert.equal(isRestDay(tuesdayNoonUtc), false);
});

test('isRestDay: UTC/Eastern day boundary — 3am UTC Thursday is still Wednesday night Eastern', () => {
  // 2026-07-23T03:00:00Z is 2026-07-22 11pm Eastern (EDT, UTC-4) — still Wednesday there.
  const earlyUtcThursday = new Date('2026-07-23T03:00:00Z');
  assert.equal(isRestDay(earlyUtcThursday), false);
});

test('todayEasternKey: matches gym.html\'s wtDateKey format (local/Eastern date)', () => {
  // 2026-07-21T23:30:00Z is 7:30pm Eastern (EDT, UTC-4) — same calendar day as UTC here.
  const d = new Date('2026-07-21T23:30:00Z');
  assert.equal(todayEasternKey(d), '2026-07-21');
});

test('todayEasternKey: UTC/Eastern day boundary — 3:59am UTC is still previous day Eastern', () => {
  // 2026-07-22T03:59:00Z is 2026-07-21 11:59pm Eastern (EDT, UTC-4) — one minute before midnight there.
  const earlyUtc = new Date('2026-07-22T03:59:00Z');
  assert.equal(todayEasternKey(earlyUtc), '2026-07-21');
});

test('hasLoggedToday: true when today\'s Eastern key exists in workout_done object', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const workoutDone = { '2026-07-20': '2026-07-20T10:00:00.000Z', '2026-07-21': '2026-07-21T09:00:00.000Z' };
  assert.equal(hasLoggedToday(workoutDone, now), true);
});

test('hasLoggedToday: false when today\'s Eastern key is missing', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const workoutDone = { '2026-07-20': '2026-07-20T10:00:00.000Z' };
  assert.equal(hasLoggedToday(workoutDone, now), false);
});

test('hasLoggedToday: false when workoutDone is empty/undefined', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  assert.equal(hasLoggedToday(undefined, now), false);
  assert.equal(hasLoggedToday({}, now), false);
});
