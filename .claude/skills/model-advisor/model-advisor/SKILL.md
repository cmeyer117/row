---
name: model-advisor
description: >
  Trigger this skill when the user is about to run a task and may benefit from
  switching models or adjusting their thinking budget. Fires proactively before
  deep dives, complex builds, architecture decisions, creative writing, research,
  or any task where model choice materially affects output quality or cost.
  Always suggest BEFORE running, never after. The user decides — this skill advises.
---

# Model Advisor Skill

Job: proactively surface the right model for the task before executing.
Never pick for the user — present the recommendation, explain the tradeoff, let them decide.

---

## Part 1: When to Surface a Model Suggestion

Fire this before:
- Deep research or full analysis requests
- Complex multi-step builds or architecture decisions
- Creative writing, long-form content, brand strategy
- Debugging hard problems with unclear root cause
- CPA/accounting questions requiring precise reasoning
- Any task where the current model feels like it might underdeliver
- Any task where the current model is overkill (wasting cost)

Skip for:
- Quick factual questions
- Simple code fixes
- Short answers where model choice doesn't matter

---

## Part 2: The Model Tiers (Current as of June 2026)

### Haiku 4.5 — Speed & Volume
- **Best for:** Routing, classification, simple Q&A, repetitive tasks, high-volume pipelines
- **Skip for:** Complex reasoning, deep research, nuanced writing, architecture decisions
- **Context:** 200K tokens
- **Real-world fit:** Preprocessing in Jarvis pipeline, triaging inbound requests, quick lookups

### Sonnet 4.6 — The Workhorse (your default)
- **Best for:** Code generation, document analysis, most builds, content drafts, standard research
- **Performance:** 79.6% SWE-bench — 97-99% of Opus quality at significantly lower cost
- **Context:** 1M tokens
- **Real-world fit:** 80-90% of everything you do. Jarvis builds, accounting automation, coaching dashboard, content system

### Opus 4.8 — Deep Reasoning
- **Best for:** Complex multi-file refactoring, architecture decisions, hard debugging, scientific reasoning, long-horizon agentic work, tasks where Sonnet consistently falls short
- **Performance:** Top SWE-bench score among commercial models
- **Context:** 1M tokens
- **Real-world fit:** The 10-15% of tasks that genuinely need it — deep CPA research, complex system design, hard AI architecture decisions

---

## Part 3: Thinking Budget (Sonnet Extended Thinking)

Within Sonnet, you can adjust the thinking budget — how much internal reasoning the model does before responding.

| Budget | Use When | Skip When |
|--------|----------|-----------|
| **Low** | Standard tasks, quick builds, content drafts | Default for most things |
| **Medium** | Multi-step plans, debugging with unclear cause, moderately complex research | When you need more than surface-level but not full depth |
| **High** | Architecture decisions, hard reasoning problems, deep research dives | Token cost increases — reserve for tasks that genuinely need it |

---

## Part 4: Recommendation Format

When surfacing a model suggestion, always use this format:

```
🧠 Model Check

You're on [current model/budget]. For this task I'd suggest:
→ [recommended model + thinking budget]

Why: [one sentence reason]
Tradeoff: [what you gain vs. what it costs]

Stick with current or switch?
```

Keep it short. One recommendation, one reason, one tradeoff. User decides in 5 seconds.

---

## Part 5: Full Decision Tree (All Directions)

Run this internally before every suggestion. Covers every scenario.

### Step 1 — Detect current model + task type

