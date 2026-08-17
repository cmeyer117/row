# Weekly Coach Decision Loop — Design Spec

**Date:** 2026-08-17
**Status:** Approved, ready for implementation plan

## Context

An independent-first Codex consult on Row (see `Claude Outputs/2026-08-17-full-4-system-improvement-pass.md`) ranked a weekly decision loop as the #1 priority — Row already has more feature coverage than most solo fitness products need; the missing layer is a trustworthy closed loop: what happened → what decision changed because of it → did that decision work. This reframes the already-queued Eastman check-in packet idea from "a report" into Row's core decision record, and is the first real consumer of the shared `decisions` table shipped earlier this session (`docs/superpowers/specs/2026-08-17-shared-decision-memory-design.md`).

Two supporting facts discovered during brainstorming:
- Vision already computes a weekly deterministic signal narrative (exercise stalls, volume drift, bodyweight/strength divergence, reverse-diet pace, critique-score trend) via `coach-read.ts`, stored to `app_state['jarvis:coach_read']` on a Sunday cron trigger. Row has never surfaced this anywhere.
- That key is **not** in `app_state`'s anon-RLS allowlist (only `po-coach` is readable client-side; see `project-app-state-anon-rls-scope` — a standing rule against widening that policy for personal data). Reading it requires a server-side proxy, the same pattern `gym.html`'s existing Ask Coach feature already uses for `api/jarvis-chat.js`.

## Architecture

A new standalone page, `weekly-review.html`, linked from the hub tile grid (same pattern as `mobility.html`, `road-to-pro.html`, `coaching.html`) — this is a weekly ritual, not daily logging, and doesn't belong inside `gym.html`'s existing Log/Progress tabs.

A new Vercel serverless function, `api/coach-read.js`, mirrors `api/jarvis-chat.js`'s pattern: holds an owner-level Supabase token as a real env var, fetches `app_state['jarvis:coach_read']` server-side, returns the narrative JSON to the page. No RLS widening, no duplicated signal-computation logic — Row reuses Vision's already-correct math instead of reimplementing it.

Decisions are written and read via the `decisions.js` `recordDecision()` helper already shipped this session, plus new direct Supabase reads (anon key, same RLS policy) for querying open decisions.

## Data Flow

1. Page loads → fetch `/api/coach-read` (Vision's narrative + phase) in parallel with computing local volume-by-muscle from the already-loaded `po_coach_v1` gym state via `gym-volume-logic.js`'s `weeklySetsByMuscle()`.
2. Query `decisions` for the most recent row where `app = 'row' AND category = 'weekly-coach-loop' AND status = 'open'`.
3. **If one exists and is due** (`review_date <= today` or `review_date is null`): render only the close-out form. Shows the stored `decision_text`/`details` from when it was made, a `verdict` select (`worked` / `partly_worked` / `wrong` / `inconclusive`), and an `outcome_note` text field. Saving does `update decisions set verdict=..., outcome_note=..., status='reviewed', reviewed_at=now() where id=...`. The new-decision form stays locked (not rendered) until this save succeeds.
4. **Once there is no open, due decision blocking**: render the new-decision form. Vision's narrative shows read-only at the top (or a "signal narrative unavailable" note if the proxy call failed). Below it:
   - Per-muscle keep/add/reduce select, one row per `MUSCLE_BANDS` entry, pre-filled with a suggested action derived from current weekly sets vs. MEV/MAV/MRV thresholds (at-or-above MRV → suggest reduce; at-or-below MEV → suggest add; otherwise keep) — Carl can override any suggestion.
   - Free-text field: anchor-lift progress/hold/regress calls.
   - Free-text field: cardio/posing prescription for the week.
   - Checkbox + note: recovery/pain flag.
   - Free-text field: rationale.
5. Saving calls `recordDecision({ category: 'weekly-coach-loop', decision_text: <built summary>, rationale, review_date: today+7, details: { muscle_groups, anchor_lifts, cardio_rx, posing_rx, pain_flags } })` — matches the `details` shape already documented in the shared decision-memory spec for Row.

## Error Handling

If `/api/coach-read` fails (Vision down, network error, malformed response), the page still renders the new-decision form with a "signal narrative unavailable this week" note instead of blocking — matches `coach-read.ts`'s own "never hard-fail" philosophy for this exact data. The close-out gate depends only on the `decisions` table (same project Row already reads/writes for `app_state`), not on Vision's uptime, so a Vision outage never blocks the review-gate mechanic itself.

## Testing

The muscle-group suggestion logic (weekly sets + band thresholds → keep/add/reduce suggestion per muscle) is the one piece of real logic in this feature. It gets a small assert-based self-check script, `weekly-review-suggestions.selfcheck.cjs`, matching Row's existing `gym-volume-logic.selfcheck.cjs` convention (plain Node, `assert()` calls, no framework).

The rest — the proxy function, the review-gate flow, the form save paths — is I/O glue verified manually against the real dev flow: create a decision, reload the page and confirm it shows as blocking, close it out, confirm the new-decision form unlocks and a fresh row appears in `decisions` with the next `review_date`.

## Out of Scope

- No changes to `coach-read.ts` itself — this only adds a read path to an existing, working computation.
- No UI for browsing/searching past reviewed decisions (a simple history list is a natural future add, not needed for the loop to function).
- No changes to the Prep Readiness Control Panel or post-workout autopsy (Codex's #2 and #3 Row picks) — each gets its own brainstorm when picked up.
- No automated reminder/notification when a decision becomes due — Carl opens the page when he wants to do the weekly review, same as any other Row page.
