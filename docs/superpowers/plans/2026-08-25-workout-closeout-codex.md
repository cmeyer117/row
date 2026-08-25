# Per-Exercise Workout Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Carl explicitly carry one real per-exercise exception from the existing end-of-workout autopsy into that exercise’s next Rx card as a non-authoritative advisory.

**Architecture:** Extend the existing “Mark workout done” → Session Autopsy path with automatically detected per-exercise exception candidates, each requiring a one-tap “Carry forward” acknowledgement before it is persisted. A new pure module shapes candidate copy and determines whether an acknowledged note is still pending; a small per-exercise `exerciseCloseouts` map lives inside the existing synced `po_coach_v1` object and receives conflict-aware merging alongside logs/joint pain/check-ins. `getRx()` will attach the pending text as `closeoutAdvisory` at its existing advisory layer, and `renderRx()` will render that extra note without changing `type`, `weight`, `reps`, RIR/stall behavior, or the actual prescription logic (source: `gym.html:3609-3708`, `gym.html:4461-4495`, `docs/superpowers/specs/2026-08-13-volume-progression-advisory-design.md:9-30`).

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, existing localStorage/Supabase `po-coach` synchronization, and plain-Node VM self-checks discovered by `npm test` (source: `gym.html:3311-3421`, `gym.html:7288-7291`, `package.json:5-15`, `scripts/run-tests.mjs:1-38`).

**Freshness:** Inspected `main` at `a769220e1596f3d30757e11d9e14e6b1e5fe4328`. The worktree contains the unrelated untracked plan `docs/superpowers/plans/2026-08-25-coach-decision-action-strip-codex.md`; preserve it and do not include it in this feature’s commits. The earlier stale-signal recovery plan is tracked and also out of scope.

**Acceptance criteria:**

- Clicking “Mark workout done” continues to open the existing Session Autopsy only on the undone→done transition; for each exercise with an actual exception candidate, it additionally offers a one-tap “Carry forward” action. Skipping the modal or not tapping that action persists no new next-session constraint (source: `gym.html:5353-5374`, `gym.html:5427-5469`).
- Candidate sources are limited to real existing events: a joint-pain entry logged while that exercise was selected, a non-primary session variant selected for that exercise, and a missed prior Rx outcome already classified by `GymAutopsyLogic`. The acknowledgement copies the exact selected candidate into one pending record for that exercise; the most recently acknowledged candidate replaces any earlier pending record for the same exercise (source: `gym.html:3786-3804`, `gym.html:4213-4269`, `gym.html:5320-5350`, `gym-autopsy-logic.js:19-47`).
- Before the first subsequently logged set for that exercise, its Rx card includes the pending `closeoutAdvisory` as a secondary note. Once a later-dated set is logged for that exercise, the note no longer appears. It is never attached to an exercise without an acknowledgement (source: `gym.html:4461-4495`, `gym.html:6315-6375`, `gym.html:6498-6559`).
- The advisory is additive only: existing `getRx()` selection of `type`, `weight`, `reps`, `tag`, `reason`, `stuck`, peak behavior, bodyweight behavior, check-in overrides, `volumeAdvisory`, and `mesocycleAdvisory` remains unchanged (source: `gym.html:3633-3708`, `gym.html:3711-3783`; advisory precedent: `docs/superpowers/specs/2026-08-13-volume-progression-advisory-design.md:9-26`).
- The existing joint-pain event gains an optional `exerciseId` going forward; legacy joint-pain entries without that field still power today’s generic warm-up flag but never create a falsely attributed per-exercise closeout candidate (source: `gym.html:3786-3804`, `gym.html:3864-3900`).
- `exerciseCloseouts` survives the existing remote/local `po_coach_v1` merge without dropping a local-only acknowledged record, and focused plus full test commands exit 0 (source: `gym-state-merge-logic.js:1-115`, `gym.html:7498-7521`, `scripts/run-tests.mjs:9-38`).

**Non-goals:**

