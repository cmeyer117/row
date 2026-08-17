// =============================================================
// Shared decision-memory write helper. Records a decision to the
// `decisions` table (shared across Row/Vessel/Vision/Content) —
// see docs/superpowers/specs/2026-08-17-shared-decision-memory-design.md.
// Pages that want to record a decision load this after the Supabase
// CDN script tag, same convention as sync.js.
// =============================================================
(function () {
  'use strict';
  const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

  window.recordDecision = function (fields) {
    if (!window.supabase) return Promise.reject(new Error('supabase-js not loaded'));
    if (!fields || !fields.decision_text) return Promise.reject(new Error('decision_text is required'));

    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supa.from('decisions').insert({
      app: 'row',
      category: fields.category || null,
      decision_text: fields.decision_text,
      rationale: fields.rationale || null,
      expected_outcome: fields.expected_outcome || null,
      alternatives_considered: fields.alternatives_considered || null,
      details: fields.details || {},
      review_date: fields.review_date || null,
    }).then(function (res) {
      if (res.error) throw new Error('recordDecision failed: ' + res.error.message);
      return res;
    });
  };

  // Returns the most recent open+due decision for a given category, or
  // null if none is blocking. "Due" matches the SQL shape documented in
  // the shared decision-memory spec: status='open' AND (review_date IS
  // NULL OR review_date <= today).
  window.getOpenDueDecision = function (category) {
    if (!window.supabase) return Promise.reject(new Error('supabase-js not loaded'));
    const today = new Date().toISOString().slice(0, 10);
    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supa.from('decisions')
      .select('*')
      .eq('app', 'row')
      .eq('category', category)
      .eq('status', 'open')
      .or(`review_date.is.null,review_date.lte.${today}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(function (res) {
        if (res.error) throw new Error('getOpenDueDecision failed: ' + res.error.message);
        return res.data && res.data[0] ? res.data[0] : null;
      });
  };

  window.closeDecision = function (id, verdict, outcomeNote) {
    if (!window.supabase) return Promise.reject(new Error('supabase-js not loaded'));
    if (!id || !verdict) return Promise.reject(new Error('id and verdict are required'));
    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supa.from('decisions').update({
      verdict: verdict,
      outcome_note: outcomeNote || null,
      status: 'reviewed',
      reviewed_at: new Date().toISOString(),
    }).eq('id', id).then(function (res) {
      if (res.error) throw new Error('closeDecision failed: ' + res.error.message);
      return res;
    });
  };
})();
