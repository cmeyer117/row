-- ============================================================
-- app_state — extend anon access to Vessel's full key set + hype-audio
-- 2026-08-14 (follow-up to 2026-08-14-scope-anon-app-state-to-vessel.sql)
--
-- The first fast-follow only covered sanctuary:*/vessel:devotional_pool
-- (the devotional-pregen scheduled task's own keys). A repo-wide check
-- found the live Vessel app uses many more bare app_state keys that
-- were still silently broken (journal, prayers/prayer_log, manifest_log,
-- founder_moves, valley, armory_seen, devotional_log), plus hype-audio-app
-- syncing its clip library through the same table/anon key under key
-- 'hype-audio'. Also added a read-only anon policy for 'po-coach' —
-- Vessel displays Row's coaching status cross-app; write access to that
-- key stays locked to authenticated (coaching_is_owner()).
--
-- Row's actual sensitive keys (goals, health, finance, jarvis:*,
-- vision:*, mission_control, capture, exercise-cues, row:*,
-- po-coach-sync-debug) remain locked to authenticated/service_role only.
-- ============================================================

drop policy if exists "vessel anon access to app_state" on public.app_state;

create policy "vessel anon access to app_state"
  on public.app_state for all to anon
  using (
    key like 'sanctuary:%' or key like 'vessel:%' or
    key in ('armory_seen','journal','manifest_log','founder_moves','valley','prayers','prayer_log','devotional_log')
  )
  with check (
    key like 'sanctuary:%' or key like 'vessel:%' or
    key in ('armory_seen','journal','manifest_log','founder_moves','valley','prayers','prayer_log','devotional_log')
  );

create policy "hype-audio anon access to app_state"
  on public.app_state for all to anon
  using (key = 'hype-audio')
  with check (key = 'hype-audio');

create policy "vessel anon read po-coach"
  on public.app_state for select to anon
  using (key = 'po-coach');
