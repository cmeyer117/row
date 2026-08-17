# Weekly Coach Decision Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `weekly-review.html` page that gates a new weekly decision on closing out last week's, backed by the shared `decisions` table and Vision's existing `coach-read` narrative.

**Architecture:** `api/coach-read.js` (owner-gated proxy, mirrors `api/jarvis-chat.js`) surfaces Vision's narrative. `decisions.js` gains two read/update functions alongside its existing `recordDecision()`. `weekly-review.html` reads `po-coach`'s already-anon-readable gym state directly, reuses `gym-volume-logic.js`'s existing `weeklySetsByMuscle`/`classifyMuscleVolume`/`volumeAdvisory` functions for per-muscle suggestions (no new suggestion logic needed — this already exists and is exactly what the spec called for), and renders either a close-out form or a new-decision form depending on what's open in `decisions`.

**Tech Stack:** Vanilla JS, Supabase JS SDK (CDN), Vercel serverless functions (Node).

**Note:** during planning, `gym-volume-logic.js` was found to already export `classifyMuscleVolume()` and `volumeAdvisory()` — exactly the MEV/MAV/MRV-based suggestion logic the design spec described building fresh. This plan reuses those existing (already-shipped) pure functions instead of writing and testing new ones, which is a smaller, more correct implementation than the spec's Testing section anticipated. No new selfcheck script is needed as a result — see Task 3.

---

### Task 1: `api/coach-read.js` proxy

**Files:**
- Create: `C:\Users\gregm\row\api\coach-read.js`

- [ ] **Step 1: Write the handler**

```javascript
// Vercel serverless proxy — surfaces Vision's weekly coach-read narrative
// (app_state key 'jarvis:coach_read') to weekly-review.html. That key is
// NOT in app_state's anon-RLS allowlist (see project-app-state-anon-rls-scope
// memory — a standing rule against widening it for personal data), so this
// reads it server-side with the service-role key instead, same owner-gate
// pattern as api/jarvis-chat.js.
import { verifyOwner } from './_lib/verify-owner.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const upstream = await fetch(
      `${SUPABASE_URL}/rest/v1/app_state?key=eq.jarvis:coach_read&select=data`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY } }
    );
    const rows = await upstream.json();
    const data = Array.isArray(rows) && rows[0] ? rows[0].data : null;
    res.status(200).json({ coachRead: data });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Supabase' });
  }
}
```

- [ ] **Step 2: Verify locally**

```bash
cd "C:\Users\gregm\row"
node -e "
fetch('https://vikpcejlyxieguorwysf.supabase.co/rest/v1/app_state?key=eq.jarvis:coach_read&select=data', {
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY }
}).then(r => r.json()).then(d => console.log(JSON.stringify(d).slice(0, 300)));
"
```

