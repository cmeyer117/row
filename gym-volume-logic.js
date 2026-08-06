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

  // Evidence-based weekly-set landmarks per muscle group (MEV/MAV/MRV),
  // sourced from Renaissance Periodization's published framework
  // (Israetel), population-level intermediate-trainee starting estimates —
  // see docs/superpowers/specs/2026-08-06-row-pr-volume-photo-batch-design.md
  // in the claude-workspace repo for the full sourcing/citation trail.
  var MUSCLE_BANDS = {
    Chest:      { mev: 8, mavLow: 12, mavHigh: 20, mrv: 22 },
    Back:       { mev: 8, mavLow: 14, mavHigh: 22, mrv: 25 },
    Shoulders:  { mev: 6, mavLow: 16, mavHigh: 22, mrv: 26 },
    Biceps:     { mev: 8, mavLow: 14, mavHigh: 20, mrv: 26 },
    Triceps:    { mev: 4, mavLow: 10, mavHigh: 16, mrv: 18 },
    Quads:      { mev: 8, mavLow: 12, mavHigh: 18, mrv: 20 },
    Hamstrings: { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
    Glutes:     { mev: 4, mavLow: 8,  mavHigh: 16, mrv: 20 },
    Calves:     { mev: 8, mavLow: 16, mavHigh: 20, mrv: 20 },
    Abs:        { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 }
  };

  // exercises: [{ id, muscle, ... }]. logs: same shape as weeklyVolumeByDay.
  // Counts logged SETS (one log entry = one set), current week only
  // (mondayOfDate(now) through today), keyed by muscle name. Every muscle
  // in MUSCLE_BANDS is present in the result even at 0 — a muscle with no
  // work this week should show as a real gap, not disappear.
  function weeklySetsByMuscle(exercises, logs) {
    var muscleById = {};
    (exercises || []).forEach(function (ex) {
      if (ex && ex.muscle) muscleById[ex.id] = ex.muscle;
    });

    var counts = {};
    Object.keys(MUSCLE_BANDS).forEach(function (m) { counts[m] = 0; });

    var thisMonday = mondayOfDate(new Date());
    Object.keys(logs || {}).forEach(function (exId) {
      var muscle = muscleById[exId];
      if (!muscle) return; // untagged (custom/adhoc) exercise — excluded, not bucketed
      (logs[exId] || []).forEach(function (log) {
        if (!log || !log.date) return;
        if (mondayOfDate(new Date(log.date)) !== thisMonday) return;
        counts[muscle] = (counts[muscle] || 0) + 1;
      });
    });
    return counts;
  }

  // Classifies a weekly set count against a muscle's evidence-based band.
  // Returns { label: 'under'|'mav'|'mrv', mev, mavLow, mavHigh, mrv } —
  // label is 'under' below MEV, 'mav' from MEV through MRV-1, 'mrv' at or
  // above MRV. Unknown muscle name returns null.
  function classifyMuscleVolume(muscle, count) {
    var band = MUSCLE_BANDS[muscle];
    if (!band) return null;
    var label = count < band.mev ? 'under' : (count >= band.mrv ? 'mrv' : 'mav');
    return { label: label, mev: band.mev, mavLow: band.mavLow, mavHigh: band.mavHigh, mrv: band.mrv };
  }

  var api = {
    mondayOfDate: mondayOfDate,
    weeklyVolumeByDay: weeklyVolumeByDay,
    weeklySetsByMuscle: weeklySetsByMuscle,
    classifyMuscleVolume: classifyMuscleVolume,
    MUSCLE_BANDS: MUSCLE_BANDS
  };
  if (typeof window !== 'undefined') window.GymVolumeLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
