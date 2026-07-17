# Project Registry
Last updated: 2026-06-16
Purpose: Prevent duplicate builds and stale-data rebuilds. Read this before building or rebuilding ANYTHING.

---

## Jarvis
- **Deployed**: https://jarvis-ui.vercel.app (check Vercel dashboard for exact URL)
- **Repo**: https://github.com/cmeyer117/claude-workspace — subfolder `jarvis/`
- **Stack**: React 18 + TypeScript + Vite + Tailwind (UI), Express + TypeScript (backend)
- **Backend**: https://claude-workspace-production-8460.up.railway.app
- **UI code**: `jarvis/ui/src/`
- **Backend code**: `jarvis/src/`
- **Tabs**: HOME (orb + voice), PROJECTS, JOURNAL (record + log), TASKS (placeholder), SETTINGS (placeholder)
- **Backend Routes**: POST /chat, POST /llm, POST /webhook, POST /journal/extract, GET /health
- **Vercel rewrites**: `/chat` and `/journal/*` proxy to Railway (see `jarvis/ui/vercel.json`)
- **Auth**: passphrase gate (`AuthGate.tsx`), default passphrase `jarvis`
- **Memory**: Mem0, userId `default-user` for all interactions
- **Voice**: ElevenLabs agent `agent_2301ktr3gvw4fzf9qvkgp9epcz1x`, Oliver Silk voice
- **Last updated**: 2026-06-12
- **RULE**: ALL new features go inside `jarvis/ui/` as a new tab or component, backend in `jarvis/src/`. NEVER build a standalone app for a Jarvis feature.

---

## Coaching Dashboard (row)
- **Deployed**: https://row-sage.vercel.app
- **Repo**: https://github.com/cmeyer117/row (main)
- **Stack**: Vanilla HTML/JS/Supabase, no build step
- **Note**: Also referred to as "coaching-dashboard" or "the dashboard". 2026-07-17: added `coaching.html`/`coaching-plan.html` (coach-side client intake + plan-assembly tool) and a `coaching_clients` Supabase table.
- **Last updated**: 2026-07-17
- **RULE**: Features go inside `row/`. Do not create a separate app.

---

## Accounting Automation
- **Deployed**: Not yet deployed
- **Repo**: https://github.com/cmeyer117/claude-workspace — subfolder `accounting-automation/`
- **Stack**: Node.js + TypeScript
- **Last updated**: 2026-06-12
- **RULE**: Features go inside `accounting-automation/`.

---

## Content System
- **Deployed**: Not yet deployed
- **Repo**: https://github.com/cmeyer117/claude-workspace — subfolder `content-system/`
- **Stack**: Node.js + TypeScript
- **Last updated**: 2026-06-12
- **RULE**: Features go inside `content-system/`.

---

## Second Brain Database
- **Type**: Knowledge tool / data deliverable (not deployed software)
- **Files**: `G:/My Drive/Claude/Claude Outputs/all_entries.json`, `G:/My Drive/Claude/Claude Outputs/CM_Second_Brain_Database.html`
- **Format/schema**: JSON entries grouped by domain; HTML viewer renders a sidebar grouped by category
- **Sidebar structure**:
  - Bodybuilding: training_execution, intensifiers, programming, training_science, recipes, mg_arms, mg_chest, mg_back, mg_shoulders, mg_legs, mg_posing
  - Knowledge: mindset, psychology, frankl, nietzsche, peterson, jung, stoicism
  - Work: finance, cpa
  - Faith: faith
- **Entry count**: 297 total (full per-domain breakdown maintained in `TASK_STATE.json`)
- **Last updated**: 2026-06-16
- **RULE**: Before any rebuild, read the actual current entry count from `TASK_STATE.json` or the file itself — don't trust memory or an old session summary.