| Current | Task | Action |
|---------|------|--------|
| Haiku | Anything beyond simple lookup/routing | 🔺 Suggest up to Sonnet |
| Sonnet Low | Deep research, hard reasoning, architecture | 🔺 Suggest Sonnet Medium or High |
| Sonnet Low | Complex multi-file build, CPA edge cases | 🔺 Suggest Sonnet Medium |
| Sonnet Low | Simple fix, caption, quick question | ✅ Stay — you're already optimal |
| Sonnet Medium | Quick fix, simple build, short content | 🔻 Suggest Sonnet Low — save tokens |
| Sonnet Medium | Architecture decision, hard debugging, deep dive | 🔺 Suggest Sonnet High or Opus |
| Sonnet High | Simple task, standard build, content draft | 🔻 Suggest Sonnet Low or Medium — overkill |
| Sonnet High | Still producing weak output on hard reasoning | 🔺 Suggest Opus |
| Opus | Anything Sonnet handles well (80-90% of tasks) | 🔻 Suggest Sonnet — save significant cost |
| Opus | Multi-file refactor, hard system design, scientific reasoning | ✅ Stay — justified |
| Any | Task is purely routing, classification, triaging | 🔻 Suggest Haiku — fastest and cheapest |

### Step 2 — Apply task category rules

**→ Suggest Haiku when:**
- Classifying or routing inputs in a pipeline
- Simple yes/no or single-fact lookups
- High-volume repetitive tasks
- Any Jarvis subagent handling routing only

**→ Suggest Sonnet Low when:**
- Standard code generation (components, functions, scripts)
- Short content (captions, hooks, emails)
- Straightforward debugging with clear cause
- Most everyday builds

**→ Suggest Sonnet Medium when:**
- Multi-step implementation plans
- Moderate research with some nuance
- Debugging with unclear root cause
- Brand strategy, pitch deck drafts
- CPA standard exam topics

**→ Suggest Sonnet High when:**
- Deep research requiring precise multi-step reasoning
- Tax law edge cases, IRS ambiguities
- Complex system architecture planning
- Hard debugging across multiple files
- Competitive analysis, deep strategic thinking
- Jarvis architecture decisions

**→ Suggest Opus when:**
- Sonnet High produced weak output on the same task
- Complex multi-file refactoring across a large codebase
- Long-horizon agentic tasks (10+ step autonomous execution)
- Scientific reasoning or highly technical domains
- You need the absolute best output regardless of cost

### Step 3 — Flag overkill immediately

If the user is on Opus or Sonnet High for a task that clearly doesn't need it,
always flag it. Cost adds up fast and most tasks don't justify the premium.

---

## Part 6: Recommendation Format

```
🧠 Model Check

Current: [model + budget]
Task needs: [what this task actually requires]
Suggestion: → [recommended model + budget]

Why: [one sentence]
Tradeoff: [what you gain vs. lose]

Switch or stay?
```

If current model is already optimal:
```
🧠 Model Check — You're good

[Current model] is the right call for this. Running now.
```

---

## Part 7: Project-Specific Defaults

### Jarvis (Vapi + AI + n8n + Mem0)
- Agent reasoning core: Sonnet 4.6 Medium
- Tool routing / classification subagents: Haiku 4.5
- Architecture + system design decisions: Sonnet 4.6 High
- Hard multi-agent debugging: Opus 4.8

### Accounting Firm Automation
- Standard code + logic: Sonnet 4.6 Low
- Tax law research, GAAP edge cases: Sonnet 4.6 High
- CPA exam deep dives: Sonnet 4.6 High
- IRS ruling interpretation, complex scenarios: Opus 4.8

### Coaching Dashboard (React)
- Component builds, standard features: Sonnet 4.6 Low
- Architecture decisions, state design: Sonnet 4.6 Medium

### Content & Brand (CS Talent Media)
- Captions, hooks, short posts: Sonnet 4.6 Low
- Pitch decks, brand strategy, sponsor outreach: Sonnet 4.6 Medium
- Deep competitive analysis, positioning: Sonnet 4.6 High

### Bodybuilding / Deep Research
- Standard training questions: Sonnet 4.6 Low
- Hypertrophy science, contest prep analysis: Sonnet 4.6 High
- Cross-domain synthesis (science + practitioner): Sonnet 4.6 High
