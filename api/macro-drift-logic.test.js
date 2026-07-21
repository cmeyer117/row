import { test } from 'node:test';
import assert from 'node:assert/strict';
import { last3EasternDates, sumDay, isOffDay, isDrifting } from './macro-drift-logic.js';

const TARGETS = { proteinG: 261, carbG: 338, fatG: 53, calories: 2930 };

test('last3EasternDates: returns yesterday, 2 days ago, 3 days ago in Eastern time', () => {
  // 2026-07-21T23:30:00Z is 2026-07-21 7:30pm Eastern (EDT, UTC-4).
  const now = new Date('2026-07-21T23:30:00Z');
  assert.deepEqual(last3EasternDates(now), ['2026-07-20', '2026-07-19', '2026-07-18']);
});

test('sumDay: sums protein_g and calories across food_log rows for one day', () => {
  const entries = [
    { protein_g: 40, calories: 500 },
    { protein_g: 30, calories: 400 },
  ];
  assert.deepEqual(sumDay(entries), { protein_g: 70, calories: 900 });
});

test('isOffDay: exactly 15% miss on protein is NOT off (boundary, not inclusive)', () => {
  // 261 * 0.85 = 221.85 -> exactly 15% under
  const daySum = { protein_g: 221.85, calories: 2930 };
  assert.equal(isOffDay(daySum, TARGETS), false);
});

test('isOffDay: more than 15% miss on protein is off', () => {
  const daySum = { protein_g: 200, calories: 2930 }; // ~23% under protein
  assert.equal(isOffDay(daySum, TARGETS), true);
});

test('isOffDay: more than 15% miss on calories (protein fine) is off', () => {
  const daySum = { protein_g: 261, calories: 2000 }; // ~32% under calories
  assert.equal(isOffDay(daySum, TARGETS), true);
});

test('isOffDay: within 15% on both is not off', () => {
  const daySum = { protein_g: 250, calories: 2800 };
  assert.equal(isOffDay(daySum, TARGETS), false);
});

test('isDrifting: all 3 of the last 3 logged days off -> true', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const foodLogRows = [
    { log_date: '2026-07-20', protein_g: 100, calories: 1500 },
    { log_date: '2026-07-19', protein_g: 100, calories: 1500 },
    { log_date: '2026-07-18', protein_g: 100, calories: 1500 },
  ];
  assert.equal(isDrifting(foodLogRows, TARGETS, now), true);
});

test('isDrifting: only 2 of the last 3 days logged -> false (not enough data)', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const foodLogRows = [
    { log_date: '2026-07-20', protein_g: 100, calories: 1500 },
    { log_date: '2026-07-19', protein_g: 100, calories: 1500 },
  ];
  assert.equal(isDrifting(foodLogRows, TARGETS, now), false);
});

test('isDrifting: 3 logged days but one is on-target -> false', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const foodLogRows = [
    { log_date: '2026-07-20', protein_g: 100, calories: 1500 },
    { log_date: '2026-07-19', protein_g: 260, calories: 2900 }, // on target
    { log_date: '2026-07-18', protein_g: 100, calories: 1500 },
  ];
  assert.equal(isDrifting(foodLogRows, TARGETS, now), false);
});

test('isDrifting: multiple food_log rows on the same day get summed before the off-day check', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const foodLogRows = [
    { log_date: '2026-07-20', protein_g: 50, calories: 750 },
    { log_date: '2026-07-20', protein_g: 50, calories: 750 }, // same day, 2nd meal entry
    { log_date: '2026-07-19', protein_g: 100, calories: 1500 },
    { log_date: '2026-07-18', protein_g: 100, calories: 1500 },
  ];
  // 2026-07-20 sums to 100/1500, still off -> still drifting
  assert.equal(isDrifting(foodLogRows, TARGETS, now), true);
});
