-- ============================================================
-- app_state — scope anon access to Vessel's keys only
-- 2026-08-14
--
-- Context: the 2026-08-11 RLS lockdown (2026-08-11-rls-lockdown-app-state.sql)
-- intentionally dropped anon access to app_state as part of Row/Jarvis/
-- Vision's cutover to authenticated/service_role access (see that
-- migration's design doc, docs/superpowers/specs/2026-08-11-rls-lockdown-app-state-design.md).
-- Vessel was explicitly out of scope for that build ("queued as fast-follow
-- specs") and still reads/writes app_state via the anon publishable key —
-- so the cutover silently broke Vessel's devotional pool + sanctuary
-- calendar reads/writes.
--
-- This is that fast-follow: restore anon access, but scoped to only the
-- keys Vessel actually owns (sanctuary:* calendar days + the devotional
-- pool), not the whole table — Row's goals/health/finance/po-coach/
-- morning_launch keys stay locked to authenticated (coaching_is_owner()).
-- ============================================================

drop policy if exists "anon full access to app_state" on public.app_state;

create policy "vessel anon access to app_state"
  on public.app_state for all to anon
  using (key like 'sanctuary:%' or key = 'vessel:devotional_pool')
  with check (key like 'sanctuary:%' or key = 'vessel:devotional_pool');