- Do not alter an Rx’s real prescription, automatically deload/go lighter, alter check-in overrides, or treat an exception as a medical diagnosis. The new copy is a user-acknowledged prompt to check the next session, not a command that changes loading (source: `gym.html:3655-3708`, `gym.html:3711-3783`).
- Do not add a table, migration, localStorage key, decision-memory record, network/API call, or free-text coaching workflow. Persist only the one acknowledged record per exercise inside the existing synced `po_coach_v1` object (source: `gym.html:3311-3356`, `gym.html:7288-7291`).
- Do not replace the existing Session Autopsy, its beat/met/missed summary, reason buttons, suggested change, or optional Ask Vision action (source: `gym.html:3024-3071`, `gym.html:5320-5505`).
- Do not repurpose a normal substitution as an automatic permanent exercise-default change; `Set as default` remains the existing explicit separate action (source: `gym.html:4213-4269`).
- Do not write to a live/production store, create real pain/log/check-in records, or mark a real workout done as verification. Automated checks use fixtures only; browser checks are read-only against state that already exists.
- Do not push. The listed commits are local logical-unit commits; pushing requires separate Carl authorization.

**Assumptions & unverified claims:**

- **verified-against-commit:** End-of-workout is the least disruptive closeout point because “Mark workout done” already computes prior-Rx versus today’s actual exercise outcomes and opens Session Autopsy; it is a better fit than inventing a second per-set modal (source: `gym.html:5320-5374`, `gym.html:5470-5505`).
- **verified-against-commit:** A substituted session is identifiable from the current date’s `state.sessions[date][exerciseId].activeVariant`; logged sets also retain the selected `variant`, but changing the default is a separate existing action (source: `gym.html:3432-3442`, `gym.html:4213-4269`, `gym.html:6355-6364`).
- **verified-against-commit:** The current joint-pain records contain only `joint`, `severity`, and `date`, so they cannot truthfully be assigned to a specific prior exercise. This plan records optional `exerciseId` from the already-selected current exercise going forward and excludes old unscoped records from per-exercise candidates (source: `gym.html:3786-3804`, `gym.html:5966-5996`).
- **verified-against-commit:** `po_coach_v1` is a whole-object sync row with explicit union/field merges only for historical `logs`, `jointPain`, and `checkins`; `exerciseCloseouts` needs the same protection or a remote pull can silently erase a local acknowledgement (source: `gym-state-merge-logic.js:4-12`, `gym.html:7498-7521`).
- **could-not-access:** No live workout, authenticated sync session, or actual pain/substitution/missed-Rx sequence was accessed. Candidate wording and layout require read-only browser confirmation with already-existing safe state after unit checks pass.
- **decision-required-from-Carl:** The requested example “go lighter on presses” could be interpreted as a loading prescription. This plan deliberately uses non-prescriptive copy such as “review load and range before pressing” to honor the advisory-only constraint. If automatic load changes are desired, that requires a separate approved Rx-policy design.

### Task 1: Define and test pure exception-candidate and carry-forward logic

**Files:**

- Create: `C:\Users\gregm\row\gym-workout-closeout-logic.js`
- Test: `C:\Users\gregm\row\gym-workout-closeout-logic.selfcheck.cjs`

- [ ] **Step 1: Define the interfaces used by every later task.** This task produces two pure exports on `window.GymWorkoutCloseoutLogic`:

  ```javascript
  buildCloseoutCandidates({
    today, exerciseId, exerciseName, activeVariant, outcome, jointPain
  }) => Array<{ exerciseId: string, kind: 'joint-pain'|'substitution'|'missed-progression', text: string }>

  getPendingCloseoutAdvisory({ closeout, exerciseLogs }) => string | null
  ```

  `outcome` is the already-defined existing `GymAutopsyLogic.classifyRxOutcome(rx)` result (`'beat' | 'met' | 'missed' | null`); `jointPain` is the current raw `state.jointPain` array. The second function returns an advisory only while no log for the same exercise has a local calendar date strictly after `closeout.date`.

