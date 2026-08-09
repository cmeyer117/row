# Standalone Coaching App — Plan 3: Feature Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `index.html`'s placeholder with the real owner dashboard (client list, add-client, inquiries), add the owner-only plan editor, and build the client-facing workout log page — all reading/writing against Plan 1's Supabase project through real sessions, no billing UI yet (that's Plan 4, alongside the Stripe endpoints it needs).

**Architecture:** Direct port of Row's `coaching.html`/`coaching-plan.html`/`coaching-log.html`, corrected against their *actual* current behavior (verified by reading the real files, not the design spec's earlier paraphrase — see "Correction" below). Owner pages read Supabase tables directly, same as Row, since Plan 1's owner RLS policy already grants full access to any table for the `coaching_is_owner()` session. The client page is the one genuine rewrite: Row's `coaching-log.html` identifies the client via an unauthenticated `?id=` URL parameter and calls `p_id`-scoped RPCs; this app's `client-log.html` has no URL parameter at all — identity comes entirely from the client's own session, via the zero-parameter RPCs Plan 1 already built (`get_my_coaching_plan()`, `log_my_exercise()`, `upsert_my_weight()`).

**Correction from the design spec:** the spec's feature-mapping table said `coaching-plan.html` "serves both roles" (owner and client). Reading the actual file shows this is wrong — `coaching-plan.html` is linked only from `coaching.html`'s owner-gated client list and is itself gated by `coaching-auth.js` (owner login). Clients in Row today never see it; they only ever see `coaching-log.html` via their bare `?id=` link. This plan ports each page against its *real* current audience, not the spec's inaccurate paraphrase.

**Tech Stack:** Same as Plan 2 — vanilla HTML/JS, `window.supa` from the shared client, no build step.

**Reference:** Plan 1 (Supabase project `bygkogytbxinubsnkwje`, RPCs), Plan 2 (`coaching-auth.js`, `supabase-client.js`, login pages, live at `https://coaching-app-delta-ten.vercel.app`). Row source being ported: `row/coaching.html`, `row/coaching-plan.html`, `row/coaching-log.html`, `row/coaching-templates.js`, `row/coaching-exercise-meta.js`, `row/macro-calc.js`, `row/coaching-diet-trend.js`.

---

## File Structure

- `coaching-app/coaching-templates.js`, `coaching-exercise-meta.js`, `macro-calc.js`, `coaching-diet-trend.js` — ported verbatim from `row/` (pure logic, zero DB/auth code, confirmed by reading their usage sites — no changes needed)
- Modify: `coaching-app/index.html` — replace the Task 2 placeholder with the real owner dashboard
- Create: `coaching-app/plan-editor.html` — owner-only plan view/edit/issue (ported from `row/coaching-plan.html`)
- Create: `coaching-app/client-log.html` — client-facing workout log (rewritten from `row/coaching-log.html` for session-derived identity)
- Modify: `coaching-app/client-auth-callback.html` — redirect to `client-log.html` after a successful claim instead of showing a static message

## Task 1: Port the pure logic files

**Files:**
- Create: `C:\Users\gregm\coaching-app\coaching-templates.js` (copy of `row/coaching-templates.js`, byte-for-byte)
- Create: `C:\Users\gregm\coaching-app\coaching-exercise-meta.js` (copy of `row/coaching-exercise-meta.js`)
- Create: `C:\Users\gregm\coaching-app\macro-calc.js` (copy of `row/macro-calc.js`)
- Create: `C:\Users\gregm\coaching-app\coaching-diet-trend.js` (copy of `row/coaching-diet-trend.js`)

- [ ] **Step 1: Copy all four files verbatim**

```bash
cp C:/Users/gregm/row/coaching-templates.js C:/Users/gregm/coaching-app/coaching-templates.js
cp C:/Users/gregm/row/coaching-exercise-meta.js C:/Users/gregm/coaching-app/coaching-exercise-meta.js
cp C:/Users/gregm/row/macro-calc.js C:/Users/gregm/coaching-app/macro-calc.js
cp C:/Users/gregm/row/coaching-diet-trend.js C:/Users/gregm/coaching-app/coaching-diet-trend.js
```

