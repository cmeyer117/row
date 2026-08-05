# Row Morning Launch — Evidence-Based 5-4-5 Design

**Date:** 2026-08-05  
**Status:** Approved  
**Owner:** Row (`C:\Users\gregm\row`) with a read-only history mirror in the Carl Meyer Vault

## Goal

Add a 10–15 minute guided Morning Launch to Row's Goals page that makes Carl write, align his day to five current outcomes, rehearse the process required for success, identify the likely obstacle, and commit to three executable needle movers before reactive work takes over.

The feature adapts the social-media “5-4-5” idea into:

- **5 current outcomes** that set direction.
- **4 guided morning phases:** Clear, Align, Visualize, Commit.
- **5 daily commitments:** three needle movers, one explicit win condition selected from those movers, and one if-then obstacle plan.

## Evidence and Product Implications

- Specific, challenging goals are most useful when paired with commitment and progress feedback. Row must connect daily tasks to current outcomes and show completion, rather than display aspirations alone.
- Process simulation improves planning and performance more reliably than imagining success alone. The visualization prompt must rehearse actions, not merely the finished result.
- Mental contrasting with implementation intentions improves goal attainment. Every launch must pair the desired result with a realistic internal obstacle and an “If X, then Y” response.
- Recorded progress improves goal attainment. Morning answers and evening outcomes must be stored, reviewable, and mirrored into the Vault.
- Knowledge workers systematically misestimate duration. Needle movers need estimates now and planned-versus-actual calibration later; version one records estimates without inventing an automated scheduling engine.

Primary references:

- Locke and Latham, goal-setting theory: <https://www.psychologicalscience.org/journals/current-directions/j.1467-8721.2006.00449.x/>
- Pham and Taylor, process versus outcome simulation: <https://journals.sagepub.com/doi/10.1177/0146167299025002010>
- Wang, Wang, and Gai, MCII meta-analysis: <https://pubmed.ncbi.nlm.nih.gov/34054628/>
- Sheeran, Listrom, and Gollwitzer, implementation-intention meta-analysis: <https://doi.org/10.1080/10463283.2024.2334563>
- Harkin et al., progress-monitoring meta-analysis: <https://eprints.whiterose.ac.uk/id/eprint/87431/>

## Experience

### Entry State

`main.html` gains a Morning Launch card above the existing Today list. Before completion it shows the estimated duration, current step, and a primary **Start Morning Launch** or **Continue Morning Launch** action. It does not block access to the rest of Row.

Skipping remains possible, but Row asks for a short reason and records it for later review. A skipped launch can still be resumed the same day.

### Phase 1 — Clear (2 minutes)

Prompt: **What is occupying your mind right now?**

Carl writes into a freeform brain-dump field. Row stores the writing verbatim and does not automatically create tasks from it. This preserves the reflective purpose and prevents accidental task proliferation.

### Phase 2 — Align (3 minutes)

Row asks Carl to write shortened versions of his five current outcomes from memory. After submission, Row reveals the saved outcome set for comparison. Carl selects the single outcome that matters most today.

The canonical five outcomes are edited through a monthly review control, not rewritten as new canonical goals every morning. Daily recall is deliberately manual.

### Phase 3 — Visualize (3 minutes)

Prompts:

1. **What does doing the work successfully look like?** Describe the process you will perform.
2. **What internal obstacle is most likely to interfere?**
3. **If that happens, what exactly will you do?**

Row renders the last two answers as a rehearsable sentence: **If [obstacle], then I will [response].** The user confirms the sentence before continuing.

### Phase 4 — Commit (4–7 minutes)

Carl chooses or creates three needle movers. Each mover contains:

- Task text.
- Linked current outcome.
- Concrete definition of done.
- Literal first physical action.
- Estimated focused minutes.
- Sort order.

One of the three is marked as the day's win condition. A mover selected from the existing Today list references that task rather than duplicating it. A newly created mover is added to the Today list and then referenced.

Completing the ritual exposes **Start First Needle Mover**, which switches the compact card to the first mover and its first action. Version one does not add a timer or calendar integration.

### Completed State

The card collapses into a daily command view containing:

- Today's win condition.
- Three ordered needle movers and their completion state.
- Current first action.
- If-then plan.
- **Begin/Resume** and **Review Launch** actions.

