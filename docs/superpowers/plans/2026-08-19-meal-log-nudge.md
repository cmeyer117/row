# Meal-Log Nudge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fire a push notification at each of Carl's 4 real eating windows (~10:30am, 1pm, 3pm, 7:30pm Eastern) prompting him to log a meal in macros.html, skipping the push if he's already logged enough meals for that point in the day.

**Architecture:** Follows the existing nudge pattern exactly (see `workout`/`morningLaunch` in `api/_lib/nudges.js`): a pure decision function in its own logic module (unit-tested, no I/O), a thin async wrapper in `nudges.js` that does the Supabase read and calls the shared `push()` helper, wired into `send-nudge.js`'s `NUDGES` map, triggered by a GitHub Actions cron workflow that hits the Vercel endpoint.

**Tech Stack:** Node.js (`node:test`/`node:assert/strict` for tests, no framework), Supabase REST (service-role key, same as existing nudges), GitHub Actions cron, existing `web-push` wiring (untouched).

**Spec:** `docs/superpowers/specs/2026-08-19-meal-log-nudge-design.md`

---

### Task 1: Pure decision logic + test

**Files:**
- Create: `api/_lib/meal-log-nudge-logic.js`
- Test: `api/_lib/meal-log-nudge-logic.test.js`

- [ ] **Step 1: Write the failing test**

```js
// api/_lib/meal-log-nudge-logic.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendMealNudge } from './meal-log-nudge-logic.js';

test('shouldSendMealNudge: fewer rows logged today than this meal slot -> true', () => {
  assert.equal(shouldSendMealNudge(0, 1), true); // no meals logged yet, breakfast window
  assert.equal(shouldSendMealNudge(1, 2), true); // 1 logged, lunch window (slot 2)
});

test('shouldSendMealNudge: rows logged today equal to this meal slot -> false (caught up)', () => {
  assert.equal(shouldSendMealNudge(2, 2), false);
});

test('shouldSendMealNudge: rows logged today exceed this meal slot -> false', () => {
  assert.equal(shouldSendMealNudge(4, 2), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api/_lib/meal-log-nudge-logic.test.js`
Expected: FAIL — `Cannot find module './meal-log-nudge-logic.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// api/_lib/meal-log-nudge-logic.js
// Pure function (exported for testing) — no I/O here, mirrors
// workout-nudge-logic.js / macro-drift-logic.js's split.
//
// Coarse heuristic: total food_log rows logged today vs. this cron fire's
// meal-slot index (1=breakfast ... 4=post-gym). Correct enough to decide
// "nudge or not" without nagging on a caught-up day; it does NOT know
// whether the *specific* meal for this window was logged, only the count.
export function shouldSendMealNudge(rowCountToday, mealIndex) {
  return rowCountToday < mealIndex;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api/_lib/meal-log-nudge-logic.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add api/_lib/meal-log-nudge-logic.js api/_lib/meal-log-nudge-logic.test.js
git commit -m "feat: meal-log nudge decision logic"
```

---

### Task 2: Wire the nudge into nudges.js + send-nudge.js

**Files:**
- Modify: `api/_lib/nudges.js`
- Modify: `api/send-nudge.js`

- [ ] **Step 1: Add `fetchFoodLogCount` and `mealLog` to `api/_lib/nudges.js`**

Add the import at the top (alongside the existing logic imports):

```js
import { todayEasternKey } from './workout-nudge-logic.js';
import { shouldSendMealNudge } from './meal-log-nudge-logic.js';
```

Add this helper near `fetchFoodLog` (after it, ~line 127):

```js
// Row count only (not full rows) via PostgREST's exact-count header —
// cheaper than fetchFoodLog when the nudge only needs "how many so far".
async function fetchFoodLogCount(dateKey) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/food_log?log_date=eq.${dateKey}&select=id`,
    { headers: { ...authHeaders(), Prefer: 'count=exact' } }
  );
  const contentRange = r.headers.get('content-range'); // "0-4/5" or "*/0"
  return contentRange ? Number(contentRange.split('/')[1]) : 0;
}
```

Add the nudge function near `macroDrift` (after it, ~line 118):

```js
async function mealLog(mealIndex, force) {
  if (!force) {
    const today = todayEasternKey();
    const rowCount = await fetchFoodLogCount(today);
    if (!shouldSendMealNudge(rowCount, mealIndex)) {
      return { status: 200, body: { message: 'Already logged enough today, no push sent' } };
    }
  }
  return push({ body: 'Log a meal — quick add', url: '/macros.html' });
}
```

Register it in the `NUDGES` export (~line 153):

```js
export const NUDGES = {
  workout,
  'morning-launch': morningLaunch,
  'macro-drift': macroDrift,
  'coaching-inquiry': coachingInquiry,
  'meal-log': mealLog,
};
```

- [ ] **Step 2: Thread `meal` query param through `api/send-nudge.js`**

Current handler (`api/send-nudge.js:18-24`):

```js
  const nudge = NUDGES[req.query.type];
  if (!nudge) {
    res.status(400).json({ error: `Unknown nudge type: ${req.query.type ?? '(none)'}` });
    return;
  }
  const { status, body } = await nudge(req.query.force === 'true');
  res.status(status).json(body);
