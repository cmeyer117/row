# Row Evening Shutdown — Design

**Date:** 2026-08-06
**Status:** Approved (approach + verdict format picked by Carl in-session)
**Owner:** Row (`C:\Users\gregm\row`)

## Goal

Give the evening its own small mirror ritual on `main.html` (vision-scan item #6). Today the 17:00 Evening Close exists only inside a *completed* Morning Launch card and asks 3 reflection questions. Evening Shutdown extends it into a proper close-of-day panel that:

1. **Reviews the movers** — the day's 3 needle movers with live done-state, closeable from the panel (reconciling with the Today list through the existing Morning Launch reconciliation path). If no completed launch exists that day, it shows today's Today list items instead so the ritual still works on skipped mornings.
2. **Records a one-line day verdict** — a three-state **Win / Push / Miss** pill plus an optional one-line note.
3. **Keeps the existing 3 close questions** (What moved / What interfered / What changes tomorrow) unchanged.

## Approach

Extend, don't fork. No new storage key, no new page, no new card lifecycle.

- The existing `mlBuildEvening()` block in `main.html` becomes the Evening Shutdown panel, still rendered inside the Morning Launch card area after 17:00 (`mlEveningDue()` unchanged).
- **New behavior:** it also renders when the day's session is missing, draft, or skipped — not only completed. If no `morning_launch:<date>` record exists when the shutdown is saved, a stub record is created (`status` preserved as-is if present; a fresh stub uses `status: "skipped"` semantics only for the evening fields — it never fabricates morning-phase data).
- Mover review renders each mover's text (via `textSnapshot` fallback to live goal lookup) with a checkbox wired through the existing bidirectional reconciliation, exactly as the completed command view already does. No-launch days list today's `goals:*` items read-only-checkable the same way the Today list itself checks them.

## Data Model

Same date-keyed `morning_launch:` record. The `evening` object gains two fields:

```json
"evening": {
  "moved": "string",
  "interference": "string",
  "tomorrowChange": "string",
  "verdict": "win | push | miss",
  "verdictNote": "string",
  "completedAt": "ISO-8601 timestamp"
}
```

Both new fields optional for backward compatibility; old records without them render fine. Saving requires a verdict selection; the note and the 3 questions stay optional-but-encouraged (empty strings allowed, matching current behavior).

## Module Boundaries

- `morning-launch-logic.js`: new pure helpers — `buildEveningShutdown(session, todayGoals)` (projection of what the panel shows: mover list vs Today fallback), `validateEveningClose(evening)` (verdict must be one of the 3 states when present), and the Vault-projection function extended to include verdict/note.
- `morning-launch-logic.selfcheck.cjs`: new assertions for the above (verdict validation, fallback list when no movers, projection includes verdict, old-record compatibility).
- `main.html`: panel markup/wiring only. Verdict pills reuse the existing pill styling pattern; all user text through the existing `escape()` helper.

## Vault Integration

`row-vessel-vault-sync` SKILL.md section 4 (Morning Launch export) gains one line: include `Verdict: Win — <note>` in each date's block when present. Same dedup marker, same fail-closed rules. No other change.

## Error Handling

- Missing/deleted mover references: same unavailable-reference handling the command view already has.
- Saving with no verdict selected: inline validation message, nothing written.
- Sync: `evening` rides inside the existing date-keyed record — no new merge logic.

## Verification

- Selfcheck: all new pure-logic assertions green plus existing suite unchanged.
- Browser: panel renders after 17:00 in all 4 session states (completed / draft / skipped / absent); verdict save + reload persistence; mover check from the panel updates the Today list and vice versa; before-17:00 renders nothing; 375px no horizontal overflow.

## Non-Goals

- No verdict trend chart yet (data accrues first; chart is a later small item).
- No notification/reminder to do the shutdown.
- No change to Morning Launch's morning phases or skip semantics.
