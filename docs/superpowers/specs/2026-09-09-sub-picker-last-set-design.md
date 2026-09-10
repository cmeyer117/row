# Substitution picker: per-variant last set — design

**Date:** 2026-09-09
**Status:** approved by Carl, built same session
**Origin:** "Exercise substitution map" (2026-08-26 four-model batch, Codex #6). Audited 2026-09-09: already ~80% shipped — curated star-rated `subs` on 37 exercises, the Alt picker, per-variant log tagging (`getLogs()` filters by variant so prescriptions never average equipment), and the joint-aware ⚠ nudge (`9d23259`, 2026-08-29). "Equipment occupied" stays cut: no data source, and the Alt tap already is the occupancy input.

## The gap

The picker shows the coach's stars but nothing about Carl. Swapping on the gym floor, the question is "what weight do I start at on the cable version?" — the per-variant logs already hold the answer, the modal just doesn't show it.

## Design

**Data.** `state.logs[exId]` — every set as `{weight, reps, date: 'YYYY-MM-DD', variant}`. Primary exercise is variant `null`; legacy untagged logs are also `null` (same rule as `getLogs()`). Each sub is its name. No new capture, no schema change.

**Logic.** `sub-history-logic.js`, dual export like every other `*-logic.js`:

```
lastSetPerVariant(logs, variants, todayKey) -> { [variantKey]: { weight, reps, date, daysAgo } | null }
```

For each variant: the most recent `date` with a log for that variant; on that date, the top set by weight (ties → more reps). `daysAgo` from the `YYYY-MM-DD` keys via UTC-noon anchors, so DST can't produce 0.96 days. Primary is keyed `''` (object keys can't be `null`).

**UI.** `buildSubOption` gains one muted line under the name: `Last: 185 × 8 · 12d ago` (`today` / `yesterday` for 0/1) or `Never used`. Stars unchanged. One CSS rule, `.sub-option-last`.

**Test.** `sub-history-logic.test.js` (vm sandbox, same as `form-coach-history.test.js`): never used; single variant; two variants on the same day; top-set pick when a day has several sets (weight, then reps on tie); legacy untagged log counts as primary; daysAgo 0/1/12.

**Not doing.** No sorting by recency, no auto-selecting last-used sub, no changes to `getLogs()` or the prescription path.
