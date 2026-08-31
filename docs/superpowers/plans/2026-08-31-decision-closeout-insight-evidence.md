# Decision Closeout Measured Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `training-insight-engine.js` findings into the weekly-review closeout flow so a due decision arrives pre-assembled with the measured evidence relevant to its own subject matter (muscle groups / anchor lifts) and review window.

**Architecture:** Two new pure functions (`matchInsightFindings`, extracted `buildInsightFindings`) plus one new async wiring function (`computeCloseoutEvidence`) and one new pure render function (`renderMeasuredEvidenceHtml`), all added to `weekly-review.html`'s existing inline `<script>` block, following the codebase's established pattern (pure logic co-located with the page, tested via vm-sandbox extraction — see `weekly-review-scorecard.test.js`).

**Tech Stack:** Vanilla JS, no build step, no framework. Tests run via plain `node` (`node weekly-review-closeout-evidence.test.js` or `npm test`).

**Full spec:** `docs/superpowers/specs/2026-08-31-decision-closeout-insight-evidence-design.md`

---

## Task 1: `matchInsightFindings` — relevance filter (pure function)

**Files:**
- Modify: `weekly-review.html` (add function after `computeScorecard`, weekly-review.html:279)
- Test: `weekly-review-closeout-evidence.test.js` (new file)

- [ ] **Step 1: Write the failing test**

Create `weekly-review-closeout-evidence.test.js`:

```js
// weekly-review.html's inline <script> is loaded as a classic (non-module)
// tag, so it can't be imported -- same vm-sandbox extraction pattern as
// weekly-review-scorecard.test.js / weekly-review-closeout.test.js.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const gymVolumeSource = readFileSync(new URL('./gym-volume-logic.js', import.meta.url), 'utf8');
const gymWorkoutEventsSource = readFileSync(new URL('./gym-workout-events.js', import.meta.url), 'utf8');
const insightEngineSource = readFileSync(new URL('./training-insight-engine.js', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./weekly-review.html', import.meta.url), 'utf8');

const scriptMatch = pageSource.match(/<script>\r?\n(const MUSCLES[\s\S]*?)\r?\n<\/script>/);
if (!scriptMatch) {
  console.error('FAIL: could not find weekly-review.html\'s inline <script> block -- page structure changed');
  process.exit(1);
}
const pageScriptSource = scriptMatch[1];

function makePage({ poCoachData, healthData } = {}) {
  const fetchCalls = [];
  const sandbox = {
    window: { SUPABASE_CONFIG: { URL: 'https://example.supabase.co', KEY: 'test-key' } },
    document: { addEventListener: () => {}, getElementById: () => null },
    fetch: (url) => {
      fetchCalls.push(url);
      if (url.includes('key=eq.po-coach')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(poCoachData ? [{ data: poCoachData }] : []) });
      }
      if (url.includes('key=eq.health')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(healthData ? [{ data: healthData }] : []) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
    },
    console,
    Promise,
    Date,
    Object,
    Array,
    Math,
    JSON,
    Intl,
  };
  vm.createContext(sandbox);
  vm.runInContext(gymVolumeSource, sandbox);
  vm.runInContext(gymWorkoutEventsSource, sandbox);
  vm.runInContext(insightEngineSource, sandbox);
  sandbox.window.RowAuth = { getAccessToken: async () => 'tok' };
  vm.runInContext(pageScriptSource, sandbox);
  return sandbox;
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

function assert(cond, label) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
}

function runMatchInsightFindingsTests(page) {
  const { matchInsightFindings } = page;

  const chronicUnder = { type: 'chronic-muscle-under', muscle: 'Chest', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const chronicOtherMuscle = { type: 'chronic-muscle-over', muscle: 'Back', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const stalledMatch = { type: 'stalled-load-plateau', exercise: 'Bench Press', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const stalledNoMatch = { type: 'stalled-load-regression', exercise: 'Overhead Press', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const missedSession = { type: 'missed-session-trend', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const volumePhase = { type: 'volume-phase-mismatch', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const recovery = { type: 'recovery-signal', observation: 'x', confidence: 'medium', evidenceWindow: { start: 'a', end: 'b' } };

  const decision = {
    details: {
      muscle_groups: { Chest: { action: 'add_set', baseline: 10 } },
      anchor_lifts: [{ lift: 'bench press', call: 'progress', guardrail: null }],
    },
  };

  const all = [chronicUnder, chronicOtherMuscle, stalledMatch, stalledNoMatch, missedSession, volumePhase, recovery];
  const result = matchInsightFindings(decision, all);

  assert(result.includes(chronicUnder), 'chronic-muscle finding kept when its muscle is a decision.details.muscle_groups key');
  assert(!result.includes(chronicOtherMuscle), 'chronic-muscle finding dropped when its muscle is NOT in muscle_groups');
  assert(result.includes(stalledMatch), 'stalled-load finding kept when its exercise case-insensitively matches an anchor_lifts[].lift');
  assert(!result.includes(stalledNoMatch), 'stalled-load finding dropped when its exercise matches no anchor_lifts[].lift');
  assert(result.includes(missedSession), 'missed-session-trend always kept (no muscle/exercise field)');
  assert(result.includes(volumePhase), 'volume-phase-mismatch always kept (no muscle/exercise field)');
  assert(result.includes(recovery), 'recovery-signal always kept (no muscle/exercise field)');

  // Empty decision.details -- whole-training findings still kept, scoped ones dropped
  const emptyDecision = { details: {} };
  const emptyResult = matchInsightFindings(emptyDecision, all);
  assertEqual(emptyResult, [missedSession, volumePhase, recovery], 'empty muscle_groups/anchor_lifts -- only whole-training findings survive');

  console.log('matchInsightFindings: all cases passed');
}

async function run() {
  const page = makePage();
  runMatchInsightFindingsTests(page);
  console.log('weekly-review-closeout-evidence.test.js: all cases passed');
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node weekly-review-closeout-evidence.test.js`
Expected: FAIL — `TypeError: matchInsightFindings is not a function` (or similar), since the function doesn't exist yet.

