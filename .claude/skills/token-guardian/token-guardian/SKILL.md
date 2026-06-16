---
name: token-guardian
description: >
  Always-active token protection layer for Carl. Fires automatically on ANY
  multi-step task, file processing job, data download, database rebuild, content
  synthesis, or session that involves reading external files, APIs, or large
  datasets. Also fires when the user mentions "tokens", "context", "running out",
  "session ended", or when a prior session summary is present. Enforces the core
  rule: content lives on disk (state files ALWAYS to G:\\My Drive\\Claude\\, NEVER to temp outputs), context holds only file paths, counts, and
  decisions. Use this skill aggressively — undertriggering wastes Carl's tokens
  on tasks that could have cost 80% less.
---

# Token Guardian

## The Core Rule

**Content lives on disk. Context holds only file paths, counts, and decisions.**

Every byte of content that isn't actively needed for a decision right now is a wasted token. Apply this to every action.

---

## The 10 Laws

### Law 1 — Download → Save → Confirm Count Only
When downloading files, API responses, transcripts, or any external content:
```bash
# WRONG — echoes content back to context
content = download_file()
print(content)  # ← burns tokens

# RIGHT — saves to disk, returns only count
content = download_file()
with open('/path/to/file.json', 'w') as f: json.dump(content, f)
print(f"Saved. {len(content)} items.")  # ← only this in context
```
Never echo downloaded content into the conversation. Save it immediately. Confirm with a count or size, nothing more.

### Law 2 — Never `cat` or `print()` Large Files
Use inspection commands that return minimal output:
```bash
# WRONG
cat large_file.json          # entire file floods context
print(json.dumps(data))      # same problem

# RIGHT
wc -l large_file.json        # just line count
wc -c large_file.json        # just byte size  
head -5 large_file.json      # first 5 lines only
python3 -c "import json; d=json.load(open('f.json')); print(len(d), 'items, keys:', list(d[0].keys()) if d else 'empty')"
```
Read files with targeted python one-liners that extract only the specific fact needed.

### Law 3 — Write Entries/Content to Disk Immediately, Never as Heredocs in Context
When generating large amounts of content (database entries, reports, synthesized knowledge):
```bash
# WRONG — the entire heredoc lives in context
cat << 'EOF' > /tmp/data.py
new_entries = [
  {"id": "e1", "content": "... 500 words of content ..."},
  # 77 more entries...
]
EOF
# All 77 entries just burned context

# RIGHT — write to disk in batches, never accumulate
python3 << 'EOF'
import json
entries = []
# Process one domain at a time
entries.append({"id":"e1", "content":"short summary"})
with open('/path/entries_arms.json', 'w') as f: json.dump(entries, f)
print(f"Wrote {len(entries)} arm entries")
EOF
# Only the count is in context
```

### Law 4 — Process One Domain/Section at a Time
Never try to synthesize all content in one giant script. Break into units:
- One bash call per domain (arms, chest, shoulders, etc.)
- Each call reads its source, writes its output, returns only a count
- Final step: combine files on disk, no content ever in context

```bash
# Pattern for multi-domain work:
# Call 1: process arms → /tmp/arms.json → "14 entries"
# Call 2: process chest → /tmp/chest.json → "8 entries"  
# ...
# Final call: combine all → final_output.json → "77 total entries, done"
```

### Law 5 — Session Handoff: Write a State File to the PERSISTENT Folder

> 🔴 CRITICAL PATH RULE: State files, work-in-progress JSON, and any data needed next session MUST go to the connected workspace folder — in bash: /sessions/ecstatic-cool-pasteur/mnt/Claude/ (which maps to G:/My Drive/Claude/ on the user machine). The temp outputs folder (/sessions/ecstatic-cool-pasteur/mnt/outputs/) is WIPED between sessions. Anything saved there is gone forever. This is the single most common data loss failure.

Right path:  /sessions/ecstatic-cool-pasteur/mnt/Claude/TASK_STATE.json  ✅
Wrong path:  /sessions/ecstatic-cool-pasteur/mnt/outputs/TASK_STATE.json  ❌ GONE NEXT SESSION

