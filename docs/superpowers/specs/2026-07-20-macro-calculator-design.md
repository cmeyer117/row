# Macro Calculator — Design

**Date:** 2026-07-20
**Status:** Approved, ready for implementation plan

## Why

`macros.html` already handles packaged food (barcode → Open Food Facts) and one-off manual entry, but there's no fast way to compute a whole typed-in meal of whole/staple foods — e.g. "200g white rice, 200g chicken breast, 50g broccoli." Open Food Facts search-by-name was tested live for this and confirmed unreliable for generics (searching "white rice cooked" returned branded mixed dishes as top hits, not a clean rice entry) — so this needs its own curated data source, not a search API.

## Scope

- A repeatable ingredient-row UI: pick a food from a known list, enter grams, add more rows. Not free-text parsing — picking from known foods avoids the ambiguity a string parser would hit ("a cup of," "about 200g of").
- A curated static dataset of ~55-60 bodybuilding-diet staple foods (list below), not a live search — reliable, zero API cost, same trust tier as the existing KJV Bible dataset (Vessel) and `gym-workout-events.js` pattern (static, testable, no network dependency).
- Live-updating combined totals as rows are added/edited.
- "Add to Today" logs the combined meal as **one** `food_log` row (name is the joined ingredient list), reusing the existing `insertEntry()` write path and its error handling — not a standalone calculator that logs nothing.

## Food dataset

`staple-foods.js`, same dual `window`/`module.exports` pattern as `macro-calc.js` and `gym-workout-events.js`. Each entry: `{ name, protein_100g, carb_100g, fat_100g, calories_100g }` — per 100g, USDA FoodData Central standard reference values (public domain). A few entries (whey protein, protein bar, turkey bacon, Ezekiel bread) are brand-variable by nature — labeled as generic/approximate in a comment; Carl can swap in his specific product's label values later if they matter for precision.

| Food | protein_100g | carb_100g | fat_100g | cal_100g |
|---|---|---|---|---|
| Chicken Breast (cooked) | 31 | 0 | 3.6 | 165 |
| Chicken Thigh (cooked, skinless) | 26 | 0 | 10.9 | 209 |
| Turkey Breast (cooked) | 29 | 0 | 1 | 135 |
| Turkey Bacon (cooked, generic) | 25 | 1.5 | 20 | 290 |
| Ground Beef 93/7 (cooked) | 26 | 0 | 8 | 176 |
| Ground Beef 85/15 (cooked) | 24 | 0 | 15 | 250 |
| Ground Turkey 93/7 (cooked) | 27 | 0 | 8 | 189 |
| Sirloin Steak (cooked) | 29 | 0 | 8 | 201 |
| Filet Mignon (cooked) | 28 | 0 | 15 | 267 |
| Pork Chop (cooked, lean) | 27 | 0 | 9 | 195 |
| Bison (cooked, ground) | 28 | 0 | 7 | 180 |
| Tilapia (cooked) | 26 | 0 | 2.7 | 128 |
| Cod (cooked) | 23 | 0 | 0.9 | 105 |
| Halibut (cooked) | 27 | 0 | 2.3 | 128 |
| Salmon (cooked) | 25 | 0 | 13 | 208 |
| Shrimp (cooked) | 24 | 0.2 | 0.3 | 99 |
| Tuna, canned in water (drained) | 26 | 0 | 0.8 | 116 |
| Eggs, whole (cooked) | 13 | 1.1 | 11 | 155 |
| Egg Whites | 11 | 0.7 | 0.2 | 52 |
| Greek Yogurt (plain, nonfat) | 10 | 3.6 | 0.4 | 59 |
| Cottage Cheese (2%) | 11 | 3.4 | 2.3 | 81 |
| Whey Protein Powder (generic, dry) | 80 | 8 | 5 | 400 |
| Tofu (firm) | 8 | 1.9 | 4.8 | 76 |
| Mozzarella (part-skim) | 24 | 3 | 17 | 254 |
| Cheddar Cheese | 25 | 1.3 | 33 | 403 |
| White Rice (cooked) | 2.7 | 28 | 0.3 | 130 |
| Brown Rice (cooked) | 2.6 | 23 | 0.9 | 111 |
| Cream of Rice (cooked) | 1.4 | 17 | 0.1 | 75 |
| Oats (dry, rolled) | 13.5 | 68 | 6.5 | 379 |
| White Potato (baked, w/ skin) | 2 | 21 | 0.1 | 93 |
| Sweet Potato (baked) | 2 | 20.7 | 0.1 | 90 |
| Sourdough Bread | 8.8 | 51 | 1.6 | 231 |
| Ezekiel Bread (generic) | 12 | 42 | 2 | 250 |
| Rice Cakes (plain) | 8 | 82 | 2.8 | 387 |
| Quinoa (cooked) | 4.4 | 21.3 | 1.9 | 120 |
| Black Beans (cooked) | 8.9 | 24 | 0.5 | 132 |
| Chickpeas (cooked) | 8.9 | 27 | 2.6 | 164 |
| Lentils (cooked) | 9 | 20 | 0.4 | 116 |
| Banana | 1.1 | 23 | 0.3 | 89 |
| Blueberries | 0.7 | 14.5 | 0.3 | 57 |
| Apple | 0.3 | 14 | 0.2 | 52 |
| Broccoli (cooked) | 2.8 | 7 | 0.4 | 35 |
| Spinach (cooked) | 2.9 | 3.6 | 0.4 | 23 |
| Asparagus (cooked) | 2.4 | 3.9 | 0.2 | 20 |
| Green Beans (cooked) | 1.8 | 7 | 0.2 | 35 |
| Cauliflower (cooked) | 1.8 | 5 | 0.5 | 25 |
| Bell Pepper (raw) | 1 | 6 | 0.3 | 31 |
| Cucumber (raw) | 0.7 | 3.6 | 0.1 | 15 |
| Mixed Greens / Lettuce (raw) | 1.4 | 2.9 | 0.2 | 15 |
| Almonds | 21 | 22 | 50 | 579 |
| Peanut Butter | 25 | 20 | 50 | 588 |
| Walnuts | 15 | 14 | 65 | 654 |
| Cashews | 18 | 30 | 44 | 553 |
| Avocado | 2 | 8.5 | 14.7 | 160 |
| Olive Oil | 0 | 0 | 100 | 884 |
| Coconut Oil | 0 | 0 | 100 | 862 |
| Butter | 0.9 | 0.1 | 81 | 717 |
| Protein Bar (generic) | 20 | 25 | 8 | 220 |