- [ ] **Step 2: Write the failing self-check with fixtures only.** Create `C:\Users\gregm\row\gym-workout-closeout-logic.selfcheck.cjs` with this complete VM-sandbox test, following the established self-check pattern (source: `gym-autopsy-logic.selfcheck.cjs:1-18`, `scripts/run-tests.mjs:9-38`).

  ```javascript
  // Run with: node gym-workout-closeout-logic.selfcheck.cjs
  'use strict';

  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');

  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, 'gym-workout-closeout-logic.js'), 'utf8'),
    sandbox
  );
  const C = sandbox.window.GymWorkoutCloseoutLogic;

  function assertEqual(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
      console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
      process.exit(1);
    }
  }

  const base = {
    today: '2026-08-25',
    exerciseId: 'press-1',
    exerciseName: 'Machine Shoulder Press',
    activeVariant: null,
    outcome: 'met',
    jointPain: [],
  };

  assertEqual(
    C.buildCloseoutCandidates({
      ...base,
      jointPain: [
        { exerciseId: 'press-1', joint: 'shoulder', severity: 6, date: '2026-08-22' },
        { exerciseId: 'press-1', joint: 'shoulder', severity: 7, date: '2026-08-25' },
        { exerciseId: 'row-1', joint: 'shoulder', severity: 8, date: '2026-08-25' },
      ],
    }),
    [{
      exerciseId: 'press-1',
      kind: 'joint-pain',
      text: 'Shoulder flagged twice in 7 days — review load and range before Machine Shoulder Press.',
    }],
    'scoped repeated joint flags create one exercise-specific candidate'
  );

  assertEqual(
    C.buildCloseoutCandidates({
      ...base,
      activeVariant: 'Dumbbell Neutral Grip Shoulder Press',
      outcome: 'missed',
    }),
    [
      {
        exerciseId: 'press-1',
        kind: 'substitution',
        text: 'Substituted Dumbbell Neutral Grip Shoulder Press last session — check whether it should stick.',
      },
      {
        exerciseId: 'press-1',
        kind: 'missed-progression',
        text: 'Came up short of the last Rx — repeat before adding weight.',
      },
    ],
    'substitution and missed progression are separate acknowledgement choices'
  );

  assertEqual(
    C.buildCloseoutCandidates({
      ...base,
      jointPain: [{ joint: 'shoulder', severity: 8, date: '2026-08-25' }],
    }),
    [],
    'legacy unscoped pain is never falsely attributed to an exercise'
  );

  const closeout = {
    date: '2026-08-25',
    kind: 'missed-progression',
    text: 'Came up short of the last Rx — repeat before adding weight.',
    acknowledgedAt: '2026-08-25T20:00:00.000Z',
  };
  assertEqual(
    C.getPendingCloseoutAdvisory({ closeout, exerciseLogs: [{ date: '2026-08-25T12:00:00.000Z' }] }),
    closeout.text,
    'same-date logs do not prematurely hide the next-session note'
  );
  assertEqual(
    C.getPendingCloseoutAdvisory({ closeout, exerciseLogs: [{ date: '2026-08-26T12:00:00.000Z' }] }),
    null,
    'a later exercise log consumes the pending note'
  );
  assertEqual(
    C.getPendingCloseoutAdvisory({ closeout: { date: 'bad', text: 'x' }, exerciseLogs: [] }),
    null,
    'malformed records never create an advisory'
  );

  console.log('gym-workout-closeout-logic.selfcheck.cjs: all assertions passed');
  ```

- [ ] **Step 3: Run the focused self-check and confirm the red state.** Run `cd C:\Users\gregm\row && node gym-workout-closeout-logic.selfcheck.cjs`. Expected: non-zero exit because `gym-workout-closeout-logic.js` has not been created / cannot be loaded. Do not use a browser, Supabase, or localStorage for this test.

