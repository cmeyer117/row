# Stale Coach’s Read Recovery Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a stale Coach’s Read’s passive label and narrative with a compact, read-only recovery checklist for weigh-in, today’s sleep, and weekly review, while leaving every fresh read exactly as it appears today.

**Architecture:** Add one pure browser/Node-compatible display-model module that determines whether a valid `weekOf` is more than ten days old and shapes only the three recovery rows from existing log arrays. `index.html` will load that module, add a hidden recovery container inside the existing Coach’s Read card, and switch between the current fresh narrative rendering and the recovery view after its current read-only `app_state['vision:coach_read']` query. No new data is persisted: weight and sleep are parsed from the same localStorage keys already used by Row, and the only new navigation target is the existing `weekly-review.html` (source: `index.html:414-417`, `index.html:615-633`, `index.html:554-573`, `index.html:735-767`).

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, current Supabase JS CDN read, localStorage, plain-Node VM self-checks discovered by `npm test` (source: `index.html:15-22`, `package.json:5-15`, `scripts/run-tests.mjs:1-38`).

**Freshness:** Inspected `main` at `a769220e1596f3d30757e11d9e14e6b1e5fe4328`. The worktree already contains the unrelated untracked plan `docs/superpowers/plans/2026-08-25-coach-decision-action-strip-codex.md`; preserve it and do not include it in this feature’s commits.

**Acceptance criteria:**

- For a Coach’s Read with a valid `weekOf` age of ten days or less, `#coachReadText` displays the exact current `read.narrative`, `#coachReadWeek` displays `· week of <weekOf>`, and no recovery controls are visible (source: `index.html:625-631`).
- For a valid `weekOf` older than ten days, the card displays `· stale (week of <weekOf>)`, hides the old narrative, and shows exactly three compact recovery actions: latest weigh-in status linked to `gym.html`, today’s sleep status linked to the existing `#sleepQuick` widget, and `Open weekly review →` linked to `weekly-review.html` (source: `index.html:399-403`, `index.html:414-417`, `index.html:554-573`, `index.html:735-767`).
- The weight row reports `Weigh-in logged today`, `Last weigh-in: <dateKey>`, or `No weigh-in logged` based on valid existing `{ dateKey, weight }` values; the sleep row reports `Sleep logged today` only when `health:sleep` contains a valid entry dated today, otherwise `Sleep not logged today` (source: `gym.html:3538-3547`, `health.html:1213-1219`, `index.html:744-762`).
- Missing, malformed, or unavailable local values yield the two “not logged” fallback statuses without hiding the stale recovery card or throwing. A missing narrative/read still preserves the current behavior of not showing the card (source: `index.html:622-633`).
- No Supabase write, localStorage write, new storage/sync key, new coach-question model, change to the fresh narrative copy, or change to the existing sleep quick-entry behavior is introduced (source: `index.html:610-633`, `index.html:735-767`, `gym.html:6067-6091`).
- The focused self-check and full `npm test` exit 0 (source: `package.json:6-9`, `scripts/run-tests.mjs:15-38`).

**Non-goals:**

- Do not alter how Vision writes its weekly narrative, the `app_state` query key, RLS/auth, or any `weekly-review.html` decision/closeout behavior. Row’s existing home code only reads `vision:coach_read` and never writes it (source: `index.html:610-633`, `weekly-review.html:71-75`).
- Do not modify the existing fresh card markup/copy or show the stale narrative alongside the recovery checklist (source: `index.html:414-417`, `index.html:625-631`).
- Do not create a dashboard question input or link to Gym’s existing “Ask Coach” action. That action is a local, current-exercise cue/progression response with no free-text question or stable dashboard target, not a weekly-signal recovery workflow (source: `gym.html:2877-2884`, `gym.html:6067-6091`).
- Do not log a weigh-in/sleep entry, create/update a Coach’s Read row, create/close a weekly decision, or invoke any production write as verification. Tests use only in-memory fixtures; browser checks are read-only against pre-existing state.
- Do not push. The commits below are local logical-unit commits; pushing requires separate Carl authorization.

