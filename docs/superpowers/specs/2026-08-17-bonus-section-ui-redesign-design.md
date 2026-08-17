# Row — Bonus Section UI Redesign

**Date:** 2026-08-17
**Status:** Approved by Carl (brainstorm). Pending written-spec review.

## Context

Bonus Workout Templates shipped in `row@d3c6075..38f6f28` (spec: `2026-08-17-bonus-workout-templates-design.md`). One live layout bug was already caught and fixed (`#bonusModeToggle` inheriting `.po-seg-btn`'s `flex:1` and squeezing the day-pill row — `38f6f28`). Carl reports the overall layout still "looks weird" after that fix and asked for a real design pass, not another bug patch.

## Root cause (verified live, not just read from CSS)

`#daySeg` is a `flex:1` equal-width pill row (`.po-seg-control` / `.po-seg-btn`). At the app's actual mobile width (375px) it holds, in Bonus mode, 4 template pills + a `⚙ Manage` pill — 5 items sharing ~202px. Measured via computed `getBoundingClientRect()`/`scrollWidth` in a live browser:

| Pill | Available width | Needed width | Overflowing |
|---|---|---|---|
| "Shoulders & Arms" | 37px | 116px | yes — clipped to ~1 char |
| "Chest & Back" | 37px | 89px | yes |
| "Push" | 37px | 41px | yes |
| "Pull" | 37px | 37px | no |
| "⚙ Manage" | 37px | 72px | yes |

This is genuine clipping, not aesthetic clutter. For comparison, Day mode with Carl's real 5-day split ("Push"/"Pull"/"Legs A"/"Upper"/"Legs B") only overflows by 1-13px per pill — the existing mobile-breakpoint CSS (`min-width:0; overflow:hidden; text-overflow:ellipsis`, line ~1108) already handles that gracefully by design ("let labels truncate instead of pushing wider"). That truncate-by-design pattern is correct for short, Carl-authored, position-memorable day names. It breaks down for bonus templates because template names are arbitrary-length, user-typed at template-creation time (`prompt('New bonus workout name...')`), and the list can grow past 4 — the failure mode gets worse over time, not better.

## Design

1. **Bonus template pills move out of `.po-seg-control`'s equal-flex layout into their own horizontally-scrollable chip strip.** New class (e.g. `.po-bonus-chip-row`): `display:flex; overflow-x:auto; gap:6px` with chips at natural (`flex:0 0 auto`) width — no squeeze, no ellipsis-to-nothing. Standard native mobile pattern for filter-chip rows with unbounded item count/length. Applies only when `state.viewMode === 'bonus'`; Day mode's `#daySeg` rendering and CSS are untouched.

2. **`⚙ Manage` stops being a pill inside the template list.** It becomes a fixed icon-only button reusing the existing `.po-icon-btn` treatment (same visual language as the header Settings gear) placed as a sibling at the end of the row, outside the scrollable strip — always visible, never scrolled out of reach, and no longer visually indistinguishable from a template-selection pill.

3. **Visual separation from Day mode**: the chip-strip container gets a subtle accent (left border or background tint, in the app's existing accent green) while in Bonus mode, so the row reads as "you're in a different mode" rather than "more day pills got added."

4. **Session-tag `prompt()` (`sessionTagBtn`) is untouched.** It's a single free-text quick input, works correctly today, and a modal replacement would be more code for no behavior change Carl asked for. Confirmed explicitly in scope discussion — not revisited here.

## Explicitly out of scope

- No change to Day-mode `#daySeg` rendering/CSS — its truncate-by-design behavior is correct for its actual data shape (short, few, fixed day names).
- No change to `sessionTagBtn` / the native `prompt()` flow.
- No change to the Manage Bonus Workouts modal's internal layout (template list, exercise picker) — only the entry-point affordance from the filter row.
- No broader gym.html redesign — this pass is scoped to the Bonus/Day filter row per Carl's explicit instruction to stay focused there, not sweep the whole page.

## Testing

Pure CSS + a small `renderFilters()`/bonus-pill-wiring change in gym.html (moving the Manage button out of the `daySeg.innerHTML` template-pill join, adding the chip-row class). No new state or logic — nothing here is unit-testable in isolation; verified live in-browser (computed layout: no `scrollWidth > width` overflow on any bonus chip at 375px, Manage button reachable and visually distinct, Day mode pixel-identical to before this change).
