# Post-Workout Autopsy — Design

## Context

Row's #2 ranked pick from the 2026-08-17/08-18 future-upgrades passes (`Claude Outputs/2026-08-17-full-4-system-improvement-pass.md`, sharpened by `2026-08-18-future-features-pass.md`'s Codex code-read): a 30-45s post-workout autopsy — intended vs. completed, why it changed, one-tap quality/readiness, optional note, one suggested change. This supersedes the earlier, vaguer "workout autopsy debrief upgrade" (08-12 batch, `docs/superpowers/specs/2026-08-13-workout-autopsy-debrief-design.md`).

**What already exists, found during brainstorming:** tapping "Mark Done" in `gym.html` today fires two separate things — a checkin modal (one-tap pain/recovery/pump ratings + a numeric steps field) and `fireDebrief()`, which sends an LLM chat message to Vision with a planned-vs-actual comparison per exercise and asks for exactly one suggested change back. Between them they already cover most of the spec's ground, just as two disconnected modals, and the "suggested change" depends on a live LLM round-trip — which can't reliably hit 30-45s and silently fails if Vision (dormant-by-default) is down.

## Approach

Merge the two flows into one modal, replace the LLM-generated suggested-change with a deterministic one computed from logic that already exists (`getRx()`, `volumeAdvisory()`), and drop the LLM call from the default path entirely.

### New merged modal (replaces both existing modals on Mark Done)

1. **Rx vs. actual, per exercise.** One-line badge: beat / met / missed. Computed the same way `GymDebriefLogic.formatRxComparison()` already does (comparing `getRx(ex, priorLogs)` against today's logged sets) — reused for a beat/met/missed classification instead of a formatted sentence for an LLM prompt. No LLM call.
2. **Pain / recovery / pump.** Unchanged — the existing `po-checkin-btn` one-tap rows, same behavior as today's checkin modal.
3. **Why it changed.** Only shown if any exercise came back "missed." Tap one of: low energy/fatigue, time crunch, pain/injury, life stress. Optional free-text note underneath. Skipped entirely when everything beat or met Rx — nothing to explain.
4. **One suggested change.** Deterministic. Across today's logged exercises, pick the single highest-priority flag from the existing `volumeAdvisory()`/`classifyMuscleVolume()` outputs, in this priority order: MRV pull-back > under-MEV add > phase-target add > stall-based add. Render that flag's existing `reason` sentence as-is — no new copy to write.
5. **Secondary action: "Ask Vision for deeper analysis."** The old `fireDebrief()` LLM call doesn't disappear — it becomes an optional button inside the same modal, for when Carl wants a fuller narrative. Not part of the default 30-45s path, so a dormant/down Vision doesn't block logging.

### Storage

Extends the existing `state.checkins[dateKey]` object — already synced wholesale as part of the `po-coach` `app_state` Supabase row — with four new fields:

```javascript
state.checkins[dateKey] = {
  pain, recovery, pump, steps,       // existing fields, unchanged
  rxSummary: 'beat' | 'met' | 'missed' | null,   // overall session classification
  deviationReason: 'fatigue' | 'time' | 'pain' | 'stress' | null,
  deviationNote: string | null,
  suggestedChange: string | null,    // the rendered volumeAdvisory/getRx reason, or null if nothing flagged
};
```

No new Supabase table, no schema migration — same merge-into-existing-day-entry semantics the checkin save handler already uses (only overwrite fields actually touched this time).

### What's explicitly out of scope

- No new decision-memory table entry for this — unlike the Weekly Coach Decision Loop, an autopsy isn't awaiting a future review/verdict, it's a closed record the moment it's logged. `decisions.js` stays untouched by this feature.
- No change to `getRx()`, `volumeAdvisory()`, or `classifyMuscleVolume()` — this only consumes their existing outputs.
- The old two-modal flow's exact UI is replaced, not kept as an alternate path (beyond the "Ask Vision" button folded into the new modal).

## Testing

Pure-function coverage for the new priority-ordering logic (picking the single suggested change across multiple flagged exercises) and the beat/met/missed classifier, following the existing `gym-debrief-logic.js` / `*.selfcheck.cjs` vm-sandbox test convention already used in this repo. DOM wiring (modal rendering, button taps) is exercised the same way the existing checkin modal is today — no new test infra.
