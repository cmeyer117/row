# Token Cost Patterns in CC

Real-world cost observations and estimates for common CC patterns.

---

## High Cost Patterns (avoid unless justified)

### Subagent spawning
- Each subagent = separate agent instance = independent token usage
- `superpowers:subagent-driven-development` observed eating 65% of session budget
- `superpowers:brainstorming` defaulting to subagents doubled its own cost
- Rule: only use when tasks are genuinely parallel AND token budget isn't a constraint

### Large context without compacting
- Long sessions accumulate shell output, file reads, and prior responses in context
- Every subsequent request pays the cost of all prior context
- Fix: run `/compact` after major milestones

### Re-explaining project context every session
- Starting fresh and explaining Jarvis/accounting system = 1,000–3,000 tokens of overhead
- Fix: Handoff skill compresses this into a resumable markdown doc

### Full file rewrites
- Showing the agent an entire file and asking it to rewrite = paying for every token in the file
- Fix: surgical edits only. Show just the relevant section + context.

---

## Low Cost Patterns (prefer these)

### Inline sequential execution
- Tasks run in the main context, no subagent overhead
- Context from earlier tasks is free — already paid for

### `/compact` mid-session
- Significantly reduces context size
- Saves tokens on all subsequent requests in the session

### Skill activation
- Skills load only when triggered (~100 tokens for description scan at startup)
- Full skill content only loads when relevant — not a constant tax

### Surgical code edits
- Show only the function/section being changed
- Use `// ... existing code` to skip unchanged sections

### Handoff + resume
- One-time cost to create handoff doc vs. re-explaining every session
- Pays for itself within 2 sessions on any ongoing project

---

## Estimated Token Costs by Task Type

| Task | Inline Cost | Subagent Cost | Verdict |
|------|------------|---------------|---------|
| Single function | ~200–500 | ~1,000–2,000 | Inline always |
| React component | ~500–1,500 | ~2,000–5,000 | Inline always |
| Full module | ~2,000–5,000 | ~6,000–15,000 | Inline always |
| 3 independent features | ~6,000–15,000 | ~6,000–15,000 | Equal — subagents ok |
| Codebase scan (500 files) | ~50,000+ | ~10,000–20,000 | Subagents justified |
| Full app scaffold | ~15,000–40,000 | ~45,000–120,000 | Phased inline wins |
