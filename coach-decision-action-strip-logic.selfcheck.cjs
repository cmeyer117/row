// Run with: node coach-decision-action-strip-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'coach-decision-action-strip-logic.js'), 'utf8'), sandbox);
const C = sandbox.window.CoachDecisionActionStripLogic;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

// --- both structured Rx values with targets/guardrails ---
assertEqual(
  C.buildWeeklyFocusActions({
    details: {
      cardio_rx: { target: 3, guardrail: 'keep HR under 140' },
      posing_rx: { target: 2, guardrail: null },
    },
  }),
  [
    { kind: 'cardio', label: 'Cardio', text: '3 sessions this week — keep HR under 140', href: 'health.html' },
    { kind: 'posing', label: 'Posing', text: '2 sessions this week', href: 'posing.html' },
  ],
  'both structured Rx -> two rows, correct pluralization and guardrail join'
);

// --- one structured Rx (target === 1, singular wording) ---
assertEqual(
  C.buildWeeklyFocusActions({ details: { cardio_rx: { target: 1 } } }),
  [{ kind: 'cardio', label: 'Cardio', text: '1 session this week', href: 'health.html' }],
  'one structured Rx, target=1 -> singular "session", no posing row'
);

// --- legacy string Rx ---
assertEqual(
  C.buildWeeklyFocusActions({ details: { cardio_rx: '3x this week, easy pace' } }),
  [{ kind: 'cardio', label: 'Cardio', text: '3x this week, easy pace', href: 'health.html' }],
  'legacy string Rx renders safely as-is'
);

// --- missing Rx, decision-text fallback ---
assertEqual(
  C.buildWeeklyFocusActions({ details: {}, decision_text: 'Hold current volume, reassess Friday.' }),
  [{ kind: 'decision', label: "This week's decision", text: 'Hold current volume, reassess Friday.', href: 'weekly-review.html' }],
  'no Rx but decision_text present -> single fallback row'
);

// --- missing everything ---
assertEqual(C.buildWeeklyFocusActions({ details: {}, decision_text: '' }), [], 'no Rx, empty decision_text -> no rows');
assertEqual(C.buildWeeklyFocusActions(null), [], 'null decision -> no rows, no throw');
assertEqual(C.buildWeeklyFocusActions(undefined), [], 'undefined decision -> no rows, no throw');

// --- malformed details ---
assertEqual(C.buildWeeklyFocusActions({ details: null, decision_text: 'fallback' }), [
  { kind: 'decision', label: "This week's decision", text: 'fallback', href: 'weekly-review.html' },
], 'details: null -> treated as empty, falls through to decision_text');
assertEqual(C.buildWeeklyFocusActions({ details: [1, 2, 3], decision_text: 'fallback' }), [
  { kind: 'decision', label: "This week's decision", text: 'fallback', href: 'weekly-review.html' },
], 'details: array -> treated as empty, not a valid Rx container');
assertEqual(C.buildWeeklyFocusActions({ details: { cardio_rx: ['not', 'an', 'object'] } }), [], 'cardio_rx: array -> ignored, not a valid Rx shape');

// --- numeric/string target edge cases ---
assertEqual(
  C.buildWeeklyFocusActions({ details: { cardio_rx: { target: '4' } } }),
  [{ kind: 'cardio', label: 'Cardio', text: '4 sessions this week', href: 'health.html' }],
  'string-numeric target coerces correctly'
);
assertEqual(C.buildWeeklyFocusActions({ details: { cardio_rx: { target: 0 } } }), [], 'target=0 -> not a valid target, no guardrail -> ignored');
assertEqual(C.buildWeeklyFocusActions({ details: { cardio_rx: { target: -2 } } }), [], 'negative target -> invalid, ignored');
assertEqual(C.buildWeeklyFocusActions({ details: { cardio_rx: { target: 'not a number' } } }), [], 'non-numeric string target, no guardrail -> ignored');
assertEqual(
  C.buildWeeklyFocusActions({ details: { cardio_rx: { target: 'bad', guardrail: 'still show this' } } }),
  [{ kind: 'cardio', label: 'Cardio', text: 'still show this', href: 'health.html' }],
  'invalid target but real guardrail -> guardrail-only row'
);

// --- two-Rx limit: never a third row from decision_text when Rx exists ---
assertEqual(
  C.buildWeeklyFocusActions({ details: { cardio_rx: { target: 1 } }, decision_text: 'should not appear' }).length,
  1,
  'decision_text is fallback-only, never appended as a third row when Rx exists'
);

console.log('coach-decision-action-strip-logic.selfcheck.cjs: all assertions passed');