- [ ] **Step 3: Add `matchInsightFindings` to weekly-review.html**

In `weekly-review.html`, immediately after the closing `}` of `computeScorecard` (weekly-review.html:279, right before the `renderCloseout`... actually before `renderScorecard`'s function at line ~296 — insert between `computeScorecard`'s closing brace and the `VERDICT_BADGE` const), add:

```js
// Filters TrainingInsightEngine findings down to the ones relevant to this
// decision's own subject matter -- pure metadata matching, no new
// heuristics. See docs/superpowers/specs/
// 2026-08-31-decision-closeout-insight-evidence-design.md.
const WHOLE_TRAINING_FINDING_TYPES = ['missed-session-trend', 'volume-phase-mismatch', 'recovery-signal'];
function matchInsightFindings(decision, findings) {
  const details = (decision && decision.details) || {};
  const muscleGroups = details.muscle_groups || {};
  const anchorLiftNames = (Array.isArray(details.anchor_lifts) ? details.anchor_lifts : [])
    .map(a => (a && a.lift ? a.lift.toLowerCase() : null))
    .filter(Boolean);
  return (findings || []).filter(f => {
    if (WHOLE_TRAINING_FINDING_TYPES.indexOf(f.type) !== -1) return true;
    if (f.muscle) return Object.prototype.hasOwnProperty.call(muscleGroups, f.muscle);
    if (f.exercise) return anchorLiftNames.indexOf(f.exercise.toLowerCase()) !== -1;
    return false;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node weekly-review-closeout-evidence.test.js`
Expected: `weekly-review-closeout-evidence.test.js: all cases passed`

- [ ] **Step 5: Commit**

