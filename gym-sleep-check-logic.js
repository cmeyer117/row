// gym-sleep-check-logic.js — pure poor-sleep-night predicate for
// applyCheckinOverride(). Mirrors gym-rx-deload-logic.js's exact convention
// (no DOM, no Supabase, dual window/module.exports). See
// docs/superpowers/specs/2026-08-14-sleep-bridge-design.md.
(function () {
  'use strict';

  // entry: a single health:sleep record ({ date, hours, quality }) or
  // null/undefined if no entry exists for the date in question. hours and
  // quality (1-5 scale) are independently nullable -- Carl might log just
  // one. Either field alone crossing its threshold counts as poor.
  function isPoorSleepEntry(entry) {
    if (!entry) return false;
    var hoursLow = typeof entry.hours === 'number' && entry.hours < 6;
    var qualityLow = typeof entry.quality === 'number' && entry.quality <= 2;
    return hoursLow || qualityLow;
  }

  var api = { isPoorSleepEntry: isPoorSleepEntry };
  if (typeof window !== 'undefined') window.GymSleepCheckLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
