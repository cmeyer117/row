// gym-daily-readiness-logic.js — pure scoring for the daily readiness card
// (gym.html's renderReadinessCard). 09-10 fleet audit Tier-2 build: unifies
// sleep and the pain/recovery/pump checkin into one graduated readiness
// level instead of the prior binary Good/Watch-it tag, which only checked
// (sleepPoor || checkinPoor) and threw away everything else the two
// signals could tell you together. No DOM, no Supabase.
//
// ponytail: velocity flags (form-coach.html's concentric-velocity fatigue
// tracking, stored under app_state key row:form-coach-history) are
// deliberately NOT folded in here yet -- gym.html has zero existing access
// to that key today (it's a separate page's own sync target), so pulling it
// in means a new cross-page network read in a page that's otherwise
// offline-first via localStorage+sync. Real value, bigger and riskier
// change than tonight's scope -- add when that read exists.
(function () {
  'use strict';

  // sleepEntry: { hours: number|null, quality: number|null } | null
  // checkin: { pain, recovery, pump } | null (pain/recovery: 'low'|'med'|'high'|null)
  // isPoorSleepFn: injected (GymSleepCheckLogic.isPoorSleepEntry) so this
  // stays pure and doesn't duplicate that threshold logic.
  // Returns { level: 'primed'|'ready'|'caution'|'rest', label: string, factors: string[] }.
  function computeDailyReadiness(sleepEntry, checkin, isPoorSleepFn) {
    const sleepPoor = typeof isPoorSleepFn === 'function' ? !!isPoorSleepFn(sleepEntry) : false;
    const recoveryLow = !!checkin && checkin.recovery === 'low';
    const recoveryHigh = !!checkin && checkin.recovery === 'high';
    const painHigh = !!checkin && checkin.pain === 'high';
    const sleepGood = !!sleepEntry && !sleepPoor && typeof sleepEntry.hours === 'number' && sleepEntry.hours >= 7;

    const factors = [];
    if (painHigh) factors.push('pain reported high');
    if (recoveryLow) factors.push('recovery reported low');
    if (sleepPoor) factors.push('sleep short or poor');
    if (!painHigh && !recoveryLow && !sleepPoor) {
      if (recoveryHigh) factors.push('recovery reported high');
      if (sleepGood) factors.push('slept ' + sleepEntry.hours + 'h');
    }

    // Pain always wins -- a high-pain day is never "primed" or "ready"
    // regardless of how good sleep/recovery look, same priority order
    // applyCheckinOverride already uses for the actual Rx decision.
    if (painHigh) {
      return { level: 'rest', label: 'Rest signal', factors: factors };
    }
    if (recoveryLow || sleepPoor) {
      return { level: 'caution', label: 'Caution', factors: factors };
    }
    if (recoveryHigh && sleepGood) {
      return { level: 'primed', label: 'Primed', factors: factors };
    }
    return { level: 'ready', label: 'Ready', factors: factors };
  }

  const api = { computeDailyReadiness: computeDailyReadiness };
  if (typeof window !== 'undefined') window.GymDailyReadinessLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
