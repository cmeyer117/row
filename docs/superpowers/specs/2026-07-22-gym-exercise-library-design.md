# gym.html: per-exercise coaching posters (Exercise Library)

## Problem
`gym.html` already has rich per-exercise text coaching: `DEFAULT_CUES` (4 lines per exercise — setup, common mistake, ROM/stretch, tempo+breathing) and `MUSCLE_PRIMARY`, covering all 41 primaries and all 34 substitution alternates, resolved by `getCues(exId)` per the currently-active variant and rendered into `#cuesSection` inside `logFormWrap`. What's missing is a visual reference. `posing.html` already proved a premium image pattern for this (dense coaching-poster images, tap-to-expand, lightbox) for its poses. This adds the same poster treatment as a visual companion to the cues gym.html already shows — not a new cue-content system.

## Scope (this pass)
All 41 primary exercises across the 5 existing training days (Push 7, Pull 7, Legs A 6, Upper 8, Legs B 6) **plus** their 34 substitution alternates — 75 posters total, matching 1:1 with the exercise names already keyed in `DEFAULT_CUES`.

## Data model
One new lookup object, `EXERCISE_SLUGS`, placed next to `DEFAULT_CUES`/`MUSCLE_PRIMARY` (same file, same convention — a plain object keyed by exercise/variant name, not fields bolted onto the `EXERCISES` array or `subs[]` entries):

```javascript
const EXERCISE_SLUGS = {
  'Hack Squat': 'hack-squat',
  'Pendulum Squat': 'pendulum-squat',
  // ... one entry per DEFAULT_CUES key, same 41 primary + 34 variant names
};
```

No `note` field, no per-exercise JSON, no changes to `EXERCISES`/`subs[]` at all. The poster image carries setup/mistakes/muscle-emphasis/tip; the existing `DEFAULT_CUES` text carries the rest. Two lookup tables that both key off exercise name (`DEFAULT_CUES`, `EXERCISE_SLUGS`) is the established pattern here, not a new one.

## UI
One image slot inside `logFormWrap`, next to the existing `#cuesSection` — rendered once per currently-selected exercise, not per list row (there is no per-row detail panel in `renderWorkoutList()` today; rows are plain click-to-select).

- New `getPoster(exId)` mirrors `getCues`'s resolution exactly: active variant's slug if present, else the primary's slug, else `null`.
- A new function `renderPoster(ex)`, called alongside the existing `renderCues(ex)` (both driven by the same exercise-selection flow, so switching exercises *or* switching a variant via the sub picker updates both together automatically — no extra wiring needed for variant-switching).
- Markup: a collapsed-by-default `<div id="posterSection">` with a tap-to-expand header (same chevron affordance as posing.html/mobility.html), containing `<img id="posterImg">`. On expand, if not already loaded, set `img.src = 'assets/gym/' + slug + '.png'`; `onload` reveals it. If the slug has no image yet (not generated this batch) or `getPoster` returns `null`, the section stays hidden entirely — no broken-image state.
- Tap the revealed image → same shared full-size lightbox pattern as posing.html (`#lightbox`/`.show`), one instance added to `gym.html`.

This replaces the earlier "collapsible per-row card" and "sub-picker peek icon" ideas from the first draft — both are unnecessary once the poster lives in the single already-reactive `logFormWrap` location.

## Assets
`assets/gym/<slug>.png`, following the `assets/mobility/<slug>.png` convention already established. One flat folder — subs and primaries share it.

## Image generation (batched by day)
Order: Push → Pull → Legs A → Upper → Legs B. Each batch covers that day's primaries **and** their subs together. Review the Push batch's quality bar before generating the rest — cheaper to fix a style problem after one day's batch than after all 75.

**Poster content** (per image, matching posing.html's density):
- Exercise name
- Setup/grip/stance cue callouts
- 1-2 common mistakes
- Muscle-emphasis legend (can reuse `MUSCLE_PRIMARY`'s text directly as a starting point where an entry exists)
- One coaching tip

## Out of scope
- Any change to `DEFAULT_CUES`, `MUSCLE_PRIMARY`, or the existing Cues edit flow — this is additive only.
- Injury-modification variants, video references, tempo/breathing as separate structured fields (already covered by `DEFAULT_CUES`).
- Any new nav slot, standalone page, or changes to the substitution-picker modal itself.

## Testing
Manual verification per posing.html precedent (no build/test framework in this static-HTML app): load `gym.html`, select an exercise in each of the 5 day groups, expand the poster section, confirm the image loads and the lightbox opens/closes; switch to a sub via the "Alt" picker, confirm the poster swaps to match the sub's slug (same way the cues text already swaps); confirm an exercise/variant with no generated image yet just keeps the poster section hidden rather than showing a broken image.
