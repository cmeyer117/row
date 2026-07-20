create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app in ('row', 'vessel')),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists push_subscriptions_app_idx on push_subscriptions (app);

alter table push_subscriptions enable row level security;

-- Same open-anon-RLS pattern as app_state/food_log (single-user tool
-- behind topbar.js's passphrase gate) — not a new security tier.
create policy "anon full access to push_subscriptions"
  on push_subscriptions
  for all
  to anon
  using (true)
  with check (true);