(59 entries — over Carl's "maybe go over 50" allowance, deliberately.)

## Architecture

- `staple-foods.js` — the data file above, `window.StapleFoods` / `module.exports = { FOODS }`. No fetch, no network — pure static lookup.
- `macro-calc.js` gets one new pure function: `sumIngredients(rows, foods)` where `rows = [{ foodName, grams }]` and `foods` is the `StapleFoods.FOODS` array (passed in, not imported inside `macro-calc.js`, keeping it dependency-free like the rest of the file). Returns `{ protein_g, carb_g, fat_g, calories }`, using the same `num()` coercion already used by `remainingBudget` so an unmatched/bad row contributes 0, not `NaN`.
- `macros.html` — new **🧮 Calculator** button. The existing 3-button row (Scan/Manual/Targets) becomes a 2×2 grid to fit a 4th button without cramping (verified live: 3-across already fills 375px width edge-to-edge at 108px each).

## Calculator modal

- Repeatable rows: a `<select>` populated from `StapleFoods.FOODS` (alphabetical) + a grams `<input type="number">`. "+ Add ingredient" appends a row. Each row has a remove (✕) button, same visual pattern as the today-list entries.
- Totals update live on every keystroke/select-change via `sumIngredients()` — no submit step needed to see the math.
- "Add to Today" button: builds a name string by joining non-empty rows (e.g. `"200g White Rice, 200g Chicken Breast, 50g Broccoli"`), calls the existing `insertEntry({ name, protein_g, carb_g, fat_g, calories, source: 'manual', barcode: null })` — reusing Manual entry's exact write/error path, not a new one. On error: same `showEntryError()` alert, modal stays open, no phantom success (matching the fix already applied to Scan/Manual after the Codex review).
- Empty state: 2 blank rows shown by default (matches Carl's 2-3-ingredient example meals); rows with no food selected or 0 grams are ignored in the sum and skipped when building the log name.

## Testing

`staple-foods.selfcheck.js` (Node, same `assertEqual`/`process.exit(1)` pattern as `gym-workout-events.selfcheck.js` and `macro-calc.selfcheck.js`):
- Spot-check a few known values against the table above (e.g. Chicken Breast is exactly `{31, 0, 3.6, 165}` per 100g).
- `sumIngredients()` against Carl's own example — 200g White Rice + 200g Chicken Breast + 50g Broccoli — hand-computed expected total, asserted exactly.
- A row with an unmatched food name contributes 0, not `NaN` (mirrors the existing `remainingBudget` corrupt-row test).

## Out of scope (this pass)

- Free-text/natural-language ingredient parsing — structured rows only, per Carl's choice.
- Editing the dataset from the UI — it's a static file; adding a food later means editing `staple-foods.js` directly, same as the KJV verse dataset pattern.
- Matching Carl's coach's exact diet-sheet foods/brands — no diet sheet file was available to build from; this list is built from common bodybuilding-diet staples. Flag specific missing foods later and they can be added.
