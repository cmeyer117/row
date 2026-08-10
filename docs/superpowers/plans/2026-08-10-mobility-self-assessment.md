# Mobility Self-Assessment Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 7-test self-assessment (one per `PAIN_LIBRARY` area) to `mobility.html`'s Joint Care tab that auto-expands and scrolls to failed areas' drill accordions, persisting the last result in its own localStorage key.

**Architecture:** New `mobility-self-assessment.js` holds the 7 tests' data plus pure string-building render functions (`renderSummary`, `renderTests`) and pure result-logic functions (`getFailedAreas`, `allAnswered`) — same no-DOM, Node-testable pattern as `mobility-pain-library.js` (`gym-rx-phase-logic.js` precedent: IIFE, `window.X` + `module.exports`). `mobility.html` owns all interactive behavior (button clicks, in-memory results tracking, localStorage read/write, auto-expand/scroll into the existing `PAIN_LIBRARY` accordions from Phase 1) in its inline script — the same render/behavior split Phase 1 established.

**Tech Stack:** Vanilla JS (ES5-style), no build step, no framework — static HTML page.

---

## Spec reference
`docs/superpowers/specs/2026-08-10-mobility-self-assessment-design.md` (`row@e254d0d`)

## Prerequisite context
Phase 1 (`row@490c775`) already shipped `mobility-pain-library.js` with `PAIN_LIBRARY` (7 areas: `shoulder`, `elbow`, `knee`, `hip`, `lowBack`, `wrist`, `ankle`) and `AREA_ORDER`. Each area renders as a `<div class="mob-divider">` + `<div class="mob-block-title">Label</div>` + `<div class="mob-exercise-list">...</div>` + one more `.mob-ex-row` (the "Causes, avoid list & when to see someone" info accordion), injected as flat siblings into `#painLibraryWrap`. This plan's auto-expand logic walks that exact sibling structure — `heading.nextElementSibling` is the exercise-list, `.nextElementSibling` again is the info accordion row.

---

## Task 1: `mobility-self-assessment.js` — data, render, and logic functions

**Files:**
- Create: `mobility-self-assessment.js`
- Create: `mobility-self-assessment.selfcheck.cjs`

- [ ] **Step 1: Write the failing selfcheck assertions**