**Assumptions & unverified claims:**

- **verified-against-commit:** `po_coach_weights` is an array of bodyweight entries using `dateKey` and `weight`; current consumers sort by `dateKey` to obtain the latest weight and tolerate absent/invalid arrays (source: `gym.html:3538-3547`, `health.html:1213-1219`). The recovery card intentionally uses only the date as a logging-status signal, avoiding a second unit/weight-formatting convention.
- **verified-against-commit:** `health:sleep` is an array of entries with a local `date` and independently nullable `hours`/`quality`; the home quick entry upserts today’s entry to that same key (source: `index.html:743-762`, `health.html:1257-1274`, `docs/superpowers/specs/2026-08-14-sleep-bridge-design.md:13-18`).
- **verified-against-commit:** The stale threshold is strictly `days > 10`, using `weekOf + 'T00:00:00Z'` and `Math.round`, so the recovery module must preserve that existing boundary rather than changing it to elapsed-hour rounding (source: `index.html:627-630`).
- **verified-against-commit:** Gym has an “Ask Coach” button, but it derives a response from the currently selected exercise, its cues, local logs, and `getRx()` rather than accepting a Coach’s Read question. This plan does not relabel or repurpose it (source: `gym.html:2877-2884`, `gym.html:6067-6091`).
- **external-dependency:** The existing client-side read of `app_state['vision:coach_read']` must remain permitted for an authenticated dashboard session. Repository inspection confirms the query shape but cannot prove deployed Supabase RLS/session behavior (source: `index.html:615-623`).
- **could-not-access:** No live Coach’s Read, authenticated dashboard session, or current production logs were inspected. Final visual spacing and live stale/fresh state need read-only browser verification against already-existing state.

### Task 1: Define and test stale recovery display data

**Files:**

- Create: `C:\Users\gregm\row\coach-read-recovery-logic.js`
- Test: `C:\Users\gregm\row\coach-read-recovery-logic.selfcheck.cjs`

- [ ] **Step 1: Define the module interface for all later tasks.** This task produces `window.CoachReadRecoveryLogic.buildStaleCoachReadRecovery(input)`, where `input` is `{ weekOf, nowMs, today, weights, sleep }`. It returns `null` when the read is not stale; otherwise it returns exactly:

  ```javascript
  {
    weekLabel: '· stale (week of YYYY-MM-DD)',
    weight: { text: 'Weigh-in logged today' | 'Last weigh-in: YYYY-MM-DD' | 'No weigh-in logged', href: 'gym.html' },
    sleep: { text: 'Sleep logged today' | 'Sleep not logged today', href: '#sleepQuick' },
    review: { text: 'Open weekly review →', href: 'weekly-review.html' }
  }
  ```

  `nowMs` is supplied by `index.html` as `Date.now()` and `today` is supplied as its local `YYYY-MM-DD` string, keeping the module deterministic for tests. It consumes no DOM, localStorage, Supabase, or write-capable interface.

