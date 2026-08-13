# Workout Autopsy Debrief Upgrade — Design

## Problem

`fireDebrief()` (`gym.html`'s post-workout "Mark Done" flow) sends Jarvis a generic message: today's raw logged sets and "give me a 3-4 sentence debrief." It has no idea what was actually *prescribed* going into the session, so it can't say whether today beat, met, or missed the plan — and nothing constrains the reply to a single, actionable next step.

The planned side already exists and is now trustworthy: `getRx(ex, priorLogs)` computes a real per-exercise prescription (add weight / hold+add a rep / deload), just audited and fixed (2026-08-13, Codex+Grok). Recovery context (`sleep`, `macroAdherence`, `recomp`) already reaches the gym agent via its existing `get_gym_summary` tool and system-prompt instruction. Neither is currently pulled into the debrief request itself.

## Approach

Client-side enrichment in `fireDebrief()`, no backend changes:

1. **Planned-vs-performed per exercise.** For each exercise logged today, compute `getRx(ex, priorLogs)` where `priorLogs` excludes today's own sets (so it reflects what was actually prescribed *going into* today, not a same-day echo). Format as a comparison line: `"Bench: Rx was 185lb×8 (Add weight). Actual: 185lb×8, 185lb×7, 185lb×6."` First-ever session for an exercise (no prior logs, `getRx` returns `null`) just shows the performed sets with no comparison — matches today's existing behavior for that case.

2. **Explicit recovery-weighing + one-variable-change instruction**, appended to the message: tell the model to check its own gym-summary data (sleep, macro adherence) before diagnosing, and to end with exactly *one* specific variable to change next session — training (volume/weight/rest) or recovery (sleep/nutrition) — not a list, not a vague "push harder."

No change to Jarvis/Vision backend — this is purely a richer client-constructed message, same `/api/jarvis-chat` call.

## New code

`formatRxComparison(rx, setsStr, unit)` — small pure function, handles the `rx` present/null and bodyweight/weighted branches. Extracted (not left inline) so it's independently testable, same pattern as today's `gym-rx-deload-logic.js` split. The exercise loop, prior-log filtering, and message assembly stay inline in `fireDebrief()` since they need `state`/DOM, matching how the rest of that function already works.

## Testing

`gym-debrief-logic.selfcheck.cjs` (vm-sandbox convention, mirrors `gym-rx-deload-logic.selfcheck.cjs`) covers `formatRxComparison`'s branches: weighted rx present, bodyweight rx present, no rx (first session).

## Out of scope

Volume-progression-aware debriefs, phase-specific coaching — both queued separately, not part of this change.
