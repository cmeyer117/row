// stt-prompt-logic.js — pure function that builds an STT vocabulary-bias
// prompt from Carl's real exercise names, so Vision's /stt transcription is
// less likely to mishear "lat pulldown" as "lap pull down" (confirmed real
// mishear, 2026-08-12 fleet audit). No DOM/Supabase, dual-exported like
// recomp-signal-logic.js.
(function () {
  'use strict';

  var PREFIX = 'Exercise names Carl may say: ';
  var MAX_LEN = 900; // headroom under a sane header-length budget

  // exercises: [{name, ...}] from state.exercises (the 5-day program).
  // adhocExercises: [{name, ...}] from getAllAdhocExercises() (every ad-hoc
  // entry ever logged, across all dates -- not getAdhocExercises(), which is
  // today-only and would miss a one-off name Carl used weeks ago.
  function buildSttPrompt(exercises, adhocExercises) {
    var names = [];
    var seen = {};
    (exercises || []).concat(adhocExercises || []).forEach(function (ex) {
      var name = ex && ex.name;
      if (!name || seen[name]) return;
      seen[name] = true;
      names.push(name);
    });
    if (!names.length) return '';
    var full = PREFIX + names.join(', ');
    if (full.length <= MAX_LEN) return full;
    // Truncate at the last full name that still fits -- a cut-off exercise
    // name in the prompt is noise, not a partial hint.
    var truncated = full.slice(0, MAX_LEN);
    var lastComma = truncated.lastIndexOf(',');
    return lastComma > PREFIX.length ? truncated.slice(0, lastComma) : truncated;
  }

  var api = { buildSttPrompt: buildSttPrompt };
  if (typeof window !== 'undefined') window.SttPromptLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