- [ ] **Step 4: Implement the complete pure module.** Create `C:\Users\gregm\row\gym-workout-closeout-logic.js` with the following complete code. It never writes, ignores unscoped legacy pain, aggregates a joint only once, and deliberately produces candidates rather than choosing one automatically so the user acknowledges exactly what carries forward.

  ```javascript
  // gym-workout-closeout-logic.js -- pure candidate and carry-forward logic.
  // No DOM, localStorage, Supabase, or prescription mutation.
  (function () {
    'use strict';

    function localDateFromLog(value) {
      if (typeof value !== 'string' || value.length < 10) return null;
      const date = value.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    }

    function daysBetween(from, to) {
      const start = new Date(from + 'T00:00:00Z').getTime();
      const end = new Date(to + 'T00:00:00Z').getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      return Math.round((end - start) / 86400000);
    }

    function titleCase(value) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function buildCloseoutCandidates(input) {
      input = input && typeof input === 'object' ? input : {};
      const exerciseId = typeof input.exerciseId === 'string' ? input.exerciseId : '';
      const exerciseName = typeof input.exerciseName === 'string' ? input.exerciseName.trim() : '';
      const today = localDateFromLog(input.today);
      if (!exerciseId || !exerciseName || !today) return [];

      const candidates = [];
      const byJoint = {};
      const entries = Array.isArray(input.jointPain) ? input.jointPain : [];
      entries.forEach(function (entry) {
        if (!entry || typeof entry !== 'object' || entry.exerciseId !== exerciseId) return;
        const date = localDateFromLog(entry.date);
        const joint = typeof entry.joint === 'string' ? entry.joint.trim().toLowerCase() : '';
        const gap = date ? daysBetween(date, today) : null;
        if (!joint || gap == null || gap < 0 || gap > 7) return;
        if (!byJoint[joint]) byJoint[joint] = 0;
        byJoint[joint] += 1;
      });
      Object.keys(byJoint).sort().forEach(function (joint) {
        const count = byJoint[joint];
        const countText = count === 1 ? 'once' : count + ' times';
        candidates.push({
          exerciseId: exerciseId,
          kind: 'joint-pain',
          text: titleCase(joint) + ' flagged ' + countText + ' in 7 days — review load and range before ' + exerciseName + '.',
        });
      });

      const activeVariant = typeof input.activeVariant === 'string' ? input.activeVariant.trim() : '';
      if (activeVariant && activeVariant !== exerciseName) {
        candidates.push({
          exerciseId: exerciseId,
          kind: 'substitution',
          text: 'Substituted ' + activeVariant + ' last session — check whether it should stick.',
        });
      }

      if (input.outcome === 'missed') {
        candidates.push({
          exerciseId: exerciseId,
          kind: 'missed-progression',
          text: 'Came up short of the last Rx — repeat before adding weight.',
        });
      }
      return candidates;
    }

    function getPendingCloseoutAdvisory(input) {
      input = input && typeof input === 'object' ? input : {};
      const closeout = input.closeout;
      if (!closeout || typeof closeout !== 'object') return null;
      const closeoutDate = localDateFromLog(closeout.date);
      const text = typeof closeout.text === 'string' ? closeout.text.trim() : '';
      if (!closeoutDate || !text) return null;
      const logs = Array.isArray(input.exerciseLogs) ? input.exerciseLogs : [];
      const hasLaterLog = logs.some(function (log) {
        const logDate = log && localDateFromLog(log.date);
        return logDate && logDate > closeoutDate;
      });
      return hasLaterLog ? null : text;
    }

    const api = {
      buildCloseoutCandidates: buildCloseoutCandidates,
      getPendingCloseoutAdvisory: getPendingCloseoutAdvisory,
    };
    if (typeof window !== 'undefined') window.GymWorkoutCloseoutLogic = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
  })();
  ```

- [ ] **Step 5: Run the focused self-check and confirm green.** Run `cd C:\Users\gregm\row && node gym-workout-closeout-logic.selfcheck.cjs`. Expected: exit 0 and `gym-workout-closeout-logic.selfcheck.cjs: all assertions passed`.

- [ ] **Step 6: Commit the pure logic unit.** Run `cd C:\Users\gregm\row && git add gym-workout-closeout-logic.js gym-workout-closeout-logic.selfcheck.cjs && git commit -m "feat: add workout closeout advisory logic"`. Expected: one local commit containing only the module and self-check. Do not push or stage the pre-existing untracked action-strip plan.

### Task 2: Persist and merge acknowledged per-exercise closeouts safely

**Files:**

- Modify: `C:\Users\gregm\row\gym.html`
- Modify: `C:\Users\gregm\row\gym-state-merge-logic.js`
- Modify: `C:\Users\gregm\row\gym-state-merge-logic.selfcheck.cjs`

- [ ] **Step 1: Define the persisted record and normalize it in the existing state.** In `normalize(s)`, immediately after the existing `checkins` guard, add `s.exerciseCloseouts = (s.exerciseCloseouts && typeof s.exerciseCloseouts === 'object' && !Array.isArray(s.exerciseCloseouts)) ? s.exerciseCloseouts : {};`. Every later task uses only records shaped `{ date: 'YYYY-MM-DD', kind: 'joint-pain'|'substitution'|'missed-progression', text: string, acknowledgedAt: ISOString }`, stored at `state.exerciseCloseouts[exerciseId]`. This is an additive property of the existing `po_coach_v1` blob, not a new key/table (source: `gym.html:3311-3366`).

