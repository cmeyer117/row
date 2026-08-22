-- Closes two gaps found by a supabase-rls-audit pass on 2026-08-22:
-- "carl only" was the policy NAME on commitments/jarvis_tasks, but the
-- policy itself granted role `public` with `qual: true` -- no identity
-- check at all, so anyone with the anon key could read/write both tables
-- directly via PostgREST regardless of what Carl's own app code calls.
-- decisions had the same shape (authenticated + qual true, no owner
-- check) -- harmless today since Carl is the only authenticated
-- principal in this project, but a landmine once client auth
-- (docs/superpowers/plans/2026-08-09-standalone-coaching-app-plan2-scaffold-auth.md)
-- ships. All three now match every sibling table's pattern (app_state,
-- food_log, etc.).
drop policy "carl only" on public.commitments;
create policy "owner full access to commitments"
  on public.commitments
  for all
  to authenticated
  using (coaching_is_owner())
  with check (coaching_is_owner());

drop policy "carl only" on public.jarvis_tasks;
create policy "owner full access to jarvis_tasks"
  on public.jarvis_tasks
  for all
  to authenticated
  using (coaching_is_owner())
  with check (coaching_is_owner());

drop policy "authenticated full access to decisions" on public.decisions;
create policy "owner full access to decisions"
  on public.decisions
  for all
  to authenticated
  using (coaching_is_owner())
  with check (coaching_is_owner());
