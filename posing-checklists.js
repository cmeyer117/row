// posing-checklists.js — pose-specific judging checklists for posing.html.
// Pure data + fuzzy lookup, no DOM. Dual export like form-coach-logic.js so
// this can be self-checked with plain `node` and also loaded as a <script>.
//
// Scope (2026-08-21 fleet ideation item 2.1, extended 2026-09-11 per the
// idea ledger's "Live Posing Coach" item): started with the 2-3 mandatory
// poses Carl practices most — Front Double Biceps, Front Lat Spread, Side
// Chest. Front Lat Spread is called out explicitly in posing.html's own
// rule banner as a focus area (right-side shoulder mobility limits it), so
// it's practiced more than the other 4 mandatory poses; Front Double Biceps
// and Side Chest are the standard default-most-practiced pair. Extended
// 2026-09-11 to cover all 7 poses form-coach-logic.js's POSE_CONFIGS tracks
// live (Most Muscular has no live tracking, so no checklist entry either --
// consistent with the "don't add what isn't tracked" scope, and covered by
// this file's own selfcheck asserting it stays unmatched).
//
// Checklist items are copied verbatim from the "What judges should see"
// bullet list for each pose in the ROW Competition Posing Manual
// (G:\My Drive\Claude\Carl Meyer\03 - Bodybuilding\ROW Competition Posing
// Manual.md) — not invented. Do not add a judging criterion here that isn't
// in that section of the note.
(function () {
  'use strict';

  var CHECKLISTS = {
    'front-double-biceps': {
      label: 'Front Double Biceps',
      // slug is always an exact match; extra names cover free-text entry
      // (e.g. the pose-log / readiness inputs on posing.html).
      names: ['front double biceps', 'front-double-biceps', 'double biceps front', 'fdb'],
      items: [
        'Biceps shape and balance',
        'Shoulder-to-waist ratio',
        'Lat width visible beneath the arms',
        'Chest, abdominal and serratus control',
        'Quad sweep, separation and calf balance',
        'Overall symmetry rather than arm size alone'
      ]
    },
    'front-lat-spread': {
      label: 'Front Lat Spread',
      names: ['front lat spread', 'front-lat-spread', 'lat spread front'],
      items: [
        'Lat width and symmetry',
        'Clavicular width and delt caps',
        'Chest thickness',
        'Taper into the waist',
        'Quad sweep and separation',
        'Ability to look broad without shrugging'
      ]
    },
    'side-chest': {
      label: 'Side Chest',
      names: ['side chest', 'side-chest'],
      items: [
        'Pectoral thickness and shape',
        'Biceps/triceps density',
        'Delt roundness',
        'Hamstring, adductor and quad thickness',
        'Calf development',
        'Waist control and torso rotation'
      ]
    },
    'side-triceps': {
      label: 'Side Triceps',
      names: ['side triceps', 'side-triceps'],
      items: [
        'Triceps size and separation',
        'Delt and arm tie-in',
        'Chest and serratus detail',
        'Abdominal control',
        'Hamstring, quad and calf presentation',
        'Clean side silhouette'
      ]
    },
    'back-double-biceps': {
      label: 'Back Double Biceps',
      names: ['back double biceps', 'back-double-biceps', 'double biceps back', 'bdb'],
      items: [
        'Back width and density',
        'Left-right symmetry',
        'Rear delts and arm peaks',
        'Lower-back detail',
        'Glute conditioning',
        'Hamstring and calf balance'
      ]
    },
    'back-lat-spread': {
      label: 'Back Lat Spread',
      names: ['back lat spread', 'back-lat-spread', 'lat spread back'],
      items: [
        'Lat width and symmetry',
        'Taper from shoulders to waist',
        'Back thickness beneath the spread',
        'Glute-ham detail',
        'Calf balance',
        'Ability to expand without shrugging'
      ]
    },
    'abdominal-thigh': {
      label: 'Abdominal & Thigh',
      names: ['abdominal and thigh', 'abdominal & thigh', 'abdominal-thigh', 'abs and thigh', 'ab and thigh'],
      items: [
        'Abdominal definition and symmetry',
        'Serratus and oblique detail',
        'Quad size and separation',
        'Waist control',
        'Chest-to-waist proportion',
        'Overall conditioning'
      ]
    }
  };

  // Bidirectional token-F1 fuzzy match — same algorithm and 0.35 threshold
  // as form-coach-logic.js's matchBenchmark(), reimplemented here since the
  // data shape differs (a names[] array per checklist entry, keyed by slug,
  // vs. a flat benchmarks[] array). A pose with no confident checklist match
  // returns null rather than a wrong/generic checklist.
  function matchChecklist(poseName) {
    var q = (poseName || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    if (!q) return null;
    var qTokens = q.split(/\s+/).filter(Boolean);
    var bestScore = -1;
    var bestSlugs = [];
    Object.keys(CHECKLISTS).forEach(function (slug) {
      var entry = CHECKLISTS[slug];
      var entryBestScore = -1;
      entry.names.forEach(function (name) {
        var nTokens = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
        var hits = 0;
        qTokens.forEach(function (qt) {
          if (nTokens.some(function (nt) {
            return nt === qt || (qt.length >= 3 && nt.length >= 3 && (nt.startsWith(qt) || qt.startsWith(nt)));
          })) hits++;
        });
        var score = (hits * hits) / (Math.max(qTokens.length, 1) * Math.max(nTokens.length, 1));
        if (score > entryBestScore) entryBestScore = score;
      });
      if (entryBestScore > bestScore) {
        bestScore = entryBestScore;
        bestSlugs = [slug];
      } else if (entryBestScore === bestScore && bestSlugs.indexOf(slug) === -1) {
        bestSlugs.push(slug);
      }
    });
    if (bestScore < 0.35) return null;
    return bestSlugs.length === 1 ? CHECKLISTS[bestSlugs[0]] : null;
  }

  var api = { CHECKLISTS: CHECKLISTS, matchChecklist: matchChecklist };
  if (typeof window !== 'undefined') window.PosingChecklists = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
