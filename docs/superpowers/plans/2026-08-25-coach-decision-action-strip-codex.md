# This Week's Focus Action Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the active weekly coach decision's one or two concrete cardio/posing actions (or its decision text when no Rx exists) on Row's home dashboard, with links into the existing logging/review flows.

**Architecture:** Add a narrowly scoped active-decision reader beside `getOpenDueDecision()` in `decisions.js`; it uses the same Supabase client/configuration and filters but does not apply the due-date gate needed by weekly-review closeout. Keep extraction and display-model construction in a small pure browser/Node-compatible logic file, then have `index.html` load that file plus `decisions.js`, fetch the latest open `weekly-coach-loop` decision, and render a hidden-until-usable card. The strip is navigation and context only: cardio/posing adherence continues to be calculated from `health:cardio` and `posing:log` by weekly-review, with no checkbox, write, or new persistence path added here (source: `weekly-review.html:249-278`, `weekly-review.html:419-422`).

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Supabase JS CDN via the existing `decisions.js` helper, Node self-checks discovered by `npm test`.

**Freshness:** Inspected `main` at `41a58ddb32dfc7ab3932231f17869d34703b13bb` (clean worktree at inspection).

**Acceptance criteria:**

- On `index.html`, an open `weekly-coach-loop` decision created today and due next week renders a compact “This week's focus” card without requiring a due decision; it shows at most the Cardio and Posing Rx actions when either exists, otherwise the non-empty `decision_text` fallback.
- A structured Rx renders its weekly count and optional guardrail; a legacy non-empty string Rx renders safely; null, malformed, and whitespace-only values produce no blank action row or crash (source data shapes: `weekly-review.html:211-247`, `weekly-review.html:541-543`; legacy compatibility requirement: `docs/superpowers/specs/2026-08-20-structured-weekly-verdicts-design.md:62-69`).
- The Cardio action links to `health.html`, the Posing action links to `posing.html`, and the decision-text fallback links to `weekly-review.html`; the strip writes no state and offers no completion toggle.
- With no active decision, a failed decision query, or a decision with no renderable Rx/text, the card remains absent and the rest of `index.html` continues to load.
- `npm test` exits 0, including the new focused self-check, and a browser check confirms a cardio/posing log made through the existing pages is reflected by weekly-review's current scorecard rather than by a new store (source: `weekly-review.html:273-276`).

**Non-goals:**

- Do not change `getOpenDueDecision()`'s due-date semantics or weekly-review's closeout/readiness flow; it deliberately queries only `review_date IS NULL OR review_date <= today` (source: `decisions.js:31-47`, `weekly-review.html:813-825`).
- Do not add a Supabase table/column, localStorage key, planner, completion checkbox, new scorecard field, new auth model, or `gym.html` duplicate strip. `gym.html` already has a read-only week-status strip and a large independent render path (source: `gym.html:2528-2533`, `gym.html:5214-5267`).
- Do not modify decision creation payloads, Rx verdict persistence, or the existing Cardio/Pose logging pages. Weekly-review currently creates structured Rx objects with `target` and `guardrail` and writes computed closeout verdicts back into those objects (source: `weekly-review.html:530-543`, `weekly-review.html:419-422`).
- Do not push. Commits below are local logical-unit commits; pushing remains Carl-authorized work.

**Assumptions & unverified claims:**

- **verified-against-commit:** The weekly decision category is `weekly-coach-loop`, and weekly-review stores its new row with `review_date` seven days after creation (source: `weekly-review.html:530-543`).
- **verified-against-commit:** The intended adherence sources already exist: weekly-review counts `health:cardio` and `posing:log` within the decision score week (source: `weekly-review.html:249-278`; regression coverage: `weekly-review-scorecard.test.js:90-127`).
- **verified-against-commit:** `getOpenDueDecision()` cannot satisfy an active-this-week surface by itself because it excludes a newly created row until its future `review_date`; preserving that behavior is necessary for weekly-review's closeout gate (source: `decisions.js:31-47`, `weekly-review.html:530-560`). This plan therefore adds `getLatestOpenDecision()` as a sibling using the existing helper/auth pattern rather than changing the due helper.
- **external-dependency:** The deployed `decisions` RLS policy must continue to permit the same client-side read shape already used by weekly-review; this plan can match the source pattern but does not prove live Supabase policy from the repository (source pattern: `weekly-review.html:31`, `weekly-review.html:813-825`).
- **could-not-access:** No real decision row or production dashboard was read during planning, so final copy, visual spacing, and live RLS behavior need browser verification against a non-sensitive real or deliberately created test decision.
- **decision-required-from-Carl:** The feature brief literally names `getOpenDueDecision`, but its verified due-only contract conflicts with showing the newly saved weekly decision throughout that week. This plan recommends the sibling `getLatestOpenDecision()`; approve that contract distinction before implementation, or explicitly accept a strip that appears only once the decision is due.

