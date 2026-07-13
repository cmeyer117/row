# Local Ask Coach + Sharpened Composition Estimate

## Problem

Three gym.html features currently call the Jarvis backend (real Claude API tokens per tap) or use unverified made-up constants:

1. **Ask Coach** — sends last 10 sets to Jarvis, asks for a form cue + progression read. Both already exist locally (`DEFAULT_CUES`/`getCues()`, `getRx()`), so the API call is redundant cost.
2. **Composition estimate** (`wtRenderComposition()`) — muscle-gain ceiling uses a fixed lb/week table by training age. Research-verified as a real model (Lyle McDonald), but not the most accurate available — it doesn't scale to the user's actual bodyweight.
3. **Posing Coach** — sends a photo to Jarvis for live vision critique. Requires real vision; can't be made local.

## Changes

### 1. Ask Coach → fully local (gym.html, `coachBtn` handler)
Remove the `askJarvis()` call. Compose the response from:
- A cue from `getCues(ex.id)` (existing per-exercise form-cue data, author-verified by Carl — untouched)
- The `reason` string already produced by `getRx(ex, logs)` (progression read)
Format: `"{cue}. {reason}"` — same directive tone, zero network calls, zero tokens, instant, and reflects the latest logged set every time (both functions read live `state.logs`).

### 2. Composition estimate → blended muscle-gain ceiling (gym-weight-photos.js, `wtRenderComposition()`)
Replace the single fixed-kg-per-training-age table with the **lower of two independent, cited models**, each converted to lb/week:

- **McDonald model** (existing table): 1y→0.45kg, 2y→0.23kg, 3y+→0.11kg per week
- **Aragon/Helms model** (new): % of bodyweight per month — beginner 1.25%, intermediate 0.75%, advanced 0.375% (midpoints of published ranges), ÷ 4.345 to get weekly, × bodyweight in lb

```
maxMusclePerWeek = min(mcdonaldCeilingLb, aragonCeilingLb)
```

Taking the more conservative of the two avoids overestimating muscle-gain potential — two independent models agreeing is stronger evidence than either alone. `strengthBoost` and `frequencyFactor` (existing modifiers scaling within this ceiling) are NOT literature-derived and are left unchanged — they're reasonable engineering heuristics, not claims of their own, and redesigning them "scientifically" isn't achievable for a rough estimate tool like this.

`getRx()` (progression/"Next Session" logic) is validated by research (double progression is a standard, evidence-supported scheme) — left unchanged.

Units: already lb-native throughout (`unitConv`, `state.units`) — no change needed.

### 3. Posing Coach → static checklist (gym.html, posing coach section)
Drop the live photo-upload-to-Jarvis critique. Replace with a static text checklist (per-pose or per-exercise-category cues), consistent with the existing `posing_checks` localStorage pattern. No photo analysis.

**Backlog (not built now):** real vision-based posing critique using Jarvis. Flagged explicitly because it costs real API tokens per use — revisit only if Carl wants that back.

## Out of scope
- No changes to `getRx()`.
- No changes to Ask Coach's cue data (`DEFAULT_CUES`) — Carl-authored, already correct.
- No crons, no scheduled batch jobs — everything computes at request time from local state.
