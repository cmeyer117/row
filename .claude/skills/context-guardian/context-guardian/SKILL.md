---
name: context-guardian
description: >
  Monitors context window usage and performs smart cleanup when necessary.
  Passively estimates context level from conversation length, files read, and
  skills loaded — warns at 75%, recommends action at 85%, auto-cleans at 90%+.
  Cleanup is judgment-based: only trims what's safe (resolved exchanges, loaded
  skills not relevant to current task) and always preserves active work context.
  Fires automatically as a background check on every response once conversations
  get long. Also fires immediately when the user shares a context window screenshot,
  mentions "context", "tokens", "running out of space", or "compact". Never
  interrupts unnecessarily — silent under 75%, actionable only when it matters.
---

# Context Guardian

**Monitor context. Clean when necessary. Never interrupt unnecessarily.**

---

## How Claude Estimates Context Level

Claude doesn't get a direct token count signal, so it estimates from:

- **Conversation turns**: ~500–2,000 tokens per back-and-forth (more for code-heavy turns)
- **Skills loaded**: each loaded skill = ~500–2,000 tokens overhead
- **Files read**: each `view`/`cat` this session adds to messages
- **Known baseline**: system prompt + MCP tools + memory ≈ 15–20k tokens always-on
- **User shares screenshot**: use the actual numbers shown

**Rough estimation table:**

| Conversation state | Estimated context |
|---|---|
| Session just started | ~15–25% |
| 10–15 turns, some code | ~30–50% |
| 20–30 turns, files read | ~55–70% |
| 30+ turns, heavy builds | ~70–85% |
| Extended session, many files | ~85–95% |

When a user shares a context screenshot → use those exact numbers.

---

## Threshold System

### 💛 75% — Yellow Flag (warn only)
Surface once, not on every message:
```
💛 Context at ~75% — still good, but getting warm.
Biggest consumer: [Messages / Skills / whatever applies].
No action needed yet.
```
Then continue normally. Do not repeat this warning next turn.

### 🟠 85% — Orange Flag (recommend action)
```
🟠 Context at ~85% — recommend cleanup before this session gets much longer.

Options:
A) /compact — compacts conversation history (biggest win, ~50% reduction)
B) Unload unused skills — [list specific skills safe to unload for current task]
C) Both A + B
D) Continue as-is (risk: autocompact may trigger unexpectedly)

What's the move?
```
Wait for Carl's answer before doing anything.

### 🔴 90%+ — Red Flag (act now)
```
🔴 Context at 90%+ — running cleanup now.

Running: [action taken]
Unloading: [skills unloaded, if any]
Keeping: everything relevant to current task.
```
Then execute cleanup immediately without waiting. See cleanup logic below.

### 🚨 95%+ — Emergency
Run `/compact` immediately. Unload all non-essential skills. Surface a 3-line
handoff summary of what was being worked on so Carl can continue in a new session
if needed.

---

## Cleanup Logic

### Step 1 — Compact conversation history
The single highest-value action. `/compact` typically cuts message tokens by 40–60%.
Always do this first unless Carl is mid-task on something that would lose critical context.

**When it's safe to compact:**
- Completed build tasks where the output is already in files (not just in chat)
- Resolved debugging exchanges
- Planning discussions that led to a decision (decision is what matters, not the back-and-forth)

**When to warn before compacting:**
- If Claude just read a large file and that file content is the active working context
- If there are unresolved decisions still in flight

### Step 2 — Unload skills not relevant to current task

**Always safe to unload (when not actively using):**
- `social-media-manager:*` skills during coding sessions
- `small-business:*` skills during bodybuilding/fitness sessions
- `personal-trainer:*` skills during software sessions
- `sales:*` and `marketing:*` skills unless explicitly working on outreach
- `finance:*` and `data:*` plugin skills unless working on accounting

**Never unload during active sessions:**
- `token-optimization` — always-on, needs to stay
- `project-guardian` — always-on, needs to stay
- `context-guardian` — obviously
- `pre-task-clarifier` — needs to stay for build protection
- `cc-mastery` — stays for all CC sessions
- Any skill explicitly used or referenced this session

**Command:** `/skill unload <skill-name>`

### Step 3 — Surface what was kept

After any cleanup:
```
✅ Context cleaned.
Before: ~[X]% | After: ~[Y]%
Kept: [what's preserved and why]
Unloaded: [skills removed]
Compacted: [yes/no]
```

---

## What NOT to Clean

- Current working files or code Claude is actively editing
- Decisions made this session that aren't yet written to files
- Errors that are still unresolved
- The last 5–10 turns of conversation (active working memory)
- Any context Carl explicitly said to keep

---

## Notification Behavior

- **Under 75%**: Silent. No mention of context. Don't add noise.
- **At 75%**: One warning, then silent until 85%.
- **At 85%**: Prompt with options. One time.
- **At 90%+**: Act. Don't prompt repeatedly.
- **Never mention context on back-to-back messages** unless level jumps a threshold.

The goal is to surface context issues *before* they interrupt the work —
not to constantly remind Carl that tokens exist.

---

## Hard Rules

1. **Silent under 75%.** Context management that creates more noise than it prevents
   is worse than no context management.

2. **Judgment over automation.** Don't blindly compact mid-task. Read what's happening
   and pick the right moment.

3. **Always preserve active work.** A token saved on history means nothing if it loses
   the file Claude is currently editing.

4. **One warning per threshold.** Crossed 75% → warn once. Don't repeat it every turn
   until 85% is hit.

5. **Compact is almost always the right first move.** Messages consistently hit 60–70%
   of context. Everything else is secondary.
