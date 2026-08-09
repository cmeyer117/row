# Mobility Pain-Library Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `mobility.html`'s Joint Care tab from 3 areas (Shoulder/Elbow/Knee) to 7 (adds Hip, Low Back, Wrist, Ankle/Achilles), each with drills plus causes/avoid/when-to-see-someone/flare-up-action content, replacing today's hand-authored per-joint HTML and the standalone Flare-Up Rules table.

**Architecture:** New `mobility-pain-library.js` holds a `PAIN_LIBRARY` data object (7 areas) and pure string-building render functions — no DOM APIs, so it's testable in Node like the codebase's other `*-logic.js` modules (`gym-rx-phase-logic.js` is the direct precedent: IIFE exposing `window.X` + `module.exports`, verified with a `.selfcheck.cjs`). `mobility.html` loads the script, replaces the old hand-authored Shoulder/Elbow/Knee blocks + Flare-Up Rules table with a single `<div id="painLibraryWrap">`, and calls the renderer on load. Existing `.mob-ex-row` expand/collapse markup and event delegation (`document.addEventListener('click', ...)` on `.mob-ex-head`, already delegated — see `mobility.html:1146-1150`) work on the injected HTML with zero new wiring.

**Tech Stack:** Vanilla JS (ES5-style, matching the codebase's existing `*-logic.js` files), no build step, no framework — static HTML page.

---

## Spec reference
`docs/superpowers/specs/2026-08-09-mobility-pain-library-design.md` (`row@77b5e60`)

## Content sourcing
Causes/avoid/when-to-see-someone content for the 4 new areas (Hip, Low Back, Wrist, Ankle) and deepened content for the 3 existing areas (Shoulder, Elbow, Knee) is grounded in a real research pass done during planning (Mayo Clinic, Cleveland Clinic, Physio-pedia, Hinge Health, and sports-med/PT sources on FAI/labral tears, cauda equina red flags, TFCC/wrist tendinopathy, and Achilles tendinopathy) — not written from memory alone, per the spec's Content Research section. Shoulder/Elbow/Knee's existing drill content (dose/detail/notes/SVG diagrams) is migrated verbatim from the current hand-authored HTML, not rewritten.

---

## Task 1: `mobility-pain-library.js` module skeleton + render functions

**Files:**
- Create: `mobility-pain-library.js`
- Create: `mobility-pain-library.selfcheck.cjs`

- [ ] **Step 1: Write the failing selfcheck assertions**

```js
// mobility-pain-library.selfcheck.cjs
// Run with: node mobility-pain-library.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'mobility-pain-library.js'), 'utf8'), sandbox);
const L = sandbox.window.MobilityPainLibrary;

function assert(cond, label) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
}

// --- AREA_ORDER covers exactly the 7 expected areas, in the spec's order ---
assert(Array.isArray(L.AREA_ORDER), 'AREA_ORDER is an array');
assert(
  JSON.stringify(L.AREA_ORDER) === JSON.stringify(['shoulder', 'elbow', 'knee', 'hip', 'lowBack', 'wrist', 'ankle']),
  'AREA_ORDER is exactly [shoulder, elbow, knee, hip, lowBack, wrist, ankle] in that order'
);

// --- every area in AREA_ORDER has a PAIN_LIBRARY entry with the required shape ---
L.AREA_ORDER.forEach(function (key) {
  var area = L.PAIN_LIBRARY[key];
  assert(area, 'PAIN_LIBRARY has an entry for ' + key);
  assert(typeof area.label === 'string' && area.label.length > 0, key + '.label is a non-empty string');
  assert(Array.isArray(area.causes) && area.causes.length > 0, key + '.causes is a non-empty array');
  assert(Array.isArray(area.drills) && area.drills.length > 0, key + '.drills is a non-empty array');
  assert(Array.isArray(area.avoid) && area.avoid.length > 0, key + '.avoid is a non-empty array');
  assert(Array.isArray(area.whenToSeeSomeone) && area.whenToSeeSomeone.length > 0, key + '.whenToSeeSomeone is a non-empty array');
  assert(typeof area.flareAction === 'string' && area.flareAction.length > 0, key + '.flareAction is a non-empty string');
  area.drills.forEach(function (d, i) {
    assert(typeof d.name === 'string' && d.name.length > 0, key + '.drills[' + i + '].name is a non-empty string');
    assert(typeof d.dose === 'string' && d.dose.length > 0, key + '.drills[' + i + '].dose is a non-empty string');
    assert(typeof d.detail === 'string' && d.detail.length > 0, key + '.drills[' + i + '].detail is a non-empty string');
  });
});

// --- renderAll() produces one block per area, in AREA_ORDER, with no leftover template markers ---
var html = L.renderAll();
assert(typeof html === 'string' && html.length > 0, 'renderAll() returns a non-empty string');
L.AREA_ORDER.forEach(function (key) {
  var area = L.PAIN_LIBRARY[key];
  assert(html.indexOf(area.label) !== -1, 'renderAll() output contains the ' + key + ' label');
  area.drills.forEach(function (d) {
    assert(html.indexOf(d.name) !== -1, 'renderAll() output contains drill name "' + d.name + '"');
  });
});
assert(html.indexOf('undefined') === -1, 'renderAll() output has no stray "undefined"');
assert(html.indexOf('[object Object]') === -1, 'renderAll() output has no stray "[object Object]"');

// --- order check: shoulder's heading appears before elbow's, which appears before knee's, etc. ---
// NOTE: must match the wrapped <div class="mob-block-title">Label</div> heading markup, not a
// bare label substring — several areas' drill names mention other areas by name (e.g. Elbow's
// drills are literally titled "Wrist isometrics" and "Reverse wrist curls"), so a loose
// indexOf(label) can match inside an earlier area's block and produce a false failure here.
var positions = L.AREA_ORDER.map(function (key) {
  var heading = '<div class="mob-block-title">' + L.PAIN_LIBRARY[key].label + '</div>';
  return html.indexOf(heading);
});
for (var i = 1; i < positions.length; i++) {
  assert(positions[i] > positions[i - 1], L.AREA_ORDER[i] + ' block appears after ' + L.AREA_ORDER[i - 1] + ' block');
}

console.log('mobility-pain-library.selfcheck.cjs: all assertions passed');
```

- [ ] **Step 2: Run it to confirm it fails (module doesn't exist yet)**

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `Error: ENOENT: no such file or directory, open '.../mobility-pain-library.js'`

- [ ] **Step 3: Write the module skeleton and render functions (data object left empty for now — filled in by Tasks 2-8)**

```js
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
```

- [ ] **Step 4: Run selfcheck again to confirm it now fails on empty data, not a missing file**

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `FAIL: PAIN_LIBRARY has an entry for shoulder` (proves the skeleton loads correctly; data gets filled in next task)

- [ ] **Step 5: Commit**

```bash
git add mobility-pain-library.js mobility-pain-library.selfcheck.cjs
git commit -m "feat(mobility): pain-library module skeleton + render functions"
```

---

## Task 2: Shoulder entry

**Files:**
- Modify: `mobility-pain-library.js` (fill in `PAIN_LIBRARY.shoulder`)

- [ ] **Step 1: Add the Shoulder entry** (drill content migrated verbatim from `mobility.html`'s current "Right Shoulder — Posterior Labrum Recovery" block; causes/avoid/whenToSeeSomeone/flareAction grounded in the research pass + the page's existing "Avoid:" note)

Insert into `PAIN_LIBRARY = {}` in `mobility-pain-library.js`:

```js
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
```

- [ ] **Step 2: Run the selfcheck**

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `FAIL: PAIN_LIBRARY has an entry for elbow` (shoulder now passes its own checks; next unfilled area fails, proving shoulder's content is wired correctly)

- [ ] **Step 3: Commit**

```bash
git add mobility-pain-library.js
git commit -m "feat(mobility): pain-library shoulder content"
```

---

## Task 3: Elbow entry

**Files:**
- Modify: `mobility-pain-library.js` (fill in `PAIN_LIBRARY.elbow`)

- [ ] **Step 1: Add the Elbow entry** (drill content migrated verbatim from `mobility.html`'s current "Elbow Care — Tendinopathy Protocol" block)

```js
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
```

- [ ] **Step 2: Run the selfcheck**

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `FAIL: PAIN_LIBRARY has an entry for knee`

- [ ] **Step 3: Commit**

```bash
git add mobility-pain-library.js
git commit -m "feat(mobility): pain-library elbow content"
```

---

## Task 4: Knee entry

**Files:**
- Modify: `mobility-pain-library.js` (fill in `PAIN_LIBRARY.knee`)

- [ ] **Step 1: Add the Knee entry** (drill content migrated verbatim from `mobility.html`'s current "Knee Care — Patellar Tendinopathy Protocol" block; the existing "After leg day" tip folds into `flareAction`)

```js
  PAIN_LIBRARY.knee = {
    label: 'Knee',
    causes: [
      'Patellar tendon overload from jumping, heavy squatting, or a sudden training-load spike',
      'Quad/hamstring strength imbalance shifting extra strain onto the tendon',
      'Tight quads and calves increasing tension through the patellar tendon and posterior knee chain'
    ],
    drills: [
      {
        name: 'Spanish squat isometric',
        dose: '5 × 45 sec before leg sessions',
        detail: 'Knee bent 60–90°. Isometrics reduce patellar tendon pain acutely — do them, then train.',
        slug: 'spanish-squat-isometric',
        diagramSvg: '<circle cx="55" cy="16" r="6"/><line x1="55" y1="22" x2="48" y2="50"/><line x1="48" y1="50" x2="45" y2="75"/><line x1="45" y1="75" x2="45" y2="92"/><line x1="20" y1="50" x2="80" y2="50"/>'
      },
      {
        name: 'Reverse Nordic curl',
        dose: '3 × 5, build to 3 × 15 over 6–8 weeks',
        detail: 'Kneel on pad, feet anchored under rack. Lower torso backward slowly (3–4 sec) as far as pain allows, pull back up.',
        slug: 'reverse-nordic-curl',
        diagramSvg: '<circle cx="60" cy="30" r="6"/><line x1="58" y1="36" x2="45" y2="70"/><line x1="45" y1="70" x2="45" y2="88"/><line x1="45" y1="88" x2="65" y2="88"/><line x1="55" y1="45" x2="45" y2="55"/>',
        note: 'Gold standard eccentric for patellar tendinopathy. Actually remodels the tendon (Purdam et al. 2004, Visnes & Bahr 2007).'
      },
      {
        name: 'TKE with band',
        dose: '3 × 15/leg',
        detail: 'Band looped behind knee, slight knee bend, extend fully. Fixes patellar tracking by strengthening VMO.',
        slug: 'tke-band',
        diagramSvg: '<circle cx="50" cy="14" r="6"/><line x1="50" y1="20" x2="50" y2="55"/><line x1="50" y1="55" x2="45" y2="90"/><line x1="50" y1="55" x2="65" y2="65"/><line x1="65" y1="65" x2="80" y2="60"/><line x1="20" y1="65" x2="80" y2="65"/>'
      },
      {
        name: 'Foam roller — outer quad + IT band',
        dose: '60 sec/leg',
        detail: 'Find tight spots and hold 10–15 sec. Also roll quad muscle belly and calves (tight calves pull on posterior knee chain).',
        slug: 'foam-roller-quad-itband',
        diagramSvg: '<ellipse cx="50" cy="70" rx="22" ry="6"/><circle cx="20" cy="45" r="6"/><line x1="25" y1="48" x2="55" y2="60"/><line x1="55" y1="60" x2="80" y2="62"/><line x1="30" y1="55" x2="20" y2="70"/>'
      }
    ],
    avoid: [
      'High-volume jump/plyo work through pain',
      'Deep loaded squats during an acute flare',
      'Sudden spikes in squat volume or intensity — the tendon needs a ramp, not a jump'
    ],
    whenToSeeSomeone: [
      'Pain at rest, not just with load — atypical for tendinopathy and worth a look',
      'Visible swelling',
      'A sense of the tendon giving way — possible partial tear, not just irritation'
    ],
    flareAction: 'Spanish squat holds + TKE only. No loaded squatting until 2–3 days clear. After training: elevate legs 10–15 min, ice directly on the patellar tendon 10 min if acutely painful.'
  };
```

- [ ] **Step 2: Run the selfcheck**

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `FAIL: PAIN_LIBRARY has an entry for hip`

- [ ] **Step 3: Commit**

```bash
git add mobility-pain-library.js
git commit -m "feat(mobility): pain-library knee content"
```

---

## Task 5: Hip entry (new area)

**Files:**
- Modify: `mobility-pain-library.js` (fill in `PAIN_LIBRARY.hip`)

- [ ] **Step 1: Add the Hip entry** (new drills — text-first, no diagrams, per spec's out-of-scope note on new artwork)

```js
  PAIN_LIBRARY.hip = {
    label: 'Hip',
    causes: [
      'FAI (extra bone growth at the hip joint) or a labral tear irritated by deep loaded ranges — ATG squats, deep lunges, cleans/snatches',
      'Hip flexor strain from sudden ballistic movement or overuse without adequate recovery',
      'Hip pain accounts for roughly a quarter of powerlifting injuries, driven by the heavy hip-torque demands of the squat and deadlift'
    ],
    drills: [
      {
        name: 'Standing hip flexor stretch',
        dose: '3 × 30 sec/side',
        detail: 'Half-kneeling, back knee down, squeeze the glute and shift weight forward until you feel a stretch through the front of the hip. Keep the torso tall — don’t arch the low back to fake range.'
      },
      {
        name: '90/90 hip switches',
        dose: '2 × 10 switches',
        detail: 'Seated, both knees bent 90°, rotate from one hip’s internal rotation to the other’s external rotation without using your hands. Restores the rotational range squat depth needs.'
      },
      {
        name: 'Banded hip abduction (clamshell / monster walk)',
        dose: '3 × 15/side',
        detail: 'Light band above the knees, side-lying clamshells or standing monster walks. Builds glute medius to control the femur during single-leg and loaded work.'
      },
      {
        name: 'Deep squat hold',
        dose: '2 × 30–45 sec',
        detail: 'Bodyweight only, hold the bottom of a squat within a pain-free range — don’t force depth past a pinch.'
      }
    ],
    avoid: [
      'Forcing depth past a pinching or catching point in the front of the hip',
      'Ballistic deep lunges or cleans/snatches during a flare',
      'Ignoring repeated pinching pain at the bottom of squats — that’s the impingement signal, not just tightness'
    ],
    whenToSeeSomeone: [
      'Intense pain that disrupts sleep',
      'Sudden swelling or bruising',
      'Inability to bear weight',
      'Pinching or catching that doesn’t resolve after 4–6 weeks of modified training'
    ],
    flareAction: 'Back off to a pain-free squat depth (box squats/leg press instead of ATG). Keep isometric glute and hip-flexor work. Skip anything ballistic (jumps, cleans) until it settles.'
  };
```

- [ ] **Step 2: Run the selfcheck**

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `FAIL: PAIN_LIBRARY has an entry for lowBack`

- [ ] **Step 3: Commit**

```bash
git add mobility-pain-library.js
git commit -m "feat(mobility): pain-library hip content (new area)"
```

---

## Task 6: Low Back entry (new area)

**Files:**
- Modify: `mobility-pain-library.js` (fill in `PAIN_LIBRARY.lowBack`)

- [ ] **Step 1: Add the Low Back entry**, including the genuinely urgent cauda-equina red flags (distinct in severity from every other area's when-to-see-someone list — these need same-day care, not a training modification)

```js
  PAIN_LIBRARY.lowBack = {
    label: 'Low Back',
    causes: [
      'Muscle strain from lifting under fatigue with poor bracing or a rounding spine',
      'SI joint sprain or dysfunction from asymmetric loading (uneven stance, one-sided carries)',
      'General deconditioning of the trunk relative to the loads going through squats and deadlifts'
    ],
    drills: [
      {
        name: 'Cat-cow',
        dose: '2 × 10 slow reps',
        detail: 'On hands and knees, alternate rounding and arching the spine through a full pain-free range. Restores segmental movement without load.'
      },
      {
        name: 'Bird-dog',
        dose: '3 × 8/side',
        detail: 'Opposite arm and leg extended, hold 2–3 sec, keep the low back still — no rotation or sag. Trains the anti-rotation control that’s missing when the back tweaks under load.'
      },
      {
        name: 'Glute bridge',
        dose: '3 × 12',
        detail: 'Feet flat, drive through heels, squeeze glutes at the top. Builds a hip-extension pattern that offloads the lumbar spine from doing all the extension work.'
      },
      {
        name: 'Dead bug',
        dose: '3 × 8/side',
        detail: 'On your back, lower the opposite arm and leg slowly while keeping the low back pressed flat against the floor. Trains bracing without spinal flexion — the pattern that protects the disc under load.'
      }
    ],
    avoid: [
      'Maxing out squats/deadlifts while fatigued or once bracing technique breaks down',
      'Loaded spinal flexion — rounding under a bar (good-mornings, deadlifts with a rounded back)',
      'Ignoring one-sided low-back pain that could be SI-joint related instead of muscular'
    ],
    whenToSeeSomeone: [
      'Same-day medical care, not a training modification: saddle numbness, new loss of bladder or bowel control, or progressive weakness in both legs — these are cauda equina red flags',
      'Pain radiating below the knee',
      'No improvement after 4–6 weeks'
    ],
    flareAction: 'Drop to bodyweight/banded core work only. No loaded spinal flexion. Keep walking daily — movement helps back pain more than rest. No deadlifts or heavy squats until pain-free.'
  };
```

- [ ] **Step 2: Run the selfcheck**

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `FAIL: PAIN_LIBRARY has an entry for wrist`

- [ ] **Step 3: Commit**

```bash
git add mobility-pain-library.js
git commit -m "feat(mobility): pain-library low back content (new area)"
```

---

## Task 7: Wrist entry (new area)

**Files:**
- Modify: `mobility-pain-library.js` (fill in `PAIN_LIBRARY.wrist`)

- [ ] **Step 1: Add the Wrist entry**

```js
  PAIN_LIBRARY.wrist = {
    label: 'Wrist',
    causes: [
      'The bar rolling toward the fingers during pressing instead of sitting in the heel of the palm — bends the wrist back under load and creates a big lever arm on the joint',
      'Wrist extensor/flexor tendinopathy from repetitive loaded extension (push-ups, heavy pressing, curls) without enough recovery',
      'TFCC irritation from repetitive pronation/supination under load'
    ],
    drills: [
      {
        name: 'Wrist flexor/extensor stretch',
        dose: '3 × 20–30 sec each direction',
        detail: 'Arm extended, opposite hand gently pulls the fingers back (extensor) then down (flexor). Do before pressing/pulling sessions.'
      },
      {
        name: 'Light wrist curls + reverse curls',
        dose: '3 × 15, light load',
        detail: 'Palm up (curls) and palm down (reverse curls), slow and controlled. Builds tendon capacity so daily loading stops being the max stress the tendon sees.'
      },
      {
        name: 'Neutral-grip press substitution',
        dose: 'As needed when flared',
        detail: 'Swap barbell bench/press for a neutral-grip dumbbell or landmine press — takes the forced wrist extension out of the movement entirely while it settles.'
      }
    ],
    avoid: [
      'Letting the bar roll toward the fingers on any pressing movement — reset your grip so it sits in the heel of the palm',
      'High-volume loaded wrist extension (heavy push-ups, handstand work) through pain',
      'Skipping a neutral-grip option once it’s already flared'
    ],
    whenToSeeSomeone: [
      'Sudden deformity or inability to grip',
      'Persistent numbness or tingling — nerve involvement, not just a tendon issue',
      'No improvement after 2 weeks of load modification'
    ],
    flareAction: 'Switch to neutral-grip pressing or use straps for pulling. Drop wrist-extension-heavy accessory work. Ice and reduce loaded wrist volume for the week.'
  };
```

- [ ] **Step 2: Run the selfcheck**

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `FAIL: PAIN_LIBRARY has an entry for ankle`

- [ ] **Step 3: Commit**

```bash
git add mobility-pain-library.js
git commit -m "feat(mobility): pain-library wrist content (new area)"
```

---

## Task 8: Ankle/Achilles entry (new area) + full selfcheck pass

**Files:**
- Modify: `mobility-pain-library.js` (fill in `PAIN_LIBRARY.ankle`)

- [ ] **Step 1: Add the Ankle entry**

```js
  PAIN_LIBRARY.ankle = {
    label: 'Ankle / Achilles',
    causes: [
      'Achilles tendinopathy from repetitive load or a rapid jump in training volume — calf-raise spikes, sprinting, jump work',
      'Tight calves limiting ankle dorsiflexion, which shifts extra load onto the tendon during squats and lunges',
      '"Too much too soon" is the single most common driver in the active population, not a one-off injury'
    ],
    drills: [
      {
        name: 'Standing calf stretch',
        dose: '3 × 30 sec/leg, knee straight then bent',
        detail: 'Hands on a wall, back leg straight then knee slightly bent — straight-knee hits the gastrocnemius, bent-knee hits the soleus underneath it.'
      },
      {
        name: 'Eccentric heel drops',
        dose: '3 × 15, slow 3–4 sec lower',
        detail: 'Rise onto the toes on both feet, shift weight to the affected side, lower slowly off the edge of a step.',
        note: 'The gold-standard load for remodeling a tendinopathic Achilles.'
      },
      {
        name: 'Ankle dorsiflexion mobilization (knee-to-wall)',
        dose: '3 × 10/side',
        detail: 'Foot a few inches from a wall, drive the knee toward the wall over the toes without the heel lifting. Restores the ankle range squats and lunges need.'
      }
    ],
    avoid: [
      'Sudden volume jumps in calf-raise or jump/plyo work',
      'Running or plyo work through morning stiffness or tendon pain',
      'Ignoring a "too much too soon" spike in training load — that’s the actual mechanism, not bad luck'
    ],
    whenToSeeSomeone: [
      'A sudden sharp pain with a pop or snap — possible rupture, needs same-day evaluation',
      'Inability to rise onto the toes on that leg',
      'Swelling that doesn’t settle'
    ],
    flareAction: 'Drop jump/plyo and calf-raise volume. Isometric calf holds only. Skip cold morning stretching through sharp pain — warm up gently first.'
  };
```

- [ ] **Step 2: Run the full selfcheck — all 7 areas now present**

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `mobility-pain-library.selfcheck.cjs: all assertions passed`

- [ ] **Step 3: Commit**

```bash
git add mobility-pain-library.js
git commit -m "feat(mobility): pain-library ankle content (new area) — all 7 areas complete"
```

---

## Task 9: Wire into `mobility.html`

**Files:**
- Modify: `mobility.html`

- [ ] **Step 1: Add the script tag**, right after `topbar.js` (`mobility.html:16`):

```html
<script src="mobility-pain-library.js" defer></script>
```

- [ ] **Step 2: Add a small CSS rule for the new accordion sub-labels**, in the `<style>` block near the existing `.mob-ex-note` rule (`mobility.html:152`):

```css
.mob-pain-label { font-size: 11px; font-weight: 700; color: var(--text-1); margin: 10px 0 4px; }
.mob-pain-label:first-child { margin-top: 0; }
.mob-pain-list { margin: 0 0 4px; padding-left: 16px; font-size: 12px; color: var(--text-2); line-height: 1.5; }
.mob-pain-list li { margin-bottom: 2px; }
```

- [ ] **Step 3: Replace the hand-authored Shoulder/Elbow/Knee blocks + Flare-Up Rules table with the render target div**

In `mobility.html`, replace the entire range from the divider before "Right Shoulder — Posterior Labrum Recovery" through the closing of the Flare-Up Rules card (`mobility.html:630-851`) with:

```html
    <div class="mob-divider"></div>
    <div class="mob-card">
      <div class="mob-card-body" style="font-size:12px">
        Do not go to zero. Total rest causes regression — connective tissue needs load signals to maintain integrity.
      </div>
      <div class="mob-card-note">Stop immediately if: catching, popping, or a feeling of joint shifting/giving way. That is instability — not soreness. Back off the movement for the full week.</div>
    </div>
    <div id="painLibraryWrap"></div>
```

(This keeps the general framing note and the instability stop-rule as a single shared intro — they apply to every area, not just one — instead of repeating them 7 times inside the per-area accordions.)

- [ ] **Step 4: Call the renderer**, inside the first inline `<script>` IIFE (`mobility.html:925` block), before the existing `swapPhotos(document);` call near its end (`mobility.html:1176` in the original file) so newly-injected photos get swapped in the same pass:

```js
  // ── Render the pain library into the Joint Care tab ──
  var painLibraryWrap = document.getElementById('painLibraryWrap');
  if (painLibraryWrap && window.MobilityPainLibrary) {
    painLibraryWrap.innerHTML = window.MobilityPainLibrary.renderAll();
  }
```

- [ ] **Step 5: Manual verification** — no test framework for this static-HTML page (matches the existing convention for `mobility.html`/`gym.html`/`posing.html`); load the page in a browser or the Browser pane preview tool:
  1. Open `mobility.html`, click the "Joint Care" tab.
  2. Confirm 7 area blocks render in order: Shoulder, Elbow, Knee, Hip, Low Back, Wrist, Ankle / Achilles.
  3. Expand each area's drill rows — confirm dose/detail text shows, and for Shoulder/Elbow/Knee confirm the SVG diagrams render (Hip/Low Back/Wrist/Ankle have no diagrams by design — panel should still open cleanly with just the detail/note).
  4. Expand each area's "Causes, avoid list & when to see someone" row — confirm all 4 sub-sections (Causes/Avoid/When to see someone/If it flares) render with real content, no `undefined` or empty bullets.
  5. Confirm the standalone Flare-Up Rules table is gone and the shared "Do not go to zero" / instability-stop-rule card is still present once, above the 7 areas.
  6. Confirm the "Pain Trend — Last 12 Weeks" chart above (unrelated, out of scope) still renders unchanged.
  7. Resize to 375px width — confirm no horizontal overflow or broken layout in any expanded area.

- [ ] **Step 6: Commit**

```bash
git add mobility.html
git commit -m "feat(mobility): wire pain-library into Joint Care tab, remove old hand-authored blocks + flare table"
```

---

## Task 10: Final full-file review

**Files:** none new — read-only verification pass.

- [ ] **Step 1: Confirm no dangling references to removed content** — grep for the old Flare-Up Rules classes to make sure nothing else on the page still depends on them:

Run: `grep -n "mob-flare-row\|mob-flare-joint\|mob-flare-action" mobility.html`
Expected: no matches (the CSS rules for these classes at `mobility.html:216-227` can stay as unused dead CSS — same low-risk tradeoff the codebase already accepts elsewhere — or be deleted in this step; deleting is preferred since nothing else uses them)

- [ ] **Step 2: If the grep above returns no HTML matches (CSS-only), delete the now-unused CSS rules** (`mobility.html:216-227`, the `.mob-flare-row`/`.mob-flare-joint`/`.mob-flare-action` block) since Step 3 of Task 9 removed their only usage.

- [ ] **Step 3: Re-run the full selfcheck one more time** to confirm nothing broke during the HTML edits:

Run: `node mobility-pain-library.selfcheck.cjs`
Expected: `mobility-pain-library.selfcheck.cjs: all assertions passed`

- [ ] **Step 4: Commit** (only if Step 2 made a change)

```bash
git add mobility.html
git commit -m "chore(mobility): remove unused flare-table CSS"
```
