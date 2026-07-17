create table if not exists coaching_clients (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null unique,
  name text not null,
  stage text not null check (stage in ('beginner', 'intermediate', 'advanced')),
  goal text not null check (goal in ('cut', 'bulk', 'recomp', 'contest-prep')),
  equipment text not null check (equipment in ('full-gym', 'home', 'limited')),
  training_days_per_week integer not null check (training_days_per_week between 1 and 7),
  session_length integer not null check (session_length > 0),
  injury_flags text[] not null default '{}',
  needs_review boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'issued', 'archived')),
  issued_snapshot jsonb,
  personalization_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table coaching_clients enable row level security;

-- Same open-anon-RLS pattern as app_state (used by finance.html, health.html,
-- gym.html today). This is a single-coach tool behind topbar.js's passphrase
-- gate, same risk posture Row already accepts for financial/health data —
-- not introducing a new, inconsistent security tier for this one table.
create policy "anon full access to coaching_clients"
  on coaching_clients
  for all
  to anon
  using (true)
  with check (true);
