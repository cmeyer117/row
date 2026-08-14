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
      // return=representation (not return=minimal) so the caller can see how
      // many rows matched -- a stripe_customer_id with no matching client
      // still returns a 2xx/204 from PostgREST with zero rows affected,
      // which return=minimal makes indistinguishable from a real update
      // (row-audit-2026-08-14.md P1 #3 follow-up, Codex catch 2026-08-14).
      headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    },
  };
}
