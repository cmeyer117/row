// coach-read-recovery-logic.js -- pure stale Coach's Read recovery model.
// No DOM, localStorage, Supabase, or mutation.
(function () {
  'use strict';

  function staleWeekLabel(weekOf, nowMs) {
    if (typeof weekOf !== 'string' || weekOf.trim() === '') return null;
    const weekMs = new Date(weekOf + 'T00:00:00Z').getTime();
    if (!Number.isFinite(weekMs) || !Number.isFinite(nowMs)) return null;
    const days = Math.round((nowMs - weekMs) / 86400000);
    return days > 10 ? '· stale (week of ' + weekOf + ')' : null;
  }

  function latestWeightDate(weights) {
    if (!Array.isArray(weights)) return null;
    const valid = weights.filter(function (entry) {
      return entry
        && typeof entry === 'object'
        && typeof entry.dateKey === 'string'
        && entry.dateKey.trim() !== ''
        && entry.weight != null;
    });
    if (!valid.length) return null;
    valid.sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
    return valid[valid.length - 1].dateKey;
  }

  function hasSleepToday(sleep, today) {
    return Array.isArray(sleep)
      && typeof today === 'string'
      && sleep.some(function (entry) {
        return entry && typeof entry === 'object' && entry.date === today;
      });
  }

  function buildStaleCoachReadRecovery(input) {
    input = input && typeof input === 'object' ? input : {};
    const weekLabel = staleWeekLabel(input.weekOf, input.nowMs);
    if (!weekLabel) return null;

    const latestDate = latestWeightDate(input.weights);
    return {
      weekLabel: weekLabel,
      weight: {
        text: latestDate === input.today
          ? 'Weigh-in logged today'
          : latestDate ? 'Last weigh-in: ' + latestDate : 'No weigh-in logged',
        href: 'gym.html',
      },
      sleep: {
        text: hasSleepToday(input.sleep, input.today) ? 'Sleep logged today' : 'Sleep not logged today',
        href: '#sleepQuick',
      },
      review: { text: 'Open weekly review →', href: 'weekly-review.html' },
    };
  }

  const api = { buildStaleCoachReadRecovery: buildStaleCoachReadRecovery };
  if (typeof window !== 'undefined') window.CoachReadRecoveryLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
