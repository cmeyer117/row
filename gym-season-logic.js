// gym-season-logic.js — pure date math for the Season Engine banner.
// No DOM, no Supabase.
(function () {
  'use strict';

  // dateKey: 'YYYY-MM-DD'. now: injectable Date for testability.
  // Returns 1 on the start date itself (not 0), counting inclusively.
  function daysSince(dateKey, now) {
    now = now || new Date();
    var start = new Date(dateKey + 'T00:00:00');
    var startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    var nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((nowDay - startDay) / 86400000) + 1;
  }

  function todayKey(now) {
    now = now || new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  if (typeof window !== 'undefined') {
    window.GymSeasonLogic = { daysSince: daysSince, todayKey: todayKey };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { daysSince: daysSince, todayKey: todayKey };
  }
})();
