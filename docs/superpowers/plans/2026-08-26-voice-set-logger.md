# Row Live Set Logger / Rest-Timer Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Carl speak a completed set ("incline press, 245 for 8") on the gym floor and have it parsed, logged, timed, and cued for the next set, hands-free.

**Architecture:** A new pure-logic file (`gym-voice-log.js`) does deterministic parsing (fuzzy exercise match + weight/reps/RIR extraction from a transcript) with zero DOM/network dependencies, fully unit-testable. `gym.html` gets a mic button that reuses the existing `RowVoice.startCapture()` (same shared function the Vision chat bubble already uses, including its local-Whisper-first/OpenAI-fallback behavior) to get a transcript, feeds it to the parser, and on success calls a newly-extracted `saveSet()` function — the exact same save path the manual Log button already uses (PR classification, milestones, rest timer, receipt, Undo). A parse failure shows the raw transcript with Retry/Edit, never silently logs a guess.

**Tech Stack:** Vanilla JS (no framework, matches the rest of `row/`), classic `<script>` tags, Node's built-in `assert`-free case-array test convention (`node scripts/run-tests.mjs` auto-discovers `*.test.js`).

---

## File structure

- **Create:** `gym-voice-log.js` — pure parsing logic. `window.GymVoiceLog.parseSetUtterance(transcript, todaysExercises, allExercises)`. No DOM, no network — same IIFE + `window.X`/`module.exports` convention as `gym-weight-outlier-logic.js`.
- **Create:** `gym-voice-log.test.js` — Node-runnable case-array tests, mirrors `gym-weight-outlier-logic.test.js`'s exact style.
- **Modify:** `gym.html` — extract `saveSet()` from the Log button's click handler (~line 6428-6493), add a mic button + Retry/Edit card to the Log tab's markup, wire the mic button to `RowVoice.startCapture()` → `GymVoiceLog.parseSetUtterance()` → `saveSet()`.

---

### Task 1: `parseSetUtterance()` — number and RIR extraction

**Files:**
- Create: `gym-voice-log.js`
- Test: `gym-voice-log.test.js`

- [ ] **Step 1: Write the failing tests for number/RIR extraction**

Create `gym-voice-log.test.js`:

```js
// Loaded as a classic <script> tag in the browser — see
// gym-weight-outlier-logic.test.js for why this sandboxes instead of import/require.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./gym-voice-log.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { parseSetUtterance } = sandbox.window.GymVoiceLog;

const EXERCISES = [
  { id: 'ex_incline', name: 'Smith Machine Flat Chest Press', day: 'push', bw: false },
  { id: 'ex_dip', name: 'Chest Dip', day: 'push', bw: false },
  { id: 'ex_lateral', name: 'Dumbbell Lateral Raise', day: 'push', bw: false },
  { id: 'ex_pullup', name: 'Pull Up', day: 'pull', bw: true },
];
const TODAYS = EXERCISES.filter((e) => e.day === 'push');

const cases = [];

{
  const r = parseSetUtterance('chest dip 245 for 8', TODAYS, EXERCISES);
  cases.push(['weight-then-reps order ("N for M")', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip 8 reps at 245', TODAYS, EXERCISES);
  cases.push(['reps-word cues reps explicitly', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip 8 at 245 pounds', TODAYS, EXERCISES);
  cases.push(['pounds-word cues weight explicitly', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip 245 for 8, two RIR', TODAYS, EXERCISES);
  cases.push(['trailing RIR phrase stripped, does not corrupt reps', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip 245 for 8, two reps in reserve', TODAYS, EXERCISES);
  cases.push(['"reps in reserve" phrasing also stripped', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip two forty five for eight', TODAYS, EXERCISES);
  cases.push(['spoken small number-word for reps still parses ("eight")', r.exId === 'ex_dip' && r.reps === 8]);
}
{
  const r = parseSetUtterance('pull up eight', TODAYS, EXERCISES);
  cases.push(['bodyweight exercise needs only one number, treated as reps', r.exId === 'ex_pullup' && r.weight === 0 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip', TODAYS, EXERCISES);
  cases.push(['exercise matched but no numbers at all -> no-numbers error', r.error === 'no-numbers' && r.transcript === 'chest dip']);
}
{
  const r = parseSetUtterance('chest dip 245', TODAYS, EXERCISES);
  cases.push(['exercise matched but only one number for a non-bw exercise -> no-numbers error', r.error === 'no-numbers']);
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`gym-voice-log: all ${cases.length} cases pass`);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node gym-voice-log.test.js`
Expected: `Cannot read properties of undefined (reading 'parseSetUtterance')` (file doesn't exist yet)

- [ ] **Step 3: Write `gym-voice-log.js`**

```js
// gym-voice-log.js — parses a spoken set transcript ("incline press, 245 for
// 8") into a structured { exId, weight, reps }, or an { error } if either
// the exercise or the numbers can't be resolved. Pure logic, no DOM/network,
// so a mishear never auto-logs a guess -- the caller (gym.html) decides what
// to do with an error. See docs/superpowers/specs/2026-08-26-voice-set-logger-design.md.
(function () {
  'use strict';

  var NUMBER_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20
  };
  var REP_WORDS = { rep: true, reps: true };
  var WEIGHT_WORDS = { pound: true, pounds: true, lb: true, lbs: true };
  var STOPWORDS = { the: true, a: true, an: true, and: true };
  var MATCH_THRESHOLD = 0.5; // at least half an exercise's significant words must appear in the transcript

  function tokenize(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9.\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  function significantWords(name) {
    return tokenize(name).filter(function (w) { return !STOPWORDS[w]; });
  }

  // Picks the exercise whose name shares the highest fraction of its
  // significant words with the transcript -- e.g. "flat chest press" matches
  // "Smith Machine Flat Chest Press" (3/5 words) above threshold.
  function matchExercise(tokens, exercises) {
    var transcriptSet = {};
    tokens.forEach(function (w) { transcriptSet[w] = true; });
    var best = null, bestScore = 0;
    (exercises || []).forEach(function (ex) {
      var words = significantWords(ex.name);
      if (!words.length) return;
      var matched = words.filter(function (w) { return transcriptSet[w]; }).length;
      var score = matched / words.length;
      if (score > bestScore) { bestScore = score; best = ex; }
    });
    return bestScore >= MATCH_THRESHOLD ? best : null;
  }

  function extractNumbers(tokens) {
    var out = [];
    tokens.forEach(function (t, i) {
      var val = null;
      if (/^\d+(\.\d+)?$/.test(t)) val = parseFloat(t);
      else if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, t)) val = NUMBER_WORDS[t];
      if (val !== null) out.push({ value: val, index: i });
    });
    return out;
  }

  // Finds "N RIR" / "N reps in reserve" and drops that number from the list
  // before weight/reps role assignment, so it's never mistaken for a rep count.
  function findRirMarkerIndex(tokens) {
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'rir') return i;
      if (tokens[i] === 'reserve' && tokens[i - 1] === 'in' && REP_WORDS[tokens[i - 2]]) return i - 2;
    }
    return -1;
  }

  function stripRirNumber(numbers, tokens) {
    var markerIdx = findRirMarkerIndex(tokens);
    if (markerIdx === -1) return numbers;
    var rirEntry = null;
    for (var i = numbers.length - 1; i >= 0; i--) {
      if (numbers[i].index < markerIdx) { rirEntry = numbers[i]; break; }
    }
    return rirEntry ? numbers.filter(function (n) { return n !== rirEntry; }) : numbers;
  }

  // A number immediately followed by "rep(s)" is reps; immediately followed
  // by "pound(s)/lb(s)" is weight. Any number left unlabeled fills weight
  // first, then reps, in the order it was spoken -- covers the plain
  // "245 for 8" phrasing where neither number carries a cue word.
  function assignRoles(numbers, tokens) {
    var consumed = {};
    var reps = null, weight = null;
    numbers.forEach(function (n) {
      if (reps !== null) return;
      if (REP_WORDS[tokens[n.index + 1]]) { reps = n.value; consumed[n.index] = true; }
    });
    numbers.forEach(function (n) {
      if (weight !== null || consumed[n.index]) return;
      if (WEIGHT_WORDS[tokens[n.index + 1]]) { weight = n.value; consumed[n.index] = true; }
    });
    var unlabeled = numbers.filter(function (n) { return !consumed[n.index]; });
    if (weight === null && unlabeled.length) weight = unlabeled.shift().value;
    if (reps === null && unlabeled.length) reps = unlabeled.shift().value;
    return { weight: weight, reps: reps };
  }

  function parseSetUtterance(transcript, todaysExercises, allExercises) {
    var tokens = tokenize(transcript);
    var ex = matchExercise(tokens, todaysExercises) || matchExercise(tokens, allExercises);
    if (!ex) return { error: 'no-match', transcript: transcript || '' };

    var numbers = stripRirNumber(extractNumbers(tokens), tokens);

    if (ex.bw) {
      var roles = assignRoles(numbers, tokens);
      var repsOnly = roles.reps !== null ? roles.reps : roles.weight;
      if (repsOnly === null) return { error: 'no-numbers', transcript: transcript || '' };
      return { exId: ex.id, weight: 0, reps: Math.round(repsOnly) };
    }

    var result = assignRoles(numbers, tokens);
    if (result.weight === null || result.reps === null) return { error: 'no-numbers', transcript: transcript || '' };
    return { exId: ex.id, weight: result.weight, reps: Math.round(result.reps) };
  }

  var api = { parseSetUtterance: parseSetUtterance };
  if (typeof window !== 'undefined') window.GymVoiceLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node gym-voice-log.test.js`
Expected: `gym-voice-log: all 9 cases pass`

- [ ] **Step 5: Commit**

```bash
git add gym-voice-log.js gym-voice-log.test.js
git commit -m "feat: add voice-set-utterance parser (weight/reps/RIR extraction)"
```

---

### Task 2: `parseSetUtterance()` — exercise matching edge cases

**Files:**
- Modify: `gym-voice-log.test.js`

- [ ] **Step 1: Add failing tests for exercise-matching behavior**

Append to the `cases` array in `gym-voice-log.test.js` (before the `let failed = 0;` line):

```js
{
  const r = parseSetUtterance('lateral raise 35 for 12', TODAYS, EXERCISES);
  cases.push(['partial-name match above threshold ("lateral raise" -> Dumbbell Lateral Raise)', r.exId === 'ex_lateral']);
}
{
  const r = parseSetUtterance('bench press 200 for 5', TODAYS, EXERCISES);
  cases.push(['no exercise clears the match threshold -> no-match error', r.error === 'no-match' && r.transcript === 'bench press 200 for 5']);
}
{
  const r = parseSetUtterance('pull up 8 reps', [], EXERCISES);
  cases.push(['todaysExercises empty falls through to the full list', r.exId === 'ex_pullup']);
}
{
  const r = parseSetUtterance('', TODAYS, EXERCISES);
  cases.push(['empty transcript -> no-match, never throws', r.error === 'no-match']);
}
```

(Note: this duplicates the `chest dip 245 for 8` case's push syntax — each block above must be its own top-level `{ ... }` statement in the file, same as the existing blocks, not nested inside the previous one.)

- [ ] **Step 2: Run to verify the new cases fail or pass as expected**

Run: `node gym-voice-log.test.js`
Expected: all cases pass already, since Task 1's `matchExercise`/threshold logic already handles these — this step exists to lock in the behavior with explicit regression coverage, not to drive new implementation. If `bench press 200 for 5` case fails (matches something it shouldn't), lower `MATCH_THRESHOLD`'s tolerance is wrong — re-check the threshold against real exercise names, don't just weaken the test.

- [ ] **Step 3: Commit**

```bash
git add gym-voice-log.test.js
git commit -m "test: cover voice parser exercise-matching edge cases"
```

---

### Task 3: Extract `saveSet()` from the Log button handler

**Files:**
- Modify: `gym.html:6428-6493`

This is a behavior-preserving refactor: the manual Log button's inline handler currently reads `reps`/`weight`/`entry` from DOM inputs, then runs the save logic. Pulling the save logic into a standalone `saveSet(ex, w, reps, entry)` function lets both the manual button and the new voice path call the identical save path. No DOM test framework exists in this repo (no jsdom in `package.json`), so this task is verified live in the browser (Task 3 Step 3), not via an automated test — consistent with the fact that no test file exists today for this handler either.

- [ ] **Step 1: Read the current handler**

Already captured above (`gym.html:6428-6493`). The full body from `const dateKey = getChipDate(...)` through the closing `setTimeout(...)` pulse-animation line is what moves into `saveSet`.

- [ ] **Step 2: Replace the handler with the extracted function + a thin caller**

Replace `gym.html:6428-6493` (the entire `$('logBtn').addEventListener('click', () => { ... });` block) with:

```js
  // Extracted so both the manual Log button and voice-set-logger (Task 4)
  // save through the exact same path -- PR classification, milestones,
  // rest timer, receipt, and Undo all need to fire identically regardless
  // of how weight/reps were captured.
  function saveSet(ex, w, reps, entry) {
    entry = entry || {};
    const dateKey = getChipDate('logDateInput');
    const isoDate = new Date(dateKey + 'T12:00:00').toISOString();
    const arr = state.logs[ex.id] || [];
    const priorLogs = arr.slice();
    // Only compare like-for-like weight bases -- a plates-per-side count vs a
    // total-lb figure would false-positive/false-negative against each other.
    // Legacy entries predate the weightBasis field, so resolve it the same
    // way gym-workout-events.js does rather than trusting a literal match.
    const lastPrior = priorLogs[priorLogs.length - 1];
    const lastPriorBasis = lastPrior && window.GymWorkoutEvents ? window.GymWorkoutEvents.weightBasis(lastPrior) : null;
    const comparableBasis = entry.weightBasis === 'totalLbs' && (!lastPrior || lastPriorBasis !== 'platesPerSide');
    const outlier = (comparableBasis && window.GymWeightOutlierLogic)
      ? window.GymWeightOutlierLogic.checkWeightOutlier(priorLogs, w)
      : null;
    const activeVariant = getSession(ex.id).activeVariant || null;
    const eventType = window.GymWorkoutEvents
      ? window.GymWorkoutEvents.classifyWorkoutEvent({ weight: w, reps: reps, weightBasis: entry.weightBasis }, priorLogs, ex)
      : null;
    // isPR/prDateKey let the undo handler reverse the milestone this exact
    // set caused, without misattributing a same-day non-PR set logged
    // afterward -- Codex review 2026-08-21.
    arr.push(Object.assign({ weight: w, reps: reps, date: isoDate, variant: activeVariant, isPR: eventType === 'pr', prDateKey: dateKey }, entry));
    arr.sort((a, b) => a.date.localeCompare(b.date));
    state.logs[ex.id] = arr;
    if (eventType && window.__gym && typeof window.__gym.logWorkoutEvent === 'function') {
      window.__gym.logWorkoutEvent(ex.name, eventType, w, reps, !!ex.bw);
    }
    if (window.GymMilestoneLogic) {
      state.milestones = window.GymMilestoneLogic.recordMilestone(state.milestones, { eventType: eventType, exercise: ex.name, dateKey: dateKey });
    }
    if (plateMode) { plateCounts = {}; updatePlateUI(); }
    if (weightInputDirtyForEx === ex.id) weightInputDirtyForEx = null;
    resetChipToToday('logDateChip', 'logDateInput');
    startRestTimer(ex, eventType, dateKey);
    if (window.__gym && typeof window.__gym.pcArmReceipt === 'function') window.__gym.pcArmReceipt();
    saveState(); renderAll();
    // Strength changed → composition estimate may shift
    if (typeof wtRender === 'function') wtRender();
    // Show undo button after logging
    $('undoBtn').style.display = 'block';
    if (outlier) alert('Logged, but ' + w + unit() + ' is ' + outlier.multiplier + '× your last (' + outlier.priorWeight + unit() + '). Typo? Edit it in History if so.');
    // Tiny pulse on the button so the user feels the save
    const btn = $('logBtn');
    btn.style.transition = 'transform 0.15s';
    btn.style.transform = 'scale(0.96)';
    setTimeout(() => { btn.style.transform = ''; }, 160);
  }

  $('logBtn').addEventListener('click', () => {
    const ex = getCurrentEx();
    if (!ex) return;
    const reps = parseInt($('repsRow').dataset.value, 10) || 0;
    if (reps <= 0) { alert('Pick a rep count.'); return; }
    let w = 0, entry = {};
    if (ex.bw) {
      w = 0;
    } else if (plateMode) {
      w = getPlateWeight();
      if (w <= 0) { alert('Add at least one plate.'); return; }
      const cfg = getPlateConfig();
      entry.plates = null; // not the old single-plate format
      entry.plateConfig = cfg;
      // The plate picker collects plates PER SIDE (see platePickerSummary's "lb/side"),
      // so `weight` here is per-side plate load — no bar, no ×2 — while lb-mode `weight`
      // is total load. Stamp the basis so consumers never silently compare the two.
      // `weight` deliberately stays raw as entered. The exercise's `loadType`
      // resolves it to real load at read time via GymWorkoutEvents.totalLoad(),
      // so a wrong loadType mis-displays but can never corrupt a logged set.
      entry.weightBasis = 'platesPerSide';
    } else {
      w = parseFloat($('weightInput').value) || 0;
      if (w <= 0) { alert('Enter a weight.'); return; }
      entry.weightBasis = 'totalLbs';
    }
    saveSet(ex, w, reps, entry);
  });
```

- [ ] **Step 3: Verify live in the browser (manual logging still works identically)**

Start the local dev server (`npx serve -l 5555 .` from `row/`, or via the existing `.claude/launch.json` "row" config) and confirm, for at least one non-bodyweight exercise:
- Logging a set via the manual weight/reps inputs still shows the receipt, starts the rest timer, and shows the Undo button.
- The 2×-outlier alert still fires when logging a weight 3x+ off the prior set.
- Undo still removes the set and correctly reverses a PR milestone if the undone set was a PR.

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "refactor: extract saveSet() from the Log button handler"
```

---

### Task 3.5: Reject ambiguous exercise matches (Codex catch, 2026-08-26)

A luna-effort Codex review of this plan (before Task 4 was written) flagged that `matchExercise()`'s fixed 0.5 threshold picks a winner even when two candidates tie or nearly tie — e.g. "press" alone scores 0.5 against any two-word "___ Press" exercise, so a real program with multiple press variants on the same day could silently pick the wrong one. That violates the spec's own "never auto-logs a guess" principle just as much as a missed match would. Fix: require the best score to beat the second-best by a real margin; a tie or near-tie is `no-match`, not a coin flip.

**Files:**
- Modify: `gym-voice-log.js`
- Modify: `gym-voice-log.test.js`

- [ ] **Step 1: Write the failing test**

Append to `gym-voice-log.test.js` (before `let failed = 0;`):

```js
{
  // Both names are 2 significant words sharing only "press" -- each scores
  // exactly 0.5 (the bare MATCH_THRESHOLD), so the old code's strict ">"
  // comparison silently kept whichever candidate came first in the array.
  const AMBIGUOUS = [
    { id: 'ex_chest_press', name: 'Chest Press', day: 'push', bw: false },
    { id: 'ex_shoulder_press', name: 'Shoulder Press', day: 'push', bw: false },
  ];
  const r = parseSetUtterance('press 135 for 8', AMBIGUOUS, AMBIGUOUS);
  cases.push(['a word shared by two same-scoring candidates is ambiguous, not a silent pick', r.error === 'no-match']);
}
{
  const r = parseSetUtterance('chest dip 245 for 8', TODAYS, EXERCISES);
  cases.push(['a clear single-candidate match still wins (regression guard)', r.exId === 'ex_dip']);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node gym-voice-log.test.js`
Expected: `FAIL: a word shared by two same-scoring candidates is ambiguous, not a silent pick` (current code picks whichever candidate it iterated to first)

- [ ] **Step 3: Add a margin requirement to `matchExercise()`**

In `gym-voice-log.js`, replace the `matchExercise` function:

```js
  var MATCH_MARGIN = 0.15; // best score must beat the runner-up by this much, or it's ambiguous

  function matchExercise(tokens, exercises) {
    var transcriptSet = {};
    tokens.forEach(function (w) { transcriptSet[w] = true; });
    var best = null, bestScore = 0, secondScore = 0;
    (exercises || []).forEach(function (ex) {
      var words = significantWords(ex.name);
      if (!words.length) return;
      var matched = words.filter(function (w) { return transcriptSet[w]; }).length;
      var score = matched / words.length;
      if (score > bestScore) { secondScore = bestScore; bestScore = score; best = ex; }
      else if (score > secondScore) { secondScore = score; }
    });
    if (bestScore < MATCH_THRESHOLD) return null;
    if (bestScore - secondScore < MATCH_MARGIN) return null; // too close to call -- ambiguous, not a guess
    return best;
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `node gym-voice-log.test.js`
Expected: `gym-voice-log: all 15 cases pass`

- [ ] **Step 5: Commit**

```bash
git add gym-voice-log.js gym-voice-log.test.js
git commit -m "fix: reject ambiguous exercise matches instead of picking silently"
```

---

### Task 4: Mic button, wiring, and Retry/Edit card

**Files:**
- Modify: `gym.html` (markup near `logBtn`/`undoBtn`, ~line 2957; script includes ~line 7318; script wiring near the `logBtn` handler from Task 3)

- [ ] **Step 1: Load `gym-voice-log.js`**

In `gym.html`, next to the other `gym-*-logic.js` includes (`gym.html:7318`), add:

```html
<script src="gym-voice-log.js"></script>
```

- [ ] **Step 2: Add the mic button and error card markup**

In `gym.html`, immediately after `<button class="po-btn-primary" id="logBtn">Log set</button>` (~line 2957) and before the `logReceipt` div, add:

```html
      <button class="po-btn-primary" id="logBtn">Log set</button>
      <button class="po-mic-log-btn" id="voiceLogBtn" type="button" style="width:100%;margin-top:8px;padding:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#F4F1EA;font-size:13px;">🎤 Speak set</button>
      <div class="po-voice-error" id="voiceLogError" style="display:none;margin-top:8px;padding:10px;background:rgba(255,255,255,0.04);border-radius:10px;font-size:12px;">
        <div id="voiceLogErrorText" style="color:#B8B6B0;margin-bottom:6px;"></div>
        <div style="display:flex;gap:8px;">
          <button type="button" id="voiceLogRetry" style="flex:1;padding:8px;background:rgba(255,255,255,0.08);border:none;border-radius:8px;color:#F4F1EA;">Retry</button>
          <button type="button" id="voiceLogEdit" style="flex:1;padding:8px;background:rgba(255,255,255,0.08);border:none;border-radius:8px;color:#F4F1EA;">Edit manually</button>
        </div>
      </div>
      <div class="po-log-receipt" id="logReceipt" style="display:none;font-size:12px;text-align:center;margin-top:6px;opacity:0.75"></div>
      <button class="po-undo-btn" id="undoBtn" type="button" style="display:none">↩ Undo last set</button>
```

- [ ] **Step 3: Add the CSS `.listening` state**

Near the existing `.po-mic-log-btn` styling area (or anywhere in the `<style>` block, matching the file's convention of scattered feature-specific rules), add:

```css
.po-mic-log-btn.listening { background: #ff4444 !important; color: #fff !important; }
```

- [ ] **Step 4: Wire the mic button**

Immediately after the `saveSet`/`logBtn` block from Task 3, add:

```js
  (function () {
    var voiceBtn = $('voiceLogBtn');
    var errorCard = $('voiceLogError');
    var errorText = $('voiceLogErrorText');
    var voiceController = null;

    function hideError() { errorCard.style.display = 'none'; }

    function showError(transcript) {
      errorText.textContent = transcript
        ? 'Didn\'t catch that clearly: "' + transcript + '"'
        : 'Didn\'t catch that — try again.';
      errorCard.style.display = 'block';
    }

    function startListening() {
      hideError();
      voiceBtn.classList.add('listening');
      var sttPrompt = (window.__gym && window.__gym.getSttPrompt) ? window.__gym.getSttPrompt() : '';
      voiceController = window.RowVoice.startCapture(function (transcript) {
        voiceController = null;
        voiceBtn.classList.remove('listening');
        handleTranscript(transcript);
      }, function () {
        voiceController = null;
        voiceBtn.classList.remove('listening');
        showError('');
      }, { sttPrompt: sttPrompt });
    }

    function handleTranscript(transcript) {
      var ex = getCurrentEx();
      if (!ex) { showError(transcript); return; }
      var todaysExercises = getFiltered();
      var allExercises = (state.exercises || []).concat(getAdhocExercises());
      var parsed = window.GymVoiceLog.parseSetUtterance(transcript, todaysExercises, allExercises);
      if (parsed.error) { showError(parsed.transcript); return; }
      // Same guards the manual path applies before calling saveSet() (Task
      // 3's click handler) -- the parser can't fully rule out a degenerate
      // parse (e.g. "0" as the only number), so voice logging must reject
      // it the same way a manual "0" entry already does, not silently log it.
      if (!(parsed.reps > 0)) { showError(parsed.transcript); return; }
      var targetEx = allExercises.find(function (e) { return e.id === parsed.exId; }) || ex;
      if (!targetEx.bw && !(parsed.weight > 0)) { showError(parsed.transcript); return; }
      // Codex catch (2026-08-26): if the spoken exercise differs from the
      // one currently displayed, saveSet() still needs Undo, the plate
      // picker, and the receipt to reflect the exercise actually logged --
      // all of which read state.currentEx, not whatever ex was passed in.
      // Switching it here mirrors the existing click-to-select-exercise
      // pattern elsewhere in this file (state.currentEx = ex.id).
      if (targetEx.id !== ex.id) state.currentEx = targetEx.id;
      var entry = { weightBasis: 'totalLbs' };
      saveSet(targetEx, parsed.weight, parsed.reps, entry);
    }

    voiceBtn.addEventListener('click', function () {
      if (voiceController) { voiceController.stop(); return; }
      startListening();
    });
    $('voiceLogRetry').addEventListener('click', function () {
      hideError();
      startListening();
    });
    $('voiceLogEdit').addEventListener('click', function () {
      hideError();
      // parseSetUtterance's error path only carries the raw transcript, not
      // any partially-parsed numbers -- this just moves focus to the manual
      // input so Carl can type the set directly instead of retrying voice.
      $('weightInput').focus();
    });
  })();
```

Note: `targetEx` is looked up because `parsed.exId` may belong to an ad-hoc exercise not present in `getFiltered()`'s result if `getCurrentEx()`'s active exercise differs from the one actually spoken — using the parsed exercise's own object (not the currently-active one) is correct, since the whole point of voice logging is to log against whichever exercise was named, not whatever the UI happened to be showing.

- [ ] **Step 5: Verify live in the browser**

With the local dev server running:
- Tap "🎤 Speak set" — confirm the button turns red ("listening").
- Speak a clean utterance for an on-split exercise (e.g. "chest dip 245 for 8" — say the weight as digits, not spoken-out compound words like "two forty five"; the parser only handles digit weights plus small spoken-word rep counts, see `gym-voice-log.js`) — confirm it logs via the same receipt/rest-timer/Undo path verified in Task 3.
- Speak a set for a **different** exercise than the one currently displayed — confirm the screen switches to show that exercise (via the `state.currentEx` update) and Undo correctly targets the just-logged set, not whatever was on screen before.
- Tap the mic, speak something unparseable (e.g. just noise or an unlisted exercise) — confirm the Retry/Edit card appears with the raw transcript, and no set is logged.
- Tap Retry — confirm it re-arms the mic. Tap Edit manually — confirm focus moves to the weight input.
- Tap the mic button a second time mid-recording — confirm it stops the capture (matches the existing chat-bubble tap-to-stop behavior in `mini-vision-chat.js`).

- [ ] **Step 6: Commit**

```bash
git add gym.html
git commit -m "feat: hands-free voice set logging on the gym Log tab"
```

---

## Post-implementation fixes (luna Codex review of the final diff, 2026-08-26)

A second luna-effort Codex pass, run over the completed diff before pushing (not just the plan, which the first pass already reviewed), caught 3 more issues in `gym-voice-log.js`, all fixed and covered by new test cases in the same file:

1. **A number embedded in the exercise's own name competed with the spoken weight/reps.** Confirmed against real data — "45° Sled Leg Press" (`gym.html:176`, a real sub-variant in Carl's program) — saying "45 sled leg press 225 for 8" parsed as weight 45 / reps 225 instead of 225/8. Fixed with `stripExerciseNameNumbers()`, which drops any number from the candidate list whose value matches a number tokenized from the matched exercise's own name.
2. **Today's-split and full-catalog matching were two separate, isolated searches**, so a single weak today's-split candidate could clear the ambiguity-margin check by default (no runner-up existed in its own smaller list) even when a much better full-catalog match existed and never got the chance to compete. Fixed by merging both lists into one deduped pool for a single `matchExercise()` pass, with same-day membership only breaking an exact score tie — a real cross-list ambiguity is now correctly rejected instead of silently resolved toward the same-day exercise.
3. **A malformed/null entry in the exercise list crashed the whole parse** at `ex.name` instead of being skipped. Fixed by guarding the pool-building step.

All 18 cases in `gym-voice-log.test.js` pass; the full repo suite (55/55) passes.

---

## Follow-on work (not this plan)

- **Per-set RIR storage** and **gym-noise reliability tuning** — see the spec's own Follow-on Work section. Both are explicitly Carl's next step once this ships, using real gym-floor use (and the Retry/Edit card's failure signal) to know what's actually worth tuning.
