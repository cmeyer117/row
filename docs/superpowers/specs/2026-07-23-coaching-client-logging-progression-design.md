# Coaching Client Logging & Progression — Design

**Date:** 2026-07-23
**Status:** Approved by Carl, ready for implementation planning

## Problem

The Coaching Dashboard (`coaching.html` / `coaching-plan.html` / `coaching-templates.js`) is a one-shot document generator: a coach fills in intake, gets a static template back, prints/exports it as a PDF, and that's the entire client relationship digitally. Training exercises are plain name strings with no rep-range/weight-increment metadata. Diet guidance is prose formulas ("Protein: 0.8-1g per lb bodyweight") with no computed numbers. Neither side ever adjusts after the plan is issued — Row's own app has real progressive-overload logic (`getRx()`) and a real macro calculator (`macro-calc.js`'s `calculateMacros()`), both proven and tested, but neither is connected to the coaching product at all.

Carl has zero coaching clients today. This design deliberately does not build a scalable multi-tenant SaaS product — it builds the smallest real version that works for a first handful of clients, reusing proven Row logic rather than reinventing it, and explicitly defers everything that only matters at real client volume.

## Goals

- A client can log training sets against their assigned plan and see it drive real next-session progression, the same way Carl's own `gym.html` does.
- A client's diet target is a real computed number, not a formula written in English — and gets a trend-based adjustment suggestion instead of never changing.
- No new infrastructure category (auth system, mobile app, food-logging app) gets built speculatively for a client count of zero.

## Non-goals (explicitly deferred, not forgotten)

- Client accounts / Supabase Auth / password reset flows.
- A client mobile app or PWA polish.
- Full food/meal logging, barcode scanning, or a daily macro budget UI for clients (that's the entire surface of `macros.html` — a real second project, not this one).
- Photo progress tracking, mobility content, or posing content for clients.
- Injury-aware auto-adjustment beyond what the existing intake `injuryFlags` already trigger (`needsReview`).
- Multi-day auto-detection or any scheduling logic — the client picks which day they're doing.

## Access model

No passcode, no auth. A client reaches their pages via their `coaching_clients.id` in the URL query string — same trust level as the existing "Issued" plan link (`coaching-plan.html?id=...`). This matches Row/Vessel's standing rule not to prematurely build multi-tenant security infrastructure before productization is imminent (see `project-productization-plan.md`).

## Data model

**New table `coaching_client_logs`** (same shared Supabase project, `vikpcejlyxieguorwysf.supabase.co`, anon publishable key — same pattern every other table in this project already uses):

```sql
create table coaching_client_logs (
  id bigint generated always as identity primary key,
  client_id uuid not null references coaching_clients(id),
  exercise_name text not null,
  weight numeric not null,
  reps integer not null,
  is_bodyweight boolean not null default false,
  created_at timestamptz not null default now()
);
```

**New table `coaching_client_weights`** (weekly bodyweight, separate from training logs — different cadence, different consumer):

```sql
create table coaching_client_weights (
  id bigint generated always as identity primary key,
  client_id uuid not null references coaching_clients(id),
  weight numeric not null,
  logged_at date not null default current_date
);
```

**`coaching_clients` table gains 4 columns** (nullable, existing rows unaffected): `sex text`, `age integer`, `height_in numeric`, `weight_lb numeric` — the inputs `calculateMacros()` needs. `weight_lb` here is the *intake* weight (one-time, used for the initial target); `coaching_client_weights` tracks the ongoing trend separately.

## Component 1: `coaching-exercise-meta.js`

Pure lookup module, same dual-export style as `gym-workout-events.js` and `macro-calc.js`. Maps exercise name → `{repMin, repMax, step, bw}`.

- Populated from `gym.html`'s existing exercise definitions for every name that matches (most coaching-template exercises already overlap with Carl's own tracked list — Hack Squat, Leg Extension, Lying Hamstrings Curl, Standing Calf Raise, etc.).
- One default fallback for names with no match: `{repMin: 8, repMax: 12, step: 5, bw: false}` — reasonable for a generic machine/dumbbell accessory movement, correctable by hand later if visibly wrong for a specific lift.
- Exposed as `window.CoachingExerciseMeta.getMeta(exerciseName)`.

## Component 2: `coaching-log.html` (new client-facing page)

Accessed as `coaching-log.html?id=<client.id>`.

1. Load the client row, call `CoachingTemplates.assemblePlan(intake)` — same call `coaching-plan.html` already makes — to get `plan.training.days`.
2. Day selector: a simple list of the plan's day names (e.g. "Push", "Pull", "Legs A"). Client picks one.
3. For each exercise in the selected day: a weight input, a reps input, a Log button. On submit, insert into `coaching_client_logs`.
4. A separate small section: "This week's weight" — one number input. Before writing, query `coaching_client_weights` for this `client_id` where `logged_at >=` the most recent Monday (calendar week, computed client-side); if a row exists in that range, `update` its `weight`/`logged_at`, else `insert` — re-logging the same week overwrites rather than duplicates. No DB-level unique constraint needed for this; write volume is at most one row per client per week.
5. No feedback/scores shown on this page itself — it's a log, not a dashboard. Progression feedback lives on the coach's page (below), matching the print-facing "coach reviews, coach decides" posture the rest of this product already has.

## Component 3: `coaching-plan.html` extended (coach-facing)

- **Training section, per exercise:** fetch that client's logs for the exercise (`coaching_client_logs` filtered by `client_id` + `exercise_name`, ordered by `created_at`), look up its meta via `CoachingExerciseMeta.getMeta()`, and call `getRx(ex, logs)` — the exact function copied from `gym.html`, not reimplemented. Show the result the same way Row's own Progress tab does (e.g. "NEXT: 145lb × 8, add weight"). No logs yet → show nothing extra, current behavior unchanged.
- **Diet section:** replace the static prose (`stage.diet.summary/approach/foodGuidance`) with a real call to `MacroCalc.calculateMacros({sex, age, heightIn: height_in, weightLb: latest known weight, activityLevel, goal})`. `activityLevel` derived from `training_days_per_week` (a simple fixed mapping: 1-2 days → 2 "lightly active", 3-4 days → 3 "moderately active", 5+ days → 4 "very active" — matches the multiplier table already in `calculateMacros`). "Latest known weight" = most recent `coaching_client_weights` row if one exists, else the intake `weight_lb`.
- **Weight trend → calorie suggestion:** a new small pure function, `suggestCalorieAdjustment(goal, weightLogs)` (2+ `coaching_client_weights` rows required, else returns `null`): compares the direction of the trend against the goal (cut expects downward, bulk expects upward, recomp/contest-prep expect roughly flat). If the trend contradicts the goal over the available window, suggest ±10% calories, matching the exact adjustment language already written into the advanced-stage advice text. Shown as a one-line note under the Diet card, not an automatic change — coach still decides.
- If a client hasn't filled in sex/age/height/weight (older clients created before this ships, or a coach who skips those fields), the Diet card falls back to today's static prose rather than crashing on missing inputs — same defensive posture as the rest of this file's existing null/undefined guards.

## Testing

Both new pure modules (`coaching-exercise-meta.js`, the `suggestCalorieAdjustment` function) get a `.selfcheck.js` file matching the existing convention in this repo (`gym-workout-events.selfcheck.js`, `coaching-templates.selfcheck.js`, `macro-calc.selfcheck.js`) — plain `node` assertions, no test runner needed. `getRx()` and `calculateMacros()` are already tested where they live; this design only adds a thin call site for each, not new logic to those two functions.

## Migration

Both new tables and the 4 new `coaching_clients` columns are additive — no existing data changes shape. Apply via the same manual-SQL-in-Supabase pattern the original `workout_events` table used (this repo has no migration tooling).