- [ ] **Step 2: Write the failing fixture-only self-check.** Create `C:\Users\gregm\row\coach-read-recovery-logic.selfcheck.cjs` using the repository’s VM-sandbox assertion convention (source: `coach-decision-action-strip-logic.selfcheck.cjs:1-20`). Include the following complete file:

  ```javascript
  // Run with: node coach-read-recovery-logic.selfcheck.cjs
  'use strict';

  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');

  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, 'coach-read-recovery-logic.js'), 'utf8'),
    sandbox
  );
  const R = sandbox.window.CoachReadRecoveryLogic;

  function assertEqual(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
      console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
      process.exit(1);
    }
  }

  const TODAY = '2026-08-25';
  const NOW = Date.parse('2026-08-25T12:00:00Z');
  const STALE_WEEK = '2026-08-14';

  const base = {
    weekOf: STALE_WEEK,
    nowMs: NOW,
    today: TODAY,
    weights: [{ dateKey: TODAY, weight: 205.4 }],
    sleep: [{ date: TODAY, hours: 7.5, quality: null }],
  };

  assertEqual(
    R.buildStaleCoachReadRecovery(base),
    {
      weekLabel: '· stale (week of 2026-08-14)',
      weight: { text: 'Weigh-in logged today', href: 'gym.html' },
      sleep: { text: 'Sleep logged today', href: '#sleepQuick' },
      review: { text: 'Open weekly review →', href: 'weekly-review.html' },
    },
    'stale read with today weight and sleep -> complete recovery checklist'
  );

  assertEqual(
    R.buildStaleCoachReadRecovery({
      ...base,
      weekOf: '2026-08-13',
      weights: [{ dateKey: '2026-08-23', weight: 206 }],
      sleep: [],
    }),
    {
      weekLabel: '· stale (week of 2026-08-13)',
      weight: { text: 'Last weigh-in: 2026-08-23', href: 'gym.html' },
      sleep: { text: 'Sleep not logged today', href: '#sleepQuick' },
      review: { text: 'Open weekly review →', href: 'weekly-review.html' },
    },
    'stale read with older weight and no sleep -> actionable missing statuses'
  );

  assertEqual(
    R.buildStaleCoachReadRecovery({ ...base, weekOf: '2026-08-16' }),
    null,
    'exactly ten days old is fresh under the existing days > 10 boundary'
  );

  assertEqual(
    R.buildStaleCoachReadRecovery({
      ...base,
      weekOf: null,
      weights: [{ dateKey: '', weight: 205 }, null, { dateKey: '2026-08-24', weight: null }],
      sleep: 'not-an-array',
    }),
    null,
    'missing weekOf preserves no-stale-state behavior despite malformed logs'
  );

  assertEqual(
    R.buildStaleCoachReadRecovery({
      ...base,
      weights: [{ dateKey: '', weight: 205 }, null, { dateKey: '2026-08-24', weight: null }],
      sleep: 'not-an-array',
    }),
    {
      weekLabel: '· stale (week of 2026-08-14)',
      weight: { text: 'No weigh-in logged', href: 'gym.html' },
      sleep: { text: 'Sleep not logged today', href: '#sleepQuick' },
      review: { text: 'Open weekly review →', href: 'weekly-review.html' },
    },
    'malformed logs do not hide a valid stale recovery checklist'
  );

  console.log('coach-read-recovery-logic.selfcheck.cjs: all assertions passed');
  ```

- [ ] **Step 3: Run the focused self-check to confirm red.** Run `cd C:\Users\gregm\row && node coach-read-recovery-logic.selfcheck.cjs`. Expected: non-zero exit because `coach-read-recovery-logic.js` does not yet exist/cannot be loaded. Do not connect to Supabase, open a browser, or write any log while testing this pure module.

