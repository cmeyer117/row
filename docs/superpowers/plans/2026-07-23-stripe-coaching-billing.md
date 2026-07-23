# Stripe Coaching Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Carl bill coaching clients through Stripe (custom amount, one-time or recurring) from `coaching.html`, with payment status synced back via webhook.

**Architecture:** Two new Vercel serverless functions (`create-coaching-payment.js`, `stripe-webhook.js`) built on a shared pure-logic module (`stripe-billing-logic.js`, unit-tested with `node:test`), a Supabase migration adding billing columns to `coaching_clients`, and UI additions to `coaching.html` (Bill button, inline amount/frequency form, billing-status badge). Follows the existing Row pattern: raw `fetch` calls to Supabase's REST API from serverless functions (no `@supabase/supabase-js` dependency), pure request-builder functions kept separate from handlers for testability (see `api/subscribe-push-logic.js`).

**Tech Stack:** Vercel serverless functions (Node 24, ESM), Supabase Postgres (REST API, publishable key + open-anon RLS — same posture as the rest of Row), Stripe Node SDK (`stripe` npm package, official SDK — hand-rolling webhook signature verification is the wrong call on a money path), `node:test` for unit tests.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/2026-07-23-coaching-billing.sql` | Adds `stripe_customer_id`, `stripe_subscription_id`, `billing_status`, `billing_amount`, `billing_frequency` to `coaching_clients` |
| `api/stripe-billing-logic.js` | Pure functions: input validation, cents conversion, webhook-event → billing-status mapping, Supabase request builders. No network calls — fully unit-testable. |
| `api/stripe-billing-logic.test.js` | `node:test` coverage for the above |
| `api/create-coaching-payment.js` | Handler: validates input, creates/reuses Stripe Customer, creates Price + Checkout Session, updates `coaching_clients`, returns the hosted URL |
| `api/stripe-webhook.js` | Handler: verifies Stripe signature on the raw body, maps event → status, updates `coaching_clients` by `stripe_customer_id` |
| `coaching.html` | UI: "Bill" button per client row, inline amount/frequency form, billing-status badge |
| `package.json` | Adds `stripe` dependency |

---

### Task 1: Add the Stripe dependency

**Files:**
- Modify: `C:\Users\gregm\row\package.json`

- [ ] **Step 1: Add the dependency**

Edit `package.json`'s `dependencies` block to:

```json
{
  "name": "row",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "stripe": "^22.3.2",
    "web-push": "^3.6.7"
  }
}
```

- [ ] **Step 2: Install**

Run: `cd C:\Users\gregm\row && npm install`
Expected: `stripe@22.3.2` (or later 22.x) added to `node_modules`, `package-lock.json` updated.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\gregm\row
git add package.json package-lock.json
git commit -m "chore: add stripe dependency for coaching billing"
```

---

### Task 2: Supabase migration — billing columns

**Files:**
- Create: `C:\Users\gregm\row\supabase\migrations\2026-07-23-coaching-billing.sql`

- [ ] **Step 1: Write the migration**

```sql
alter table coaching_clients
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_status text not null default 'none'
    check (billing_status in ('none', 'pending', 'paid', 'past_due', 'cancelled')),
  add column if not exists billing_amount integer,
  add column if not exists billing_frequency text
    check (billing_frequency in ('one_time', 'monthly'));

-- No RLS policy change needed: "anon full access to coaching_clients"
-- (2026-07-17-coaching-clients.sql) already covers all columns on the table.
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP tool (`apply_migration`) against the Row project, or run it directly in the Supabase SQL editor. Confirm with a quick select:

```sql
select stripe_customer_id, stripe_subscription_id, billing_status, billing_amount, billing_frequency
from coaching_clients limit 1;
```

Expected: query succeeds (no "column does not exist" error), `billing_status` reads `'none'` for existing rows.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\gregm\row
git add supabase/migrations/2026-07-23-coaching-billing.sql
git commit -m "feat: add Stripe billing columns to coaching_clients"
```

---

### Task 3: Pure billing logic + tests

