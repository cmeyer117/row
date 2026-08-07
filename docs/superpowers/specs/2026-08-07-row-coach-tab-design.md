# Row Coach Tab — Design

**Date:** 2026-08-07
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`), read-only consumer of Jarvis-owned data

## Goal

Row Upgrades ranking #3. Jarvis's Weekly Coach's Read (stall flags, volume drift, Faith+Iron signal — `jarvis/src/tools/coach-read.ts`) already computes a real weekly narrative and writes it to Supabase, but today it only reaches Telegram or Jarvis's own UI. Row, which is the app Carl actually opens daily, never shows it. This adds a read-only card to Row's hub surfacing that existing digest — no new intelligence, just a missing pipe.

## Ground truth (verified in-session, 2026-08-07)

- `runCoachRead()` (`coach-read.ts`) upserts `app_state` row `key='jarvis:coach_read'`, `data: {narrative, phase, generatedAt, weekOf}`. Recomputed on Jarvis app-open if `weekOf` isn't the current Monday (`GET /scheduled/coach-read`'s compute-if-stale logic); no cron currently triggers it independently.
- Confirmed live via direct anon REST read: `{"phase":"reverse_diet","weekOf":"2026-08-03","narrative":"Bodyweight down 5.3 lbs over the last month, Dumbbell Lateral Raise top-set up 33% — that's the trend paying off.","generatedAt":"2026-08-06T01:39:15.245Z"}` — real data, current week, anon SELECT already permitted (table-wide RLS, no per-key policy gap). No backend or RLS work needed.
- `index.html` (Carl's Dashboard hub) already has an `ops-strip` of 3 live-data chips (Macros/Stack/Check-in) populated by small IIFEs in its boot `<script>` block, each reading either localStorage or a direct `window.supabase.createClient(...)` call — `initMacroChip()` is the exact pattern to mirror (creates its own client inline, guarded by `if (!window.supabase) return`).
- `gym.html`'s existing "Ask Coach" button is a different feature entirely (on-demand per-exercise cue/PR lookup, local logic, no relation to the weekly narrative) — no naming collision, but confirms the weekly digest deserves its own distinct label.

## Behavior

New card on `index.html`, placed directly below the existing `ops-strip` (`ops-strip` div, before `.bento`).

**Markup:**
```html
<div class="coach-read-card" id="coachReadCard" style="display:none">
  <div class="coach-read-label">Coach's Read <span class="coach-read-week" id="coachReadWeek"></span></div>
  <div class="coach-read-text" id="coachReadText"></div>
</div>
```
Hidden by default (`display:none`); the fetch script reveals it only on a successful, non-empty response — mirrors the ops-chip's existing silent-failure convention (a failed/missing fetch just leaves the hub looking like it always did, never a visible error state).

**Fetch (new IIFE in the existing boot `<script>` block, after `initMacroChip`):**
```javascript
(async function initCoachRead() {
  try {
    if (!window.supabase) return;
    const client = window.supabase.createClient(
      'https://vikpcejlyxieguorwysf.supabase.co',
      'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv'
    );
    const { data, error } = await client.from('app_state').select('data').eq('key', 'jarvis:coach_read').maybeSingle();
    if (error || !data || !data.data || !data.data.narrative) return;
    const read = data.data;
    document.getElementById('coachReadText').textContent = read.narrative;
    const weekEl = document.getElementById('coachReadWeek');
    if (read.weekOf) {
      const days = Math.round((Date.now() - new Date(read.weekOf + 'T00:00:00Z').getTime()) / 86400000);
      weekEl.textContent = days > 10 ? '· stale (week of ' + read.weekOf + ')' : '· week of ' + read.weekOf;
    }
    document.getElementById('coachReadCard').style.display = '';
  } catch (e) {}
})();
```

**Styling:** New `.coach-read-card`/`.coach-read-label`/`.coach-read-text`/`.coach-read-week` rules matching the existing card/chip visual language (dark translucent background, `--accent` label, `--text-secondary` body) — no new design system, just a card-sized sibling of the existing `ops-chip` treatment.

## Error handling

- Supabase client unavailable, network failure, missing row, or missing/empty `narrative` → card never becomes visible. No error text, no console noise beyond the existing silent `catch`.
- `weekOf` absent (shouldn't happen given the current schema, but defensively handled) → card still shows the narrative with no week label rather than crashing.
- No write path exists in this feature — Row never mutates `jarvis:coach_read`.

## Non-goals

- No auto-refresh / no way for Row to force Jarvis to recompute — Row is a static frontend with no auth bridge to Jarvis's session-gated trigger route. Staleness is surfaced (see `stale` tag above 10 days), not solved.
- No per-flag breakdown UI — `narrative` is already assembled prose from Jarvis; Row renders it as-is.
- No duplicate placement inside `gym.html`'s coach section — one clear home on the hub, not two half-visible ones.
- No new Supabase table, key, or RLS policy — pure read of an existing row.

## Verification

- Browser: seed `app_state.jarvis:coach_read` (already has real data, no seeding needed) — confirm card renders with correct narrative + week label on hub load in the Browser pane.
- Confirm card stays hidden when the row is deleted/malformed (test via a temporary bad key name in a scratch fetch, not by touching the real prod row).
- Confirm stale-tag logic: a `weekOf` more than 10 days in the past shows the `stale (week of ...)` variant.
- Confirm no horizontal overflow at 375px.
- No unit-testable pure logic here (the whole feature is a fetch + render) — no `.selfcheck.cjs` needed, matching the codebase's existing convention of only writing pure-logic tests for actual logic modules.