- [ ] **Step 4: Implement the complete pure display-model module.** Create `C:\Users\gregm\row\coach-read-recovery-logic.js` with the following code. It deliberately uses the established `Math.round`/UTC-week parsing threshold from `initCoachRead`, selects latest valid stored `dateKey` lexically, and treats malformed values as absent instead of throwing (source: `index.html:627-630`, `gym.html:3541-3547`).

  ```javascript
  // coach-read-recovery-logic.js -- pure stale Coach's Read recovery model.
  // No DOM, localStorage, Supabase, or mutation.
  (function () {
    'use strict';

    function staleWeekLabel(weekOf, nowMs) {
      if (typeof weekOf !== 'string' || weekOf.trim() === '') return null;
      const weekMs = new Date(weekOf + 'T00:00:00Z').getTime();
      if (!Number.isFinite(weekMs) || !Number.isFinite(nowMs)) return null;
      const days = Math.round((nowMs - weekMs) / 86400000);
      return days > 10 ? '· stale (week of ' + weekOf + ')' : null;
    }

    function latestWeightDate(weights) {
      if (!Array.isArray(weights)) return null;
      const valid = weights.filter(function (entry) {
        return entry
          && typeof entry === 'object'
          && typeof entry.dateKey === 'string'
          && entry.dateKey.trim() !== ''
          && entry.weight != null;
      });
      if (!valid.length) return null;
      valid.sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
      return valid[valid.length - 1].dateKey;
    }

    function hasSleepToday(sleep, today) {
      return Array.isArray(sleep)
        && typeof today === 'string'
        && sleep.some(function (entry) {
          return entry && typeof entry === 'object' && entry.date === today;
        });
    }

    function buildStaleCoachReadRecovery(input) {
      input = input && typeof input === 'object' ? input : {};
      const weekLabel = staleWeekLabel(input.weekOf, input.nowMs);
      if (!weekLabel) return null;

      const latestDate = latestWeightDate(input.weights);
      return {
        weekLabel: weekLabel,
        weight: {
          text: latestDate === input.today
            ? 'Weigh-in logged today'
            : latestDate ? 'Last weigh-in: ' + latestDate : 'No weigh-in logged',
          href: 'gym.html',
        },
        sleep: {
          text: hasSleepToday(input.sleep, input.today) ? 'Sleep logged today' : 'Sleep not logged today',
          href: '#sleepQuick',
        },
        review: { text: 'Open weekly review →', href: 'weekly-review.html' },
      };
    }

    const api = { buildStaleCoachReadRecovery: buildStaleCoachReadRecovery };
    if (typeof window !== 'undefined') window.CoachReadRecoveryLogic = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
  })();
  ```

- [ ] **Step 5: Run the focused self-check to confirm green.** Run `cd C:\Users\gregm\row && node coach-read-recovery-logic.selfcheck.cjs`. Expected: exit 0 and `coach-read-recovery-logic.selfcheck.cjs: all assertions passed`.

- [ ] **Step 6: Commit the isolated model and test.** Run `cd C:\Users\gregm\row && git add coach-read-recovery-logic.js coach-read-recovery-logic.selfcheck.cjs && git commit -m "feat: add stale coach read recovery logic"`. Expected: one local commit containing only the new module and self-check. Do not stage or commit the pre-existing `docs/superpowers/plans/2026-08-25-coach-decision-action-strip-codex.md`.

### Task 2: Render the stale recovery checklist in the existing dashboard card

**Files:**

- Modify: `C:\Users\gregm\row\index.html`
- Test: `C:\Users\gregm\row\coach-read-recovery-logic.selfcheck.cjs` (regression run only)

- [ ] **Step 1: Add the pure module and hidden card container.** Load `<script src="coach-read-recovery-logic.js"></script>` next to the other page-level logic scripts before the dashboard’s inline script (source: `index.html:15-22`). Inside `#coachReadCard`, keep the current `#coachReadText` element unchanged and add an initially hidden `#coachReadRecovery` container containing exactly three anchors: `#coachReadWeight`, `#coachReadSleep`, and `#coachReadReview`. Assign the fixed hrefs defined by Task 1 (`gym.html`, `#sleepQuick`, `weekly-review.html`) in markup; renderer code sets only their `textContent`. This keeps all dynamic values out of `innerHTML` (source: `index.html:414-417`).

- [ ] **Step 2: Add scoped visual treatment without changing fresh-read styles.** Add CSS scoped under `.coach-read-recovery` to make its three links a compact vertical checklist beneath the existing Coach’s Read label: use the same 14px text scale/color family as `.coach-read-text`, 8px row gaps, no bullets, and an accent-colored review row. Do not change `.coach-read-card`, `.coach-read-label`, `.coach-read-week`, or `.coach-read-text`, so the fresh card’s current rendering remains exact (source: `index.html:317-327`).

