import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasStartedToday } from './morning-launch-nudge-logic.js';

test('hasStartedToday: true when today\'s Eastern-keyed session exists', () => {
  const now = new Date('2026-07-21T23:30:00Z'); // 7:30pm Eastern, same calendar day
  const goalsAppState = { 'morning_launch:2026-07-21': { version: 1, currentPhase: 'align' } };
  assert.equal(hasStartedToday(goalsAppState, now), true);
});

test('hasStartedToday: false when only a different day\'s session exists', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  const goalsAppState = { 'morning_launch:2026-07-20': { version: 1 } };
  assert.equal(hasStartedToday(goalsAppState, now), false);
});

test('hasStartedToday: false when goalsAppState is empty/undefined', () => {
  const now = new Date('2026-07-21T23:30:00Z');
  assert.equal(hasStartedToday(undefined, now), false);
  assert.equal(hasStartedToday({}, now), false);
});

test('hasStartedToday: Eastern day boundary — 3:59am UTC is still previous Eastern day', () => {
  // Same boundary case workout-nudge-logic.test.js covers for todayEasternKey.
  const earlyUtc = new Date('2026-07-22T03:59:00Z'); // 2026-07-21 11:59pm Eastern
  const goalsAppState = { 'morning_launch:2026-07-21': { version: 1 } };
  assert.equal(hasStartedToday(goalsAppState, earlyUtc), true);
});
