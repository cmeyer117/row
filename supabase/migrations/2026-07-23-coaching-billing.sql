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
