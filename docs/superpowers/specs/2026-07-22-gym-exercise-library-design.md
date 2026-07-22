# gym.html: per-exercise coaching posters (Exercise Library)

## Problem
`gym.html`'s 41 tracked exercises (Push/Pull/Legs A/Upper/Legs B) carry only programming data today — name, rep range, weight, substitutions. No form cues, no visual reference. `posing.html` already proved a premium pattern for this (dense coaching-poster images, tap-to-expand, lightbox) for the 7 mandatory poses + 14 content poses. This extends the same pattern to the actual lifts Carl logs every session.

## Scope (this pass)
All 41 primary exercises across the 5 existing training days (Push 7, Pull 7, Legs A 6, Upper 8, Legs B 6) **plus** their 34 substitution alternates (`subs[]`) — 75 posters total. Every exercise a lift could ever be logged as gets the same treatment.

## Data model
Primary exercises in the `EXERCISES` array get two new fields:
- `slug` — kebab-case key, e.g. `"hack-squat"`, used for image lookup.
- `note` — one-line supplementary cue (mirrors posing.html's `mob-ex-note`), e.g. "Keep heels flat, don't let knees cave in."

Each object in a primary's `subs[]` array gets one new field:
- `slug` — same convention, e.g. `"pendulum-squat"`.

No `note` field on subs — the substitution picker modal is a compact list (name + star rating); a text cue doesn't fit there without cluttering it, and the poster image already carries the coaching detail. Subs keep the same "no separate content surface beyond the image" principle as primaries.

No other structured fields (no separate JSON for ROM/tempo/breathing/stabilizers/etc.) — the original "25-field encyclopedia" idea is deliberately cut. Detailed coaching content (setup, execution cues, common mistakes, muscle-emphasis legend, coaching tip) lives baked into the generated poster image itself, exactly like posing.html's 7 competition posters. This keeps the data model tiny and avoids a second content-maintenance surface separate from the image.

## UI
Reuses posing.html's exact collapsible-row + lightbox pattern, renamed to `gym-ex-*` classes to avoid colliding with `mob-ex-*` (a separate file):
- Each exercise's existing Log-tab card gets a tappable name/header. Tap → toggles `.expanded` on the row → reveals an `<img class="gym-ex-photo" data-slug="...">` panel.
- One delegated `click` handler on the card container for expand/collapse (checks `e.target.closest('.gym-ex-head')`).
- On page load, `document.querySelectorAll('.gym-ex-photo')` sets `img.src = 'assets/gym/' + img.dataset.slug + '.png'`; `onload` reveals the image. If the PNG doesn't exist yet (not generated this batch), the `<img>` just stays hidden — no broken-image icon, no fallback SVG (unlike mobility.html/posing.html, gym exercises don't have pre-existing stick-figure SVGs to fall back to, and generating 41 placeholder SVGs isn't worth it for what's a temporary gap during phased rollout).
- Tap the revealed photo → full-size lightbox (same `#lightbox`/`.show` pattern as posing.html, one shared instance for the page).

**Substitution picker** (`openSubPicker`/`buildSubOption`, existing modal): each `.sub-option` row (including the "(primary)" option) gets a small tappable image icon next to the star rating. Tapping it opens the same shared lightbox with that option's `slug` — `stopPropagation` so it doesn't also trigger variant selection, which is the row's existing click behavior.

## Assets
`assets/gym/<slug>.png`, following the `assets/mobility/<slug>.png` convention already established. One flat folder — subs and primaries share it since a sub's poster is exercise-specific, not tied to which primary it substitutes for.

## Image generation (batched by day)
Order: Push → Pull → Legs A → Upper → Legs B. Each batch covers that day's primaries **and** their subs together (e.g. Push's 7 primaries + however many `subs[]` entries their exercises list) — subs are logically grouped with the day they substitute into, not a separate 6th batch. Review the Push batch's quality bar before generating the rest — cheaper to fix a style problem after one day's batch than after all 75.

**Poster content** (per image, matching posing.html's density — not more):
- Exercise name
- Setup/grip/stance cue callouts
- 1-2 common mistakes
- Muscle-emphasis legend
- One coaching tip

## Out of scope
- Injury-modification variants, video references, tempo/breathing prescriptions as separate structured fields.
- Any new nav slot or standalone page — this lives inside existing `gym.html` cards and the existing sub-picker modal.

## Testing
Manual verification per posing.html precedent (no build/test framework in this static-HTML app): load `gym.html`, expand a card in each of the 5 day groups, confirm image loads and lightbox opens/closes; open the sub picker for an exercise with subs, confirm each option's peek icon opens the lightbox without selecting that variant; confirm a missing-image slug degrades to "stays collapsed-looking" rather than a broken-image icon.