**Files:**
- Create: `C:\Users\gregm\row\api\stripe-billing-logic.js`
- Test: `C:\Users\gregm\row\api\stripe-billing-logic.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBillingInput,
  dollarsToCents,
  billingStatusForEvent,
  buildClientLookupRequest,
  buildClientUpdateRequest,
  buildClientUpdateByCustomerRequest,
} from './stripe-billing-logic.js';

test('validateBillingInput: valid one_time input passes', () => {
  assert.equal(validateBillingInput('client-1', 150, 'one_time'), null);
});

test('validateBillingInput: valid monthly input passes', () => {
  assert.equal(validateBillingInput('client-1', 99.5, 'monthly'), null);
});

test('validateBillingInput: missing clientId fails', () => {
  assert.equal(validateBillingInput('', 150, 'one_time'), 'Missing clientId');
});

test('validateBillingInput: zero or negative amount fails', () => {
  assert.equal(validateBillingInput('client-1', 0, 'one_time'), 'Amount must be a positive number');
  assert.equal(validateBillingInput('client-1', -20, 'one_time'), 'Amount must be a positive number');
});

test('validateBillingInput: non-numeric amount fails', () => {
  assert.equal(validateBillingInput('client-1', 'abc', 'one_time'), 'Amount must be a positive number');
  assert.equal(validateBillingInput('client-1', NaN, 'one_time'), 'Amount must be a positive number');
});

test('validateBillingInput: invalid frequency fails', () => {
  assert.equal(validateBillingInput('client-1', 150, 'yearly'), 'Frequency must be one_time or monthly');
});

test('dollarsToCents: converts and rounds correctly', () => {
  assert.equal(dollarsToCents(150), 15000);
  assert.equal(dollarsToCents(99.99), 9999);
  assert.equal(dollarsToCents(10.005), 1001); // avoid float-rounding surprises (10.005 -> 1000.5 -> rounds to 1001)
});

test('billingStatusForEvent: maps known Stripe events to billing_status', () => {
  assert.equal(billingStatusForEvent('checkout.session.completed'), 'paid');
  assert.equal(billingStatusForEvent('invoice.paid'), 'paid');
  assert.equal(billingStatusForEvent('invoice.payment_failed'), 'past_due');
  assert.equal(billingStatusForEvent('customer.subscription.deleted'), 'cancelled');
});

test('billingStatusForEvent: unknown event type returns null (no-op)', () => {
  assert.equal(billingStatusForEvent('customer.updated'), null);
});

test('buildClientLookupRequest: GET by id with correct headers', () => {
  const req = buildClientLookupRequest('https://x.supabase.co', 'key123', 'client-1');
  assert.equal(req.url, 'https://x.supabase.co/rest/v1/coaching_clients?id=eq.client-1&select=*');
  assert.equal(req.options.method, 'GET');
  assert.equal(req.options.headers.apikey, 'key123');
});

test('buildClientUpdateRequest: PATCH by id with correct body', () => {
  const req = buildClientUpdateRequest('https://x.supabase.co', 'key123', 'client-1', { billing_status: 'pending' });
  assert.equal(req.url, 'https://x.supabase.co/rest/v1/coaching_clients?id=eq.client-1');
  assert.equal(req.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(req.options.body), { billing_status: 'pending' });
});

test('buildClientUpdateByCustomerRequest: PATCH filtered by stripe_customer_id', () => {
  const req = buildClientUpdateByCustomerRequest('https://x.supabase.co', 'key123', 'cus_abc', { billing_status: 'paid' });
  assert.equal(req.url, 'https://x.supabase.co/rest/v1/coaching_clients?stripe_customer_id=eq.cus_abc');
  assert.equal(req.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(req.options.body), { billing_status: 'paid' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\gregm\row && node --test api/stripe-billing-logic.test.js`
Expected: FAIL — `Cannot find module './stripe-billing-logic.js'`

- [ ] **Step 3: Write the implementation**

