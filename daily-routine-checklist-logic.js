(function () {
  'use strict';

  const MORNING_ITEMS = [
    { id: 'sunlight', label: 'Sunlight/bright light within 60 min of waking', kind: 'checkbox' },
    { id: 'cold_or_exercise', label: 'Cold shower or exercise', kind: 'checkbox' },
    { id: 'caffeine_delay', label: 'Delayed caffeine ~90-120 min', kind: 'checkbox' },
    { id: 'devotional', label: 'Devotional read today', kind: 'live', vesselKey: 'devotional_log' },
    { id: 'prayer', label: 'Prayer today', kind: 'live', vesselKey: 'prayer_log' },
  ];

  const EVENING_ITEMS = [
    { id: 'dim_lights', label: 'Dim lights the last 1-2 hours before bed', kind: 'checkbox' },
    { id: 'cool_room', label: 'Cool room temperature', kind: 'checkbox' },
    { id: 'casein_snack', label: 'Casein snack (cottage cheese/Greek yogurt)', kind: 'checkbox' },
    { id: 'melatonin', label: '1mg melatonin', kind: 'checkbox' },
    { id: 'journal', label: 'Journal today', kind: 'live', vesselKey: 'journal' },
  ];

  // vesselData is the raw `data` object of an app_state row (e.g. { 'vessel:prayer_log': [...] }).
  // Handles both real Vessel shapes: a bare date-string array (devotional_log/prayer_log)
  // and an array of {date, ...} objects (journal).
  function hasVesselActivityToday(vesselData, vesselKey, todayKey) {
    if (!vesselData) return false;
    const arr = vesselData['vessel:' + vesselKey];
    if (!Array.isArray(arr)) return false;
    return arr.some(function (entry) {
      const d = typeof entry === 'string' ? entry : (entry && entry.date);
      return d === todayKey;
    });
  }

  // items: MORNING_ITEMS or EVENING_ITEMS.
  // savedChecks: { [itemId]: boolean } from localStorage -- only used for 'checkbox' items.
  // vesselReads: { [vesselKey]: rawAppStateDataObjectOrNull } -- only used for 'live' items.
  // todayKey: 'YYYY-MM-DD' string.
  function buildChecklistState(items, savedChecks, vesselReads, todayKey) {
    return items.map(function (item) {
      if (item.kind === 'checkbox') {
        return Object.assign({}, item, { checked: !!(savedChecks && savedChecks[item.id]) });
      }
      const raw = vesselReads ? vesselReads[item.vesselKey] : undefined;
      const known = raw !== undefined;
      const checked = known ? hasVesselActivityToday(raw, item.vesselKey, todayKey) : false;
      return Object.assign({}, item, { checked: checked, unknown: !known });
    });
  }

  const api = {
    MORNING_ITEMS: MORNING_ITEMS,
    EVENING_ITEMS: EVENING_ITEMS,
    hasVesselActivityToday: hasVesselActivityToday,
    buildChecklistState: buildChecklistState,
  };
  if (typeof window !== 'undefined') window.DailyRoutineChecklistLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