- [ ] **Step 2: Confirm none of the four reference Supabase, `supa`, `clientId`, or any DOM element ID that doesn't already exist in the copied pages**

```bash
grep -l "supabase\|supa\.\|clientId" C:/Users/gregm/coaching-app/coaching-templates.js C:/Users/gregm/coaching-app/coaching-exercise-meta.js C:/Users/gregm/coaching-app/macro-calc.js C:/Users/gregm/coaching-app/coaching-diet-trend.js
```

Expected: no output (confirms these are genuinely pure logic files, safe to port unmodified).

- [ ] **Step 3: Commit**

```bash
cd C:\Users\gregm\coaching-app
git add coaching-templates.js coaching-exercise-meta.js macro-calc.js coaching-diet-trend.js
git commit -m "feat: port pure plan/macro logic files from row"
git push
```

---

## Task 2: Real owner dashboard

**Files:**
- Modify: `C:\Users\gregm\coaching-app\index.html`

- [ ] **Step 1: Replace the entire file with the real dashboard**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Coaching App — Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
<script src="coaching-auth.js"></script>
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
.client-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.035); margin-bottom: 6px; }
.client-link { display: flex; flex-direction: column; text-decoration: none; flex: 1; min-width: 0; }
.archive-btn { border: 0; background: transparent; color: var(--text-tertiary); font-size: 11px; cursor: pointer; padding: 6px 8px; flex-shrink: 0; }
.archive-btn:hover { color: var(--danger); }
.client-name { color: var(--text-primary); font-weight: 600; }
.client-meta { font-family: var(--font-mono); font-size: 11px; color: var(--text-tertiary); }
.badge { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; }
.badge-draft { background: rgba(255,255,255,0.08); color: var(--text-tertiary); }
.badge-review { background: rgba(255,107,107,0.15); color: var(--danger); }
.badge-issued { background: rgba(110,231,183,0.15); color: var(--accent); }
.inquiry-row { padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.035); margin-bottom: 8px; }
.inquiry-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; }
.inquiry-name { color: var(--text-primary); font-weight: 600; }
.inquiry-meta { font-family: var(--font-mono); font-size: 11px; color: var(--text-tertiary); margin-bottom: 6px; }
.inquiry-message { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; }
.inquiry-actions { display: flex; gap: 8px; }
.btn-decline { padding: 8px 14px; border: 1px solid rgba(255,107,107,0.3); background: transparent; color: var(--danger); border-radius: 10px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
<div class="page">
  <h1 class="dash-title">Coaching</h1>

  <div class="card" id="inquiriesCard" style="display:none;">
    <h2 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);">Pending Applications</h2>
    <div id="inquiryList"></div>
  </div>

  <div class="card">
    <div class="field"><label>Client name</label><input id="cName" type="text" placeholder="Client name"></div>
    <div class="field"><label>Email</label><input id="cEmail" type="email" placeholder="client@email.com"></div>
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
  const supa = window.supa;

  function genPlanId() {
    return 'plan_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function archiveClient(id, name) {
    if (!confirm('Archive ' + name + '? This hides them from the list but keeps their record.')) return;
    const { error } = await supa.from('coaching_clients').update({ status: 'archived' }).eq('id', id);
    if (error) { alert('Archive failed: ' + error.message); return; }
    loadClients();
  }

  let pendingApprovalInquiryId = null;

  async function declineInquiry(id, name) {
    if (!confirm('Decline ' + name + '\'s application? This can\'t be easily undone from here.')) return;
    const { error } = await supa.from('coaching_inquiries').update({ status: 'declined' }).eq('id', id);
    if (error) { alert('Decline failed: ' + error.message); return; }
    loadInquiries();
  }

  function approveInquiry(inquiry) {
    pendingApprovalInquiryId = inquiry.id;
    document.getElementById('cName').value = inquiry.name || '';
    document.getElementById('cEmail').value = inquiry.email || '';
    document.getElementById('cName').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function loadInquiries() {
    const { data, error } = await supa.from('coaching_inquiries').select('*').eq('status', 'new').order('created_at', { ascending: false });
    const cardEl = document.getElementById('inquiriesCard');
    const listEl = document.getElementById('inquiryList');
    listEl.innerHTML = '';
    if (error || !data || data.length === 0) { cardEl.style.display = 'none'; return; }
    cardEl.style.display = 'block';
    data.forEach((inq) => {
      const row = document.createElement('div');
      row.className = 'inquiry-row';
      const top = document.createElement('div');
      top.className = 'inquiry-top';
      top.innerHTML = '<span class="inquiry-name">' + window.CoachingTemplates.escapeHtml(inq.name) + '</span>';
      const meta = document.createElement('div');
      meta.className = 'inquiry-meta';
      meta.textContent = inq.email;
      row.appendChild(top);
      row.appendChild(meta);
      if (inq.message) {
        const msg = document.createElement('div');
        msg.className = 'inquiry-message';
        msg.textContent = inq.message;
        row.appendChild(msg);
      }
      const actions = document.createElement('div');
      actions.className = 'inquiry-actions';
      const approveBtn = document.createElement('button');
      approveBtn.type = 'button';
      approveBtn.className = 'btn';
      approveBtn.textContent = 'Approve';
      approveBtn.addEventListener('click', () => approveInquiry(inq));
      const declineBtn = document.createElement('button');
      declineBtn.type = 'button';
      declineBtn.className = 'btn-decline';
      declineBtn.textContent = 'Decline';
      declineBtn.addEventListener('click', () => declineInquiry(inq.id, inq.name));
      actions.appendChild(approveBtn);
      actions.appendChild(declineBtn);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  async function loadClients() {
    const { data, error } = await supa.from('coaching_clients').select('*').neq('status', 'archived').order('created_at', { ascending: false });
    const listEl = document.getElementById('clientList');
    const emptyEl = document.getElementById('emptyClients');
    listEl.innerHTML = '';
    if (error || !data || data.length === 0) { emptyEl.style.display = 'block'; return; }
    emptyEl.style.display = 'none';

    data.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'client-row';
      const badgeClass = c.status === 'issued' ? 'badge-issued' : (c.needs_review ? 'badge-review' : 'badge-draft');
      const badgeLabel = c.status === 'issued' ? 'ISSUED' : (c.needs_review ? 'NEEDS REVIEW' : 'DRAFT');
      const a = document.createElement('a');
      a.href = 'plan-editor.html?id=' + encodeURIComponent(c.id);
      a.className = 'client-link';
      a.innerHTML =
        '<div class="client-name">' + window.CoachingTemplates.escapeHtml(c.name) + '</div>' +
        '<div class="client-meta">' + window.CoachingTemplates.escapeHtml(c.stage) + ' · ' + window.CoachingTemplates.escapeHtml(c.goal) + ' · ' + window.CoachingTemplates.escapeHtml(c.plan_id) +
        (c.auth_user_id ? ' · claimed' : ' · not claimed yet') + '</div>';
      const badge = document.createElement('span');
      badge.className = 'badge ' + badgeClass;
      badge.textContent = badgeLabel;
      const archiveBtn = document.createElement('button');
      archiveBtn.type = 'button';
      archiveBtn.className = 'archive-btn';
      archiveBtn.textContent = 'Archive';
      archiveBtn.addEventListener('click', () => archiveClient(c.id, c.name));
      row.appendChild(a);
      row.appendChild(badge);
      row.appendChild(archiveBtn);
      listEl.appendChild(row);
    });
  }

  document.getElementById('addClientBtn').addEventListener('click', async () => {
    const btn = document.getElementById('addClientBtn');
    btn.disabled = true;
    const statusEl = document.getElementById('addStatus');
    const name = document.getElementById('cName').value.trim();
    if (!name) { statusEl.textContent = 'Client name required.'; btn.disabled = false; return; }
    const email = document.getElementById('cEmail').value.trim();
    if (!email) { statusEl.textContent = 'Email required — needed to invite the client later.'; btn.disabled = false; return; }
    const intake = {
      stage: document.getElementById('cStage').value,
      goal: document.getElementById('cGoal').value,
      equipment: document.getElementById('cEquip').value,
      trainingDaysPerWeek: parseInt(document.getElementById('cDays').value, 10),
      sessionLength: parseInt(document.getElementById('cLength').value, 10),
      injuryFlags: Array.from(document.querySelectorAll('.injFlag:checked')).map((el) => el.value)
    };
    intake.sex = document.getElementById('cSex').value;
    intake.age = parseInt(document.getElementById('cAge').value, 10);
    intake.heightIn = parseInt(document.getElementById('cHeight').value, 10);
    intake.weightLb = parseInt(document.getElementById('cWeight').value, 10);
    if (isNaN(intake.trainingDaysPerWeek) || intake.trainingDaysPerWeek < 1 || intake.trainingDaysPerWeek > 7) { statusEl.textContent = 'Training days must be 1-7.'; btn.disabled = false; return; }
    if (isNaN(intake.sessionLength) || intake.sessionLength <= 0) { statusEl.textContent = 'Session length must be greater than 0.'; btn.disabled = false; return; }
    if (isNaN(intake.age) || intake.age < 13 || intake.age > 100) { statusEl.textContent = 'Age must be 13-100.'; btn.disabled = false; return; }
    if (isNaN(intake.heightIn) || intake.heightIn <= 0) { statusEl.textContent = 'Height must be greater than 0.'; btn.disabled = false; return; }
    if (isNaN(intake.weightLb) || intake.weightLb <= 0) { statusEl.textContent = 'Weight must be greater than 0.'; btn.disabled = false; return; }
    const needsReview = window.CoachingTemplates.needsReview(intake);
    const { data, error } = await supa.from('coaching_clients').insert({
      plan_id: genPlanId(),
      name: name,
      email: email,
      stage: intake.stage,
      goal: intake.goal,
      equipment: intake.equipment,
      training_days_per_week: intake.trainingDaysPerWeek,
      session_length: intake.sessionLength,
      injury_flags: intake.injuryFlags,
      sex: intake.sex,
      age: intake.age,
      height_in: intake.heightIn,
      weight_lb: intake.weightLb,
      needs_review: needsReview,
      status: 'draft'
    }).select().single();
    if (error) { statusEl.textContent = 'Save failed: ' + error.message; btn.disabled = false; return; }
    if (pendingApprovalInquiryId) {
      await supa.from('coaching_inquiries').update({ status: 'converted' }).eq('id', pendingApprovalInquiryId);
      pendingApprovalInquiryId = null;
    }
    window.location.href = 'plan-editor.html?id=' + encodeURIComponent(data.id);
  });

  window.CoachingAuth.ensure().then(function () {
    document.querySelector('.page').style.display = 'block';
    loadClients();
    loadInquiries();
  });
})();
</script>
</body>
</html>
```

Note what's deliberately cut from Row's version: the "Bill" button, `toggleBillForm`/`submitBill`, and billing status badges — those call `/api/create-coaching-payment`, which doesn't exist in this app yet (Plan 4 builds it alongside the button, so nothing here links to a 404). `email` is now a required field (Row's version made it optional) since this app needs it to invite the client later — a real, deliberate behavior change, not an oversight.

- [ ] **Step 2: Commit and deploy**

```bash
cd C:\Users\gregm\coaching-app
git add index.html
git commit -m "feat: real owner dashboard (client list, add-client, inquiries)"
git push
vercel deploy --prod --yes
```

- [ ] **Step 3: Verify — log in as owner, add one real client**

Sign in at `login.html`, use the dashboard's "Add Client" form to create a real client (any test name/email), confirm it appears in the client list with a "not claimed yet" note and a DRAFT badge, and confirm clicking it navigates to `plan-editor.html?id=...` (Task 3 builds that page next — expect a 404 or blank page until then, that's fine).

---

## Task 3: Owner plan editor

**Files:**
- Create: `C:\Users\gregm\coaching-app\plan-editor.html`

- [ ] **Step 1: Write the full page (ported from `row/coaching-plan.html`)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plan Editor — Coaching App</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
<script src="coaching-auth.js"></script>
<script src="coaching-templates.js"></script>
<script src="coaching-exercise-meta.js"></script>
<script src="macro-calc.js"></script>
<script src="coaching-diet-trend.js"></script>
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
#printNote { display: none; }
@media print {
  #printNote, .section-card, .plan-header { background: none; border: none; color: #000; }
  body { background: #fff; color: #000; padding: 20px; }
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
    <div style="margin-top:8px;"><button type="button" class="btn" id="confirmReviewBtn">Mark reviewed</button></div>
  </div>

  <div class="section-card">
    <h2>Training</h2>
    <div id="trainingSummary" style="margin-bottom:10px;"></div>
    <div id="trainingDays"></div>
    <div id="equipmentNote" style="margin-top:8px;font-size:12px;color:var(--danger);"></div>
    <div id="availabilityNote" style="margin-top:8px;font-size:12px;color:var(--text-tertiary);"></div>
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

  <div class="section-card">
    <h2>Personalization note (for <span id="noteClientName"></span>, <span id="notePlanId"></span>)</h2>
    <textarea id="personalizationNote" placeholder="Written separately — paste in, don't generate here."></textarea>
    <div style="margin-top:10px;">
      <button type="button" class="btn btn-secondary" id="saveNoteBtn">Save note</button>
    </div>
  </div>

  <div id="printNote" class="section-card"></div>

  <div style="margin-top:10px;">
    <button type="button" class="btn" id="markIssuedBtn">Mark Issued</button>
    <button type="button" class="btn btn-secondary" id="printBtn">Print / Save PDF</button>
  </div>
</div>

<script>
(function () {
  'use strict';
  const supa = window.supa;
  const clientId = new URLSearchParams(window.location.search).get('id');
  let currentClient = null;

  function activityLevelFor(daysPerWeek) {
    if (daysPerWeek <= 2) return 2;
    if (daysPerWeek <= 4) return 3;
    return 4;
  }

  function renderPlan(client, plan, realMacros, trendSuggestion) {
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
    if (realMacros) {
      document.getElementById('dietSummary').textContent =
        realMacros.calories + ' cal · ' + realMacros.proteinG + 'g protein · ' + realMacros.fatG + 'g fat · ' + realMacros.carbG + 'g carb';
      document.getElementById('dietApproach').textContent = plan.diet.approach;
      document.getElementById('dietFood').textContent = plan.diet.foodGuidance + (trendSuggestion ? ' — ' + trendSuggestion.reason : '');
    } else {
      document.getElementById('dietSummary').textContent = plan.diet.summary;
      document.getElementById('dietApproach').textContent = plan.diet.approach;
      document.getElementById('dietFood').textContent = plan.diet.foodGuidance;
    }
    document.getElementById('adviceText').textContent = plan.advice;
    document.getElementById('personalizationNote').value = client.personalization_note || '';
    document.getElementById('availabilityNote').textContent = 'Client availability: ' + client.training_days_per_week + ' days/week, ' +
      client.session_length + ' min sessions — template above runs its own fixed split, adjust manually if it doesn\'t match.';
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
    const plan = (data.status === 'issued' && data.issued_snapshot) ? data.issued_snapshot.plan : window.CoachingTemplates.assemblePlan(intake);
    const { data: weightRows } = await supa.from('coaching_client_weights').select('weight, logged_at').eq('client_id', clientId).order('logged_at', { ascending: true });
    const latestWeight = (weightRows && weightRows.length) ? weightRows[weightRows.length - 1].weight : data.weight_lb;
    let realMacros = null;
    if (data.sex && data.age && data.height_in && latestWeight) {
      realMacros = window.MacroCalc.calculateMacros({ sex: data.sex, age: data.age, heightIn: data.height_in, weightLb: latestWeight, activityLevel: activityLevelFor(data.training_days_per_week), goal: data.goal });
    }
    const trendSuggestion = (weightRows && weightRows.length >= 2) ? window.CoachingDietTrend.suggestCalorieAdjustment(data.goal, weightRows) : null;
    renderPlan(data, plan, realMacros, trendSuggestion);
  }

  document.getElementById('confirmReviewBtn').addEventListener('click', async () => {
    const { error } = await supa.from('coaching_clients').update({ needs_review: false }).eq('id', clientId);
    if (error) { alert('Save failed: ' + error.message); return; }
    currentClient.needs_review = false;
    document.getElementById('reviewBanner').style.display = 'none';
  });

  document.getElementById('saveNoteBtn').addEventListener('click', async () => {
    const note = document.getElementById('personalizationNote').value;
    const { error } = await supa.from('coaching_clients').update({ personalization_note: note }).eq('id', clientId);
    if (error) { alert('Save failed: ' + error.message); return; }
    currentClient.personalization_note = note;
    alert('Note saved.');
  });

  document.getElementById('markIssuedBtn').addEventListener('click', async () => {
    if (currentClient.needs_review) { alert('Mark reviewed before issuing.'); return; }
    const intake = { stage: currentClient.stage, goal: currentClient.goal, equipment: currentClient.equipment, trainingDaysPerWeek: currentClient.training_days_per_week, sessionLength: currentClient.session_length, injuryFlags: currentClient.injury_flags || [] };
    const plan = window.CoachingTemplates.assemblePlan(intake);
    const note = document.getElementById('personalizationNote').value;
    const snapshot = { plan: plan, personalizationNote: note, issuedAt: new Date().toISOString() };
    const { error } = await supa.from('coaching_clients').update({ status: 'issued', issued_snapshot: snapshot, personalization_note: note }).eq('id', clientId);
    if (error) { alert('Save failed: ' + error.message); return; }
    alert('Plan marked issued.');
    load();
  });

  document.getElementById('printBtn').addEventListener('click', () => window.print());

  window.CoachingAuth.ensure().then(load);
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Commit and deploy**

```bash
cd C:\Users\gregm\coaching-app
git add plan-editor.html
git commit -m "feat: owner plan editor (view, note, mark issued)"
git push
vercel deploy --prod --yes
```

- [ ] **Step 3: Verify — open the test client's plan editor**

From the dashboard, click the test client added in Task 2. Confirm the plan renders (training days, diet, advice), save a personalization note, confirm it persists on reload, click "Mark Issued," confirm the status badge on the dashboard updates to ISSUED.

---

## Task 4: Client-facing workout log page

**Files:**
- Create: `C:\Users\gregm\coaching-app\client-log.html`
- Modify: `C:\Users\gregm\coaching-app\client-auth-callback.html`

- [ ] **Step 1: Write `client-log.html` — rewritten for session-derived identity, no `?id=` param**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Log — Coaching</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
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
  <div class="card" id="dayCard" style="display:none;"><div id="dayButtons"></div></div>
  <div class="card" id="exCard" style="display:none;"><div id="exList"></div></div>
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
  const supa = window.supa;
  let plan = null;

  // Same progression logic as gym.html/plan-editor.html — no p_id, RPC
  // derives the caller's client_id from their session.
  function roundToStep(v, s) { return Math.round(v / s) * s; }
  function getRx(ex, logs) {
    if (!logs.length) return null;
    const last = logs[logs.length - 1];
    const { weight, reps } = last;
    const { repMin, repMax, step, bw } = ex;
    const upgradeAt = Math.min(8, repMax);
    let stuck = 0;
    for (let i = logs.length - 1; i >= 0; i--) { if (logs[i].weight === weight) stuck++; else break; }
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

  // No p_id parameter — the RPC has no way to be pointed at another
  // client's logs even if this function's argument were tampered with,
  // since it only ever filters by auth.uid() server-side.
  async function getClientLogs(exerciseName) {
    const { data, error } = await supa.rpc('get_client_exercise_logs', { p_exercise: exerciseName });
    return (error || !data) ? [] : data;
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
        '<div class="ex-name">' + window.CoachingTemplates.escapeHtml(exName) +
          '<div class="rx-tag" data-rx="' + window.CoachingTemplates.escapeHtml(exName) + '" style="font-size:11px;color:var(--accent);margin-top:2px;"></div>' +
        '</div>' +
        '<input class="ex-input" type="number" placeholder="lb" data-ex="' + window.CoachingTemplates.escapeHtml(exName) + '" data-field="weight">' +
        '<input class="ex-input" type="number" placeholder="reps" data-ex="' + window.CoachingTemplates.escapeHtml(exName) + '" data-field="reps">' +
        '<button type="button" class="btn log-btn" data-ex="' + window.CoachingTemplates.escapeHtml(exName) + '">Log</button>';
      exListEl.appendChild(row);
    });
    refreshAllRx(exListEl);
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
        const { error } = await supa.rpc('log_my_exercise', { p_exercise: exName, p_weight: weight, p_reps: reps, p_is_bodyweight: meta.bw });
        btn.textContent = error ? 'Failed' : 'Logged';
        if (!error) { weightEl.value = ''; repsEl.value = ''; await refreshRx(exListEl, exName); }
        btn.disabled = false;
      });
    });
  }

  async function refreshRx(container, exName) {
    const span = container.querySelector('[data-rx="' + CSS.escape(exName) + '"]');
    if (!span) return;
    const logs = await getClientLogs(exName);
    if (!logs.length) { span.textContent = ''; return; }
    const rx = getRx(window.CoachingExerciseMeta.getMeta(exName), logs);
    span.textContent = rx ? 'NEXT: ' + (rx.bw ? rx.reps + ' reps' : rx.weight + 'lb x ' + rx.reps) + ' (' + rx.tag + ')' : '';
  }

  function refreshAllRx(container) {
    container.querySelectorAll('[data-rx]').forEach((span) => refreshRx(container, span.dataset.rx));
  }

  async function load() {
    const session = await supa.auth.getSession();
    if (!session.data.session) { window.location.href = 'client-login.html'; return; }
    const { data: rows, error } = await supa.rpc('get_my_coaching_plan');
    const data = rows && rows[0];
    if (error || !data) { document.getElementById('clientTitle').textContent = 'No plan found for this account yet.'; return; }
    document.getElementById('clientTitle').textContent = data.name;
    const intake = { stage: data.stage, goal: data.goal, equipment: data.equipment, trainingDaysPerWeek: data.training_days_per_week, sessionLength: data.session_length, injuryFlags: data.injury_flags || [] };
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
    const result = await supa.rpc('upsert_my_weight', { p_weight: weight });
    statusEl.textContent = result.error ? 'Save failed: ' + result.error.message : 'Saved.';
  });

  load();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Add the missing `get_client_exercise_logs()` RPC — Plan 1 gap found while writing this page**

Plan 1 built `log_my_exercise()` (write) but never built a matching session-derived *read* RPC for a single exercise's history — Row's version reads `coaching_client_logs` directly (fine there, owner-gated), but this app's client page can't do that (clients only have `select` policies scoped by `client_id`, and reading by exercise name needs its own RPC to stay consistent with "no client-supplied identity" the way `get_my_coaching_plan` already is). Adding it now rather than letting `client-log.html` silently fail on progression display.

```sql
create or replace function public.get_client_exercise_logs(p_exercise text)
returns table (weight numeric, reps integer)
language sql security definer set search_path = '' as $$
  select l.weight, l.reps from public.coaching_client_logs l
  join public.coaching_clients c on c.id = l.client_id
  where c.auth_user_id = auth.uid() and l.exercise_name = p_exercise
  order by l.logged_at asc;