```javascript
// Pure billing logic — input validation, cents conversion, webhook-event
// mapping, and Supabase REST request builders. No network calls here, same
// split as subscribe-push-logic.js, so this is unit-testable without mocks.

export function validateBillingInput(clientId, amountDollars, frequency) {
  if (!clientId) return 'Missing clientId';
  if (typeof amountDollars !== 'number' || !Number.isFinite(amountDollars) || amountDollars <= 0) {
    return 'Amount must be a positive number';
  }
  if (frequency !== 'one_time' && frequency !== 'monthly') {
    return 'Frequency must be one_time or monthly';
  }
  return null;
}

export function dollarsToCents(amountDollars) {
  return Math.round(amountDollars * 100);
}

export function billingStatusForEvent(eventType) {
  switch (eventType) {
    case 'checkout.session.completed':
    case 'invoice.paid':
      return 'paid';
    case 'invoice.payment_failed':
      return 'past_due';
    case 'customer.subscription.deleted':
      return 'cancelled';
    default:
      return null;
  }
}

export function buildClientLookupRequest(supabaseUrl, supabaseKey, clientId) {
  return {
    url: supabaseUrl + '/rest/v1/coaching_clients?id=eq.' + encodeURIComponent(clientId) + '&select=*',
    options: { method: 'GET', headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey } },
  };
}

export function buildClientUpdateRequest(supabaseUrl, supabaseKey, clientId, patch) {
  return {
    url: supabaseUrl + '/rest/v1/coaching_clients?id=eq.' + encodeURIComponent(clientId),
    options: {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    },
  };
}

export function buildClientUpdateByCustomerRequest(supabaseUrl, supabaseKey, stripeCustomerId, patch) {
  return {
    url: supabaseUrl + '/rest/v1/coaching_clients?stripe_customer_id=eq.' + encodeURIComponent(stripeCustomerId),
    options: {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\gregm\row && node --test api/stripe-billing-logic.test.js`
