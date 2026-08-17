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
  // to its secondary muscle if mapped), for the week containing refDate
  // (defaults to now — every existing caller passing 2 args keeps
  // counting the current week unchanged). A set with log.rir explicitly
  // >= 4 is excluded (not near enough to failure to count as training
  // volume) -- missing RIR or RIR < 4 counts. Every muscle in
  // MUSCLE_BANDS is present in the result even at 0.
  function weeklySetsByMuscle(exercises, logs, refDate) {
    var exByI = {};
    (exercises || []).forEach(function (ex) {
      if (ex && ex.muscle) exByI[ex.id] = ex;
    });

    var counts = {};
    Object.keys(MUSCLE_BANDS).forEach(function (m) { counts[m] = 0; });

    var targetMonday = mondayOfDate(refDate || new Date());
    Object.keys(logs || {}).forEach(function (exId) {
      var ex = exByI[exId];
      if (!ex) return; // untagged (custom/adhoc) exercise — excluded, not bucketed
      var secondary = EXERCISE_MUSCLE_CONTRIBUTIONS[ex.name];
      (logs[exId] || []).forEach(function (log) {
        if (!log || !log.date) return;
        if (mondayOfDate(new Date(log.date)) !== targetMonday) return;
        if (log.rir != null && log.rir >= 4) return; // not a hard set
        counts[ex.muscle] = (counts[ex.muscle] || 0) + 1;
        if (secondary) counts[secondary.muscle] = (counts[secondary.muscle] || 0) + secondary.weight;
      });
    });
    return counts;
  }

  // Maps a muscle + training phase to a specific weekly-hard-set target, or
  // null if this phase shouldn't push a target (falls back to the static
  // band's stall-only advisory behavior). growth climbs toward the top of
  // the effective range; cut/show_prep/reverse_diet hold at the bottom
  // (minimum-effective) rather than chasing more volume while other levers
  // (diet) are doing the work. peak/null/any unrecognized phase: no target,
  // today's exact pre-phase behavior.
  function phaseTarget(muscle, phase) {
    var band = MUSCLE_BANDS[muscle];
    if (!band) return null;
    if (phase === 'growth') return band.mavHigh;
    if (phase === 'cut' || phase === 'show_prep' || phase === 'reverse_diet') return band.mavLow;
    return null;
  }

  // Classifies a weekly set count against a muscle's evidence-based band,
  // optionally against a phase-specific target too. Returns
  // { label: 'under'|'mav'|'mrv', mev, mavLow, mavHigh, mrv, target,
  // belowTarget } -- label is 'under' below MEV, 'mav' from MEV through
  // MRV-1, 'mrv' at or above MRV. target is phaseTarget(muscle, phase),
  // possibly null (no phase, peak, or unrecognized phase). belowTarget is
  // true only when a target exists AND count is below it. Unknown muscle
  // name returns null. phase is optional -- omitting it (or passing an
  // unrecognized value) reproduces today's exact pre-phase behavior.
  function classifyMuscleVolume(muscle, count, phase) {
    var band = MUSCLE_BANDS[muscle];
    if (!band) return null;
    var label = count < band.mev ? 'under' : (count >= band.mrv ? 'mrv' : 'mav');
    var target = phaseTarget(muscle, phase);
    var belowTarget = target != null && count < target;
    return { label: label, mev: band.mev, mavLow: band.mavLow, mavHigh: band.mavHigh, mrv: band.mrv, target: target, belowTarget: belowTarget };
  }

  // Turns a classifyMuscleVolume() band + whether getRx() detected a stall
  // for this exercise into a prescriptive suggestion. Advisory only -- the
  // caller (getRx()) attaches this alongside its existing load-based
  // recommendation, never replaces it. 2026-08-13: closes the gap Grok's
  // training-logic audit flagged -- getRx() was load-only with no volume
  // lever, even though these bands/counts already existed for the Progress
  // tab's dashboard and were never consulted prescriptively.
  // phase is optional and only affects the in-MAV-range case: when the band
  // carries a phase target (band.belowTarget), that takes priority over the
  // stall check, with phase-flavored wording -- growth frames it as pushing
  // toward the top of the range, cut/show_prep/reverse_diet frames it as
  // holding at the minimum-effective floor. With no phase target, behavior
  // is identical to before phase-awareness existed (stall-only).
  function volumeAdvisory(band, stalled, phase) {
    if (!band) return null;
    if (band.label === 'under') {
      return { suggestion: 'add_set', reason: 'Under MEV (' + band.mev + ' sets/wk) for this muscle -- there\'s real room to add volume here before load progression is even the limiting factor.' };
    }
    if (band.label === 'mrv') {
      return { suggestion: 'pull_back', reason: 'At or above MRV (' + band.mrv + ' sets/wk) for this muscle -- more volume here is more likely to add fatigue than drive further growth.' };
    }
    if (band.belowTarget) {
      if (phase === 'growth') {
        return { suggestion: 'add_set', reason: 'Growth phase target is ' + band.target + ' sets/wk for this muscle -- still room to push toward MAV, and this phase is where added volume is a real lever.' };
      }
      return { suggestion: 'add_set', reason: 'This phase\'s minimum-effective target is ' + band.target + ' sets/wk for this muscle -- worth adding a set to hold there while other levers do the heavy lifting.' };
    }
    if (stalled) {
      return { suggestion: 'add_set', reason: 'Stalled on load, but still under MRV (' + band.mrv + ' sets/wk) for this muscle -- a plateau here is often a volume problem, not purely a load problem. Consider adding a set before assuming a deload is the only fix.' };
    }
    return null;
  }

  // Single source of truth for the 3 volume-decision actions -- shared
  // between matchesVolumeDecision's comparator below and weekly-review.html's
  // <select> options / display labels, so renaming or adding an action only
  // touches one place instead of three independently-hardcoded copies
  // (found in code review 2026-08-17).
  var VOLUME_ACTIONS = {
    add_set:   { label: 'add' },
    pull_back: { label: 'reduce' },
    keep:      { label: 'keep' }
  };

  // Did actual hard sets for a muscle follow the direction a weekly-review
  // decision chose ('add_set'/'pull_back'/'keep')? Used by the
  // decision-to-execution scoreboard (weekly-review.html) to auto-score
  // volume follow-through instead of asking Carl to eyeball it. Returns
  // null when there's no baseline to compare against (a decision recorded
  // before this field existed) or the action isn't one of the 3 known
  // values. 'keep' allows a +/-1 set tolerance rather than exact equality
  // -- actual/baseline can be fractional (secondary-muscle contribution
  // weighting, see EXERCISE_MUSCLE_CONTRIBUTIONS) and even whole-number
  // counts naturally drift by a set or two week-to-week for reasons that
  // have nothing to do with whether Carl actually kept the same volume
  // (an extra warm-up logged, one exercise swapped for a near-equivalent).
  // Exact equality flagged genuine "kept it about the same" weeks as
  // "not followed" far too often (found in code review 2026-08-17).
  function matchesVolumeDecision(action, baseline, actual) {
    if (baseline == null || !VOLUME_ACTIONS[action]) return null;
    if (action === 'add_set') return actual > baseline;
    if (action === 'pull_back') return actual < baseline;
    return Math.abs(actual - baseline) <= 1;
  }

  var api = {
    mondayOfDate: mondayOfDate,
    weeklyVolumeByDay: weeklyVolumeByDay,
    weeklySetsByMuscle: weeklySetsByMuscle,
    classifyMuscleVolume: classifyMuscleVolume,
    volumeAdvisory: volumeAdvisory,
    phaseTarget: phaseTarget,
    matchesVolumeDecision: matchesVolumeDecision,
    VOLUME_ACTIONS: VOLUME_ACTIONS,
    MUSCLE_BANDS: MUSCLE_BANDS,
    EXERCISE_MUSCLE_CONTRIBUTIONS: EXERCISE_MUSCLE_CONTRIBUTIONS
  };
  if (typeof window !== 'undefined') window.GymVolumeLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