### Law 5 — Session Handoff: Write a State File, Not a Summary
At the end of any multi-session task, write a minimal state.json before the session ends:
```json
{
  "task": "second_brain_rebuild",
  "status": "entries_written_need_html_rebuild",
  "files": {
    "new_entries": "/outputs/new_entries_ready.json",
    "current_db": "/outputs/all_entries.json",
    "html": "/outputs/CM_Second_Brain_Database.html"
  },
  "counts": { "new_entries": 77, "domains_done": ["mg_arms","mg_chest","mg_shoulders","mg_back","mg_legs","mg_posing","recipes","nutrition","training_execution"] },
  "next_step": "combine new_entries_ready.json with all_entries.json (remove mg_* and rec* from old), rebuild HTML, deliver via present_files"
}
```
Next session reads this file first. No recap needed. No re-explaining. State file = memory.

### Law 6 — Never Re-Read Files You Already Know the Path To
If a file was written this session, you know what's in it — you wrote it. Don't read it back to verify unless something failed.
```bash
# WRONG — re-reading wastes tokens
python3 -c "import json; d=json.load(open('/tmp/entries.json')); print(d[:3])"  # unnecessary

# RIGHT — trust your write confirmation and move on
```

### Law 7 — Inspect Structure Once, Then Never Again
When you need to understand a file's structure, do it once with a minimal query:
```bash
python3 -c "
import json; d=json.load(open('file.json'))
print(f'Count: {len(d)}, type: {type(d[0]).__name__}, keys: {list(d[0].keys()) if isinstance(d[0],dict) else \"N/A\"}')
print('Sample:', json.dumps(d[0], indent=None)[:200])
"
```
One call. Never call it again. Keep the structure knowledge in context, not the content.

### Law 8 — Summaries Are the Enemy of Efficiency
Never ask Claude to summarize a file into context. If you need to "understand" content, write a script that extracts only the specific facts needed:
```bash
# WRONG
"Summarize the transcript files for me"  # pulls all content into context

# RIGHT  
python3 -c "
import json
data = json.load(open('transcript.json'))
print(f'{len(data)} clips')
print('Folders:', list(set(d[\"folder\"] for d in data)))
print('Titles:', [d[\"title\"] for d in data[:5]], '...')
"  # Only metadata, never the transcript content itself
```

### Law 9 — Parallel Downloads, Serial Processing
Download all needed files in one parallel batch (multiple MCP calls in one turn). Then process serially, one file at a time, writing outputs immediately. Never hold multiple files' content in context simultaneously.

```
# RIGHT workflow:
Turn 1: Download file_A, file_B, file_C simultaneously → save all to disk → "3 files saved"
Turn 2: Process file_A only → write output_A.json → "14 entries"
Turn 3: Process file_B only → write output_B.json → "8 entries"  
Turn 4: Combine output_A + output_B + output_C → final.json → "done"
```

### Law 10 — The 90% Warning Protocol
When the user mentions being near context limit, or context-guardian fires at 85%+:

**Stop all content generation immediately.**

1. Write a state.json with exact file paths and next steps (see Law 5)
2. Write any in-progress data to disk
3. Tell the user: "Saved state. Next session: [one-sentence instruction]"
4. Do nothing else. Every additional word costs tokens.

---

## Multi-Session Task Template

When starting a task that will span sessions, create this structure first:

```bash
# At task start — create state tracking
cat > /outputs/TASK_STATE.json << 'EOF'
{
  "task_name": "...",
  "started": "2026-06-15",
  "status": "in_progress",
  "files": {},
  "completed_steps": [],
  "next_step": "step description",
  "notes": ""
}
EOF
```

Update this file after each step — not by reading it back, but by writing the new version. Next session reads this first, skips all recap.

---

## Database/Content Rebuild Pattern

For the Second Brain rebuild (and any similar large content generation task):

```
Step 1: Identify source files → save paths to state.json (no content)
Step 2: Read existing DB → get schema from ONE sample entry → forget the rest
Step 3: Per domain (one bash call each):
         - Load source transcript from disk
         - Generate 8-15 entries as Python list
         - Write to /outputs/{domain}_entries.json
         - Print only count
Step 4: Combine all domain files → final_entries.json (one bash call)
Step 5: Rebuild HTML (one bash call, reads from disk, writes to disk)
Step 6: present_files → done
```

Token cost of wrong approach: 90% of context window.  
Token cost of right approach: ~20% of context window.

---

## Transcript Processing Pattern

For tasks involving Whisper transcript JSON files:

```bash
# Extract only what you need, never the full transcripts
python3 << 'EOF'
import json, base64

# If base64 encoded from Drive download:
raw = "..." # the base64 string
decoded = json.loads(base64.b64decode(raw).decode('utf-8'))

# Save IMMEDIATELY — never keep in context
with open('/outputs/arms_transcripts.json', 'w') as f:
    json.dump(decoded, f)

# Return only metadata
print(f"Saved {len(decoded)} clips")
print("Folders:", list(set(c['folder'] for c in decoded)))
EOF
# After this, the transcript content is on disk, NOT in context
```

Then when generating entries from transcripts:
```bash
python3 << 'EOF'
import json
clips = json.load(open('/outputs/arms_transcripts.json'))
# Process clips → generate entries → write to disk
# NEVER print clip content to stdout
entries = []
for clip in clips:
    # generate entry from clip['transcript']
    entries.append({...})
with open('/outputs/arms_entries.json', 'w') as f:
    json.dump(entries, f)
print(f"Arms done: {len(entries)} entries")
EOF
```

---

## Warning Signs You're Burning Tokens

Watch for these patterns and stop immediately if you see them:

- **Heredocs over 20 lines** in bash → write to disk instead
- **Printing JSON with more than 5 keys** → use targeted extraction
- **"Let me read that file to confirm..."** → you wrote it, trust the confirmation
- **Prior session summary longer than 500 words** → summarize state.json instead next time
- **Re-downloading files from last session** → state.json should have had the paths
- **All domain entries being generated in one script** → split by domain

---

## The Golden Test

Before any bash command or Python block, ask:

> "Will the output of this command appear in my context window?"

If yes → find a way to pipe it to disk instead.  
If no → proceed.

Content on disk costs zero tokens. Content in context costs everything.

---

## Proactive Session Audit — Fire This First

At the START of any session involving real work, run a silent audit before touching any tools. If any of the following are true, warn Carl immediately:

### Red Flags — Warn Before Any Work Begins

**Flag 1 — Prior Session Summary Present**
If the conversation starts with a `[Summary]` block or "This session is being continued from a previous conversation," that summary alone consumed 5-15% of context before a single tool call. Warn:
> ⚠️ **Token Warning:** This session opened with a large prior-session summary. Context is already partially consumed. If this task involves file processing or content generation, consider opening a fresh session with just: *"read TASK_STATE.json and execute"* — or proceed knowing you have reduced runway.

**Flag 2 — Long Conversation Before First Tool Call**
If there have been 5+ back-and-forth messages before any bash/file tool has been called, warn:
> ⚠️ **Token Warning:** We've had [N] exchanges before starting work. Planning conversations burn context fast. Ready to start? If this is a heavy task, a fresh session now costs less than burning 20% here first.

**Flag 3 — Task Requires Loading Large Content**
Before any step that would pull large data into context (downloading transcripts, reading a big JSON, processing multiple files), pause and confirm the disk-first pattern is in place:
> ⚠️ **Token Check:** This step will pull external content. Confirming: saving directly to disk, not echoing to context. Proceeding.

**Flag 4 — Heavy Prior Work + New Big Task**
If a prior session summary exists AND the user is starting a NEW large task (not continuing), warn strongly:
> 🛑 **Strong Token Warning:** You have prior session context loaded AND a new heavy task. This will burn through context fast. Strongly recommend: start a fresh session, put the task in one line. You'll finish the same work with 3x more runway.

### The Session Start Checklist (Silent, Every Session)

Run this mentally before responding to any work request:

```
□ Is there a prior session summary in context? → Warn (Flag 1)
□ Has conversation been 5+ turns before first tool call? → Warn (Flag 2)  
□ Does the task involve downloading/reading large files? → Confirm disk-first (Flag 3)
□ Is this a brand new heavy task on top of existing context? → Warn strongly (Flag 4)
□ Is context-guardian already reporting 75%+? → Emergency: write state, stop work
```

### The Fresh Session Recommendation

When any 2+ red flags are present, recommend a fresh session with the exact prompt to use:

> **Recommendation:** Start a fresh session with this prompt:
> *"[one-line task description] — read TASK_STATE.json first"*
>
> This saves your current context for conversation and gives the execution task a clean 100% window.

### The 25% Rule

If the work hasn't started yet and context is already at 25%+ (long summary, lots of conversation, skills loaded), say it plainly:
> ⚠️ You're at ~25% context before work has started. Heavy tasks (file processing, content generation, database rebuilds) typically use 40-60% of context. You may not finish in this session. Fresh session recommended.

