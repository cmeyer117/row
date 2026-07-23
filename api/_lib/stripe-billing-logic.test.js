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
