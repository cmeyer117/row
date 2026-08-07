# Posing & Lift-Form Coach — Design

**Date:** 2026-08-06
**Status:** Approved by Carl, ready for planning
**Related:** Round 2 vision-scan pick #2 (`Claude Outputs/project-vision-scan-2026-08-06.md`), shared context (`Claude Outputs/2026-08-06-round2-parallel-builds.md` § Session 2). Un-parks Round 1's "AI form check 💰" at $0 cost.

## Problem

Carl wants camera-based feedback on two things Row currently has no tooling for:
1. **Posing** — competition physique poses, judged on stage for the Pro card. `posing.html` already has reference photos (Competition + Content galleries) but no way to compare a live attempt against them.
2. **Lift execution** — "film it and it judges how good I did," across whatever he's training that day.

Constraint: zero paid API/service cost (standing rule) — MediaPipe Pose runs fully client-side (WASM), Apache-2.0, no server round-trip.

## Scope decisions (from brainstorming)

- **Both** posing and lift-form checking are in scope, built as one feature with a shared foundation, in two build passes.
- **All** existing Competition-gallery poses get a live-camera comparison mode (not a 2-3 pose starter set).
- Reference-photo comparison UX: **freeze-and-compare** (full-size live camera while posing; hold the pose to auto-freeze a still, then show it next to the reference photo). Rejected: side-by-side live split (wastes screen), ghost-skeleton AR overlay (real complexity — needs the reference photo's own pose extracted and kept in sync live; not worth it for v1).
- Lift-form scope covers Carl's **actual program** (`gym.html`'s exercise list is almost entirely machine/cable/dumbbell work — Smith Machine Flat Chest Press, Hack Squat, Cable Rows, etc.), not classic free-weight barbell squat/bench/deadlift form checks (knee valgus, bar path) which mostly don't apply on fixed-path machines. Built **generic**: range of motion, tempo/control, stability — criteria that transfer across any exercise, not bespoke per-lift rule sets.
- **Scoring philosophy for lifts: relative to the set's own average, not absolute correctness.** There's no ground-truth "correct" ROM/tempo for a Smith Machine Narrow Grip Bench. The coach flags inconsistency within what you just did (a rep noticeably shorter/faster/less stable than your other reps that set), which is honest about what a camera can judge and still actionable.
- Capture mode: **record, then review** for both posing (freeze-and-compare) and lifts (record set → post-set rundown). Rejected: live real-time feedback during the lift — harder to build reliably (frame drops, false cues mid-rep) and not actually readable while under a bar/machine.
- **Zero edits to `gym.html` or any shared workout-logging file this session** — a parallel session (hands-free voice logging, `2026-08-06-voice-set-logging-design.md`) may be touching it. This build is a fully new, standalone page.
- **No persistence** — v1 is session-only (camera → analysis → on-screen result, nothing written to Supabase). Deliberate cut; add history logging later if the scoring proves useful.

## Architecture

New page, matching Row's existing static-HTML-plus-script-tags pattern (no bundler):

- `form-coach.html` — camera UI, MediaPipe wiring, a segmented control (Posing Coach / Lift-Form Coach), same tab-bar pattern as `gym.html`'s Log/Progress/Volume tabs.
- `form-coach-logic.js` — pure functions only: joint-angle math, symmetry scoring, rep segmentation, ROM/tempo/stability scoring. No DOM, no camera — fully unit-testable.
- `form-coach-logic.selfcheck.cjs` — assert-based test file, matching `gym-volume-logic`'s pattern, with real landmark-input test cases.

MediaPipe's `@mediapipe/tasks-vision` loaded via CDN `<script>` tag, matching `posing.html`'s existing Supabase CDN include. Pose Landmarker runs on a throttled interval (~100-150ms), not every frame.

Posing Coach reads its pose list and reference-photo paths from what already exists in `posing.html`'s Competition gallery — no duplicated image data or hardcoded second copy of the pose list.

The only touch to an existing file, and it's last/optional: a one-line nav link from `posing.html` (or the `index.html` hub tile grid) into `form-coach.html`. Low-risk enough to do even if `gym.html` is mid-flight elsewhere; does not touch `gym.html` itself.

## Posing Coach flow

1. Pick a pose from the Competition gallery list.
2. Full-size live camera view; Pose Landmarker tracks joint angles relevant to that pose (shoulders/elbows/hips/knees, pose-dependent).
3. **Hold detection:** angles stay within a small tolerance band for ~1.5-2s → auto-freeze a still frame. On-screen hold-timer ring shows progress.
4. Freeze screen: captured still next to the reference photo, plus:
   - **Symmetry readout** — left vs. right joint-angle comparison for that pose's relevant landmark pairs, reported as plain language ("left arm 8° higher than right"), not a single opaque score.
   - **Hold time achieved.**
5. "Try Again" re-arms the camera.

Per-pose symmetry criteria (which landmark pairs matter for Front Double Bicep vs. Side Chest, etc.) is a config/data table, not new architecture — adding more poses later is cheap.

## Lift-Form Coach flow

1. Free-text exercise name entry (not wired to `gym.html`'s exercise list — keeps this file fully decoupled).
2. "Record Set" — camera runs live; MediaPipe streams joint landmarks into an in-memory buffer for the duration. No raw video saved, only the landmark stream (keeps this lightweight, no storage/Supabase question to answer).
3. **Rep segmentation:** identify whichever tracked joint moves through the largest range during the set (e.g. wrist for a press pattern, hip for a squat pattern), detect direction reversals to mark rep boundaries.
4. Per-rep scoring against the set's own average:
   - **ROM** — this rep's range vs. the set average → flags noticeably short reps.
   - **Tempo** — eccentric/concentric duration vs. the set average → flags rushed or bounced reps.
   - **Stability** — torso/hip landmark jitter during the rep → flags visible sway/momentum use.
5. Summary screen: rep-by-rep readout (e.g. "Rep 3 — ROM 62% of your average, flagged").

Same `form-coach-logic.js` module as Posing Coach (rep segmentation/scoring are pure functions too).

## Error handling

- Camera permission denied → explicit message + retry button.
- No person / incomplete body in frame → "Step back so your full body is visible," no crash, no false score.
- Browser lacks `getUserMedia`/WASM → graceful "not supported on this device" fallback. Carl's actual gym phone (iPhone Safari) supports both; MediaPipe Tasks Vision explicitly supports Safari.

## Testing

- All scoring/segmentation logic (angle math, symmetry scoring, rep segmentation, ROM/tempo/stability scoring) is pure functions in `form-coach-logic.js`, covered by `form-coach-logic.selfcheck.cjs` with known landmark-input test cases.
- Camera/MediaPipe wiring itself isn't unit-testable (browser API) — verified live in the Browser pane once built, per the project's standing verification rule.

## Explicitly out of scope (v1)

- History/progress tracking over time (no persistence this pass).
- Free-weight-specific form criteria (knee valgus, bar path) — not relevant to Carl's actual machine/cable-heavy program; revisit only if his program ever shifts toward more free-weight compound work.
- Live real-time feedback during a rep/pose (record-then-review only).
- Any edit to `gym.html` beyond an optional one-line nav link, deferred until that file is confirmed clear of the parallel hands-free-logging session.