```bash
git add weekly-review.html weekly-review-closeout-evidence.test.js
git commit -m "feat: add matchInsightFindings relevance filter for decision closeout"
```

---

## Task 2: Extract `buildInsightFindings` from `renderReadinessPanel` (with data-cutoff fix)

**Files:**
- Modify: `weekly-review.html:706-777` (extract into a new top-level function), `weekly-review.html:709` area (call site)

- [ ] **Step 1: Extract the block into a new function**

Immediately before `async function renderReadinessPanel() {` (weekly-review.html:556), insert:

```js
// Builds TrainingInsightEngine findings (base engine + per-muscle chronic
// volume) from gymState/health, anchored to nowRef. Shared by
// renderReadinessPanel (nowRef = live "now") and computeCloseoutEvidence
// (nowRef = the decision's review-week Sunday) so this windowing logic
// lives in exactly one place.
//
// detectStalledExercise has no `now` awareness of its own -- it just walks
// whatever exposures it's handed, treating the last one as "latest". Every
// other detector already bounds its own trailing windows against `now`
// internally (sessionsInWindow/hoursInWindow both cap at `now`, and the
// weeklySets/chronic-muscle loops here are built from explicit week
// windows anchored to nowRef), so filtering exposures to date <= nowRef
// before they reach the engine is the one cutoff this function needs to
// apply itself (Codex review, 2026-08-31) -- otherwise a closeout run with
// a past nowRef could leak exposures logged after the review week into
// that week's "measured evidence".
function buildInsightFindings(gymState, health, phase, nowRef) {
  if (!(window.TrainingInsightEngine && window.GymWorkoutEvents)) {
    return { findings: [], exposuresByName: {}, sessionDates: [], weeklySets: [] };
  }
  const nowKey = nowRef.toISOString().slice(0, 10);
  const exercisesById = {};
  (gymState.exercises || []).forEach(ex => { exercisesById[ex.id] = ex; });
  const exposuresByName = {};
  Object.keys(gymState.logs || {}).forEach(exId => {
    const ex = exercisesById[exId];
    if (!ex) return;
    const entries = (gymState.logs[exId] || []).map(l => ({
      date: (l.date || '').slice(0, 10),
      load: ex.bw ? l.reps : window.GymWorkoutEvents.totalLoad(l, ex),
      reps: l.reps,
      variantTag: l.variant || null,
    })).filter(e => e.date && e.date <= nowKey && e.load != null);
    if (entries.length) exposuresByName[ex.name] = entries;
  });
  const allEntries = Object.values(gymState.logs || {}).flat();
  const sessionDates = Array.from(new Set(allEntries.map(l => (l.date || '').slice(0, 10)).filter(Boolean)));

  // Trailing 6 calendar weeks (Mon-Sun, UTC) of total logged sets.
  const dow = nowRef.getUTCDay() === 0 ? 7 : nowRef.getUTCDay(); // Mon=1..Sun=7
  const thisMonday = new Date(nowRef); thisMonday.setUTCDate(nowRef.getUTCDate() - (dow - 1));
  const weeklySets = [];
  for (let w = 5; w >= 0; w--) {
    const wkMonday = new Date(thisMonday); wkMonday.setUTCDate(thisMonday.getUTCDate() - w * 7);
    const wkSunday = new Date(wkMonday); wkSunday.setUTCDate(wkMonday.getUTCDate() + 6);
    const mKey = wkMonday.toISOString().slice(0, 10), sKey = wkSunday.toISOString().slice(0, 10);
    weeklySets.push(allEntries.filter(l => { const d = (l.date || '').slice(0, 10); return d >= mKey && d <= sKey; }).length);
  }

  const allSleepEntries = ((health && health['health:sleep']) || []).filter(e => e && e.date && e.hours != null);

  const findings = window.TrainingInsightEngine.runInsightEngine({
    exercises: exposuresByName,
    sessionDates: sessionDates,
    weeklySets: weeklySets,
    phase: phase,
    sleepEntries: allSleepEntries,
    now: nowRef,
  });

  // Per-muscle chronic volume mismatch -- see docs/superpowers/specs/
  // 2026-08-29-chronic-muscle-volume-mismatch-design.md. Uses 6
  // COMPLETED weeks (excludes the current in-progress week -- a run
  // must never be started or broken by a week that isn't over yet).
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const lastCompleteMonday = new Date(thisMonday.getTime() - oneWeekMs);
  const musclesToCheck = Object.keys(window.GymVolumeLogic.MUSCLE_BANDS);
  const weeklyCountsByMuscle = {};
  musclesToCheck.forEach(m => { weeklyCountsByMuscle[m] = []; });
  let observedWeeks = 0;
  for (let w = 5; w >= 0; w--) {
    const wkMonday = new Date(lastCompleteMonday); wkMonday.setUTCDate(lastCompleteMonday.getUTCDate() - w * 7);
    const wkSunday = new Date(wkMonday); wkSunday.setUTCDate(wkMonday.getUTCDate() + 6);
    const mKey = wkMonday.toISOString().slice(0, 10), sKey = wkSunday.toISOString().slice(0, 10);
    if (sessionDates.some(d => d >= mKey && d <= sKey)) observedWeeks++;
    const counts = window.GymVolumeLogic.weeklySetsByMuscle(gymState.exercises || [], gymState.logs || {}, wkMonday);
    musclesToCheck.forEach(m => { weeklyCountsByMuscle[m].push(counts[m] || 0); });
  }
  const chronicFindings = musclesToCheck.map(m => {
    const labels = weeklyCountsByMuscle[m].map(c => {
      const band = window.GymVolumeLogic.classifyMuscleVolume(m, c, phase);
      return band ? band.label : null;
    });
    const band = window.GymVolumeLogic.MUSCLE_BANDS[m];
    return window.TrainingInsightEngine.detectChronicMuscleVolume(m, labels, band, observedWeeks);
  }).filter(Boolean);
  findings.push(...chronicFindings);

  return { findings, exposuresByName, sessionDates, weeklySets };
}
```

