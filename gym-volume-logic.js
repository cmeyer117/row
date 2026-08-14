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

  // Name-keyed map of exercises with a well-established (EMG-supported),
  // textbook secondary muscle mover -- not an exhaustive biomechanical
  // model, just the strong/obvious cases. Keyed by exercise .name (stable),
  // same convention as coaching-exercise-meta.js's META. An exercise absent
  // from this map contributes only to its primary (.muscle) -- that's the
  // expected case for isolation moves, not an omission.
  // Sourced 2026-08-14, see docs/superpowers/specs/2026-08-14-volume-progression-datamodel-design.md
  // for the full citation/reasoning trail (includes a Gemini independent
  // fact-check pass -- confirmed the RIR>=4 threshold and the pressing/
  // rowing secondary-mover claims as scientifically standard; the RDL
  // glute weight below was revised from an initial 0.5 to 0.7 after that
  // check argued 0.5 underweights glutes, since hip extension is the
  // PRIMARY joint action in a hip hinge, not a secondary one).
  var EXERCISE_MUSCLE_CONTRIBUTIONS = {
    'Neutral Grip Shoulder Press Machine': { muscle: 'Triceps', weight: 0.5 },
    'Smith Machine Flat Chest Press':      { muscle: 'Triceps', weight: 0.5 },
    'Chest Dip':                           { muscle: 'Triceps', weight: 0.5 },
    'Dumbbell Incline Chest Press':        { muscle: 'Triceps', weight: 0.5 },
    'Smith Machine Narrow Grip Bench':     { muscle: 'Chest', weight: 0.5 },

    // Flat 0.5 regardless of grip -- a known simplification (a pronated/
    // overhand pull recruits meaningfully less biceps than neutral/
    // supinated; plain 'Lat Pulldown' with no grip in its name, as
    // distinct from 'Neutral Grip Lat Pulldown' below, is the likeliest
    // candidate to be overstated by this). Revisit if grip ever becomes
    // its own tracked exercise attribute.
    'Lat Pulldown':                    { muscle: 'Biceps', weight: 0.5 },
    'Cable Seated Row (Neutral Grip)': { muscle: 'Biceps', weight: 0.5 },
    'Machine High Row':                { muscle: 'Biceps', weight: 0.5 },
    'Machine Low Row':                 { muscle: 'Biceps', weight: 0.5 },
    'Chest Supported T-Bar Row':       { muscle: 'Biceps', weight: 0.5 },
    'Neutral Grip Lat Pulldown':       { muscle: 'Biceps', weight: 0.5 },

    'Hack Squat':                   { muscle: 'Glutes', weight: 0.3 },
    'Cybex Leg Press':              { muscle: 'Glutes', weight: 0.3 },
    'Dumbbell Heel Elevated Lunge': { muscle: 'Glutes', weight: 0.2 },
    'Dumbbell B-Stance RDL':        { muscle: 'Glutes', weight: 0.7 },
    'Smith Machine RDL':            { muscle: 'Glutes', weight: 0.7 }
  };

  // exercises: [{ id, name, muscle, ... }]. logs: same shape as
  // weeklyVolumeByDay. Counts weighted HARD sets (one log entry = 1.0 to
  // its primary muscle, plus EXERCISE_MUSCLE_CONTRIBUTIONS[name]'s weight
  // to its secondary muscle if mapped), current week only. A set with
  // log.rir explicitly >= 4 is excluded (not near enough to failure to
  // count as training volume) -- missing RIR or RIR < 4 counts. Every
  // muscle in MUSCLE_BANDS is present in the result even at 0.
  function weeklySetsByMuscle(exercises, logs) {
    var exByI = {};
    (exercises || []).forEach(function (ex) {
      if (ex && ex.muscle) exByI[ex.id] = ex;
    });

    var counts = {};
    Object.keys(MUSCLE_BANDS).forEach(function (m) { counts[m] = 0; });

    var thisMonday = mondayOfDate(new Date());
    Object.keys(logs || {}).forEach(function (exId) {
      var ex = exByI[exId];
      if (!ex) return; // untagged (custom/adhoc) exercise — excluded, not bucketed
      var secondary = EXERCISE_MUSCLE_CONTRIBUTIONS[ex.name];
      (logs[exId] || []).forEach(function (log) {
        if (!log || !log.date) return;
        if (mondayOfDate(new Date(log.date)) !== thisMonday) return;
        if (log.rir != null && log.rir >= 4) return; // not a hard set
        counts[ex.muscle] = (counts[ex.muscle] || 0) + 1;
        if (secondary) counts[secondary.muscle] = (counts[secondary.muscle] || 0) + secondary.weight;
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

  // Turns a classifyMuscleVolume() band + whether getRx() detected a stall
  // for this exercise into a prescriptive suggestion. Advisory only -- the
  // caller (getRx()) attaches this alongside its existing load-based
  // recommendation, never replaces it. 2026-08-13: closes the gap Grok's
  // training-logic audit flagged -- getRx() was load-only with no volume
  // lever, even though these bands/counts already existed for the Progress
  // tab's dashboard and were never consulted prescriptively.
  function volumeAdvisory(band, stalled) {
    if (!band) return null;
    if (band.label === 'under') {
      return { suggestion: 'add_set', reason: 'Under MEV (' + band.mev + ' sets/wk) for this muscle -- there\'s real room to add volume here before load progression is even the limiting factor.' };
    }
    if (stalled && band.label === 'mav') {
      return { suggestion: 'add_set', reason: 'Stalled on load, but still under MRV (' + band.mrv + ' sets/wk) for this muscle -- a plateau here is often a volume problem, not purely a load problem. Consider adding a set before assuming a deload is the only fix.' };
    }
    if (band.label === 'mrv') {
      return { suggestion: 'pull_back', reason: 'At or above MRV (' + band.mrv + ' sets/wk) for this muscle -- more volume here is more likely to add fatigue than drive further growth.' };
    }
    return null;
  }

  var api = {
    mondayOfDate: mondayOfDate,
    weeklyVolumeByDay: weeklyVolumeByDay,
    weeklySetsByMuscle: weeklySetsByMuscle,
    classifyMuscleVolume: classifyMuscleVolume,
    volumeAdvisory: volumeAdvisory,
    MUSCLE_BANDS: MUSCLE_BANDS,
    EXERCISE_MUSCLE_CONTRIBUTIONS: EXERCISE_MUSCLE_CONTRIBUTIONS
  };
  if (typeof window !== 'undefined') window.GymVolumeLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
