---
name: cc-mastery
description: >
  Trigger this skill when the user asks about CC workflows, plugins, skills,
  subagents, token usage, session management, or any agentic development decisions.
  Also triggers BEFORE any CC execution — always surface the approach and confirm
  before running. Covers every installed skill and any new ones downloaded.
  The goal: help the user make expert decisions in CC without trial and error.
  Never let an accidental run happen — always checkpoint first.
---

# CC Mastery Skill

Two jobs:
1. Be the expert on every skill installed — current inventory lives in memory, always current
2. Checkpoint before running anything — surface the approach, confirm, then execute

---

## Part 1: Pre-Execution Checkpoint (Most Important Rule)

Before ANY non-trivial execution, run this:

```
⚙️ CC Checkpoint

About to run: [what]
Approach: [which skill(s) activate / execution method]
Est. tokens: [rough estimate]

Alternatives:
- [lighter option if one exists]
- [different skill that might fit better]

Good to go?
```

### Checkpoint triggers (always ask first):
- Any task involving an installed skill
- Any multi-step execution
- Anything estimated 1,000+ tokens
- Multiple skills could apply and choice isn't obvious
- User hasn't specified an approach

### Skip checkpoint only when:
- Simple one-liner or quick fix
- User said "just run it" or already specified exact approach

---

## Part 2: The Two Types of Skills

### Capability Uplift
Gives the agent abilities it doesn't have natively. Without the skill → can't do it.
Examples: web scraping, browser testing, file generation, security scanning.

### Encoded Preference
Agent already knows the task. Skill encodes YOUR specific way of doing it.
Examples: code style, component patterns, behavioral guardrails, anti-slop rules.

**Diagnostic:** generic output on a known task → need Encoded Preference.
Can't do the task at all → need Capability Uplift.

---

## Part 3: Skill Inventory Protocol

**The live skill inventory lives in memory — not in this file.**

When asked about installed skills:
1. Pull from memory for current inventory
2. Apply use/skip/cost judgment from the rules below
3. When a new skill is installed → update memory immediately, no reinstall needed

### When a new skill is installed, always brief the user:
```
📦 New Skill: [name]

Type: Capability Uplift / Encoded Preference
Fires when: [exact trigger condition]
Skip when: [wrong fit scenarios]
Token cost: [Low / Medium / High]
Conflicts with: [any existing skills]
Best for your projects: [which of the 4 projects benefits]
```

---

## Part 4: Subagents — The Most Expensive Default

### The one question that decides everything:
**Can task B start before task A finishes?**
- No → inline. Always.
- Yes → subagents might be justified.

### Only legitimate subagent use cases:
✅ Genuinely parallel independent tasks
✅ Scanning massive codebases (500+ files) where output pollutes main context
✅ Isolated code review with zero context bias
✅ Token budget is not a constraint and speed is priority

### Almost always skip for:
❌ Sequential builds (Jarvis, accounting system, coaching dashboard — all sequential)
❌ One coherent system where shared context helps quality
❌ Any session where token budget matters

### Superpowers-specific warning:
`superpowers:brainstorming` defaults to recommending subagents.
Always say "inline execution" explicitly when using it.

---

## Part 5: Key Commands

| Command | What it does | When to use |
|---------|-------------|-------------|
| `/cost` | Token usage breakdown | Before major tasks, anytime |
| `/compact` | Compress context mid-session | After major milestones, ~40-50% through heavy session |
| `/clear` | Full context reset | Starting genuinely new unrelated task |
| `/using-superpowers` | Activate Superpowers skills | Always follow with "inline execution" |

---

## Part 6: Session Best Practices

1. **Session start** — check active skills, specify "inline" if using Superpowers brainstorming
2. **Mid-session** — `/compact` after completing a major task block
3. **Session end** — Handoff skill to preserve context for next session (critical for Jarvis + accounting system)
4. **Before any big task** — `/cost` to know budget, then checkpoint the approach
