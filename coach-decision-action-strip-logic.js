// coach-decision-action-strip-logic.js -- pure display-model builder for
// index.html's active weekly coach-decision strip. No DOM, no Supabase.
(function () {
  'use strict';

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function numberTarget(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      var parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
  }

  function formatRxAction(kind, rx) {
    var label = kind === 'cardio' ? 'Cardio' : 'Posing';
    var href = kind === 'cardio' ? 'health.html' : 'posing.html';
    var legacy = cleanText(rx);
    if (legacy) return { kind: kind, label: label, text: legacy, href: href };
    if (!rx || typeof rx !== 'object' || Array.isArray(rx)) return null;

    var target = numberTarget(rx.target);
    var guardrail = cleanText(rx.guardrail);
    if (target == null && !guardrail) return null;

    var parts = [];
    if (target != null) parts.push(target + ' session' + (target === 1 ? '' : 's') + ' this week');
    if (guardrail) parts.push(guardrail);
    return { kind: kind, label: label, text: parts.join(' — '), href: href };
  }

  function buildWeeklyFocusActions(decision) {
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return [];
    var details = decision.details && typeof decision.details === 'object' && !Array.isArray(decision.details)
      ? decision.details
      : {};
    var actions = [
      formatRxAction('cardio', details.cardio_rx),
      formatRxAction('posing', details.posing_rx)
    ].filter(Boolean);
    if (actions.length) return actions;

    var decisionText = cleanText(decision.decision_text);
    return decisionText
      ? [{ kind: 'decision', label: "This week's decision", text: decisionText, href: 'weekly-review.html' }]
      : [];
  }

  var api = { buildWeeklyFocusActions: buildWeeklyFocusActions };
  if (typeof window !== 'undefined') window.CoachDecisionActionStripLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