$$;

revoke all on function public.get_client_exercise_logs(text) from public;
grant execute on function public.get_client_exercise_logs(text) to authenticated;
```

Apply via the Supabase MCP `apply_migration` tool against project `bygkogytbxinubsnkwje`, then add this to `coaching-app/supabase/migrations/0003-client-exercise-logs.sql` and commit it there (this migration belongs with Plan 1's others, not this plan's app-code commits).

- [ ] **Step 3: Update `client-auth-callback.html` to redirect into the real log page**

```javascript
// Replace the two "Welcome, ' + claim.data[0].name + '..." lines with:
window.location.href = 'client-log.html';
```

Full updated callback script:

```html
<script>
(async function () {
  var statusEl = document.getElementById('status');
  window.supa.auth.onAuthStateChange(async function (event, session) {
    if (event !== 'SIGNED_IN' || !session) return;
    var claim = await window.supa.rpc('claim_client_profile');
    if (claim.error) {
      statusEl.textContent = 'Sign-in worked, but no matching client profile was found: ' + claim.error.message;
      return;
    }
    window.location.href = 'client-log.html';
  });
  var existing = await window.supa.auth.getSession();
  if (existing.data.session) {
    var claim2 = await window.supa.rpc('claim_client_profile');
    if (!claim2.error) window.location.href = 'client-log.html';
  }
})();
</script>
```

- [ ] **Step 4: Commit and deploy**

```bash
cd C:\Users\gregm\coaching-app
git add client-log.html client-auth-callback.html
git commit -m "feat: client-facing workout log page (session-derived, no url id)"
git push
vercel deploy --prod --yes
```

---

## Task 5: End-to-end verification with real feature usage

Beyond Plan 1's raw-RPC isolation tests, this confirms the actual pages work together.

- [ ] **Step 1: Owner side — already covered by Task 2/3's verification steps.**

- [ ] **Step 2: Client side — needs Carl (real login/inbox, same as Plan 2's pattern)**

Once the Supabase email rate limit clears: invite the same test client added in Task 2 (owner dashboard's client row will need an invite mechanism — reuse `index.html`'s "Send test invite" test button from Plan 2 for now, pointed at the real test client's email; a proper per-client invite button is a small Plan 4/5 follow-up, not blocking this check). Click the magic link, confirm it lands on `client-log.html` (not the old placeholder message), confirm the assigned training days render, log one real set, confirm "Logged" appears and the NEXT rx tag updates, save a weight, confirm it saves.

- [ ] **Step 3: Confirm cross-client isolation still holds with real app usage, not just raw RPC calls**

If two test clients exist, log in as each in separate sessions (or sequentially, signing out between) and confirm neither's `client-log.html` shows the other's exercise history or plan — this is Plan 1's isolation guarantee, now exercised through the actual UI instead of direct API calls.

---

## Self-Review

**Spec coverage:** Feature mapping's `coaching.html`→dashboard, `coaching-plan.html`→plan-editor (owner-only, corrected from spec), `coaching-log.html`→client-log (session-derived) all covered. Pure logic files ported. Billing explicitly deferred to Plan 4 with no dead links left behind.

**Placeholder scan:** none. The one plan-relative gap (`get_client_exercise_logs` missing from Plan 1) is fixed inline in Task 4, not deferred as a TODO.

**Consistency check:** `window.supa` used throughout (matches Plan 2). RPC names match Plan 1 exactly except the one addition, which follows the same `session-derived, no p_id` naming convention (`get_my_...`/`log_my_...`/`upsert_my_...`/`get_client_...`).

## What Plan 4 picks up

Stripe repoint (`create-coaching-payment.js`, `stripe-webhook.js`) and the dashboard's Bill button/billing badges, deliberately left out of this plan.
