create table if not exists food_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  name text not null,
  protein_g numeric not null default 0 check (protein_g >= 0),
  carb_g numeric not null default 0 check (carb_g >= 0),
  fat_g numeric not null default 0 check (fat_g >= 0),
  calories numeric not null default 0 check (calories >= 0),
  source text not null check (source in ('barcode', 'manual')),
  barcode text,
  created_at timestamptz not null default now(),
  constraint food_log_barcode_matches_source check (
    (source = 'barcode' and barcode is not null) or
    (source = 'manual' and barcode is null)
  )
);

create index if not exists food_log_log_date_idx on food_log (log_date);

alter table food_log enable row level security;

-- Same open-anon-RLS pattern as app_state/coaching_clients (single-user
-- tool behind topbar.js's passphrase gate) — not a new security tier.
create policy "anon full access to food_log"
  on food_log
  for all
  to anon
  using (true)
  with check (true);
