import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRestDay, hasLoggedToday, todayUtcKey } from './workout-nudge-logic.js';

test('isRestDay: Thursday in Central time is a rest day', () => {
  // 2026-07-23 is a Thursday. Noon UTC on that date is still Thursday in Central time.
  const thursdayNoonUtc = new Date('2026-07-23T12:00:00Z');
  assert.equal(isRestDay(thursdayNoonUtc), true);
});

test('isRestDay: Sunday in Central time is a rest day', () => {
  // 2026-07-19 is a Sunday.
  const sundayNoonUtc = new Date('2026-07-19T12:00:00Z');
  assert.equal(isRestDay(sundayNoonUtc), true);
});

test('isRestDay: Tuesday is not a rest day', () => {
  // 2026-07-21 is a Tuesday.
  const tuesdayNoonUtc = new Date('2026-07-21T12:00:00Z');
  assert.equal(isRestDay(tuesdayNoonUtc), false);
});

test('isRestDay: UTC/Central day boundary — 1am UTC Thursday is still Wednesday night Central', () => {
  // 2026-07-23T01:00:00Z is 2026-07-22 8pm Central (CDT, UTC-5) — still Wednesday there.
  const earlyUtcThursday = new Date('2026-07-23T01:00:00Z');
  assert.equal(isRestDay(earlyUtcThursday), false);
});

test('todayUtcKey: matches gym.html\'s wtDateKey format (UTC ISO date)', () => {
  const d = new Date('2026-07-21T23:30:00Z');
  assert.equal(todayUtcKey(d), '2026-07-21');
});

test('hasLoggedToday: true when today\'s UTC key exists in workout_done object', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const workoutDone = { '2026-07-20': '2026-07-20T10:00:00.000Z', '2026-07-21': '2026-07-21T09:00:00.000Z' };
  assert.equal(hasLoggedToday(workoutDone, now), true);
});

test('hasLoggedToday: false when today\'s UTC key is missing', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const workoutDone = { '2026-07-20': '2026-07-20T10:00:00.000Z' };
  assert.equal(hasLoggedToday(workoutDone, now), false);
});

test('hasLoggedToday: false when workoutDone is empty/undefined', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  assert.equal(hasLoggedToday(undefined, now), false);
  assert.equal(hasLoggedToday({}, now), false);
});
