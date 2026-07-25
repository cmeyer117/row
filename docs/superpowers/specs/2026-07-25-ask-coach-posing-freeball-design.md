# Ask Coach upgrade, Posing Coach per-day fix, freeball day tag

Status: approved in conversation 2026-07-25, proceeding to implementation same session.

## Constraint (hard gate)

No new Anthropic API calls. Everything below reads only from local `state`
already in the browser — no `fetch` to Jarvis, no new network calls.

## 1. Ask Coach — show what's actually missing

Current (`gym.html`, `coachBtn` handler): shows `cues[0]` + `getRx().reason`.

`getRx()` (gym.html:3175) already computes a genuinely good progression read —
next target weight/reps, a 3-session stuck-streak deload call, bodyweight-mode
handling. That part doesn't need touching.

The actual gap: only the *first* saved cue displays, and there's no PR
context. Change:
- Show all cues from `getCues(ex.id)`, not just index 0.
- Add one line: distance from this exercise's all-time best set (max weight
  in `state.logs[ex.id]`), e.g. "15lb off your PR" or "This ties your PR."
  Computed from data already in `state.logs`, no schema change.

## 2. Posing Coach — fixed per training day, not a tap-cycle

Current (`gym.html`, `posingCoachBtn` handler): a global `posingPoseIdx`
counter cycles through `DAY_POSE_SLUGS[state.filterDay]` one pose per tap.
Which pose you see depends on how many times you've tapped since the page
loaded, not on today's actual day — that's the "wrong body part" bug.

Fix: drop the cycling counter. On tap, render the *entire* pose pool for
`state.filterDay` at once — one card per pose (name, photo via existing
`assets/mobility/<slug>.png` with graceful fallback, cues), same list style
already used in `posing.html`. Always shows the full, correct set for today's
day, deterministically.

## 3. Freeball day tag — one-off session label

Problem: ad-hoc *exercises* are already easy (`saveAdhocExercise`, existing).
Ad-hoc *days* are not — `state.days` only supports rename/delete via
Settings, no "add a day" path, and warmup/posing/mobility content is keyed
to the 5 fixed day IDs (push/pull/legsA/legsB/upper). A real new permanent
day type would need matching warmup/posing content everywhere, which is out
of scope.

Chosen approach: a lightweight per-session tag, not a new day type.
- New state field: `state.sessionTags[dateKey] = "Shoulders & Arms"` (free
  text, optional). Rides along in the existing `po_coach_v1` sync blob — no
  new Supabase wiring needed.
- `state.filterDay` still picks one of the 5 real days as the base (so
  warmup/posing/mobility content still renders something sensible).
- Small "Tag this session" affordance near the day picker. When set, the tag
  displays instead of the day name in today's log header and in the
  post-workout debrief message sent to Jarvis (so the debrief text reflects
  what you actually did, not just the base day label).
- Clearing the tag reverts to showing the plain day name. No permanent
  state — it's scoped to that date only.

## Out of scope (separate items already tracked)

- 9 missing mobility photos — content/asset task, not code.
- Jarvis passphrase proxy — already shipped and verified this session.
