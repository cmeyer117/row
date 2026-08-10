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
