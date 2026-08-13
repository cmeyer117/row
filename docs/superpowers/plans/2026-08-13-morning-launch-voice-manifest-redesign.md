# Morning Launch Voice-First Manifestation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Morning Launch from 4 clinical form phases into 5 voice-first phases (Settle/Align/Rehearse/Commit/Speak It), reusing the `RowVoice` speak/capture API that's already wired into this exact feature today (`mlSpeakPhasePrompt`, `attachMic`) — auto-opening the mic after each spoken prompt instead of requiring a manual tap, with a felt-sense rehearsal step folded into the old Visualize phase.

**Architecture:** Extend `morning-launch-logic.js`'s pure functions (phase order, migration, new field validation) and `main.html`'s render functions (`mlBuild*`). One new shared helper, `mlVoiceSequence`, drives sequential voice-first prompts for single/multi-field phases (Settle, Align, Rehearse, Speak It); Commit keeps its existing structured mover-editor form, gaining mic buttons on its free-text sub-fields only (it currently has none) rather than a full sequential rewrite — dictating a `<select>` or a number field by voice doesn't work, so that form's mechanics stay as-is per the spec's own "unchanged mechanics" call, refined here against the real (more complex than assumed during design) code.

**Tech Stack:** Vanilla JS, `row/main.html` + `row/morning-launch-logic.js`, existing `row/voice-helpers.js` (`RowVoice.speak`/`startCapture`/`attachMic`, no changes needed there), Node `vm`-sandboxed `.selfcheck.cjs` tests (no framework).

**Spec:** `docs/superpowers/specs/2026-08-13-morning-launch-voice-manifest-redesign-design.md`

**Two real refinements made during planning, not present in the spec:**

1. The spec said Commit gets "voice-first entry" like the other phases. Reading the actual `mlBuildMoverEditor` (main.html:1995-2064) shows each of the 3 movers is a structured form — mode radio (existing/new), a `<select>` of today's tasks OR a new-text `<input>`, a linked-outcome `<select>`, a definition-of-done `<input>`, a first-action `<input>`, an estimated-minutes `<input type="number">`. Only 3 of those 6 fields per mover are free text a mic could sensibly fill (new-task text, definition of done, first action) — the rest are selection/numeric UI voice can't usefully drive. Scoped accordingly below.

2. The spec's error-handling section calls for a "~4s silence → gentle 'still there?' retry." `voice-helpers.js` has no infrastructure for this — its own comments (around `startCapture`) document that AudioContext-based silence detection was deliberately removed (2026-08-11) because running an analyser on the same stream as an active `MediaRecorder` produced zero-byte recordings on iOS Safari. Building custom silence detection to satisfy the spec's wording would reintroduce exactly the flaky pattern this codebase already ruled out. Dropped from this plan — the real, already-proven mechanism is `MAX_RECORD_MS`'s hard stop plus the manual tap-to-stop on the mic button (both already present via `startCapture`/`mlVoiceSequence`'s own controller), not a new timer.

---

## Task 1: Phase-order migration and new fields in `morning-launch-logic.js`

**Files:**
- Modify: `morning-launch-logic.js:9` (`PHASE_ORDER`), `:15-35` (`newSession`)
- Test: `morning-launch-logic.selfcheck.cjs`

- [ ] **Step 1: Write the failing tests**

Add to `morning-launch-logic.selfcheck.cjs` (after the existing phase-progression tests, before the mover tests):

```javascript
// --- phase-name migration ---
assertEqual(L.migratePhaseNames('clear'), 'settle', 'clear migrates to settle');
assertEqual(L.migratePhaseNames('visualize'), 'rehearse', 'visualize migrates to rehearse');
assertEqual(L.migratePhaseNames('align'), 'align', 'align passes through unchanged');
assertEqual(L.migratePhaseNames('commit'), 'commit', 'commit passes through unchanged');
assertEqual(L.migratePhaseNames('complete'), 'complete', 'complete passes through unchanged');
assertEqual(L.migratePhaseNames('settle'), 'settle', 'already-new settle passes through unchanged (idempotent)');
assertEqual(L.migratePhaseNames('rehearse'), 'rehearse', 'already-new rehearse passes through unchanged (idempotent)');

// --- new session shape ---
const freshSession = L.newSession('2026-08-13');
assertEqual(freshSession.currentPhase, 'settle', 'new session starts in settle, not clear');
assertEqual(freshSession.feltRehearsal, '', 'new session has empty feltRehearsal');
assertEqual(freshSession.spokenCommitment, '', 'new session has empty spokenCommitment');
assertEqual(freshSession.spokenAt, null, 'new session has null spokenAt');

// --- new PHASE_ORDER ---
assertEqual(L.advancePhase(L.newSession('2026-08-13'), 'align').ok, false, 'cannot skip settle to align with empty brainDump');
let settleSession = L.newSession('2026-08-13');
settleSession.brainDump = 'thinking about the day';
assertEqual(L.advancePhase(settleSession, 'align').ok, true, 'settle to align works once brainDump is non-empty');
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd C:\Users\gregm\row
node morning-launch-logic.selfcheck.cjs
```

