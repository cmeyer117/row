---
name: project-guardian
description: >
  Trigger before building, creating, scaffolding, deploying, or making a new app, tool,
  feature, or component — and before rebuilding/regenerating an existing data file or
  knowledge base (e.g. "rebuild the Second Brain database"). Fires on "add X to Jarvis",
  "build a new tab", "create a new app", "make a tool for...", "start a project",
  "rebuild the database". Prevents duplicate builds and stale-data rebuilds by checking
  PROJECT_REGISTRY.md first. SNAPSHOT RULE: after any session where something was built
  or changed, proactively ask "Session Snapshot — update PROJECT_REGISTRY.md?" without
  waiting for Carl to say done. This is Carl's anti-amnesia system — false positives are
  free, missed snapshots cause duplicate work and repeated mistakes.
---

# Project Guardian

**One job: never let Claude build something that already exists, or rebuild from stale data.**

The Jarvis incident: Claude forgot the deployed React app on Vercel, built a stripped-down
replacement from scratch, wasted tokens and time. This skill prevents that permanently.

---

## Path Reference — read this before using any command below

Carl's persistent working folder is `G:\My Drive\Claude\` on Windows. The registry lives at:

```
G:\My Drive\Claude\PROJECT_REGISTRY.md
```

There is no `~` home directory in this setup — `~/PROJECT_REGISTRY.md` resolves to nothing
or the wrong place. Two tool paths can reach the same file, and they are not interchangeable:

- **Read / Write / Edit tools** — use the Windows path above directly. This is the
  Carl-visible copy (the one he'd see if he opened Drive himself), and it's the canonical
  source of truth.
- **Bash (`mcp__workspace__bash`)** — sees the same folder through a session-specific mount,
  shown in that session's environment notes as something like
  `/sessions/<session-id>/mnt/Claude/PROJECT_REGISTRY.md`. The exact mount name changes per
  session — check the current session's path-mapping note rather than hardcoding one.

**Why this matters — sync lag is real, not theoretical.** During this session, reading
`TASK_STATE.json` through the Read tool and through a bash `cat` on the mounted path
returned two different histories — the bash copy was a full session behind, because Google
Drive sync hadn't caught up on that mount yet. Trusting one path blindly defeats the whole
point of a registry: false confidence is worse than no registry at all.

**Rule:** read and write `PROJECT_REGISTRY.md` with the Read/Write/Edit tools by default.
If you use bash for a scripted update instead, re-read the file with the Read tool
immediately afterward and confirm the content actually landed before telling Carl it's done.

---

## How It Works

Two modes:

1. **PRE-BUILD CHECK** — fires before any construction or rebuild task
2. **SESSION SNAPSHOT** — fires at session end to update the registry

---

## Mode 1: Pre-Build Check

### Step 1 — Read the Registry

Before writing a single line of code, or kicking off a full rebuild of an existing data
file, read the registry with the Read tool:

```
Read("G:\My Drive\Claude\PROJECT_REGISTRY.md")
```

If it doesn't exist yet → skip to **Bootstrap** section below.

### Step 2 — Match Against Request

Scan every entry in the registry. Look for:
- **Name match** — does the request mention a project or tool that's registered?
- **Feature match** — does the request describe something that should be added to an
  existing project rather than built standalone?
- **URL match** — does the user mention a domain or service that's already deployed?
- **Rebuild match** — does the request describe regenerating an existing knowledge base
  or data file? If so, the registry entry's current record count and last-updated date are
  the baseline to verify against before and after the rebuild — not something to take on
  faith from memory.

### Step 3 — Surface the Result

**If a match is found:**

```
🛡️ Project Guardian — Existing Project Detected

Project: [name]
Deployed at: [URL, or "N/A — knowledge tool / data deliverable"]
Repo: [path/repo, or "N/A — lives directly in Drive"]
Stack: [tech]
What's already built: [list of tabs/routes/components, or files/record count]

Rule: [the DO NOT REBUILD rule for this project]

─────────────────────────────────────────────
What you asked for sounds like it belongs inside this project.
Should I add it as a new feature/tab/route to [project name]?
```

**Do not proceed until Carl confirms.**
Do not start building a standalone version.
Do not "check the existing code real quick and then decide" — ask first.

**If no match is found:**

```
🛡️ Project Guardian — New Project Confirmed

No existing project matches this request.
Registering: [name]
Proceeding with build.
```

Then proceed with the task — and add the new project to the registry at session end.

---

## Mode 2: Session Snapshot

**Claude initiates this — do not wait for Carl to say "done" or "wrapping up."**

After any message where a feature was shipped, a tab was added, a route was created,
a schema was changed, a data file was rebuilt, or a significant build was completed —
Claude proactively asks:

```
🛡️ Session Snapshot — we built [X] today. Want me to log it to PROJECT_REGISTRY.md
so next session picks it up automatically?
```

If Carl says yes or doesn't object, run the snapshot immediately.
The journal tab incident was caused entirely by Mode 2 never firing. This cannot repeat.

Triggers when: anything was built or substantially changed this session — proactively,
without waiting for cues.

### Step 1 — Read the Current Registry

```
Read("G:\My Drive\Claude\PROJECT_REGISTRY.md")
```

### Step 2 — Write the Update

Add or update the entry for whatever was built/changed this session. Two template shapes
exist below — use **Software Project** for deployed apps/services, **Knowledge Tool** for
data deliverables that have no deployment (Second Brain database, exported reports, etc.).
Pick whichever actually matches; don't force a software shape onto a data deliverable.

### Step 3 — Persist the File

The registry's persistence does **not** depend on git. It lives directly in
`G:\My Drive\Claude\PROJECT_REGISTRY.md`, which Google Drive syncs on its own — saving it
with the Write/Edit tool is enough.

Only touch git if the specific project being updated is itself a git repo and Carl wants
the registry mirrored into that repo too — that's a secondary, optional copy, not the
primary one:

```bash
cd [that project's repo root]
git add PROJECT_REGISTRY.md
git commit -m "chore: update project registry after session"
git push
```

Skip this step entirely for Drive-only deliverables (no `.git` anywhere) — there's nothing
to commit, and trying to `cd` into a nonexistent repo root is exactly the kind of false
assumption this skill exists to avoid making else