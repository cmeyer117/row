---
name: pre-task-clarifier
description: >
  Fires before large or multi-step builds to ask design and approach decisions —
  NOT questions Claude can answer from context, memory, or reading the codebase.
  Triggers on: complex builds, architectural decisions, feature additions to existing
  projects, anything with multiple valid implementation paths. The questions are
  forward-looking design choices: how should this be built, what's the priority,
  which approach, what behavior when X happens. Never asks about existing state
  (Claude should already know that). Never re-asks anything answered earlier in the
  session. Use this when the task has real design forks where Carl's preference
  changes the implementation — not for simple tasks, bug fixes, or anything with
  one obvious path. Goal: one clean pass with zero mid-build redirects.
---

# Pre-Task Clarifier

**Ask design decisions. Not inventory questions.**

The distinction:
- ❌ "Does a journal tab already exist?" — Claude should know this from memory/codebase
- ✅ "Should the journal write to Supabase only, Mem0 only, or both?" — only Carl knows

This skill surfaces the choices that only Carl can make, before building starts.

---

## When This Fires

Fire when the task has **2+ valid implementation paths** and Carl's preference
between them would meaningfully change what gets built.

**Examples that fire:**
- Adding a feature with multiple architecture options (backend vs frontend, real-time vs on-demand)
- Building something that touches multiple systems (which source of truth?)
- Anything with UX decisions that aren't obvious (modal vs tab vs page?)
- Features with behavior that depends on preference (what happens when X fails?)

**Examples that do NOT fire:**
- Simple bug fixes — one obvious path
- Tasks where Carl already specified how he wants it done
- Anything Carl has a strong established pattern for (check memory first)
- Small edits, copy changes, single-file changes

---

## The Questions to Ask

**Correct question types:**

| Category | Example |
|----------|---------|
| **Architecture** | "Should this live on the backend (Railway) or query Supabase directly from the UI?" |
| **Data flow** | "Should this write to Supabase, Mem0, or both? Which is the source of truth?" |
| **UX approach** | "New tab, modal, or panel within an existing tab?" |
| **Behavior** | "If the API call fails, should it retry silently or show an error to you?" |
| **Priority** | "Ship fast and refactor later, or build it clean the first time?" |
| **Scope** | "Build the full thing now or just the read side first, add write later?" |

**Wrong question types (never ask these):**
- "What already exists in Jarvis?" — read the codebase / check memory
- "Do you have X set up?" — check the .env, check the registry
- "What's your Supabase URL?" — it's in memory
- Anything Claude can answer by reading context, memory, or files

---

## Format

```
⚡ Quick Design Check — [Task Name]

A few decisions before I build:

1. [Architecture/data flow decision]
2. [UX or behavior decision]  
3. [Scope or priority decision]

Once you answer these I'll go straight through with no stops.
```

Keep it tight. 2–4 questions max. If you can't pick the critical ones, you're not
ready to build yet — read the codebase first, then come back with sharper questions.

---

## Hard Rules

1. **Check memory and context before asking anything.** If the answer is in this
   conversation or in Carl's memory, it's not a question — it's a fact. Use it.

2. **Design decisions only.** The test: "Could I find this answer by reading a file
   or checking memory?" If yes → don't ask. If only Carl knows → ask.

3. **2–4 questions max.** If you have more, Claude hasn't done enough preparation.
   Read the codebase, check the registry, then ask the irreducible unknowns.

4. **Never re-ask.** If Carl answered something this session, it's answered. Don't
   surface it again in a new format.

5. **Don't fire on simple tasks.** This exists for real forks in the road. Don't
   add friction to straight-line tasks.
