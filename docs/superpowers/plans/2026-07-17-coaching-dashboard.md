# Coaching Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coach-only Coaching page to Row where Carl can intake a client (stage/goal/equipment/injuries), assemble a tailored diet+training+advice plan from curated templates, and export it as a downloadable PDF — no client login, no live AI calls.

**Architecture:** Two new static pages (`coaching.html` for the client list/intake, `coaching-plan.html` for the assembled/printable plan), a new `coaching-templates.js` with the stage-tiered content and a pure `assemblePlan()`/`needsReview()` function pair, and a new `coaching_clients` Supabase table. Reuses Row's existing patterns exactly: `topbar.js`'s passphrase gate (no new auth code), the same Supabase project and open-anon-RLS convention `app_state`/`finance.html` already use (consistent with Row's existing risk posture — see Task 2 rationale), and the same inline-CSS-variable page style every other Row page uses.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step, no framework — matches every existing Row page), Supabase JS client v2 via CDN, `window.print()` for export. No test framework exists in this repo; verification follows Row's established pattern — `.selfcheck.js` files with `console.assert` (see `hype-audio.selfcheck.js` for precedent) for pure logic, manual live-browser checks for UI.

**Correction to repo docs:** `CLAUDE.md` and `PROJECT_REGISTRY.md` in this repo describe a React/TypeScript/tRPC "coaching-dashboard" inside a four-project monorepo. That doesn't match the actual deployed app (plain HTML/JS, single-purpose repo, live at row-sage.vercel.app). Task 8 below fixes both files so future sessions aren't misled.

---

### Task 1: Add Coaching nav icon to topbar.js

**Files:**
- Modify: `c:\Users\gregm\row\topbar.js:239-241` (finance button block), `c:\Users\gregm\row\topbar.js` CSS block (~line 156-160)

- [ ] **Step 1: Add the Coaching icon CSS**

In `topbar.js`, right after the `.topbar-finance-icon` rule (around line 160), add:

```css
.topbar-coaching-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px; text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.topbar-coaching-btn:hover { background: rgba(255, 255, 255, 0.08); }
.topbar-coaching-icon {
  font-size: 20px; line-height: 1;
  filter: grayscale(100%) brightness(1.4); opacity: 0.85;
}
```

- [ ] **Step 2: Add the Coaching link to the topbar HTML**

In `topbar.js`, in the `topbarHtml` template literal, right after the finance `</a>` (currently the last element before `</header>`, around line 241), add:

```html
  <a href="coaching.html" class="topbar-coaching-btn" id="topbarCoaching" aria-label="Coaching">
    <span class="topbar-coaching-icon">🏋️</span>
  </a>
```

- [ ] **Step 3: Verify manually**

Run: `npx serve c:\Users\gregm\row` (or open `index.html` directly in a browser), unlock the passphrase gate, confirm the new 🏋️ icon appears in the topbar next to the 📊 finance icon on every page. Clicking it should 404 until Task 4 exists — that's expected at this point.

- [ ] **Step 4: Commit**

```bash
git add topbar.js
git commit -m "feat: add Coaching nav icon to topbar"
```

---

### Task 2: Create the `coaching_clients` Supabase table

**Files:**
- Create: `c:\Users\gregm\row\supabase\migrations\2026-07-17-coaching-clients.sql`

- [ ] **Step 1: Write the migration**

```sql
create table if not exists coaching_clients (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null unique,
  name text not null,
  stage text not null check (stage in ('beginner', 'intermediate', 'advanced')),
  goal text not null check (goal in ('cut', 'bulk', 'recomp', 'contest-prep')),
  equipment text not null check (equipment in ('full-gym', 'home', 'limited')),
  training_days_per_week integer not null check (training_days_per_week between 1 and 7),
  session_length integer not null check (session_length > 0),
  injury_flags text[] not null default '{}',
  needs_review boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'issued', 'archived')),
  issued_snapshot jsonb,
  personalization_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table coaching_clients enable row level security;

-- Same open-anon-RLS pattern as app_state (used by finance.html, health.html,
-- gym.html today). This is a single-coach tool behind topbar.js's passphrase
-- gate, same risk posture Row already accepts for financial/health data —
-- not introducing a new, inconsistent security tier for this one table.
create policy "anon full access to coaching_clients"
  on coaching_clients
  for all
  to anon
  using (true)
  with check (true);
```

- [ ] **Step 2: Apply the migration**

Run this SQL against the `vikpcejlyxieguorwysf` Supabase project (same project `sync.js`/`topbar.js` already point to) via the Supabase dashboard SQL editor, or the Supabase MCP `execute_sql` tool if connected to this project — confirm which project it's pointed at first (`list_projects` / `get_project_url`) before running.

- [ ] **Step 3: Verify the table exists**

Run `list_tables` (Supabase MCP) or check the Supabase dashboard Table Editor — confirm `coaching_clients` appears with the columns above and RLS enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-07-17-coaching-clients.sql
git commit -m "feat: add coaching_clients table migration"
```

---

### Task 3: Content templates + assembly logic

**Files:**
- Create: `c:\Users\gregm\row\coaching-templates.js`
- Create: `c:\Users\gregm\row\coaching-templates.selfcheck.js`

- [ ] **Step 1: Write `coaching-templates.js`**

```js
// =============================================================
// Coaching plan content: stage-tiered diet/training/advice
// templates + pure assembly logic. No AI calls, no network —
// deterministic template selection only. Sourced from Carl's
// vault (Black Magma macro style, M5 program shape, Exercise
// Cues library, Mental Models Applied to Training).
// =============================================================
(function () {
  'use strict';

  const STAGES = {
    beginner: {
      training: {
        summary: 'Full-body, 3x/week, focus on learning the core lifts and building the habit before adding complexity.',
        days: [
          { name: 'Full Body A', exercises: ['Goblet Squat', 'Dumbbell Bench Press', 'Seated Cable Row', 'Dumbbell Romanian Deadlift', 'Plank'] },
          { name: 'Full Body B', exercises: ['Leg Press', 'Lat Pulldown', 'Dumbbell Shoulder Press', 'Dumbbell Front Raise', 'Cable Triceps Pushdown'] },
          { name: 'Full Body C', exercises: ['Dumbbell Bulgarian Split Squat', 'Machine Low Row', 'Incline Cable Pec Fly', 'Standing Calf Raise', 'Machine Preacher Curl'] }
        ]
      },
      diet: {
        summary: 'Flexible macros, not a rigid meal plan — hit the targets with foods you actually like eating.',
        approach: 'Protein: 0.8-1g per lb bodyweight. Fat: 25-30% of total calories. Carbs: fill the remainder. Weigh food for 2 weeks to calibrate portion sense, then eyeball after that.',
        foodGuidance: 'Build meals around one protein source (chicken, eggs, whey, lean beef, fish), one carb source (rice, potato, oats, fruit), and vegetables for volume/fiber. Track honestly — measuring cups and a kitchen scale beat guessing every time at this stage.'
      },
      advice: 'The first 90 days are about consistency, not optimization. Change is a decision, not a feeling — show up on the days you don\'t want to and the results take care of themselves. Don\'t chase every new technique you see online; master the basics first.'
    },
    intermediate: {
      training: {
        summary: 'Upper/Lower split, 4x/week, more volume and exercise variety now that the base movement patterns are solid.',
        days: [
          { name: 'Upper A', exercises: ['Smith Machine Flat Chest Press', 'Machine High Row', 'Neutral Grip Shoulder Press Machine', 'Lat Pulldown', 'Cable Lateral Raise', 'Cable Triceps Pushdown', 'Machine Preacher Curl'] },
          { name: 'Lower A', exercises: ['Hack Squat', 'Smith Machine RDL', 'Leg Extension', 'Lying Hamstrings Curl', 'Standing Calf Raise'] },
          { name: 'Upper B', exercises: ['Dumbbell Incline Chest Press', 'Chest Supported T-Bar Row', 'Cable Front Raise', 'Neutral Grip Lat Pulldown', 'Cable Rear Delt Fly', 'Seated Behind-the-Back Cable Curl'] },
          { name: 'Lower B', exercises: ['Cybex Leg Press', 'Dumbbell B-Stance RDL', 'Hip Adduction Machine', 'Seated Hamstrings Curl', 'Seated Calf Raise'] }
        ]
      },
      diet: {
        summary: 'Same flexible-macro approach as beginner, tightened up with more precise tracking and simple timing.',
        approach: 'Protein: 1-1.1g per lb bodyweight. Fat: 20-25% of total calories. Carbs: fill the remainder, weighted toward training days. Adjust total calories by ~10% up or down based on 2-week weight trend, not single-day readings.',
        foodGuidance: 'Same whole-food base as beginner, with more attention to protein distribution across meals (aim for 4-5 evenly spaced feedings) and carb timing around training for performance.'
      },
      advice: 'Progressive overload isn\'t a program, it\'s a promise you keep to a spreadsheet — log every session and chase small, real increases in weight or reps. This is also where most people start negotiating with themselves on diet adherence; the plan only works if you run it.'
    },
    advanced: {
      training: {
        summary: 'PPL split (Push/Pull/Legs), matches Carl\'s own current M5 program shape — higher frequency and volume for a trained lifter chasing continued hypertrophy.',
        days: [
          { name: 'Push', exercises: ['Smith Machine Narrow Grip Bench', 'Neutral Grip Shoulder Press Machine', 'Incline Cable Pec Fly', 'Dumbbell Lateral Raise', 'Low Cable Lateral Raise', 'Cable Triceps Overhead Extension'] },
          { name: 'Pull', exercises: ['Lat Pulldown', 'Chest Supported T-Bar Row', 'Cable Seated Row (Neutral Grip)', 'Cable Rear Delt Fly', 'Cable Lat Pushdown Pullover', 'Seated Behind-the-Back Cable Curl'] },
          { name: 'Legs A', exercises: ['Hack Squat', 'Cybex Leg Press', 'Leg Extension', 'Seated Hamstrings Curl', 'Standing Calf Raise'] },
          { name: 'Legs B', exercises: ['Smith Machine RDL', 'Dumbbell Heel Elevated Lunge', 'Hip Adduction Machine', 'Lying Hamstrings Curl', 'Seated Calf Raise'] }
        ]
      },
      diet: {
        summary: 'Precision macro tracking with nuanced timing and refeed guidance — same flexible-dieting philosophy, more dialed in.',
        approach: 'Protein: 1-1.2g per lb bodyweight, held constant regardless of phase. Fat: 20-25% of calories. Carbs: fill the remainder, with a planned refeed or diet break every 6-8 weeks in a sustained deficit to protect training performance and adherence.',
        foodGuidance: 'Same whole-food base, with attention to pre/post-training carb placement and a consistent weigh-in protocol (same conditions, daily, trend the average) to guide weekly adjustments.'
      },
      advice: 'At this stage the training and diet are rarely the limiting factor — recovery and consistency are. Earn the next day. Track sleep and stress the same way you track sets and macros; they move the needle just as much this deep into training experience.'
    }
  };

  function needsReview(intake) {
    if (intake.injuryFlags && intake.injuryFlags.length > 0) return true;
    const validCombo =
      STAGES[intake.stage] &&
      ['cut', 'bulk', 'recomp', 'contest-prep'].indexOf(intake.goal) !== -1 &&
      ['full-gym', 'home', 'limited'].indexOf(intake.equipment) !== -1;
    return !validCombo;
  }

  function assemblePlan(intake) {
    const stage = STAGES[intake.stage];
    if (!stage) throw new Error('Unknown stage: ' + intake.stage);
    return {
      stage: intake.stage,
      goal: intake.goal,
      equipment: intake.equipment,
      trainingDaysPerWeek: intake.trainingDaysPerWeek,
      sessionLength: intake.sessionLength,
      training: stage.training,
      diet: stage.diet,
      advice: stage.advice,
      needsReview: needsReview(intake),
      equipmentNote: intake.equipment !== 'full-gym'
        ? 'Client trains ' + intake.equipment + ' — swap machine exercises above for equivalent dumbbell/bodyweight/band movements before sending.'
        : null
    };
  }

  window.CoachingTemplates = { STAGES: STAGES, assemblePlan: assemblePlan, needsReview: needsReview };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STAGES: STAGES, assemblePlan: assemblePlan, needsReview: needsReview };
  }
})();
```

- [ ] **Step 2: Write the self-check**

```js
// coaching-templates.selfcheck.js — run with: node coaching-templates.selfcheck.js
const { STAGES, assemblePlan, needsReview } = require('./coaching-templates.js');

