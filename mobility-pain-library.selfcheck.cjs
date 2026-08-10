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
