# Row — Bonus Workout Templates

**Date:** 2026-08-17
**Status:** Approved by Carl (brainstorm). Pending written-spec review.

## Context

Carl regularly does extra sessions his coach's plan doesn't include — usually "Shoulders & Arms" or "Chest & Back" when he has extra time. Today there's no real way to do this well:

- "Tagging" a session is a native `prompt()` dialog (gym.html's `sessionTagBtn` handler) — a free-text label with no history, no autocomplete, and no connection to what gets logged.
- Adding an off-plan exercise means picking one of the coach's *existing* plan-day tabs as an arbitrary bucket (there's no real slot for a day that isn't on the plan), then adding each exercise one at a time via `saveAdhocExercise()` — typing the name from scratch into a blank text box, every single time, with generic defaults (8-12 reps, 2 sets, 2.5 step) regardless of the exercise.

Since this happens "somewhat regularly" with a similar exercise lineup each time, recreating it from scratch every session is the actual pain point — not the concept of logging an off-plan exercise.

## What this build is

**Reusable named templates**, built once from Carl's real exercise catalog and reused every time he does that bonus session.

1. **New state: `state.bonusTemplates`** — array of `{ id, name, exerciseNames: string[] }`. Templates reference exercises **by name** into the existing `state.exercises` catalog, not duplicated exercise objects. This is the key design choice: because a bonus-day exercise *is* the same exercise object a plan day would use, history, PR tracking, and `getRx()` progression suggestions work identically with zero new logging code — the existing exercise-selection → log-form → history pipeline doesn't know or care that today's "day" is a bonus template instead of a plan day.

2. **Seed data: 4 empty-but-named templates** — Shoulders & Arms, Chest & Back, Push, Pull. Deliberately shipped with `exerciseNames: []`, not pre-filled. `CONFIG.defaultExercises` (gym.html's static seed block) is explicitly stale first-run data per its own comment — Carl's real catalog lives in synced state and has likely diverged since. Guessing wrong here costs Carl a fix-my-picks session instead of a pick-my-own session. First real use of each template is a one-time few-minutes setup (add exercises via the picker below); after that it's fully reusable.

3. **UI: a "Bonus" toggle next to the existing day-selector (`daySeg`)**, not a new page. Tapping it swaps the day-selector row from the coach's plan days to the 4 (or however many) bonus templates. Selecting a bonus template sets `state.filterDay` to the template's id, same mechanism a plan day uses today — everything downstream (`renderWorkoutList`, `getCurrentEx`, the log form, `getRx()`, history) needs no new branching for *logging*, only for *which exercise list feeds the workout list* (see Task-level detail in the plan, not guessed here).

4. **"Manage Bonus Workouts" view** — list of templates (name + exercise count) with add/rename/delete. Editing a template opens a search/filter over `state.exercises` (deduped by name across gyms, filterable by the `muscle` field exercises already carry — e.g. tap "Shoulders" to narrow the list) with a checkbox per exercise to include/exclude. This is the actual fix for "adding exercises is a pain" — pick from a filtered list instead of typing a name from scratch, and it only has to happen once per template, not once per session.

5. **Bonus sessions are visible but excluded from plan compliance.** They still appear in the existing "Past workouts" history list (small "Bonus" badge to distinguish them), so Carl can see he did the session — but they're excluded from anything that treats "did you train today" as plan compliance: streak/`doneDays` semantics if those feed compliance logic, phase/volume advisories scoped to `state.days`, and the upcoming decision-to-execution scoreboard (`docs/superpowers/specs/2026-08-17-weekly-coach-decision-loop-design.md`). **Needs verification at plan time, not assumed here:** trace every place in gym.html that currently assumes a logged date maps to one of `state.days`/`CONFIG.days`, and confirm each one either already naturally excludes a bonus-template `filterDay` value (because it isn't in that list) or needs an explicit guard. Do not assume the exclusion is free just because bonus template ids won't literally match `state.days` ids — some logic may iterate all logged dates without checking which day they were tagged under.

## Explicitly out of scope

- Bonus days do NOT become real `state.days`/`CONFIG.days` entries — Carl explicitly wants the plan's day-selector to stay clean, bonus templates are a separate row/section.
- No pre-filled exercise lists in the 4 seed templates — see reasoning above. Carl fills them in himself, once, per template.
- No changes to the existing per-exercise logging UI, `getRx()` progression logic, or history rendering — bonus-day exercises flow through all of this completely unchanged, because they're real catalog exercises.
- No retiring of the existing free-text session tag (`sessionTagBtn`/`prompt()`) — it's a separate, lower-stakes cosmetic label and out of scope for this build. (Could be revisited later if it turns out redundant once bonus templates exist, but not assumed here.)
- Push/Pull templates are NOT auto-populated from `coaching-templates.js`'s advanced-tier Push/Pull lists — that file is Carl's *client-facing coaching-app content*, a different product surface with its own exercise-name vocabulary that may not match Row's own catalog 1:1. Referenced only as inspiration for which two extra templates to offer, not as a data source to copy from.

## Testing

Template CRUD (`state.bonusTemplates` add/rename/delete/exercise add-remove) is pure state manipulation and gets real unit tests, same pattern as `captureObjectName`/`formatCaptureAge`-style pure-logic tests elsewhere in this codebase. The "Bonus" toggle swapping `daySeg`'s rendered content and `state.filterDay` routing to a template's exercise list instead of a plan day's is inline gym.html UI wiring — verified live in-browser, same split as every other gym.html feature (pure logic tested, DOM/browser behavior verified live), especially given this session's own lesson: two real bugs in a row today were only findable via an actual browser console, not static reading. The compliance-exclusion point (item 5) gets whatever the plan-time trace determines is the right guard, plus a regression test proving a bonus-day log does NOT get counted wherever plan compliance is computed.

## Open question for the plan

Exactly which existing gym.html functions/state need the bonus-day exclusion guard from item 5 — this requires reading the actual current compliance/decision-tracking code (some of which may still be in flux given the decision-to-execution scoreboard work is queued right after this), not assumed here.