// All three stages exist with real content, not placeholders.
console.assert(Object.keys(STAGES).length === 3, 'expected 3 stages');
['beginner', 'intermediate', 'advanced'].forEach((s) => {
  console.assert(STAGES[s].training.days.length >= 3, s + ' should have >=3 training days');
  console.assert(STAGES[s].diet.approach.length > 20, s + ' diet approach should be real content');
  console.assert(STAGES[s].advice.length > 20, s + ' advice should be real content');
});

// Clean case: no injury flags, valid combo -> no review needed.
const clean = { stage: 'intermediate', goal: 'recomp', equipment: 'full-gym', trainingDaysPerWeek: 4, sessionLength: 60, injuryFlags: [] };
console.assert(needsReview(clean) === false, 'clean intake should not need review');

// Injury flag -> always needs review, regardless of otherwise-valid combo.
const injured = Object.assign({}, clean, { injuryFlags: ['shoulder'] });
console.assert(needsReview(injured) === true, 'any injury flag must force needs_review');

// Unknown stage -> assemblePlan throws rather than silently producing garbage.
let threw = false;
try { assemblePlan({ stage: 'expert', goal: 'cut', equipment: 'full-gym', trainingDaysPerWeek: 5, sessionLength: 60, injuryFlags: [] }); }
catch (e) { threw = true; }
console.assert(threw, 'unknown stage should throw, not silently fall through');

