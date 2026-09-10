// sub-history-logic.js — per-variant "last set" for the substitution picker
// (gym.html's Alt modal). The picker showed the coach's stars but nothing
// about Carl; the per-variant logs already hold "what did I do last time on
// the cable version", this just surfaces it. Pure: no DOM, no Supabase,
// dual window/module.exports like every other *-logic.js. Spec:
// docs/superpowers/specs/2026-09-09-sub-picker-last-set-design.md
(function () {
  // Same rule as gym.html's getLogs(): a missing/undefined variant is the
  // primary exercise. Object keys can't be null, so the primary is keyed ''.
  function variantKey(v) { return v == null ? '' : v; }

  // Whole-day difference between two 'YYYY-MM-DD' keys. UTC-noon anchors so
  // a DST boundary can't yield 0.96 days -- both sides are calendar keys
  // written by the browser in Carl's timezone, so no TZ conversion belongs
  // here (tz-ok: key-vs-key arithmetic, never a "today" computed from a clock).
  function daysBetween(fromKey, toKey) {
    var a = Date.parse(fromKey + 'T12:00:00Z');
    var b = Date.parse(toKey + 'T12:00:00Z');
    return Math.round((b - a) / 86400000);
  }

  // logs: [{weight, reps, date, variant}] for one exercise.
  // variants: [null | name]. todayKey: 'YYYY-MM-DD'.
  // -> { [variantKey]: { weight, reps, date, daysAgo } | null }
  // Most recent date wins; on that date, top set by weight, then reps.
  function lastSetPerVariant(logs, variants, todayKey) {
    var out = {};
    variants.forEach(function (v) { out[variantKey(v)] = null; });
    (logs || []).forEach(function (l) {
      var k = variantKey(l.variant);
      if (!(k in out) || !l.date) return;
      var cur = out[k];
      var better = !cur
        || l.date > cur.date
        || (l.date === cur.date && (l.weight > cur.weight || (l.weight === cur.weight && l.reps > cur.reps)));
      if (better) out[k] = { weight: l.weight, reps: l.reps, date: l.date, daysAgo: daysBetween(l.date, todayKey) };
    });
    return out;
  }

  function formatLastSet(last) {
    if (!last) return 'Never used';
    var when = last.daysAgo === 0 ? 'today' : last.daysAgo === 1 ? 'yesterday' : last.daysAgo + 'd ago';
    return 'Last: ' + last.weight + ' × ' + last.reps + ' · ' + when;
  }

  var api = { lastSetPerVariant: lastSetPerVariant, formatLastSet: formatLastSet };
  if (typeof window !== 'undefined') window.SubHistoryLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
