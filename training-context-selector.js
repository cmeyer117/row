// training-context-selector.js — deterministic keyword/tag scoring over the
// generated vault-training-index.json (see scripts/build-vault-training-index.mjs).
// No vector DB, no embeddings, no API calls. Pure function: given the index
// and a set of query tags (exercise/muscle/phase/goal keywords), returns at
// most 3 relevant notes with a one-line reason each. If the index is
// missing, callers just pass [] / null in and get [] back -- this never
// throws, so a missing index can never block workout logging.
(function () {
  'use strict';

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const STALE_AFTER_DAYS = 180; // no update in 6 months -- likely superseded

  function freshnessOf(modifiedIso, now) {
    if (!modifiedIso) return { label: 'unknown', ageDays: null };
    const ageDays = Math.floor((now.getTime() - new Date(modifiedIso).getTime()) / MS_PER_DAY);
    if (ageDays < 0) return { label: 'fresh', ageDays: 0 };
    if (ageDays <= 30) return { label: 'fresh', ageDays: ageDays };
    if (ageDays <= STALE_AFTER_DAYS) return { label: 'aging', ageDays: ageDays };
    return { label: 'stale', ageDays: ageDays };
  }

  function norm(s) { return (s || '').toLowerCase(); }

  // Returns { score, reason } for one note against the query tags, or null
  // if nothing matched at all. Exact tag match scores highest (the note was
  // explicitly tagged for this), title substring next, heading substring
  // lowest (weakest signal, buried in the body).
  function scoreNote(note, queryTags) {
    let score = 0;
    let bestReason = null;
    const noteTags = (note.tags || []).map(norm);
    const title = norm(note.title);
    const headings = (note.headings || []).map(norm);

    queryTags.forEach(function (rawTag) {
      const tag = norm(rawTag);
      if (!tag) return;
      if (noteTags.indexOf(tag) !== -1) {
        score += 3;
        if (!bestReason || bestReason.weight < 3) bestReason = { weight: 3, text: `Tagged "${rawTag}"` };
      } else if (title.indexOf(tag) !== -1) {
        score += 2;
        if (!bestReason || bestReason.weight < 2) bestReason = { weight: 2, text: `Title mentions "${rawTag}"` };
      } else {
        const headingHit = headings.some(function (h) { return h.indexOf(tag) !== -1; });
        if (headingHit) {
          score += 1;
          if (!bestReason) bestReason = { weight: 1, text: `Mentions "${rawTag}" in a heading` };
        }
      }
    });
    if (score === 0) return null;
    return { score: score, reason: bestReason ? bestReason.text : 'Matched' };
  }

  // index: the `notes` array from vault-training-index.json (or the whole
  // parsed file -- both shapes accepted). queryTags: array of strings, e.g.
  // ['chest', 'growth', 'hypertrophy']. now: Date, injected for testability.
  // Returns at most 3 entries: { title, path, reason, freshness }.
  function selectNotes(index, queryTags, now) {
    const notes = Array.isArray(index) ? index : (index && index.notes) || [];
    if (!notes.length || !queryTags || !queryTags.length) return [];
    const asOf = now || new Date();

    const scored = [];
    notes.forEach(function (note) {
      const result = scoreNote(note, queryTags);
      if (!result) return;
      const freshness = freshnessOf(note.modified, asOf);
      // A stale note still surfaces (it may be the only source on this
      // topic) but loses priority against an equally-relevant fresh one.
      const penalty = freshness.label === 'stale' ? 1 : 0;
      scored.push({
        title: note.title,
        path: note.path,
        reason: result.reason,
        freshness: freshness.label,
        _rank: result.score - penalty,
      });
    });

    scored.sort(function (a, b) {
      if (b._rank !== a._rank) return b._rank - a._rank;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; // deterministic tiebreak
    });

    return scored.slice(0, 3).map(function (s) {
      return { title: s.title, path: s.path, reason: s.reason, freshness: s.freshness };
    });
  }

  const api = { selectNotes: selectNotes, freshnessOf: freshnessOf };
  if (typeof window !== 'undefined') window.TrainingContextSelector = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