// Non-full-gym equipment surfaces an equipment note for manual substitution.
const homePlan = assemblePlan({ stage: 'beginner', goal: 'cut', equipment: 'home', trainingDaysPerWeek: 3, sessionLength: 45, injuryFlags: [] });
console.assert(homePlan.equipmentNote !== null, 'non-full-gym equipment should surface a substitution note');

console.log('coaching-templates.selfcheck.js: all assertions passed');
```

- [ ] **Step 3: Run the self-check**

Run: `node coaching-templates.selfcheck.js`
Expected: `coaching-templates.selfcheck.js: all assertions passed` with no assertion errors.

- [ ] **Step 4: Commit**

```bash
git add coaching-templates.js coaching-templates.selfcheck.js
git commit -m "feat: add coaching content templates and assembly logic"
```

---

### Task 4: `coaching.html` — client list + intake

**Files:**
- Create: `c:\Users\gregm\row\coaching.html`

- [ ] **Step 1: Write the page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#050506">
<title>Coaching — Carl's Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="topbar.js" defer></script>
<script src="coaching-templates.js"></script>
<style>
:root {
  --text-primary: #F4F1EA; --text-secondary: #B8B6B0; --text-tertiary: #76746E;
  --accent: #6EE7B7; --danger: #FF6B6B;
  --font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #000; color: var(--text-secondary); font-family: var(--font); }
body { min-height: 100vh; padding: max(28px, env(safe-area-inset-top)) 20px 60px; }
.page { max-width: 720px; margin: 0 auto; }
.dash-title { margin: 0 0 18px; font-family: var(--font-serif); font-size: 30px; font-weight: 700; font-style: italic; color: var(--text-primary); }
.card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 18px; margin-bottom: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.field label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-tertiary); }
.field input, .field select {
  padding: 11px 14px; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
  background: rgba(0,0,0,0.28); color: var(--text-primary); font-family: inherit; font-size: 14px; outline: none;
}
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.checks { display: flex; flex-wrap: wrap; gap: 8px; }
.chk { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-primary); }
.btn { padding: 11px 20px; border: 0; border-radius: 12px; background: linear-gradient(135deg, #6EE7B7 0%, #34D399 100%); color: #052e16; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.client-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.035); margin-bottom: 6px; text-decoration: none; }
.client-name { color: var(--text-primary); font-weight: 600; }
.client-meta { font-family: var(--font-mono); font-size: 11px; color: var(--text-tertiary); }
.badge { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; }
.badge-draft { background: rgba(255,255,255,0.08); color: var(--text-tertiary); }
.badge-review { background: rgba(255,107,107,0.15); color: var(--danger); }
.badge-issued { background: rgba(110,231,183,0.15); color: var(--accent); }
</style>
</head>
<body>
<div class="page">
  <h1 class="dash-title">Coaching</h1>

  <div class="card">
    <div class="field"><label>Client name</label><input id="cName" type="text" placeholder="Client name"></div>
    <div class="row2">
      <div class="field"><label>Stage</label>
        <select id="cStage"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
      </div>
      <div class="field"><label>Goal</label>
        <select id="cGoal"><option value="cut">Cut</option><option value="bulk">Bulk</option><option value="recomp">Recomp</option><option value="contest-prep">Contest prep</option></select>
      </div>
    </div>
    <div class="row2">
      <div class="field"><label>Equipment</label>
        <select id="cEquip"><option value="full-gym">Full gym</option><option value="home">Home</option><option value="limited">Limited</option></select>
      </div>
      <div class="field"><label>Training days/week</label><input id="cDays" type="number" min="1" max="7" value="4"></div>
    </div>
    <div class="field"><label>Session length (minutes)</label><input id="cLength" type="number" min="15" value="60"></div>
    <div class="field">
      <label>Injury flags</label>
      <div class="checks">
        <label class="chk"><input type="checkbox" value="shoulder" class="injFlag"> Shoulder</label>
        <label class="chk"><input type="checkbox" value="elbow" class="injFlag"> Elbow</label>
        <label class="chk"><input type="checkbox" value="knee" class="injFlag"> Knee</label>
        <label class="chk"><input type="checkbox" value="lower-back" class="injFlag"> Lower back</label>
      </div>
    </div>
    <button type="button" class="btn" id="addClientBtn">+ Add Client</button>
    <div id="addStatus" style="font-size:12px;color:var(--text-tertiary);margin-top:8px;"></div>
  </div>

  <div class="card">
    <div id="clientList"></div>
    <div id="emptyClients" style="display:none;color:var(--text-tertiary);font-size:13px;text-align:center;padding:14px;">No clients yet — add one above.</div>
  </div>
</div>

<script>
(function () {
  'use strict';
  const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
  const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  function genPlanId() {
    return 'plan_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function loadClients() {
    const { data, error } = await supa.from('coaching_clients').select('*').order('created_at', { ascending: false });
    const listEl = document.getElementById('clientList');
    const emptyEl = document.getElementById('emptyClients');
    listEl.innerHTML = '';
    if (error || !data || data.length === 0) { emptyEl.style.display = 'block'; return; }
    emptyEl.style.display = 'none';
    data.forEach((c) => {
      const a = document.createElement('a');
      a.href = 'coaching-plan.html?id=' + encodeURIComponent(c.id);
      a.className = 'client-row';
      const badgeClass = c.status === 'issued' ? 'badge-issued' : (c.needs_review ? 'badge-review' : 'badge-draft');
      const badgeLabel = c.status === 'issued' ? 'ISSUED' : (c.needs_review ? 'NEEDS REVIEW' : 'DRAFT');
      a.innerHTML =
        '<div><div class="client-name">' + escapeHtml(c.name) + '</div>' +
        '<div class="client-meta">' + c.stage + ' · ' + c.goal + ' · ' + c.plan_id + '</div></div>' +
        '<span class="badge ' + badgeClass + '">' + badgeLabel + '</span>';
      listEl.appendChild(a);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  document.getElementById('addClientBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('addStatus');
    const name = document.getElementById('cName').value.trim();
    if (!name) { statusEl.textContent = 'Client name required.'; return; }
    const intake = {
      stage: document.getElementById('cStage').value,
      goal: document.getElementById('cGoal').value,
      equipment: document.getElementById('cEquip').value,
      trainingDaysPerWeek: parseInt(document.getElementById('cDays').value, 10),
      sessionLength: parseInt(document.getElementById('cLength').value, 10),
      injuryFlags: Array.from(document.querySelectorAll('.injFlag:checked')).map((el) => el.value)
    };
    const needsReview = window.CoachingTemplates.needsReview(intake);
    const { data, error } = await supa.from('coaching_clients').insert({
      plan_id: genPlanId(),
      name: name,
      stage: intake.stage,
      goal: intake.goal,
      equipment: intake.equipment,
      training_days_per_week: intake.trainingDaysPerWeek,
      session_length: intake.sessionLength,
      injury_flags: intake.injuryFlags,
      needs_review: needsReview,
      status: 'draft'
    }).select().single();
    if (error) { statusEl.textContent = 'Save failed: ' + error.message; return; }
    window.location.href = 'coaching-plan.html?id=' + encodeURIComponent(data.id);
  });

  loadClients();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Verify manually**

Serve the repo locally, navigate to `coaching.html` through the topbar icon, add a test client with an injury flag checked, confirm it saves to Supabase (`coaching_clients` table in the dashboard shows the row with `needs_review = true`) and redirects to `coaching-plan.html?id=...` (404 expected until Task 5).

- [ ] **Step 3: Commit**

```bash
git add coaching.html
git commit -m "feat: add coaching.html client list and intake form"
```

---

### Task 5: `coaching-plan.html` — assembled plan, review gate, print

**Files:**
- Create: `c:\Users\gregm\row\coaching-plan.html`

- [ ] **Step 1: Write the page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plan — Carl's Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="topbar.js" defer></script>
<script src="coaching-templates.js"></script>
<style>
:root { --text-primary: #F4F1EA; --text-secondary: #B8B6B0; --text-tertiary: #76746E; --accent: #6EE7B7; --danger: #FF6B6B; --font: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; --font-serif: 'Instrument Serif', Georgia, serif; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #000; color: var(--text-secondary); font-family: var(--font); }
body { padding: max(28px, env(safe-area-inset-top)) 20px 60px; }
.page { max-width: 720px; margin: 0 auto; }
.plan-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.plan-name { font-family: var(--font-serif); font-size: 28px; font-style: italic; color: var(--text-primary); }
.plan-id { font-family: monospace; font-size: 11px; color: var(--text-tertiary); }
.review-banner { background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.3); color: var(--danger); padding: 14px; border-radius: 12px; margin: 14px 0; }
.section-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 18px; margin-bottom: 14px; }
.section-card h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); margin: 0 0 10px; }
.day-block { margin-bottom: 10px; }
.day-block h3 { font-size: 14px; color: var(--text-primary); margin: 0 0 4px; }
.day-block ul { margin: 0; padding-left: 18px; font-size: 13px; }
textarea { width: 100%; min-height: 90px; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.28); color: var(--text-primary); font-family: inherit; }
.btn { padding: 11px 20px; border: 0; border-radius: 12px; background: linear-gradient(135deg, #6EE7B7 0%, #34D399 100%); color: #052e16; font-family: inherit; font-weight: 700; cursor: pointer; margin-right: 8px; }
.btn-secondary { background: rgba(255,255,255,0.08); color: var(--text-primary); }
@media print {
  #topbar, #bottombar, #auth-overlay, .no-print { display: none !important; }
  body { background: #fff; color: #000; padding: 20px; }
  .section-card, .plan-header { background: none; border: none; color: #000; }
}
</style>
</head>
<body>
<div class="page">
  <div class="plan-header">
    <div class="plan-name" id="planName">Loading…</div>
    <div class="plan-id" id="planIdLabel"></div>
  </div>

  <div id="reviewBanner" class="review-banner" style="display:none;">
    ⚠ Needs review — injury flags or an unusual stage/goal/equipment combination were detected. Confirm the plan below is safe for this client before issuing.
    <div style="margin-top:8px;"><button type="button" class="btn no-print" id="confirmReviewBtn">Mark reviewed</button></div>
  </div>

  <div class="section-card">
    <h2>Training</h2>
    <div id="trainingSummary" style="margin-bottom:10px;"></div>
    <div id="trainingDays"></div>
    <div id="equipmentNote" style="margin-top:8px;font-size:12px;color:var(--danger);"></div>
  </div>

  <div class="section-card">
    <h2>Diet</h2>
    <div id="dietSummary" style="margin-bottom:8px;"></div>
    <div id="dietApproach" style="margin-bottom:8px;"></div>
    <div id="dietFood"></div>
  </div>

  <div class="section-card">
    <h2>Advice</h2>
    <div id="adviceText"></div>
  </div>

  <div class="section-card no-print">
    <h2>Personalization note (for <span id="noteClientName"></span>, <span id="notePlanId"></span>)</h2>
    <textarea id="personalizationNote" placeholder="Written separately — paste in, don't generate here."></textarea>
    <div style="margin-top:10px;">
      <button type="button" class="btn btn-secondary" id="saveNoteBtn">Save note</button>
    </div>
  </div>

  <div class="no-print" style="margin-top:10px;">
    <button type="button" class="btn" id="markIssuedBtn">Mark Issued</button>
    <button type="button" class="btn btn-secondary" id="printBtn">Print / Save PDF</button>
  </div>
</div>

<script>
(function () {
  'use strict';
  const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
  const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const clientId = new URLSearchParams(window.location.search).get('id');
  let currentClient = null;

  function renderPlan(client, plan) {
    document.getElementById('planName').textContent = client.name;
    document.getElementById('planIdLabel').textContent = client.plan_id;
    document.getElementById('noteClientName').textContent = client.name;
    document.getElementById('notePlanId').textContent = client.plan_id;

    document.getElementById('reviewBanner').style.display = (client.needs_review && client.status !== 'issued') ? 'block' : 'none';

    document.getElementById('trainingSummary').textContent = plan.training.summary;
    const daysEl = document.getElementById('trainingDays');
    daysEl.innerHTML = '';
    plan.training.days.forEach((d) => {
      const div = document.createElement('div');
      div.className = 'day-block';
      div.innerHTML = '<h3>' + d.name + '</h3><ul>' + d.exercises.map((e) => '<li>' + e + '</li>').join('') + '</ul>';
      daysEl.appendChild(div);
    });
    document.getElementById('equipmentNote').textContent = plan.equipmentNote || '';

    document.getElementById('dietSummary').textContent = plan.diet.summary;
    document.getElementById('dietApproach').textContent = plan.diet.approach;
    document.getElementById('dietFood').textContent = plan.diet.foodGuidance;

    document.getElementById('adviceText').textContent = plan.advice;
    document.getElementById('personalizationNote').value = client.personalization_note || '';
  }

  async function load() {
    if (!clientId) { document.getElementById('planName').textContent = 'No client ID given'; return; }
    const { data, error } = await supa.from('coaching_clients').select('*').eq('id', clientId).single();
    if (error || !data) { document.getElementById('planName').textContent = 'Client not found'; return; }
    currentClient = data;
    const intake = {
      stage: data.stage, goal: data.goal, equipment: data.equipment,
      trainingDaysPerWeek: data.training_days_per_week, sessionLength: data.session_length,
      injuryFlags: data.injury_flags || []
    };
    const plan = (data.status === 'issued' && data.issued_snapshot)
      ? data.issued_snapshot.plan
      : window.CoachingTemplates.assemblePlan(intake);
    renderPlan(data, plan);
  }

  document.getElementById('confirmReviewBtn').addEventListener('click', async () => {
    await supa.from('coaching_clients').update({ needs_review: false }).eq('id', clientId);
    document.getElementById('reviewBanner').style.display = 'none';
  });

  document.getElementById('saveNoteBtn').addEventListener('click', async () => {
    const note = document.getElementById('personalizationNote').value;
    await supa.from('coaching_clients').update({ personalization_note: note }).eq('id', clientId);
  });

  document.getElementById('markIssuedBtn').addEventListener('click', async () => {
    if (currentClient.needs_review) { alert('Mark reviewed before issuing — injury flags or an unusual combination need your confirmation first.'); return; }
    const intake = {
      stage: currentClient.stage, goal: currentClient.goal, equipment: currentClient.equipment,
      trainingDaysPerWeek: currentClient.training_days_per_week, sessionLength: currentClient.session_length,
      injuryFlags: currentClient.injury_flags || []
    };
    const plan = window.CoachingTemplates.assemblePlan(intake);
    const note = document.getElementById('personalizationNote').value;
    const snapshot = { plan: plan, personalizationNote: note, issuedAt: new Date().toISOString() };
    const { error } = await supa.from('coaching_clients').update({
      status: 'issued', issued_snapshot: snapshot, personalization_note: note
    }).eq('id', clientId);
    if (!error) { alert('Plan marked issued — the snapshot is now frozen.'); load(); }
  });

  document.getElementById('printBtn').addEventListener('click', () => window.print());

  load();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Verify manually**

Load `coaching-plan.html?id=<the test client's id from Task 4>`. Confirm: the review banner shows (test client had an injury flag), "Mark Issued" is blocked with an alert until "Mark reviewed" is clicked, the assembled training days/diet/advice render real content (not blank), the personalization note saves, "Mark Issued" freezes an `issued_snapshot` (confirm in Supabase dashboard), and print preview (Ctrl+P) hides the topbar/bottombar and the personalization-note editor/buttons (`.no-print`).