### Task 1: Add an active open-decision reader without weakening the closeout gate

**Files:**

- Modify: `C:\Users\gregm\row\decisions.js`
- Test: `C:\Users\gregm\row\decisions.js` (manual query-shape inspection; this helper has no existing standalone self-check)

- [ ] **Step 1: Define the sibling helper contract next to the existing due helper.**

  Add `window.getLatestOpenDecision = function (category) { ... }` immediately after `window.getOpenDueDecision`. Its signature is `getLatestOpenDecision(category: string): Promise<Decision|null>`, where `Decision` is the unmodified row returned by Supabase. It must use the same `window.SUPABASE_CONFIG`, CDN `window.supabase.createClient`, `app = 'row'`, requested `category`, `status = 'open'`, descending `created_at`, `limit(1)`, and error-to-`Error` behavior as `getOpenDueDecision` (source: `decisions.js:1-47`). It must intentionally omit only `.or('review_date.is.null,review_date.lte.<today>')`.

  ```javascript
  // Returns the most recently created open decision for a category, whether
  // its review date is still in the future or is already due. Dashboard
  // surfaces use this; weekly-review closeout must keep using
  // getOpenDueDecision().
  window.getLatestOpenDecision = function (category) {
    if (!window.supabase) return Promise.reject(new Error('supabase-js not loaded'));
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return client
      .from('decisions')
      .select('*')
      .eq('app', 'row')
      .eq('category', category)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(function (res) {
        if (res.error) throw new Error('getLatestOpenDecision failed: ' + res.error.message);
        return res.data && res.data[0] ? res.data[0] : null;
      });
  };
  ```

- [ ] **Step 2: Preserve the due-only helper byte-for-byte except for surrounding whitespace.** Confirm `getOpenDueDecision()` still owns the `today` value and its `review_date` `.or(...)` filter, so existing weekly-review calls at `weekly-review.html:560` and `weekly-review.html:815` retain the closeout behavior.

- [ ] **Step 3: Manually verify the query distinction before committing.** In a browser devtools session with the actual Row dashboard auth/config loaded, call both helpers for `weekly-coach-loop` after creating or selecting an open future-dated test decision. Expected result: `getLatestOpenDecision()` returns that row; `getOpenDueDecision()` returns `null` until it is due. Do not edit production data solely for this check; use a disposable non-production/test row only if the environment already provides one.

- [ ] **Step 4: Commit the isolated data-access change locally.** Run:

  ```powershell
  cd C:\Users\gregm\row
  git add decisions.js
  git commit -m "feat: expose latest open coach decision"
  ```

### Task 2: Build and test the pure weekly-focus action extractor

**Files:**

- Create: `C:\Users\gregm\row\coach-decision-action-strip-logic.js`
- Test: `C:\Users\gregm\row\coach-decision-action-strip-logic.selfcheck.cjs`

- [ ] **Step 1: Create the failing self-check for the defined extraction interface.** The module interface is `window.CoachDecisionActionStripLogic.buildWeeklyFocusActions(decision)`, returning an array of zero to two objects shaped as `{ kind, label, text, href }`. `kind` is `cardio`, `posing`, or `decision`; `href` is respectively `health.html`, `posing.html`, or `weekly-review.html`. Write cases for: both structured Rx values with targets/guardrails; one structured Rx; a legacy string Rx; missing or unusable Rx with a non-empty decision-text fallback; missing everything; malformed `details`; and numeric/string target edge cases. Use Row's VM-sandbox self-check convention rather than importing the browser script (source: `coach-snapshot-logic.selfcheck.cjs:1-15`; test discovery: `scripts/run-tests.mjs:1-31`).

  Run the focused check before the implementation exists:

  ```powershell
  cd C:\Users\gregm\row
  node coach-decision-action-strip-logic.selfcheck.cjs
  ```

  Expected result: a non-zero exit and a clear failure because `window.CoachDecisionActionStripLogic`/`buildWeeklyFocusActions` has not yet been supplied. Do not weaken the assertions to make this command pass before the module exists.