Checking a referenced Today task updates the Morning Launch mover, and checking a mover updates the referenced Today task. There is one task record, not two independently editable copies.

### Evening Close (2 minutes)

After a configurable evening threshold, the completed card offers a short close:

- What moved today?
- What interfered?
- What changes tomorrow?

The evening close is optional and never prevents the next day's launch.

## Data Model

Row keeps operational state in its existing localStorage-plus-Supabase `app_state` pattern.

### Canonical Outcomes

Key: `morning_outcomes_v1`

```json
{
  "outcomes": [
    { "id": "outcome-id", "text": "Outcome text", "active": true, "order": 0 }
  ],
  "reviewedAt": "ISO-8601 timestamp"
}
```

Exactly five active outcomes are required to complete Align. Editing them does not rewrite historical sessions.

### Daily Session

Key prefix: `morning_launch:` followed by the existing Eastern-time date key.

```json
{
  "version": 1,
  "date": "YYYY-MM-DD",
  "status": "draft | completed | skipped",
  "currentPhase": "clear | align | visualize | commit | complete",
  "brainDump": "string",
  "recalledOutcomes": ["string"],
  "savedOutcomeSnapshot": [{ "id": "string", "text": "string" }],
  "focusOutcomeId": "string",
  "processVisualization": "string",
  "obstacle": "string",
  "response": "string",
  "needleMovers": [
    {
      "id": "string",
      "goalDateKey": "goals:YYYY-MM-DD",
      "goalId": "string",
      "outcomeId": "string",
      "definitionOfDone": "string",
      "firstAction": "string",
      "estimatedMinutes": 60,
      "order": 0,
      "textSnapshot": "string",
      "doneSnapshot": false
    }
  ],
  "winMoverId": "string",
  "skipReason": "string",
  "startedAt": "ISO-8601 timestamp",
  "completedAt": "ISO-8601 timestamp",
  "evening": {
    "moved": "string",
    "interference": "string",
    "tomorrowChange": "string",
    "completedAt": "ISO-8601 timestamp"
  }
}
```

Existing goal objects receive stable IDs when needed. Historical objects without IDs are lazily upgraded without changing their text or completion state. Legacy IDs are derived deterministically from the goal's date key, text, and position rather than randomly, so two devices that independently upgrade the same untagged goal before syncing converge on the same ID instead of colliding under sync's merge-by-ID.

Each mover's `textSnapshot`/`doneSnapshot` is written once at Commit (mover text) and refreshed on every reconciled completion change (done state) — they are the durable record the Vault export reads. The live command view still displays and reconciles through the `goalDateKey`/`goalId` reference so a single task record remains editable in one place; the snapshot exists only so history survives `rollover()` deleting or reconstructing old `goals:*` records. Later edits to the referenced task's text do not rewrite `textSnapshot`.

`savedOutcomeSnapshot` is captured once, at Align confirmation (when the focus outcome is selected), and never updated afterward even if canonical outcomes change before Commit completes.

A skipped session can resume the same day: resuming sets `status` back to `draft`, retains `skipReason` as historical metadata, and continues at the saved `currentPhase`.

The evening-close threshold is a fixed local-time default of 17:00 for version one (no settings UI). "Eastern-time date key" means Row's existing `getActiveDateString()` convention (local device clock, 6 AM rollover) — not an explicit `America/New_York` conversion. Multi-timezone device use inherits this existing Row-wide limitation; Morning Launch does not add a new one.

Drafts save after every input change. Sync must include both `morning_outcomes_v1` and the `morning_launch:` prefix in the existing Goals app state. Cloud-applied changes dispatch the existing Goals refresh path plus a Morning Launch-specific refresh event.

## Module Boundaries

- `morning-launch-logic.js`: pure validation, phase progression, if-then formatting, mover/reference reconciliation, and session summaries. It has no DOM or storage access.
- `morning-launch-logic.selfcheck.cjs`: deterministic tests for the pure module.
- `main.html`: markup, styles, DOM event wiring, storage calls, sync registration, and integration with the existing Today list.
- No framework, build step, API endpoint, AI dependency, or new Supabase table.

## Vault Integration

