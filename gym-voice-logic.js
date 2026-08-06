// gym-voice-logic.js — pure transcript normalization + restricted exercise
// matching for voice set logging. No DOM, no Supabase, no dependency on
// gym.html's `state`: the candidate pool for matching is passed in
// explicitly so the caller controls scope (e.g. today's workout only).
(function () {
  'use strict';

  // "for", though it reads like a filler word, is intentionally NOT in this
  // list -- normalizeTranscript's digit-collapse regex keys off it. See the
  // bodyweight-phrasing test case for the known v1 gap this leaves.
  var FILLER_WORDS = ['log', 'please', 'set', 'at', 'on'];

  function normalizeTranscript(raw) {
    var s = (raw || '').toLowerCase().trim();
    // Collapse "X for Y" -> "X×Y" only when both sides are numeric, so
    // exercise names/words containing "for" are left alone.
    s = s.replace(/(\d+(?:\.\d+)?)\s+for\s+(\d+(?:\.\d+)?)/g, '$1×$2');
    var tokens = s.split(/\s+/).filter(function (t) {
      return t.length > 0 && FILLER_WORDS.indexOf(t) === -1;
    });
    return tokens.join(' ');
  }

  // Same bidirectional token-overlap scoring as gym.html's own
  // fuzzyMatchExercise() (threshold 0.35), but the candidate pool is an
  // explicit argument instead of being read from global state.
  // candidates: Array<{name: string, ...}> -- any extra fields on the
  // matched candidate are returned as-is.
  function restrictedFuzzyMatch(namePart, candidates) {
    var q = (namePart || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    var qTokens = q.split(/\s+/).filter(Boolean);
    if (!qTokens.length || !candidates || !candidates.length) return null;
    var best = null, bestScore = -1;
    candidates.forEach(function (c) {
      var name = c.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      var nTokens = name.split(/\s+/).filter(Boolean);
      var hits = 0;
      qTokens.forEach(function (qt) {
        if (nTokens.some(function (nt) { return nt.indexOf(qt) === 0 || qt.indexOf(nt) === 0; })) hits++;
      });
      var score = (hits * hits) / (Math.max(qTokens.length, 1) * Math.max(nTokens.length, 1));
      if (score > bestScore) { bestScore = score; best = c; }
    });
    return bestScore >= 0.35 ? best : null;
  }

  var api = { normalizeTranscript: normalizeTranscript, restrictedFuzzyMatch: restrictedFuzzyMatch };
  if (typeof window !== 'undefined') window.GymVoiceLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
