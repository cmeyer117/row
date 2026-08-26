// Run with: node form-cues.selfcheck.cjs
// Verifies every gym.html exercise name (primary or sub) resolves to real
// content in form-cues.js -- either a primaries entry directly, or a
// variants entry whose `.primary` points at a real primaries key. Also
// checks for orphaned form-cues.js entries that don't correspond to any
// real gym.html exercise name.
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'form-cues.js'), 'utf8'), sandbox);
const FormCues = sandbox.window.FormCues;

function fail(msg) {
  console.error('FAIL: ' + msg);
  process.exit(1);
}

if (!FormCues || !FormCues.primaries || !FormCues.variants) fail('window.FormCues did not load with primaries/variants');

// Parse gym.html's defaultExercises block directly (text-based, not vm-run
// -- gym.html is a full DOM-dependent page, not a standalone module like
// form-cues.js/benchmarks.js).
const gymHtml = fs.readFileSync(path.join(__dirname, 'gym.html'), 'utf8');
const startMarker = 'defaultExercises: [';
const startIdx = gymHtml.indexOf(startMarker);
if (startIdx === -1) fail('could not find "defaultExercises: [" in gym.html -- has the source moved?');

// Find the matching closing bracket for the defaultExercises array by
// bracket-depth counting from the opening '[' (the block contains nested
// arrays/objects, so a naive first-']' search would truncate early).
let depth = 0, i = startIdx + startMarker.length - 1, endIdx = -1;
for (; i < gymHtml.length; i++) {
  if (gymHtml[i] === '[') depth++;
  else if (gymHtml[i] === ']') { depth--; if (depth === 0) { endIdx = i; break; } }
}
if (endIdx === -1) fail('could not find the closing bracket for defaultExercises -- malformed source?');
const block = gymHtml.slice(startIdx, endIdx + 1);

// Primary names: top-level `{ name: "...", ... day: "..."` entries (has a
// `day:` field, distinguishing a primary exercise object from a sub object
// which only has `name`/`stars`).
const primaryNames = [];
const primaryRe = /\{\s*name:\s*"([^"]+)"[^}]*?day:\s*"/gs;
let m;
while ((m = primaryRe.exec(block)) !== null) primaryNames.push(m[1]);
if (primaryNames.length < 20) fail('only found ' + primaryNames.length + ' primary exercises in gym.html -- parser likely broken (expected ~28)');

// Sub names: `{ name: "...", stars: N }` entries (has a `stars:` field).
const subNames = [];
const subRe = /\{\s*name:\s*"([^"]+)",\s*stars:\s*\d+\s*\}/g;
while ((m = subRe.exec(block)) !== null) subNames.push(m[1]);
if (subNames.length < 50) fail('only found ' + subNames.length + ' sub exercises in gym.html -- parser likely broken (expected ~76)');

// Every primary name must have a primaries entry.
const missingPrimaries = primaryNames.filter((n) => !FormCues.primaries[n]);
if (missingPrimaries.length) fail('gym.html primary exercises with no form-cues.js primaries entry: ' + JSON.stringify(missingPrimaries));

// Every sub name must resolve to SOMETHING: either it's itself a primary
// (cross-day reuse, e.g. "Cable Front Raise" is both a Push-day primary and
// an Upper-day sub), or it has a variants entry pointing at a real primary.
const unresolvedSubs = [];
const uniqueSubNames = Array.from(new Set(subNames));
uniqueSubNames.forEach((n) => {
  if (FormCues.primaries[n]) return; // cross-day primary reuse, fine
  const v = FormCues.variants[n];
  if (!v) { unresolvedSubs.push(n + ' (no variants entry)'); return; }
  if (!FormCues.primaries[v.primary]) unresolvedSubs.push(n + ' (variants.primary "' + v.primary + '" is not a real primaries key)');
});
if (unresolvedSubs.length) fail('gym.html sub exercises that do not resolve to real form-cues.js content:\n  ' + unresolvedSubs.join('\n  '));

// Orphan check: every primaries/variants key should correspond to a real
// gym.html name (catches typos in form-cues.js itself, e.g. a key that
// doesn't exactly match gym.html's spelling).
const allRealNames = new Set(primaryNames.concat(subNames));
const orphanPrimaries = Object.keys(FormCues.primaries).filter((n) => !allRealNames.has(n));
if (orphanPrimaries.length) fail('form-cues.js primaries keys with no matching gym.html exercise: ' + JSON.stringify(orphanPrimaries));
const orphanVariants = Object.keys(FormCues.variants).filter((n) => !allRealNames.has(n));
if (orphanVariants.length) fail('form-cues.js variants keys with no matching gym.html exercise: ' + JSON.stringify(orphanVariants));

console.log('OK: form-cues.selfcheck.cjs (' + primaryNames.length + ' primaries, ' + uniqueSubNames.length + ' unique subs, all resolved)');