- [ ] **Step 2: Replace the inline block in `renderReadinessPanel` with a call to the new function**

Replace weekly-review.html:706-777 (from `let findingsHtml = '';` through the `findings.push(...chronicFindings);` line) with:

```js
  let findingsHtml = '';
  let weeklyPacketMarkdown = '';
  try {
    if (window.TrainingInsightEngine && window.GymWorkoutEvents && window.WeeklyCoachPacket) {
      const nowRef = new Date();
      const built = buildInsightFindings(gymState, health, phase, nowRef);
      const findings = built.findings;
      const exposuresByName = built.exposuresByName;
      const sessionDates = built.sessionDates;
      const weeklySets = built.weeklySets;

```

(The rest of the `try` block — the trajectory `fetch` write, the `findingsHtml` build, `relatedNotes`, and `weeklyPacketMarkdown` — stays exactly as-is; it already references `findings`, `exposuresByName`, `sessionDates`, `weeklySets` by these same names, so nothing else in the block changes.)

- [ ] **Step 3: Write the cutoff-fix test**

Add to `weekly-review-closeout-evidence.test.js`, before the `run()` call at the bottom:

```js
function runBuildInsightFindingsCutoffTest(page) {
  const { buildInsightFindings } = page;

  // 4 exposures form a clear plateau (same load/reps, in-window). A 5th
  // exposure logged AFTER nowRef is a big new PR -- if buildInsightFindings
  // fails to filter it out, the plateau finding disappears (isNewHigh sees
  // the future PR as the "latest" exposure). This is the exact leak Codex
  // flagged in review (2026-08-31).
  const gymState = {
    exercises: [{ id: 'e1', name: 'Bodyweight Dip', bw: true }],
    logs: {
      e1: [
        { date: '2026-07-01T10:00:00Z', reps: 8 },
        { date: '2026-07-08T10:00:00Z', reps: 8 },
        { date: '2026-07-15T10:00:00Z', reps: 8 },
        { date: '2026-07-22T10:00:00Z', reps: 8 },
        { date: '2026-08-01T10:00:00Z', reps: 20 }, // AFTER nowRef -- must not leak in
      ],
    },
    season: {},
  };
  const nowRef = new Date('2026-07-25T00:00:00.000Z');
  const result = buildInsightFindings(gymState, null, null, nowRef);
  const stall = result.findings.find(f => f.exercise === 'Bodyweight Dip');
  assert(stall, 'plateau finding present -- future exposure correctly excluded from the trailing run');
  assertEqual(stall.type, 'stalled-load-plateau', 'finding type is stalled-load-plateau, not suppressed by the future PR');

  console.log('buildInsightFindings cutoff test: passed');
}
```

