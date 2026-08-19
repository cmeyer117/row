import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendMealNudge } from './meal-log-nudge-logic.js';

test('shouldSendMealNudge: fewer rows logged today than this meal slot -> true', () => {
  assert.equal(shouldSendMealNudge(0, 1), true); // no meals logged yet, breakfast window
  assert.equal(shouldSendMealNudge(1, 2), true); // 1 logged, lunch window (slot 2)
});

test('shouldSendMealNudge: rows logged today equal to this meal slot -> false (caught up)', () => {
  assert.equal(shouldSendMealNudge(2, 2), false);
});

test('shouldSendMealNudge: rows logged today exceed this meal slot -> false', () => {
  assert.equal(shouldSendMealNudge(4, 2), false);
});
