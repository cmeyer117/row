# gym.html Module Split — Phase 1: Weight Tracker + Photos

## Overview

`gym.html` is 5,925 lines with a single ~3,245-line inline `<script>` (one IIFE, zero test coverage, live personal app). This is phase 1 of extracting it into separate files: pull out the weight-tracker + composition-estimate + progress-photos section (~720 lines) into its own file, `gym-weight-photos.js`, and prove the extraction pattern is safe before touching the more tangled core (workout state, rendering, forms) that almost everything else in the file depends on.

No functional changes. This is a pure structural refactor — every behavior must work identically after the split.

---

## Why This Section First

It's the most self-contained chunk in the file: it owns its own localStorage keys (`po_coach_weights`, `po_coach_photos`), its own DOM elements (`wt*` prefixed IDs), and doesn't feed data into the workout-logging core. The only real coupling is inbound (reads a few shared globals) and outbound (two functions get called by the later sync code) — both fully enumerated below.

## Dependency Surface (discovered via grep, not assumed)

**Inbound — code being extracted reads these from the main script:**
- `state.units`, `state.exercises`, `state.logs` (composition-estimate math; read-only in this section)
- `CONFIG.composition` (composition feature config)
- `$(id)` — DOM-lookup helper
- `getChipDate`, `getActiveDate`, `fmtDateChipLabel` — date-chip helpers defined just before this section
- `supabase` (already a page-global via the CDN `<script>` tag in `<head>` — no change needed)

**Outbound — code staying in the main script (specifically the later "pc" remote-sync block) calls these by bare name:**
- `wtRender()`, `photosRender()`, `wtLoad()`, and reads/reassigns `wtEntries`

**Critical constraint:** `state` is reassigned (not just mutated) in three places elsewhere in the file — JSON import restore, factory reset, and the remote-sync pull. A one-time snapshot of `state` taken at load time would go stale after any of those and silently show outdated data in the composition estimate. The bridge must expose `state` live, not as a snapshot.

## Design

### 1. Bridge object (new, ~6 lines, added to the main script)

Immediately after `state`, `$`, and the date-chip helpers are defined (right before the weight-tracker section currently starts, ~line 4966), add:

```js
window.__gym = {
  get state() { return state; },   // live getter — survives state reassignment
  $, CONFIG, getChipDate, getActiveDate, fmtDateChipLabel
};
```

This is additive only — no existing line changes.

### 2. Split the inline `<script>` into two tags

The current single IIFE (`(function() { ... })()`, lines 2720–5921) gets cut at the weight-tracker section boundary into two separate IIFEs in two separate `<script>` tags, with the new external file loaded in between:

```html
<script> (function() { ...everything up to and including the __gym bridge... })(); </script>
<script src="gym-weight-photos.js"></script>
<script> (function() { ...everything from the pc-sync section onward... })(); </script>
```

Execution order guarantees `window.__gym` exists before `gym-weight-photos.js` runs, and `gym-weight-photos.js` has already attached `wtRender`/`photosRender`/`wtLoad` to `window` before the third script tag's pc-sync code can call them.

### 3. New file: `gym-weight-photos.js`

- Contains the extracted ~720 lines (weight tracker, composition estimate, progress photos — everything currently between the two section banners at ~4967 and ~5690)
- Wrapped in its own IIFE for namespace hygiene
- All references to `state.x`, `$(...)`, `CONFIG.composition`, `getChipDate`, `getActiveDate`, `fmtDateChipLabel` rewritten to go through `window.__gym.x` (mechanical replacement, ~25 call sites)
- At the end, explicitly exposes what the sync code needs: `window.wtRender = wtRender; window.photosRender = photosRender; window.wtLoad = wtLoad;`

### 4. What does NOT change

- No behavior change — same DOM IDs, same localStorage keys, same event listeners
- No conversion to ES modules — stays plain scripts, same pattern as the existing `topbar.js`
- The remaining pc-sync code is untouched (its bare `wtRender()` calls resolve through the normal scope chain to the new global)

## Testing Plan (manual, in-browser — no automated test suite exists for this file)

After the split, verify each flow live in the browser before considering this done:
1. Load the page fresh — weight card renders with existing data, no console errors
2. Log a new weight entry — saves, re-renders streak/chart/delta correctly
3. Toggle weight history open/closed — list renders correctly
4. Composition estimate section — renders with correct numbers (cross-check against pre-split values)
5. Take/upload a progress photo — saves, thumbnail appears, uploads to Supabase storage
6. Open photo viewer and compare mode — both render correctly, delta math correct
7. Delete a photo — removes correctly
8. Trigger a remote sync pull (or simulate) — confirms `wtRender()`/`photosRender()` still get called correctly from the pc-sync code and reflect the (possibly reassigned) `state`
9. Trigger JSON import / factory reset — confirms weight/photo section doesn't show stale data afterward (the specific bug the live-getter bridge is designed to prevent)

If any step fails, the fix must happen before commit — this is a live app Carl uses daily, not a throwaway experiment.

## Rollback

Single commit, easily revertable (`git revert`) if anything breaks post-deploy. No data migration involved — same localStorage keys, so no data loss risk even if reverted mid-use.

## Out of Scope (deferred to later phases)

- Extracting any other section (workout state, rendering, forms, plate calculator, etc.) — those have much heavier coupling to `state` and are deferred until this pattern is proven safe
- Any ES-module conversion
- Any behavior change or feature addition to weight-tracking or photos