And add the call inside `run()`:

```js
async function run() {
  const page = makePage();
  runMatchInsightFindingsTests(page);
  runBuildInsightFindingsCutoffTest(page);
  console.log('weekly-review-closeout-evidence.test.js: all cases passed');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node weekly-review-closeout-evidence.test.js`
Expected: `weekly-review-closeout-evidence.test.js: all cases passed`

- [ ] **Step 5: Run the full suite to confirm the refactor didn't break anything else**

Run: `npm test`
Expected: all `PASS`, including `weekly-review-scorecard.test.js` and `weekly-review-closeout.test.js` (this refactor touches shared code those files load through the same vm sandbox).

- [ ] **Step 6: Commit**

```bash
git add weekly-review.html weekly-review-closeout-evidence.test.js
git commit -m "refactor: extract buildInsightFindings with a data-cutoff fix for past nowRef"
```

---

## Task 3: `computeCloseoutEvidence` — wire the review window

**Files:**
- Modify: `weekly-review.html` (add function near `computeScorecard`)
- Test: `weekly-review-closeout-evidence.test.js`

- [ ] **Step 1: Write the failing test**

Add to `weekly-review-closeout-evidence.test.js` (needs its own `makePage` call with fixture data, following `weekly-review-scorecard.test.js`'s pattern):

```js
async function runComputeCloseoutEvidenceTest() {
  const decisionCreatedAt = '2026-08-01T12:00:00Z'; // scoreWeek Monday = 2026-08-03, Sunday = 2026-08-09 (see weekly-review-scorecard.test.js)
  const page = makePage({
    poCoachData: {
      po_coach_v1: {
        exercises: [{ id: 'e1', name: 'Bodyweight Dip', bw: true }],
        logs: {
          e1: [
            { date: '2026-07-01T10:00:00Z', reps: 8 },
            { date: '2026-07-08T10:00:00Z', reps: 8 },
            { date: '2026-07-15T10:00:00Z', reps: 8 },
            { date: '2026-07-22T10:00:00Z', reps: 8 },
            { date: '2026-08-10T10:00:00Z', reps: 20 }, // AFTER the review week's Sunday (08-09) -- must not leak in
          ],
        },
      },
    },
  });
  const decision = {
    created_at: decisionCreatedAt,
    details: {
      muscle_groups: {},
      anchor_lifts: [{ lift: 'Bodyweight Dip', call: 'progress', guardrail: null }],
    },
  };
  const evidence = await page.computeCloseoutEvidence(decision);
  const stall = evidence.find(f => f.exercise === 'Bodyweight Dip');
  assert(stall, 'computeCloseoutEvidence returns the anchor-lift-matched plateau finding');
  assertEqual(stall.type, 'stalled-load-plateau', 'finding survives both the Sunday cutoff and the anchor_lifts relevance filter');

  console.log('computeCloseoutEvidence test: passed');
}
```

Add the call inside `run()`:

```js
async function run() {
  const page = makePage();
  runMatchInsightFindingsTests(page);
  runBuildInsightFindingsCutoffTest(page);
  await runComputeCloseoutEvidenceTest();
  console.log('weekly-review-closeout-evidence.test.js: all cases passed');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node weekly-review-closeout-evidence.test.js`
Expected: FAIL — `TypeError: page.computeCloseoutEvidence is not a function`

- [ ] **Step 3: Add `computeCloseoutEvidence` to weekly-review.html**

Immediately after `matchInsightFindings` (added in Task 1, right after `computeScorecard`), add:

```js
// Builds the measured-evidence list for a due decision's closeout: same
// review-week derivation computeScorecard() uses (decision.created_at + 7
// days, eastern-adjusted), engine anchored to that week's Sunday (not live
// "now") so a late closeout reflects what was true at the end of the
// governed week, then filtered to what's actually relevant to this
// decision via matchInsightFindings. See docs/superpowers/specs/
// 2026-08-31-decision-closeout-insight-evidence-design.md.
async function computeCloseoutEvidence(decision) {
  const scoreWeekRef = easternCalendarDate(new Date(decision.created_at));
  scoreWeekRef.setUTCDate(scoreWeekRef.getUTCDate() + 7);
  const { sunday } = weekWindow(scoreWeekRef);
  const nowRef = new Date(sunday + 'T00:00:00.000Z');

  const [gymState, health] = await Promise.all([fetchGymState(), fetchAppStateKey('health')]);
  const phase = gymState.season && gymState.season.phase;
  const built = buildInsightFindings(gymState, health, phase, nowRef);
  return matchInsightFindings(decision, built.findings);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node weekly-review-closeout-evidence.test.js`
Expected: `weekly-review-closeout-evidence.test.js: all cases passed`

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: all `PASS`

- [ ] **Step 6: Commit**

```bash
git add weekly-review.html weekly-review-closeout-evidence.test.js
git commit -m "feat: add computeCloseoutEvidence wiring the insight engine to a decision's review window"
```

---

## Task 4: Render the evidence block in the closeout UI

**Files:**
- Modify: `weekly-review.html:361-408` (`renderCloseout`)
- Test: `weekly-review-closeout-evidence.test.js`

- [ ] **Step 1: Write the failing test for the pure render function**

Add to `weekly-review-closeout-evidence.test.js`:

```js
function runRenderMeasuredEvidenceHtmlTests(page) {
  const { renderMeasuredEvidenceHtml } = page;

  assertEqual(renderMeasuredEvidenceHtml([]), '', 'empty findings -- block omitted entirely');

  const html = renderMeasuredEvidenceHtml([
    { observation: 'Bodyweight Dip: no new load/rep high across 4 exposures.', confidence: 'low', evidenceWindow: { start: '2026-07-01', end: '2026-07-22' } },
  ]);
  assert(html.includes('Measured evidence'), 'section has a Measured evidence heading');
  assert(html.includes('Bodyweight Dip: no new load/rep high across 4 exposures.'), 'finding observation text is rendered');
  assert(html.includes('low confidence'), 'confidence level is rendered');
  assert(html.includes('2026-07-01') && html.includes('2026-07-22'), 'evidence window start/end are rendered');

  console.log('renderMeasuredEvidenceHtml: all cases passed');
}
```

Add the call inside `run()`:

```js
async function run() {
  const page = makePage();
  runMatchInsightFindingsTests(page);
  runBuildInsightFindingsCutoffTest(page);
  await runComputeCloseoutEvidenceTest();
  runRenderMeasuredEvidenceHtmlTests(page);
  console.log('weekly-review-closeout-evidence.test.js: all cases passed');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node weekly-review-closeout-evidence.test.js`
Expected: FAIL — `TypeError: renderMeasuredEvidenceHtml is not a function`

- [ ] **Step 3: Add `renderMeasuredEvidenceHtml` to weekly-review.html**

Immediately after `renderScorecard` (weekly-review.html:320, right before `normalizeAnchorLifts`), add:

```js
// Flat list of a closeout's measured evidence -- each finding's own
// `observation` already names its muscle/exercise, so no per-row weaving
// into the scorecard (Codex review, 2026-08-31: also surfaces
// evidenceWindow so trailing-window findings that span more than the one
// review week don't read as "caused solely by this week").
function renderMeasuredEvidenceHtml(findings) {
  if (!findings.length) return '';
  return `<div style="margin:8px 0;">
    <p style="color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Measured evidence</p>
    ${findings.map(f => `<div style="padding:4px 0;font-size:12px;">
      <span style="color:var(--text-1);">${f.observation}</span>
      <span style="color:var(--text-3);"> (${f.confidence} confidence, ${f.evidenceWindow.start} – ${f.evidenceWindow.end})</span>
    </div>`).join('')}
  </div>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node weekly-review-closeout-evidence.test.js`
Expected: `weekly-review-closeout-evidence.test.js: all cases passed`

- [ ] **Step 5: Wire it into `renderCloseout`**

In `weekly-review.html`, `renderCloseout` (weekly-review.html:361-379) currently reads:

```js
  let scorecardHtml = '';
  let scorecard = null;
  try {
    scorecard = await computeScorecard(decision);
    scorecardHtml = renderScorecard(scorecard);
  } catch (err) {
    console.error('computeScorecard failed:', err);
    scorecardHtml = `<p style="color:var(--warn);font-size:13px;margin-bottom:12px;">Couldn't load follow-through data (connection issue) — pick a verdict from memory.</p>`;
  }
```

Add immediately after that `catch` block's closing `}`:

```js

  let evidenceBlockHtml = '';
  try {
    const evidence = await computeCloseoutEvidence(decision);
    evidenceBlockHtml = renderMeasuredEvidenceHtml(evidence);
  } catch (err) {
    console.error('computeCloseoutEvidence failed:', err);
  }
