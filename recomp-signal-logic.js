// recomp-signal-logic.js — pure functions for the "recomp signal": a
// weight-vs-waist read that's more honest than bodyweight alone during a
// recomp (rising/flat weight can still mean fat loss if muscle is being
// added). No DOM, no Supabase, no canvas/SVG rendering side effects beyond
// returning a plain SVG string. Dual export like row-wrapped-logic.js.
(function () {
  'use strict';

  var WEIGHT_FLAT_THRESHOLD = 1.0; // lbs — below this, treat weight as flat
  var WAIST_FLAT_THRESHOLD = 0.25; // inches — below this, treat waist as flat

  // series: [{date: 'YYYY-MM-DD', value: number}]. Filters to the last
  // windowDays relative to `now`, sorted ascending by date.
  function filterWindow(series, windowDays, now) {
    var cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    var cutoffKey = cutoff.toISOString().slice(0, 10);
    return (series || [])
      .filter(function (p) { return p.date >= cutoffKey; })
      .slice()
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  // Waist is the primary axis (it's the actual fat-loss proxy), weight is
  // the tie-break only when waist itself is trending. When waist is flat,
  // the read is "holding steady" regardless of what weight is doing.
  function classify(weightDelta, waistDelta) {
    var weightFlat = Math.abs(weightDelta) < WEIGHT_FLAT_THRESHOLD;
    var waistFlat = Math.abs(waistDelta) < WAIST_FLAT_THRESHOLD;
    var weightDir = weightFlat ? 'flat' : (weightDelta > 0 ? 'up' : 'down');
    var waistDir = waistFlat ? 'flat' : (waistDelta > 0 ? 'up' : 'down');

    if (waistDir === 'down') {
      return weightDir === 'down'
        ? { label: 'Cutting', detail: 'Weight and waist both trending down together.' }
        : { label: 'Good recomp signal', detail: 'Leaning out while holding/gaining size.' };
    }
    if (waistDir === 'up') {
      return weightDir === 'up'
        ? { label: 'Bulking — watch waist pace', detail: 'Both trending up — keep an eye on the ratio.' }
        : { label: 'Worth watching', detail: 'Waist up while weight isn\'t rising to match.' };
    }
    return { label: 'Holding steady', detail: 'No meaningful change in waist over this window.' };
  }

  // weightSeries/waistSeries: [{date, value}], already normalized by the
  // caller (weight comes from po_coach_weights's {dateKey, weight}, waist
  // from health:measurements's {date, waist} — different field names).
  function computeRecompDelta(weightSeries, waistSeries, windowDays, now) {
    now = now || new Date();
    var w = filterWindow(weightSeries, windowDays, now);
    var waist = filterWindow(waistSeries, windowDays, now);

    if (w.length < 2 && waist.length < 2) {
      return { ok: false, reason: 'Not enough weigh-ins or waist measurements in the last ' + windowDays + ' days.' };
    }
    if (w.length < 2) {
      return { ok: false, reason: 'Not enough weigh-ins in the last ' + windowDays + ' days.' };
    }
    if (waist.length < 2) {
      return { ok: false, reason: 'Not enough waist measurements in the last ' + windowDays + ' days.' };
    }

    var weightDelta = Math.round((w[w.length - 1].value - w[0].value) * 10) / 10;
    var waistDelta = Math.round((waist[waist.length - 1].value - waist[0].value) * 10) / 10;
    var result = classify(weightDelta, waistDelta);
    return {
      ok: true,
      weightDelta: weightDelta,
      waistDelta: waistDelta,
      label: result.label,
      detail: result.detail
    };
  }

  var api = {
    WEIGHT_FLAT_THRESHOLD: WEIGHT_FLAT_THRESHOLD,
    WAIST_FLAT_THRESHOLD: WAIST_FLAT_THRESHOLD,
    computeRecompDelta: computeRecompDelta
  };
  if (typeof window !== 'undefined') window.RecompSignalLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
