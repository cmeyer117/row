# Coach-Response Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "coach's response this week" record (status pill + free-text note) to `weekly-review.html`'s existing closeout flow, per the approved spec at `docs/superpowers/specs/2026-08-22-coach-response-closeout-design.md`.

**Architecture:** A pure helper function `buildCoachResponse(status, note)` decides whether to include a `coach_response` key in the saved `decision.details` (null when both fields are blank, `{status, note}` otherwise). It's wired into two spots in `renderCloseout()`'s existing template/handler: a new optional UI block (status `<select>` + `<textarea>`), and the existing `closeoutSave` click handler's details-merge logic. No new table, no migration, no new page.

**Tech Stack:** Plain HTML/JS (no framework), Node's built-in `vm` module for testing classic (non-module) `<script>` code, this repo's no-framework `*.test.js` convention (`node scripts/run-tests.mjs` discovers and runs them).

---

### Task 1: `buildCoachResponse()` pure function + test

**Files:**
- Modify: `C:\Users\gregm\row\weekly-review.html:232-236` (insert new function after `hasRx()`)
- Create: `C:\Users\gregm\row\weekly-review-closeout.test.js`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\gregm\row\weekly-review-closeout.test.js`:

```js
// weekly-review.html's inline <script> is loaded as a classic (non-module)
// tag, so it can't be imported -- same vm-sandbox extraction pattern as
// weekly-review-scorecard.test.js. Tests buildCoachResponse() in isolation:
// a pure function with no DOM/fetch dependency, so no fixture stubs needed.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const pageSource = readFileSync(new URL('./weekly-review.html', import.meta.url), 'utf8');

const scriptMatch = pageSource.match(/<script>\r?\n(const MUSCLES[\s\S]*?)\r?\n<\/script>/);
if (!scriptMatch) {
  console.error('FAIL: could not find weekly-review.html\'s inline <script> block -- page structure changed');
  process.exit(1);
}
const pageScriptSource = scriptMatch[1];

function loadPage() {
  const sandbox = {
    window: {},
    document: { addEventListener: () => {}, getElementById: () => null },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve([]) }),
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
  // GymVolumeLogic isn't needed for buildCoachResponse, but the page script
  // references `window.GymVolumeLogic.MUSCLE_BANDS` at its top level (the
  // MUSCLES constant) -- stub just enough for the script to load without
  // throwing.
  sandbox.window.GymVolumeLogic = { MUSCLE_BANDS: {} };
  vm.runInContext(pageScriptSource, sandbox);
  return sandbox.buildCoachResponse;
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

