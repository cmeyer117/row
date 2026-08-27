# Training Trajectory → Gym Coach Integration — Design Spec

**Date:** 2026-08-27
**Status:** Approved, ready for implementation plan
**Origin:** Direct Row-side counterpart to `vessel/docs/superpowers/specs/2026-08-27-spiritual-season-coach-integration-design.md` (built same day) — closes the same four-model convergence finding (`G:\My Drive\Claude\Claude Outputs\2026-08-26-four-model-ideation-synthesis.md`: "persistent state that actually shapes what the coach says") for the gym domain.

## Problem

Row's `training-insight-engine.js` already computes real, well-designed training-trajectory signals (stalled-load regression/plateau, missed-session trend, volume/phase mismatch, recovery signal) — statistically guarded (confidence tiers, baseline-vs-recent windows, deload detection so a planned deload isn't misread as a regression) with genuinely good human-readable `observation` and `reviewQuestion` text per finding. But it's only ever wired into `weekly-review.html`'s own rendering — Vision's gym coach has zero access to it, so the coach's tone stays flat regardless of whether training is stalling, sessions have dropped off, or recovery is the real bottleneck. Same shape of gap as Vessel's Spiritual Season had before its own Phase 2 (built earlier today).

## Scope

Two repos, one small change each — same architecture as the Vessel build:
1. **Row**: write the already-computed findings to a new `app_state` key.
2. **Vision**: read that key, surface each finding's own observation text plus one aggregate tone directive.

No new detection logic, no new UI, no new backend service. Reuses `runInsightEngine()`'s exact existing output.

## Design

### 1. Row — write the computed findings

**File:** `row/weekly-review.html`, immediately after the existing `runInsightEngine()` call (around the `const findings = window.TrainingInsightEngine.runInsightEngine({...})` block).

Unlike Vessel (which has a shared `window.vesselWrite()` helper), Row's convention here is a direct authenticated `fetch()` — this page already does 3 reads this exact way via `window.RowAuth.getAccessToken()`. Match it for the write:

```js
if (findings.length > 0) {
  try {
    const token = await window.RowAuth.getAccessToken();
    await fetch(window.SUPABASE_CONFIG.URL + '/rest/v1/app_state', {
      method: 'POST',
      headers: {
        apikey: window.SUPABASE_CONFIG.KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        key: 'row:training_trajectory',
        data: { findings, computedAt: new Date().toISOString() },
      }),
    });
  } catch (e) {
    console.warn('[training-trajectory] failed to write for the gym coach:', e);
  }
}
```

