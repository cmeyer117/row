# Coaching Client Logging & Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clients log real sets and weekly bodyweight against their coaching plan, driving the same `getRx()` progression logic and `calculateMacros()` diet targets Row already uses for Carl himself — no client accounts, no new tracking app.

**Architecture:** Two new Supabase tables (`coaching_client_logs`, `coaching_client_weights`) + 4 new nullable columns on `coaching_clients`. Two new pure, dependency-free JS modules (`coaching-exercise-meta.js`, `coaching-diet-trend.js`) matching this repo's existing dual-export/`.selfcheck.js` convention. One new client-facing page (`coaching-log.html`, no auth — reached via `?id=<client.id>`, same trust level as the existing issued-plan link). `coaching-plan.html` and `coaching.html` get extended, not rewritten.

**Tech Stack:** Vanilla HTML/JS, Supabase (shared `vikpcejlyxieguorwysf.supabase.co` project, anon publishable key `sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv`), no build step, no test runner (plain `node` self-check scripts).

---

### Task 1: Supabase migration

**Files:** none (Supabase schema change via MCP tool)

- [ ] **Step 1: Apply the migration**

Call the `apply_migration` tool (project_id `vikpcejlyxieguorwysf`, name `coaching_client_logging`) with:

```sql
create table coaching_client_logs (
  id bigint generated always as identity primary key,
  client_id uuid not null references coaching_clients(id),
  exercise_name text not null,
  weight numeric not null,
  reps integer not null,
  is_bodyweight boolean not null default false,
  created_at timestamptz not null default now()
);

create table coaching_client_weights (
  id bigint generated always as identity primary key,
  client_id uuid not null references coaching_clients(id),
  weight numeric not null,
  logged_at date not null default current_date
);

alter table coaching_clients
  add column sex text,
  add column age integer,
  add column height_in numeric,
  add column weight_lb numeric;
```

- [ ] **Step 2: Verify**

Run `execute_sql` (same project_id): `select table_name from information_schema.tables where table_name in ('coaching_client_logs', 'coaching_client_weights');`
Expected: both rows returned.

Run `execute_sql`: `select column_name from information_schema.columns where table_name = 'coaching_clients' and column_name in ('sex','age','height_in','weight_lb');`
Expected: all 4 rows returned.

- [ ] **Step 3: Commit**

No file changes — nothing to commit for this task (schema lives in Supabase, not git).

---

### Task 2: `coaching-exercise-meta.js` — exercise metadata lookup

**Files:**
- Create: `coaching-exercise-meta.js`
- Create: `coaching-exercise-meta.selfcheck.js`

- [ ] **Step 1: Write the module**

```js
// coaching-exercise-meta.js — exercise name -> {repMin, repMax, step, bw}
// lookup for coaching-log.html/coaching-plan.html's getRx() calls. Values
// for every name below are copied from gym.html's defaultExercises (Carl's
// own tracked lifts) where the name matches a coaching-templates.js
// exercise exactly. Names with no match use DEFAULT_META — correctable by
// hand later if visibly wrong for a specific lift. Dual export like
// gym-workout-events.js so this loads as a plain <script> and self-checks
// with plain `node`.
(function () {
  'use strict';

  const DEFAULT_META = { repMin: 8, repMax: 12, step: 5, bw: false };

  const META = {
    'Neutral Grip Shoulder Press Machine': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Smith Machine Flat Chest Press': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Incline Cable Pec Fly': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Dumbbell Lateral Raise': { repMin: 8, repMax: 16, step: 2.5, bw: false },
    'Cable Front Raise': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Cable Triceps Overhead Extension': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Lat Pulldown': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Cable Seated Row (Neutral Grip)': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Machine High Row': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Machine Low Row': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Cable Lat Pushdown Pullover': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Cable Rear Delt Fly': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Seated Behind-the-Back Cable Curl': { repMin: 8, repMax: 16, step: 2.5, bw: false },
    'Hack Squat': { repMin: 4, repMax: 8, step: 10, bw: false },
    'Seated Hamstrings Curl': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Dumbbell Incline Chest Press': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Chest Supported T-Bar Row': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Smith Machine Narrow Grip Bench': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Neutral Grip Lat Pulldown': { repMin: 4, repMax: 8, step: 5, bw: false },
    'Low Cable Lateral Raise': { repMin: 8, repMax: 16, step: 2.5, bw: false },
    'Dumbbell Front Raise': { repMin: 8, repMax: 16, step: 2.5, bw: false },
    'Machine Preacher Curl': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Cable Triceps Pushdown': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Smith Machine RDL': { repMin: 4, repMax: 8, step: 10, bw: false },
    'Lying Hamstrings Curl': { repMin: 8, repMax: 12, step: 5, bw: false },
    'Cybex Leg Press': { repMin: 8, repMax: 12, step: 10, bw: false },
    'Dumbbell Heel Elevated Lunge': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Leg Extension': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Seated Calf Raise': { repMin: 8, repMax: 16, step: 5, bw: false },
    'Standing Calf Raise': { repMin: 8, repMax: 16, step: 5, bw: false },
  };

  // Isometric/hold exercises don't fit a weight x reps log at all —
  // coaching-log.html checks this list and skips rendering a log input
  // for them (shown as plan-only text instead).
  const NOT_LOGGABLE = ['Plank'];

  function getMeta(exerciseName) {
    return META[exerciseName] || Object.assign({}, DEFAULT_META);
  }

  function isLoggable(exerciseName) {
    return NOT_LOGGABLE.indexOf(exerciseName) === -1;
  }

  const api = { getMeta: getMeta, isLoggable: isLoggable, NOT_LOGGABLE: NOT_LOGGABLE };
  if (typeof window !== 'undefined') window.CoachingExerciseMeta = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 2: Write the self-check**

```js
// Run with: node coaching-exercise-meta.selfcheck.js
'use strict';

