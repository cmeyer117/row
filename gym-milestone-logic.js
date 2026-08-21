// gym-milestone-logic.js — narrow PR-milestone log for cross-app faith-context
// surfacing (build item 3.4). Reuses gym-workout-events.js's existing 'pr'
// classification (already computed at every log-set callsite) rather than
// inventing a second PR definition. Stores only what a narrow cross-app read
// needs: date, exercise name, type -- never weight/reps/full session data.
(function () {
  'use strict';

  const MAX_MILESTONES = 20; // ponytail: fixed cap, no pruning-by-age -- add if the list ever needs more history

  // milestones: existing array (or undefined). eventType: gym-workout-events'
  // classifyWorkoutEvent() result. Only 'pr' is recorded -- 'grind'/'miss'/null
  // are not milestones. Returns a NEW array (caller assigns it back).
  function recordMilestone(milestones, entry) {
    const list = Array.isArray(milestones) ? milestones.slice() : [];
    if (!entry || entry.eventType !== 'pr' || !entry.exercise || !entry.dateKey) return list;
    list.push({ date: entry.dateKey, exercise: entry.exercise, type: 'pr' });
    list.sort(function (a, b) { return a.date.localeCompare(b.date); });
    return list.slice(-MAX_MILESTONES);
  }

  if (typeof window !== 'undefined') {
    window.GymMilestoneLogic = { recordMilestone: recordMilestone };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { recordMilestone: recordMilestone };
  }
})();