```js
// mobility-self-assessment.selfcheck.cjs
// Run with: node mobility-self-assessment.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'mobility-self-assessment.js'), 'utf8'), sandbox);
const L = sandbox.window.MobilitySelfAssessment;

function assert(cond, label) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
}

// --- SELF_ASSESSMENT has exactly 7 tests, matching PAIN_LIBRARY's AREA_ORDER ---
assert(Array.isArray(L.SELF_ASSESSMENT), 'SELF_ASSESSMENT is an array');
assert(L.SELF_ASSESSMENT.length === 7, 'SELF_ASSESSMENT has exactly 7 tests');
var areas = L.SELF_ASSESSMENT.map(function (t) { return t.area; });
assert(
  JSON.stringify(areas) === JSON.stringify(['shoulder', 'elbow', 'knee', 'hip', 'lowBack', 'wrist', 'ankle']),
  'SELF_ASSESSMENT areas are exactly [shoulder, elbow, knee, hip, lowBack, wrist, ankle] in that order'
);
L.SELF_ASSESSMENT.forEach(function (t) {
  assert(typeof t.name === 'string' && t.name.length > 0, t.area + '.name is a non-empty string');
  assert(typeof t.instructions === 'string' && t.instructions.length > 0, t.area + '.instructions is a non-empty string');
  assert(typeof t.failCriteria === 'string' && t.failCriteria.length > 0, t.area + '.failCriteria is a non-empty string');
});

// --- STORAGE_KEY is the exact agreed key ---
assert(L.STORAGE_KEY === 'mob_self_assessment_v1', 'STORAGE_KEY is mob_self_assessment_v1');

// --- renderTests() renders all 7 cards with data-area, name, instructions, fail criteria ---
var testsHtml = L.renderTests();
assert(typeof testsHtml === 'string' && testsHtml.length > 0, 'renderTests() returns a non-empty string');
L.SELF_ASSESSMENT.forEach(function (t) {
  assert(testsHtml.indexOf('data-area="' + t.area + '"') !== -1, 'renderTests() output has data-area for ' + t.area);
  assert(testsHtml.indexOf(t.name) !== -1, 'renderTests() output contains name for ' + t.area);
  assert(testsHtml.indexOf(t.instructions) !== -1, 'renderTests() output contains instructions for ' + t.area);
  assert(testsHtml.indexOf(t.failCriteria) !== -1, 'renderTests() output contains fail criteria for ' + t.area);
});
assert(testsHtml.indexOf('id="selfAssessSaveBtn"') !== -1, 'renderTests() output includes the Save button');

// --- renderSummary(null) shows the "run it" prompt, no saved-date text ---
var freshSummary = L.renderSummary(null);
assert(freshSummary.indexOf('id="selfAssessRunBtn"') !== -1, 'renderSummary(null) includes the Run button');
assert(freshSummary.toLowerCase().indexOf('run') !== -1, 'renderSummary(null) prompts to run the assessment');

// --- renderSummary(saved) shows the date and pass count ---
var saved = { date: '2026-08-10', results: { shoulder: 'pass', elbow: 'fail', knee: 'pass', hip: 'pass', lowBack: 'fail', wrist: 'pass', ankle: 'pass' } };
var savedSummary = L.renderSummary(saved);
assert(savedSummary.indexOf('2026-08-10') !== -1, 'renderSummary(saved) shows the saved date');
assert(savedSummary.indexOf('5/7') !== -1, 'renderSummary(saved) shows the correct pass count (5/7)');
assert(savedSummary.indexOf('id="selfAssessRunBtn"') !== -1, 'renderSummary(saved) still includes the Run (re-run) button');

// --- getFailedAreas() returns only the failed area keys, in AREA_ORDER ---
var failed = L.getFailedAreas(saved.results);
assert(JSON.stringify(failed) === JSON.stringify(['elbow', 'lowBack']), 'getFailedAreas() returns [elbow, lowBack] for the sample result set');
assert(JSON.stringify(L.getFailedAreas({})) === JSON.stringify([]), 'getFailedAreas() returns an empty array for no results');
assert(
  JSON.stringify(L.getFailedAreas({ shoulder: 'pass', elbow: 'pass', knee: 'pass', hip: 'pass', lowBack: 'pass', wrist: 'pass', ankle: 'pass' })) === JSON.stringify([]),
  'getFailedAreas() returns an empty array when everything passed'
);

// --- allAnswered() requires all 7 areas present, any other value doesn't count ---
assert(L.allAnswered(saved.results) === true, 'allAnswered() is true when all 7 areas have a result');
assert(L.allAnswered({ shoulder: 'pass' }) === false, 'allAnswered() is false when only 1 of 7 areas has a result');
assert(L.allAnswered({}) === false, 'allAnswered() is false for an empty results object');

console.log('mobility-self-assessment.selfcheck.cjs: all assertions passed');
```

- [ ] **Step 2: Run it to confirm it fails (module doesn't exist yet)**

Run: `node mobility-self-assessment.selfcheck.cjs`
Expected: `Error: ENOENT: no such file or directory, open '.../mobility-self-assessment.js'`

- [ ] **Step 3: Write the module** — all 7 tests' real instructions/fail-criteria text (grounded in the spec's research pass: Physiopedia's Knee to Wall Test, Cozen's test, the single-leg decline squat pain-provocation test, and standard overhead/toe-touch/90-90 screens), plus the render and logic functions.

```js
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
```

- [ ] **Step 4: Run the selfcheck**

Run: `node mobility-self-assessment.selfcheck.cjs`
Expected: `mobility-self-assessment.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add mobility-self-assessment.js mobility-self-assessment.selfcheck.cjs
git commit -m "feat(mobility): self-assessment module — 7 tests, render + result logic"
```

---

## Task 2: Wire into `mobility.html`

**Files:**
- Modify: `mobility.html`

- [ ] **Step 1: Add the script tag**, right after `mobility-pain-library.js` (`mobility.html:17`). No `defer` — same reasoning as Phase 1: this must be loaded before the inline script at the bottom of `<body>` runs and calls into it.

