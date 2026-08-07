# Eastman Plan Auto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily scheduled task that detects new/changed coach diet PDFs in `G:\My Drive\Coaching documents\`, parses them, and opens a propose-first PR updating Row's `coach-meal-plan.js` (+ phase-change report), with a Telegram delta summary.

**Architecture:** The entire feature is one agent skill (`SKILL.md`) executed by a daily scheduled Claude Code session — no Row runtime code changes. Detection is a stat+sha256 diff against a JSON state file; parsing is `pypdf` text extraction read by the session itself; the proposal is a normal git branch + GitHub PR on `cmeyer117/row`; notification reuses Jarvis's existing `/scheduled/autopilot-send-card` Telegram route. Spec: `docs/superpowers/specs/2026-08-07-eastman-plan-sync-design.md`.

**Tech Stack:** Scheduled-task SKILL.md (claude-config repo) · python3 + pypdf · git/`gh` in `C:\Users\gregm\row` · Supabase REST read of `app_state.po_coach_season` · curl to Jarvis Railway.

---

### Task 1: Write the task skill

**Files:**
- Create: `C:\Users\gregm\.claude\scheduled-tasks\eastman-plan-sync\SKILL.md`

- [ ] **Step 1: Write the SKILL.md exactly as follows**

````markdown
---
name: eastman-plan-sync
description: Daily — detect new/changed coach plan files in G:\My Drive\Coaching documents\, parse diet PDFs, open a propose-first PR updating Row's coach-plan surfaces, Telegram the delta. Most days this is a silent no-op.
---

You are running Carl's daily coach-plan sync. Propose-first: you NEVER merge, never push to `main`, never edit Supabase data — you open a PR and report. Most days nothing changed and you exit silently.

## Step 1 — Detect changes

State file: `G:\My Drive\Claude\Claude Outputs\eastman-sync-state.json` — shape `{"files": {"<name>": {"size": N, "mtime": N, "sha256": "..."}}, "lastProposal": {"sha256": "...", "pr": "..."}}`.

Run:

```bash
python - <<'EOF'
import os, json, hashlib
FOLDER = r'G:\My Drive\Coaching documents'
STATE = r'G:\My Drive\Claude\Claude Outputs\eastman-sync-state.json'
state = {"files": {}}
if os.path.exists(STATE):
    state = json.load(open(STATE, encoding='utf-8'))
changed = []
for f in sorted(os.listdir(FOLDER)):
    p = os.path.join(FOLDER, f)
    if not os.path.isfile(p): continue
    st = os.stat(p)
    prev = state["files"].get(f)
    if prev and prev["size"] == st.st_size and abs(prev["mtime"] - st.st_mtime) < 2:
        continue  # unchanged by stat — skip hashing
    try:
        h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    except OSError:
        h = "UNREADABLE"  # Google-native pointer files (.gsheet) have no local bytes — track by size+mtime only
    if prev and prev.get("sha256") == h and h != "UNREADABLE":
        state["files"][f] = {"size": st.st_size, "mtime": st.st_mtime, "sha256": h}
        continue  # touched but identical content — refresh stat silently
    changed.append(f)
    print("CHANGED:", f, h)
json.dump(state, open(STATE + '.tmp', 'w', encoding='utf-8'), indent=1)
os.replace(STATE + '.tmp', STATE)
print("RESULT:", json.dumps(changed))
EOF
```

(The stat refresh for identical-content files is safe to persist immediately; genuinely changed files are added to state only in Step 6.)

If `RESULT: []` → invoke the `write-run-logs` skill for task id `eastman-plan-sync` with a one-line "no changes" trace and STOP. Silence is the correct outcome — no Telegram, no report.

## Step 2 — Classify each changed file

- Name contains `Macros` (case-insensitive) or is a PDF whose extracted text clearly reads as a meal plan (meals, grams, foods) → **diet pipeline** (Steps 3–6).
- Anything else (M5/M6 program blocks, `.xlsx`, `.gsheet`, unknown) → **notify-only**: send the Step 5 Telegram with text `"Coach folder: <name> changed — not auto-synced (v1 covers diet PDFs only). Read it manually."`, then record it in state (Step 6). No PR.

## Step 3 — Parse the diet PDF

