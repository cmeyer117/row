# Road to Pro Public Tracker — Design

**Date:** 2026-08-07
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Goal

Row Upgrades ranking #7. A public, shareable page charting Carl's journey to his Pro card — content/funnel leverage, and the first genuinely public page in this codebase.

## Ground truth (verified in-session, 2026-08-07)

- Every page in Row today is passphrase-gated by `topbar.js`'s `authGate()` (`row_auth` in `sessionStorage`, client-side only) **except** `coaching.html`/`coaching-plan.html`, which use real Supabase Auth instead. There is no existing "no gate at all" page pattern.
- Row's Supabase tables (including `po_coach_v1`, `po_coach_weights`) are anon-readable by design — this is a standing, already-backlogged exposure (`BACKLOGGED 2026-07-24 — Extend RLS lockdown to Row's other ~13 blanket-anon tables`). A public page reading those tables directly, even filtered, would sit one bad filter away from exposing real private data (live bodyweight, every workout log).
- Carl explicitly chose the safest option after this risk was flagged: a hand-maintained, git-committed JSON/JS data file, edited by Carl (or Claude on his instruction) — never a live connection to real Row data.

## Approach

**Data:** New `road-to-pro-data.js`, a plain array of entries:

```javascript
// road-to-pro-data.js — hand-curated Road to Pro timeline. Edited by
// Carl (or Claude on his instruction) and committed like any other
// content change. Never reads from po_coach_v1/live Supabase -- nothing
// in this file can leak private training data, by construction.
(function () {
  'use strict';
  var ENTRIES = [
    // { date: 'YYYY-MM-DD', title: 'string', body: 'string', metric: 'string' | null }
  ];
  var api = { ENTRIES: ENTRIES };
  if (typeof window !== 'undefined') window.RoadToProData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

`metric` is optional freeform text (e.g. `"e1RM bench: 315 lbs"`) — Carl's call per entry whether to include one, never auto-computed.

**Page:** New `road-to-pro.html`. Deliberately does **not** include `topbar.js` — no passphrase gate, no bottom-tab chrome, no auth of any kind. A minimal standalone page: header (name/tagline), reverse-chronological entry list rendered from `RoadToProData.ENTRIES` via `textContent` (never `innerHTML` on entry fields — they're Carl-authored, not user input, but the codebase's own convention is text-safe DOM APIs regardless of source). Visually matches Row's existing dark/mono aesthetic (same CSS variables as `form-coach.html`/`row-wrapped.html`) without pulling in any app-chrome dependency.

**Update flow:** Carl tells any Claude session what changed; the session edits `road-to-pro-data.js` directly, commits, pushes — identical to how every other Row content change ships today. No admin UI, no new auth surface, no new Supabase table.

**Linking:** Not added to `index.html`'s hub or `ops-strip` (those are behind the passphrase gate) — this page is reached only via its direct URL, shared deliberately by Carl (e.g. in a bio link or a caption), consistent with it being the one intentionally public surface.

## Error handling

- `RoadToProData` missing/malformed → page renders an empty timeline with a static "more to come" message, never a blank/broken page.
- No network calls, no localStorage reads, no Supabase client — nothing to fail beyond a malformed local script, which is caught by the same JS module pattern every other Row page already uses (`if (typeof window !== 'undefined')` guard).

## Non-goals

- No live data connection of any kind — this is the whole point of the design.
- No admin form / in-page editor — updates are a normal code change.
- No comments, likes, or any interactive/social surface.
- No analytics/tracking on this page in v1 — a separate ask if ever wanted.
- Not linked from any passphrase-gated page — reached only via its own direct URL.

## Verification

- Browser: page loads with zero entries (empty-state message renders, no crash) and with 2-3 seeded entries (correct reverse-chronological order, `metric` shown only when present on that entry). Confirm the page renders and functions with `topbar.js` never loaded — no auth prompt, no hidden-until-authed flash.
- Confirm no network requests fire at all (no Supabase, no external calls beyond the shared Google Fonts `<link>` every Row page already uses).
- Confirm no horizontal overflow at 375px.
- No pure logic here worth a `.selfcheck.cjs` — the only "logic" is sorting a small hand-curated array, exercised directly by the browser verification above.