**If `findings` is empty** (nothing flagged this run): skip the write, leave the existing row untouched — same reasoning as Vessel's season write. An empty findings array doesn't mean "everything is now fine forever," it means "nothing crossed a threshold on this particular visit"; overwriting a real prior signal with an empty one on every routine re-visit would make the coach lose a still-relevant finding between the moment it was flagged and whenever a genuinely clean week actually happens. (Difference from Vessel's `null`-skips-write case: here `findings` is checked for `.length > 0`, not `null`, since `runInsightEngine()` always returns an array, never `null`.)

**Write failure handling:** best-effort, console-only, never blocks `weekly-review.html`'s own rendering (which already completed using the local `findings` value before this write runs).

**Freshness, deliberately not solved here:** this only refreshes when Carl visits `weekly-review.html`. Not a shortcut — every finding type in `training-insight-engine.js` is itself a weekly-cadence signal by design (recent-vs-baseline comparison windows, the function's own name, `reviewQuestion` phrasing) — same reasoning Vessel's 30-day Spiritual Season window used for not needing daily freshness.

### 2. Vision — read and surface it

**File:** `packages/capabilities/src/gym.ts`

Add a new finding type and extend the output:

```ts
export type TrainingFinding = {
  type: string
  severity: 'low' | 'medium' | 'high'
  observation: string
  confidence: 'low' | 'medium' | 'high'
  reviewQuestion: string
  exercise?: string
}
```

Add `trajectory?: { findings: TrainingFinding[]; computedAt: string }` to `GymSummaryOutput`.

Add a fetch alongside the existing `fetchRecomp`/etc. parallel fetches (see the `Promise.all([...])` around line 310 — same pattern, one more entry):

```ts
async function fetchTrainingTrajectory(): Promise<GymSummaryOutput['trajectory']> {
  try {
    const { data: row } = await getSupabase().from('app_state').select('data').eq('key', 'row:training_trajectory').maybeSingle()
    const d = row?.['data'] as Record<string, unknown> | undefined
    if (!d || !Array.isArray(d['findings'])) return undefined
    // Individual malformed entries are dropped, not the whole read --
    // one bad finding in an otherwise-good array shouldn't hide the rest.
    const findings = (d['findings'] as unknown[]).filter(
      (f): f is TrainingFinding =>
        !!f && typeof f === 'object' &&
        typeof (f as Record<string, unknown>)['type'] === 'string' &&
        typeof (f as Record<string, unknown>)['observation'] === 'string' &&
        typeof (f as Record<string, unknown>)['reviewQuestion'] === 'string'
    )
    if (findings.length === 0) return undefined
    return { findings, computedAt: d['computedAt'] as string }
  } catch {
    return undefined
  }
}
```

**File:** `vision/src/live-data.ts`

Extend `fetchGymSummary()` — this is a straight addition to the existing function (not a separate new fetcher, since it's already `ALWAYS`-gated and this data belongs in the same summary):

```ts
  if (g.trajectory?.findings.length) {
    for (const f of g.trajectory.findings) parts.push(`Training signal: ${f.observation}`)
    parts.push('At least one training-trajectory signal is active this week -- go easier this turn, ask rather than push (e.g. about technique, recovery, or schedule), don\'t default to "push harder."')
  }
```

Placed after the existing `flaggedReps` block, before the final `return`. Every finding's own `observation` text is surfaced verbatim (already well-written, no need to re-synthesize per-type copy the way Vessel's two-label season needed fresh prose) — the one added sentence is the aggregate tone directive, matching Vessel's pattern of embedding guidance directly in the fetched text since `buildPrompt()` has no separate tone channel.

**Why one aggregate directive instead of per-finding-type tone copy:** the four finding types can co-occur, and `training-insight-engine.js`'s own `reviewQuestion` field per finding already carries a natural, specific prompt ("has technique, effort, or recovery around this lift changed recently?") — duplicating type-specific tone guidance on top would be redundant with what's already in the text. One shared "go easier, ask don't push" note covers the actual behavioral change needed regardless of which specific signal(s) fired.

### Error handling

Identical posture to every other fetcher/write in this pipeline (Vessel's Phase 2, the existing `recomp`/`sleep`/`macroAdherence` fetches in this same file): a Supabase error, missing row, or malformed shape returns `undefined`/skips silently, never blocks the coach turn or `weekly-review.html`'s render.

### Testing

**`packages/capabilities/src/gym.test.ts`** (already exists — extend it, matching its existing mock-chain style):
- `fetchTrainingTrajectory` returns findings when the row is well-formed
- Returns `undefined` when the row is missing
- Drops a malformed individual finding but keeps well-formed ones in the same array
- Returns `undefined` when `findings` is present but empty

**`vision/src/live-data.test.ts`** (extend the existing `fetchGymSummary` test block):
- Includes each finding's `observation` text when `g.trajectory.findings` is non-empty
- Includes the aggregate tone directive when at least one finding is present
- Adds neither when `g.trajectory` is absent (no regression on the existing gym-summary tests)

## Files Touched

- Edit: `row/weekly-review.html` (findings write, added to the existing computation block)
- Edit: `packages/capabilities/src/gym.ts` (new `TrainingFinding` type, `trajectory` field, `fetchTrainingTrajectory()`)
- New or edit: `packages/capabilities/src/gym.test.ts`
- Edit: `vision/src/live-data.ts` (`fetchGymSummary()` extended)
- Edit: `vision/src/live-data.test.ts`
