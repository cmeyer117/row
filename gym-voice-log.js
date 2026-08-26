// gym-voice-log.js — parses a spoken set transcript ("incline press, 245 for
// 8") into a structured { exId, weight, reps }, or an { error } if either
// the exercise or the numbers can't be resolved. Pure logic, no DOM/network,
// so a mishear never auto-logs a guess -- the caller (gym.html) decides what
// to do with an error. See docs/superpowers/specs/2026-08-26-voice-set-logger-design.md.
(function () {
  'use strict';

  var NUMBER_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20
  };
  var REP_WORDS = { rep: true, reps: true };
  var WEIGHT_WORDS = { pound: true, pounds: true, lb: true, lbs: true };
  var STOPWORDS = { the: true, a: true, an: true, and: true };
  var MATCH_THRESHOLD = 0.5; // at least half an exercise's significant words must appear in the transcript

  function tokenize(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9.\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  function significantWords(name) {
    return tokenize(name).filter(function (w) { return !STOPWORDS[w]; });
  }

  // Picks the exercise whose name shares the highest fraction of its
  // significant words with the transcript -- e.g. "flat chest press" matches
  // "Smith Machine Flat Chest Press" (3/5 words) above threshold.
  function matchExercise(tokens, exercises) {
    var transcriptSet = {};
    tokens.forEach(function (w) { transcriptSet[w] = true; });
    var best = null, bestScore = 0;
    (exercises || []).forEach(function (ex) {
      var words = significantWords(ex.name);
      if (!words.length) return;
      var matched = words.filter(function (w) { return transcriptSet[w]; }).length;
      var score = matched / words.length;
      if (score > bestScore) { bestScore = score; best = ex; }
    });
    return bestScore >= MATCH_THRESHOLD ? best : null;
  }

  function extractNumbers(tokens) {
    var out = [];
    tokens.forEach(function (t, i) {
      var val = null;
      if (/^\d+(\.\d+)?$/.test(t)) val = parseFloat(t);
      else if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, t)) val = NUMBER_WORDS[t];
      if (val !== null) out.push({ value: val, index: i });
    });
    return out;
  }

  // Finds "N RIR" / "N reps in reserve" and drops that number from the list
  // before weight/reps role assignment, so it's never mistaken for a rep count.
  function findRirMarkerIndex(tokens) {
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'rir') return i;
      if (tokens[i] === 'reserve' && tokens[i - 1] === 'in' && REP_WORDS[tokens[i - 2]]) return i - 2;
    }
    return -1;
  }

  function stripRirNumber(numbers, tokens) {
    var markerIdx = findRirMarkerIndex(tokens);
    if (markerIdx === -1) return numbers;
    var rirEntry = null;
    for (var i = numbers.length - 1; i >= 0; i--) {
      if (numbers[i].index < markerIdx) { rirEntry = numbers[i]; break; }
    }
    return rirEntry ? numbers.filter(function (n) { return n !== rirEntry; }) : numbers;
  }

  // A number immediately followed by "rep(s)" is reps; immediately followed
  // by "pound(s)/lb(s)" is weight. Any number left unlabeled fills weight
  // first, then reps, in the order it was spoken -- covers the plain
  // "245 for 8" phrasing where neither number carries a cue word.
  function assignRoles(numbers, tokens) {
    var consumed = {};
    var reps = null, weight = null;
    numbers.forEach(function (n) {
      if (reps !== null) return;
      if (REP_WORDS[tokens[n.index + 1]]) { reps = n.value; consumed[n.index] = true; }
    });
    numbers.forEach(function (n) {
      if (weight !== null || consumed[n.index]) return;
      if (WEIGHT_WORDS[tokens[n.index + 1]]) { weight = n.value; consumed[n.index] = true; }
    });
    var unlabeled = numbers.filter(function (n) { return !consumed[n.index]; });
    if (weight === null && unlabeled.length) weight = unlabeled.shift().value;
    if (reps === null && unlabeled.length) reps = unlabeled.shift().value;
    return { weight: weight, reps: reps };
  }

  function parseSetUtterance(transcript, todaysExercises, allExercises) {
    var tokens = tokenize(transcript);
    var ex = matchExercise(tokens, todaysExercises) || matchExercise(tokens, allExercises);
    if (!ex) return { error: 'no-match', transcript: transcript || '' };

    var numbers = stripRirNumber(extractNumbers(tokens), tokens);

    if (ex.bw) {
      var roles = assignRoles(numbers, tokens);
      var repsOnly = roles.reps !== null ? roles.reps : roles.weight;
      if (repsOnly === null) return { error: 'no-numbers', transcript: transcript || '' };
      return { exId: ex.id, weight: 0, reps: Math.round(repsOnly) };
    }

    var result = assignRoles(numbers, tokens);
    if (result.weight === null || result.reps === null) return { error: 'no-numbers', transcript: transcript || '' };
    return { exId: ex.id, weight: result.weight, reps: Math.round(result.reps) };
  }

  var api = { parseSetUtterance: parseSetUtterance };
  if (typeof window !== 'undefined') window.GymVoiceLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
