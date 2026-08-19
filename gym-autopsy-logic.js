// gym-autopsy-logic.js — pure classification/ranking for the merged
// post-workout autopsy modal. No DOM, no Supabase. See
// docs/superpowers/specs/2026-08-19-post-workout-autopsy-design.md.
(function () {
  'use strict';

  // rx: a getRx() result object, or null (first-ever logged session for
  // this exercise -- getRx() returns null when there's no prior log to
  // prescribe from). Returns 'beat' | 'met' | 'missed' | null.
  //
  // type 'up' always means the prior session's target was cleared (beat).
  // type 'down' (Deload, Pain — deload) and the 'Reassess'/'Repeat'/
  // 'Pain — repeat' tags all mean the session came in under what was asked
  // (missed) -- the pain-driven checkin override (applyCheckinOverride())
  // produces 'Pain — repeat' as a type:'hold' result, so it needs its own
  // tag check same as 'Repeat'. Everything else -- 'Add a rep', 'Push for
  // more' (bodyweight), 'Peak — hold' -- landed exactly where the Rx
  // expected (met).
  function classifyRxOutcome(rx) {
    if (!rx) return null;
    if (rx.type === 'up') return 'beat';
    if (rx.type === 'down') return 'missed';
    if (rx.tag === 'Reassess' || rx.tag === 'Repeat' || rx.tag === 'Pain — repeat') return 'missed';
    return 'met';
  }

  // outcomes: array of classifyRxOutcome() results for today's logged
  // exercises. The "why it changed" picker only shows when something
  // actually needs explaining.
  function sessionNeedsReason(outcomes) {
    return (outcomes || []).indexOf('missed') !== -1;
  }

  // rxList: array of getRx() results (may include null entries for
  // first-ever sessions) for today's logged exercises. Picks the single
  // highest-priority volumeAdvisory reason across all of them -- mirrors
  // getRx()'s own priority order (MRV pull-back > under-MEV add > phase-
  // target add > stall-based add), just applied across exercises instead
  // of within one. Returns null when nothing was flagged.
  function pickSuggestedChange(rxList) {
    let best = null;
    (rxList || []).forEach(function (rx) {
      const advisory = rx && rx.volumeAdvisory;
      if (!advisory) return;
      if (!best || advisory.priority > best.priority) best = advisory;
    });
    return best ? best.reason : null;
  }

  const api = {
    classifyRxOutcome: classifyRxOutcome,
    sessionNeedsReason: sessionNeedsReason,
    pickSuggestedChange: pickSuggestedChange,
  };
  if (typeof window !== 'undefined') window.GymAutopsyLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
