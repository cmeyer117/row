# Mobility Pain-Library Expansion — Design

## Problem
`mobility.html`'s Joint Care tab covers 3 areas (Shoulder, Elbow, Knee) with a drill block each, plus a compact 3-row Flare-Up Rules table (one action line per area). Carl wants a full pain-library covering the 7 standard lifting-related areas, each with real causes/avoid/when-to-see-someone content on top of drills — not just his 3 known chronic issues.

## Scope
Expand Joint Care tab coverage from 3 areas to 7: **Shoulder, Elbow, Knee, Hip, Low Back, Wrist, Ankle/Achilles**. Each area gets:
- Drills (existing `mob-ex-row` pattern, new for the 4 new areas)
- Causes (why this area gets cranky for a lifter)
- Avoid (movements/patterns that aggravate it)
- When to see someone (real red-flag symptoms, not just "if it hurts")
- Flare-up action (what to do mid-flare, replaces today's standalone table row)

Self-assessment screen (overhead squat, 90/90, toe touch → auto-flag tight areas → route to drills) is a **separate follow-on spec**, out of scope here. This pass just needs to leave a clean data shape for that phase to route into by area name.

## Data model
New `PAIN_LIBRARY` object in `mobility.html`, next to the existing exercise-list markup, following the same keyed-object convention as `gym.html`'s `DEFAULT_CUES`/`EXERCISE_SLUGS`:

```js
const PAIN_LIBRARY = {
  shoulder: {
    label: 'Shoulder',
    warning: 'Right shoulder — torn posterior labrum. Right-side rotation significantly limited...', // optional, personal flag — only shoulder/elbow/knee have one today
    causes: [
      'Poor T-spine mobility forcing extra rotation through the GH joint',
      // ...
    ],
    drills: [
      { name: 'Cross-body shoulder stretch', dose: '3 × 30 sec, RIGHT side emphasis', detail: 'Pull arm across chest...', note: 'Targets the posterior capsule...' },
      // ... same shape as today's hand-authored mob-ex-row content
    ],
    avoid: [
      'Behind-the-neck pressing',
      // ...
    ],
    whenToSeeSomeone: [
      'Catching, popping, or a feeling of joint shifting/giving way',
      'Night pain unrelieved by position change',
      // ...
    ],
    flareAction: 'Drop to cables/machines. Keep banded ER isometrics. Skip heavy pressing for the session.'
  },
  elbow: { ... },
  knee: { ... },
  hip: { ... },
  lowBack: { ... },
  wrist: { ... },
  ankle: { ... }
};
```

One object, one render path — no per-area copy-pasted HTML. `drills` keeps the exact shape today's hand-authored Shoulder/Elbow/Knee blocks already use, so existing content migrates into the object without a format change.

## UI
One `renderPainLibraryArea(area)` function, called once per `PAIN_LIBRARY` key in a fixed order (Shoulder, Elbow, Knee, Hip, Low Back, Wrist, Ankle), rendering into the existing Joint Care tab (`#section-joints`) — no new tab, no new nav, no new page.

Per area:
1. `mob-block-title` heading (unchanged pattern) + `mob-exercise-list` of `mob-ex-row` drill cards (unchanged visual pattern, now data-driven instead of hand-authored).
2. A new collapsed-by-default accordion block directly below the drills, same `mob-ex-row` chevron-expand affordance already used throughout this page, with four rows: Causes, Avoid, When to See Someone, Flare-Up Action.

The existing standalone "Flare-Up Rules" `mob-card` table (3 rows today) is removed entirely — its content (and the "do not go to zero" framing note + the instability stop-rule) folds into each area's own accordion instead, so there's one place per joint instead of two.

New areas without a personal `warning` (Hip/Low Back/Wrist/Ankle) simply omit that line — same pattern as `getPoster()`'s null-fallback in the `gym.html` exercise-library spec, no broken/empty state.

## Content research
During implementation, each of the 7 areas gets a real research pass (current sports-medicine/physio sources — common lifting-related injury mechanisms, corrective drill selection, genuine red-flag symptoms) before drafting `causes`/`avoid`/`whenToSeeSomeone`/`flareAction`, not written from memory alone. Existing Shoulder/Elbow/Knee drill content and Carl's 3 personal `warning` flags are preserved as-is, just migrated into the new data shape — not rewritten.

## Out of scope
- Self-assessment screen (separate spec, next).
- New SVG diagrams or poster images for the 4 new areas — text-first, same as today's optional-diagram pattern (`mob-ex-diagram`/`mob-ex-photo` stay opt-in per drill, not mandatory).
- Any change to `jointPainTrendWrap`'s pain-logging/trend-chart mechanism.
- Any change to the Daily / Pre-Post-Workout tabs.

## Testing
No build/test framework in this static-HTML app (matches every other `mobility.html`/`gym.html` feature) — manual verification: load `mobility.html`, open Joint Care tab, expand each of the 7 areas' drill list and the new Causes/Avoid/When-to-See-Someone/Flare accordion, confirm content renders and collapses correctly, confirm the removed Flare-Up Rules table is gone with no dangling reference, confirm no layout breakage at mobile width (375px).
