// gym-readiness-logic.js — pure math for the Prep Readiness panel
// (weekly-review.html). No DOM, no Supabase. See
// docs/superpowers/specs/2026-08-19-prep-readiness-panel-design.md.
(function () {
  'use strict';

  // checkins: { dateKey: { recovery: 'low'|'med'|'high'|null, ... } }.
  // refSunday: 'YYYY-MM-DD', the last day of the trailing 7-day window.
  // scoreMap: { low: 1, med: 2, high: 3 } -- injected rather than hardcoded
  // so the caller's rating scale stays the single source of truth.
  // Returns { avgLast7: number|null, avgPrior7: number|null, direction:
  // 'up'|'down'|'flat'|null }. direction is null only when avgLast7 itself
  // has no data; it's 'flat' (not null) when both weeks have data but are
  // equal, or when the prior week has no data to compare against.
  function recoveryTrend(checkins, refSunday, scoreMap) {
    function windowAvg(endDateKey, daysBack) {
      const end = new Date(endDateKey + 'T00:00:00Z');
      let sum = 0, count = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() - (daysBack + i));
        const key = d.toISOString().slice(0, 10);
        const entry = checkins && checkins[key];
        const score = entry && entry.recovery ? scoreMap[entry.recovery] : null;
        if (score != null) { sum += score; count++; }
      }
      return count ? sum / count : null;
    }
    const avgLast7 = windowAvg(refSunday, 0);
    const avgPrior7 = windowAvg(refSunday, 7);
    let direction = null;
    if (avgLast7 != null) {
      direction = (avgPrior7 == null || avgLast7 === avgPrior7) ? 'flat' : (avgLast7 > avgPrior7 ? 'up' : 'down');
    }
    return { avgLast7: avgLast7, avgPrior7: avgPrior7, direction: direction };
  }

  // jointPain: state.jointPain array ({ joint, severity, date }). Returns
  // entries with date within [monday, sunday] inclusive, same shape/order,
  // for display as a flag list. Tolerates null/missing input.
  function mobilityExceptionsInWeek(jointPain, monday, sunday) {
    return (jointPain || []).filter(function (e) {
      return e && e.date && e.date >= monday && e.date <= sunday;
    });
  }

  const api = { recoveryTrend: recoveryTrend, mobilityExceptionsInWeek: mobilityExceptionsInWeek };
  if (typeof window !== 'undefined') window.GymReadinessLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