Expected: FAIL — `migratePhaseNames` doesn't exist yet, `newSession` still returns `currentPhase: 'clear'` with no `feltRehearsal`/`spokenCommitment`/`spokenAt` fields.

- [ ] **Step 3: Implement the migration function and update `newSession`/`PHASE_ORDER`**

In `morning-launch-logic.js`, replace line 9:

```javascript
var PHASE_ORDER = ['settle', 'align', 'rehearse', 'commit', 'speakit', 'complete'];
```

Add a new function right after `isNonEmpty` (after line 13, before `newSession`):

```javascript
var PHASE_MIGRATIONS = { clear: 'settle', visualize: 'rehearse' };
function migratePhaseNames(phase) {
  return PHASE_MIGRATIONS[phase] || phase;
}
```

Replace `newSession` (lines 15-35):

```javascript
function newSession(date) {
  return {
    version: 1,
    date: date,
    status: 'draft',
    currentPhase: 'settle',
    brainDump: '',
    recalledOutcomes: [],
    savedOutcomeSnapshot: null,
    focusOutcomeId: null,
    processVisualization: '',
    obstacle: '',
    response: '',
    feltRehearsal: '',
    needleMovers: [],
    winMoverId: null,
    spokenCommitment: '',
    spokenAt: null,
    skipReason: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    evening: null
  };
}
```

- [ ] **Step 4: Update `canEnterPhase` for the new phase names**

Replace lines 47-57 (`canEnterPhase`):

```javascript
function canEnterPhase(session, phase) {
  if (!session) return false;
  if (phase === 'settle') return true;
  if (phase === 'align') return isNonEmpty(session.brainDump) || session.currentPhase !== 'settle';
  if (phase === 'rehearse') return !!session.focusOutcomeId;
  if (phase === 'commit') {
    return isNonEmpty(session.processVisualization) && isNonEmpty(session.obstacle) && isNonEmpty(session.response) && isNonEmpty(session.feltRehearsal);
  }
  if (phase === 'speakit') {
    return Array.isArray(session.needleMovers) && session.needleMovers.length === 3 && !!session.winMoverId;
  }
  if (phase === 'complete') return false; // only via completeSession
  return false;
}
```

- [ ] **Step 5: Export `migratePhaseNames` from the module's `api` object**

In the `api` object (starts line 217), add after `advancePhase: advancePhase,`:

```javascript
migratePhaseNames: migratePhaseNames,
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd C:\Users\gregm\row
node morning-launch-logic.selfcheck.cjs
```

Expected: no `FAIL` lines printed, exits 0.

- [ ] **Step 7: Commit**

```bash
git add morning-launch-logic.js morning-launch-logic.selfcheck.cjs
git commit -m "feat: phase-name migration + new fields (feltRehearsal, spokenCommitment) for voice redesign"
```

---

## Task 2: `completeSession` and `summarize` gain the felt-rehearsal requirement and Speak It data

**Files:**
- Modify: `morning-launch-logic.js:134-153` (`completeSession`), `:155-169` (`summarize`), `:172-190` (`vaultExportProjection`)
- Test: `morning-launch-logic.selfcheck.cjs`

- [ ] **Step 1: Write the failing tests**

Add after the existing `completeSession` tests in `morning-launch-logic.selfcheck.cjs`:

