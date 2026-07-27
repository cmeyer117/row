# Hype Audio × Row Fusion — Rest-Timer Clips + PR Rants

Date: 2026-07-27
Status: Approved, ready for planning

## Context

Third item on the hype-audio vision batch (Fable brainstorm, 2026-07-26; items #1-2 already shipped: gym-proof playback, moment modes). This is the first cross-app fusion: wiring hype-audio clip playback into Row's `gym.html` at the two moments in a workout where it fits naturally — rest between sets, and hitting a PR.

Both integration points already exist and require no new backend/schema work:

- **Rest timer**: `startRestTimer(ex)` (gym.html:4875) fires immediately after every logged set from the main **Log Set** button (gym.html:5276), tracked via `restTimerEndAt`/`restTimerBar`. The separate **quick-log** text-entry path (`quickLog()`, gym.html:~5414-5427) also classifies events but does *not* call `startRestTimer` today — it never shows the rest timer bar at all. That's existing behavior, not something this spec changes: these new buttons only ever appear on the main Log Set flow, same as the rest timer bar itself already only appears there.
- **PR detection**: `GymWorkoutEvents.classifyWorkoutEvent(entry, priorLogs, ex)` (gym-workout-events.js) already runs at the same moment (gym.html:5271) and returns `'pr'` / `'grind'` / `'miss'` / `null`. Currently its only consumer is `window.__gym.logWorkoutEvent(...)`, which feeds Jarvis's Weekly Coach's Read — no UI feedback exists today. Note the first-ever logged set for an exercise always returns `null` (no prior logs to beat) — there's no PR button on a brand-new exercise's first set, which is correct, not a bug.
- **Playback**: `window.HypeAudio` (hype-audio.js, already loaded in `gym.html`) exposes `pickRandom(filter)` and `playClip(clip)`. `pickRandom` filters by `mentality`/`moment`/`pillar`, AND'd together — it does not fall back internally between filters.
- **Clip pools today**: `moment:'pre_workout'` has 67 tagged clips. `moment:'mid_set'` and `moment:'post_workout'` are both empty. `pillar:'carl'` has 34 tagged clips (nonzero — no fallback needed there).

## Decisions from brainstorming

- **Trigger for both**: manual button tap, not auto-play. Carl's reasoning: he doesn't want playback to cut off music he's already got going mid-workout. He may switch to auto-play later once he's used it a while — the design below keeps that a one-line flip, not a rebuild.
- **Empty `mid_set` pool**: fall back to the existing pillar pool (`iron`/`mindset`/`carl`) rather than shipping a button that silently does nothing. Same pool the existing "🔥 Hype Me Up" button already draws from.
- **PR rant pillar**: `carl` only, per the original vision-batch wording ("PR-triggered Carl-pillar rants"). No fallback needed since the pool is non-empty.

## Design

### 1. Rest-timer hype button

Renders into the existing `.po-rest-timer-actions` row (gym.html:2676-2679, alongside `-15s`/`+15s`/`Skip`) every time the rest timer bar is shown — i.e., after every logged set, not just PRs.

Tap behavior:
```
clip = HypeAudio.pickRandom({ moment: 'mid_set' })
    || HypeAudio.pickRandom({ pillar: ['iron', 'mindset', 'carl'] })
if (clip) HypeAudio.playClip(clip)
```
(`pickRandom` returning `null`/falsy on an empty-filter match is already its documented behavior — confirmed by reading `hype-audio.js`.) If both calls come back empty (e.g. before any hype-audio clips exist at all), show the same alert "Hype Me Up" already shows in that case ("No hype clips yet — add some from the hype-audio app.", gym.html:6036) — reused verbatim, not a silent no-op.

Label/styling: reuse `.po-coach-btn.hype` (same classes as "🔥 Hype Me Up", gym.html:2751) sized to match the existing `.po-rest-timer-adj` buttons it sits next to.

### 2. PR rant button

Renders in the same `.po-rest-timer-actions` row, but only when the `eventType` computed at gym.html:5271 (`GymWorkoutEvents.classifyWorkoutEvent(...)`) is `'pr'` for that log action. Hidden/absent on `'grind'`, `'miss'`, or `null`.

**Wiring note**: `eventType` today is a local variable inside the Log Set click handler — it doesn't reach `startRestTimer(ex)`, which only takes `ex`. This requires a small signature change: `startRestTimer(ex, eventType)`, storing `eventType` in a new module-level `restTimerEventType` var (parallel to the existing `restTimerEndAt`) so the render logic for this button can read it. `stopRestTimer()` resets `restTimerEventType = null` alongside hiding the bar, so a stale PR flag can't leak into the next set's render.

Tap behavior:
```
clip = HypeAudio.pickRandom({ pillar: 'carl' })
if (clip) HypeAudio.playClip(clip)
```

Label: "🏆 PR Rant" — visually distinct from the general hype button so it reads as a specific reward, not a duplicate of the mid-set button. Both buttons are visible at once on a PR set (general hype button + PR button) — they are independent, not mutually exclusive.

### 3. Auto-play toggle (built in, off by default)

A single constant near the top of the relevant script block, e.g.:

```js
const AUTO_PLAY_HYPE = false; // ponytail: flip to true (or wire a settings toggle) to auto-play instead of requiring a tap
```

Both button handlers get factored as plain functions (`playMidSetHype()`, `playPrRant()`) callable either from a click handler or, if `AUTO_PLAY_HYPE` is true, directly at the point `startRestTimer(ex)` / the PR check already run. This keeps "switch to auto later" a one-line flip plus calling the same function eagerly, not new plumbing.

### 4. No backend/schema changes

Everything here is client-side only, reusing `HypeAudio` (hype-audio.js) and `GymWorkoutEvents` (gym-workout-events.js) exactly as they exist today. No new Supabase columns, no new sync keys, no changes to the moment-modes clip schema.

## Known pre-existing quirk, not fixed here

`undoBtn`'s handler (gym.html:5299-5308) doesn't call `stopRestTimer()` — undoing a set today already leaves the rest timer bar running for the set you just undid. These new buttons inherit that same quirk (a PR-rant button could still be tappable for a set that's now been undone). Not introduced by this feature and out of scope to fix here — flagging so it's a known, not a surprise.

## Testing

`gym-workout-events.js` already has `classifyWorkoutEvent` covered by its existing selfcheck — no behavior change there. The new logic (fallback pick order, button visibility gating on `eventType === 'pr'`) is plain functions extractable for a `*.selfcheck.js` following the existing pattern (e.g. `hype-audio.selfcheck.cjs`), covering: mid_set-present case, mid_set-empty-falls-back-to-pillar case, both-empty-shows-alert case, PR button shown only on `'pr'`.

Live-verify at a narrow mobile width that the two buttons plus the existing `-15s`/`+15s`/`Skip` buttons in `.po-rest-timer-actions` don't overflow or crowd out the timer text — that row has fixed gaps and no wrapping rule today.

## Out of scope (this spec)

- Auto-play itself (built as an off-by-default hook, not turned on)
- Tagging any `mid_set` or `post_workout` clips (Carl's task, separate from this build)
- The other two remaining vision-batch items (record-your-own, transcript layer)
