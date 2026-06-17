# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔄 Memory Sync Rule — MANDATORY

**Update `carl-meyer-context-backup-v2.md` on Google Drive at:**
- End of every session
- After any major task (new feature built, project decision made, new info learned)
- Any time Carl asks

File lives at: `G:/My Drive/Claude/carl-meyer-context-backup-v2.md` (Drive folder ID: `1GA5FlJpVUKEspYsGTe1y8xvGqt3RTWQd`)

Update format: append a `## Session Notes — [date]` section with key decisions, what was built, anything Carl would need to know in a fresh session.

---

## ⚠️ Context Window Rule — MANDATORY

**At the start of EVERY session, check context usage immediately.**
- If context is already at **50% or higher**: stop and tell Carl before doing any work.
- Say exactly: "⚠️ Context is at X% — recommend starting a fresh session to avoid hitting limits mid-task."
- Do not proceed until Carl confirms or starts a new session.

---

## Token Efficiency — MANDATORY (Every Session)

**These rules are non-negotiable. Apply before any other work.**

### Session Start Checklist
1. **Invoke `token-guardian` skill immediately** — before any tool calls or content generation
2. **Read `TASK_STATE.json`** if it exists — this replaces all recap/summary
3. **Warn if context is already >20%** from prior session summary before starting heavy work

### Mid-Session Checkpoints
After every major step (file written, domain processed, build completed), update TASK_STATE.json:
```bash
# Write checkpoint — do this silently, no user confirmation needed
python3 -c "
import json
state = json.load(open('/sessions/.../mnt/Claude/TASK_STATE.json'))
state['completed_steps'].append('step name')
state['next_step'] = 'next step description'
json.dump(state, open('/sessions/.../mnt/Claude/TASK_STATE.json','w'), indent=2)
print('Checkpoint saved')
"
```

### Core Rules (from token-guardian skill)
- **Content lives on disk. Context holds only paths, counts, decisions.**
- Never echo downloaded content — save to disk, confirm with count only
- Never `cat` large files — use `head -5` or targeted python one-liners
- Never load full file content when only metadata is needed
- Process one domain/section per bash call — never batch all content at once
- If context hits 80%: stop, write TASK_STATE.json, tell user to start fresh session

## ⚡ SESSION START — REQUIRED (load before any work)

These six skills are mandatory every session. Load them first, in order.

1. **token-guardian** — content lives on disk; context holds paths/counts/decisions only. Enforce the 10 Laws. Run session start checklist silently. Hard stop at 80% context.
2. **token-optimization** — every response lean and high-signal. Flag token-heavy tasks before executing. Offer lighter alternatives.
3. **context-guardian** — silent below 75%. Warn at 75%. Present options at 85%. Auto-compact at 90%+. Background check every response once session gets long.
4. **critical-thinking** — passively monitor Carl's statements. Challenge confident assertions with ⚡. Steelman, invert, second-order think. No sycophantic agreement.
5. **second-brain** — surface cross-domain connections with 🧠. After major learning sessions, prompt Carl to save key insights to CLAUDE.md.
6. **project-guardian** — check PROJECT_REGISTRY.md before any build. After anything is built, proactively initiate: "Session Snapshot — update PROJECT_REGISTRY.md?"
7. **timeout-guard** — decompose any task >30s before running. Report immediately on timeout/error/stall. Never let Carl wait in silence.

---

## On-Demand Skills (invoke only when needed)
- **pre-task-clarifier** — before complex multi-step builds
- **deep-research** — sourced expert-level answers
- **knowledge-absorb** — learning from books/sources
- **model-advisor** — before heavy tasks
- **cc-mastery** — Claude Code sessions only

---

## File Output Convention

**Every Cowork and Claude Code session must follow this structure:**

- **Working folder:** `G:\My Drive\Claude\` — connect this at the start of every session
- **Output files** (HTML, JSON, code, exports): save to `G:\My Drive\Claude\Claude Outputs\`
- **Notes and markdown files** (.md): save directly to `G:\My Drive\Claude\`

At the start of any Cowork session, immediately request access to `G:\My Drive\Claude\` if it is not already connected. Never save final deliverables to the AppData temp folder — always copy to the above paths.

## Projects Overview

This workspace contains four distinct projects:

| Project | Description |
| --- | --- |
| `coaching-dashboard` | React app for managing fitness clients: check-ins, macro tracking, lift progress |
| `accounting-automation` | AI workflow automation system for an accounting firm |
| `jarvis` | AI assistant — React UI on Vercel, Express backend on Railway, ElevenLabs voice, Mem0 memory, Claude brain |
| `content-system` | Content planning and publishing pipeline for TikTok, Instagram, and YouTube |

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

### coaching-dashboard
Client-facing data flows through a REST or tRPC API. State management should be kept close to the component unless data needs to be shared across routes, in which case use React Context or a lightweight store (Zustand preferred). Forms (check-ins, macros) should validate with Zod.

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
