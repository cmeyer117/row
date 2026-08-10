// mobility-pain-library.js — data + pure render functions for mobility.html's
// Joint Care pain-library. No DOM, no Supabase — string-building only, so
// it's testable in Node the same way as gym-rx-phase-logic.js.
(function () {
  'use strict';

  var AREA_ORDER = ['shoulder', 'elbow', 'knee', 'hip', 'lowBack', 'wrist', 'ankle'];

  var PAIN_LIBRARY = {};

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  function renderDrillRow(d) {
    var photo = d.slug
      ? '<img class="mob-ex-photo" data-slug="' + escapeAttr(d.slug) + '" alt="' + escapeAttr(d.name) + '" style="display:none">'
      : '';
    var diagram = d.diagramSvg
      ? '<svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + d.diagramSvg + '</svg>'
      : '';
    var note = d.note ? '<div class="mob-ex-note">' + d.note + '</div>' : '';
    return (
      '<div class="mob-ex-row">' +
        '<div class="mob-ex-head">' +
          '<div class="mob-ex-name">' + d.name + '</div>' +
          '<svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>' +
        '<div class="mob-ex-detail"><strong>' + d.dose + '</strong> — ' + d.detail + '</div>' +
        '<div class="mob-ex-panel">' + photo + diagram + note + '</div>' +
      '</div>'
    );
  }

  function renderList(items) {
    return '<ul class="mob-pain-list">' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
  }

  function renderInfoAccordion(area) {
    return (
      '<div class="mob-ex-row">' +
        '<div class="mob-ex-head">' +
          '<div class="mob-ex-name">Causes, avoid list &amp; when to see someone</div>' +
          '<svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>' +
        '<div class="mob-ex-panel">' +
          '<div class="mob-pain-label">Causes</div>' + renderList(area.causes) +
          '<div class="mob-pain-label">Avoid</div>' + renderList(area.avoid) +
          '<div class="mob-pain-label">When to see someone</div>' + renderList(area.whenToSeeSomeone) +
          '<div class="mob-pain-label">If it flares</div>' +
          '<div class="mob-ex-detail">' + area.flareAction + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderPainLibraryArea(area) {
    return (
      '<div class="mob-divider"></div>' +
      '<div class="mob-block-title">' + area.label + '</div>' +
      '<div class="mob-exercise-list">' + area.drills.map(renderDrillRow).join('') + '</div>' +
      renderInfoAccordion(area)
    );
  }

  function renderAll() {
    return AREA_ORDER.map(function (key) { return renderPainLibraryArea(PAIN_LIBRARY[key]); }).join('');
  }

  var api = { AREA_ORDER: AREA_ORDER, PAIN_LIBRARY: PAIN_LIBRARY, renderAll: renderAll };
  if (typeof window !== 'undefined') window.MobilityPainLibrary = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