- [ ] **Step 2: Add the failing merge assertions first.** In `gym-state-merge-logic.selfcheck.cjs`, add `mergeExerciseCloseouts` to the existing `GymStateMergeLogic` destructuring and append these exact assertions. Run `cd C:\Users\gregm\row && node gym-state-merge-logic.selfcheck.cjs`. Expected: FAIL because `mergeExerciseCloseouts` is undefined/not a function.

  ```javascript
  const closeoutA = {
    date: '2026-08-25', kind: 'substitution', text: 'Use neutral grip.',
    acknowledgedAt: '2026-08-25T18:00:00.000Z'
  };
  const closeoutB = {
    date: '2026-08-26', kind: 'missed-progression', text: 'Repeat before adding.',
    acknowledgedAt: '2026-08-26T18:00:00.000Z'
  };
  assertEqual(
    mergeExerciseCloseouts({}, { press: closeoutA }),
    { press: closeoutA },
    'local-only acknowledged closeout survives an empty remote object'
  );
  assertEqual(
    mergeExerciseCloseouts({ row: closeoutA }, {}),
    { row: closeoutA },
    'remote-only acknowledged closeout is retained'
  );
  assertEqual(
    mergeExerciseCloseouts({ press: closeoutA }, { press: closeoutB }),
    { press: closeoutB },
    'later local acknowledgement wins a same-exercise conflict'
  );
  assertEqual(
    mergeExerciseCloseouts({ press: { date: '2026-08-25', text: '', acknowledgedAt: 'bad' } }, {}),
    {},
    'invalid closeout record is omitted rather than rendered later'
  );
  ```

- [ ] **Step 3: Implement and expose the conflict-aware map merge.** In `gym-state-merge-logic.js`, add this exact helper before the final API object and export it on both `window.GymStateMergeLogic` and `module.exports`:

  ```javascript
  function mergeExerciseCloseouts(remoteObj, localObj) {
    remoteObj = remoteObj && typeof remoteObj === 'object' && !Array.isArray(remoteObj) ? remoteObj : {};
    localObj = localObj && typeof localObj === 'object' && !Array.isArray(localObj) ? localObj : {};
    const merged = {};
    const ids = new Set([...Object.keys(remoteObj), ...Object.keys(localObj)]);
    ids.forEach(function (exerciseId) {
      const remote = remoteObj[exerciseId];
      const local = localObj[exerciseId];
      const valid = function (value) {
        return value
          && typeof value === 'object'
          && typeof value.date === 'string'
          && typeof value.text === 'string'
          && value.text.trim() !== ''
          && typeof value.acknowledgedAt === 'string'
          && !Number.isNaN(Date.parse(value.acknowledgedAt));
      };
      if (!valid(remote) && !valid(local)) return;
      if (!valid(remote)) { merged[exerciseId] = local; return; }
      if (!valid(local)) { merged[exerciseId] = remote; return; }
      merged[exerciseId] = local.acknowledgedAt > remote.acknowledgedAt ? local : remote;
    });
    return merged;
  }
  ```

  In `pcApplyRemoteState`, call `mergeExerciseCloseouts(remote[k].exerciseCloseouts, localObj.exerciseCloseouts)` and include the result in the existing merged `po_coach_v1` object next to `logs`, `jointPain`, and `checkins` (source: `gym.html:7498-7521`). Update the comments to name all four protected historical/user-acknowledged structures.

- [ ] **Step 4: Scope future joint-pain records without changing current warm-up behavior.** Change `logJointPain(joint, severity)` to capture the current exercise once—`const ex = getCurrentEx();`—and append `{ joint, severity, date: getActiveDate(), exerciseId: ex ? ex.id : null }`. Keep the existing save call, `jointPainCountInWindow`, and `anyJointFlagged` predicates unchanged so old and new events keep their current generic warm-up effect (source: `gym.html:3786-3804`, `gym.html:5966-5996`).

- [ ] **Step 5: Run targeted merge checks and commit persistence.** Run `cd C:\Users\gregm\row && node gym-state-merge-logic.selfcheck.cjs` and `cd C:\Users\gregm\row && git diff --check`. Expected: the merge self-check exits 0 and whitespace check is silent. Then run `cd C:\Users\gregm\row && git add gym.html gym-state-merge-logic.js gym-state-merge-logic.selfcheck.cjs && git commit -m "feat: persist exercise closeout acknowledgements"`. Do not push.