Expected: PASS, 13 tests passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\gregm\row
git add api/stripe-billing-logic.js api/stripe-billing-logic.test.js
git commit -m "feat: add pure billing logic + tests for Stripe coaching billing"
```

---

### Task 4: `create-coaching-payment.js` handler

**Files:**
- Create: `C:\Users\gregm\row\api\create-coaching-payment.js`

- [ ] **Step 1: Write the handler**

```javascript
// Vercel serverless function — called directly from coaching.html when
// Carl bills a client. Creates/reuses a Stripe Customer, an on-the-fly
// Price for the custom amount, and a Checkout Session; returns the hosted
// URL for Carl to send the client. Same anon-key Supabase REST pattern as
// subscribe-push.js — this dashboard has no client login, single-coach
// tool behind topbar.js's passphrase gate.
import Stripe from 'stripe';
import { validateBillingInput, dollarsToCents, buildClientLookupRequest, buildClientUpdateRequest } from './stripe-billing-logic.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { clientId, amountDollars, frequency } = req.body || {};
  const validationError = validateBillingInput(clientId, amountDollars, frequency);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  try {
    const { url: lookupUrl, options: lookupOptions } = buildClientLookupRequest(SUPABASE_URL, SUPABASE_KEY, clientId);
    const lookupRes = await fetch(lookupUrl, lookupOptions);
    if (!lookupRes.ok) {
      res.status(502).json({ error: 'Client lookup failed' });
      return;
    }
    const clients = await lookupRes.json();
    const client = clients[0];
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    let stripeCustomerId = client.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: client.name,
        email: client.email || undefined,
      });
      stripeCustomerId = customer.id;
    }

    const priceParams = {
      unit_amount: dollarsToCents(amountDollars),
      currency: 'usd',
      product_data: { name: 'Coaching — ' + client.name },
    };
    if (frequency === 'monthly') {
      priceParams.recurring = { interval: 'month' };
    }
    const price = await stripe.prices.create(priceParams);

    const session = await stripe.checkout.sessions.create({
      mode: frequency === 'monthly' ? 'subscription' : 'payment',
      customer: stripeCustomerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: 'https://row-sage.vercel.app/coaching.html?billed=success',
      cancel_url: 'https://row-sage.vercel.app/coaching.html?billed=cancelled',
    });

    const { url: updateUrl, options: updateOptions } = buildClientUpdateRequest(SUPABASE_URL, SUPABASE_KEY, clientId, {
      stripe_customer_id: stripeCustomerId,
      billing_amount: dollarsToCents(amountDollars),
      billing_frequency: frequency,
      billing_status: 'pending',
    });
    const updateRes = await fetch(updateUrl, updateOptions);
    if (!updateRes.ok) {
      // The Checkout Session already exists and is valid — don't lose it,
      // surface the link even though we failed to record it locally.
      res.status(502).json({ error: 'Payment link created but failed to save status', url: session.url });
      return;
    }

    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: 'Stripe error: ' + e.message });
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\gregm\row
git add api/create-coaching-payment.js
git commit -m "feat: add create-coaching-payment Stripe Checkout endpoint"
```

(No unit test here — this handler is a thin wire-up of already-tested logic plus live Stripe/Supabase calls; it gets exercised in Task 7's live verification instead of mocked out here.)

---

### Task 5: `stripe-webhook.js` handler

**Files:**
- Create: `C:\Users\gregm\row\api\stripe-webhook.js`

- [ ] **Step 1: Write the handler**

```javascript
// Vercel serverless function — Stripe webhook endpoint. Verifies the
// signature against the raw request body (required — never trust an
// unverified payload on a money path), maps the event to a billing_status,
// and updates the matching coaching_clients row by stripe_customer_id.
import Stripe from 'stripe';
import { billingStatusForEvent, buildClientUpdateByCustomerRequest } from './stripe-billing-logic.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Disables Vercel's automatic JSON body parsing — Stripe signature
// verification needs the exact raw bytes, not a re-serialized object.
export const config = { api: { bodyParser: false } };

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    res.status(400).json({ error: 'Signature verification failed: ' + e.message });
    return;
  }

  const newStatus = billingStatusForEvent(event.type);
  if (!newStatus) {
    res.status(200).json({ ok: true, ignored: event.type });
    return;
  }

  const obj = event.data.object;
  const stripeCustomerId = obj.customer;
  if (!stripeCustomerId) {
    res.status(200).json({ ok: true, ignored: 'no customer on event object' });
    return;
  }

  const patch = { billing_status: newStatus };
  if (event.type === 'checkout.session.completed' && obj.subscription) {
    patch.stripe_subscription_id = obj.subscription;
  }

  try {
    const { url, options } = buildClientUpdateByCustomerRequest(SUPABASE_URL, SUPABASE_KEY, stripeCustomerId, patch);
    const updateRes = await fetch(url, options);
    if (!updateRes.ok) {
      console.error('Supabase update failed for customer ' + stripeCustomerId + ': ' + updateRes.status);
    }
  } catch (e) {
    // Always ack 200 once the event itself is understood — Stripe retries
    // on non-2xx, and a transient Supabase blip here is fixable by hand,
    // not worth an infinite webhook retry storm.
    console.error('Failed to update billing status for customer ' + stripeCustomerId, e);
  }

  res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\gregm\row
git add api/stripe-webhook.js
git commit -m "feat: add Stripe webhook handler for coaching billing status"
```

---

### Task 6: `coaching.html` UI — Bill button, form, badge

**Files:**
- Modify: `C:\Users\gregm\row\coaching.html`

- [ ] **Step 1: Add CSS for the billing badge and inline form**

Add to the `<style>` block, after the existing `.badge-issued` rule (currently `coaching.html:47`):

```css
.badge-paid { background: rgba(110,231,183,0.15); color: var(--accent); }
.badge-pending { background: rgba(255,255,255,0.08); color: var(--text-tertiary); }
.badge-past_due { background: rgba(255,107,107,0.15); color: var(--danger); }
.badge-cancelled { background: rgba(255,255,255,0.08); color: var(--text-tertiary); }
.bill-btn { border: 1px solid rgba(110,231,183,0.3); background: transparent; color: var(--accent); border-radius: 10px; font-family: inherit; font-size: 11px; font-weight: 700; cursor: pointer; padding: 6px 10px; flex-shrink: 0; margin-right: 6px; }
.bill-form { background: rgba(255,255,255,0.03); border-radius: 12px; padding: 12px; margin: 8px 0; }
.bill-form .row2 { margin-bottom: 10px; }
.bill-link { font-size: 12px; word-break: break-all; color: var(--text-primary); background: rgba(0,0,0,0.3); padding: 8px 10px; border-radius: 8px; margin-top: 8px; }
```

- [ ] **Step 2: Add the billing badge to each client row**

In the `loadClients()` function (`coaching.html:192-223`), the badge-building block currently reads:

```javascript
      const badgeClass = c.status === 'issued' ? 'badge-issued' : (c.needs_review ? 'badge-review' : 'badge-draft');
      const badgeLabel = c.status === 'issued' ? 'ISSUED' : (c.needs_review ? 'NEEDS REVIEW' : 'DRAFT');
