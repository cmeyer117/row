// coach-snapshot-logic.js -- pure phase-aware weekly verdict math for the
// Prep Readiness panel (weekly-review.html). Scores 5 signals (cardio,
// posing, sleep, macro adherence, bodyweight trend) 0/1/2/null for the
// current week, phase-weights them, and returns a 3-state verdict. No DOM,
// no Supabase. See
// docs/superpowers/specs/2026-08-20-coachsnapshot-phase-verdict-design.md.
(function () {
  'use strict';

  // matchesCountTarget's own 3-state result -> 0/1/2/null banding, shared
  // by the cardio and posing signals (same function weekly-review.html's
  // rxInfo()/matchesCountTarget already uses).
  var COUNT_VERDICT_SCORE = { matched: 2, partly_matched: 1, not_matched: 0 };
  function scoreCountSignal(verdict) {
    return verdict == null ? null : (COUNT_VERDICT_SCORE[verdict] != null ? COUNT_VERDICT_SCORE[verdict] : null);
  }

  // entries: this week's health:sleep rows (any date range the caller
  // already filtered). isPoorSleepEntry: injected (GymSleepCheckLogic's
  // function), keeps this module dependency-free. No entries this week ->
  // null (no data), not a guess.
  function scoreSleepSignal(entries, isPoorSleepEntry) {
    if (!entries || !entries.length) return null;
    var poorCount = entries.filter(function (e) { return isPoorSleepEntry(e); }).length;
    if (poorCount === 0) return 2;
    if (poorCount === 1) return 1;
    return 0;
  }

  // dayResults: array of booleans, one per logged food_log day this week
  // (already computed by the caller via MacroCalc.isPoorMacroAdherence per
  // day). No days logged this week -> null.
  function scoreMacroSignal(dayResults) {
    if (!dayResults || !dayResults.length) return null;
    var poorCount = dayResults.filter(Boolean).length;
    if (poorCount === 0) return 2;
    if (poorCount === 1) return 1;
    return 0;
  }

  // recompResult: RecompSignalLogic.computeRecompDelta()'s return value --
  // uses weightDelta AND weightSpanDays (the ACTUAL elapsed days between
  // its two weight datapoints, not the caller's windowDays, which is only
  // an upper bound -- sparse logging, e.g. two weigh-ins a day apart,
  // would otherwise silently understate the true rate). currentWeight:
  // latest logged weight, for converting to a %-of-bodyweight rate.
  // Returns null if recompResult.ok is false (not enough weigh-ins),
  // currentWeight is falsy/zero, or the span is under 7 days (too little
  // elapsed time for a reliable weekly-rate extrapolation).
  //
  // Thresholds sourced from a 2026-08-20 Gemini consult on enhanced/PED-
  // assisted bodybuilder off-season guidance (J3University/Revive Stronger
  // consensus) -- NOT natural-lifter thresholds, which are roughly 5x
  // stricter. 0.25-0.5%/week is the standard target rate for growth;
  // >0.5-1%/week sustained is the commonly-cited "too fast" flag.
  function scoreBodyweightSignal(recompResult, currentWeight, phase) {
    if (!recompResult || !recompResult.ok || !currentWeight) return null;
    if (!recompResult.weightSpanDays || recompResult.weightSpanDays < 7) return null;
    var ratePerWeek = (recompResult.weightDelta / currentWeight) / (recompResult.weightSpanDays / 7);
    if (phase === 'growth') {
      if (ratePerWeek >= 0 && ratePerWeek <= 0.005) return 2;
      if ((ratePerWeek > -0.005 && ratePerWeek < 0) || (ratePerWeek > 0.005 && ratePerWeek <= 0.01)) return 1;
      return 0;
    }
    if (phase === 'cut' || phase === 'show_prep') {
      if (ratePerWeek < -0.001) return 2;
      if (ratePerWeek <= 0.001) return 1;
      return 0;
    }
    // reverse_diet, peak, or no phase set -- stability is the goal.
    var absRate = Math.abs(ratePerWeek);
    if (absRate <= 0.0015) return 2;
    if (absRate <= 0.0035) return 1;
    return 0;
  }

  // PRIORITY_PAIRS: signal keys that get 2x weight per phase. A phase with
  // no entry (reverse_diet, null) gets equal weighting for every signal.
  var PRIORITY_PAIRS = {
    growth: { bodyweight: true, macro: true },
    cut: { macro: true, cardio: true },
    show_prep: { macro: true, cardio: true },
    peak: { sleep: true, posing: true }
  };

  function round2(n) { return Math.round(n * 100) / 100; }

  // signals: { cardio, posing, sleep, macro, bodyweight } each 0/1/2/null.
  // phase: season phase string or null. painHigh: whether the most recent
  // checkin logged pain='high' -- hard-overrides to off_track regardless
  // of how good the other signals look, same precedent as
  // applyCheckinOverride()'s pain short-circuit.
  function computeVerdict(signals, phase, painHigh) {
    if (painHigh) return { verdict: 'off_track', reason: 'pain_override', offSignals: [] };
    var weights = PRIORITY_PAIRS[phase] || {};
    var num = 0, denom = 0, offSignals = [];
    Object.keys(signals).forEach(function (key) {
      var score = signals[key];
      if (score == null) return; // excluded, not counted as 0
      var w = weights[key] ? 2 : 1;
      num += score * w;
      denom += 2 * w;
      if (score < 2) offSignals.push(key);
    });
    if (denom === 0) return { verdict: 'not_enough_data', offSignals: [] };
    var ratio = num / denom;
    var verdict = ratio >= 0.75 ? 'on_track' : ratio >= 0.4 ? 'needs_attention' : 'off_track';
    return { verdict: verdict, ratio: round2(ratio), offSignals: offSignals };
  }

  var api = {
    scoreCountSignal: scoreCountSignal,
    scoreSleepSignal: scoreSleepSignal,
    scoreMacroSignal: scoreMacroSignal,
    scoreBodyweightSignal: scoreBodyweightSignal,
    computeVerdict: computeVerdict
  };
  if (typeof window !== 'undefined') window.CoachSnapshotLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