- [ ] **Step 3: Commit**

```bash
git add coaching-plan.html
git commit -m "feat: add coaching-plan.html assembled plan view with review gate and print export"
```

---

### Task 6: End-to-end manual verification

- [ ] **Step 1: Full flow, clean client**

Add a client with no injury flags, a standard stage/goal/equipment combo. Confirm `needs_review` is false, no review banner shows, plan assembles correctly, issuing works without the block, print output looks correct with no chrome.

- [ ] **Step 2: Full flow, flagged client**

Add a client with an injury flag. Confirm the review banner blocks "Mark Issued" until "Mark reviewed" is clicked.

- [ ] **Step 3: Snapshot freeze check**

After issuing a client's plan, edit `coaching-templates.js` (e.g. change one exercise name), reload that client's `coaching-plan.html`. Confirm the already-issued plan still shows the OLD content (from `issued_snapshot`), proving template edits don't retroactively change issued plans. Revert the test edit.

- [ ] **Step 4: Mobile check**

Resize to 375px width (or test on phone), confirm the intake form and plan view are usable, not just desktop.

---

### Task 7: Correct stale repo docs

**Files:**
- Modify: `c:\Users\gregm\row\CLAUDE.md`
- Modify: `c:\Users\gregm\row\PROJECT_REGISTRY.md`