- [ ] **Step 2: Implement the complete pure module below.** Keep it DOM-free and Supabase-free. Its Rx formatter deliberately accepts the structured `{ target, guardrail }` payload now written by weekly-review and legacy non-empty string prescriptions, matching the existing `rxInfo()` compatibility behavior (source: `weekly-review.html:211-247`, `weekly-review.html:541-543`). It returns the action copy only; it does not calculate completion, mutate `decision`, or persist any result.

  ```javascript
  // coach-decision-action-strip-logic.js -- pure display-model builder for
  // index.html's active weekly coach-decision strip. No DOM, no Supabase.
  (function () {
    'use strict';

    function cleanText(value) {
      return typeof value === 'string' ? value.trim() : '';
    }

    function numberTarget(value) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        var parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      }
      return null;
    }

    function formatRxAction(kind, rx) {
      var label = kind === 'cardio' ? 'Cardio' : 'Posing';
      var href = kind === 'cardio' ? 'health.html' : 'posing.html';
      var legacy = cleanText(rx);
      if (legacy) return { kind: kind, label: label, text: legacy, href: href };
      if (!rx || typeof rx !== 'object' || Array.isArray(rx)) return null;

      var target = numberTarget(rx.target);
      var guardrail = cleanText(rx.guardrail);
      if (target == null && !guardrail) return null;

      var parts = [];
      if (target != null) parts.push(target + ' session' + (target === 1 ? '' : 's') + ' this week');
      if (guardrail) parts.push(guardrail);
      return { kind: kind, label: label, text: parts.join(' — '), href: href };
    }

    function buildWeeklyFocusActions(decision) {
      if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return [];
      var details = decision.details && typeof decision.details === 'object' && !Array.isArray(decision.details)
        ? decision.details
        : {};
      var actions = [
        formatRxAction('cardio', details.cardio_rx),
        formatRxAction('posing', details.posing_rx)
      ].filter(Boolean);
      if (actions.length) return actions;

      var decisionText = cleanText(decision.decision_text);
      return decisionText
        ? [{ kind: 'decision', label: "This week's decision", text: decisionText, href: 'weekly-review.html' }]
        : [];
    }

    var api = { buildWeeklyFocusActions: buildWeeklyFocusActions };
    if (typeof window !== 'undefined') window.CoachDecisionActionStripLogic = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
  })();
  ```

- [ ] **Step 3: Run the focused test after implementation.** Run:

  ```powershell
  cd C:\Users\gregm\row
  node coach-decision-action-strip-logic.selfcheck.cjs
  ```

  Expected result: exit 0 and the self-check's explicit all-assertions-passed line. Ensure the assertions prove the two-Rx limit and prove decision text is fallback-only (not a third row).

- [ ] **Step 4: Commit the test-backed parsing unit locally.** Run:

  ```powershell
  cd C:\Users\gregm\row
  git add coach-decision-action-strip-logic.js coach-decision-action-strip-logic.selfcheck.cjs
  git commit -m "feat: add weekly focus action extraction"
  ```

### Task 3: Render the compact dashboard strip and reuse existing logging routes

**Files:**

- Modify: `C:\Users\gregm\row\index.html`
- Test: `C:\Users\gregm\row\coach-decision-action-strip-logic.selfcheck.cjs`

- [ ] **Step 1: Load the two prior-task dependencies in `index.html`.** Add classic `<script src="decisions.js"></script>` and `<script src="coach-decision-action-strip-logic.js"></script>` after the existing Supabase CDN/config scripts and before the inline code that will call them. This follows the app's established global-script setup (source: `index.html:15-20`) and lets `decisions.js` receive the same `window.SUPABASE_CONFIG` and `window.supabase` it receives on weekly-review (source: `weekly-review.html:25-31`).