```bash
python - <<'EOF'
from pypdf import PdfReader
import sys
r = PdfReader(r'G:\My Drive\Coaching documents\<CHANGED FILE>')
for i, pg in enumerate(r.pages):
    print(f'--- page {i+1} ---')
    print(pg.extract_text() or '')
EOF
```

Read the output yourself and extract: **phase name**, **phase start date**, **each meal** (label, foods with grams, OR-choices kept as alternatives), and **guidance lines** (cardio, supplements, sauces, notes). If the text is garbage/empty (scanned image), treat as parse failure → Step 5's failure message, then Step 6. Fail loud once, not daily.

## Step 4 — Build the proposal

1. Read `C:\Users\gregm\row\staple-foods.js` (valid `foodName` values) and the current `C:\Users\gregm\row\coach-meal-plan.js` (structure + header conventions).
2. Regenerate `coach-meal-plan.js`: same IIFE structure, `MEALS` array of `{label, rows: [{foodName, grams}]}`. Mapping rules: exact staple match preferred; OR-choices → first-listed option (the Calculator dropdown is the picker — keep that header comment); generic "fruit"/"veggies" → `Banana`/`Broccoli (cooked)` per the existing convention; **a food with no reasonable staple match → nearest staple + add it to the report's `⚠ VERIFY` list — never silently drop a food**. Update the header comment: phase, start date, source PDF filename, today's date.
3. In `C:\Users\gregm\row` (native checkout — git is fine here, never run node from Drive paths):

```bash
cd /c/Users/gregm/row && git fetch && git checkout -B coach-sync/$(date +%F) origin/main
# write the regenerated coach-meal-plan.js now
git add coach-meal-plan.js && git commit -m "feat(coach-sync): propose coach plan update — <phase> (<PDF date>)" && git push -u origin coach-sync/$(date +%F)
```

4. **Duplicate guard:** `gh pr list --repo cmeyer117/row --state open --search "coach-sync"` — if an open coach-sync PR's body contains `<!-- source-sha256: <this file's hash> -->`, skip creation and reuse that PR's URL in Step 5.
5. Create the PR (`gh pr create --repo cmeyer117/row --head coach-sync/$(date +%F)`) titled `Coach plan sync — <phase> (<PDF date>)`. Body = the report:
   - `<!-- source-sha256: <hash> -->` (dedup marker)
   - **Phase delta:** PDF's phase/start vs current `po_coach_season` — read it: `curl -s "<SUPABASE_URL>/rest/v1/app_state?key=eq.po_coach_season&select=data" -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"` (both constants are at the top of `C:\Users\gregm\row\sync.js`).
   - **Per-meal changes:** old → new, one line per changed row.
   - **⚠ VERIFY list:** unmapped/guessed foods.
   - **Unplaced guidance:** coach lines with no Row home yet (cardio, supplements, sauce rules).
   - **On approval, also run:** the exact `po_coach_season` REST PATCH (or "no phase change").
   - **Vault flag:** if phase or meals changed, note that the vault Cooking Coach master note transcription is now stale (session work, not this task's).
6. Write the same report to `G:\My Drive\Claude\Claude Outputs\eastman-sync-proposal-<today>.md` and set `lastProposal` in the state file.
7. End with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)` in the PR body.

## Step 5 — Telegram the delta

Reuse the existing route (same pattern as adherence-sentinel; `SCHEDULER_SECRET` from `C:\Users\gregm\jarvis-embed\.env`):

```bash
curl -X POST https://claude-workspace-production-8460.up.railway.app/scheduled/autopilot-send-card \
  -H "Content-Type: application/json" \
  -H "x-scheduler-secret: <SCHEDULER_SECRET>" \
  -d '{"text": "Coach plan update: <phase headline>\n<top 3 deltas>\nPR: <url>", "contentIdeaId": "eastman-plan-sync-<today>", "buttons": []}'
