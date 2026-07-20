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

Pages: `index.html`, `main.html`, `health.html`, `gym.html`, `finance.html`, `mobility.html`, `po-water.html`, `coaching.html`, `coaching-plan.html`.

Shared logic:
- `sync.js` — cloud sync to a Supabase `app_state` table
- `topbar.js` — nav + passphrase gate (`AUTH_PASS`/`AUTH_KEY` in-file)

Jarvis (AI assistant) lives in a separate repo, `cmeyer117/claude-workspace`, subfolder `jarvis/` — it is not part of this repo. `accounting-automation` and `content-system` are not built yet as of this writing.

## TypeScript Rules

Strict TypeScript is non-negotiable across all projects:

- `strict: true` in all `tsconfig.json` files
- **No `any` types** — use `unknown` and narrow, or define a proper type
- No `@ts-ignore` or `@ts-expect-error` without an explicit comment explaining why
- Prefer `type` over `interface` unless declaration merging is needed

## Development Approach

**Write tests before code (TDD).** For every new feature or function:
1. Write a failing test that describes the expected behavior
2. Write the minimum code to make it pass
3. Refactor

This applies to utility functions, API handlers, and business logic. UI component tests use React Testing Library focused on user behavior, not implementation.

## Tech Stack

- **Frontend:** React 18+, TypeScript
- **Backend:** Node.js, TypeScript
- **Testing:** Vitest (preferred) or Jest — check the project's `package.json` for which is configured
- **Voice (Jarvis):** ElevenLabs Conversational AI (agent ID: `agent_2301ktr3gvw4fzf9qvkgp9epcz1x`, Oliver Silk voice)
- **Memory (Jarvis):** Mem0, userId `default-user` shared across voice and text
- **Orchestration (Jarvis):** n8n planned but not yet implemented
- **AI:** Claude (Anthropic SDK) as the reasoning layer

## Commands

Commands will vary per sub-project. Always check the project's `package.json` first. Typical patterns:

```bash
# From within a project directory
npm run dev       # start dev server
npm run build     # production build
npm run test      # run all tests
npm run test -- path/to/file.test.ts  # run a single test file
npm run lint      # lint
npm run typecheck # tsc --noEmit (run this before committing)
```

## Architecture Intentions

### row (this repo)
No React, no state management library, no API layer — plain DOM/JS per page. Cross-page/session persistence goes through `sync.js` to the Supabase `app_state` table. Keep new pages consistent with the existing vanilla HTML/JS pattern; don't introduce a framework or build step for one feature.

### accounting-automation
AI workflows are triggered by events (document upload, scheduled job, etc.) and return structured outputs. All AI calls should be wrapped in typed functions with Zod-validated responses — never trust raw model output shapes.

### jarvis

**DEPLOYED INFRASTRUCTURE — read this before touching anything:**
- Frontend: React 18 + Vite + Tailwind, deployed on **Vercel**, code at `jarvis/ui/`
- Backend: Express + TypeScript, deployed on **Railway** at `https://claude-workspace-production-8460.up.railway.app`
- `jarvis/ui/vercel.json` rewrites `/chat` and `/journal/*` to Railway — this is how the frontend talks to the backend without exposing env vars
- Auth gate: `AuthGate.tsx`, passphrase via `VITE_PASSPHRASE` env var (default: `'jarvis'`), stored in sessionStorage

**Sidebar tabs:** HOME (orb + voice), PROJECTS, JOURNAL (voice journal → Mem0), TASKS (placeholder), SETTINGS (placeholder)

**Backend routes:**
- `POST /chat` — Claude + tools + Mem0
- `POST /llm` — ElevenLabs custom LLM route
- `POST /webhook` — ElevenLabs post-conversation transcript → Mem0
- `POST /journal/extract` — voice transcript → Claude extraction → mem0_memory written to Mem0
- `GET /health`

**Jarvis personality:** Calm authority, dry wit, Iron Man JARVIS. Addresses user as "sir." Never says "I'm an AI."

**Do not build standalone versions of features.** Everything goes inside the existing `jarvis/ui/` React app as a new tab or component. The backend is the Railway Express server at `jarvis/src/`.

### content-system
Content moves through a lifecycle: `draft → scheduled → published → archived`. Keep platform-specific logic (TikTok vs Instagram vs YouTube) behind an adapter interface so shared pipeline logic stays clean.
