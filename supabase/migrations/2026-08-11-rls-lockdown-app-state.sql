-- ============================================================
-- app_state / food_log / push_subscriptions / workout_events
-- RLS lockdown — 2026-08-11
-- Design: docs/superpowers/specs/2026-08-11-rls-lockdown-app-state-design.md
--
-- Reuses coaching_is_owner() from the 2026-07-23 coaching lockdown --
-- same owner, no new function needed.
--
-- CUTOVER — apply only after Row (real login), Jarvis (service_role), and
-- Vision (service_role) are deployed and live-verified. See the plan's
-- Task 15-19 checklist.
-- ============================================================

drop policy if exists "anon read" on public.app_state;
drop policy if exists "anon update" on public.app_state;
drop policy if exists "anon write" on public.app_state;
create policy "owner full access to app_state"
  on public.app_state for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

drop policy if exists "anon full access to food_log" on public.food_log;
create policy "owner full access to food_log"
  on public.food_log for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

drop policy if exists "anon full access to push_subscriptions" on public.push_subscriptions;
create policy "owner full access to push_subscriptions"
  on public.push_subscriptions for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

drop policy if exists "anon read" on public.workout_events;
drop policy if exists "anon update" on public.workout_events;
drop policy if exists "anon write" on public.workout_events;
create policy "owner full access to workout_events"
  on public.workout_events for all to authenticated
  using (public.coaching_is_owner()) with check (public.coaching_is_owner());

-- Storage: progress-photos / hype-audio -- lock the anon upload policy,
-- leave public read as-is (existing accepted design, unguessable UUID
-- filenames, not part of this fix).
drop policy if exists "anon upload progress-photos" on storage.objects;
create policy "owner upload progress-photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and public.coaching_is_owner());

drop policy if exists "hype-audio public insert" on storage.objects;
create policy "owner upload hype-audio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'hype-audio' and public.coaching_is_owner());