### Knowledge Note

Create `Carl Meyer/06 - Psychology & Mindset/Morning Launch — Evidence-Based 5-4-5.md` with Codex provenance. It contains the evidence, exact protocol, failure modes, and links to:

- `[[WOOP — Mental Contrasting (Oettingen) — Deep Dive]]`
- `[[Discipline & Self-Mastery Rituals]]`
- `[[Goals]]`
- `[[ROW Dashboard]]`

Update `Carl Meyer/02 - Projects/ROW Dashboard.md` to document the live feature, storage keys, and Vault mirror after implementation is verified.

### Daily History Mirror

Extend the existing `row-vessel-vault-sync` scheduled workflow to export completed or skipped Morning Launch sessions into a monthly append-only note:

`Carl Meyer/11 - Personal Logs/Morning Launch/YYYY-MM Morning Launch Log.md`

Each date appears at most once, marked by a hidden `<!-- morning-launch:YYYY-MM-DD -->` comment above its heading so the workflow can detect duplicates without depending on visible text formatting, and contains:

- Status and completion time.
- Focus outcome snapshot.
- Win condition and three needle movers (from each mover's `textSnapshot`) with completion state (from `doneSnapshot`) — never a live lookup against `goals:*`, which rollover may have deleted or reconstructed by export time.
- Process visualization.
- If-then plan.
- Evening close, when present.

The raw brain dump is excluded from the mirror by default because it may contain transient or sensitive thoughts. Row retains it in the operational session. The export uses the saved outcome snapshot so later edits to canonical outcomes cannot rewrite history.

The monthly note is a readable history mirror, not a second editable task source. Sync is one-way from Row to Vault, append-only by date, and must fail closed if the source record is incomplete or the destination already contains that date.

Because the scheduled workflow is Claude-owned, its edit is in scope only because Carl explicitly approved implementing the mirror into both Row and the Vault. The edit must preserve its existing canary and unrelated Row/Vessel export behavior.

## Error Handling

- Incomplete phases remain drafts and can resume after refresh or device changes.
- Missing/deleted referenced Today tasks are shown as unavailable; Row offers to recreate or replace the reference and never silently creates a duplicate.
- Fewer or more than three movers blocks ritual completion with a direct validation message.
- Missing canonical outcomes routes to the monthly outcome editor.
- Sync conflicts follow Row's existing Goals merge behavior; Morning Launch records are date-keyed and merged independently rather than replacing unrelated dates.
- Vault export failures leave Row unchanged and surface through the scheduled workflow's existing failure reporting.

## Privacy and Safety

- No new credentials are embedded in Row.
- The browser does not write directly to Obsidian or Google Drive.
- The freeform brain dump is excluded from the Vault mirror by default.
- User-authored text must render through text-safe DOM APIs or Row's existing escaping helper; never interpolate it unsafely into HTML.

## Verification

### Logic

The self-check covers:

- Valid and invalid phase transitions.
- Exactly five active outcomes.
- Exactly three movers and one valid win mover.
- If-then sentence construction.
- Stable lazy IDs for legacy Today tasks.
- Bidirectional completion reconciliation without duplication.
- Snapshot preservation after canonical outcome edits.
- Session summary and Vault-export projection, including brain-dump exclusion.

### Browser

Verify locally and on the deployed mobile-width layout:

- New, draft, completed, skipped, and evening-close states.
- Refresh/resume during every phase.
- Existing Today task selected as a mover.
- New mover created into Today.
- Completion updates in both views.
- Cross-device cloud reload.
- Keyboard navigation, visible labels, and no horizontal overflow.
- Existing Goals, tomorrow queue, recurring daily tasks, ticker, and streak behavior remain intact.

### Vault

- Knowledge note has valid provenance and working wikilinks.
- Project note reflects the verified implementation only after it is live.
- Scheduled export appends one date once, omits brain-dump text, preserves existing content, and no-ops safely on rerun.

## Non-Goals

- AI coaching or automatic interpretation of journal text.
- Automatic calendar scheduling.
- A Pomodoro/focus timer.
- A hard gate blocking access to Row.
- Gamified streak penalties.
- Turning every brain-dump line into a task.
- Two-way editing between the Vault and Row.
