# Row Wrapped — Design

**Date:** 2026-08-07
**Status:** Approved (format/streak/window picked by Carl across two rounds — visual companion for format, terminal for streak/window)
**Owner:** Row (`C:\Users\gregm\row`)

## Goal

Row Upgrades ranking #6. A quarterly shareable recap card — PRs, training volume, longest streak, bodyweight arc — matching the size and shape Carl already posts to IG Story, feeding the content machine directly.

## Ground truth (verified in-session, 2026-08-07)

- Row already does raw Canvas 2D work with zero libraries: `gym-weight-photos.js` downscales progress photos and captures camera frames via `canvas.getContext('2d').drawImage(...)` + `canvas.toDataURL(...)`.
- `gym.html`'s Progress tab already renders trend lines as SVG via `buildSparkPath(vals, W, H)` (`gym.html:4261`) — pure function, `vals` in, an SVG path `d` string out.
- `estimate1RM(w, r)` (`gym.html:3409`) is already exposed on `window` and used for PR/e1RM display elsewhere.
- No streak computation exists anywhere in Row today. `gym.html`'s `#wtStreak`/`#wtStreakNum` markup is dead — present in the DOM (`hidden` class) but never wired to any JS.
- `gym-volume-logic.js`'s `weeklyVolumeByDay` is trailing-N-weeks-bucketed, not calendar-quarter-windowed — not directly reusable for a quarter total; a fresh small sum is simpler than adapting it.
- Bodyweight data source: `po_coach_weights` (`WeightEntry[]`, `{dateKey, weight}`), already read elsewhere in `gym.html`.

## Approach

**Render pipeline:** Build the card as an SVG string (fixed IG Story canvas: 1080×1920), draw it into an offscreen `<canvas>` via `new Image()` loaded from an SVG data URL, then `canvas.toDataURL('image/png')` for a downloadable/shareable PNG. No new dependencies (rules out Satori/html-to-image — Row already has everything this needs).

**Window:** Current calendar quarter (Jan-Mar/Apr-Jun/Jul-Sep/Oct-Dec), computed "so far" — a card generated mid-quarter reflects partial data honestly, never blocked pending quarter-end.

## Data Model

New pure module `row-wrapped-logic.js`:

```javascript
// quarterBounds(now) -> { start: Date, end: Date, label: 'Q3 2026' }
// Calendar-quarter start/end for `now`'s quarter. `end` is `now` itself
// (quarter "so far"), not the calendar quarter's actual last day.

// quarterPRs(exercises, logs, bounds) -> [{ exerciseId, name, e1rm, priorBest }]
// Per exercise: the quarter-window's best estimate1RM(weight, reps) log,
// included only if it beats every log dated before bounds.start. bw
// exercises compared by reps, not e1RM (best reps in-window > best reps
// before). Empty array, not null, when nothing qualifies.

// quarterVolume(logs, bounds) -> number
// Sum of weight*reps across all logs (all exercises) with date in
// [bounds.start, bounds.end]. 0 is a real, valid answer.

// longestStreak(logs, bounds) -> number
// Union of all distinct training-day date-keys (any exercise logged that
// day) within the window; longest run of consecutive calendar days. 0
// when there are zero training days in the window (not 1 — an empty
// window has no streak, don't off-by-one it).

// quarterBodyweightSeries(weights, bounds) -> WeightEntry[]
// po_coach_weights filtered and sorted to the window. Empty array when
// no weigh-ins fall inside it.
```

`row-wrapped-logic.selfcheck.cjs` covers: quarter-boundary math (including the Dec→Jan and leap-year edges), a PR that only barely beats prior best, a PR that doesn't beat prior best (excluded), bw-exercise PR comparison, zero-volume window, a broken streak (gap resets the run), a streak spanning the exact window boundary, and empty bodyweight series.

## Behavior

**Entry point:** New "Wrapped" button on `index.html`'s hub (alongside the existing tile grid — following the codebase's own `.tile`/`ops-chip` visual language, not a new pattern) opening a new `row-wrapped.html` page. On load: compute the 4 stats via `row-wrapped-logic.js` against `state.exercises`/`state.logs`/`po_coach_weights` (same localStorage reads `gym.html` already uses), build the SVG, render the rasterized PNG preview, offer a native "Save Image" (`<a download>` on the data URL — matches how `gym-weight-photos.js` already offers photo export, no new pattern).

**Card layout (SVG):** Header (`"Q3 2026"` + Carl's name), 4 stat tiles (New PRs count + top 1-2 named, Volume total formatted `123,456 lbs`, Longest Streak `N days`), bodyweight arc as a `buildSparkPath()`-driven `<path>` with start/end weight labels — omitted entirely (not rendered as an empty chart) when the window has fewer than 2 weigh-ins.

**Thin/zero data:** Each tile degrades independently, never blocks generation:
- 0 PRs → tile reads "Building the base this quarter" instead of a number-and-name.
- 0 volume (brand-new user, empty window) → tile still renders `0 lbs`, honest not hidden.
- 0-day streak → tile reads "Log your first day" instead of "0 days" (0 days literally displayed reads as a failure state, not an invitation).
- <2 weigh-ins → the bodyweight arc row is omitted from the card layout entirely (not a broken/empty chart).

## Error handling

- All reads are local (localStorage) — no network calls, no failure mode beyond "no data yet," which is the thin-data path above, not an error.
- SVG→canvas conversion failure (should not happen for well-formed SVG, but `Image.onerror` is real) → falls back to a text-only summary view with a note that the shareable image couldn't render, never a blank/broken page.

## Non-goals

- No historical-quarter picker in v1 — current quarter only.
- No auto-posting to Metricool/Instagram — this produces a downloadable image, posting stays a manual step like every other content asset today.
- No new "streak" concept bleeding into other Row surfaces (Goals' `goal_streak_v1` stays separate and unrelated — this is a training-day streak, a different domain).
- No server-side rendering, no new dependency, no build step.

## Verification

- `row-wrapped-logic.selfcheck.cjs`: all cases listed under Data Model above.
- Browser: generate a card against real seeded-range data (a PR that qualifies, one that doesn't, a broken streak, a clean streak, a populated bodyweight arc) — confirm the rendered SVG/PNG matches expected values; generate again against an empty/fresh account — confirm all 4 degraded-state messages render, nothing crashes; confirm the download link produces a real PNG; confirm no horizontal overflow at 375px on the generating page (the card image itself is a fixed IG Story aspect, expected to scroll/scale within its own container, not the page).
