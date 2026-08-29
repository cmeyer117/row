# Promote State of Me to Persistent Chrome — Design Spec

**Date:** 2026-08-29
**Status:** Approved, ready for implementation plan
**Origin:** First real piece scoped out of the "unifying coach surface" gap named in the Row north-star capture (`Carl Meyer/02 - Projects/ROW Dashboard.md`, added earlier 2026-08-29). Substantially reframed during brainstorming after auditing the real app — see "What the audit actually found" below.

## Problem

The north-star note listed "no unifying coach surface" as a real gap. That turned out to be wrong, and the correction is the whole basis of this spec.

Row already has multiple cross-domain synthesis surfaces:

- **`state-of-me.html`** — the most genuinely unifying page in the app. Renders training volume (week-over-week), weight trend (30d), recomp signal, steps (7d avg), stack adherence (7d), sleep (7d), macro adherence (7d), and a Faith+Iron correlation card. Pulls from every tracker in Row plus Vessel-side season data.
- **`weekly-review.html`** — already promoted to the topbar (🗓️).
- **`row-wrapped.html`** — periodic retrospective.
- **`road-to-pro.html`** — long-horizon goal view.

Row is also not AI-free (another wrong assumption worth recording): its pages already call `/api/vision-talk`, `/api/coach-read`, `/api/vision-pose-critique`, and `/api/vision-lift-critique`, and `mini-vision-chat.js` exists.

**The actual problem is reachability, not absence.** Row's persistent chrome (`topbar.js`) exposes only five destinations: `index.html` (home ⌂), `main.html` / `health.html` / `gym.html` (the three bottom tabs), and `weekly-review.html` (🗓️). `state-of-me.html` is reachable from exactly one screen — an "ops chip" on the `index.html` hub (`index.html:418`), alongside `row-wrapped` (`:417`) and a `road-to-pro` tile (`:530`).

So the page that best answers "how am I actually doing across everything" is invisible from the three tabs where the time is actually spent. Carl's reported symptoms — the surfaces feel scattered, feel passive, and feel like they don't talk to each other — are all downstream of that one root cause: a genuinely unifying view that must be hunted for reads as none of those things.

## Scope

Add `state-of-me.html` to Row's persistent topbar, next to the existing weekly-review button, so it is one tap away from every page rather than hub-only.

That is the entire feature.

### Why the topbar, not a fourth bottom tab

The bottom bar encodes Row's primary mental model: three **domains** (Goals / Health / Fitness). `state-of-me` is not a fourth domain — it is a cross-domain read, structurally the same category as `weekly-review`, which already lives in the topbar for precisely that reason. Adding a fourth tab would dilute a clean three-domain structure and misrepresent what the page is. Matching `weekly-review`'s existing treatment is both the smaller change and the more honest one.

### Why only `state-of-me`

`row-wrapped` (periodic retrospective) and `road-to-pro` (long-horizon goals) are genuinely occasional-use — hub-level access suits them. Promoting all three orphans would recreate the clutter this is meant to reduce. Only the daily-relevant cross-domain read gets promoted.

### Explicitly out of scope

- **Building any new synthesis page or coach surface.** The point of this change is to make an existing surface reachable and then find out, from real use, whether anything more is needed. Building a new unifying view on top of surfaces that can't currently be reached would be solving the wrong problem in the wrong order.
- **Proactive/push delivery** ("the coach tells you what matters today"). A real candidate for later, deliberately deferred — it would be pushing content from a page whose day-to-day usefulness hasn't been evaluated yet, precisely because it's been hard to reach.
- **Changing `state-of-me.html` itself.** Its content is untouched by this spec.
- **Promoting `row-wrapped` / `road-to-pro`.** See above.
- **Removing the existing `index.html` ops chip for `state-of-me`.** Harmless, and the hub remains a legitimate entry point.

## Architecture

All changes are in `topbar.js`. No new files, no changes to `state-of-me.html`, no data or backend changes.

### 1. New topbar link

`topbarHtml` (currently `topbar.js:168-181`) gains one anchor immediately after the existing weekly-review link, reusing the existing `.topbar-review-btn` / `.topbar-review-icon` classes verbatim:

```html
<a href="state-of-me.html" class="topbar-review-btn" id="topbarStateOfMe" aria-label="State of Me">
  <span class="topbar-review-icon">📈</span>
</a>
```

Class reuse is deliberate: `.topbar-review-btn` is already generic secondary-action styling (44×42 button, 12px radius, subtle border/background, hover transition) with its own `@media (max-width: 480px)` rules at `topbar.js:136-137`. Reusing it means the new button is automatically correct at mobile sizes with zero new CSS. Duplicating the ruleset under a `state-of-me`-specific name would add maintenance surface for identical appearance.

The 📈 icon matches the one already used for this destination on the hub's ops chip (`index.html:418`), so the two entry points stay visually consistent.

### 2. Active-tab correctness

`currentPageKey()` (`topbar.js:206-214`) ends with `return 'main'` as a catch-all. Any unrecognized page therefore highlights the **Goals** tab as active — which would be wrong for `state-of-me.html`, marking a cross-domain page as if it were the Goals domain.

Add an explicit case returning `''` (no active tab), matching how `index.html` is already handled at `topbar.js:212`:

```js
if (p.endsWith('state-of-me.html') || p.endsWith('/state-of-me')) return '';
```

Placed before the final `return 'main'`. The `/state-of-me` extensionless variant matches the defensive style every other case in this function already uses (e.g. `p.endsWith('health.html') || p.endsWith('/health')`).

**Note on current behavior:** this is a pre-existing wrong-highlight bug for `state-of-me.html` today, not one introduced here. It matters more once the page is one tap from everywhere, so it's fixed as part of this change rather than left behind.

## Testing

`topbar.js` has no existing test harness (consistent with Row's static-page convention — verified, not assumed). Verification is a manual trace plus real browser checks:

**Manual trace of `currentPageKey()`:**

1. `state-of-me.html` → new case matches → returns `''` → no bottom tab highlighted. Correct.
2. `gym.html` → matches the existing fitness case before reaching the new one → returns `'fitness'`. Unchanged.
3. `main.html` → matches its existing case → returns `'main'`. Unchanged.
4. Some other unrecognized page → falls through to `return 'main'`. Unchanged from today.

**Browser verification (both required):**

- The 📈 button appears in the topbar on `gym.html`, `health.html`, and `main.html`, and navigates to `state-of-me.html`.
- On `state-of-me.html`, no bottom tab shows as active.
- At a mobile viewport (≤480px), the topbar with two secondary buttons doesn't overflow or crowd the mission clock — the one real visual risk of adding a second button to a fixed-width bar, and the specific reason browser verification here isn't optional.

**Known constraint:** the deployed site (`row-sage.vercel.app`) is sign-in gated, and entering credentials is outside what Claude does. If live verification isn't possible in-session, that must be stated plainly as an unverified gap rather than glossed — same disclosure standard applied to the joint-aware substitution nudge earlier today.

## Success criteria

- `state-of-me.html` is one tap from any page in Row, not hub-only.
- No bottom tab falsely highlights while on `state-of-me.html`.
- The topbar remains uncrowded at mobile widths.
- Nothing else in Row's navigation behavior changes.

## Cost

Zero — client-side markup and one conditional. No new requests, no backend, no API spend.

## What this is really for

This is deliberately a small change that buys information. If, after `state-of-me` is genuinely reachable, Row still feels scattered or passive, that is real evidence about what to build next (a proactive surface, a synthesis rewrite, something else) — evidence that can't be gathered today, because the surface in question is effectively hidden. Building the bigger thing first would be guessing.
