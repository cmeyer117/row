# gym.html: per-exercise coaching posters (Exercise Library)

## Problem
`gym.html`'s 41 tracked exercises (Push/Pull/Legs A/Upper/Legs B) carry only programming data today — name, rep range, weight, substitutions. No form cues, no visual reference. `posing.html` already proved a premium pattern for this (dense coaching-poster images, tap-to-expand, lightbox) for the 7 mandatory poses + 14 content poses. This extends the same pattern to the actual lifts Carl logs every session.

## Scope (this pass)
All 41 primary exercises across the 5 existing training days: Push (7), Pull (7), Legs A (6), Upper (8), Legs B (6). Substitution alternates (`subs[]`) are out of scope — no posters for those, only the primary logged exercise.

## Data model
Two new fields added to each entry in the `EXERCISES` array in `gym.html`:
- `slug` — kebab-case key, e.g. `"hack-squat"`, used for image lookup.
- `note` — one-line supplementary cue (mirrors posing.html's `mob-ex-note`), e.g. "Keep heels flat, don't let knees cave in."

No other structured fields (no separate JSON for ROM/tempo/breathing/stabilizers/etc.) — the original "25-field encyclopedia" idea is deliberately cut. Detailed coaching content (setup, execution cues, common mistakes, muscle-emphasis legend, coaching tip) lives baked into the generated poster image itself, exactly like posing.html's 7 competition posters. This keeps the data model tiny and avoids a second content-maintenance surface separate from the image.

## UI
Reuses posing.html's exact collapsible-row + lightbox pattern, renamed to `gym-ex-*` classes to avoid colliding with `mob-ex-*` (a separate file):
- Each exercise's existing Log-tab card gets a tappable name/header. Tap → toggles `.expanded` on the row → reveals an `<img class="gym-ex-photo" data-slug="...">` panel.
- One delegated `click` handler on the card container for expand/collapse (checks `e.target.closest('.gym-ex-head')`).
- On page load, `document.querySelectorAll('.gym-ex-photo')` sets `img.src = 'assets/gym/' + img.dataset.slug + '.png'`; `onload` reveals the image. If the PNG doesn't exist yet (not generated this batch), the `<img>` just stays hidden — no broken-image icon, no fallback SVG (unlike mobility.html/posing.html, gym exercises don't have pre-existing stick-figure SVGs to fall back to, and generating 41 placeholder SVGs isn't worth it for what's a temporary gap during phased rollout).
- Tap the revealed photo → full-size lightbox (same `#lightbox`/`.show` pattern as posing.html, one shared instance for the page).

## Assets
`assets/gym/<slug>.png`, following the `assets/mobility/<slug>.png` convention already established.

## Image generation (batched by day)
Order: Push (7) → Pull (7) → Legs A (6) → Upper (8) → Legs B (6). Review the Push batch's quality bar before generating the rest — if the style needs adjusting, cheaper to fix after 7 images than after 41.

**Poster content** (per image, matching posing.html's density — not more):
- Exercise name
- Setup/grip/stance cue callouts
- 1-2 common mistakes
- Muscle-emphasis legend
- One coaching tip

## Out of scope
- Substitution-alternate exercises (`subs[]`) — no posters.
- Injury-modification variants, video references, tempo/breathing prescriptions as separate structured fields.
- Any new nav slot or standalone page — this lives inside existing `gym.html` cards.

## Testing
Manual verification per posing.html precedent (no build/test framework in this static-HTML app): load `gym.html`, expand a card in each of the 5 day groups, confirm image loads and lightbox opens/closes, confirm a missing-image slug degrades to "stays collapsed-looking" rather than a broken-image icon.