```

Replace with:

```js
  const nudge = NUDGES[req.query.type];
  if (!nudge) {
    res.status(400).json({ error: `Unknown nudge type: ${req.query.type ?? '(none)'}` });
    return;
  }
  const force = req.query.force === 'true';
  if (req.query.type === 'meal-log') {
    const mealIndex = Number(req.query.meal);
    if (!Number.isInteger(mealIndex) || mealIndex < 1 || mealIndex > 4) {
      res.status(400).json({ error: 'meal-log requires ?meal=1-4' });
      return;
    }
    const { status, body } = await mealLog(mealIndex, force);
    res.status(status).json(body);
    return;
  }
  const { status, body } = await nudge(force);
  res.status(status).json(body);
```

This needs `mealLog` importable in `send-nudge.js`. Add to its existing import:

```js
import { NUDGES, mealLog } from './_lib/nudges.js';
```

And export `mealLog` from `nudges.js` (it's currently a private, unexported function — add `export` to its declaration from Step 1: `export async function mealLog(mealIndex, force) {`).

- [ ] **Step 3: Manual smoke check — confirm the module loads and exports what's expected**

Run: `node -e "import('./api/_lib/nudges.js').then(m => console.log(Object.keys(m.NUDGES), typeof m.mealLog))"`
Expected output: `[ 'workout', 'morning-launch', 'macro-drift', 'coaching-inquiry', 'meal-log' ] function`

- [ ] **Step 4: Commit**

```bash
git add api/_lib/nudges.js api/send-nudge.js
git commit -m "feat: wire meal-log nudge into send-nudge endpoint"
```

---

### Task 3: Cron workflow

**Files:**
- Create: `.github/workflows/meal-log-nudge.yml`

- [ ] **Step 1: Write the workflow file**

```yaml
name: Meal Log Nudge

on:
  schedule:
    # Breakfast ~10:30am, lunch ~1pm, pre-gym ~3pm, post-gym ~7:30pm Eastern
    # (EDT, UTC-4; DST drift accepted un-corrected, same as the other nudges).
    - cron: '30 14 * * *'
    - cron: '0 17 * * *'
    - cron: '0 19 * * *'
    - cron: '30 23 * * *'
  workflow_dispatch:
    inputs:
      meal:
        description: 'Meal slot to force (1-4)'
        type: choice
        options: ['1', '2', '3', '4']
        default: '1'
      force:
        description: 'Force a real test push regardless of logged count'
        type: boolean
        default: false

jobs:
  nudge:
    runs-on: ubuntu-latest
    steps:
      - name: Determine meal slot from current UTC hour
        id: meal
        run: |
          if [ -n "${{ inputs.meal }}" ]; then
            echo "index=${{ inputs.meal }}" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          hour=$(date -u +%H)
          case "$hour" in
            14) echo "index=1" >> "$GITHUB_OUTPUT" ;;
            17) echo "index=2" >> "$GITHUB_OUTPUT" ;;
            19) echo "index=3" >> "$GITHUB_OUTPUT" ;;
            23) echo "index=4" >> "$GITHUB_OUTPUT" ;;
            *) echo "index=1" >> "$GITHUB_OUTPUT" ;;
          esac
      - name: Send meal-log nudge
        run: |
          url="https://row-sage.vercel.app/api/send-nudge?type=meal-log&meal=${{ steps.meal.outputs.index }}"
          if [ "${{ inputs.force }}" = "true" ]; then
            url="${url}&force=true"
          fi
          response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}")
          code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')
          echo "Response code: $code"
          echo "Response body: $body"
          if [ "$code" != "200" ]; then
            echo "Error: unexpected response $code"
            exit 1
          fi
          message=$(echo "$body" | jq -r '.message')
          if [ "$message" = "Pushed" ]; then
            sent=$(echo "$body" | jq -r '.sent')
            total=$(echo "$body" | jq -r '.total')
            if [ "$sent" != "$total" ]; then
              echo "Error: only $sent/$total pushes actually succeeded"
              exit 1
            fi
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/meal-log-nudge.yml
git commit -m "feat: cron schedule for meal-log nudge"
```

---

### Task 4: Verify end-to-end via manual dispatch, then push

**Files:** none (verification only)

- [ ] **Step 1: Push the branch so the workflow exists on GitHub**

```bash
git push
```

- [ ] **Step 2: Manually trigger the workflow with `force: true` to confirm a real push arrives**

Via GitHub UI: Actions → "Meal Log Nudge" → "Run workflow" → `meal: 1`, `force: true` → Run.
Expected: workflow succeeds (green check); Carl's device receives a push notification titled "Row" with body "Log a meal — quick add" that opens `/macros.html`.

- [ ] **Step 3: If the push doesn't arrive, debug via the workflow's own log output**

The `curl` step's echoed `Response code` / `Response body` shows exactly what `send-nudge.js` returned (subscription count, per-endpoint failures) — check that before assuming the code is wrong.

---

### Rollout note (not a task — just context for whoever checks back)

Re-check `food_log` row count via Supabase MCP (`select count(*), count(distinct log_date) from food_log where created_at >= '<ship-date>'`) on 2026-09-02, 14 days after this ships. 10+ distinct `log_date`s with real entries = activation worked. Fewer = revisit the deferred ad-hoc-entry option (Approach B) from the design spec.