```html
<script src="mobility-self-assessment.js"></script>
```

- [ ] **Step 2: Add CSS** for the self-assessment cards and buttons, in the `<style>` block near the existing `.mob-pain-label` rules added in Phase 1:

```css
.mob-selfassess-buttons { display: flex; gap: 8px; margin-top: 10px; }
.mob-selfassess-btn {
  flex: 1; padding: 8px 0; border-radius: 999px; font-size: 12px; font-weight: 700;
  letter-spacing: 0.04em; color: var(--text-3);
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s;
  -webkit-tap-highlight-color: transparent; font-family: inherit;
}
.mob-selfassess-btn-pass.selected { color: var(--good); background: rgba(110,231,183,0.10); border-color: rgba(110,231,183,0.30); }
.mob-selfassess-btn-fail.selected { color: var(--bad); background: rgba(255,138,138,0.10); border-color: rgba(255,138,138,0.30); }
.mob-selfassess-card.answered { border-color: var(--border-strong); }
.mob-selfassess-run-btn, .mob-selfassess-save-btn {
  display: block; width: 100%; margin-top: 10px; padding: 10px 0; border-radius: 10px;
  font-size: 13px; font-weight: 700; color: var(--text-1);
  background: rgba(110,231,183,0.12); border: 1px solid rgba(110,231,183,0.30);
  cursor: pointer; -webkit-tap-highlight-color: transparent; font-family: inherit;
}
```

