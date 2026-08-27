# Training Trajectory → Gym Coach Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** implement `docs/superpowers/specs/2026-08-27-training-trajectory-coach-integration-design.md` — write `weekly-review.html`'s already-computed `TrainingInsightEngine` findings to `app_state`, read them in Vision, surface them in the gym coach's context with a tone directive.

**Architecture:** Row writes the findings array via a direct authenticated `fetch()` (this page's existing convention — no shared write helper here, unlike Vessel's `window.vesselWrite()`). `packages/capabilities/src/gym.ts` gets a new `fetchTrainingTrajectory()` parallel-fetched alongside the existing recomp/sleep/macro/cardio/flaggedReps fetches. Vision's `fetchGymSummary()` (already `ALWAYS`-gated) surfaces each finding's own `observation` text plus one aggregate tone directive.

**Tech Stack:** Row — plain JS, no test framework for this file (matches the codebase — `weekly-review.html` has no accompanying test, the write itself isn't independently unit-tested, same as its 3 existing reads). `packages/capabilities` + Vision — TypeScript, Vitest, native `C:\` checkouts (`claude-workspace-scratch`), same as the Vessel build earlier today.

---

### Task 1: `packages/capabilities` — `fetchTrainingTrajectory()` in `gym.ts`

**Files:**
- Modify: `C:\Users\gregm\claude-workspace-scratch\packages\capabilities\src\gym.ts`
- Modify: `C:\Users\gregm\claude-workspace-scratch\packages\capabilities\src\gym.test.ts`

- [ ] **Step 1: Confirm the scratch checkout is current**

```bash
cd /c/Users/gregm/claude-workspace-scratch
git status --short
git fetch origin
git log HEAD..origin/master --oneline
```
If behind, `git pull --ff-only origin master` first. Leave any unrelated uncommitted files alone (same posture as earlier today's Vessel build).

- [ ] **Step 2: Write the failing tests**

Add to `packages/capabilities/src/gym.test.ts`, as a new `describe` block after the existing `describe('getGymSummary flaggedReps field', ...)` block:

```ts
describe('getGymSummary trajectory field', () => {
  it('returns findings when the row is well-formed', async () => {
    setPoCoach({ po_coach_weights: [] })
    mocks.appState.set('health', { data: { data: {} }, error: null })
    mocks.foodLog = []
    mocks.appState.set('row:training_trajectory', {
      data: {
        data: {
          findings: [
            { type: 'stalled-load-plateau', severity: 'medium', observation: 'Bench Press: no new load/rep high across 6 exposures.', confidence: 'medium', reviewQuestion: 'Worth a look at Bench Press?' },
          ],
          computedAt: '2026-08-27T12:00:00.000Z',
        },
      },
      error: null,
    })
    const result = await getGymSummary()
    expect(result.trajectory?.findings).toHaveLength(1)
    expect(result.trajectory?.findings[0]?.observation).toContain('Bench Press')
  })

  it('returns undefined when the row is missing', async () => {
    setPoCoach({ po_coach_weights: [] })
    mocks.appState.set('health', { data: { data: {} }, error: null })
    mocks.foodLog = []
    const result = await getGymSummary()
    expect(result.trajectory).toBeUndefined()
  })

  it('drops a malformed individual finding but keeps well-formed ones', async () => {
    setPoCoach({ po_coach_weights: [] })
    mocks.appState.set('health', { data: { data: {} }, error: null })
    mocks.foodLog = []
    mocks.appState.set('row:training_trajectory', {
      data: {
        data: {
          findings: [
            { type: 'missed-session-trend', severity: 'high', observation: 'Session frequency dropped.', confidence: 'medium', reviewQuestion: 'Intentional?' },
            { type: 'volume-phase-mismatch' }, // missing observation/reviewQuestion -- malformed
          ],
          computedAt: '2026-08-27T12:00:00.000Z',
        },
      },
      error: null,
    })
    const result = await getGymSummary()
    expect(result.trajectory?.findings).toHaveLength(1)
    expect(result.trajectory?.findings[0]?.type).toBe('missed-session-trend')
  })

  it('returns undefined when findings is present but empty', async () => {
    setPoCoach({ po_coach_weights: [] })
    mocks.appState.set('health', { data: { data: {} }, error: null })
    mocks.foodLog = []
    mocks.appState.set('row:training_trajectory', { data: { data: { findings: [], computedAt: '2026-08-27T12:00:00.000Z' } }, error: null })
    const result = await getGymSummary()
    expect(result.trajectory).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run to confirm they fail**

```bash
cd /c/Users/gregm/claude-workspace-scratch/packages/capabilities
npx vitest run src/gym.test.ts
```
Expected: the 3 positive-case-relevant tests FAIL (`trajectory` doesn't exist on the type/output yet — TypeScript error, and at runtime `result.trajectory` is always `undefined`). The "missing row" test trivially passes (already `undefined` with nothing implemented).

- [ ] **Step 4: Write the minimal implementation**

Add the type near the top of `gym.ts`, after `FormCoachSession`:

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

Add the fetch function near the other `fetch*` helpers (e.g. after `fetchFlaggedReps`, wherever that's defined):

```ts
async function fetchTrainingTrajectory(): Promise<GymSummaryOutput['trajectory']> {
  try {
    const { data: row } = await getSupabase().from('app_state').select('data').eq('key', 'row:training_trajectory').maybeSingle()
    const d = row?.['data'] as Record<string, unknown> | undefined
    if (!d || !Array.isArray(d['findings'])) return undefined
    // Individual malformed entries are dropped, not the whole read -- one
    // bad finding in an otherwise-good array shouldn't hide the rest.
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

Wire it into the parallel fetch (find the `const [recomp, sleep, macroAdherence, cardioAdherence, flaggedReps] = await Promise.all([...])` block):

```ts
    const [recomp, sleep, macroAdherence, cardioAdherence, flaggedReps, trajectory] = await Promise.all([
      fetchRecomp(weights),
      fetchSleep(),
      fetchMacroAdherence(),
      fetchCardioAdherence(),
      fetchFlaggedReps(),
      fetchTrainingTrajectory(),
    ])
    if (recomp) result.recomp = recomp
    if (sleep) result.sleep = sleep
    if (macroAdherence) result.macroAdherence = macroAdherence
    if (cardioAdherence) result.cardioAdherence = cardioAdherence
    result.flaggedReps = flaggedReps
    if (trajectory) result.trajectory = trajectory
```

- [ ] **Step 5: Run to confirm all pass**

```bash
npx vitest run src/gym.test.ts
```
Expected: all tests PASS, including all 4 new ones and every pre-existing test in the file (unchanged).

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/gregm/claude-workspace-scratch
git add packages/capabilities/src/gym.ts packages/capabilities/src/gym.test.ts
git commit -m "feat(capabilities): add trajectory field to getGymSummary()

Reads the app_state key row/weekly-review.html now writes
(row:training_trajectory) -- TrainingInsightEngine's already-computed
findings (stalled-load, missed-session-trend, volume-phase-mismatch,
recovery-signal). Drops individually malformed findings rather than
the whole read; never throws on a bad shape."
```

---

### Task 2: Vision — surface findings in `fetchGymSummary()`

**Files:**
- Modify: `C:\Users\gregm\claude-workspace-scratch\vision\src\live-data.ts`
- Modify: `C:\Users\gregm\claude-workspace-scratch\vision\src\live-data.test.ts`

- [ ] **Step 1: Vendor the capabilities change into Vision**

```bash
cd /c/Users/gregm/claude-workspace-scratch/vision
npx tsx scripts/vendor-capabilities.ts
```
Expected: `Vendored 13 files from packages/capabilities/src into vision/src/_capabilities`.

- [ ] **Step 2: Write the failing tests**

Add to `vision/src/live-data.test.ts`, right after the existing `'gym domain: omits a form-flag line when flaggedReps is an empty array'` test:

```ts
  it('gym domain: includes each training-trajectory finding plus one aggregate tone directive', async () => {
    getGymSummaryMock.mockResolvedValue({
      trajectory: {
        findings: [
          { type: 'stalled-load-plateau', severity: 'medium', observation: 'Bench Press: no new load/rep high across 6 exposures.', confidence: 'medium', reviewQuestion: 'Worth a look?' },
          { type: 'missed-session-trend', severity: 'high', observation: 'Session frequency dropped from ~4/week to ~1.5/week.', confidence: 'medium', reviewQuestion: 'Intentional?' },
        ],
        computedAt: '2026-08-27T12:00:00.000Z',
      },
    })
    const result = await getLiveData('gym', 'how is my bench looking')
    expect(result).toContain('Training signal: Bench Press: no new load/rep high across 6 exposures.')
    expect(result).toContain('Training signal: Session frequency dropped from ~4/week to ~1.5/week.')
    expect(result).toContain('go easier this turn')
  })

  it('gym domain: adds no training-trajectory lines when trajectory is absent', async () => {
    getGymSummaryMock.mockResolvedValue({ bodyWeight: { latest: { dateKey: '2026-08-01', weight: 200 } } })
    const result = await getLiveData('gym', 'how is my bench looking')
    expect(result).not.toContain('Training signal')
    expect(result).not.toContain('go easier this turn')
  })
```

- [ ] **Step 3: Run to confirm they fail**

```bash
cd /c/Users/gregm/claude-workspace-scratch/vision
npx vitest run src/live-data.test.ts
```
Expected: the positive-case test FAILS (`fetchGymSummary` doesn't read `g.trajectory` yet). The negative-case test trivially passes.

- [ ] **Step 4: Write the minimal implementation**

Edit `fetchGymSummary()` in `vision/src/live-data.ts` — add this block after the existing `flaggedReps` loop, before the final `return`:

```ts
  if (g.trajectory?.findings.length) {
    for (const f of g.trajectory.findings) parts.push(`Training signal: ${f.observation}`)
    parts.push('At least one training-trajectory signal is active this week -- go easier this turn, ask rather than push (e.g. about technique, recovery, or schedule), don\'t default to "push harder."')
  }
```

- [ ] **Step 5: Run to confirm all pass**

```bash
npx vitest run src/live-data.test.ts
```
Expected: all tests PASS, including both new ones and the full existing gym-domain suite (unchanged).

- [ ] **Step 6: Full test suite + typecheck**

```bash
npx vitest run
npx tsc --noEmit
```
Expected: clean, all tests pass (should be 498 — the 496 from before today's Vessel build plus these 2 new ones; the Vessel-build tests already merged into this checkout).

- [ ] **Step 7: Commit**

```bash
cd /c/Users/gregm/claude-workspace-scratch
git add vision/src/live-data.ts vision/src/live-data.test.ts
git commit -m "feat(vision): gym coach reads Row's training-trajectory findings

Extends fetchGymSummary() (already ALWAYS-gated) with each finding's
own observation text plus one aggregate tone directive. One shared
directive rather than per-finding-type copy -- the 4 finding types
can co-occur, and each already carries its own specific
reviewQuestion; a second layer of type-specific tone guidance would
be redundant with that."
```

**Note:** `src/_capabilities/` (vendored output from Step 1) is gitignored, regenerated on every real deploy.

---

### Task 3: Row — write the findings

**Files:**
- Modify: `C:\Users\gregm\row\weekly-review.html`

- [ ] **Step 1: Confirm the anchor text is unchanged**

Read `weekly-review.html` around the `runInsightEngine` call fresh before editing — confirm this exact sequence is still present:

```js
      const findings = window.TrainingInsightEngine.runInsightEngine({
        exercises: exposuresByName,
        sessionDates: sessionDates,
        weeklySets: weeklySets,
        phase: phase,
        sleepEntries: allSleepEntries,
        now: nowRef,
      });

      if (findings.length) {
```

If it's drifted, stop and report the actual surrounding text instead of guessing where to splice.

- [ ] **Step 2: Add the write**

Insert immediately after the `runInsightEngine(...)` call closes (`});`) and before the existing `if (findings.length) {` line that builds `findingsHtml`:

```js
      const findings = window.TrainingInsightEngine.runInsightEngine({
        exercises: exposuresByName,
        sessionDates: sessionDates,
        weeklySets: weeklySets,
        phase: phase,
        sleepEntries: allSleepEntries,
        now: nowRef,
      });

      // Feed the gym coach -- see docs/superpowers/specs/
      // 2026-08-27-training-trajectory-coach-integration-design.md.
      // Best-effort: never blocks the findingsHtml render below. Skips
      // the write on an empty result -- see the spec for why an empty
      // week shouldn't overwrite a still-relevant prior finding.
      if (findings.length > 0) {
        try {
          const trajectoryToken = await window.RowAuth.getAccessToken();
          await fetch(window.SUPABASE_CONFIG.URL + '/rest/v1/app_state', {
            method: 'POST',
            headers: {
              apikey: window.SUPABASE_CONFIG.KEY,
              Authorization: 'Bearer ' + trajectoryToken,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
              key: 'row:training_trajectory',
              data: { findings: findings, computedAt: new Date().toISOString() },
            }),
          });
        } catch (e) {
          console.warn('[training-trajectory] failed to write for the gym coach:', e);
        }
      }

      if (findings.length) {
```

(`trajectoryToken` rather than `token` — this file's existing 3 reads each declare their own locally-scoped `const token`, so a 4th `const token` at the same enclosing scope would collide. Check the actual surrounding scope when editing; rename if needed to whatever avoids a real collision.)

- [ ] **Step 3: Commit**

```bash
cd /c/Users/gregm/row
git add weekly-review.html
git commit -m "feat(training-trajectory): write findings for the gym coach to read

Phase 2 of the training-trajectory spec. TrainingInsightEngine's
findings were already computed here for the page's own rendering --
this adds one write so Vision's gym coach can read them too, via the
same authenticated-fetch pattern this page already uses for its 3
reads."
```

---

### Task 4: Verify live + push everything

**Files:** none (verification + git operations)

- [ ] **Step 1: Live-verify Row's write**

Start a local preview of `row` (`.claude/launch.json` already has a `row` config, port 5555, same pattern used for Vessel's `today.html`/`prayer.html` checks earlier today). Navigate to `weekly-review.html`. Since real login/data won't be available in a bare local preview, verify via `javascript_tool` module injection — same technique used for Vessel: inject a script that imports `TrainingInsightEngine`, calls `runInsightEngine()` with fabricated input guaranteed to produce at least one finding (e.g. a `sessionDates` array showing a real week-over-week drop), stub `window.RowAuth.getAccessToken` and `fetch` to capture the call instead of hitting real Supabase, and confirm the captured request body has `key: 'row:training_trajectory'` and a non-empty `findings` array. Also confirm a fabricated *empty*-findings case makes zero write calls.

- [ ] **Step 2: Push scratch, sync Drive, push Row**

```bash
cd /c/Users/gregm/claude-workspace-scratch
git fetch origin && git log HEAD..origin/master --oneline
git push origin master
```

```bash
cd "/g/My Drive/Claude"
git fetch origin
git log HEAD..origin/master --oneline
```
If it shows exactly the 2 expected commits (Tasks 1-2) plus nothing unexpected: `git merge --ff-only origin/master`. If anything else, stop and check before merging.

```bash
cd /c/Users/gregm/row
git fetch origin && git log HEAD..origin/main --oneline
git push origin main
```

---

## Self-Review

**Spec coverage:** Task 1 = spec's `packages/capabilities/src/gym.ts` section. Task 2 = spec's `vision/src/live-data.ts` section. Task 3 = spec's Row-write section. Task 4 = deployment/verification mechanics, same shape as the Vessel plan's Task 4.

**Placeholder scan:** no TBD/TODO. Every step has complete, real code.

**Type/name consistency:** `TrainingFinding` (`type`/`severity`/`observation`/`confidence`/`reviewQuestion`/`exercise?`) defined once in Task 1 and referenced identically in Task 2's test mocks and Task 3's write payload shape (matching what `runInsightEngine()` actually returns, confirmed by reading `training-insight-engine.js`'s real return statements during brainstorming). The `app_state` key `row:training_trajectory` is the same literal string in Task 1's read and Task 3's write.

**Known ambiguity flagged inline (not hidden):** Task 3 Step 2 can't guarantee `token` vs `trajectoryToken` won't collide without reading the file fresh at edit time — called out explicitly rather than asserting certainty about code not yet re-read.
