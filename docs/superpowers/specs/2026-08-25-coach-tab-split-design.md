# Coach Tab Split — Design

**Date:** 2026-08-25
**Status:** Approved by Carl
**Scope:** Part A only (structural restructure + content moves). Part B (writing the actual "best form information" content for the Form Coach tab — a mix of new technique cues and existing benchmark data) is out of scope, planned separately.

## Problem

"Coach" is currently a tangle that doesn't match how it's used:

- `coach.html` stacks two iframes (`form-coach.html`, `posing.html`) as scrollable sections, not tabs — you scroll past one to reach the other.
- `form-coach.html` bundles **both** a live posing camera and a live lift camera behind its own internal tab switcher (`section-posing` / `section-lift`), even though the page is titled "Form Coach."
- `posing.html` is a separate page with the actual pose reference content (expandable pose list — cues, focus areas, angle/lighting, photo — plus a practice log and a monthly Judge's-eye readiness check-in) but **no camera at all**.

Net effect: there are two different things both called "Posing Coach" today (a live-camera tool inside `form-coach.html`, and a checklist page at `posing.html`), and they've never been in the same place.

Carl wants, under "Coach": two fully separate tabs — Posing Coach (camera + all poses listed underneath) and Form Coach (camera + form info listed underneath) — not scrolled-together sections, not a tab buried inside a differently-named page.

## Approach

Split the camera code that's currently bundled in `form-coach.html` so each page owns one complete, self-contained coach:

- **`posing.html`** — gains the live posing camera + pose-picker + hold-ring capture flow (moved from `form-coach.html`'s `#section-posing`). Keeps its existing pose list, practice log, and Judge's-eye readiness check-in below the camera, unchanged.
- **`form-coach.html`** — drops the posing section entirely. Keeps its live lift camera + Record Set flow (`#section-lift`'s content, now the whole page). Gains a new form-info section below the camera — **stubbed only** (a placeholder container, no real content) until Part B is planned.
- **`coach.html`** — becomes a real tab switcher (JS-driven show/hide of the two iframes, active-tab styling) in place of today's stacked/scrolled sections. Two tabs: "Posing Coach," "Form Coach."

## Camera lifecycle risk (carried over from today's fix)

`730d13d` (shipped today) fixed exactly this bug at the *internal* tab-switcher level inside `form-coach.html`: switching away from a camera section without calling `stopCamera()` left the outgoing camera running — device light stays on, MediaPipe inference loop keeps executing, and if the other section's camera then also acquires the device, both fight over it.

Splitting into two iframes moves this same risk up one level. `coach.html`'s tab switcher must not just hide the inactive iframe — it must ensure that iframe's camera actually stops. Two options, to be decided during planning:

1. **postMessage teardown** — `coach.html` posts a `stopCamera` message into the outgoing iframe; each page listens and calls its own (already-existing) `stopCamera()` function.
2. **Unload on switch** — clear the inactive iframe's `src` (or remove/re-add the iframe element) when switching away, forcing the browser to tear down its whole JS context including any open camera stream. Simpler, no cross-frame messaging, but reloads the model/camera from scratch on every tab revisit (cost: the WASM/MediaPipe model re-downloads or re-initializes each switch — same tradeoff `03a79c2` deliberately avoided when it gave posing and lift their own independent camera instances instead of sharing one).

Recommendation for the plan: postMessage teardown, since it avoids re-paying the model-load cost on every tab switch (the exact cost `03a79c2` was written to avoid) — call this out explicitly during planning rather than defaulting to the simpler-but-costlier unload approach.

## What's explicitly out of scope

- Writing the Form Coach's actual "best form information" content (Part B — Carl said this needs its own planning pass, mixing new technique-cue writing with surfacing `benchmarks.js`'s existing depth/lockout targets).
- Any change to the underlying camera/scoring logic (`form-coach-logic.js`, `posing-checklists.js`, `benchmarks.js`) beyond moving which page loads which script.
- The still-open HANDOFF backlog item ("Row Posing/Lift-Form Coach Task 5" — on-device speech-to-log verification) — unrelated, not touched by this restructure.
- Renaming files. `form-coach.html`/`posing.html` keep their current names even though `form-coach.html` no longer contains a posing section — a rename risks breaking any existing bookmarks/links/nav references and isn't necessary for the restructure to work.

## Nav

Bottom tabbar currently links to `form-coach.html` directly, labeled "Form Coach." That link should point to `coach.html` instead, relabeled "Coach" — matching the new umbrella page that contains both tabs.

## Testing

Each page (`posing.html`, `form-coach.html`) keeps its own existing self-check (`posing-checklists.selfcheck.cjs`, `form-coach-logic.selfcheck.cjs`) — the underlying logic isn't changing, only which page loads it. `coach.html`'s new tab-switcher and camera-teardown-on-switch behavior needs a live browser verification pass (not exercisable by a Node self-check, since it depends on real `getUserMedia`/device camera state) — flag this explicitly in the plan's verification step.