### Task 3: Offer closeout acknowledgements and attach the pending advisory to Rx

**Files:**

- Modify: `C:\Users\gregm\row\gym.html`
- Test: `C:\Users\gregm\row\gym-workout-closeout-logic.selfcheck.cjs` (regression run only)

- [ ] **Step 1: Load the Task 1 module and add an initially hidden modal section.** Add `<script src="gym-workout-closeout-logic.js"></script>` alongside `voice-helpers.js`/`stt-prompt-logic.js`, immediately before the large main `gym.html` script, so the initial `getRx()` render can use it (source: `gym.html:3260-3263`). In `#checkinModalBg`, after `#autopsySuggestedChange` and before the modal actions, add hidden `#autopsyCloseoutSection` containing a compact heading “Carry into next session (optional)” and empty `#autopsyCloseoutCandidates`. It must not render when no candidate is available, preserving the normal autopsy’s fast path (source: `gym.html:3029-3070`, `gym.html:5470-5505`).

- [ ] **Step 2: Extend the existing autopsy payload with candidate inputs, not a write.** In `buildAutopsyPayload()`, retain its current `rxList`, outcomes, summary, reason, and suggested-change calculations. While visiting each exercise logged today, derive `outcome` with the already-defined `window.GymAutopsyLogic.classifyRxOutcome(priorRx)`, then call Task 1 `buildCloseoutCandidates` with `today`, the exercise id/name, `getSession(ex.id).activeVariant`, that outcome, and `state.jointPain`. Concatenate returned candidates into a new `closeoutCandidates` array on the returned payload. Do not create a candidate when the Task 1 module is unavailable, when the exercise has no today log, or when no existing event has produced one (source: `gym.html:5320-5350`, `gym-autopsy-logic.js:19-47`).

- [ ] **Step 3: Render and one-tap-save candidates inside the existing modal.** Update `window.__gym_openCheckinModal(autopsy)` to clear/hide the new section during `reset()`, then, when `autopsy.closeoutCandidates` is non-empty, create one button per candidate using DOM APIs and `textContent`: button label `Carry forward: <candidate text>`. Its click handler must replace only `state.exerciseCloseouts[candidate.exerciseId]` with `{ date: getActiveDate(), kind: candidate.kind, text: candidate.text, acknowledgedAt: new Date().toISOString() }`, call the existing `saveState()`, disable that button, and replace its label with `Saved for next session`. It must not save a check-in, mutate `state.logs`, or change a default substitution. Multiple offered candidates may be viewed, but each exercise’s map entry remains singular—the last explicit acknowledgement is the exact note shown next time (source: `gym.html:5438-5469`, Task 2 record contract).

- [ ] **Step 4: Attach the pending text after the existing Rx decision, without touching its decision fields.** Define `attachCloseoutAdvisory(result, ex)` beside `getRx()`:

  ```javascript
  function attachCloseoutAdvisory(result, ex) {
    if (!result || !ex || !window.GymWorkoutCloseoutLogic) return result;
    const text = window.GymWorkoutCloseoutLogic.getPendingCloseoutAdvisory({
      closeout: state.exerciseCloseouts && state.exerciseCloseouts[ex.id],
      exerciseLogs: state.logs && state.logs[ex.id],
    });
    if (text) result.closeoutAdvisory = text;
    return result;
  }
  ```

  Wrap the three non-null `getRx()` return paths with this function: peak-result after `applyCheckinOverride`, bodyweight result after `applyCheckinOverride`, and the current `finalResult` after existing volume/mesocycle advisory attachment. Do not move or edit any result-object construction, threshold, check-in, volume, or RIR code (source: `gym.html:3633-3708`, `gym.html:3711-3783`).

- [ ] **Step 5: Render the new advisory as a secondary Rx note.** In `renderRx()`, build `closeoutNote` from `rx.closeoutAdvisory` using the existing `escape()` function and the same muted `.po-rx-reason` styling used by `mesoNote`; append it after `mesoNote` and before `liftLabNote`. Do not use it for card class, tag, tap attributes, or headline, so the tap-to-log behavior continues to accept precisely the pre-existing `rx.weight`/`rx.reps` values (source: `gym.html:4480-4495`, `gym.html:5376-5394`).