```

Replace with (adds a second, billing badge alongside the existing one):

```javascript
      const badgeClass = c.status === 'issued' ? 'badge-issued' : (c.needs_review ? 'badge-review' : 'badge-draft');
      const badgeLabel = c.status === 'issued' ? 'ISSUED' : (c.needs_review ? 'NEEDS REVIEW' : 'DRAFT');
      const billingBadge = document.createElement('span');
      if (c.billing_status && c.billing_status !== 'none') {
        billingBadge.className = 'badge badge-' + c.billing_status;
        billingBadge.textContent = c.billing_status.toUpperCase().replace('_', ' ');
      }
```

Then, further down in the same function, the row currently ends with:

```javascript
      row.appendChild(a);
      row.appendChild(badge);
      row.appendChild(archiveBtn);
      listEl.appendChild(row);
```

Replace with (adds a Bill button and the billing badge, in that order, before the existing badge/archive):

```javascript
      const billBtn = document.createElement('button');
      billBtn.type = 'button';
      billBtn.className = 'bill-btn';
      billBtn.textContent = 'Bill';
      billBtn.addEventListener('click', () => toggleBillForm(c.id));
      row.appendChild(a);
      if (c.billing_status && c.billing_status !== 'none') row.appendChild(billingBadge);
      row.appendChild(badge);
      row.appendChild(billBtn);
      row.appendChild(archiveBtn);
      listEl.appendChild(row);
      const formHolder = document.createElement('div');
      formHolder.id = 'billForm-' + c.id;
      formHolder.style.display = 'none';
      listEl.appendChild(formHolder);
