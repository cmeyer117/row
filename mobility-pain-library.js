// mobility-pain-library.js — data + pure render functions for mobility.html's
// Joint Care pain-library. No DOM, no Supabase — string-building only, so
// it's testable in Node the same way as gym-rx-phase-logic.js.
(function () {
  'use strict';

  var AREA_ORDER = ['shoulder', 'elbow', 'knee', 'hip', 'lowBack', 'wrist', 'ankle'];

  var PAIN_LIBRARY = {};

  PAIN_LIBRARY.shoulder = {
    label: 'Shoulder',
    causes: [
      'Poor T-spine mobility forces extra rotation through the GH joint under load',
      'Weak scapular stabilizers (serratus anterior, lower trap) let the humeral head ride up into the acromion during pressing or overhead work',
      'Repetitive overhead motion or flared-elbow bench pressing without enough rotator-cuff capacity to control it'
    ],
    drills: [
      {
        name: 'Side-lying ER with light DB',
        dose: '3 × 15 · 2–5 lbs',
        detail: 'Directly loads infraspinatus and teres minor — the muscles stabilizing the GH joint when the labrum is compromised.',
        slug: 'side-lying-er-dumbbell',
        diagramSvg: '<circle cx="20" cy="55" r="6"/><line x1="26" y1="55" x2="70" y2="58"/><line x1="70" y1="58" x2="60" y2="90"/><line x1="40" y1="55" x2="45" y2="40"/><line x1="45" y1="40" x2="55" y2="25"/><circle cx="57" cy="22" r="3"/>'
      },
      {
        name: 'Wall slides with upward rotation',
        dose: '2 × 10',
        detail: 'Retrains serratus anterior and lower trap. Without these firing, every arm elevation creates grinding and impingement.',
        slug: 'wall-slides',
        diagramSvg: '<line x1="20" y1="6" x2="20" y2="94"/><circle cx="45" cy="18" r="6"/><line x1="45" y1="24" x2="42" y2="55"/><line x1="42" y1="55" x2="38" y2="90"/><line x1="42" y1="55" x2="46" y2="90"/><line x1="43" y1="28" x2="28" y2="14"/><line x1="47" y1="28" x2="60" y2="14"/>'
      },
      {
        name: '90/90 shoulder rotation drill',
        dose: '2 × 10 reps',
        detail: 'Arm at 90° abduction, rotate palm down then up slowly. Lubricates the GH joint through its actual range.',
        slug: 'shoulder-90-90-rotation',
        diagramSvg: '<circle cx="50" cy="14" r="6"/><line x1="50" y1="20" x2="50" y2="55"/><line x1="50" y1="55" x2="45" y2="90"/><line x1="50" y1="55" x2="55" y2="90"/><line x1="48" y1="28" x2="70" y2="28"/><line x1="70" y1="28" x2="70" y2="10"/>'
      }
    ],
    avoid: [
      'Upright rows',
      'Behind-neck press',
      'Behind-neck pulldown',
      'Sleeping on the affected shoulder',
      'Arm behind body in internal rotation — stretches the posterior labrum directly'
    ],
    whenToSeeSomeone: [
      'Catching, popping, or a feeling of the joint shifting/giving way — that’s instability, not soreness',
      'Pain that disrupts sleep on that side',
      'No improvement after 8–12 weeks of consistent daily work'
    ],
    flareAction: 'Drop to cables/machines. Keep banded ER isometrics. Skip heavy pressing for the session.'
  };

  PAIN_LIBRARY.elbow = {
    label: 'Elbow',
    causes: [
      'Repeated wrist/forearm loading under grip-dominant work (curls, heavy pulling, forceful pronation/supination) creates microtears where the tendon attaches to the epicondyle',
      'Lateral elbow tendinopathy (tennis elbow) hits the outer elbow/extensor tendon; medial (golfer’s elbow) hits the inner elbow/flexor-pronator tendon',
      'Sudden jumps in arm-day volume or load without a ramp-up period'
    ],
    drills: [
      {
        name: 'Wrist isometrics (flexor + extensor)',
        dose: '5 × 15 sec each',
        detail: 'Flexor: palm up, push into resistance. Extensor: palm down, push back of hand up. Do before working sets that bother you.',
        slug: 'wrist-flexor-extensor-stretch',
        diagramSvg: '<line x1="20" y1="55" x2="60" y2="55"/><line x1="60" y1="55" x2="72" y2="45"/><line x1="65" y1="35" x2="70" y2="48"/>',
        note: 'Isometrics reduce tendon pain for 45+ min acutely (Cook & Purdam, 2009).'
      },
      {
        name: 'Tyler Twist (Theraband Flexbar)',
        dose: '3 × 15 daily',
        detail: 'Grip bar at both ends, one hand pronated one supinated. Flex both wrists, then slowly let the painful side extend against resistance.',
        slug: 'tyler-twist-flexbar',
        diagramSvg: '<line x1="30" y1="50" x2="70" y2="50"/><line x1="30" y1="50" x2="15" y2="40"/><line x1="70" y1="50" x2="85" y2="60"/><line x1="15" y1="40" x2="12" y2="30"/><line x1="85" y1="60" x2="88" y2="70"/>',
        note: 'Gold standard for lateral epicondylitis. Takes 6–8 weeks for full effect. Bisset et al. (2006) — superior to corticosteroid injections at 1 year.'
      },
      {
        name: 'Reverse wrist curls (eccentric)',
        dose: '3 × 15 · 3× per week on arm days',
        detail: 'Light DB (5–10 lbs), palm down. Lower wrist slowly 3–4 sec down, 1 sec up.',
        slug: 'reverse-wrist-curls',
        diagramSvg: '<line x1="20" y1="60" x2="60" y2="58"/><line x1="60" y1="58" x2="75" y2="50"/><circle cx="78" cy="47" r="4"/>'
      }
    ],
    avoid: [
      'Grinding through heavy curls/extensions on a day it’s already sore',
      'Death-grip pulling — let straps take the grip demand when flared',
      'Sudden volume or load jumps on isolation elbow work'
    ],
    whenToSeeSomeone: [
      'No improvement after 2 weeks of reduced load',
      'Losing grip strength',
      'Numbness or tingling into the hand — that’s nerve, not tendon, and needs a different workup'
    ],
    flareAction: 'Drop to bodyweight curls or isometrics. Use straps for back. Keep the Tyler Twist — it helps during flares.'
  };

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