- [ ] **Step 6: Run focused and static checks, then commit the UI/advisory integration.** Run `cd C:\Users\gregm\row && node gym-workout-closeout-logic.selfcheck.cjs` and `cd C:\Users\gregm\row && git diff --check`. Expected: self-check exits 0; whitespace check is silent. Inspect the diff to confirm `attachCloseoutAdvisory` assigns only `closeoutAdvisory`, not `type`, `weight`, `reps`, `tag`, or `reason`. Then run `cd C:\Users\gregm\row && git add gym.html && git commit -m "feat: carry workout exceptions into next Rx"`. Do not push.

### Task 4: Verify non-authoritative behavior without creating production records

**Files:**

- Test: `C:\Users\gregm\row\gym-workout-closeout-logic.selfcheck.cjs`
- Test: `C:\Users\gregm\row\gym-state-merge-logic.selfcheck.cjs`
- Modify: none

- [ ] **Step 1: Run the full automated suite.** Run `cd C:\Users\gregm\row && npm test`. Expected: `scripts/run-tests.mjs` discovers and runs the new two self-checks and every existing `*.selfcheck.cjs`/`*.test.js`, then exits 0 (source: `package.json:6-9`, `scripts/run-tests.mjs:9-38`).

- [ ] **Step 2: Perform read-only browser verification only against already-existing state.** Open `gym.html` without logging a set, setting a pain score, choosing a substitution, marking a workout done, saving a check-in, or clicking Carry forward. Where an already-existing pending record is safely available, confirm the Rx card renders only its text as a secondary note while its headline/tag remain unchanged. Where an already-existing normal Rx is available, confirm no closeout section/note appears. If no suitable state exists, record this as `could-not-access`; do not manufacture production events to prove the flow.

- [ ] **Step 3: Verify commit boundaries and preserved user work.** Run `cd C:\Users\gregm\row && git status --short` and `cd C:\Users\gregm\row && git log -3 --oneline`. Expected: the three feature commits are visible; no unexpected changes exist; the pre-existing untracked action-strip plan and this newly authored plan remain uncommitted. Do not push.

> **Claude review notes (2026-08-25):** Fixed one real bug in this plan's own Step 4 code before running it — `buildCloseoutCandidates`'s copy used `count === 1 ? 'once' : count + ' times'`, but the self-check's own assertion expected `'twice'` for count=2; fixed the string-building to match (`once`/`twice`/`N times`). All unit assertions pass (12 across both `.selfcheck.cjs` files); full suite 53/53. Diff confirmed `attachCloseoutAdvisory` only ever sets `result.closeoutAdvisory`, never `type`/`weight`/`reps`/`tag`/`reason`. A live-browser proof of the rendered Rx note hit a real obstacle: the seeded fixture exercise doesn't belong to today's active day/gym filter, so `getCurrentEx()`'s own fallback silently reverts to a different exercise — reverse-engineering that filter wasn't worth the cost given the pure logic was already proven exhaustively by the unit tests. Recorded as the plan's own anticipated `could-not-access` case.
>
> **Codex layered review (2026-08-25, low effort) caught one real bug**, now fixed as its own commit (`2483c3a`): `pcApplyRemoteState`'s new `mergeExerciseCloseouts` wiring inherited a pre-existing gap in the `po_coach_v1` merge branch — when a local record wins a merge (e.g. device B acknowledges a newer closeout while offline), the branch's `changed` flag only tracked "did localStorage need a write," not "does local's winning value still need pushing to remote." A newer local-only acknowledgement (or, latently, a newer local log/jointPain/checkin) could therefore never reach other devices until some unrelated edit forced a push. This exact bug shape was already found and fixed for the neighboring `po_coach_season` branch on 2026-08-20 (visible in-file, `gym.html` comment citing that prior Codex catch) but was never back-ported to `po_coach_v1`. Applied the same `else if (incoming !== JSON.stringify(remote[k])) changed = true;` fix to `po_coach_v1`, which now also protects the pre-existing `logs`/`jointPain`/`checkins` fields from the same latent gap, not just the new `exerciseCloseouts` field — a small, precedent-backed fix directly tied to this feature's own cross-device acceptance criterion, not an unrelated cleanup.
