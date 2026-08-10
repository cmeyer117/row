// mobility-self-assessment.js — data + pure render/logic functions for
// mobility.html's Joint Care self-assessment. No DOM, no localStorage —
// string-building and plain-object logic only, so it's testable in Node
// the same way as mobility-pain-library.js.
(function () {
  'use strict';

  var STORAGE_KEY = 'mob_self_assessment_v1';

  var SELF_ASSESSMENT = [
    {
      area: 'shoulder',
      name: 'Wall overhead reach',
      instructions: 'Stand with your back flat against a wall, feet about 12 inches out. Keeping your low back pressed to the wall, raise both arms overhead as far as you can.',
      failCriteria: 'Fail if your ribs flare or your low back arches off the wall before your arms reach vertical — that means your shoulders are borrowing range from your spine instead of moving on their own.'
    },
    {
      area: 'elbow',
      name: 'Resisted wrist extension',
      instructions: 'Bend one elbow to 90°, forearm facing down, wrist relaxed. Try to bend your wrist upward (back of hand toward the ceiling) while your other hand presses down on it to resist the movement.',
      failCriteria: 'Fail if this reproduces pain on the outside of your elbow, at or near the bony bump (lateral epicondyle) — not just general forearm effort.'
    },
    {
      area: 'knee',
      name: 'Single-leg squat',
      instructions: 'Stand on one leg and squat down to roughly a 60° knee bend — about a quarter to a third of the way down — then stand back up. Repeat 2-3 times per side.',
      failCriteria: 'Fail if it reproduces pain directly below the kneecap, at the patellar tendon — general quad burn or balance wobble doesn’t count.'
    },
    {
      area: 'hip',
      name: '90/90 switch',
      instructions: 'Sit on the floor with both knees bent at 90°, one leg rotated in front of you and one out to the side. Lift both knees and rotate to switch which leg is in front, without using your hands.',
      failCriteria: 'Fail if you feel pinching or catching in the front of either hip, or if one side rotates noticeably less freely than the other.'
    },
    {
      area: 'lowBack',
      name: 'Toe touch',
      instructions: 'Stand with feet hip-width apart and slowly fold forward, reaching for your toes, keeping your knees soft (slightly bent, not locked).',
      failCriteria: 'Fail if it reproduces pain in your low back specifically. A stretching feeling in your hamstrings — even if you can’t reach your toes — is normal and not a fail.'
    },
    {
      area: 'wrist',
      name: 'Palm-flat table lean',
      instructions: 'Place one hand flat on a table with your fingers pointed back toward you (wrist bent). Slowly lean your body forward, letting your weight stretch the wrist further into extension.',
      failCriteria: 'Fail if this reproduces wrist pain before you feel a normal stretch through the forearm.'
    },
    {
      area: 'ankle',
      name: 'Knee-to-wall lunge',
      instructions: 'Stand facing a wall with your toes about 4 inches away. Keeping your heel flat on the ground, lunge forward and try to touch your knee to the wall.',
      failCriteria: 'Fail if your heel lifts off the ground before your knee reaches the wall.'
    }
  ];

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderTestCard(t) {
    return (
      '<div class="mob-card mob-selfassess-card" data-area="' + t.area + '">' +
        '<div class="mob-card-title">' + escapeHtml(t.name) + '</div>' +
        '<div class="mob-card-body">' + escapeHtml(t.instructions) + '</div>' +
        '<div class="mob-card-note">' + escapeHtml(t.failCriteria) + '</div>' +
        '<div class="mob-selfassess-buttons">' +
          '<button class="mob-selfassess-btn mob-selfassess-btn-pass" type="button" data-result="pass">Pass</button>' +
          '<button class="mob-selfassess-btn mob-selfassess-btn-fail" type="button" data-result="fail">Fail</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderTests() {
    var cards = SELF_ASSESSMENT.map(renderTestCard).join('');
    return (
      cards +
      '<button class="mob-selfassess-save-btn" id="selfAssessSaveBtn" type="button" style="display:none">Save results</button>'
    );
  }

  function passCount(results) {
    return SELF_ASSESSMENT.reduce(function (count, t) {
      return count + (results[t.area] === 'pass' ? 1 : 0);
    }, 0);
  }

  function renderSummary(saved) {
    if (!saved) {
      return (
        '<div class="mob-card">' +
          '<div class="mob-card-body">Run a quick 7-test self-assessment to see which areas need attention today.</div>' +
          '<button class="mob-selfassess-run-btn" id="selfAssessRunBtn" type="button">Run self-assessment</button>' +
        '</div>'
      );
    }
    return (
      '<div class="mob-card">' +
        '<div class="mob-card-body">Last assessed ' + escapeHtml(saved.date) + ' — ' + passCount(saved.results) + '/7 passed.</div>' +
        '<button class="mob-selfassess-run-btn" id="selfAssessRunBtn" type="button">Re-run self-assessment</button>' +
      '</div>'
    );
  }

  function getFailedAreas(results) {
    return SELF_ASSESSMENT.filter(function (t) { return results[t.area] === 'fail'; }).map(function (t) { return t.area; });
  }

  function allAnswered(results) {
    return SELF_ASSESSMENT.every(function (t) { return results[t.area] === 'pass' || results[t.area] === 'fail'; });
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    SELF_ASSESSMENT: SELF_ASSESSMENT,
    renderTests: renderTests,
    renderSummary: renderSummary,
    getFailedAreas: getFailedAreas,
    allAnswered: allAnswered
  };
  if (typeof window !== 'undefined') window.MobilitySelfAssessment = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
