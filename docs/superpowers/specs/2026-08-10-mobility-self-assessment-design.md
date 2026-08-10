# Mobility Self-Assessment Screen — Design

## Problem
Phase 1 (`row@490c775`) shipped a 7-area pain-library in `mobility.html`'s Joint Care tab (`mobility-pain-library.js`), each area with its own drills. What's missing is a quick self-test that tells Carl *which* areas need attention today and routes him straight to that area's drills — the original ask's "self-assessment screen (overhead squat, 90/90, toe touch, etc.) that auto-flags tight areas and routes to matching drills."

## Scope
One test per `PAIN_LIBRARY` area (7 total), binary pass/fail, self-reported (no camera/MediaPipe measurement — that's a separate, larger build like Row's existing Posing/Form Coach). Lives inside the Joint Care tab, above the pain-library areas, so a failed test can directly expand the matching area's card just below it.

## The 7 tests
Grounded in real screening methods (Physiopedia, physiotutors.com, sports-med sources), one per area:

| Area | Test | Fail criteria |
|---|---|---|
| `shoulder` | Wall overhead reach | Back flat against a wall, raise arms overhead — fail if ribs flare or low back arches off the wall before arms reach vertical |
| `elbow` | Resisted wrist extension (Cozen's-style) | Elbow bent 90°, forearm down, push the back of your hand up against your other hand's resistance — fail if it reproduces outer-elbow pain |
| `knee` | Single-leg squat (flat ground) | Single-leg squat to roughly 60° knee bend — fail if it reproduces pain right below the kneecap |
| `hip` | 90/90 switch | Seated, both knees at 90°, rotate hips side to side — fail if there's pinching/catching, or a clear side-to-side asymmetry |
| `lowBack` | Toe touch | Standing forward fold — fail if it reproduces low-back pain specifically (hamstring tightness alone is normal and not a fail) |
| `wrist` | Palm-flat table lean | Hand flat on a table, fingers pointed back toward you, lean forward — fail if it reproduces wrist pain before a normal stretch sensation |
| `ankle` | Knee-to-wall lunge | Toes ~4 inches from a wall, drive the knee toward the wall without the heel lifting — fail if the heel lifts before the knee reaches the wall |

## Data model
New `mobility-self-assessment.js`, same pure-function pattern as `mobility-pain-library.js` (IIFE, `window.X` + `module.exports`, no DOM):

```js
var SELF_ASSESSMENT = [
  { area: 'shoulder', name: 'Wall overhead reach', instructions: '...', failCriteria: '...' },
  // one entry per area, in the same AREA_ORDER as PAIN_LIBRARY
];
```

A render function produces one card per test (reusing `.mob-card` styling) with a Pass/Fail toggle. A separate pure function `getFailedAreas(results)` takes the results object and returns the array of failed area keys — this is the function `mobility.html` calls to know which `PAIN_LIBRARY` accordions to auto-expand.

## Storage
**New standalone localStorage key, not `po_coach_v1`.** `po_coach_v1` is gym.html's authoritative, cloud-synced app state — it does a full-object replace on every save from gym.html's in-memory `state`, and its existing `jointPain` array only survives that because it has its own dedicated merge function (`mergeJointPain` in `gym-state-merge-logic.js`). Adding a field to `po_coach_v1` from `mobility.html` without equivalent merge-logic integration would risk it being silently dropped the next time `gym.html` saves. That's real scope creep into gym.html's state machine for what's meant to be a `mobility.html`-only feature.

Instead: `mob_self_assessment_v1`, written and read only by `mobility.html`:

```js
{ date: '2026-08-10', results: { shoulder: 'pass', elbow: 'fail', knee: 'pass', hip: 'pass', lowBack: 'fail', wrist: 'pass', ankle: 'pass' } }
```

Persists across visits on this device (matches Carl's ask — "last assessed 3 days ago, hip failed"), just not cloud-synced like `po_coach_v1` is. One entry, overwritten on each new run (not a history array) — a trend chart is out of scope here, unlike the existing Joint Pain Trend which already has its own dedicated 12-week chart.

## UI
New block in `#section-joints`, above the existing shared framing card:
- Collapsed by default: a compact "Run self-assessment" card. If a saved result exists, shows "Last assessed [date] — N/7 passed" with a re-run button instead.
- Expanded: 7 test cards in `AREA_ORDER`, each showing instructions + fail criteria, with Pass/Fail buttons.
- On completing all 7 (last button tapped): save to `mob_self_assessment_v1`, collapse the assessment block back down to its summary state, then for each failed area — add `.expanded` to that area's info-accordion `.mob-ex-row` (the "Causes, avoid list & when to see someone" row already built in Phase 1) and scroll to the first failed area.
- On page load, if any saved result exists (regardless of date — same as the summary card showing "Last assessed 3 days ago"), auto-apply the same expand behavior to failed areas, but without the scroll — a stale result routing you to a card is useful, forcibly scrolling you there on every unrelated page load is not. The scroll-to-first-failed-area only happens right after finishing a fresh run.

## Testing
Same convention as Phase 1: a Node selfcheck (`mobility-self-assessment.selfcheck.cjs`) for the pure data shape, `getFailedAreas()`, and render output — no DOM, no localStorage in the test (that's browser-only). Manual browser verification for the actual toggle/expand/scroll/persistence behavior, matching the existing no-test-framework convention for this static-HTML app.

## Out of scope
- Camera/MediaPipe-based measurement (separate future build).
- A numeric severity scale — binary pass/fail only, per Carl's choice.
- Syncing results to Supabase or into `po_coach_v1`.
- A trend chart for assessment results over time (unlike Joint Pain Trend, which already exists for a different data source).
- Any change to `gym-state-merge-logic.js` or gym.html's state machine.