```

Parse failure text instead: `"New coach PDF couldn't be parsed — read it manually: <name>"`. Telegram failure is non-fatal: log it in the run log; the PR + report are the durable outputs.

## Step 6 — Record state + run log

Update the state file entry for each file you fully handled (proposal opened, notify-only sent, or parse-failure notified) with its current `{size, mtime, sha256}` — a crashed run must retry tomorrow, so never record a file you didn't finish. Then invoke `write-run-logs` for `eastman-plan-sync` with the step trace.
````

- [ ] **Step 2: Commit (claude-config repo)**

```bash
cd /c/Users/gregm/.claude && git add scheduled-tasks/eastman-plan-sync/SKILL.md && git commit -m "feat: add eastman-plan-sync scheduled task skill"
```

### Task 2: Seed the state file (stale seed for the dry run)

**Files:**
- Create: `G:\My Drive\Claude\Claude Outputs\eastman-sync-state.json`

- [ ] **Step 1: Write true stats for all files EXCEPT the current plan PDF, which gets a deliberately wrong sha256**

```bash
python - <<'EOF'
import os, json, hashlib
FOLDER = r'G:\My Drive\Coaching documents'
STATE = r'G:\My Drive\Claude\Claude Outputs\eastman-sync-state.json'
files = {}
for f in sorted(os.listdir(FOLDER)):
    p = os.path.join(FOLDER, f)
    if not os.path.isfile(p): continue
    st = os.stat(p)
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    if f == 'BLACK MAGMA FITNESS CLIENT Carl - Macros.doc.pdf':
        h = 'STALE-SEED-FOR-DRY-RUN'
        st_mtime = 0.0
    else:
        st_mtime = st.st_mtime
    files[f] = {"size": st.st_size, "mtime": st_mtime, "sha256": h}
json.dump({"files": files}, open(STATE, 'w', encoding='utf-8'), indent=1)
print("seeded", len(files), "files; stale:", [f for f,v in files.items() if v["sha256"].startswith("STALE")])
EOF
```

Expected: `seeded 9 files; stale: ['BLACK MAGMA FITNESS CLIENT Carl - Macros.doc.pdf']`

### Task 3: Dry-run the skill end-to-end (this IS the test)

- [ ] **Step 1: Execute SKILL.md Step 1 verbatim** — Expected: `CHANGED: BLACK MAGMA FITNESS CLIENT Carl - Macros.doc.pdf <hash>`, `RESULT: ["BLACK MAGMA..."]`
- [ ] **Step 2: Execute Steps 2–3** — classify diet, extract text, read the full plan
- [ ] **Step 3: Execute Step 4** — regenerate `coach-meal-plan.js`, branch `coach-sync/2026-08-07`, commit, push, PR created with full report body. **Accuracy gate: `git diff origin/main -- coach-meal-plan.js` on the branch must be ~empty** (header/date lines only) since the current file was hand-transcribed from this same PDF. A substantive diff = a parse or mapping bug — STOP and fix before proceeding.
- [ ] **Step 4: Execute Step 5 for real once** — Expected: HTTP 200 and a real Telegram message on Carl's phone with the PR link
- [ ] **Step 5: Execute Step 6** — state file now holds the true hash; report file exists in `Claude Outputs`
- [ ] **Step 6: Re-run SKILL.md Step 1** — Expected: `RESULT: []` (silent no-op confirmed)

### Task 4: Clean up the dry run

- [ ] **Step 1: Close the PR unmerged and delete the branch** (scratch-branch rule)

```bash
cd /c/Users/gregm/row && gh pr close coach-sync/2026-08-07 --delete-branch && git checkout main && git branch -D coach-sync/2026-08-07 2>/dev/null; git fetch --prune
```

- [ ] **Step 2: Verify** — `gh pr list --state open` shows no coach-sync PR; `git branch -a` shows no coach-sync branches; state file retains true hashes (so the real task won't re-fire on this PDF)

### Task 5: Register the schedule + ship

- [ ] **Step 1: Register via `mcp__scheduled-tasks__create_scheduled_task`** — name `eastman-plan-sync`, cron `40 7 * * *` (daily 7:40 AM, after the 7:00 morning brief), prompt: "Invoke the eastman-plan-sync skill and follow it exactly."
- [ ] **Step 2: Confirm via `list_scheduled_tasks`** — task present, `nextRunAt` populated
- [ ] **Step 3: Push claude-config** — `cd /c/Users/gregm/.claude && git push`
- [ ] **Step 4: Commit + push this plan and mark the checklist/backlog docs** (row repo plan doc; HANDOFF at session close)