function run() {
  const buildCoachResponse = loadPage();

  assertEqual(buildCoachResponse('', ''), null, 'both blank -- omitted entirely (null)');
  assertEqual(buildCoachResponse('', '   '), null, 'whitespace-only note with no status -- still omitted');
  assertEqual(
    buildCoachResponse('approved', ''),
    { status: 'approved', note: null },
    'status only -- included, note is null not empty string'
  );
  assertEqual(
    buildCoachResponse('', 'said to hold volume flat'),
    { status: null, note: 'said to hold volume flat' },
    'note only -- included, status is null'
  );
  assertEqual(
    buildCoachResponse('modified', '  add 2g protein/day  '),
    { status: 'modified', note: 'add 2g protein/day' },
    'both filled -- included, note trimmed'
  );

  console.log('weekly-review-closeout.test.js: all cases passed');
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "C:/Users/gregm/row" && node weekly-review-closeout.test.js
```
Expected: `FAIL` — a `TypeError: buildCoachResponse is not a function`, since `buildCoachResponse` doesn't exist in `weekly-review.html` yet.

- [ ] **Step 3: Write minimal implementation**

In `C:\Users\gregm\row\weekly-review.html`, immediately after the existing `hasRx()` function (currently lines 232-236, ending `}`), insert:

```js
// Builds the optional coach_response detail entry for a closeout save --
// null (omitted from details entirely) when both fields are blank, so an
// old decision closed out before this feature shipped and a new one with
// no coach check-in that week look identical (no dangling empty object).
function buildCoachResponse(status, note) {
  const trimmedNote = (note || '').trim();
  if (!status && !trimmedNote) return null;
  return { status: status || null, note: trimmedNote || null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd "C:/Users/gregm/row" && node weekly-review-closeout.test.js
```
Expected: `weekly-review-closeout.test.js: all cases passed`

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/gregm/row"
git add weekly-review.html weekly-review-closeout.test.js
git commit -m "feat(weekly-review): add buildCoachResponse pure function"
```

---

### Task 2: Wire the UI and closeoutSave handler

**Files:**
- Modify: `C:\Users\gregm\row\weekly-review.html:372-388` (closeout template)
- Modify: `C:\Users\gregm\row\weekly-review.html:389-407` (`closeoutSave` click handler)

- [ ] **Step 1: Add the UI block to the closeout template**

In `renderCloseout()`, the current template (around line 372) reads:

```js
  el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;">
      <p style="color:var(--text-2);font-size:13px;">Close out last week's decision before starting a new one:</p>
      <p style="color:var(--text-1);font-size:14px;margin:8px 0;">${decision.decision_text}</p>
      ${scorecardHtml}
      ${manualVerdictRowsHtml('Anchor lifts', anchorItems)}
      ${manualVerdictRowsHtml('Pain / recovery', painItems)}
      <select id="verdictSelect" style="width:100%;padding:8px;margin-bottom:8px;">
        <option value="">Verdict...</option>
        <option value="worked">Worked</option>
        <option value="partly_worked">Partly worked</option>
        <option value="wrong">Wrong</option>
        <option value="inconclusive">Inconclusive</option>
      </select>
      <textarea id="outcomeNote" placeholder="What actually happened?" style="width:100%;padding:8px;min-height:60px;margin-bottom:8px;"></textarea>
      <button id="closeoutSave" style="padding:10px 16px;">Save & Continue</button>
    </div>`;
```

Replace it with (inserting the new block directly before `<select id="verdictSelect"`):

```js
  el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;">
      <p style="color:var(--text-2);font-size:13px;">Close out last week's decision before starting a new one:</p>
      <p style="color:var(--text-1);font-size:14px;margin:8px 0;">${decision.decision_text}</p>
      ${scorecardHtml}
      ${manualVerdictRowsHtml('Anchor lifts', anchorItems)}
      ${manualVerdictRowsHtml('Pain / recovery', painItems)}
      <p style="color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:12px 0 4px;">Coach's response this week (optional)</p>
      <select id="coachStatusSelect" style="width:100%;padding:8px;margin-bottom:6px;">
        <option value="">No status...</option>
        <option value="approved">Approved</option>
        <option value="modified">Modified</option>
        <option value="hold">Hold</option>
        <option value="needs_more_data">Needs more data</option>
      </select>
      <textarea id="coachNoteText" placeholder="What did your coach actually say?" style="width:100%;padding:8px;min-height:50px;margin-bottom:8px;"></textarea>
      <select id="verdictSelect" style="width:100%;padding:8px;margin-bottom:8px;">
        <option value="">Verdict...</option>
        <option value="worked">Worked</option>
        <option value="partly_worked">Partly worked</option>
        <option value="wrong">Wrong</option>
        <option value="inconclusive">Inconclusive</option>
      </select>
      <textarea id="outcomeNote" placeholder="What actually happened?" style="width:100%;padding:8px;min-height:60px;margin-bottom:8px;"></textarea>
      <button id="closeoutSave" style="padding:10px 16px;">Save & Continue</button>
    </div>`;
```

- [ ] **Step 2: Wire `closeoutSave` to include/omit `coach_response`**

The current handler (immediately below the template) reads:

```js
  document.getElementById('closeoutSave').onclick = async () => {
    const verdict = document.getElementById('verdictSelect').value;
    if (!verdict) { alert('Pick a verdict first.'); return; }
    const manualSelects = Array.from(document.querySelectorAll('.manualVerdict'));
    if (manualSelects.some(sel => !sel.value)) { alert('Pick a verdict for every anchor-lift/pain entry.'); return; }
    const note = document.getElementById('outcomeNote').value;

    const details = JSON.parse(JSON.stringify(decision.details || {}));
    manualSelects.forEach(sel => {
      const [field, idx] = sel.dataset.key.split('.');
      if (details[field] && details[field][idx]) details[field][idx].verdict = sel.value;
    });
    if (scorecard && scorecard.cardioRx.verdict && details.cardio_rx) details.cardio_rx.verdict = scorecard.cardioRx.verdict;
    if (scorecard && scorecard.posingRx.verdict && details.posing_rx) details.posing_rx.verdict = scorecard.posingRx.verdict;

    await window.closeDecision(decision.id, verdict, note, details);
    el.style.display = 'none';
    await renderNewDecisionForm();
  };
```

Replace it with (adding the `coach_response` merge right after the cardio/posing verdict lines, before the `closeDecision` call):

```js
  document.getElementById('closeoutSave').onclick = async () => {
    const verdict = document.getElementById('verdictSelect').value;
    if (!verdict) { alert('Pick a verdict first.'); return; }
    const manualSelects = Array.from(document.querySelectorAll('.manualVerdict'));
    if (manualSelects.some(sel => !sel.value)) { alert('Pick a verdict for every anchor-lift/pain entry.'); return; }
    const note = document.getElementById('outcomeNote').value;

    const details = JSON.parse(JSON.stringify(decision.details || {}));
    manualSelects.forEach(sel => {
      const [field, idx] = sel.dataset.key.split('.');
      if (details[field] && details[field][idx]) details[field][idx].verdict = sel.value;
    });
    if (scorecard && scorecard.cardioRx.verdict && details.cardio_rx) details.cardio_rx.verdict = scorecard.cardioRx.verdict;
    if (scorecard && scorecard.posingRx.verdict && details.posing_rx) details.posing_rx.verdict = scorecard.posingRx.verdict;

    const coachResponse = buildCoachResponse(document.getElementById('coachStatusSelect').value, document.getElementById('coachNoteText').value);
    if (coachResponse) details.coach_response = coachResponse;
    else delete details.coach_response;

    await window.closeDecision(decision.id, verdict, note, details);
    el.style.display = 'none';
    await renderNewDecisionForm();
  };
```

- [ ] **Step 3: Run the full test suite**

Run:
```bash
cd "C:/Users/gregm/row" && npm test
```
Expected: all tests pass (54/54 — 53 existing + `weekly-review-closeout.test.js` from Task 1), no regressions. This step is a static-correctness check (does the file still parse/run); it does not exercise the new UI block or click handler directly, since those require a real DOM. See Task 3 for that.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/gregm/row"
git add weekly-review.html
git commit -m "feat(weekly-review): wire coach-response fields into the closeout flow"
```

---

### Task 3: Live browser verification

**Files:** none (manual verification, no code changes)

- [ ] **Step 1: Open the deployed app and reach the closeout screen**

Navigate to `https://row-sage.vercel.app/weekly-review.html` (sign in), with an open/due decision from a prior week (if none exists, save a new decision first, then revisit the page after its `review_date` — or temporarily edit a test row's `review_date` in Supabase to force the closeout view, then revert).

- [ ] **Step 2: Confirm the new fields render and save correctly**

Check:
- The "Coach's response this week (optional)" status `<select>` and textarea appear between the manual-verdict rows and the main verdict `<select>`.
- Leaving both fields blank and saving a closeout does NOT add a `coach_response` key to the decision's `details` in Supabase (query `decisions` table, confirm the row's `details` has no `coach_response` key).
- Filling in a status + note and saving DOES persist `details.coach_response = {status, note}` correctly (same query, confirm the values match what was entered).

- [ ] **Step 3: Report back**

Confirm to Carl whether both cases (blank / filled) behaved as expected, or note what broke.

---

## Plan Self-Review

**Spec coverage:**
- Data model (`details.coach_response = {status, note}`, both optional, no migration) — Task 1 (`buildCoachResponse`) + Task 2 Step 2 (merge into `details`).
- UI (status select + textarea, placed after manual-verdict rows and before the verdict select) — Task 2 Step 1.
- Saved via the same `closeoutSave` handler / `window.closeDecision` call, no new save path — Task 2 Step 2.
- No display surface beyond the closeout card — not built, per spec's explicit non-goal.
- No "hold" lifecycle state / no forward-linkage into next week's Rx — not built, per spec's explicit non-goals.
- Testing — Task 1's `weekly-review-closeout.test.js` covers `buildCoachResponse`'s blank/status-only/note-only/both-filled/whitespace cases. Task 3 covers the DOM-level save/omit behavior the pure-function test can't reach (per the spec's own testing note, this repo has no jsdom — a full DOM harness was already ruled out as disproportionate for this page in the 2026-08-22 session).

No gaps found.
