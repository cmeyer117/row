-- ============================================================
-- Coaching-layer RLS lockdown — 2026-07-23
-- Design: docs/superpowers/specs/2026-07-23-coaching-rls-lockdown-design.md
--
-- Model:  anon         -> id-scoped RPCs only (+ existing inquiry INSERT)
--         authenticated -> owner (by JWT email) full access
--         service_role  -> Vercel functions, bypasses RLS
--
-- Apply in two steps (see plan): PART A is additive/safe anytime; PART B is
-- the cutover — apply only after the RPCs + re-keyed serverless + auth gate
-- are deployed and the owner auth user exists.
-- ============================================================


-- ============================================================
-- PART A — additive (safe anytime; changes no existing policy)
-- ============================================================

create or replace function public.coaching_is_owner()
returns boolean language sql stable set search_path = '' as $$
  select (auth.jwt() ->> 'email') = 'carl.meyer.business@gmail.com';
$$;

-- Returns ONLY plan-shaping columns — never email/PII/billing.
create or replace function public.get_coaching_plan(p_id uuid)
returns table (name text, stage text, goal text, equipment text,
               training_days_per_week integer, session_length integer, injury_flags text[])
language sql security definer set search_path = '' as $$
  select name, stage, goal, equipment, training_days_per_week, session_length, injury_flags
  from public.coaching_clients where id = p_id;
$$;

create or replace function public.log_coaching_exercise(
  p_id uuid, p_exercise text, p_weight numeric, p_reps integer, p_is_bodyweight boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.coaching_clients where id = p_id) then
    raise exception 'unknown client';
  end if;
  insert into public.coaching_client_logs (client_id, exercise_name, weight, reps, is_bodyweight)
  values (p_id, p_exercise, p_weight, p_reps, p_is_bodyweight);
end;
$$;

create or replace function public.upsert_coaching_weight(p_id uuid, p_weight numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_week_start date := date_trunc('week', now())::date;  -- Monday, UTC
  v_existing bigint;
begin
  if not exists (select 1 from public.coaching_clients where id = p_id) then
    raise exception 'unknown client';
  end if;
  select id into v_existing from public.coaching_client_weights
    where client_id = p_id and logged_at >= v_week_start
    order by logged_at desc limit 1;
  if v_existing is not null then
    update public.coaching_client_weights set weight = p_weight, logged_at = current_date where id = v_existing;
  else
    insert into public.coaching_client_weights (client_id, weight, logged_at) values (p_id, p_weight, current_date);
  end if;
end;
$$;

-- anon only — the client log page is the sole caller.
revoke all on function public.get_coaching_plan(uuid) from public;
revoke all on function public.log_coaching_exercise(uuid, text, numeric, integer, boolean) from public;
revoke all on function public.upsert_coaching_weight(uuid, numeric) from public;
grant execute on function public.get_coaching_plan(uuid) to anon;
grant execute on function public.log_coaching_exercise(uuid, text, numeric, integer, boolean) to anon;
grant execute on function public.upsert_coaching_weight(uuid, numeric) to anon;


-- ============================================================
-- PART B — CUTOVER (apply only after PART A + code are live)
-- ============================================================

-- coaching_clients: drop blanket anon; owner-only.
drop policy if exists "anon full access to coaching_clients" on public.coaching_clients;
create policy "owner full access to coaching_clients"
  on public.coaching_clients for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

-- coaching_inquiries: RLS already ON; keep existing anon INSERT-only policy;
-- drop only the two anon read/write leaks (names verified live).
alter table public.coaching_inquiries enable row level security;
drop policy if exists "anon select coaching_inquiries" on public.coaching_inquiries;
drop policy if exists "anon update coaching_inquiries" on public.coaching_inquiries;
create policy "owner full access to coaching_inquiries"
  on public.coaching_inquiries for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

-- logs + weights: RLS currently OFF -> turn ON; owner full; anon via RPCs only.
alter table public.coaching_client_logs enable row level security;
create policy "owner full access to coaching_client_logs"
  on public.coaching_client_logs for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());
alter table public.coaching_client_weights enable row level security;
create policy "owner full access to coaching_client_weights"
  on public.coaching_client_weights for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());
