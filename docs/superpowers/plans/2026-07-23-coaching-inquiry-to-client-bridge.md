# Coaching Inquiry → Client Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A submitted application on the public landing page shows up in `coaching.html` as a Pending Application; Approve reuses the existing intake form to create a real `coaching_clients` row, Decline (confirmation-gated) marks it turned away without deleting it.

**Architecture:** Two additive Supabase schema changes, then `coaching.html` gets a new "Pending Applications" card wired to `coaching_inquiries`, an `Email` field added to the existing intake form, and the existing `addClientBtn` submit handler extended (not rewritten) to carry the email and flip the source inquiry's status on success.

**Tech Stack:** Vanilla HTML/JS, Supabase (shared `vikpcejlyxieguorwysf.supabase.co` project, anon publishable key `sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv`), no build step.

---

### Task 1: Supabase migration

**Files:** none (Supabase schema change via MCP tool)

- [ ] **Step 1: Apply the migration**

Call the `apply_migration` tool (project_id `vikpcejlyxieguorwysf`, name `coaching_inquiry_bridge`) with:

```sql
alter table coaching_inquiries add column status text not null default 'new';
alter table coaching_clients add column email text;
```

- [ ] **Step 2: Verify**

Run `execute_sql` (same project_id): `select column_name from information_schema.columns where table_name = 'coaching_inquiries' and column_name = 'status';`
Expected: one row.

Run `execute_sql`: `select column_name from information_schema.columns where table_name = 'coaching_clients' and column_name = 'email';`
Expected: one row.

- [ ] **Step 3: Commit**

No file changes — schema lives in Supabase, not git.

---

### Task 2: `coaching.html` — Email field + Pending Applications markup/CSS

**Files:**
- Modify: `coaching.html:44-48` (CSS, add new rules), `coaching.html:52-55` (add card + Email field)

- [ ] **Step 1: Add CSS for the inquiry rows and Decline button**

After the existing `.badge-issued { background: rgba(110,231,183,0.15); color: var(--accent); }` line, add:

```css
.inquiry-row { padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.035); margin-bottom: 8px; }
.inquiry-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; }
.inquiry-name { color: var(--text-primary); font-weight: 600; }
.inquiry-meta { font-family: var(--font-mono); font-size: 11px; color: var(--text-tertiary); margin-bottom: 6px; }
.inquiry-message { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; }
.inquiry-actions { display: flex; gap: 8px; }
.btn-decline { padding: 8px 14px; border: 1px solid rgba(255,107,107,0.3); background: transparent; color: var(--danger); border-radius: 10px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
```

- [ ] **Step 2: Add the Pending Applications card and the Email field**

Replace:

```html
<div class="page">
  <h1 class="dash-title">Coaching</h1>

  <div class="card">
    <div class="field"><label>Client name</label><input id="cName" type="text" placeholder="Client name"></div>
```

with:

```html
<div class="page">
  <h1 class="dash-title">Coaching</h1>

  <div class="card" id="inquiriesCard" style="display:none;">
    <h2 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);">Pending Applications</h2>
    <div id="inquiryList"></div>
  </div>

  <div class="card">
    <div class="field"><label>Client name</label><input id="cName" type="text" placeholder="Client name"></div>
    <div class="field"><label>Email</label><input id="cEmail" type="email" placeholder="client@email.com"></div>
```

- [ ] **Step 3: Commit**

```bash
git add coaching.html
git commit -m "feat: Pending Applications card markup + Email intake field"
```

---

### Task 3: `coaching.html` — load and render pending inquiries, Decline

**Files:**
- Modify: `coaching.html` (inside the existing `<script>` IIFE, after `archiveClient`)

- [ ] **Step 1: Add `loadInquiries`, `declineInquiry`, and the module-scoped approval tracker**

After the existing `archiveClient` function (ends `if (error) { alert('Archive failed: ' + error.message); return; } loadClients(); }`), add:

```js
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
    if (inquiry.stage) document.getElementById('cStage').value = inquiry.stage;
    if (inquiry.goal) document.getElementById('cGoal').value = inquiry.goal;
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
      meta.textContent = (inq.stage || '?') + ' · ' + (inq.goal || '?') + ' · ' + inq.email;
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
```

- [ ] **Step 2: Call `loadInquiries()` alongside the existing `loadClients()` call**

Change the final line of the IIFE from:

```js
  loadClients();
})();
```

to:

```js
  loadClients();
  loadInquiries();
})();
```

- [ ] **Step 3: Commit**

```bash
git add coaching.html
git commit -m "feat: load/render pending coaching inquiries with approve/decline"
```

---

### Task 4: `coaching.html` — carry email through, mark inquiry converted on approval

**Files:**
- Modify: `coaching.html` (the `addClientBtn` click handler)

- [ ] **Step 1: Read the email field and validate it alongside the rest of the intake**

In the `addClientBtn` handler, after `const name = document.getElementById('cName').value.trim();` and its existing empty-name check, add:

```js
    const email = document.getElementById('cEmail').value.trim();
```

- [ ] **Step 2: Include email in the `coaching_clients` insert**

In the `supa.from('coaching_clients').insert({...})` call, add `email: email,` alongside the existing `sex`/`age`/`height_in`/`weight_lb` keys.

- [ ] **Step 3: Flip the source inquiry to `converted` after a successful insert, then reset the tracker**

Replace:

```js
    if (error) { statusEl.textContent = 'Save failed: ' + error.message; btn.disabled = false; return; }
    window.location.href = 'coaching-plan.html?id=' + encodeURIComponent(data.id);
  });
```

with:

```js
    if (error) { statusEl.textContent = 'Save failed: ' + error.message; btn.disabled = false; return; }
    if (pendingApprovalInquiryId) {
      // Never blocks or rolls back client creation — the client already exists and is usable
      // even if this specific update fails; the inquiry would just stay visible as "new".
      await supa.from('coaching_inquiries').update({ status: 'converted' }).eq('id', pendingApprovalInquiryId);
      pendingApprovalInquiryId = null;
    }
    window.location.href = 'coaching-plan.html?id=' + encodeURIComponent(data.id);
  });
```

- [ ] **Step 4: Commit**

```bash
git add coaching.html
git commit -m "feat: carry email through client creation, mark approved inquiries converted"
```

---

### Task 5: End-to-end verification, deploy, HANDOFF

**Files:** none (verification + docs only)

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Live walkthrough against the real deployed sites**

On `coaching-landing-nu.vercel.app`, submit a real test application (a name you'll recognize, e.g. "E2E Bridge Test"). Confirm it inserts into `coaching_inquiries` with `status = 'new'` via `execute_sql`. Open `row-sage.vercel.app/coaching.html` (unlock with passphrase `007007`), confirm the Pending Applications card appears and shows it.

Click **Decline** on a throwaway second test inquiry (submit one more application first) — confirm the browser's confirm dialog appears, confirm cancelling leaves it in the list, confirm accepting removes it from the list and sets `status = 'declined'` via `execute_sql`.

Click **Approve** on the first test inquiry — confirm the form scrolls into view with Name/Email/Stage/Goal pre-filled. Fill in the remaining required fields (equipment, days, session length, age, height, weight — sex defaults to Male) and submit. Confirm it redirects to `coaching-plan.html?id=...` for a real new client, confirm that client's `email` column is populated, and confirm via `execute_sql` that the source inquiry now has `status = 'converted'`.

- [ ] **Step 3: Clean up test data**

Delete the test inquiries and the test client (`coaching_clients`, `coaching_inquiries` rows) created during verification, same as the cleanup done after tonight's earlier coaching-logging verification.

- [ ] **Step 4: Update HANDOFF.md**

Edit-only (never full-file Write) — add a `RESOLVED` entry under Active Focus in `G:\My Drive\Claude\HANDOFF.md` summarizing: coaching inquiry → client bridge shipped, Pending Applications card, Approve/Decline flow, commit range from Task 2 through this task.
