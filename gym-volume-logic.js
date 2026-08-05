// gym-volume-logic.js — pure functions for weekly volume aggregation
// (weight x reps, summed and bucketed by Monday-of-week, optionally
// filtered by training day). No DOM, no Supabase — see gym.html for
// the wiring. Dual export like macro-calc.js so this can be
// self-checked with plain `node` and also loaded as a plain <script>.
(function () {
  'use strict';

  // Same UTC Monday-of-week convention Jarvis's coach-read.ts uses for
  // the weekly stall/volume-drift narrative, duplicated here rather than
  // shared — two separate repos, no build step to share a module through.
  function mondayOfDate(d) {
    var copy = new Date(d);
    var day = copy.getUTCDay();
    var diff = (day === 0 ? -6 : 1) - day;
    copy.setUTCDate(copy.getUTCDate() + diff);
    return copy.toISOString().slice(0, 10);
  }

  // exercises: [{ id, day, ... }]. logs: { [exerciseId]: [{ date, weight,
  // reps }] } — same shapes gym.html already keeps in state.exercises/
  // state.logs. dayFilter: a day id, or 'all'. weeksBack: how many
  // trailing weeks to return (default 10), ending at the current week.
  // Weeks with zero logged sets are still returned as a real 0, not
  // omitted — a missed week should show as a dip, not a gap.
  function weeklyVolumeByDay(exercises, logs, dayFilter, weeksBack) {
    weeksBack = weeksBack || 10;
    var relevantIds = {};
    (exercises || []).forEach(function (ex) {
      if (!ex) return;
      if (dayFilter === 'all' || ex.day === dayFilter) relevantIds[ex.id] = true;
    });

    var byWeek = {};
    Object.keys(logs || {}).forEach(function (exId) {
      if (!relevantIds[exId]) return;
      (logs[exId] || []).forEach(function (log) {
        if (!log || !log.date) return;
        var wk = mondayOfDate(new Date(log.date));
        var vol = (log.weight || 0) * (log.reps || 0);
        byWeek[wk] = (byWeek[wk] || 0) + vol;
      });
    });

    var weeks = [];
    var currentMonday = new Date(mondayOfDate(new Date()) + 'T00:00:00Z');
    for (var i = weeksBack - 1; i >= 0; i--) {
      var d = new Date(currentMonday);
      d.setUTCDate(d.getUTCDate() - i * 7);
      var wk = d.toISOString().slice(0, 10);
      weeks.push({ weekKey: wk, totalVol: byWeek[wk] || 0 });
    }
    return weeks;
  }

  var api = { mondayOfDate: mondayOfDate, weeklyVolumeByDay: weeklyVolumeByDay };
  if (typeof window !== 'undefined') window.GymVolumeLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
