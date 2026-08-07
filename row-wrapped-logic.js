// row-wrapped-logic.js — pure functions for the Row Wrapped quarterly
// recap card: calendar-quarter math, new-PR detection, total volume,
// longest training-day streak, and a bodyweight-in-window slice. No DOM,
// no Supabase, no canvas/SVG -- see row-wrapped.html for the render side.
// Dual export like gym-volume-logic.js.
(function () {
  'use strict';

  // "So far" -- end is `now` itself, never the calendar quarter's actual
  // last day, so a card generated mid-quarter reflects real partial data
  // rather than implying data that doesn't exist yet.
  function quarterBounds(now) {
    now = now || new Date();
    var year = now.getUTCFullYear();
    var q = Math.floor(now.getUTCMonth() / 3); // 0-3
    var startMonth = q * 3;
    var start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0));
    return { start: start, end: now, label: 'Q' + (q + 1) + ' ' + year };
  }

  function inWindow(dateStr, bounds) {
    var d = new Date(dateStr);
    return d >= bounds.start && d <= bounds.end;
  }

  function estimate1RM(w, r) {
    if (r < 2) return w;
    return w * (1 + r / 30);
  }

  // exercises: [{id, name, bw}]. logs: {[exerciseId]: [{date, weight, reps}]}.
  // A PR is any exercise whose best in-window value beats every log dated
  // strictly before bounds.start. bw exercises compare by reps; others by
  // estimate1RM. priorBest is 0 when there is no log before the window
  // (a first-ever log in the window is honestly a new PR against nothing).
  function quarterPRs(exercises, logs, bounds) {
    var out = [];
    (exercises || []).forEach(function (ex) {
      var exLogs = (logs && logs[ex.id]) || [];
      var before = exLogs.filter(function (l) { return new Date(l.date) < bounds.start; });
      var inWin = exLogs.filter(function (l) { return inWindow(l.date, bounds); });
      if (!inWin.length) return;

      var valueOf = ex.bw
        ? function (l) { return l.reps; }
        : function (l) { return estimate1RM(l.weight, l.reps); };

      var priorBest = before.length ? Math.max.apply(null, before.map(valueOf)) : 0;
      var windowBest = Math.max.apply(null, inWin.map(valueOf));

      if (windowBest > priorBest) {
        out.push({ exerciseId: ex.id, name: ex.name, e1rm: windowBest, priorBest: priorBest });
      }
    });
    return out;
  }

  // logs: same shape as quarterPRs. Sums weight*reps for every log (any
  // exercise) dated inside the window. 0 is a real, valid answer.
  function quarterVolume(logs, bounds) {
    var total = 0;
    Object.keys(logs || {}).forEach(function (exId) {
      (logs[exId] || []).forEach(function (l) {
        if (inWindow(l.date, bounds)) total += (l.weight || 0) * (l.reps || 0);
      });
    });
    return total;
  }

  // Longest run of consecutive calendar days with at least one logged set
  // (any exercise). Two exercises logged the same day count as one
  // training day, not two. 0 for a window with zero training days.
  function longestStreak(logs, bounds) {
    var dayKeys = {};
    Object.keys(logs || {}).forEach(function (exId) {
      (logs[exId] || []).forEach(function (l) {
        if (inWindow(l.date, bounds)) dayKeys[l.date.slice(0, 10)] = true;
      });
    });
    var days = Object.keys(dayKeys).sort();
    if (!days.length) return 0;

    var longest = 1, current = 1;
    for (var i = 1; i < days.length; i++) {
      var prev = new Date(days[i - 1] + 'T00:00:00Z');
      var cur = new Date(days[i] + 'T00:00:00Z');
      var diffDays = Math.round((cur - prev) / 86400000);
      if (diffDays === 1) { current += 1; } else { current = 1; }
      if (current > longest) longest = current;
    }
    return longest;
  }

  // weights: [{dateKey, weight}]. Returns the in-window slice, sorted
  // ascending by dateKey. Empty array when nothing falls inside.
  function quarterBodyweightSeries(weights, bounds) {
    return (weights || [])
      .filter(function (w) { return inWindow(w.dateKey + 'T00:00:00Z', bounds); })
      .slice()
      .sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
  }

  var api = {
    quarterBounds: quarterBounds,
    quarterPRs: quarterPRs,
    quarterVolume: quarterVolume,
    longestStreak: longestStreak,
    quarterBodyweightSeries: quarterBodyweightSeries
  };
  if (typeof window !== 'undefined') window.RowWrappedLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