- [ ] **Step 3: Add the markup skeleton** inside `#section-joints`, after the "Every Day" exercise list closes and before the existing shared framing card (`mobility.html:620-622` in the current file — the line right after the "Every Day — 5-8 Min" `.mob-exercise-list`'s closing `</div>` and right before `<div class="mob-divider"></div>` that precedes the shared "Do not go to zero" card):

```html
    <div class="mob-divider"></div>
    <div class="mob-block-title">Self-Assessment</div>
    <div id="selfAssessSummary"></div>
    <div id="selfAssessTests" style="display:none"></div>
```

- [ ] **Step 4: Add the interactive wiring**, inside the first inline `<script>` IIFE, right before the pain-library render call added in Phase 1 (`mobility.html:956` area — search for `var painLibraryWrap = document.getElementById('painLibraryWrap');` and insert immediately above it, since `expandFailedAreas` below needs `PAIN_LIBRARY` from that same script to already be loaded, which it is — both scripts load synchronously in `<head>` before this inline script runs):

```js
  // ── Self-assessment: render, wire up, and route failed areas into the pain library ──
  var selfAssessResults = {};
  var selfAssessSummaryEl = document.getElementById('selfAssessSummary');
  var selfAssessTestsEl = document.getElementById('selfAssessTests');

  function expandFailedAreas(failedAreas, shouldScroll) {
    var wrap = document.getElementById('painLibraryWrap');
    if (!wrap || !failedAreas.length || !window.MobilityPainLibrary) return;
    var firstRow = null;
    failedAreas.forEach(function (area) {
      var entry = window.MobilityPainLibrary.PAIN_LIBRARY[area];
      if (!entry) return;
      var headings = wrap.querySelectorAll('.mob-block-title');
      var heading = null;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].textContent === entry.label) { heading = headings[i]; break; }
      }
      if (!heading) return;
      var infoRow = heading.nextElementSibling && heading.nextElementSibling.nextElementSibling;
      if (infoRow && infoRow.classList.contains('mob-ex-row')) {
        infoRow.classList.add('expanded');
        if (!firstRow) firstRow = infoRow;
      }
    });
    if (shouldScroll && firstRow) firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function loadSelfAssessment() {
    if (!window.MobilitySelfAssessment) return;
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(window.MobilitySelfAssessment.STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
    if (selfAssessSummaryEl) selfAssessSummaryEl.innerHTML = window.MobilitySelfAssessment.renderSummary(saved);
    if (saved) expandFailedAreas(window.MobilitySelfAssessment.getFailedAreas(saved.results), false);
  }

  document.addEventListener('click', function (e) {
    if (!window.MobilitySelfAssessment) return;

    if (e.target.closest('#selfAssessRunBtn')) {
      selfAssessResults = {};
      selfAssessTestsEl.innerHTML = window.MobilitySelfAssessment.renderTests();
      selfAssessTestsEl.style.display = 'block';
      return;
    }

    var resultBtn = e.target.closest('.mob-selfassess-btn');
    if (resultBtn && selfAssessTestsEl.contains(resultBtn)) {
      var card = resultBtn.closest('.mob-selfassess-card');
      var area = card.getAttribute('data-area');
      selfAssessResults[area] = resultBtn.getAttribute('data-result');
      var siblingBtns = card.querySelectorAll('.mob-selfassess-btn');
      for (var i = 0; i < siblingBtns.length; i++) siblingBtns[i].classList.remove('selected');
      resultBtn.classList.add('selected');
      card.classList.add('answered');
      var saveBtn = document.getElementById('selfAssessSaveBtn');
      if (saveBtn && window.MobilitySelfAssessment.allAnswered(selfAssessResults)) {
        saveBtn.style.display = 'block';
      }
      return;
    }

    if (e.target.closest('#selfAssessSaveBtn')) {
      var record = { date: new Date().toISOString().slice(0, 10), results: selfAssessResults };
      localStorage.setItem(window.MobilitySelfAssessment.STORAGE_KEY, JSON.stringify(record));
      selfAssessSummaryEl.innerHTML = window.MobilitySelfAssessment.renderSummary(record);
      selfAssessTestsEl.style.display = 'none';
      expandFailedAreas(window.MobilitySelfAssessment.getFailedAreas(record.results), true);
      return;
    }
  });

  loadSelfAssessment();

```

- [ ] **Step 5: Manual verification** — no test framework for this static-HTML page (matches the existing convention). Start the `row` dev server and load `mobility.html` in a browser or the Browser pane preview tool:
  1. Click the "Joint Care" tab. Confirm the Self-Assessment card shows "Run a quick 7-test self-assessment..." (no prior saved result).
  2. Click "Run self-assessment" — confirm all 7 test cards render, in order (Shoulder, Elbow, Knee, Hip, Low Back, Wrist, Ankle), each with instructions, fail criteria, and Pass/Fail buttons. Confirm the Save button is hidden.
  3. Tap Pass/Fail on each card — confirm the tapped button highlights (and the other one un-highlights if you change your mind), and the card gets a visibly different border once answered.
  4. After answering all 7 (mix some pass and some fail, e.g. fail Elbow and Low Back), confirm the Save button appears.
  5. Tap Save — confirm: the test list hides, the summary card updates to "Last assessed [today] — N/7 passed", and the page scrolls to the first failed area's info accordion (already expanded).
  6. Scroll down manually — confirm every failed area's "Causes, avoid list & when to see someone" accordion is expanded, and passed areas' accordions are not.
  7. Reload the page — confirm the summary card still shows the saved result (persisted), and the failed areas' accordions are pre-expanded again without a scroll jump this time (no fresh run just happened).
  8. Resize to 375px width — confirm no horizontal overflow or broken layout in the self-assessment cards or buttons.

- [ ] **Step 6: Commit**

```bash
git add mobility.html
git commit -m "feat(mobility): wire self-assessment into Joint Care tab with auto-expand routing"
```

---

## Task 3: Final review

**Files:** none new — read-only verification pass.

- [ ] **Step 1: Re-run the self-assessment selfcheck** to confirm nothing broke during the HTML edits:

Run: `node mobility-self-assessment.selfcheck.cjs`
Expected: `mobility-self-assessment.selfcheck.cjs: all assertions passed`

- [ ] **Step 2: Re-run the Phase 1 pain-library selfcheck too**, since Task 2 touched shared script-loading order in `mobility.html`'s `<head>`:

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `mobility-pain-library.selfcheck.cjs: all assertions passed`

- [ ] **Step 3: Grep for any leftover TODO/placeholder text** accidentally left in the new files:

Run: `grep -n "TBD\|TODO\|FIXME" mobility-self-assessment.js mobility.html`
Expected: no matches (or only pre-existing matches unrelated to this feature — check any hit's surrounding context before assuming it's fine)