```javascript
// --- completeSession requires feltRehearsal too ---
let completeCandidate = L.newSession('2026-08-13');
completeCandidate.processVisualization = 'doing the work';
completeCandidate.obstacle = 'distraction';
completeCandidate.response = 'close the tab';
// feltRehearsal deliberately left empty
const missingFeltResult = L.completeSession(completeCandidate, fiveActive, [], null);
assertTrue(!missingFeltResult.ok, 'completeSession fails without feltRehearsal even when process/obstacle/response are set');

completeCandidate.feltRehearsal = 'I feel focused, I handle the setback calmly';
const win3 = { id: 'm1', textSnapshot: 'Ship it', order: 0, doneSnapshot: false, goalDateKey: '2026-08-13', goalId: 'g1' };
const m2 = { id: 'm2', textSnapshot: 'Call client', order: 1, doneSnapshot: false, goalDateKey: '2026-08-13', goalId: 'g2' };
const m3 = { id: 'm3', textSnapshot: 'Train legs', order: 2, doneSnapshot: false, goalDateKey: '2026-08-13', goalId: 'g3' };
const okResult = L.completeSession(completeCandidate, fiveActive, [win3, m2, m3], 'm1');
assertTrue(okResult.ok, 'completeSession succeeds once feltRehearsal is set');
assertEqual(okResult.session.currentPhase, 'speakit', 'completing the movers phase lands in speakit, not complete directly');

// --- spoken commitment gates true completion ---
const summaryNoSpeak = L.summarize(okResult.session);
assertEqual(summaryNoSpeak.spokenCommitment, null, 'summarize reports null spokenCommitment before Speak It');
let spokenSession = Object.assign({}, okResult.session);
spokenSession.spokenCommitment = 'I will ship it and call the client.';
spokenSession.spokenAt = '2026-08-13T13:00:00.000Z';
spokenSession.currentPhase = 'complete';
spokenSession.status = 'completed';
const summaryWithSpeak = L.summarize(spokenSession);
assertEqual(summaryWithSpeak.spokenCommitment, 'I will ship it and call the client.', 'summarize reports the spoken commitment once set');
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd C:\Users\gregm\row
node morning-launch-logic.selfcheck.cjs
```

Expected: FAIL — `completeSession` currently sets `currentPhase: 'complete'` directly and doesn't check `feltRehearsal`; `summarize` doesn't return `spokenCommitment`.

- [ ] **Step 3: Implement**

Replace `completeSession` (lines 134-153) — it now lands in `speakit`, not `complete`, and validates `feltRehearsal`:

```javascript
function completeSession(session, outcomes, movers, winMoverId) {
  var outcomeCheck = validateOutcomes(outcomes);
  var moverCheck = validateMovers(movers, winMoverId);
  var errors = outcomeCheck.errors.concat(moverCheck.errors);
  if (!isNonEmpty(session.processVisualization) || !isNonEmpty(session.obstacle) || !isNonEmpty(session.response)) {
    errors.push('Rehearse phase is incomplete.');
  }
  if (!isNonEmpty(session.feltRehearsal)) {
    errors.push('Felt-sense rehearsal is incomplete.');
  }
  if (errors.length) return { ok: false, errors: errors };

  var active = outcomes.filter(function (o) { return o.active; });
  var copy = {};
  for (var k in session) { if (Object.prototype.hasOwnProperty.call(session, k)) copy[k] = session[k]; }
  copy.status = 'draft'; // not fully done until Speak It -- completeSession here only closes Commit
  copy.currentPhase = 'speakit';
  copy.needleMovers = movers;
  copy.winMoverId = winMoverId;
  copy.savedOutcomeSnapshot = active.map(function (o) { return { id: o.id, text: o.text }; });
  return { ok: true, session: copy };
}

// Closes Speak It -- the actual final step now that completeSession lands in speakit.
function completeSpeakIt(session, spokenCommitment) {
  if (!isNonEmpty(spokenCommitment)) return { ok: false, errors: ['A spoken commitment is required.'] };
  var copy = {};
  for (var k in session) { if (Object.prototype.hasOwnProperty.call(session, k)) copy[k] = session[k]; }
  copy.status = 'completed';
  copy.currentPhase = 'complete';
  copy.spokenCommitment = spokenCommitment;
  copy.spokenAt = new Date().toISOString();
  copy.completedAt = new Date().toISOString();
  return { ok: true, session: copy };
}
```