- [ ] **Step 2: Add a hidden, semantic compact card in the dashboard card area.** Place `<section id="weeklyFocusCard" hidden aria-labelledby="weeklyFocusTitle">` directly after `#coachReadCard` in the existing index dashboard card/chip region (source: `index.html:385-395`). Include an `h2` with id `weeklyFocusTitle` and a child `#weeklyFocusActions` list/container. Add scoped CSS using existing dashboard colors, border radius, and spacing; it must wrap long guardrails, remain readable at narrow mobile widths, and not alter the existing ops chips or Coach Read card.

- [ ] **Step 3: Add safe rendering and initialization using only the defined helpers.** In the existing index inline script, define `escapeHtml(value)` and `renderWeeklyFocus(decision)` before registering their use. `renderWeeklyFocus` calls the prior-task `window.CoachDecisionActionStripLogic.buildWeeklyFocusActions(decision)`, leaves `#weeklyFocusCard.hidden = true` for zero actions, and otherwise creates one escaped anchor per action from the returned `{ label, text, href }` data and sets `hidden = false`. Then add an async `initWeeklyFocus()` that awaits `window.getLatestOpenDecision('weekly-coach-loop')`, renders the result, and catches/logs its own error while leaving the card hidden. Call it from the same `DOMContentLoaded` initialization path as the existing dashboard cards. Do not call `RowAuth`, construct a second Supabase client, or query `app_state`: the decisions helper is the matching auth/config path (source: `decisions.js:1-47`; contrast existing unrelated Coach Read query: `index.html:584-605`).

- [ ] **Step 4: Preserve scorecard ownership and validate the user paths manually.** Confirm the strip contains links only—no button listener, checkbox, `localStorage`, `recordDecision`, or `closeDecision` call. In a browser:

  1. With a current open weekly decision containing both structured Rx values, load `index.html`; confirm two rows show and their links go to `health.html` and `posing.html`.
  2. With only a legacy string Rx, confirm one safe readable row; with no Rx but a decision text, confirm one fallback row linking to `weekly-review.html`.
  3. With no active decision or a forced Supabase query error, confirm the card is absent and the rest of the dashboard works.
  4. Log a cardio session and a posing session through the existing linked pages, then open the due decision's weekly-review closeout. Confirm the existing scorecard count/verdict reads the data through `health:cardio` and `posing:log` rather than through any strip state (source: `weekly-review.html:249-278`).

- [ ] **Step 5: Commit the dashboard integration locally.** Run:

  ```powershell
  cd C:\Users\gregm\row
  git add index.html
  git commit -m "feat: surface weekly coach focus on dashboard"
  ```

### Task 4: Run the complete regression suite and perform a diff review

**Files:**

- Test: `C:\Users\gregm\row\coach-decision-action-strip-logic.selfcheck.cjs`
- Test: `C:\Users\gregm\row\weekly-review-scorecard.test.js`
- Test: `C:\Users\gregm\row\scripts\run-tests.mjs`

- [ ] **Step 1: Run all repository checks from the native checkout.** Run:

  ```powershell
  cd C:\Users\gregm\row
  npm test
  ```

  Expected result: every discovered `*.selfcheck.cjs` and `*.test.js` reports `PASS`, including `coach-decision-action-strip-logic.selfcheck.cjs` and `weekly-review-scorecard.test.js`, followed by `<passed>/<total> passed` and exit 0 (runner behavior: `scripts/run-tests.mjs:1-31`).

- [ ] **Step 2: Review the final change boundary before handoff.** Run:

  ```powershell
  cd C:\Users\gregm\row
  git status --short
  git log --oneline -3
  git diff HEAD~3..HEAD -- decisions.js coach-decision-action-strip-logic.js coach-decision-action-strip-logic.selfcheck.cjs index.html
  ```

  Confirm the implementation contains only the helper, pure extraction module/self-check, and index surface; `weekly-review.html` and `gym.html` are unchanged. If there are unrelated pre-existing worktree changes, leave them untouched and report them rather than folding them into these commits.

- [ ] **Step 3: Hand off without pushing.** Record the three local commit SHAs, `npm test` result, and manual browser outcomes in the executor's normal continuity/handoff. Do not run `git push` unless Carl separately authorizes it.