```

Then in the same function's `el.innerHTML` template (weekly-review.html:383-408), change:

```js
      ${scorecardHtml}
      ${manualVerdictRowsHtml('Anchor lifts', anchorItems)}
```

to:

```js
      ${scorecardHtml}
      ${evidenceBlockHtml}
      ${manualVerdictRowsHtml('Anchor lifts', anchorItems)}
```

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: all `PASS`

- [ ] **Step 7: Commit**

```bash
git add weekly-review.html weekly-review-closeout-evidence.test.js
git commit -m "feat: render measured evidence in the decision closeout UI"
```

---

## Task 5: Final verification and push

- [ ] **Step 1: Run the full test suite one more time**

Run: `npm test`
Expected: all tests `PASS`, ending in `N/N passed`.

- [ ] **Step 2: Self-review the diff**

Run: `git diff main --stat` and `git log --oneline main..HEAD` to see the full set of changes since branching. Confirm every file touched is one of: `weekly-review.html`, `weekly-review-closeout-evidence.test.js`, the two spec/plan docs.

- [ ] **Step 3: Claude-only inline `/code-review`**

Read the full diff (`git diff main`) directly with Read/Grep/Bash — no subagent fan-out (this is a leaf-level UI+logic change on a personal app, not a hub-node). Check specifically:
- The cutoff fix in `buildInsightFindings` is actually applied only to `exposuresByName` (not accidentally broadening scope beyond what Task 2's analysis proved necessary).
- `renderReadinessPanel`'s behavior is unchanged for the live-`now` path (the extraction is behavior-preserving there).
- No leftover unused variables from the extraction (`exercisesById` etc. should only exist inside `buildInsightFindings` now, not duplicated in `renderReadinessPanel`).

Call `ReportFindings` with the result (even if empty).

- [ ] **Step 4: Commit any review fixes, then push**

```bash
git push -u origin HEAD
```
