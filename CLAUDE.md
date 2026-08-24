# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Continuity — corrected 2026-07-20

The Memory Sync Rule, Context Window Rule, Token Efficiency mandatory-skill-preload list, and `TASK_STATE.json` checkpoint pattern that used to live in this section were all stale: `carl-meyer-context-backup.md`/`-v2.md` was replaced by `HANDOFF.md` back on 2026-06-17, and this repo's own `PROJECT_REGISTRY.md`/`TASK_STATE.json` haven't had real content updates since 2026-06-16 (`TASK_STATE.json` describes an unrelated, already-finished "Second Brain" knowledge-base rebuild, not Row app work). None of it matched how sessions actually run in this workspace.

**Current system, read this instead:**
- **Session continuity:** `G:\My Drive\Claude\HANDOFF.md` (active focus, read at session start) and `SESSION_LOG.md` (full append-only history).
- **Row-specific facts** (Supabase keys, page/module structure, standing rules like "never re-propose the gym-data wipe"): `project-row-dashboard.md` in `C:\Users\gregm\.claude\projects\G--My-Drive-Claude\memory\`.
- **Behavioral rules / skill-loading:** the global `C:\Users\gregm\.claude\CLAUDE.md` — skills load on demand by judgment, not a mandatory per-session preload list.

---

## File Output Convention

**Every Cowork and Claude Code session must follow this structure:**

- **Working folder:** `G:\My Drive\Claude\` — connect this at the start of every session
- **Output files** (HTML, JSON, code, exports): save to `G:\My Drive\Claude\Claude Outputs\`
- **Notes and markdown files** (.md): save directly to `G:\My Drive\Claude\`

At the start of any Cowork session, immediately request access to `G:\My Drive\Claude\` if it is not already connected. Never save final deliverables to the AppData temp folder — always copy to the above paths.

## Project Overview

This repo (`row`) is the Row fitness dashboard: a single static multi-page vanilla HTML/JS app with Supabase for persistence, no build step, no framework. Deployed to Vercel at `https://row-sage.vercel.app`.

Pages: `index.html`, `main.html`, `health.html`, `gym.html`, `mobility.html`, `po-water.html`. Coaching-client business features (client intake/plan/log/billing) were removed 2026-08-24 — that's now its own standalone app. Personal finance (income/credit/targets) lives in the standalone `steward` app, not this repo.

Shared logic:
- `sync.js` — cloud sync to a Supabase `app_state` table
- `topbar.js` — nav + passphrase gate (`AUTH_PASS`/`AUTH_KEY` in-file)

Jarvis (AI assistant) lives in a separate repo, `cmeyer117/claude-workspace`, subfolder `jarvis/` — it is not part of this repo. `accounting-automation` and `content-system` are not built yet as of this writing.

## Development Approach

This repo has zero TypeScript/React (plain vanilla JS) — the old "TypeScript Rules"/React Testing Library boilerplate here never applied, removed 2026-07-21. For new logic modules, write a `*.selfcheck.cjs` alongside the module (matching the existing pattern) before considering the feature done.

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS, no framework, no build step
- **Backend:** Supabase (`app_state` table) via `sync.js`
- **Testing:** `*.selfcheck.cjs` files per module (e.g. `gym-workout-events.selfcheck.cjs`) — run directly with `node`, not a test runner. Must be `.cjs`, not `.js`: package.json sets `"type": "module"`, which makes Node silently no-op a plain `.js` selfcheck's `require()` of the library file (see `gym-season-logic.selfcheck.cjs`'s header comment)

## Commands

No build step. Open any `.html` file directly, or serve statically for local dev. Run a module's self-check with `node path/to/file.selfcheck.js`.

## Architecture Intentions

No React, no state management library, no API layer — plain DOM/JS per page. Cross-page/session persistence goes through `sync.js` to the Supabase `app_state` table. Keep new pages consistent with the existing vanilla HTML/JS pattern; don't introduce a framework or build step for one feature.

Jarvis, accounting-automation, and content-system are separate projects (Jarvis: `cmeyer117/claude-workspace`, `jarvis/` subfolder) — this repo used to carry full architecture write-ups for them too, which just meant their real specs (in their own repos/HANDOFF) could silently drift from a stale copy here. Removed 2026-07-21; check their own repos/HANDOFF.md Project Status for current state instead.
