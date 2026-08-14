// Vercel serverless function — Stripe webhook endpoint. Verifies the
// signature against the raw request body (required — never trust an
// unverified payload on a money path), maps the event to a billing_status,
// and updates the matching coaching_clients row by stripe_customer_id.
import Stripe from 'stripe';
import { billingStatusForEvent, buildClientUpdateByCustomerRequest } from './_lib/stripe-billing-logic.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
// Service-role key: this endpoint is authenticated by Stripe's signature check
// below, and RLS now denies anon. Server-side secret (Vercel env), never shipped.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    // The patch itself is idempotent (same billing_status/subscription_id
    // in, same out), so letting Stripe retry a genuine write failure is
    // safe and self-healing -- unlike the old always-200 behavior, which
    // silently left a paid customer stuck at a stale billing_status until
    // someone noticed by hand (row-audit-2026-08-14.md P1 #3).
    if (!updateRes.ok) {
      console.error('Supabase update failed for customer ' + stripeCustomerId + ': ' + updateRes.status);
      res.status(502).json({ ok: false, error: 'Supabase update failed' });
      return;
    }
    // return=representation means a 2xx with zero matched rows is
    // distinguishable from a real update -- without this check, an unknown
    // stripe_customer_id (bad/missing mapping) silently no-ops and Stripe
    // never retries, since the PATCH itself still returns 2xx (Codex catch
    // 2026-08-14). Not retryable (retrying won't make the customer exist),
    // but worth a loud log for manual follow-up.
    const updatedRows = await updateRes.json();
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      console.error('Stripe webhook: no coaching_clients row matched stripe_customer_id ' + stripeCustomerId);
    }
  } catch (e) {
    console.error('Failed to update billing status for customer ' + stripeCustomerId, e);
    res.status(502).json({ ok: false, error: 'Supabase update failed' });
    return;
  }

  res.status(200).json({ ok: true });
}
