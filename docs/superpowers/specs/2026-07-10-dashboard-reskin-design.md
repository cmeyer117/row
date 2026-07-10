# Row Dashboard Reskin — Design

## Goal
Reskin all Row pages to match the "Vitality" visual reference (mosaic-grid dashboard aesthetic), while keeping each page's existing layout and functionality intact.

## Reference
Visual language pulled from `ohwisey/logger-demos` (`s2/trailer-broll.html`), which shares Row's existing mint accent already.

## Design tokens (new `theme.css`, shared by all pages)
```css
:root {
  --bg: #000;
  --ink: #F4F1EA;        /* warm off-white, replaces current --text-primary */
  --ink-dim: rgba(244,241,234,0.55);
  --ink-faint: rgba(244,241,234,0.28);
  --mint: #6EE7B7;       /* already Row's --accent — unchanged */
  --mint-soft: #A7F0CA;
  --border: rgba(255,255,255,0.08);
  --radius-card: 16px;
  --font-serif: 'Instrument Serif', Georgia, serif;   /* replaces Newsreader */
  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```
Card style: hairline border, `--radius-card` corners, numbered mono label top-left, italic serif label bottom-left, arrow affordance bottom-right (hub only).

## Scope

### 1. Shared stylesheet
Extract repeated `<style>` root vars + font `<link>` tags (currently duplicated across all 9 HTML files) into one `theme.css`, linked by every page. Replaces `Newsreader` with `Instrument Serif`, adds `Inter`, keeps `JetBrains Mono`.

### 2. Hub (`index.html` / `main.html`)
Rebuilt as the mosaic grid: numbered module cards (Train, Fuel, Vitals, Library, Create, VEE, etc. — mapped to Row's actual sections) linking to each sub-page, using the reference's `grid-template-areas` mosaic layout.

### 3. Sub-pages (gym, health, finance, mobility, po-water, seed, offline)
Re-themed with the new tokens/card style. Layout structure, forms, logic unchanged — visual pass only.

## Out of scope
MCP write-connector — not needed. Jarvis already has `logWeight`/`logWorkout` tools (`jarvis/src/tools/log-weight.ts`, `log-workout.ts`) writing directly to `app_state`/`po_coach_*` with fuzzy exercise matching and Obsidian sync. No gap to fill here.

## Testing
Visual/manual check per page after restyle — no new logic introduced, so no new automated tests needed. Confirm no regressions in gym.html's cloud-sync (untouched JS, only its `<style>` block changes).
