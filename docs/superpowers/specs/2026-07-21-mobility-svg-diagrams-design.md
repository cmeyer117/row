# Mobility page: collapsible SVG diagrams (Daily + Posing)

## Problem
`mobility.html` lists stretches as text-only cards. Carl wants a visual per stretch so he can see the position, not just read it — but 40+ always-visible images would clutter a mobile page. There's also no real posing-practice content, just a one-line "Posing Tip" note.

## Scope (this pass)
- **Daily tab**: Big 5 (5 rows) + Add-Ons (6 rows) = 11 stretches get diagrams.
- **New Posing tab**: 7 standard mandatory bodybuilding poses (front double bicep, front lat spread, side chest, side triceps, back double bicep, back lat spread, abdominal & thigh), each with a cue + diagram. Existing "Posing Tip" card moves here from Daily.
- **Deferred**: Pre/Post (per-day, `PP` JS object) and Joint Care tabs keep their current text-only cards. Follow-up pass once this one ships and looks right.

## Design

### Collapsible cards
Each `.mob-ex-row` in scope gets a chevron next to the name. Collapsed (default) = name + detail line only, same footprint as today. Tap the row → toggles an `expanded` class → reveals the SVG diagram + existing note text. Plain `display` toggle via one delegated click handler on `.mob-exercise-list` (checks `e.target.closest('.mob-ex-row')`), no animation, no per-row listeners.

### SVG diagrams
Inline `<svg>` per stretch, `viewBox="0 0 100 100"`, single stroke color (`var(--text-2)`), no fill, ~10-15 primitives (line/path/circle) forming a simple stick-figure in the stretch position. Stored as a JS object `SVG_LIB = { 'worlds-greatest-stretch': '<svg>...</svg>', ... }` keyed by slug, injected into the row's hidden panel on first expand (or at render time — cheap enough either way, injecting at render is simpler).

11 Daily rows are static HTML today — each gets a `data-svg="slug"` attribute; posing rows are new, built the same way as the Daily rows (static HTML, not JS-driven like `PP`).

### Posing tab
4th button in `.mob-tabs` (`Posing`), 4th `.mob-section`. Same card/row markup pattern as Daily. 7 poses, each: name, one-line cue (what to focus on / common mistake), SVG. "Posing Tip" card (ROM timing advice) moves here unchanged, placed above or below the pose list.

### Files touched
`mobility.html` only — one `SVG_LIB` object (18 entries: 11 stretches + 7 poses), `data-svg` attributes on existing Daily rows, new Posing section markup, one click handler for expand/collapse, one CSS rule for the collapsed/expanded state and chevron rotation.

## Out of scope
Pre/Post and Joint Care diagrams (later pass, reusing the same `SVG_LIB` pattern — most of those stretches already overlap with Daily's slugs, e.g. `dead-hang`, `couch-stretch`, so that pass should mostly be dedup + a handful of new slugs).
