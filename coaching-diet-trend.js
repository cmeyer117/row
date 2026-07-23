// coaching-diet-trend.js — compares a client's logged bodyweight trend
// against their stated goal and suggests a calorie adjustment, matching
// the "+/-10% based on 2-week trend" language already written into
// coaching-templates.js's advanced-stage advice. Pure function, no
// Supabase/DOM here — same dual-export style as macro-calc.js.
(function () {
  'use strict';

  // goal: 'cut' | 'bulk' | 'recomp' | 'contest-prep'
  // weightLogs: array of { weight, logged_at }, any order — sorted internally.
  // Returns { direction: 'increase'|'decrease', pct: 10 } or null if there's
  // not enough data (fewer than 2 points) or the goal has no expected
  // direction (recomp/contest-prep are expected to hold roughly flat, so
  // this never suggests an adjustment for them).
  function suggestCalorieAdjustment(goal, weightLogs) {
    if (!weightLogs || weightLogs.length < 2) return null;
    if (goal !== 'cut' && goal !== 'bulk') return null;

    const sorted = weightLogs.slice().sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
    const first = sorted[0].weight;
    const last = sorted[sorted.length - 1].weight;
    const delta = last - first;

    if (goal === 'cut' && delta >= 0) {
      return { direction: 'decrease', pct: 10, reason: 'Weight hasn\'t trended down (' + first + ' -> ' + last + ') — drop calories ~10%.' };
    }
    if (goal === 'bulk' && delta <= 0) {
      return { direction: 'increase', pct: 10, reason: 'Weight hasn\'t trended up (' + first + ' -> ' + last + ') — add calories ~10%.' };
    }
    return null;
  }

  const api = { suggestCalorieAdjustment: suggestCalorieAdjustment };
  if (typeof window !== 'undefined') window.CoachingDietTrend = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