```

- [ ] **Step 3: Add the inline bill-form logic**

Add this new function above `loadClients()` in the `<script>` block (after `declineInquiry`, before `approveInquiry` — anywhere in the top-level IIFE scope works since these are all plain function declarations):

```javascript
  async function toggleBillForm(clientId) {
    const holder = document.getElementById('billForm-' + clientId);
    if (!holder) return;
    if (holder.style.display === 'block') { holder.style.display = 'none'; holder.innerHTML = ''; return; }
    holder.style.display = 'block';
    holder.className = 'bill-form';
    holder.innerHTML =
      '<div class="row2">' +
      '<div class="field"><label>Amount ($)</label><input type="number" min="1" step="0.01" class="billAmount">' +
      '<div class="field"><label>Frequency</label><select class="billFreq"><option value="one_time">One-time</option><option value="monthly">Monthly</option></select></div>' +
      '</div>' +
      '<button type="button" class="btn billSubmit">Send bill</button>' +
      '<div class="billStatus" style="font-size:12px;color:var(--text-tertiary);margin-top:8px;"></div>';
    holder.querySelector('.billSubmit').addEventListener('click', () => submitBill(clientId, holder));
  }

  async function submitBill(clientId, holder) {
    const amountInput = holder.querySelector('.billAmount');
    const freqSelect = holder.querySelector('.billFreq');
    const statusEl = holder.querySelector('.billStatus');
    const amountDollars = parseFloat(amountInput.value);
    if (isNaN(amountDollars) || amountDollars <= 0) { statusEl.textContent = 'Enter a valid amount.'; return; }
    const submitBtn = holder.querySelector('.billSubmit');
    submitBtn.disabled = true;
    statusEl.textContent = 'Creating payment link...';
    try {
      const r = await fetch('/api/create-coaching-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, amountDollars, frequency: freqSelect.value }),
      });
      const data = await r.json();
      if (!r.ok) { statusEl.textContent = 'Failed: ' + (data.error || r.status); submitBtn.disabled = false; return; }
      statusEl.innerHTML = '';
      const linkEl = document.createElement('div');
      linkEl.className = 'bill-link';
      linkEl.textContent = data.url;
      statusEl.appendChild(linkEl);
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn';
      copyBtn.style.marginTop = '8px';
      copyBtn.textContent = 'Copy link';
      copyBtn.addEventListener('click', () => { navigator.clipboard.writeText(data.url); copyBtn.textContent = 'Copied!'; });
      statusEl.appendChild(copyBtn);
      loadClients();
    } catch (e) {
      statusEl.textContent = 'Request failed: ' + e.message;
      submitBtn.disabled = false;
    }
  }
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gregm\row
git add coaching.html
git commit -m "feat: add Stripe billing UI to coaching dashboard"
```

---

### Task 7: Deploy, register webhook, live-verify end-to-end

**Files:** none (deployment + configuration + verification only)

- [ ] **Step 1: Push and deploy**

```bash
cd C:\Users\gregm\row
git push
```

Confirm the deploy succeeds: `vercel ls row` or check the Vercel dashboard for a successful production deployment of `row-sage.vercel.app`.

- [ ] **Step 2: Register the Stripe webhook endpoint**

In the Stripe Dashboard (test mode, since business verification isn't done yet): Developers → Webhooks → Add endpoint.
- URL: `https://row-sage.vercel.app/api/stripe-webhook`
- Events to send: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`

Copy the endpoint's **Signing secret** (starts with `whsec_...`).

- [ ] **Step 3: Add the webhook secret to Vercel**

```bash
cd C:\Users\gregm\row
printf '<the whsec_... value>' | vercel env add STRIPE_WEBHOOK_SECRET production
printf '<the whsec_... value>' | vercel env add STRIPE_WEBHOOK_SECRET preview
printf '<the whsec_... value>' | vercel env add STRIPE_WEBHOOK_SECRET development
```

Redeploy so the new env var takes effect: `vercel --prod` (or push an empty commit / trigger via dashboard).

- [ ] **Step 4: Live-verify a one-time payment end-to-end**

1. Open `https://row-sage.vercel.app/coaching.html`, click "Bill" on a real client row, enter a test amount (e.g. `1.00`), frequency "One-time", click "Send bill".
2. Confirm a Stripe Checkout URL is returned and the "Copy link" button works.
3. Open that URL in a browser, pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.
4. Reload `coaching.html` and confirm the client's badge now reads **PAID** (not just trusting the 200 response from Checkout — confirm the badge actually flipped in the live dashboard).
5. In the Stripe Dashboard, confirm the webhook event shows a successful (200) delivery.

- [ ] **Step 5: Live-verify a monthly subscription**

Repeat Step 4 with frequency "Monthly" on a different (or the same, after resetting `billing_status`) client. Confirm `mode: subscription` produces a real Stripe Subscription, and `stripe_subscription_id` is populated on the `coaching_clients` row after payment.

- [ ] **Step 6: Verify the failure path**

Use Stripe's test card `4000 0000 0000 0341` (charge succeeds initially, then a later invoice fails) or manually trigger a test `invoice.payment_failed` event from the Stripe Dashboard's webhook testing tool. Confirm the client's badge flips to **PAST DUE**.

- [ ] **Step 7: Update HANDOFF.md**

Mark the "Stripe on Coaching Dashboard" item in `G:\My Drive\Claude\HANDOFF.md` Active Focus as RESOLVED (edit only, per the file's concurrent-write rule — never full-file `Write`), noting test-mode-only status until Carl completes Stripe business verification and the key is swapped to live mode.

---

## Notes for the implementer

- **Test-mode only until Carl finishes Stripe verification.** `STRIPE_SECRET_KEY` is currently a `sk_test_...` key — real charges are impossible until it's swapped for a live key, so Steps in Task 7 are safe to run freely.
- **Don't add a payment-history ledger, refund UI, or fixed pricing tiers** — explicitly out of scope per the design spec (`docs/superpowers/specs/2026-07-23-stripe-coaching-billing-design.md`).
- **`coaching-plan.html` and `coaching-log.html` are untouched** — this plan only touches `coaching.html` (the client-list/billing dashboard), not the per-client plan or logging pages.