Update `summarize` (lines 155-169) to include `spokenCommitment`:

```javascript
function summarize(session) {
  if (!session) return null;
  var win = (session.needleMovers || []).find(function (m) { return m.id === session.winMoverId; });
  var firstOpen = (session.needleMovers || [])
    .slice()
    .sort(function (a, b) { return a.order - b.order; })
    .find(function (m) { return !m.doneSnapshot; });
  return {
    status: session.status,
    winCondition: win ? win.textSnapshot : null,
    movers: session.needleMovers || [],
    currentFirstAction: firstOpen ? firstOpen.firstAction : null,
    ifThen: formatIfThen(session.obstacle, session.response),
    spokenCommitment: session.spokenCommitment || null
  };
}
```

Update `vaultExportProjection` (lines 172-190) to include the two new fields — add after the `ifThen:` line:

```javascript
      ifThen: formatIfThen(session.obstacle, session.response),
      feltRehearsal: session.feltRehearsal || null,
      spokenCommitment: session.spokenCommitment || null,
      evening: session.evening || null
```

(replaces the existing `ifThen:` and `evening:` lines, inserting the two new fields between them)

Add `completeSpeakIt` to the exported `api` object, after `completeSession: completeSession,`:

```javascript
completeSpeakIt: completeSpeakIt,
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd C:\Users\gregm\row
node morning-launch-logic.selfcheck.cjs
```

Expected: no `FAIL` lines, exits 0.

- [ ] **Step 5: Commit**

```bash
git add morning-launch-logic.js morning-launch-logic.selfcheck.cjs
git commit -m "feat: split session completion into Commit-closes/Speak-It-closes, validate feltRehearsal"
```

---

## Task 3: Shared `mlVoiceSequence` helper in `main.html`

**Files:**
- Modify: `main.html` (new function, placed after `mlSpeakPhasePrompt`, around line 1668)