- [ ] **Step 3: Wire the Task 1 display model into `initCoachRead()`.** Define two local read-only helpers before `initCoachRead()`:

  ```javascript
  function localDateKey() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  function readJsonArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  ```

  Then, after the existing successful `read = data.data` guard, call the Task 1 function with `{ weekOf: read.weekOf, nowMs: Date.now(), today: localDateKey(), weights: readJsonArray('po_coach_weights'), sleep: readJsonArray('health:sleep') }`. The conditional behavior must be exact:

  - If the module is unavailable or it returns `null`, execute the current fresh path unchanged: set `#coachReadText.textContent = read.narrative`; set `#coachReadWeek.textContent` to `· week of <weekOf>` only when `read.weekOf` exists; hide and clear `#coachReadRecovery`; then show `#coachReadCard` (source: `index.html:623-631`).
  - If it returns a recovery model, set `#coachReadWeek.textContent` from `model.weekLabel`; set `#coachReadText.textContent = ''` and hide that element; populate the three recovery anchor texts with `model.weight.text`, `model.sleep.text`, and `model.review.text`; show `#coachReadRecovery`; then show `#coachReadCard`. Do not set `innerHTML`, do not modify the model’s fixed hrefs, and do not call any write-capable code.

  Do not change the existing Supabase query, its early return for missing narrative, or its catch-all failure behavior (source: `index.html:615-633`).

- [ ] **Step 4: Run static and focused regression checks.** Run `cd C:\Users\gregm\row && git diff --check` and `cd C:\Users\gregm\row && node coach-read-recovery-logic.selfcheck.cjs`. Expected: no whitespace errors and the self-check passes. Inspect the diff to confirm it introduces no `localStorage.setItem`, `client.from(...).insert/update/upsert`, `window.recordDecision`, or changes to the `vision:coach_read` query.

- [ ] **Step 5: Commit the dashboard integration.** Run `cd C:\Users\gregm\row && git add index.html && git commit -m "feat: add stale coach read recovery card"`. Expected: one local commit containing only `index.html`. Do not stage or commit the unrelated pre-existing plan file, and do not push.

### Task 3: Verify without manufacturing user or production data

**Files:**

- Test: `C:\Users\gregm\row\coach-read-recovery-logic.selfcheck.cjs`
- Modify: none

- [ ] **Step 1: Run the complete automated suite.** Run `cd C:\Users\gregm\row && npm test`. Expected: `scripts/run-tests.mjs` discovers all `*.selfcheck.cjs`/`*.test.js` files and exits 0, including `coach-read-recovery-logic.selfcheck.cjs` (source: `package.json:6-9`, `scripts/run-tests.mjs:9-38`).

- [ ] **Step 2: Perform read-only browser confirmation only where state already exists.** Open the dashboard without using the weight/sleep Save controls, modifying localStorage, or submitting a weekly review. If an already-existing fresh Coach’s Read is available, confirm its narrative and week text are unchanged. If an already-existing stale read is available, confirm the narrative is absent, all three links/text rows appear, `#sleepQuick` remains the sleep link target, and `weekly-review.html` opens. If either state is unavailable, record it as the known `could-not-access` gap; do not create a real row/log merely to exercise it.

- [ ] **Step 3: Verify handoff state and commit boundaries.** Run `cd C:\Users\gregm\row && git status --short` and `cd C:\Users\gregm\row && git log -2 --oneline`. Expected: the two feature commits are visible; no unexpected changes exist; the already-present `docs/superpowers/plans/2026-08-25-coach-decision-action-strip-codex.md` remains untracked and unmodified. Do not push.

> **Claude review notes (2026-08-25):** Executed as written, no corrections needed. Freshness matched exactly (`a769220`, confirmed idle — the concurrent session's HEAD had not moved since the prior check). All 5 self-check assertions pass; full suite 52/52. Diff confirmed no `localStorage.setItem`/`.insert`/`.update`/`.upsert`/`recordDecision` introduced. No live Coach's Read row exists in this browser preview (unauthenticated, no Supabase session) — recorded as the anticipated **could-not-access** case; the card correctly stays hidden (early-return path, unchanged pre-existing behavior). Verified the actual DOM wiring end-to-end by feeding fixture data through `CoachReadRecoveryLogic` against the real page elements: stale label, hidden narrative, all three recovery rows (weigh-in/sleep/review) with correct text and hrefs, card made visible — matching Task 1's exact expected shape.
