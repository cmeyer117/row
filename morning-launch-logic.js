// morning-launch-logic.js — pure functions for the Morning Launch ritual
// (phase progression, validation, if-then formatting, legacy-goal ID
// upgrade, mover/Today reconciliation, snapshots, Vault-export
// projection). No DOM, no storage — see main.html for the wiring.
// Dual export like gym-volume-logic.js.
(function () {
  'use strict';

  var PHASE_ORDER = ['clear', 'align', 'visualize', 'commit', 'complete'];

  function isNonEmpty(s) {
    return typeof s === 'string' && s.trim().length > 0;
  }

  function newSession(date) {
    return {
      version: 1,
      date: date,
      status: 'draft',
      currentPhase: 'clear',
      brainDump: '',
      recalledOutcomes: [],
      savedOutcomeSnapshot: null,
      focusOutcomeId: null,
      processVisualization: '',
      obstacle: '',
      response: '',
      needleMovers: [],
      winMoverId: null,
      skipReason: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      evening: null
    };
  }

  // Returns {ok, errors} — never throws for ordinary incomplete-draft input.
  function validateOutcomes(outcomes) {
    var active = (outcomes || []).filter(function (o) { return o && o.active; });
    var errors = [];
    if (active.length !== 5) {
      errors.push('Exactly five active outcomes are required (found ' + active.length + ').');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function canEnterPhase(session, phase) {
    if (!session) return false;
    if (phase === 'clear') return true;
    if (phase === 'align') return isNonEmpty(session.brainDump) || session.currentPhase !== 'clear';
    if (phase === 'visualize') return !!session.focusOutcomeId;
    if (phase === 'commit') {
      return isNonEmpty(session.processVisualization) && isNonEmpty(session.obstacle) && isNonEmpty(session.response);
    }
    if (phase === 'complete') return false; // only via completeSession
    return false;
  }

  // Rejects backward jumps and skips; only the next phase in PHASE_ORDER is legal.
  function advancePhase(session, targetPhase) {
    var curIdx = PHASE_ORDER.indexOf(session.currentPhase);
    var targetIdx = PHASE_ORDER.indexOf(targetPhase);
    if (targetIdx !== curIdx + 1) {
      return { ok: false, errors: ['Cannot jump from ' + session.currentPhase + ' to ' + targetPhase + '.'] };
    }
    if (!canEnterPhase(session, targetPhase)) {
      return { ok: false, errors: ['Required fields for ' + targetPhase + ' are not complete.'] };
    }
    return { ok: true, errors: [] };
  }

  function formatIfThen(obstacle, response) {
    var o = (obstacle || '').trim();
    var r = (response || '').trim();
    if (!o || !r) return '';
    return 'If ' + o + ', then I will ' + r + '.';
  }

  // Deterministic so two devices upgrading the same untagged legacy goal
  // before syncing converge on the same ID instead of colliding under
  // sync's merge-by-ID.
  function legacyGoalId(dateKey, text, index) {
    var raw = dateKey + '|' + (text || '') + '|' + index;
    var hash = 0;
    for (var i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return 'legacy-' + Math.abs(hash).toString(36);
  }

  // Returns a NEW array; does not mutate goals. Existing IDs, text, done,
  // doneAt, and any other fields are preserved unchanged.
  function upgradeGoalsWithIds(goals, dateKey) {
    return (goals || []).map(function (g, i) {
      if (!g || g.id) return g;
      var copy = {};
      for (var k in g) { if (Object.prototype.hasOwnProperty.call(g, k)) copy[k] = g[k]; }
      copy.id = legacyGoalId(dateKey, g.text, i);
      return copy;
    });
  }

  function validateMovers(movers, winMoverId) {
    var errors = [];
    var list = movers || [];
    if (list.length !== 3) errors.push('Exactly three needle movers are required (found ' + list.length + ').');
    if (!winMoverId || !list.some(function (m) { return m.id === winMoverId; })) {
      errors.push('A win condition must be selected from the three movers.');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  // goalsByDateKey: { [goalDateKey]: [goal, ...] }. Returns 'available' with
  // the live goal, or 'missing' — never silently recreates anything.
  function resolveMoverReference(mover, goalsByDateKey) {
    var goals = (goalsByDateKey && goalsByDateKey[mover.goalDateKey]) || [];
    var goal = goals.find(function (g) { return g && g.id === mover.goalId; });
    if (!goal) return { status: 'missing' };
    return { status: 'available', goal: goal };
  }

  // Applies a Today-side completion change to the matching mover's
  // doneSnapshot. Returns a new movers array; does not mutate input.
  function reconcileFromToday(movers, goalDateKey, goalId, done) {
    return (movers || []).map(function (m) {
      if (m.goalDateKey !== goalDateKey || m.goalId !== goalId) return m;
      var copy = {};
      for (var k in m) { if (Object.prototype.hasOwnProperty.call(m, k)) copy[k] = m[k]; }
      copy.doneSnapshot = !!done;
      return copy;
    });
  }

  function completeSession(session, outcomes, movers, winMoverId) {
    var outcomeCheck = validateOutcomes(outcomes);
    var moverCheck = validateMovers(movers, winMoverId);
    var errors = outcomeCheck.errors.concat(moverCheck.errors);
    if (!isNonEmpty(session.processVisualization) || !isNonEmpty(session.obstacle) || !isNonEmpty(session.response)) {
      errors.push('Visualize phase is incomplete.');
    }
    if (errors.length) return { ok: false, errors: errors };

    var active = outcomes.filter(function (o) { return o.active; });
    var copy = {};
    for (var k in session) { if (Object.prototype.hasOwnProperty.call(session, k)) copy[k] = session[k]; }
    copy.status = 'completed';
    copy.currentPhase = 'complete';
    copy.needleMovers = movers;
    copy.winMoverId = winMoverId;
    copy.savedOutcomeSnapshot = active.map(function (o) { return { id: o.id, text: o.text }; });
    copy.completedAt = new Date().toISOString();
    return { ok: true, session: copy };
  }

  function summarize(session) {
    if (!session) return null;
    var win = (session.needleMovers || []).find(function (m) { return m.id === session.winMoverId; });
    var firstOpen = (session.needleMovers || [])
      .slice()
      .sort(function (a, b) { return a.order - b.order; })
      .find(function (m) { return !m.doneSnapshot; });
    return {
      status: session.status,
      winCondition: win ? win.textSnapshot : null,
      movers: session.needleMovers || [],
      currentFirstAction: firstOpen ? firstOpen.firstAction : null,
      ifThen: formatIfThen(session.obstacle, session.response)
    };
  }

  // Never includes brainDump.
  function vaultExportProjection(session) {
    if (!session) return null;
    if (session.status !== 'completed' && session.status !== 'skipped') return null;
    var focusEntry = (session.savedOutcomeSnapshot || []).find(function (o) { return o.id === session.focusOutcomeId; });
    var win = (session.needleMovers || []).find(function (m) { return m.id === session.winMoverId; });
    return {
      date: session.date,
      status: session.status,
      completedAt: session.completedAt,
      focusOutcome: focusEntry ? focusEntry.text : null,
      winCondition: win ? win.textSnapshot : null,
      movers: (session.needleMovers || []).map(function (m) {
        return { text: m.textSnapshot, done: !!m.doneSnapshot, order: m.order };
      }),
      processVisualization: session.processVisualization,
      ifThen: formatIfThen(session.obstacle, session.response),
      evening: session.evening || null
    };
  }

  var api = {
    newSession: newSession,
    validateOutcomes: validateOutcomes,
    canEnterPhase: canEnterPhase,
    advancePhase: advancePhase,
    formatIfThen: formatIfThen,
    legacyGoalId: legacyGoalId,
    upgradeGoalsWithIds: upgradeGoalsWithIds,
    validateMovers: validateMovers,
    resolveMoverReference: resolveMoverReference,
    reconcileFromToday: reconcileFromToday,
    completeSession: completeSession,
    summarize: summarize,
    vaultExportProjection: vaultExportProjection
  };
  if (typeof window !== 'undefined') window.MorningLaunchLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
