---
name: timeout-guard
description: >
  Always-active execution protection layer for Carl. Fires before ANY multi-step
  task, bash command, file processing job, or agentic execution that could take
  more than 30 seconds. Two jobs: (1) proactively break heavy tasks into timed
  steps before running so nothing hangs silently, (2) immediately notify Carl
  with a clear status report the moment any step errors, times out, or stalls —
  never let him wait in silence. Also triggers when Carl says "it's taking too
  long", "why is this hanging", "timed out", "still running?", or expresses
  frustration about execution speed. Add to CLAUDE.md as a required session-start
  skill alongside token-guardian. False positives are free — missed timeouts cost
  Carl 5+ minutes of dead waiting. Trigger aggressively.
---

# Timeout Guard

**Never let Carl wait in silence. Break it up before it breaks. Report immediately when it does.**

---

## The Two Core Rules

**Rule 1 — Break Before You Run**
Any task estimated over 30 seconds gets decomposed into named steps with time estimates before execution starts. Carl sees the plan, approves, then each step runs and reports individually.

**Rule 2 — Report Immediately on Failure**
The moment any step times out, errors, or stalls — stop everything and surface a clear status report. Never silently retry or hang. Carl gets notified within the same turn the failure occurred.

---

## Pre-Execution: The 30-Second Test

Before running ANY bash command, tool call, or multi-step plan, estimate total execution time:

```
Signals that a task will exceed 30 seconds:
- Reading or processing 3+ files
- Any network/API call (Drive, GitHub, external URLs)
- Any npm install, pip install, or package operation
- Database rebuilds or HTML regeneration
- Loops over more than ~20 items
- Any task described as "rebuild", "regenerate", "process all", "download all"
- Chained operations: download → process → write → rebuild
```

**If the task exceeds 30 seconds → decompose it before running.**

### Decomposition Format

Before any heavy execution, present this to Carl:

```
⏱️ Execution Plan — [Task Name]
Estimated total: ~X minutes

Step 1: [What] → Expected: ~Xs → Output: [what gets saved/returned]
Step 2: [What] → Expected: ~Xs → Output: [what gets saved/returned]
Step 3: [What] → Expected: ~Xs → Output: [what gets saved/returned]

Running Step 1 now...
```

Then execute ONE step at a time, reporting completion before moving to the next.

---

## During Execution: Step-by-Step Reporting

Each step must report on completion before the next begins:

```
✅ Step 1 done — [X items saved / X bytes written / confirmed outcome] (~Xs)
Running Step 2...
```

```
✅ Step 2 done — [outcome] (~Xs)
Running Step 3...
```

Never chain steps silently. Each step closes before the next opens.

---

## On Failure: Immediate Status Report

The moment a step times out, errors, or stalls, stop and report immediately:

```
🛑 Timeout/Error — Step [N]: [Step Name]

What happened: [timeout / error message / stall after Xs]
What completed: Steps 1–[N-1] ✅
What was lost: [nothing / partial output at /path/file]
What's saved: [file path if anything was written to disk]

Options:
A) Retry this step alone → [command]
B) Skip and continue from Step [N+1]
C) Start fresh session with state file → [one-line prompt]

What do you want to do?
```

Never retry silently. Never continue past a failure without Carl's explicit decision.

---

## Timeout Risk Table

| Task Type | Risk | Max per Step |
|---|---|---|
| npm/pip install | High | Run alone, no chaining |
| Drive API download (1 file) | Medium | 30s limit |
| Drive API download (batch) | High | 1 file per step |
| HTML rebuild from large JSON | High | Split by section |
| Bash loop over 50+ items | High | Process in batches of 20 |
| Single file read/write | Low | Fine to chain 2–3 |
| Simple bash command | Low | Fine |

---

## The Silent Hang — Carl's Biggest Pain Point

If Claude Code hasn't responded in what feels like 30+ seconds:

> This is a silent timeout or stall. Claude Code does not always surface errors immediately.

**Prevention (before it happens):**
- Never run commands expected to take 2+ minutes in a single bash call
- Always set a mental timer: if this hasn't returned in 45s, something is wrong
- Prefer chained short steps over one monolithic script

**When Carl says it hung:**
Immediately provide:
1. What the last confirmed completed step was
2. Whether any output was saved to disk before the hang
3. The fastest recovery path (retry step alone, or fresh session with state file)

---

## CLAUDE.md Addition

Add this to your session start block:

```
7. **timeout-guard** — decompose any task >30s before running. Report immediately on timeout/error/stall. Never let Carl wait in silence.
```

---

## Signals to Fire On

- Any task involving 3+ chained operations
- Any `npm install`, `pip install`, API call, or Drive operation
- Carl says: "it's hanging", "still running?", "timed out", "taking forever", "why no response"
- A prior step in the session already timed out (elevated risk — decompose everything for rest of session)
- Task description includes: "rebuild", "regenerate", "process all", "download", "install"
