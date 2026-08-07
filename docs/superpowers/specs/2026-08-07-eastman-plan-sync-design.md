# Eastman Plan Auto-Sync — Design

**Date:** 2026-08-07
**Status:** Approved (apply mode picked by Carl: propose-first)
**Owner:** Scheduled task in `C:\Users\gregm\.claude` (claude-config repo) acting on Row (`C:\Users\gregm\row`)

## Goal

Row heavy-hitter #1 (`Claude Outputs/2026-08-06-row-heavy-hitters.md`). When Chris Eastman posts a new or updated plan PDF to `G:\My Drive\Coaching documents\`, Row's coach-plan surfaces stop being hand-re-wired days later: a daily scheduled task detects the change, parses the plan, and **proposes** the exact Row updates for one-tap approval. This week's Aug-1 PDF was hand-transcribed into `coach-meal-plan.js`, the vault, and `po_coach_season` across multiple sessions — that toil is the target.

## Ground truth (verified in-session, 2026-08-07)

- Folder: 5 diet PDFs (`...Macros*.pdf`), 2 program-block PDFs (`M5/M6`, ~4MB), a 2023 xlsx/gsheet. Current plan = `BLACK MAGMA FITNESS CLIENT Carl - Macros.doc.pdf` (mtime 2026-08-01). The coach **edits in place and reuses names** — detection must hash, not just list filenames.
- `pypdf` extracts the diet PDFs' text cleanly (verified on `Macros0.5.pdf`; installed to system Python).
- `coach-meal-plan.js` is a generated-data file: `MEALS` array of `{label, rows:[{foodName, grams}]}`, `foodName` must match `staple-foods.js` entries; OR-choices default to first-listed; its header comment already names the source PDF.
- Scheduled tasks send Telegram via the Jarvis Railway `/scheduled/*` endpoint with the scheduler secret (adherence-sentinel Step 4 pattern).
- Season phase lives in Supabase `app_state` key `po_coach_season` (`{phase, startDate}`).

## Behavior

New scheduled task **`eastman-plan-sync`**, daily 7:40 AM (after the 7:00 morning brief).

### Step 1 — Detect
Stat every file in `G:\My Drive\Coaching documents\`; compute `sha256` for files whose `(name, size, mtime)` changed vs the state file `Claude Outputs/eastman-sync-state.json` (`{files: {name: {size, mtime, sha256}}, lastProposal}`). No content change → append run log (`write-run-logs` convention), exit silently.

### Step 2 — Classify
- Changed **diet PDF** (`Macros` family or any new PDF that parses as a meal plan) → full pipeline.
- Changed **program PDF** (`M5`/`M6` family) or spreadsheet → **notify-only**: Telegram "program/protocol file changed — not auto-synced (out of scope v1)". State updated so it doesn't re-fire.

### Step 3 — Parse (diet PDFs)
Extract text with `pypdf` inside the session. Parse into: phase name + start date, per-meal food rows with grams (preserving OR-choices), macro/cardio/supplement guidance lines, and freeform coach notes. This is LLM parsing in a subscription-billed session — $0, no API keys.

### Step 4 — Build the proposal (never touches `main`)
1. Regenerate `coach-meal-plan.js` from the parse: map each food to its `staple-foods.js` name — **an unmappable food is listed in the report and left as the nearest existing staple with a `⚠ VERIFY` line, never silently dropped**; OR-choices keep first-listed defaults; header comment updated (phase, start date, source PDF, date).
2. Branch `coach-sync/YYYY-MM-DD` in the row repo, commit, push, open a PR titled `Coach plan sync — <phase> (<PDF date>)`. The PR body is the diff report: phase delta (PDF vs current `po_coach_season`, read via the existing Supabase REST pattern), per-meal changes old→new, unmapped-food warnings, and any guidance lines that have no Row home yet.
3. Write the same report to `Claude Outputs/eastman-sync-proposal-YYYY-MM-DD.md`, including the exact `po_coach_season` update (SQL/PATCH) to run on approval — the phase change is data, not code, so it rides the report, not the PR.
4. Flag in the report when the vault's Cooking Coach master note transcription is now stale (phase or meals changed) — refreshing it stays session work, not task work.

### Step 5 — Notify
Telegram via the existing `/scheduled` endpoint: one message — phase change headline, top 3 deltas, PR link. Parse failure → "new coach PDF couldn't be parsed — read it manually: <name>" (state still updated; fail loud once, not daily).

### Step 6 — Approval path
Carl merges the PR from his phone (Vercel auto-deploys) or tells any session "apply the coach sync" (merge + run the `po_coach_season` update + refresh the vault note). The task itself never merges. Branch deleted on merge per the scratch-branch rule.

## Error handling

- Per-file fail-closed: one unreadable file never blocks other files or the run log.
- State is written only after a successful proposal/notify for that file, so a crashed run retries tomorrow.
- A proposal PR already open for the same content hash → don't duplicate; re-link the existing PR in Telegram.
- Supabase/Telegram unreachable → proposal still lands (PR + report are the durable outputs); notify failure is logged in the run log.

## Out of scope (v1)

- Parsing M5/M6 program blocks or the 2023 xlsx (notify-only).
- Auto-editing the vault Cooking Coach notes (flagged, not applied).
- Macro-target math changes inside `macro-calc.js` (report-only until a PDF actually carries numeric macro targets to map).
- Auto-apply mode — revisit after a few clean proposal cycles.

## Verification

- Dry run in-session: seed the state file as stale for the current `Macros.doc.pdf`, execute the SKILL steps manually — assert: branch + PR created with correct regenerated `coach-meal-plan.js` (diff vs the hand-written current one should be ~empty since it was transcribed from the same PDF — that near-empty diff IS the parse-accuracy test), report file written, state updated. Telegram step exercised against the real endpoint once, then the PR closed unmerged and branch deleted.
- Registered task visible in `list_scheduled_tasks` with the 7:40 cron.
- Second dry run with unchanged state → confirms silent no-op.
