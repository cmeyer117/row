# Recomp Signal — Design

## Problem
Carl is on a recomp (not a cut) — bodyweight alone is a misleading solo signal, since flat/rising weight can still mean fat loss if muscle is being added at the same time. Waist trend read alongside weight tells the real story. Item (3) from the 2026-08-06 Row feature ideation batch.

## Data sources
Both already exist, both already reach every Row page's `localStorage` via the existing `sync.js` cloud sync — no new Supabase table, no cross-app fetch:
- **Weight**: `po_coach_weights` (gym.html's key, `po-coach` app_state row) — `[{dateKey: 'YYYY-MM-DD', weight: number}]`.
- **Waist**: `health:measurements` (health.html's key, `health` app_state row) — `[{date: 'YYYY-MM-DD', waist: number|null, chest, arms, thighs}]`.

Field names differ (`dateKey` vs `date`) — each caller normalizes to a common `{date, value}` shape before calling the shared logic module.

## Logic module
New `recomp-signal-logic.js`, same convention as `row-wrapped-logic.js`/`mobility-pain-library.js`: IIFE, pure functions, no DOM/Supabase, dual-exported (`window.RecompSignalLogic` + `module.exports`).

### `computeRecompDelta(weightSeries, waistSeries, windowDays, now)`
- `weightSeries`/`waistSeries`: `[{date: 'YYYY-MM-DD', value: number}]`, already normalized by the caller.
- Filters each series to `date >= now - windowDays`.
- Requires **2+ points in each series within the window** to compute a delta. If either is short, returns an insufficient-data result naming which one's missing (e.g. "not enough waist measurements in the last 30 days") — never a fabricated number from a single point.
- Delta = last point's value − first point's value (chronological), for each series independently.
- Classifies the pair against flat-thresholds — **weight flat: |delta| < 1.0 lb, waist flat: |delta| < 0.25 in** (small enough to catch real trend, large enough to ignore single-weigh-in noise) — into one of:
  | Weight | Waist | Label |
  |---|---|---|
  | flat or up | down | **Good recomp signal** — leaning out while holding/gaining size |
  | down | down | **Cutting** — both trending down together |
  | up | up | **Bulking — watch waist pace** — both trending up, keep an eye on the ratio |
  | down | up | **Worth watching** — waist up while weight is down |
  | flat | flat | **Holding steady** — no meaningful change in either |
- Returns `{ ok: true, weightDelta, waistDelta, label, detail }` or `{ ok: false, reason }`.

### `buildRecompChart(weightSeries, waistSeries, w, h)`
- All-time range (both full series, not window-limited) — matches the other Health Markers charts (Vitals/Labs/Measurements/Sleep), which are all-time trends, not 30-day.
- Two polylines, each independently normalized to its own min/max (weight ~200s lbs and waist ~30s in aren't comparable on a shared scale) — same normalize-to-viewBox approach as `buildMiniSpark` in health.html, extended to two series plus a small colored legend ("Weight" / "Waist").
- X-axis spans the earlier-to-later date across both series combined; a series with fewer points still plots correctly since each point's x-position comes from its own date, not from a shared index.
- Returns an SVG string, same shape as `buildMiniSpark`'s return.
- If a series has fewer than 2 points, that line is simply omitted (single dot or nothing) rather than erroring — the other line still renders.

## Surfaces

### Health Markers (`health.html`) — new 5th tab
- Tab list `['vitals', 'labs', 'measurements', 'sleep']` → `['vitals', 'labs', 'measurements', 'sleep', 'recomp']`, new button `<button class="hm-tab-btn" data-hm-tab="recomp">Recomp</button>`.
- New `#hmView-recomp` panel: the two-line chart (`buildRecompChart`) on top, the editorial delta line underneath (`computeRecompDelta` over the 30-day window, reusing `renderMeasurements`'s existing `getMeasurements()` plus a new inline read of `po_coach_weights` from `localStorage`).
- No new inputs — this tab is read-only, logging still happens on the existing Measurements tab (waist) and gym.html (weight).
- Wired into `rerenderAll` and the existing `hmSwitchTab` show/hide logic, same as the other 4 tabs.

### State of Me (`state-of-me.html`) — new card
- New `renderRecomp()`, same shape as the existing `renderWeight()`/`renderSleep()` — synchronous, no Supabase, reads `po_coach_weights` (already loaded via `loadWeights()`) and `health:measurements` directly from `localStorage`.
- Card label "Recomp Signal (30 days)", value = the editorial label, subtext = the two deltas spelled out (e.g. "Weight +0.8 lbs · Waist −0.6 in").
- Insufficient-data case renders the existing degraded pattern this page already uses elsewhere (e.g. `renderWeight()`'s "No weigh-ins logged yet" / "Not enough data...") — never a blank or fabricated card.
- Inserted into the existing sync card sequence (`renderVolume() + renderWeight() + renderRecomp() + renderSleep() + ...`) — no new async work, so it doesn't touch the existing `Promise.all` for the two Supabase-backed cards.

## Testing
`recomp-signal-logic.selfcheck.cjs` (Node, `vm` sandbox load, assert-based — same convention as `row-wrapped-logic.selfcheck.cjs`), covering:
- All 5 editorial classifications (good recomp / cutting / bulking-watch / worth-watching / holding-steady).
- Insufficient data: empty weight, empty waist, only 1 point in one series.
- `buildRecompChart` with both series present, one series short, one series empty — confirms it returns a non-throwing SVG string in each case.

Manual browser verification: both surfaces against real production data (Carl's actual weight/waist history), plus a seeded edge case (temporarily short waist history) to confirm the degraded-state text actually renders instead of just being reachable in theory.

## Out of scope
- Any new logging UI — weight and waist are logged exactly where they are today (gym.html weight tracker, Health Markers' Measurements tab).
- A history/trend of the recomp *label* itself over time — only the current 30-day snapshot.
- Cross-referencing macro adherence or training volume into the signal (State of Me already has those as separate cards; combining them into one verdict is a bigger, separate design question).
- Any change to `po_coach_weights` or `health:measurements`'s existing shape.
