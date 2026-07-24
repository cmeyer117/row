// Vercel serverless function — called directly from coaching.html when
// Carl bills a client. Creates/reuses a Stripe Customer, an on-the-fly
// Price for the custom amount, and a Checkout Session; returns the hosted
// URL for Carl to send the client. Same anon-key Supabase REST pattern as
// subscribe-push.js — this dashboard has no client login, single-coach
// tool behind topbar.js's passphrase gate.
import Stripe from 'stripe';
import { validateBillingInput, dollarsToCents, buildClientLookupRequest, buildClientUpdateRequest } from './_lib/stripe-billing-logic.js';
import { verifyOwner } from './_lib/verify-owner.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
// Anon key: only for verifying the caller's owner JWT (auth/v1/user).
const SUPABASE_ANON_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
// Service-role key: the DB lookup/update below (RLS now denies anon).
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  // Owner-only: this endpoint now wields the service-role key, so it must never
  // run for an unauthenticated caller. The dashboard sends the owner's session token.
  if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
    res.status(401).json({ error: 'Unauthorized' });
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
