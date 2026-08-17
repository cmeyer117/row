-- decisions: shared decision-memory table, written to by Row, Vessel,
-- Vision, and Content/Creator Intelligence. See
-- docs/superpowers/specs/2026-08-17-shared-decision-memory-design.md
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  category text,
  decision_text text not null,
  rationale text,
  expected_outcome text,
  alternatives_considered text,
  details jsonb not null default '{}',
  review_date date,
  status text not null default 'open',
  verdict text,
  outcome_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists decisions_app_status_idx on decisions (app, status, review_date);

alter table decisions enable row level security;

create policy "anon full access to decisions"
  on decisions
  for all
  to anon
  using (true)
  with check (true);