No unit test for this task — it's DOM-building/interaction code, matching this file's existing convention (no unit tests for `mlBuild*` functions, browser verification only, per the design spec's Testing section).

- [ ] **Step 1: Add the shared voice-sequence helper**

Insert after `mlSpeakPhasePrompt` (after line 1668, before `mlSessionKey`):

```javascript
  // Drives a sequence of voice-first prompts within one phase. `steps` is
  // an array of {key, prompt, get, set} -- get/set read and write the
  // current value for that step (usually a session field). Each step:
  // speaks the prompt, auto-opens the mic on speech completion, shows the
  // transcript as an editable textarea before the step is considered
  // answered, then advances. `onAllDone` fires once every step has a
  // non-empty value. Renders into `container` (cleared and rebuilt each
  // call, same pattern as the rest of this file's mlBuild* functions).
  function mlVoiceSequence(container, phaseKey, steps, onAllDone) {
    let idx = steps.findIndex(s => !isNonEmptyStr(s.get()));
    if (idx === -1) idx = steps.length - 1; // all answered -- show the last one, editable
    container.innerHTML = '';

    const step = steps[idx];
    const progress = el('div', 'ml-sub', 'Step ' + (idx + 1) + ' of ' + steps.length);
    container.appendChild(progress);
    container.appendChild(el('label', 'ml-prompt', step.prompt));

    const ta = document.createElement('textarea');
    ta.className = 'gm-input ml-textarea ml-voice-textarea';
    ta.value = step.get() || '';
    ta.setAttribute('aria-label', step.key);
    ta.addEventListener('input', () => step.set(ta.value));
    container.appendChild(ta);

    const micBtn = el('button', 'ml-voice-mic-big', '🎤');
    micBtn.type = 'button';
    micBtn.setAttribute('aria-label', 'Answer by voice');
    let controller = null;
    function stopListening() {
      if (controller) { controller.stop(); controller = null; }
      micBtn.classList.remove('is-listening');
    }
    micBtn.addEventListener('click', () => {
      if (controller) { stopListening(); return; }
      if (!window.RowVoice) return;
      micBtn.classList.add('is-listening');
      controller = window.RowVoice.startCapture(
        (transcript) => { stopListening(); ta.value = transcript; step.set(transcript); },
        (msg) => { stopListening(); if (msg) progress.textContent = msg; }
      );
    });
    container.appendChild(micBtn);
    container.appendChild(el('div', 'ml-sub', 'or type instead — the field above always works'));

    // Auto-open the mic once the prompt finishes speaking. Only for a
    // freshly-empty step -- re-rendering an already-answered step (the
    // user edited a prior answer and came back) must not yank focus into
    // a mic capture they didn't ask for.
    if (window.RowVoice && window.RowVoice.isSupported() && !isNonEmptyStr(step.get())) {
      window.RowVoice.speak(step.prompt, () => { micBtn.click(); });
    }

    const nextWrap = el('div', 'ml-actions');
    const err = el('div', 'ml-error');
    const isLast = idx === steps.length - 1;
    const allAnswered = steps.every(s => isNonEmptyStr(s.get()));
    const nextBtn = el('button', 'gm-add', isLast && allAnswered ? 'Continue' : 'Next');
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', () => {
      stopListening();
      if (!isNonEmptyStr(step.get())) { err.textContent = 'Answer this one before continuing.'; return; }
      if (isLast && allAnswered) { onAllDone(); return; }
      mlVoiceSequence(container, phaseKey, steps, onAllDone);
    });
    nextWrap.appendChild(nextBtn);
    nextWrap.appendChild(err);
    container.appendChild(nextWrap);
  }

  function isNonEmptyStr(s) { return typeof s === 'string' && s.trim().length > 0; }
```

- [ ] **Step 2: Commit**

```bash
git add main.html
git commit -m "feat: mlVoiceSequence shared helper for voice-first multi-step phases"
```

(No test-run step here — pure new function, not yet called from anywhere; verified in context by Task 4-7's browser checks.)

---

## Task 4: Rewire Settle, Align, Rehearse, Speak It to use `mlVoiceSequence`

**Files:**
- Modify: `main.html:1814-1831` (`mlBuildClear` → `mlBuildSettle`), `:1881-1942` (`mlBuildAlign`), `:1944-1988` (`mlBuildVisualize` → `mlBuildRehearse`), new `mlBuildSpeakIt`
- Modify: `main.html:2330-2360` (`mlRender` dispatch)

- [ ] **Step 1: Replace `mlBuildClear` with `mlBuildSettle`**

Replace the whole function (lines 1814-1831):

```javascript
  function mlBuildSettle(session) {
    const wrap = el('div', 'ml-phase');
    wrap.appendChild(el('div', 'ml-phase-title', 'Settle'));
    const seqContainer = el('div', 'ml-voice-seq');
    wrap.appendChild(seqContainer);
    mlVoiceSequence(seqContainer, 'settle', [
      {
        key: 'brainDump',
        prompt: 'Before anything else — what\'s on your mind this morning?',
        get: () => session.brainDump || '',
        set: (v) => { session.brainDump = v; mlSessionSaveQuiet(session); }
      }
    ], () => {
      const check = window.MorningLaunchLogic.advancePhase(session, 'align');
      if (!check.ok) return;
      session.currentPhase = 'align';
      mlLastSpokenPhase = null;
      mlSessionSave(session);
    });
    return wrap;
  }
```

- [ ] **Step 2: Rewrite `mlBuildAlign`'s recall step to use `mlVoiceSequence`**

Replace lines 1881-1913 (the recall-inputs portion, up through the `if (!mlAlignRevealed)` block's `return wrap;` — leave the reveal/outcome-selection portion below it, lines 1914-1942, unchanged since that's a radio-select UI, not free-text voice input):

```javascript
  function mlBuildAlign(session, outcomesState) {
    const ML = window.MorningLaunchLogic;
    const wrap = el('div', 'ml-phase');
    wrap.appendChild(el('div', 'ml-phase-title', 'Align'));

    if (!mlAlignRevealed) {
      if (!Array.isArray(session.recalledOutcomes)) session.recalledOutcomes = ['', '', '', '', ''];
      while (session.recalledOutcomes.length < 5) session.recalledOutcomes.push('');
      const seqContainer = el('div', 'ml-voice-seq');
      wrap.appendChild(seqContainer);
      const steps = [0, 1, 2, 3, 4].map(i => ({
        key: 'outcome' + i,
        prompt: 'Outcome ' + (i + 1) + ' — say it from memory.',
        get: () => session.recalledOutcomes[i] || '',
        set: (v) => { session.recalledOutcomes[i] = v; mlSessionSaveQuiet(session); }
      }));
      mlVoiceSequence(seqContainer, 'align', steps, () => {
        mlAlignRevealed = true;
        mlRender();
      });
      return wrap;
    }
```

The rest of the function (the `check = ML.validateOutcomes(...)` block through the end, currently lines 1916-1942) stays exactly as-is — only its target phase name changes from `'visualize'` to `'rehearse'`:

```javascript
    wrap.appendChild(mlNextButton(session, 'rehearse', {
      extraValidate: () => session.focusOutcomeId ? null : 'Select the outcome that matters most today.',
      label: 'Continue to Rehearse'
    }));
```

- [ ] **Step 3: Replace `mlBuildVisualize` with `mlBuildRehearse`**

Replace the whole function (lines 1944-1988):

```javascript
  function mlBuildRehearse(session) {
    const ML = window.MorningLaunchLogic;
    const wrap = el('div', 'ml-phase');
    wrap.appendChild(el('div', 'ml-phase-title', 'Rehearse'));
    const seqContainer = el('div', 'ml-voice-seq');
    wrap.appendChild(seqContainer);
    const steps = [
      {
        key: 'processVisualization',
        prompt: 'What does doing the work successfully look like? Describe the process you will perform.',
        get: () => session.processVisualization || '',
        set: (v) => { session.processVisualization = v; mlSessionSaveQuiet(session); }
      },
      {
        key: 'obstacle',
        prompt: 'What internal obstacle is most likely to interfere?',
        get: () => session.obstacle || '',
        set: (v) => { session.obstacle = v; mlSessionSaveQuiet(session); }
      },
      {
        key: 'response',
        prompt: 'If that happens, what exactly will you do?',
        get: () => session.response || '',
        set: (v) => { session.response = v; mlSessionSaveQuiet(session); }
      },
      {
        key: 'feltRehearsal',
        prompt: 'Now picture today actually going well. What does that feel like — and where does it get hard? Include that moment too.',
        get: () => session.feltRehearsal || '',
        set: (v) => { session.feltRehearsal = v; mlSessionSaveQuiet(session); }
      }
    ];
    mlVoiceSequence(seqContainer, 'rehearse', steps, () => {
      const sentence = ML.formatIfThen(session.obstacle, session.response);
      const confirmWrap = el('div', 'ml-phase');
      confirmWrap.appendChild(el('div', 'ml-ifthen', sentence || 'Fill in both fields to see your if-then plan.'));
      const confirmLabel = el('label', 'ml-outcome-item');
      const confirmCb = document.createElement('input');
      confirmCb.type = 'checkbox';
      confirmLabel.appendChild(confirmCb);
      confirmLabel.appendChild(el('span', null, 'I confirm this if-then plan'));
      confirmWrap.appendChild(confirmLabel);
      const err = el('div', 'ml-error');
      const btn = el('button', 'gm-add', 'Continue to Commit');
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (!confirmCb.checked) { err.textContent = 'Confirm the if-then plan before continuing.'; return; }
        const check = ML.advancePhase(session, 'commit');
        if (!check.ok) { err.textContent = check.errors.join(' '); return; }
        session.currentPhase = 'commit';
        mlLastSpokenPhase = null;
        mlSessionSave(session);
      });
      confirmWrap.appendChild(btn);
      confirmWrap.appendChild(err);
      seqContainer.parentNode.appendChild(confirmWrap);
    });
    return wrap;
  }
```

- [ ] **Step 4: Add `mlBuildSpeakIt`**

Insert after `mlBuildCompleted` (after line 2253, before `let mlExpandedReview = false;`):

```javascript
  function mlBuildSpeakIt(session) {
    const ML = window.MorningLaunchLogic;
    const wrap = el('div', 'ml-phase');
    wrap.appendChild(el('div', 'ml-phase-title', 'Speak It'));
    wrap.appendChild(el('div', 'ml-sub', 'Win condition: ' + (ML.summarize(session).winCondition || '—')));
    const seqContainer = el('div', 'ml-voice-seq');
    wrap.appendChild(seqContainer);
    mlVoiceSequence(seqContainer, 'speakit', [
      {
        key: 'spokenCommitment',
        prompt: 'Say your win condition and today\'s focus out loud.',
        get: () => session.spokenCommitment || '',
        set: (v) => { session.spokenCommitment = v; mlSessionSaveQuiet(session); }
      }
    ], () => {
      const result = ML.completeSpeakIt(session, session.spokenCommitment);
      if (!result.ok) return;
      mlSessionSave(result.session);
      loadToday();
    });
    return wrap;
  }
```

- [ ] **Step 5: Update `mlRender`'s dispatch**

Replace the dispatch block inside `mlRender` (the `if (session.currentPhase === 'clear') ...` chain, lines 2350-2354):

```javascript
      if (session.currentPhase === 'settle') primary = mlBuildSettle(session);
      else if (session.currentPhase === 'align') primary = mlBuildAlign(session, outcomesState);
      else if (session.currentPhase === 'rehearse') primary = mlBuildRehearse(session);
      else if (session.currentPhase === 'commit') primary = mlBuildCommit(session, outcomesState);
      else if (session.currentPhase === 'speakit') primary = mlBuildSpeakIt(session);
      else primary = mlBuildEntry(session);
```

Also update `mlSessionLoad` (line 1676-1679) to run the migration on load:

```javascript
  function mlSessionLoad() {
    const s = storeGet(mlSessionKey());
    if (!s || s.version !== 1) return window.MorningLaunchLogic.newSession(getActiveDateString());
    s.currentPhase = window.MorningLaunchLogic.migratePhaseNames(s.currentPhase);
    if (typeof s.feltRehearsal !== 'string') s.feltRehearsal = '';
    if (typeof s.spokenCommitment !== 'string') s.spokenCommitment = '';
    if (s.spokenAt === undefined) s.spokenAt = null;
    return s;
  }
```

And `mlBuildEntry`'s "already started" check (line 1749) — `'clear'` no longer exists as a phase name, update to `'settle'`:

```javascript
    const started = session.currentPhase !== 'settle' || !!session.brainDump;
```

- [ ] **Step 6: Commit**

```bash
git add main.html
git commit -m "feat: wire Settle/Align/Rehearse/Speak It phases to voice-first sequence, add phase-migration on load"
```

(Browser verification for this task happens together with Task 5/6, in Task 7's full walkthrough — the phases are interdependent and easiest to verify as one flow.)

---

## Task 5: Voice mic buttons on Commit's free-text sub-fields

**Files:**
- Modify: `main.html:2031-2056` (inside `mlBuildMoverEditor`)

Per the plan header's real-refinement note — Commit's structured form (mode select, existing-task select, linked-outcome select, estimated-minutes number) is unchanged. Only the 3 free-text inputs gain mic buttons, using the existing `attachMic` pattern already used elsewhere in this file (not the new `mlVoiceSequence` — this is a form with conditional fields, not a linear sequence).

- [ ] **Step 1: Add `attachMic` to the new-task text input**

After line 2034 (`box.appendChild(inp);` inside the `else` branch for `m.mode === 'new'`):

```javascript
      if (window.RowVoice) window.RowVoice.attachMic(inp);
```

- [ ] **Step 2: Add `attachMic` to definition-of-done and first-action inputs**

After line 2051 (`box.appendChild(dod);`):

```javascript
    if (window.RowVoice) window.RowVoice.attachMic(dod);
```

After line 2056 (`box.appendChild(fa);`):

```javascript
    if (window.RowVoice) window.RowVoice.attachMic(fa);
```

- [ ] **Step 3: Commit**

```bash
git add main.html
git commit -m "feat: add voice mic buttons to Commit's free-text mover fields"
```

---

## Task 6: Surface Speak It's commitment at Evening Shutdown

**Files:**
- Modify: `main.html:2258-2264` (`mlBuildEvening`)

- [ ] **Step 1: Add the spoken commitment near the top of Evening Shutdown**

After line 2264 (`mlAppendRoutineChecklist(wrap, 'evening');`), insert:

```javascript
    if (session.spokenCommitment) {
      wrap.appendChild(el('div', 'ml-sub', 'This morning you said: "' + session.spokenCommitment + '"'));
    }
```

- [ ] **Step 2: Commit**

```bash
git add main.html
git commit -m "feat: surface morning's spoken commitment at Evening Shutdown"
```

---

## Task 7: CSS for the new voice-first UI + full browser verification

**Files:**
- Modify: `main.html` (inline `<style>` block — find the existing `.ml-voice-mic-btn` / `.ml-phase` rules and add alongside them)

- [ ] **Step 1: Find the existing Morning Launch CSS block**

```bash
grep -n "ml-voice-mic-btn\|\.ml-phase {" C:\Users\gregm\row\main.html
```

- [ ] **Step 2: Add styles for the new elements** (insert near the existing `.ml-voice-mic-btn` rule)

```css
.ml-voice-mic-big {
  display: block;
  margin: 16px auto;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 1px solid rgba(110,231,183,0.3);
  background: rgba(110,231,183,0.08);
  color: var(--accent);
  font-size: 28px;
  cursor: pointer;
}
.ml-voice-mic-big.is-listening {
  background: var(--accent);
  color: #08130f;
  box-shadow: 0 0 0 6px rgba(110,231,183,0.2);
}
.ml-voice-seq { text-align: center; }
.ml-voice-textarea { min-height: 80px; }
```

(Uses the file's real existing `--accent: #6EE7B7` custom property, confirmed at `main.html:24` — not a placeholder color, this is the same teal used by `.section-title`/`.gm-add` elsewhere in this file.)

- [ ] **Step 3: Full browser verification**

Using the Browser pane against the local dev server (or the real deployed app if no local server is configured for Row):
1. Start a fresh Morning Launch — confirm Settle speaks its prompt and the mic auto-opens (visually, `.is-listening` class applied).
2. Speak or type a brain dump, confirm it advances to Align.
3. Walk through all 5 Align outcome-recall steps, confirm the step counter ("Step N of 5") advances correctly, confirm it lands on the reveal/outcome-selection screen after step 5.
4. Walk through Rehearse's 4 steps (process, obstacle, response, felt rehearsal), confirm the if-then confirmation screen appears after step 4, confirm the "Continue to Commit" button is gated on the checkbox.
5. In Commit, confirm the 3 free-text fields (new-task text, definition of done, first action) each show a mic button; confirm the select/number fields do not.
6. Complete Commit — confirm it lands on Speak It (not directly "complete").
7. Complete Speak It — confirm the session now shows as completed, and `mlBuildCompleted` renders correctly.
8. If the current time is past 5pm, or by temporarily adjusting `mlEveningDue()`'s check for the test, confirm Evening Shutdown shows the spoken commitment text.
9. Refresh mid-ritual at each phase (Settle, Align, Rehearse, Commit) — confirm it resumes at the correct phase with prior answers intact.
10. Manually seed a `morning_launch:<date>` record via devtools with `currentPhase: 'clear'` and `currentPhase: 'visualize'` (the old names) — reload, confirm each resumes correctly under the new phase names (`settle`, `rehearse`) via the migration in `mlSessionLoad`.

- [ ] **Step 4: Commit the CSS**

```bash
git add main.html
git commit -m "feat: voice-first UI styling for the redesigned Morning Launch"
```

---

## Task 8: Clear the stale Today-list test data (separate, out-of-band fix)

**Files:** none in the repo — this is live production data, not code.

- [ ] **Step 1: Confirm with Carl exactly which items to remove** (should already be confirmed as "Ship the PR" / "Call the client" per the brainstorm — but do a live check against the current Today list before deleting anything, in case it's changed).
- [ ] **Step 2: Delete the confirmed stale items** via the Row UI directly (the existing delete-goal `×` button already in `main.html`, no code change needed) — through the Browser pane against the real logged-in session, same as this session's earlier live verification pattern.

---

## Task 9: Update the vault project note

**Files:**
- Modify: `Carl Meyer/06 - Psychology & Mindset/Morning Launch — Evidence-Based 5-4-5.md`

- [ ] **Step 1: Read the current note in full**, update the phase list (Clear/Align/Visualize/Commit → Settle/Align/Rehearse/Commit/Speak It), add the new evidence sources as wikilinks (The Daily Protocol — Five Moves synthesis, both Dispenza notes, Tara Swart), and note the voice-first interaction model. Only do this after Task 7's browser verification confirms the feature actually works as designed — this note describes the shipped feature, not the plan (matches the note's own existing convention).
- [ ] **Step 2: Commit and push** (vault git repo, separate from `row`).
