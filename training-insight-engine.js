// training-insight-engine.js — pure, deterministic pattern-finding over
// EXISTING Row workout/sleep/macro history. Never chat prose, never an
// automatic program change, never a medical claim. Every finding names its
// own evidence and confidence so it's independently checkable, not just
// asserted. See docs/superpowers/specs/... (build-day item 9) for the
// thresholds below -- sourced from an independent Gemini design review and
// applied exactly, because they're what stops this engine from confidently
// lying on thin data.
//
// KNOWN LIMITATION: exercise-variant/tag changes (e.g. "paused squat" vs
// "squat" both logged under the same exercise) are only detected when the
// caller supplies a `variantTag` per exposure. Without it, a variant swap
// can silently pollute a load-trend baseline -- this engine has no way to
// infer that from weight/reps alone.
(function () {
  'use strict';

  // ---- small stats helpers (population stats -- fine at these sample
  // sizes, and keeps this dependency-free) ----
  function mean(arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; }
  function stdev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(mean(arr.map(function (v) { return (v - m) * (v - m); })));
  }
  function coefficientOfVariation(arr) {
    const m = mean(arr);
    return m === 0 ? 0 : stdev(arr) / Math.abs(m);
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }

  // ---- rep-range isolation (the e1RM-comparison fallacy fix) ----
  function repBracketOf(reps) {
    if (reps <= 3) return '1-3';
    if (reps <= 7) return '4-7';
    if (reps <= 12) return '8-12';
    return '13+';
  }

  // exposures: chronological array of { date, load, reps, variantTag? } for
  // ONE exercise. Walks backward from the most recent exposure, keeping
  // only the trailing run that shares its rep bracket AND (when tag data is
  // present at all) its variantTag -- a rep-range or logged-variant change
  // truncates the run rather than being averaged into it.
  function isolateTrailingRun(exposures) {
    if (!exposures.length) return { run: [], bracket: null };
    const latest = exposures[exposures.length - 1];
    const bracket = repBracketOf(latest.reps);
    const tagsPresent = exposures.some(function (e) { return e.variantTag != null; });
    const run = [];
    for (let i = exposures.length - 1; i >= 0; i--) {
      const e = exposures[i];
      if (repBracketOf(e.reps) !== bracket) break;
      if (tagsPresent && e.variantTag !== latest.variantTag) break;
      run.unshift(e);
    }
    return { run: run, bracket: bracket };
  }

  // Distinguishes a planned deload from a real stall: a sharp (>=10%) load
  // drop landing right after a flat-or-rising block reads as intentional;
  // the same drop capping off an already-declining block does not.
  function looksLikeIntentionalDeload(historicalLoads, latestLoad) {
    if (historicalLoads.length < 3) return false;
    const priorAvg = mean(historicalLoads);
    const dropRatio = (priorAvg - latestLoad) / priorAvg;
    if (dropRatio < 0.10) return false;
    const mid = Math.ceil(historicalLoads.length / 2);
    const firstHalf = historicalLoads.slice(0, mid);
    const secondHalf = historicalLoads.slice(mid);
    return mean(secondHalf) >= mean(firstHalf) * 0.98;
  }

  // input: { exerciseName, exposures: [{date,load,reps,variantTag?}] }
  // (chronological order not required -- sorted here).
  function detectStalledExercise(input) {
    const exposures = (input.exposures || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (exposures.length < 4) return null; // hard floor, no exceptions

    const iso = isolateTrailingRun(exposures);
    const run = iso.run;
    if (run.length < 4) return null; // rep-range/variant shift -- suppressed until N=4 rebuilds

    const loads = run.map(function (e) { return e.load; });
    const latest = run[run.length - 1];
    const historicalLoads = loads.slice(0, -1);
    const span = daysBetween(run[0].date, latest.date);
    const cv = coefficientOfVariation(loads);

    let confidence = null;
    if (run.length >= 10 && span <= 60 && cv < 0.15) confidence = 'high';
    else if (run.length >= 6) confidence = 'medium';
    else if (run.length >= 4 && span <= 30) confidence = 'low';
    if (!confidence) return null; // enough exposures, but not in a qualifying window

    const histMean = mean(historicalLoads);
    const histStdev = stdev(historicalLoads);
    const maxHistorical = Math.max.apply(null, historicalLoads);
    const isRegression = latest.load < (histMean - histStdev);
    const isPlateau = !isRegression && latest.load <= maxHistorical;
    if (!isRegression && !isPlateau) return null; // still progressing -- nothing to flag

    if (isRegression && looksLikeIntentionalDeload(historicalLoads, latest.load)) {
      return null; // ponytail: reads as a planned deload, not a regression -- suppressed, not softened
    }

    return {
      type: isRegression ? 'stalled-load-regression' : 'stalled-load-plateau',
      exercise: input.exerciseName,
      severity: confidence,
      observation: isRegression
        ? `${input.exerciseName}: latest load (${round1(latest.load)}) is more than 1 SD below the ${round1(histMean)} average of the last ${historicalLoads.length} exposures in the ${iso.bracket} rep bracket.`
        : `${input.exerciseName}: no new load/rep high across ${run.length} exposures in the ${iso.bracket} rep bracket (latest ${round1(latest.load)} vs prior best ${round1(maxHistorical)}).`,
      evidenceWindow: { start: run[0].date, end: latest.date },
      confidence: confidence,
      reviewQuestion: `Worth a look at ${input.exerciseName} — has technique, effort, or recovery around this lift changed recently?`,
    };
  }

  // sessionDates: array of 'YYYY-MM-DD', one per date anything was logged
  // (duplicates fine). now: Date, injected for testability. Needs at least
  // 4 weeks of history so a "recent" vs "baseline" comparison means
  // something.
  function detectMissedSessionTrend(input) {
    const dates = Array.from(new Set(input.sessionDates || [])).sort();
    if (dates.length < 4) return null;
    const now = input.now || new Date();
    function sessionsInWindow(daysAgoStart, daysAgoEnd) {
      const start = new Date(now); start.setUTCDate(start.getUTCDate() - daysAgoStart);
      const end = new Date(now); end.setUTCDate(end.getUTCDate() - daysAgoEnd);
      const startKey = start.toISOString().slice(0, 10), endKey = end.toISOString().slice(0, 10);
      return dates.filter(function (d) { return d >= startKey && d <= endKey; }).length;
    }
    const recentWeeks = sessionsInWindow(14, 0) / 2;   // avg/week, last 14 days
    const baselineWeeks = sessionsInWindow(42, 15) / 4; // avg/week, the 4 weeks before that
    if (baselineWeeks < 1) return null; // not enough baseline history to compare against
    const dropRatio = (baselineWeeks - recentWeeks) / baselineWeeks;
    if (dropRatio < 0.3) return null; // under 30% drop -- normal week-to-week noise
    return {
      type: 'missed-session-trend',
      severity: dropRatio >= 0.5 ? 'high' : 'medium',
      observation: `Session frequency dropped from ~${round1(baselineWeeks)}/week to ~${round1(recentWeeks)}/week over the last 2 weeks.`,
      evidenceWindow: { start: new Date(new Date(now).setUTCDate(now.getUTCDate() - 42)).toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) },
      confidence: dropRatio >= 0.5 ? 'medium' : 'low', // frequency alone is a weak signal either way
      reviewQuestion: 'Worth checking in on schedule or recovery — is the drop in session frequency intentional?',
    };
  }

  // weeklySets: chronological array of numbers (total hard sets/week),
  // oldest first. phase: 'growth'|'cut'|'show_prep'|'peak'|other/null.
  function detectVolumePhaseSignal(input) {
    const weeklySets = input.weeklySets || [];
    if (weeklySets.length < 6) return null; // need recent + baseline windows
    const recent = weeklySets.slice(-2);
    const baseline = weeklySets.slice(-6, -2);
    const recentAvg = mean(recent), baselineAvg = mean(baseline);
    if (baselineAvg === 0) return null;
    const changeRatio = (recentAvg - baselineAvg) / baselineAvg;

    let flag = null;
    if (input.phase === 'growth' && changeRatio <= -0.2) flag = 'volume dropped during a growth phase';
    else if ((input.phase === 'cut' || input.phase === 'show_prep') && changeRatio >= 0.2) flag = 'volume rose during a cut/prep phase';
    else if (input.phase === 'peak' && changeRatio >= 0.2) flag = 'volume rose during peak week, when it is expected to taper';
    if (!flag) return null;

    return {
      type: 'volume-phase-mismatch',
      severity: Math.abs(changeRatio) >= 0.35 ? 'medium' : 'low',
      observation: `${flag} — ${round1(recentAvg)} sets/wk recently vs ${round1(baselineAvg)} sets/wk baseline (${changeRatio >= 0 ? '+' : ''}${round1(changeRatio * 100)}%).`,
      evidenceWindow: { start: 'trailing 6-week window', end: 'most recent 2 weeks' },
      confidence: weeklySets.length >= 8 ? 'medium' : 'low',
      reviewQuestion: `Was this volume shift a deliberate call, or worth realigning with the ${input.phase} phase plan?`,
    };
  }

  // sleepEntries: array of { date, hours }. now: Date. performanceStalled:
  // boolean the caller passes in (typically "did detectStalledExercise fire
  // for anything this week") -- a sleep deviation alone is never enough,
  // per the correlation-not-single-night-lag guard.
  function detectRecoverySignal(input) {
    if (!input.performanceStalled) return null;
    const entries = (input.sleepEntries || []).filter(function (e) { return e && e.date && e.hours != null; });
    if (entries.length < 14) return null; // need real baseline + recent coverage, not a couple nights
    const now = input.now || new Date();
    function hoursInWindow(daysAgoStart, daysAgoEnd) {
      const start = new Date(now); start.setUTCDate(start.getUTCDate() - daysAgoStart);
      const end = new Date(now); end.setUTCDate(end.getUTCDate() - daysAgoEnd);
      const startKey = start.toISOString().slice(0, 10), endKey = end.toISOString().slice(0, 10);
      return entries.filter(function (e) { return e.date >= startKey && e.date <= endKey; }).map(function (e) { return e.hours; });
    }
    const recent = hoursInWindow(7, 0);
    // Baseline excludes the recent window itself -- otherwise the very
    // deviation being measured leaks into what it's measured against,
    // diluting both the mean and the spread.
    const baseline = hoursInWindow(37, 8);
    if (recent.length < 4 || baseline.length < 14) return null;
    const recentMa = mean(recent);
    const baselineMean = mean(baseline);
    const baselineStdev = stdev(baseline);
    if (baselineStdev === 0) return null;
    const deviation = (recentMa - baselineMean) / baselineStdev;
    if (Math.abs(deviation) <= 1.5) return null;

    return {
      type: 'recovery-signal',
      severity: 'medium',
      observation: `7-day avg sleep (${round1(recentMa)}h) is ${deviation > 0 ? 'above' : 'below'} the 30-day baseline (${round1(baselineMean)}h) by ${round1(Math.abs(deviation))} SD, alongside a performance stall this week.`,
      evidenceWindow: { start: new Date(new Date(now).setUTCDate(now.getUTCDate() - 30)).toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) },
      confidence: 'medium', // correlation, not causation -- never higher than medium
      reviewQuestion: 'Could recent sleep be a factor in the stalled lift(s) this week — worth a closer look?',
    };
  }

  // exercises: { exerciseName: exposures[] }. Runs every detector and
  // returns a flat array of findings, oldest concerns first. Never throws
  // on missing/partial input -- callers on thin data just get [].
  function runInsightEngine(input) {
    const findings = [];
    Object.keys(input.exercises || {}).forEach(function (name) {
      const f = detectStalledExercise({ exerciseName: name, exposures: input.exercises[name] });
      if (f) findings.push(f);
    });
    const missed = detectMissedSessionTrend({ sessionDates: input.sessionDates, now: input.now });
    if (missed) findings.push(missed);
    const volume = detectVolumePhaseSignal({ weeklySets: input.weeklySets, phase: input.phase });
    if (volume) findings.push(volume);
    const stalledAny = findings.some(function (f) { return f.type.indexOf('stalled-load') === 0; });
    const recovery = detectRecoverySignal({ sleepEntries: input.sleepEntries, now: input.now, performanceStalled: stalledAny });
    if (recovery) findings.push(recovery);
    return findings;
  }

  const api = {
    repBracketOf: repBracketOf,
    isolateTrailingRun: isolateTrailingRun,
    looksLikeIntentionalDeload: looksLikeIntentionalDeload,
    detectStalledExercise: detectStalledExercise,
    detectMissedSessionTrend: detectMissedSessionTrend,
    detectVolumePhaseSignal: detectVolumePhaseSignal,
    detectRecoverySignal: detectRecoverySignal,
    runInsightEngine: runInsightEngine,
  };
  if (typeof window !== 'undefined') window.TrainingInsightEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
