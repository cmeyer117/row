-- Applied live 2026-08-20 via hype-audio-app's idempotent content-idea handoff fix
-- (Codex improvement pass Codex Outputs\2026-08-20-hype-audio-pass.md, finding #2).
-- Recorded here after the fact for the migration paper trail -- content_ideas is
-- jarvis-owned per claude-workspace-scratch's packages/portfolio-signals/src/manifest.json,
-- but this repo (row) is where shared-table migrations for app_state/content_ideas have
-- historically been recorded (see 2026-08-14-scope-anon-app-state-to-vessel.sql and
-- 2026-08-14-extend-anon-vessel-hype-audio.sql in this same folder).
--
-- Lets hype-audio-app's api/create-content-idea.mjs dedupe a resend of the same clip's
-- content-idea handoff instead of creating a duplicate row.

alter table content_ideas
  add column if not exists source_hype_clip_id text;

create unique index if not exists content_ideas_source_hype_clip_id_key
  on content_ideas (source_hype_clip_id)
  where source_hype_clip_id is not null;
