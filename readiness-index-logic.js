// readiness-index-logic.js -- pure math for the Judge's-Eye Readiness Index
// (posing.html check-ins, surfaced on weekly-review.html). No DOM, no
// Supabase. See docs/superpowers/specs/2026-08-20-judges-eye-readiness-index-design.md.
(function () {
  'use strict';

  // entry: { date, scores: [{ pose, score }], note }. Averages non-empty
  // numeric scores; returns null if none present.
  function averageScore(entry) {
    const vals = ((entry && entry.scores) || [])
      .map(function (s) { return s && s.score; })
      .filter(function (n) { return typeof n === 'number'; });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  // null when either average is missing (no prior check-in to compare, or
  // no data at all) -- not 'flat', since there's nothing to compare.
  function trend(currentAvg, previousAvg) {
    if (currentAvg == null || previousAvg == null) return null;
    if (currentAvg > previousAvg) return 'up';
    if (currentAvg < previousAvg) return 'down';
    return 'flat';
  }

  // list: array of entries, sorted or not. Returns the most recent by date,
  // or null for an empty/missing list.
  function latestCheckin(list) {
    if (!list || !list.length) return null;
    return list.slice().sort(function (a, b) { return a.date.localeCompare(b.date); })[list.length - 1];
  }

  function daysSince(dateStr, today) {
    const ms = new Date(today) - new Date(dateStr);
    return Math.round(ms / 86400000);
  }

  const api = { averageScore: averageScore, trend: trend, latestCheckin: latestCheckin, daysSince: daysSince };
  if (typeof window !== 'undefined') window.ReadinessIndexLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
