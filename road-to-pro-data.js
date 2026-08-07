// road-to-pro-data.js — hand-curated Road to Pro timeline. Edited by
// Carl (or Claude on his instruction) and committed like any other
// content change. Never reads from po_coach_v1/live Supabase -- nothing
// in this file can leak private training data, by construction.
(function () {
  'use strict';
  var ENTRIES = [
    {
      date: '2026-08-07',
      title: 'The tracker goes live',
      body: 'Starting the public record of the road to a Pro card. Updates land here as they happen.',
      metric: null
    }
  ];
  var api = { ENTRIES: ENTRIES };
  if (typeof window !== 'undefined') window.RoadToProData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