- [ ] **Step 1: Fix `CLAUDE.md`**

Replace the "Projects Overview" table and the `coaching-dashboard` architecture section (describing a React/tRPC four-project monorepo) with an accurate description: this repo (`row`) is a single static multi-page vanilla HTML/JS/Supabase app deployed to Vercel at row-sage.vercel.app, pages are `index.html`/`main.html`/`health.html`/`gym.html`/`finance.html`/`mobility.html`/`coaching.html`/`coaching-plan.html`, shared logic in `sync.js` (cloud sync) and `topbar.js` (nav + passphrase gate), no build step, no framework. Remove the false claim that Jarvis/accounting-automation/content-system are subfolders of this repo — they're separate repos (see the workspace-root `PROJECT_REGISTRY.md` at `G:\My Drive\Claude\` — note as of this plan's writing that file didn't exist yet either; if still missing, don't reference it).

- [ ] **Step 2: Fix `PROJECT_REGISTRY.md`**

Update the "Coaching Dashboard (row)" entry: stack is vanilla HTML/JS/Supabase, not React+TypeScript; deployed at row-sage.vercel.app, not "not yet deployed"; note the new `coaching.html`/`coaching-plan.html` pages and `coaching_clients` table added by this plan.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md PROJECT_REGISTRY.md
git commit -m "docs: correct stale coaching-dashboard description to match actual vanilla-JS Row app"
```

---

### Task 8: Push and confirm live deploy

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Confirm Vercel auto-deploy**

Check the Vercel dashboard (or `vercel ls`) for a new deployment triggered by the push. Once live, load `https://row-sage.vercel.app/coaching.html` directly and repeat the Task 6 smoke test against production.

---

## Self-Review Notes

- **Spec coverage:** hosting (Task 1, 4, 5), data store (Task 2), content layer (Task 3), assembly logic (Task 3), export (Task 5 print CSS), access gate (already exists via `topbar.js`, confirmed not duplicated), plan snapshot/versioning (Task 5 `issued_snapshot`), injury review gate (Task 3 `needsReview` + Task 5 banner), personalization note labeling (Task 5 shows client name/plan ID on the field) — all covered.
- **Out of scope confirmed not built:** no client login, no live AI call, no check-in workflow, no progress tracking, no payments, no multi-coach support.
- **Type/naming consistency checked:** `assemblePlan`/`needsReview` names match across Task 3 (definition), Task 4 (`window.CoachingTemplates.needsReview`), and Task 5 (`window.CoachingTemplates.assemblePlan`). Column names (`training_days_per_week`, `session_length`, `injury_flags`, `needs_review`, `issued_snapshot`, `personalization_note`) match between Task 2's migration and Task 4/5's Supabase calls.
