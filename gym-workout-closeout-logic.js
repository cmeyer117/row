// gym-workout-closeout-logic.js -- pure candidate and carry-forward logic.
// No DOM, localStorage, Supabase, or prescription mutation.
(function () {
  'use strict';

  function localDateFromLog(value) {
    if (typeof value !== 'string' || value.length < 10) return null;
    const date = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }

  function daysBetween(from, to) {
    const start = new Date(from + 'T00:00:00Z').getTime();
    const end = new Date(to + 'T00:00:00Z').getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return Math.round((end - start) / 86400000);
  }

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function buildCloseoutCandidates(input) {
    input = input && typeof input === 'object' ? input : {};
    const exerciseId = typeof input.exerciseId === 'string' ? input.exerciseId : '';
    const exerciseName = typeof input.exerciseName === 'string' ? input.exerciseName.trim() : '';
    const today = localDateFromLog(input.today);
    if (!exerciseId || !exerciseName || !today) return [];

    const candidates = [];
    const byJoint = {};
    const entries = Array.isArray(input.jointPain) ? input.jointPain : [];
    entries.forEach(function (entry) {
      if (!entry || typeof entry !== 'object' || entry.exerciseId !== exerciseId) return;
      const date = localDateFromLog(entry.date);
      const joint = typeof entry.joint === 'string' ? entry.joint.trim().toLowerCase() : '';
      const gap = date ? daysBetween(date, today) : null;
      if (!joint || gap == null || gap < 0 || gap > 7) return;
      if (!byJoint[joint]) byJoint[joint] = 0;
      byJoint[joint] += 1;
    });
    Object.keys(byJoint).sort().forEach(function (joint) {
      const count = byJoint[joint];
      const countText = count === 1 ? 'once' : count === 2 ? 'twice' : count + ' times';
      candidates.push({
        exerciseId: exerciseId,
        kind: 'joint-pain',
        text: titleCase(joint) + ' flagged ' + countText + ' in 7 days — review load and range before ' + exerciseName + '.',
      });
    });

    const activeVariant = typeof input.activeVariant === 'string' ? input.activeVariant.trim() : '';
    if (activeVariant && activeVariant !== exerciseName) {
      candidates.push({
        exerciseId: exerciseId,
        kind: 'substitution',
        text: 'Substituted ' + activeVariant + ' last session — check whether it should stick.',
      });
    }

    if (input.outcome === 'missed') {
      candidates.push({
        exerciseId: exerciseId,
        kind: 'missed-progression',
        text: 'Came up short of the last Rx — repeat before adding weight.',
      });
    }
    return candidates;
  }

  function getPendingCloseoutAdvisory(input) {
    input = input && typeof input === 'object' ? input : {};
    const closeout = input.closeout;
    if (!closeout || typeof closeout !== 'object') return null;
    const closeoutDate = localDateFromLog(closeout.date);
    const text = typeof closeout.text === 'string' ? closeout.text.trim() : '';
    if (!closeoutDate || !text) return null;
    const logs = Array.isArray(input.exerciseLogs) ? input.exerciseLogs : [];
    const hasLaterLog = logs.some(function (log) {
      const logDate = log && localDateFromLog(log.date);
      return logDate && logDate > closeoutDate;
    });
    return hasLaterLog ? null : text;
  }

  const api = {
    buildCloseoutCandidates: buildCloseoutCandidates,
    getPendingCloseoutAdvisory: getPendingCloseoutAdvisory,
  };
  if (typeof window !== 'undefined') window.GymWorkoutCloseoutLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