const { getMeta, isLoggable } = require('./coaching-exercise-meta.js');

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

assertEqual(getMeta('Hack Squat'), { repMin: 4, repMax: 8, step: 10, bw: false }, 'known exercise returns real Row values');
assertEqual(getMeta('Goblet Squat'), { repMin: 8, repMax: 12, step: 5, bw: false }, 'unknown exercise returns the default');
assertEqual(isLoggable('Hack Squat'), true, 'a normal exercise is loggable');
assertEqual(isLoggable('Plank'), false, 'Plank is excluded from logging');

console.log('coaching-exercise-meta.selfcheck.js: all assertions passed');
```

- [ ] **Step 3: Run the self-check**

Run: `node coaching-exercise-meta.selfcheck.js`
Expected: `coaching-exercise-meta.selfcheck.js: all assertions passed`

- [ ] **Step 4: Commit**

```bash
git add coaching-exercise-meta.js coaching-exercise-meta.selfcheck.js
git commit -m "feat: coaching exercise metadata lookup for progression"
```

---

### Task 3: `coaching-diet-trend.js` — weight-trend calorie suggestion

**Files:**
- Create: `coaching-diet-trend.js`
- Create: `coaching-diet-trend.selfcheck.js`

- [ ] **Step 1: Write the module**

```js
// coaching-diet-trend.js — compares a client's logged bodyweight trend
// against their stated goal and suggests a calorie adjustment, matching
// the "+/-10% based on 2-week trend" language already written into
// coaching-templates.js's advanced-stage advice. Pure function, no
// Supabase/DOM here — same dual-export style as macro-calc.js.
(function () {
  'use strict';

  // goal: 'cut' | 'bulk' | 'recomp' | 'contest-prep'
  // weightLogs: array of { weight, logged_at }, any order — sorted internally.
  // Returns { direction: 'increase'|'decrease', pct: 10 } or null if there's
  // not enough data (fewer than 2 points) or the goal has no expected
  // direction (recomp/contest-prep are expected to hold roughly flat, so
  // this never suggests an adjustment for them).
  function suggestCalorieAdjustment(goal, weightLogs) {
    if (!weightLogs || weightLogs.length < 2) return null;
    if (goal !== 'cut' && goal !== 'bulk') return null;

    const sorted = weightLogs.slice().sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
    const first = sorted[0].weight;
    const last = sorted[sorted.length - 1].weight;
    const delta = last - first;

    if (goal === 'cut' && delta >= 0) {
      return { direction: 'decrease', pct: 10, reason: 'Weight hasn\'t trended down (' + first + ' -> ' + last + ') — drop calories ~10%.' };
    }
    if (goal === 'bulk' && delta <= 0) {
      return { direction: 'increase', pct: 10, reason: 'Weight hasn\'t trended up (' + first + ' -> ' + last + ') — add calories ~10%.' };
    }
    return null;
  }

  const api = { suggestCalorieAdjustment: suggestCalorieAdjustment };
  if (typeof window !== 'undefined') window.CoachingDietTrend = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 2: Write the self-check**

```js
// Run with: node coaching-diet-trend.selfcheck.js
'use strict';

const { suggestCalorieAdjustment } = require('./coaching-diet-trend.js');

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

assertEqual(suggestCalorieAdjustment('cut', []), null, 'no logs returns null');
assertEqual(suggestCalorieAdjustment('cut', [{ weight: 200, logged_at: '2026-07-01' }]), null, 'one log returns null');
assertEqual(
  suggestCalorieAdjustment('cut', [{ weight: 200, logged_at: '2026-07-01' }, { weight: 200, logged_at: '2026-07-15' }]).direction,
  'decrease',
  'flat weight on a cut suggests a decrease'
);
assertEqual(
  suggestCalorieAdjustment('cut', [{ weight: 200, logged_at: '2026-07-01' }, { weight: 195, logged_at: '2026-07-15' }]),
  null,
  'weight trending down on a cut suggests nothing'
);
assertEqual(
  suggestCalorieAdjustment('bulk', [{ weight: 180, logged_at: '2026-07-01' }, { weight: 180, logged_at: '2026-07-15' }]).direction,
  'increase',
  'flat weight on a bulk suggests an increase'
);
assertEqual(suggestCalorieAdjustment('recomp', [{ weight: 180, logged_at: '2026-07-01' }, { weight: 180, logged_at: '2026-07-15' }]), null, 'recomp never suggests an adjustment');

console.log('coaching-diet-trend.selfcheck.js: all assertions passed');
```

- [ ] **Step 3: Run the self-check**

Run: `node coaching-diet-trend.selfcheck.js`
Expected: `coaching-diet-trend.selfcheck.js: all assertions passed`

- [ ] **Step 4: Commit**

```bash
git add coaching-diet-trend.js coaching-diet-trend.selfcheck.js
git commit -m "feat: weight-trend calorie adjustment suggestion"
```

---

### Task 4: `coaching.html` — capture sex/age/height/weight at intake

**Files:**
- Modify: `coaching.html:64-82` (intake form card), `coaching.html:147-169` (submit handler)

- [ ] **Step 1: Add the 4 fields to the intake form**

In `coaching.html`, immediately after the existing `.row2` block for Equipment/Training days (after line 69, before the Session length field), insert:

```html
<div class="row2">
  <div class="field"><label>Sex</label>
    <select id="cSex"><option value="male">Male</option><option value="female">Female</option></select>
  </div>
  <div class="field"><label>Age</label><input id="cAge" type="number" min="13" max="100" value="30"></div>
</div>
<div class="row2">
  <div class="field"><label>Height (inches)</label><input id="cHeight" type="number" min="48" max="96" value="68"></div>
  <div class="field"><label>Weight (lb)</label><input id="cWeight" type="number" min="60" max="600" value="180"></div>
</div>
```

- [ ] **Step 2: Read and validate the new fields in the submit handler**

In the `addClientBtn` click handler, after the existing `intake` object literal (after `injuryFlags: ...` line, before the `isNaN(intake.trainingDaysPerWeek...)` validation block), add:

```js
    intake.sex = document.getElementById('cSex').value;
    intake.age = parseInt(document.getElementById('cAge').value, 10);
    intake.heightIn = parseInt(document.getElementById('cHeight').value, 10);
    intake.weightLb = parseInt(document.getElementById('cWeight').value, 10);
```

And after the existing session-length validation (`if (isNaN(intake.sessionLength)...)`), add:

```js
    if (isNaN(intake.age) || intake.age < 13 || intake.age > 100) { statusEl.textContent = 'Age must be 13-100.'; btn.disabled = false; return; }
    if (isNaN(intake.heightIn) || intake.heightIn <= 0) { statusEl.textContent = 'Height must be greater than 0.'; btn.disabled = false; return; }
    if (isNaN(intake.weightLb) || intake.weightLb <= 0) { statusEl.textContent = 'Weight must be greater than 0.'; btn.disabled = false; return; }
```

- [ ] **Step 3: Include the new fields in the Supabase insert**

In the `supa.from('coaching_clients').insert({...})` call, add these keys alongside the existing ones:

```js
      sex: intake.sex,
      age: intake.age,
      height_in: intake.heightIn,
      weight_lb: intake.weightLb,
```

- [ ] **Step 4: Manual verification**

Open `coaching.html` in a browser, fill the form (including the 4 new fields), submit. Confirm it redirects to `coaching-plan.html?id=...` with no console errors, and confirm via `execute_sql` (`select sex, age, height_in, weight_lb from coaching_clients order by created_at desc limit 1;`) that the new row has real values, not nulls.

- [ ] **Step 5: Commit**

```bash
git add coaching.html
git commit -m "feat: capture sex/age/height/weight at coaching intake"
```

---

### Task 5: `coaching-log.html` — new client-facing log page

**Files:**
- Create: `coaching-log.html`

- [ ] **Step 1: Write the page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Log — Coaching</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="coaching-templates.js"></script>
<script src="coaching-exercise-meta.js"></script>
<style>
:root { --text-primary: #F4F1EA; --text-secondary: #B8B6B0; --text-tertiary: #76746E; --accent: #6EE7B7; --font: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; --font-serif: 'Instrument Serif', Georgia, serif; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #000; color: var(--text-secondary); font-family: var(--font); }
body { padding: max(28px, env(safe-area-inset-top)) 20px 60px; }
.page { max-width: 560px; margin: 0 auto; }
.title { font-family: var(--font-serif); font-size: 26px; font-style: italic; color: var(--text-primary); margin-bottom: 18px; }
.card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 16px; margin-bottom: 14px; }
.day-btn { padding: 9px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: var(--text-secondary); font-family: inherit; font-size: 13px; margin: 0 6px 6px 0; cursor: pointer; }
.day-btn.active { background: var(--accent); color: #052e16; border-color: var(--accent); font-weight: 700; }
.ex-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
.ex-name { flex: 1; color: var(--text-primary); font-size: 14px; }
.ex-input { width: 60px; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.28); color: var(--text-primary); font-family: inherit; }
.btn { padding: 8px 14px; border: 0; border-radius: 10px; background: linear-gradient(135deg, #6EE7B7 0%, #34D399 100%); color: #052e16; font-family: inherit; font-weight: 700; cursor: pointer; font-size: 12px; }
.status { font-size: 11px; color: var(--text-tertiary); margin-top: 6px; }
</style>
</head>
<body>
<div class="page">
  <div class="title" id="clientTitle">Loading…</div>

  <div class="card" id="dayCard" style="display:none;">
    <div id="dayButtons"></div>
  </div>

  <div class="card" id="exCard" style="display:none;">
    <div id="exList"></div>
  </div>

  <div class="card">
    <label style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">This week's weight (lb)</label>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <input id="weightInput" class="ex-input" type="number" style="flex:1;">
      <button type="button" class="btn" id="saveWeightBtn">Save</button>
    </div>
    <div class="status" id="weightStatus"></div>
  </div>
</div>

<script>
(function () {
  'use strict';
  const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
  const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const clientId = new URLSearchParams(window.location.search).get('id');
  let plan = null;

  function startOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // back up to Monday
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function renderDay(dayIndex) {
    document.querySelectorAll('.day-btn').forEach((b, i) => b.classList.toggle('active', i === dayIndex));
    const day = plan.training.days[dayIndex];
    const exListEl = document.getElementById('exList');
    exListEl.innerHTML = '';
    document.getElementById('exCard').style.display = 'block';
    day.exercises.forEach((exName) => {
      if (!window.CoachingExerciseMeta.isLoggable(exName)) return;
      const row = document.createElement('div');
      row.className = 'ex-row';
      row.innerHTML =
        '<div class="ex-name">' + window.CoachingTemplates.escapeHtml(exName) + '</div>' +
        '<input class="ex-input" type="number" placeholder="lb" data-ex="' + window.CoachingTemplates.escapeHtml(exName) + '" data-field="weight">' +
        '<input class="ex-input" type="number" placeholder="reps" data-ex="' + window.CoachingTemplates.escapeHtml(exName) + '" data-field="reps">' +
        '<button type="button" class="btn log-btn" data-ex="' + window.CoachingTemplates.escapeHtml(exName) + '">Log</button>';
      exListEl.appendChild(row);
    });
    exListEl.querySelectorAll('.log-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const exName = btn.dataset.ex;
        const weightEl = exListEl.querySelector('[data-ex="' + CSS.escape(exName) + '"][data-field="weight"]');
        const repsEl = exListEl.querySelector('[data-ex="' + CSS.escape(exName) + '"][data-field="reps"]');
        const weight = Number(weightEl.value);
        const reps = parseInt(repsEl.value, 10);
        if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps <= 0) return;
        btn.disabled = true;
        const meta = window.CoachingExerciseMeta.getMeta(exName);
        const { error } = await supa.from('coaching_client_logs').insert({
          client_id: clientId, exercise_name: exName, weight: weight, reps: reps, is_bodyweight: meta.bw
        });
        btn.textContent = error ? 'Failed' : 'Logged';
        if (!error) { weightEl.value = ''; repsEl.value = ''; }
        btn.disabled = false;
      });
    });
  }

  async function load() {
    if (!clientId) { document.getElementById('clientTitle').textContent = 'No client ID given'; return; }
    const { data, error } = await supa.from('coaching_clients').select('*').eq('id', clientId).single();
    if (error || !data) { document.getElementById('clientTitle').textContent = 'Client not found'; return; }
    document.getElementById('clientTitle').textContent = data.name;
    const intake = {
      stage: data.stage, goal: data.goal, equipment: data.equipment,
      trainingDaysPerWeek: data.training_days_per_week, sessionLength: data.session_length,
      injuryFlags: data.injury_flags || []
    };
    plan = window.CoachingTemplates.assemblePlan(intake);
    const dayButtonsEl = document.getElementById('dayButtons');
    document.getElementById('dayCard').style.display = 'block';
    plan.training.days.forEach((d, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'day-btn';
      b.textContent = d.name;
      b.addEventListener('click', () => renderDay(i));
      dayButtonsEl.appendChild(b);
    });
    renderDay(0);
  }

  document.getElementById('saveWeightBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('weightStatus');
    const weight = Number(document.getElementById('weightInput').value);
    if (!Number.isFinite(weight) || weight <= 0) { statusEl.textContent = 'Enter a valid weight.'; return; }
    const weekStart = startOfWeek(new Date()).toISOString().slice(0, 10);
    const { data: existing } = await supa.from('coaching_client_weights')
      .select('id').eq('client_id', clientId).gte('logged_at', weekStart).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    const result = existing
      ? await supa.from('coaching_client_weights').update({ weight: weight, logged_at: today }).eq('id', existing.id)
      : await supa.from('coaching_client_weights').insert({ client_id: clientId, weight: weight, logged_at: today });
    statusEl.textContent = result.error ? 'Save failed: ' + result.error.message : 'Saved.';
  });

  load();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Manual verification**

Create a test client via `coaching.html` (or reuse the one from Task 4's verification), open `coaching-log.html?id=<that client's id>`. Confirm: the day buttons render, clicking a day shows its exercises (Plank, if present in that stage's template, must NOT show a log row), logging a set succeeds (button flips to "Logged"), and confirm via `execute_sql` that the row landed in `coaching_client_logs`. Save a weight, confirm one row in `coaching_client_weights`; save a second weight the same week, confirm it updated the same row rather than adding a second one.

- [ ] **Step 3: Commit**

```bash
git add coaching-log.html
git commit -m "feat: client-facing set + weekly weight logging page"
```

---

### Task 6: `coaching-plan.html` — training progression display

**Files:**
- Modify: `coaching-plan.html:9` (add script tags), `coaching-plan.html:94-123` (`renderPlan`), `coaching-plan.html:125-139` (`load`)

- [ ] **Step 1: Add the new script includes**

After the existing `<script src="coaching-templates.js"></script>` line, add:

```html
<script src="coaching-exercise-meta.js"></script>
```

- [ ] **Step 2: Add `getRx`/`estimate1RM`/`roundToStep` as local pure functions**

Inside the existing `(function () { 'use strict'; ...` IIFE, before `function renderPlan`, add (copied from `gym.html`'s `getRx`, `estimate1RM`, `roundToStep` — `unit()` replaced with the literal `'lb'` since this page has no unit-toggle state):

```js
  function estimate1RM(w, r) { if (r < 2) return w; return w * (1 + r / 30); }
  function roundToStep(v, s) { return Math.round(v / s) * s; }

  function getRx(ex, logs) {
    if (!logs.length) return null;
    const last = logs[logs.length - 1];
    const { weight, reps } = last;
    const { repMin, repMax, step, bw } = ex;
    const upgradeAt = Math.min(8, repMax);
    let stuck = 0;
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].weight === weight) stuck++; else break;
    }
    if (bw) {
      if (reps >= upgradeAt) return { type: 'up', weight: 0, reps: reps + 1, tag: 'Push for more', reason: reps + ' reps — strong. Push for ' + (reps + 1) + ' next time.', bw: true };
      if (reps >= repMin) return { type: 'hold', weight: 0, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps. Push for ' + (reps + 1) + ' next session.', bw: true };
      return { type: 'hold', weight: 0, reps: repMin, tag: 'Repeat', reason: reps + ' reps fell short. Repeat until you hit ' + repMin + '+.', bw: true };
    }
    if (stuck >= 3 && reps < repMin) {
      const dl = roundToStep(weight * 0.9, step);
      return { type: 'down', weight: dl, reps: repMax, tag: 'Deload', reason: 'Stuck at ' + weight + 'lb for ' + stuck + ' sessions. Drop 10%, reset, build back cleaner.' };
    }
    if (reps >= upgradeAt) return { type: 'up', weight: weight + step, reps: repMin, tag: 'Add weight', reason: 'Hit ' + reps + ' reps — time to add ' + step + 'lb. Expect ' + repMin + '-' + (repMin + 1) + ' next session.' };
    if (reps >= repMin && reps < upgradeAt) return { type: 'hold', weight: weight, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps in target. Stay at ' + weight + 'lb, push for ' + (reps + 1) + '.' };
    return { type: 'hold', weight: weight, reps: repMin, tag: 'Repeat', reason: reps + ' reps short of ' + repMin + '-' + upgradeAt + '. Repeat ' + weight + 'lb until you hit ' + repMin + '+ clean.' };
  }

  async function getClientLogs(clientIdArg, exerciseName) {
    const { data, error } = await supa.from('coaching_client_logs')
      .select('weight, reps').eq('client_id', clientIdArg).eq('exercise_name', exerciseName)
      .order('created_at', { ascending: true });
    return (error || !data) ? [] : data;
  }
```

- [ ] **Step 3: Render progression per exercise**

In `renderPlan`, replace the existing `plan.training.days.forEach(...)` block with a version that appends a progression line per exercise (still synchronous rendering of names first, then fills in progression once logs resolve — avoids blocking the initial render on N network calls):

```js
    daysEl.innerHTML = '';
    plan.training.days.forEach((d) => {
      const div = document.createElement('div');
      div.className = 'day-block';
      div.innerHTML = '<h3>' + d.name + '</h3><ul>' + d.exercises.map((e) =>
        '<li>' + e + ' <span class="rx" data-ex="' + window.CoachingTemplates.escapeHtml(e) + '" style="color:var(--accent);font-size:12px;"></span></li>'
      ).join('') + '</ul>';
      daysEl.appendChild(div);
    });
    daysEl.querySelectorAll('.rx').forEach(async (span) => {
      const exName = span.dataset.ex;
      if (!window.CoachingExerciseMeta.isLoggable(exName)) return;
      const logs = await getClientLogs(client.id, exName);
      if (!logs.length) return;
      const rx = getRx(window.CoachingExerciseMeta.getMeta(exName), logs);
      if (rx) span.textContent = ' — NEXT: ' + (rx.bw ? rx.reps + ' reps' : rx.weight + 'lb x ' + rx.reps) + ' (' + rx.tag + ')';
    });
```

- [ ] **Step 4: Manual verification**

Open `coaching-plan.html?id=<client with logs from Task 5's verification>`. Confirm the exercise you logged a set for shows a green "NEXT: ..." hint matching what `getRx()` would compute for that weight/reps, and exercises with no logs show nothing extra (no crash, no "undefined").

- [ ] **Step 5: Commit**

```bash
git add coaching-plan.html
git commit -m "feat: getRx-driven progression hints on the coach plan view"
```

---

### Task 7: `coaching-plan.html` — real diet numbers + trend suggestion

**Files:**
- Modify: `coaching-plan.html:9` (script tags), `coaching-plan.html:94-123` (`renderPlan`), `coaching-plan.html:125-139` (`load`)

- [ ] **Step 1: Add the remaining script includes**

After `coaching-exercise-meta.js` (added in Task 6), add — this repo is flat (no subfolders), so `macro-calc.js` is a same-directory sibling like every other script tag in this file:

```html
<script src="macro-calc.js"></script>
<script src="coaching-diet-trend.js"></script>
```

- [ ] **Step 2: Compute real diet numbers in `load()`**

In `load()`, after `const intake = {...}` and before `const plan = ...`, add the activity-level mapping and fetch the latest weight:

```js
    function activityLevelFor(daysPerWeek) {
      if (daysPerWeek <= 2) return 2;
      if (daysPerWeek <= 4) return 3;
      return 4;
    }
    const { data: weightRows } = await supa.from('coaching_client_weights')
      .select('weight, logged_at').eq('client_id', clientId).order('logged_at', { ascending: true });
    const latestWeight = (weightRows && weightRows.length) ? weightRows[weightRows.length - 1].weight : data.weight_lb;
    let realMacros = null;
    if (data.sex && data.age && data.height_in && latestWeight) {
      realMacros = window.MacroCalc.calculateMacros({
        sex: data.sex, age: data.age, heightIn: data.height_in, weightLb: latestWeight,
        activityLevel: activityLevelFor(data.training_days_per_week), goal: data.goal
      });
    }
    const trendSuggestion = (weightRows && weightRows.length >= 2)
      ? window.CoachingDietTrend.suggestCalorieAdjustment(data.goal, weightRows)
      : null;
```

- [ ] **Step 3: Pass the computed values into `renderPlan` and render them**

Change the `renderPlan(data, plan)` call at the end of `load()` to `renderPlan(data, plan, realMacros, trendSuggestion)`, update the function signature to `function renderPlan(client, plan, realMacros, trendSuggestion)`, and replace the existing three lines (`dietSummary`/`dietApproach`/`dietFood` `.textContent = plan.diet....`) with:

```js
    if (realMacros) {
      document.getElementById('dietSummary').textContent =
        realMacros.calories + ' cal · ' + realMacros.proteinG + 'g protein · ' + realMacros.fatG + 'g fat · ' + realMacros.carbG + 'g carb';
      document.getElementById('dietApproach').textContent = plan.diet.approach;
      document.getElementById('dietFood').textContent = plan.diet.foodGuidance +
        (trendSuggestion ? ' — ' + trendSuggestion.reason : '');
    } else {
      document.getElementById('dietSummary').textContent = plan.diet.summary;
      document.getElementById('dietApproach').textContent = plan.diet.approach;
      document.getElementById('dietFood').textContent = plan.diet.foodGuidance;
    }
```

- [ ] **Step 4: Manual verification**

Open `coaching-plan.html?id=<client from Task 4, which has sex/age/height/weight set>`. Confirm the Diet card shows real computed numbers ("2,xxx cal · ...") instead of the static prose. Log 2 weeks of flat weight for a `cut`-goal client via `coaching-log.html`, reload the plan page, confirm the trend-suggestion sentence appears appended to the food-guidance line. Confirm a client missing sex/age/height/weight (an older row, if one exists) still renders the static prose fallback without crashing.

- [ ] **Step 5: Commit**

```bash
git add coaching-plan.html
git commit -m "feat: real computed macro targets + weight-trend calorie suggestion"
```

---

### Task 8: Full end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Fresh client walkthrough**

Create a brand-new client via `coaching.html` with a `cut` goal, real sex/age/height/weight. Open `coaching-log.html?id=...`, log 2+ sets on one exercise across two "sessions" (log, wait, log again with different weight/reps — `created_at` ordering matters for `getRx()`), log a bodyweight entry. Open `coaching-plan.html?id=...`, confirm both the progression hint and the real diet numbers render correctly together with no console errors.

- [ ] **Step 2: Deploy**

```bash
git push origin main
```

Confirm Vercel auto-deploys (`row-sage.vercel.app`) and repeat Step 1 against the live URL, not just localhost, since this repo has no local dev server distinct from the deployed static site.

- [ ] **Step 3: Update HANDOFF.md**

Edit-only (never full-file Write) — add a `RESOLVED` entry under Active Focus in `G:\My Drive\Claude\HANDOFF.md` summarizing: coaching client logging + `getRx()`/`calculateMacros()`-driven progression shipped, no-auth link-based access, commit range from Task 2 through this task.
