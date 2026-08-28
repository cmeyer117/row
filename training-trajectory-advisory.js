// training-trajectory-advisory.js -- pure logic, no DOM/Supabase.
// Mirrors gym-workout-closeout-logic.js's getPendingCloseoutAdvisory shape:
// a flag surfaces once, then auto-clears the moment a real workout happens
// after it -- no separate "how did it go" prompt, the next logged session
// IS the outcome signal. See docs/superpowers/specs/
// 2026-08-27-training-trajectory-coach-integration-design.md for the write
// side (weekly-review.html); this is the missing read/surface side Codex's
// per-project pass flagged.
(function () {
  'use strict';

  function localDateFromLog(value) {
    if (typeof value !== 'string' || value.length < 10) return null;
    const date = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }

  // trajectory: { findings: [{ observation, confidence }], computedAt } or null.
  // allLogs: every logged set across every exercise, each with a `date`.
  // Returns the top finding's observation text, or null if there's nothing
  // pending (no findings, or Carl already logged a set since computedAt).
  function getPendingTrajectoryAdvisory(input) {
    input = input && typeof input === 'object' ? input : {};
    const trajectory = input.trajectory;
    if (!trajectory || typeof trajectory !== 'object') return null;
    const findings = Array.isArray(trajectory.findings) ? trajectory.findings : [];
    if (!findings.length) return null;
    const computedDate = localDateFromLog(trajectory.computedAt);
    if (!computedDate) return null;

    const logs = Array.isArray(input.allLogs) ? input.allLogs : [];
    const hasLaterLog = logs.some(function (log) {
      const logDate = log && localDateFromLog(log.date);
      return logDate && logDate > computedDate;
    });
    if (hasLaterLog) return null;

    const top = findings[0];
    const text = top && typeof top.observation === 'string' ? top.observation.trim() : '';
    return text || null;
  }

  const api = { getPendingTrajectoryAdvisory: getPendingTrajectoryAdvisory };
  if (typeof window !== 'undefined') window.TrainingTrajectoryAdvisory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
