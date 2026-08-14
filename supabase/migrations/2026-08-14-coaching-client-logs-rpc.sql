-- ============================================================
-- Missing coaching_client_logs RPC grant — 2026-08-14
-- coaching-log.html (anonymous capability-link page) has called
-- get_coaching_client_logs() since 2026-07-23-coaching-rls-lockdown. The
-- function itself DOES exist live (created out-of-band, never captured in
-- a tracked migration -- real schema drift), but `anon` was never granted
-- EXECUTE on it (only postgres/authenticated/service_role were) -- so
-- every anon call from coaching-log.html has been permission-denied since
-- launch, and the Rx recommendation tag has silently rendered empty for
-- every client. This migration documents the function as it actually
-- exists in production (do not change its signature -- getRx()/
-- getClientLogs() in coaching-log.html only ever read .weight/.reps) and
-- adds the missing anon grant, matching the sibling RPCs' pattern in
-- 2026-07-23-coaching-rls-lockdown.sql.
-- ============================================================

create or replace function public.get_coaching_client_logs(p_id uuid, p_exercise text)
returns table (weight numeric, reps integer)
language sql security definer set search_path = '' as $$
  select weight, reps
  from public.coaching_client_logs
  where client_id = p_id and exercise_name = p_exercise
  order by created_at asc;
$$;

grant execute on function public.get_coaching_client_logs(uuid, text) to anon;