Run this with the real `SUPABASE_SERVICE_ROLE_KEY` set in the environment (pull it from Vercel if not already set locally: `vercel env pull .env.local` then `node --env-file=.env.local -e "..."`). Expected: a JSON array with one row containing `data` — confirms the underlying query the handler runs is correct. Full owner-gated round trip through the deployed function gets checked in Task 5's manual pass (can't invoke a Vercel serverless function locally without `vercel dev`, which isn't part of this repo's existing workflow).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\gregm\row"
git add api/coach-read.js
git commit -m "feat: add owner-gated proxy for Vision's coach-read narrative"
git push
```

---

### Task 2: Extend `decisions.js` with read/close functions

**Files:**
- Modify: `C:\Users\gregm\row\decisions.js`

- [ ] **Step 1: Add `getOpenDueDecision` and `closeDecision`**

```javascript
// =============================================================
// Shared decision-memory write helper. Records a decision to the
// `decisions` table (shared across Row/Vessel/Vision/Content) —
// see docs/superpowers/specs/2026-08-17-shared-decision-memory-design.md.
// Pages that want to record a decision load this after the Supabase
// CDN script tag, same convention as sync.js.
// =============================================================
(function () {
  'use strict';
  const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

  window.recordDecision = function (fields) {
    if (!window.supabase) return Promise.reject(new Error('supabase-js not loaded'));
    if (!fields || !fields.decision_text) return Promise.reject(new Error('decision_text is required'));

    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supa.from('decisions').insert({
      app: 'row',
      category: fields.category || null,
      decision_text: fields.decision_text,
      rationale: fields.rationale || null,
      expected_outcome: fields.expected_outcome || null,
      alternatives_considered: fields.alternatives_considered || null,
      details: fields.details || {},
      review_date: fields.review_date || null,
    }).then(function (res) {
      if (res.error) throw new Error('recordDecision failed: ' + res.error.message);
      return res;
    });
  };

  // Returns the most recent open+due decision for a given category, or
  // null if none is blocking. "Due" matches the SQL shape documented in
  // the shared decision-memory spec: status='open' AND (review_date IS
  // NULL OR review_date <= today).
  window.getOpenDueDecision = function (category) {
    if (!window.supabase) return Promise.reject(new Error('supabase-js not loaded'));
    const today = new Date().toISOString().slice(0, 10);
    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supa.from('decisions')
      .select('*')
      .eq('app', 'row')
      .eq('category', category)
      .eq('status', 'open')
      .or(`review_date.is.null,review_date.lte.${today}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(function (res) {
        if (res.error) throw new Error('getOpenDueDecision failed: ' + res.error.message);
        return res.data && res.data[0] ? res.data[0] : null;
      });
  };

  window.closeDecision = function (id, verdict, outcomeNote) {
    if (!window.supabase) return Promise.reject(new Error('supabase-js not loaded'));
    if (!id || !verdict) return Promise.reject(new Error('id and verdict are required'));
    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supa.from('decisions').update({
      verdict: verdict,
      outcome_note: outcomeNote || null,
      status: 'reviewed',
      reviewed_at: new Date().toISOString(),
    }).eq('id', id).then(function (res) {
      if (res.error) throw new Error('closeDecision failed: ' + res.error.message);
      return res;
    });
  };
})();
```

- [ ] **Step 2: Verify against real Supabase**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supa = createClient('https://vikpcejlyxieguorwysf.supabase.co', 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv');
(async () => {
  const ins = await supa.from('decisions').insert({ app: 'row', category: 'plan-verify-task2', decision_text: 'PLAN-VERIFY: task 2 smoke test', review_date: null }).select().single();
  console.log('inserted:', ins.data.id);
  const today = new Date().toISOString().slice(0, 10);
  const found = await supa.from('decisions').select('*').eq('app', 'row').eq('category', 'plan-verify-task2').eq('status', 'open').or(\`review_date.is.null,review_date.lte.\${today}\`).order('created_at', { ascending: false }).limit(1);
  console.log('found:', found.data[0].id === ins.data.id);
  const closed = await supa.from('decisions').update({ verdict: 'worked', status: 'reviewed', reviewed_at: new Date().toISOString() }).eq('id', ins.data.id);
  console.log('closed error:', closed.error);
  const refound = await supa.from('decisions').select('*').eq('app', 'row').eq('category', 'plan-verify-task2').eq('status', 'open');
  console.log('still open after close (expect 0):', refound.data.length);
})();
"
```

Expected: `inserted: <uuid>`, `found: true`, `closed error: null`, `still open after close (expect 0): 0`.

- [ ] **Step 3: Clean up the smoke-test row**

Use the `execute_sql` MCP tool:

```sql
delete from decisions where decision_text = 'PLAN-VERIFY: task 2 smoke test';
```

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\gregm\row"
git add decisions.js
git commit -m "feat: add getOpenDueDecision()/closeDecision() to decisions.js"
git push
```

---

### Task 3: `weekly-review.html` page

**Files:**
- Create: `C:\Users\gregm\row\weekly-review.html`

- [ ] **Step 1: Scaffold the page head/style**

Copy `mobility.html`'s `<head>` block (lines 1-20, the meta tags/fonts/CSS custom properties/`<script>` tags for `supabase-js`, `row-auth.js`, `topbar.js`) into a new file, changing the `<title>` to `Weekly Review — Row` and adding `<script src="gym-volume-logic.js"></script>` and `<script src="decisions.js"></script>` after the `topbar.js` script tag. Keep the existing `:root` CSS variables (`--bg`, `--text-1`, `--accent`, etc.) — reuse them, don't invent new tokens.

- [ ] **Step 2: Write the body markup and script**

```html
<body>
<div id="app" style="max-width:640px;margin:0 auto;padding:24px 16px 100px;">
  <h1 style="font-family:var(--font);font-size:22px;color:var(--text-1);">Weekly Coach Decision Loop</h1>
  <div id="loading" style="color:var(--text-3);">Loading...</div>
  <div id="closeoutSection" style="display:none;"></div>
  <div id="newDecisionSection" style="display:none;"></div>
</div>
<script>
const MUSCLES = Object.keys(window.GymVolumeLogic.MUSCLE_BANDS);

async function fetchGymState() {
  const res = await fetch('https://vikpcejlyxieguorwysf.supabase.co/rest/v1/app_state?key=eq.po-coach&select=data', {
    headers: {
      apikey: 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv',
      Authorization: 'Bearer sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv',
    },
  });
  const rows = await res.json();
  return (rows[0] && rows[0].data && rows[0].data.po_coach_v1) || { exercises: [], logs: {} };
}

async function fetchCoachRead() {
  try {
    const token = await window.RowAuth.getAccessToken();
    const res = await fetch('/api/coach-read', { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return null;
    const body = await res.json();
    return body.coachRead;
  } catch {
    return null;
  }
}

function renderCloseout(decision) {
  const el = document.getElementById('closeoutSection');
  el.style.display = 'block';
  el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;">
      <p style="color:var(--text-2);font-size:13px;">Close out last week's decision before starting a new one:</p>
      <p style="color:var(--text-1);font-size:14px;margin:8px 0;">${decision.decision_text}</p>
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
  document.getElementById('closeoutSave').onclick = async () => {
    const verdict = document.getElementById('verdictSelect').value;
    if (!verdict) { alert('Pick a verdict first.'); return; }
    const note = document.getElementById('outcomeNote').value;
    await window.closeDecision(decision.id, verdict, note);
    el.style.display = 'none';
    await renderNewDecisionForm();
  };
}

async function renderNewDecisionForm() {
  const [gymState, coachRead] = await Promise.all([fetchGymState(), fetchCoachRead()]);
  const counts = window.GymVolumeLogic.weeklySetsByMuscle(gymState.exercises || [], gymState.logs || {});
  const phase = coachRead && coachRead.phase;

  const muscleRows = MUSCLES.map(m => {
    const band = window.GymVolumeLogic.classifyMuscleVolume(m, counts[m] || 0, phase);
    const advisory = window.GymVolumeLogic.volumeAdvisory(band, false, phase);
    const suggested = advisory ? advisory.suggestion : 'keep';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="color:var(--text-1);font-size:13px;">${m} (${counts[m] || 0} sets)</span>
      <select data-muscle="${m}" class="muscleSelect" style="padding:4px;">
        <option value="add_set" ${suggested === 'add_set' ? 'selected' : ''}>Add</option>
        <option value="keep" ${suggested === 'keep' ? 'selected' : ''}>Keep</option>
        <option value="pull_back" ${suggested === 'pull_back' ? 'selected' : ''}>Reduce</option>
      </select>
    </div>`;
  }).join('');

  const el = document.getElementById('newDecisionSection');
  el.style.display = 'block';
  el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-top:16px;">
      ${coachRead ? `<p style="color:var(--text-2);font-size:13px;">${coachRead.narrative}</p>` : `<p style="color:var(--text-3);font-size:13px;">Signal narrative unavailable this week.</p>`}
      <h3 style="color:var(--text-1);font-size:14px;margin-top:12px;">Volume by muscle</h3>
      ${muscleRows}
      <textarea id="anchorLifts" placeholder="Anchor lift progress/hold/regress calls" style="width:100%;padding:8px;margin-top:12px;min-height:50px;"></textarea>
      <textarea id="cardioRx" placeholder="Cardio/posing prescription" style="width:100%;padding:8px;margin-top:8px;min-height:50px;"></textarea>
      <label style="display:block;color:var(--text-2);font-size:13px;margin-top:8px;">
        <input type="checkbox" id="painFlag" /> Recovery/pain flag
      </label>
      <textarea id="painNote" placeholder="Pain/recovery note" style="width:100%;padding:8px;margin-top:4px;min-height:40px;"></textarea>
      <textarea id="rationale" placeholder="Rationale" style="width:100%;padding:8px;margin-top:8px;min-height:50px;"></textarea>
      <button id="saveDecision" style="padding:10px 16px;margin-top:8px;">Save This Week's Decision</button>
    </div>`;

  document.getElementById('saveDecision').onclick = async () => {
    const muscleGroups = {};
    document.querySelectorAll('.muscleSelect').forEach(sel => { muscleGroups[sel.dataset.muscle] = sel.value; });
    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + 7);
    const summary = 'Week of ' + new Date().toISOString().slice(0, 10) + ' coach decision recorded.';
    await window.recordDecision({
      category: 'weekly-coach-loop',
      decision_text: summary,
      rationale: document.getElementById('rationale').value,
      review_date: reviewDate.toISOString().slice(0, 10),
      details: {
        muscle_groups: muscleGroups,
        anchor_lifts: document.getElementById('anchorLifts').value,
        cardio_rx: document.getElementById('cardioRx').value,
        posing_rx: document.getElementById('cardioRx').value,
        pain_flags: document.getElementById('painFlag').checked ? [document.getElementById('painNote').value] : [],
      },
    });
    alert('Saved.');
    location.reload();
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  const existing = await window.getOpenDueDecision('weekly-coach-loop');
  document.getElementById('loading').style.display = 'none';
  if (existing) {
    renderCloseout(existing);
  } else {
    renderNewDecisionForm();
  }
});
</script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\gregm\row"
git add weekly-review.html
git commit -m "feat: add weekly-review.html"
git push
```

---

### Task 4: Link from the topbar

**Files:**
- Modify: `C:\Users\gregm\row\topbar.js`

- [ ] **Step 1: Add the CSS for the new icon button**

Insert right after the existing `.topbar-coaching-btn:hover { background: rgba(255, 255, 255, 0.08); }` rule:

```css
.topbar-review-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px; text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.topbar-review-btn:hover { background: rgba(255, 255, 255, 0.08); }
.topbar-review-icon {
  font-size: 20px; line-height: 1;
  filter: grayscale(100%) brightness(1.4); opacity: 0.85;
}
```

Insert the mobile sizing rule right after the existing `.topbar-coaching-btn { width: 40px; height: 38px; }` line:

```css
.topbar-review-btn { width: 40px; height: 38px; }
```

- [ ] **Step 2: Add the link to the topbar markup**

Modify the `topbarHtml` template literal — add right after the `coaching.html` `<a>` tag:

```html
  <a href="weekly-review.html" class="topbar-review-btn" id="topbarReview" aria-label="Weekly Review">
    <span class="topbar-review-icon">🗓️</span>
  </a>
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\gregm\row"
git add topbar.js
git commit -m "feat: add weekly review link to topbar"
git push
```

---

### Task 5: End-to-end manual verification

- [ ] **Step 1: Confirm no leftover smoke-test rows**

```sql
select id, app, category, decision_text from decisions where decision_text like 'PLAN-VERIFY:%' or category = 'plan-verify-task2';
```

Expected: 0 rows.

- [ ] **Step 2: Manual dev flow**

```bash
cd "C:\Users\gregm\row"
npx vercel dev
```

Open `weekly-review.html`. Confirm:
1. With no open `weekly-coach-loop` decision, the new-decision form renders directly (no close-out gate), muscle suggestions show a value per muscle, Vision's narrative shows (or the "unavailable" note if `/api/coach-read` errors).
2. Fill in the form, save — confirm a new row appears in `decisions` (`app='row', category='weekly-coach-loop', status='open'`, `review_date` = today+7) via the `execute_sql` MCP tool.
3. Manually set that row's `review_date` to yesterday via `execute_sql` (`update decisions set review_date = current_date - 1 where id = '<id>'`), reload the page — confirm the close-out form renders instead of the new-decision form.
4. Fill in a verdict and outcome note, save — confirm the row flips to `status='reviewed'` and the new-decision form renders in its place without a further reload.

Stop the dev server after confirming (Ctrl+C).

- [ ] **Step 3: Clean up the test decision row from Step 2**

```sql
delete from decisions where app = 'row' and category = 'weekly-coach-loop' and decision_text like 'Week of%';
```

(Only run this against the row created during this verification pass — check the `id`/`created_at` match what Step 2 produced before deleting.)

---

## Out of Scope (reiterated from the design spec)

- No changes to `coach-read.ts`
- No history/browse UI for past reviewed decisions
- No changes to the Prep Readiness Control Panel or post-workout autopsy
- No automated due-date reminder/notification
