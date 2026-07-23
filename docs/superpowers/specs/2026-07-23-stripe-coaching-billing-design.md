# Stripe Billing on Coaching Dashboard — Design

## Purpose

Let Carl bill coaching clients for real money (one-time or recurring, custom amount per client) directly from `coaching.html`, and see payment status per client without leaving Row.

## Non-goals

- No client-facing payment page inside Row — client pays on Stripe's own hosted Checkout page.
- No payment history ledger in Supabase — `coaching_clients` tracks only current billing status; Stripe is the ledger of record (dashboard + exports there).
- No refund/cancel UI in Row — done directly in the Stripe Dashboard.
- No fixed pricing tiers — every client gets a custom dollar amount, decided by Carl per client.

## Architecture

```
coaching.html "Bill" button
      │
      ▼
api/create-coaching-payment.js  (Vercel serverless, new)
      │  - looks up / creates Stripe Customer for this client
      │  - creates a one-off Stripe Price (unit_amount, one_time or recurring monthly)
      │  - creates a Stripe Checkout Session (mode: payment | subscription)
      │  - stores stripe_customer_id, billing_amount, billing_frequency,
      │    billing_status='pending' on coaching_clients
      │  - returns the Checkout Session's hosted URL
      ▼
Carl copies the URL, sends it to the client (text/email) — same manual-send
pattern as everything else in this dashboard, no client login exists.
      │
      ▼
Client pays on Stripe's hosted Checkout page.
      │
      ▼
api/stripe-webhook.js  (Vercel serverless, new)
      │  - verifies Stripe-Signature against STRIPE_WEBHOOK_SECRET
      │  - checkout.session.completed      → billing_status='paid', store
      │                                        stripe_subscription_id if present
      │  - invoice.paid                     → billing_status='paid' (renewal)
      │  - invoice.payment_failed           → billing_status='past_due'
      │  - customer.subscription.deleted    → billing_status='cancelled'
      │  - all handlers keyed by stripe_customer_id, update matching coaching_clients row
      ▼
coaching.html shows a billing badge (PENDING / PAID / PAST DUE / CANCELLED)
next to each client's existing DRAFT/ISSUED badge.
```

## Data model

New migration `supabase/migrations/2026-07-23-coaching-billing.sql`, adds to `coaching_clients`:

| column | type | notes |
|---|---|---|
| `stripe_customer_id` | text, nullable | set on first billing attempt, reused after |
| `stripe_subscription_id` | text, nullable | only set for recurring |
| `billing_status` | text, default `'none'` | check in (`none`,`pending`,`paid`,`past_due`,`cancelled`) |
| `billing_amount` | integer, nullable | cents, last amount billed |
| `billing_frequency` | text, nullable | check in (`one_time`,`monthly`) |

No RLS change needed — same `anon full access to coaching_clients` policy already covers new columns.

## Components

**`api/create-coaching-payment.js`**
- Input: `{ clientId, amountDollars, frequency }` (`frequency`: `'one_time'` | `'monthly'`)
- Validates: client exists, `amountDollars > 0`, `frequency` is one of the two values
- Reuses `stripe_customer_id` if already set on the client row; else creates a Stripe Customer (email from `coaching_clients.email` if present) and persists the id
- Creates a Stripe Price (`unit_amount: amountDollars * 100`, `currency: 'usd'`, `recurring: { interval: 'month' }` only when `frequency === 'monthly'`)
- Creates a Checkout Session: `mode: frequency === 'monthly' ? 'subscription' : 'payment'`, `line_items: [{ price, quantity: 1 }]`, `success_url`/`cancel_url` pointing back to `coaching.html`
- Updates the client row: `billing_amount`, `billing_frequency`, `billing_status: 'pending'`
- Returns `{ url }` (the Checkout Session's `url` field)

**`api/stripe-webhook.js`**
- Raw-body handler (Vercel config: `bodyParser: false`) — Stripe signature verification requires the unparsed payload
- `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`
- Switch on `event.type`, resolve the affected `coaching_clients` row via `stripe_customer_id` on the event object, update `billing_status` (and `stripe_subscription_id` when present)
- Returns 200 quickly; unknown event types are ignored (200, no-op) — Stripe retries on non-2xx, so anything unhandled should still ack

**`coaching.html` UI**
- Each client row gets a "Bill" button next to Archive
- Click opens a small inline form (amount input + one-time/monthly radio), matching the existing `.card`/`.field` visual style already in the file
- Submit calls `create-coaching-payment`, shows the returned URL with a "Copy link" button (no auto-send — Carl sends it himself, consistent with the client having no login)
- Billing badge (`billing_status`) rendered next to the existing DRAFT/ISSUED/NEEDS REVIEW badge; `none` renders nothing

## Error handling

- `create-coaching-payment.js`: any Stripe API error (bad key, network) returns a 4xx/5xx with the message; UI shows it inline via the existing `addStatus`-style pattern, no silent failure
- `stripe-webhook.js`: signature verification failure → 400, logged, never trust an unverified payload
- If a webhook event references a `stripe_customer_id` with no matching `coaching_clients` row (e.g. test event, or customer deleted client-side), no-op + 200 — don't error on data that's expected to sometimes not match

## Config / prerequisites

- New Vercel env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (test-mode values available immediately on Stripe signup, no business verification required for test mode)
- New Stripe webhook endpoint registered (via Stripe Dashboard or CLI) pointing at `https://row-sage.vercel.app/api/stripe-webhook`, subscribed to: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- `stripe` npm package added to `row/package.json` dependencies

## Testing

- Unit tests (matching existing `*-logic.js`/`*-logic.test.js` split pattern in `api/`): extract the pure decision logic (amount validation, event-type → billing_status mapping) into `stripe-billing-logic.js`, test without hitting the network
- Live verification: Stripe CLI (`stripe listen --forward-to`) or Stripe's test-mode dashboard to fire a real test Checkout session end-to-end against the deployed webhook, confirm `billing_status` flips to `paid` in Supabase and the badge updates in the actual deployed dashboard — not just a mocked webhook payload
