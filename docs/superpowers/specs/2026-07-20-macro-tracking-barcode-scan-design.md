# Macro Tracking + Barcode Scan — Design

**Date:** 2026-07-20
**Status:** Approved, ready for implementation plan

## Why

Row is Carl's daily-use fitness dashboard during an active recomp, but has zero macro/nutrition tracking today — the single biggest plain functional gap in the app. Carl doesn't use the existing water tracker (`po-water.html`), so this replaces it rather than adding a new page from scratch.

## Scope

- Retire `po-water.html` in place (`git mv` → `macros.html`, content rewritten). History preserved, water logic not hard-deleted from git, but fully removed from the active UI.
- Daily macro targets (protein/carb/fat/calories) with a running remaining-for-today budget — not just a log.
- Barcode scan (packaged food, via Open Food Facts) **and** manual entry (homemade/no-barcode food). Both in v1.
- History of past days' logs, viewable later (not just today, reset-and-forget).
- No topbar quick-add macro pill in v1 — the water pill is removed outright, not replaced with a macro equivalent. Add later if wanted.

## Architecture

- No new backend. Row is fully static (no `package.json`, no build step) — barcode decode and the Open Food Facts lookup both run client-side, matching Row's existing pattern (CDN script tags, e.g. Supabase SDK via jsdelivr).
- Barcode decode: `html5-qrcode` loaded via CDN. The native `BarcodeDetector` Web API is not usable here — no iOS Safari support, and Carl is on iPhone.
- Open Food Facts lookup: direct client-side `fetch` to `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`. Confirmed CORS-open (`Access-Control-Allow-Origin: *`) — no proxy/serverless function needed.

## Data model

**New Supabase table `food_log`** (same project, `vikpcejlyxieguorwysf`), mirroring the existing `workout_events`/`content_ideas` pattern — event-stream data gets its own table, not crammed into `app_state`:

| column | type | notes |
|---|---|---|
| id | uuid | pk |
| log_date | date | local calendar day the food was logged for — computed from the browser's local time (`getFullYear/Month/Date()`), not `toISOString()`/UTC. Vessel hit this exact bug class with UTC-keyed dates; avoid it here by deriving the key client-side from local time before writing. Named `log_date`, not `date`, to avoid the reserved-word ambiguity. |
| name | text | product name or manual entry name |
| protein_g | numeric | |
| carb_g | numeric | |
| fat_g | numeric | |
| calories | numeric | taken directly from source, not recomputed from macros (OFF's own kcal figure may not equal 4/4/9 exactly — fiber, alcohol, etc.) |
| source | text | `'barcode'` \| `'manual'` |
| barcode | text, nullable | only set when `source = 'barcode'` |
| created_at | timestamptz | default now() |

Anon RLS select/insert policies, same convention as `workout_events` and `content_ideas`.

**Daily targets** (`proteinG`, `carbG`, `fatG`, `calories` — set once, editable) live in the existing `app_state` row keyed `health`, alongside the other health.html scalars. Not its own table — this is small, single-row, scalar state, not a log.

## Barcode → macro flow

1. Scan → `html5-qrcode` decodes the barcode.
2. Fetch `.../api/v2/product/{barcode}.json?fields=product_name,serving_size,nutriments`.
3. OFF returns both `_100g` and `_serving` nutrient values, plus a free-text `serving_size` label (e.g. `"0.333 PACKAGE (52 g)"`).
   - **Default:** use the `_serving` values, show the `serving_size` text so Carl knows what "1 serving" means, offer a quantity multiplier (e.g. "× 2 servings").
   - **Fallback:** if a product has no `_serving` fields, use `_100g` values and ask for grams eaten instead.
4. Confirm → insert into `food_log`.
5. Not found in OFF, or camera permission denied → drop to manual entry.

## UI (`macros.html`)

- Top: remaining-today bars for protein/carb/fat/calories (target minus today's `food_log` sum for `date = today`).
- Scan button → camera view (`html5-qrcode`) → OFF lookup → confirm serving/quantity → insert.
- Manual entry → name + protein/carb/fat (or calories) → insert.
- Today's log list, with delete.
- History tab (Log/Progress split, same pattern as `gym.html`'s existing tab structure) — past days' totals, tap to expand.

**Reused logic:** the target-calculation formula (BMR → TDEE → macros) already exists as a pure function, `calculateMacros()`, in `coaching-landing/macros.html`. Copy it into Row's `macros.html` rather than building shared infrastructure between the two separate static repos — duplication is correct here, not a new module system.

## Removing the water tracker

This is a real removal, not just deleting a page link:

- **`topbar.js`** (loaded on every Row page) has ~150 lines of embedded water logic: the status pill markup/CSS, the quick "+1 drink" button, `classifyStatus()`, and a direct `po_water_v1` read/write that merges into the shared `health` app_state row on push. All of this gets excised.
- **`health.html`**: repoint the iframe from `po-water.html` → `macros.html`; rename `#water`/`.water-embed`/`.water-iframe` → `#macros`/`.macro-embed`/`.macro-iframe` (same repurposed slot); drop `po_water_v1` from `syncedKeys`.
- `po-water.html`'s own file becomes `macros.html` via `git mv`, content rewritten — water code stays out of the active UI but isn't hard-deleted from git history.

## Testing

Row has no test runner (fully static). Use the same `console.assert`-based self-check pattern `coaching-landing/macros.html` already uses for its own `calculateMacros()` — apply it to any new pure functions here too (remaining-budget calc, serving-size fallback logic).

## Out of scope (v1)

- Topbar quick-add macro pill (symmetry with the removed water pill) — not requested, add later if wanted.
- Barcode caching/offline lookup.
- Cross-referencing `food_log` with the coaching-landing `macro_leads` table — separate systems, no integration needed.
