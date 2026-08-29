# Joint-Aware Substitution Nudge — Design Spec

**Date:** 2026-08-29
**Status:** Approved, ready for implementation plan
**Origin:** "Exercise substitution map" from the 2026-08-26 four-model ideation batch (Codex #6). Reframed after auditing the real codebase — see "What changed from the original idea" below.

## Problem

The original idea claimed Row had "nothing for equipment-occupied/injury substitutions." Verified live 2026-08-29: that's not quite true. Row already has, independently:

- Real per-user joint-pain tracking (`state.jointPain`, `{joint, severity, date}` entries, `gym.html:3928`).
- A real flare-up detector, `jointPainCountInWindow(joint, days)` and `anyJointFlagged()` (`gym.html:3939-3950`) — 2+ pain logs for `shoulder`/`elbow`/`knee` within 7 days.
- A real, curated substitution catalog — 37 of the app's exercises carry a `subs: [{name, stars}]` array (star-rated alternatives, e.g. `gym.html:100`).
- A manual "Alt" button next to every exercise with subs, opening a picker modal (`gym.html:4322-4330`, `openSubPicker`).

**None of these are connected in the injury-aware direction.** `anyJointFlagged()` today only forces the warmup section open (`gym.html:4023`) — it has no relationship to the substitution catalog or the Alt button at all. That's the real, narrower gap.

## What changed from the original idea

**Equipment-occupied is cut entirely.** Row has no data source for it anywhere — no sensor, no manual "is this taken" input. Building it means new capture UI, a fundamentally bigger feature than wiring two things that already exist. Cut, not deferred to a later phase of this spec.

**Scope is "wire an existing signal into an existing catalog," not "build a substitution engine."** The signal (flare-up detection) and the catalog (curated subs) both already exist and work; the gap is purely that nothing connects them.

## Scope

When an exercise on today's list has a currently-flagged joint (per `jointPainCountInWindow`) that maps to its muscle group, visually mark its existing "Alt" button to suggest considering a substitution — passive, no new modal, no auto-opening the picker. The picker itself is unchanged: same star-rated list, Carl still picks.

### Joint mapping

Exercises carry a `muscle` field (`Chest`, `Shoulders`, `Triceps`, `Back`, `Biceps`, `Quads`, `Hamstrings`, `Glutes`, `Calves` — confirmed exhaustive via a live grep across the full 37-exercise catalog) but no direct joint tag. `anyJointFlagged`/`jointPainCountInWindow` only ever check `shoulder`/`elbow`/`knee` (the only joints the flare-up mechanism tracks today; `mobility-pain-library.js` additionally covers hip/lowBack/wrist/ankle as static reference content, unrelated to this tracking mechanism).

A small lookup table, no new per-exercise authoring:

```js
const MUSCLE_TO_JOINTS = {
  Chest: ['shoulder', 'elbow'],
  Shoulders: ['shoulder'],
  Triceps: ['elbow'],
  Back: ['shoulder', 'elbow'],
  Biceps: ['elbow'],
  Quads: ['knee'],
  Hamstrings: ['knee'],
  // Glutes and Calves deliberately absent -- verified live against the real
  // catalog that every Glutes exercise here is hip-dominant (Hip Extension,
  // Hip Adduction) and every Calves exercise is ankle-dominant (Calf
  // Raise), neither of which anyJointFlagged tracks. Mapping either to a
  // tracked joint would be a false positive, not a real signal.
};
```

### Detection and rendering

In `renderWorkoutList()` (`gym.html:4242`), alongside the existing `hasSubs` computation (`gym.html:4292`), add:

```js
const joints = MUSCLE_TO_JOINTS[ex.muscle] || [];
const flaggedJoint = joints.find(j => jointPainCountInWindow(j, 7) >= 2);
```

When `hasSubs && flaggedJoint` (in addition to the existing `hasSubs && !isAdhoc` gate at `gym.html:4324`), the Alt button gets a `wl-alt-btn--flagged` class and its text becomes `Alt ⚠` instead of plain `Alt`, with a `title` attribute naming the joint (e.g. `"knee flagged — 2+ times in the last 7 days"`) so the marking isn't a mystery on hover/long-press. No change to the click handler — still opens the same `openSubPicker(ex.id)`.

New CSS, matching the existing `.wl-alt-btn`/`.wl-alt-btn:hover` pattern and reusing the codebase's existing `--warn` variable (already used throughout `gym.html`, not a new color):

```css
.wl-alt-btn--flagged {
  border-color: var(--warn);
  color: var(--warn);
}
.wl-alt-btn--flagged:hover {
  background: rgba(255,255,255,0.04);
}
```

### Explicitly out of scope

- Equipment-occupied (see above — no data source, cut entirely).
- Auto-opening the sub picker, or picking a substitute automatically. Carl decides; this only surfaces that today might be a good day to consider it.
- Adding hip/lowBack/wrist/ankle to the tracked-joint set — that's a change to `anyJointFlagged`'s own scope (which already exists and is used elsewhere, for the warmup section), not something this spec should quietly expand as a side effect.
- Changing `anyJointFlagged()` itself or the warmup-forcing behavior it already drives — this spec adds a second, independent consumer of `jointPainCountInWindow`, it doesn't touch the existing one.

## Testing

`gym.html` is a static page with no build step or existing test harness for this kind of rendering logic (matches the file's own established convention — `openSubPicker`/`renderWorkoutList` etc. have no existing test file either). The `MUSCLE_TO_JOINTS` lookup and the `flaggedJoint` derivation are pure enough to verify with a manual trace over representative cases before committing (mirrors how the Examen mood-inference fix was verified this same session, same file's actual testing convention):

1. Quads exercise, knee flagged (2+ logs in 7 days) → `flaggedJoint === 'knee'`.
2. Quads exercise, knee NOT flagged (0-1 logs) → `flaggedJoint === undefined`.
3. Glutes exercise, knee flagged → `flaggedJoint === undefined` (Glutes isn't in the map at all).
4. Chest exercise, shoulder flagged but elbow not → `flaggedJoint === 'shoulder'` (first match in the joints array).
5. Exercise with no `subs` at all, joint flagged → Alt button stays hidden (existing `hasSubs` gate unchanged, this spec only adds a class when the button is already showing).

## Success criteria

- An exercise whose muscle group maps to a currently-flagged joint gets a visually distinct Alt button when it has real substitution options.
- No behavior change for any exercise whose muscle isn't mapped, or whose joint isn't currently flagged.
- The sub picker itself, `anyJointFlagged()`, and the warmup section are all unchanged.

## Cost

Zero — pure client-side logic and CSS, no new Supabase calls, no new API cost.
