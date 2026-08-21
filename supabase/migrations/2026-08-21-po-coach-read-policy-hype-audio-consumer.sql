-- ============================================================
-- Document a second consumer of the existing "vessel anon read po-coach"
-- policy (2026-08-14-extend-anon-vessel-hype-audio.sql) — no RLS change.
--
-- The policy grants SELECT on app_state where key = 'po-coach' to role
-- `anon`, project-wide -- not scoped to which app's anon key is used.
-- hype-audio-app (same Supabase project) now reads this row too, narrowed
-- to session dates only via Postgrest's JSON path operator
-- (data->po_coach_v1->sessions), matching Vessel's existing
-- vesselFetchRowWorkoutDates() pattern (vessel/vessel-sync.js). Comment-only
-- so a future RLS audit doesn't read "vessel" in the policy name and
-- narrow it in a way that silently breaks hype-audio's weekly recap.
-- ============================================================

comment on policy "vessel anon read po-coach" on public.app_state is
  'Read-only anon access to the po-coach app_state row. Consumers: Vessel (Faith+Iron streak lines, full vesselFetchRowWorkoutDates() narrowing to sessions) and hype-audio-app (weekly recap, same sessions-only narrowing). Do not scope this to a single consumer app.';
