# Evening Checklist Additions — Design

**Date:** 2026-08-30
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

Carl asked to build out Row's evening routine, informed by real research on sleep hygiene and what successful people/elite athletes do before bed. Auditing before building (this session's recurring discipline — the 6th gap tonight to turn out already-resolved) found the premise false: Row already has two live, wired-up evening rituals — a 5-item `EVENING_ITEMS` checklist (`daily-routine-checklist-logic.js`, rendered inside Morning Launch's Evening Shutdown panel, `main.html`, gated to appear after 5pm) already covering dim lights, cool room, a casein snack, melatonin, and journaling — and a separate "Evening Shutdown" goal-review ritual (Win/Push/Miss verdict on the day's needle movers). No new feature is needed; the north-star note's "no Row-side equivalent to Morning Launch" claim was wrong.

Cross-referencing the existing 5 checklist items against real research (Exa search across sleep-science literature, sports-recovery research, and reporting on elite-athlete/executive evening routines, 2026-08-30) found the existing items are already well evidence-aligned — but two genuinely evidence-strong practices are missing.

## Research summary (informing this and future decisions — see also the vault note)

Ranked roughly by evidence strength, cross-referenced against what's already in `EVENING_ITEMS`:

- **Already covered:** dim lights before bed (melatonin protection), cool room temperature (65-68°F is the literature's converging range for the core-temperature drop that initiates deep sleep), pre-sleep casein protein (real RCT support for overnight muscle protein synthesis specifically — relevant to Carl as a bodybuilder), low-dose melatonin, journaling (matches both general sleep-onset-latency research and the recurring "successful people clear their mind before bed" pattern found across Business Insider/Fortune/Business Times reporting on CEO and athlete routines).
- **Missing, evidence-strong, added by this spec:** a screens/phone cutoff distinct from "dim lights" (blue light specifically suppresses melatonin independent of brightness — Haaland's and Josh Allen's routines both center on this, and a 2011 Journal of Clinical Endocrinology & Metabolism study found ~200 lux indoor lighting in the hour before bed suppressed melatonin onset by ~1.5 hours), and a training-cutoff-time item specific to Carl's context as a lifter (training within 2-3 hours of bed measurably delays sleep onset and compresses the deep-sleep GH pulse that drives ~70% of daily growth hormone release — directly relevant to hypertrophy/recovery, not just general wellness).
- **Deliberately not added as checklist items** (daytime habits, not nightly checkboxes — better suited to a different surface or just general awareness, not scope for this pass): caffeine cutoff (~2pm, 6-hour half-life), fixed wake-time consistency (the single strongest-evidence intervention in the literature, but a scheduling habit, not a nightly checkbox), alcohol avoidance (reduces deep sleep 20-40% even in moderate amounts).

## Approach

Add two entries to `EVENING_ITEMS` in `daily-routine-checklist-logic.js`, matching the exact shape of the 5 existing items:

```javascript
{ id: 'screens_off', label: 'Phone/screens away 60-90 min before bed', kind: 'checkbox' },
{ id: 'no_late_training', label: 'No training within 2-3 hrs of bed', kind: 'checkbox' },
```

No changes needed to `buildChecklistState()` — it already handles the generic `kind: 'checkbox'` case for any item in the array, and `mlAppendRoutineChecklist(wrap, 'evening')` (already wired into `main.html`'s Evening Shutdown panel) renders whatever `EVENING_ITEMS` contains. This is a pure data addition, not new logic.

## Files touched

- Modify: `daily-routine-checklist-logic.js` — add the two items to `EVENING_ITEMS`.

No other files change. `main.html`'s rendering, `rcSaveChecked()`'s persistence, and the sync layer (`syncedPrefixes: ['routine_checklist:']`, already configured) all work unchanged for any item added to the array — confirmed by reading the existing generic rendering/persistence code, not assumed.

## Out of scope (this pass)

- Caffeine cutoff, fixed wake-time, alcohol-avoidance items — daytime habits, not evening checkboxes; a future session could scope a "daytime habits" surface if Carl wants them tracked somewhere.
- Any change to the "Evening Shutdown" goal-review ritual (Win/Push/Miss) — already complete and working, not touched here.
- Supplementation specifics (magnesium glycinate, ashwagandha) — real evidence exists per the research, but adding specific supplement recommendations as app content is a different kind of decision (health-adjacent, individual-variance-dependent) than a lifestyle-habit checkbox; flagged in the vault note for Carl's own consideration, not built into the app.

## Testing

`daily-routine-checklist-logic.selfcheck.cjs` exists and must be updated, not just re-run: it hardcodes `assertEqual(eveningState.length, 5, 'evening item list has 5 items')` (line 65), which the addition of 2 new items breaks by design — update the expected count to 7 and its label to match. No other existing assertion depends on the exact item count or set (the morning-item assertions, and the evening `melatonin`/`journal` assertions, all reference items by `id`, unaffected by two new unrelated items appended to the array). Add 1-2 new assertions for the new items' basic checkbox behavior (default unchecked, reflects a saved `true`), matching the existing pattern used for `cold_or_exercise`/`sunlight`.

Manual check: confirm the new items appear in the live Evening Shutdown panel (`main.html`, visible after 5pm local time per `mlEveningDue()`) and persist correctly (check, reload, still checked) — same verification posture as the existing checklist items, no new mechanism to verify.
