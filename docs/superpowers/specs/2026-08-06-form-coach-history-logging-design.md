# Form Coach History Logging — Design

**Date:** 2026-08-06
**Status:** Approved by Carl, implementing directly (small enough to skip a separate plan doc)
**Related:** Follow-up to `2026-08-06-posing-lift-form-coach-design.md`, which explicitly deferred persistence ("no persistence this pass... add history logging later if the scoring proves useful"). This is that later pass — Carl wants to test tomorrow whether the scoring holds up over multiple real sessions, which needs a record to look back at.

## Problem

`form-coach.html` (Posing Coach + Lift-Form Coach) computes and displays a result on screen, then discards it. Nothing survives a page reload. Carl can't judge whether the scoring is any good without something to compare across sessions.

## Scope

- **Capture only, no read path.** No history list, no trends UI, no pruning. Carl reviews raw data directly (Supabase table editor or asks me to pull it) — matches "just capture" from brainstorming.
- **Full detail per session** — everything already on screen, not just headline numbers.
- Zero changes to `gym.html` or `posing.html` beyond what the original design already allowed (the optional nav link, unrelated to this).

## Storage

Same `app_state` key/data pattern already used by `gym.html`'s `po_coach_v1` state and Vision's memory keys elsewhere in this codebase — not a new table, not per-row inserts.

- **Key:** `row:form-coach-history`
- **Shape:** `{ sessions: [...] }`, array of records, newest appended:
  - Posing: `{ type: 'posing', timestamp: ISO string, pose: string, holdTimeMs: number, symmetryReadout: [{ pair: string, deltaDeg: number, note: string }] }`
  - Lift-form: `{ type: 'lift', timestamp: ISO string, exercise: string, reps: [{ rom: number, tempo: number, stability: number, flagged: boolean, flagReason: string | null }] }`

`form-coach.html` gets its own minimal Supabase client (CDN `@supabase/supabase-js` include, same `SUPABASE_URL`/anon key already used by `posing.html`/`gym.html` — this is the shared project, not a new one). Independent of `gym.html`'s sync machinery per the original design's standalone-page constraint.

## Write path

- New pure function in `form-coach-logic.js`: `buildHistoryRecord(type, data)` — shapes a session's result into the record format above. Pure, unit-testable, no Supabase/DOM.
- In `form-coach.html`: right after the existing on-screen result renders (freeze-and-compare for posing, summary screen for lifts), fetch current `row:form-coach-history` app_state row, append the new record, upsert back. Fire-and-forget — no loading spinner, no retry, no blocking the UI. A failed write is silently swallowed (logged to console only) since this is optional data capture, not the primary feature.

## Error handling

- Supabase unreachable / write fails → console warning only, no user-facing error, no impact on the on-screen result the user already sees.
- No person tracked / session produced no valid result → nothing written (mirrors existing "no crash, no false score" rule from the original design).

## Testing

- `buildHistoryRecord()` covered by `form-coach-logic.selfcheck.cjs` alongside the existing scoring tests — a few known-input cases for both posing and lift-form shapes.
- The Supabase write itself isn't unit-tested (network/browser API) — verified live in the Browser pane once built.

## Explicitly out of scope

- History list / trends view (Carl's call, this pass).
- Pruning/retention policy.
- Any change to `gym.html`'s own sync/state.
