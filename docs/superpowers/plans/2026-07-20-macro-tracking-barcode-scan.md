# Macro Tracking + Barcode Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Row's unused water tracker with real macro/nutrition tracking — daily targets with a remaining-today budget, barcode scan via Open Food Facts, manual entry, and a history view.

**Architecture:** Fully client-side, no new backend (Row is static, no build step). A new `food_log` Supabase table holds logged food (mirrors the existing `workout_events`/`content_ideas` pattern). Daily targets live in the existing `app_state` row keyed `health`. Pure calculation logic lives in its own file with a Node-runnable self-check, matching the existing `gym-workout-events.js` / `gym-workout-events.selfcheck.js` pattern in this repo.

**Tech Stack:** Vanilla HTML/CSS/JS, Supabase JS SDK v2 (CDN), `html5-qrcode` (CDN) for barcode decode, Open Food Facts public REST API.

**Spec:** `docs/superpowers/specs/2026-07-20-macro-tracking-barcode-scan-design.md`

---

### Task 1: `food_log` table migration

**Files:**
- Create: `supabase/migrations/2026-07-20-food-log.sql`

- [ ] **Step 1: Write the migration**

```sql
create table if not exists food_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  name text not null,
  protein_g numeric not null default 0 check (protein_g >= 0),
  carb_g numeric not null default 0 check (carb_g >= 0),
  fat_g numeric not null default 0 check (fat_g >= 0),
  calories numeric not null default 0 check (calories >= 0),
  source text not null check (source in ('barcode', 'manual')),
  barcode text,
  created_at timestamptz not null default now(),
  constraint food_log_barcode_matches_source check (
    (source = 'barcode' and barcode is not null) or
    (source = 'manual' and barcode is null)
  )
);

create index if not exists food_log_log_date_idx on food_log (log_date);

alter table food_log enable row level security;

-- Same open-anon-RLS pattern as app_state/coaching_clients (single-user
-- tool behind topbar.js's passphrase gate) — not a new security tier.
create policy "anon full access to food_log"
  on food_log
  for all
  to anon
  using (true)
  with check (true);
```

- [ ] **Step 2: Apply the migration**

Run against the Supabase project (`vikpcejlyxieguorwysf`) via the SQL editor in the Supabase dashboard (Table Editor → SQL Editor → paste → Run). Confirm `food_log` appears in Table Editor with the columns above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026-07-20-food-log.sql
git commit -m "feat: add food_log table migration"
```

---

### Task 2: Pure macro-calculation logic + self-check

**Files:**
- Create: `macro-calc.js`
- Create: `macro-calc.selfcheck.js`

- [ ] **Step 1: Write `macro-calc.js`**

```js
// macro-calc.js — pure functions for macro targets, per-scan macro
// resolution, and remaining-today budget math. No DOM, no Supabase —
// see macros.html for the wiring. Dual export like gym-workout-events.js
// so this can be self-checked with plain `node` (no test runner in this
// repo) and also loaded as a plain <script> in the browser.
(function () {
  'use strict';

  function round1(n) { return Math.round(n * 10) / 10; }

  // Same formula already validated in coaching-landing/macros.html's
  // calculateMacros() — copied here rather than shared, since these are
  // two separate static repos with no build step to share a module through.
  function calculateMacros({ sex, age, heightIn, weightLb, activityLevel, goal }) {
    const ACTIVITY_MULTIPLIERS = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 };
    const GOAL_ADJUSTMENTS = { cut: 0.8, bulk: 1.125, recomp: 0.95 };
    const CARB_FLOOR_G = 50;

    const weightKg = weightLb * 0.45359237;
    const heightCm = heightIn * 2.54;

    const bmr = sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

    const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
    const calories = tdee * GOAL_ADJUSTMENTS[goal];

    const proteinG = weightLb;
    let fatG = (0.25 * calories) / 9;
    let carbG = (calories - proteinG * 4 - fatG * 9) / 4;

    if (carbG < CARB_FLOOR_G) {
      carbG = CARB_FLOOR_G;
      fatG = (calories - proteinG * 4 - carbG * 4) / 9;
    }

    return {
      calories: Math.round(calories),
      proteinG: Math.round(proteinG),
      fatG: Math.round(fatG),
      carbG: Math.round(carbG),
    };
  }

  // A product only counts as having usable per-serving data if ALL FOUR
  // macro fields are present — a product with proteins_serving but no
  // energy-kcal_serving would otherwise silently report 0 calories.
  function hasCompleteServingData(nutriments) {
    return ['proteins_serving', 'carbohydrates_serving', 'fat_serving', 'energy-kcal_serving']
      .every((k) => nutriments[k] != null);
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  // nutriments: the raw `nutriments` object from an Open Food Facts
  // product response. quantity: number of servings logged — only used
  // when hasCompleteServingData(nutriments) is true. gramsOverride: grams
  // eaten — required (by the caller) whenever serving data is incomplete;
  // this function still falls back to 100g if the caller omits it so it
  // never throws, but the UI must not skip prompting for grams in that case.
  function resolveServingMacros(nutriments, quantity, gramsOverride) {
    nutriments = nutriments || {};
    if (hasCompleteServingData(nutriments) && gramsOverride == null) {
      const q = num(quantity, 1);
      return {
        protein_g: round1(num(nutriments['proteins_serving'], 0) * q),
        carb_g: round1(num(nutriments['carbohydrates_serving'], 0) * q),
        fat_g: round1(num(nutriments['fat_serving'], 0) * q),
        calories: round1(num(nutriments['energy-kcal_serving'], 0) * q),
      };
    }
    const grams = gramsOverride != null ? num(gramsOverride, 100) : 100;
    const factor = grams / 100;
    return {
      protein_g: round1(num(nutriments['proteins_100g'], 0) * factor),
      carb_g: round1(num(nutriments['carbohydrates_100g'], 0) * factor),
      fat_g: round1(num(nutriments['fat_100g'], 0) * factor),
      calories: round1(num(nutriments['energy-kcal_100g'], 0) * factor),
    };
  }

  // targets: { proteinG, carbG, fatG, calories }
  // entries: array of food_log rows for today ({ protein_g, carb_g, fat_g, calories })
  // Values are coerced through num() — a corrupt/non-numeric row (e.g. from
  // a future bad write) contributes 0 rather than producing NaN totals.
  function remainingBudget(targets, entries) {
    const consumed = (entries || []).reduce((acc, e) => ({
      protein_g: acc.protein_g + num(e.protein_g, 0),
      carb_g: acc.carb_g + num(e.carb_g, 0),
      fat_g: acc.fat_g + num(e.fat_g, 0),
      calories: acc.calories + num(e.calories, 0),
    }), { protein_g: 0, carb_g: 0, fat_g: 0, calories: 0 });

    return {
      protein_g: round1((targets.proteinG || 0) - consumed.protein_g),
      carb_g: round1((targets.carbG || 0) - consumed.carb_g),
      fat_g: round1((targets.fatG || 0) - consumed.fat_g),
      calories: round1((targets.calories || 0) - consumed.calories),
      consumed,
    };
  }

  const api = { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData };
  if (typeof window !== 'undefined') window.MacroCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 2: Write `macro-calc.selfcheck.js`**

```js
// Run with: node macro-calc.selfcheck.js
'use strict';

const { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData } = require('./macro-calc.js');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

// calculateMacros — same cases coaching-landing's macros.html validates.
const r1 = calculateMacros({ sex: 'male', age: 25, heightIn: 70, weightLb: 180, activityLevel: 3, goal: 'cut' });
assertEqual(r1.calories, 2242, 'calculateMacros calories (normal case)');
assertEqual(r1.proteinG, 180, 'calculateMacros protein (normal case)');
assertEqual(r1.fatG, 62, 'calculateMacros fat (normal case)');
assertEqual(r1.carbG, 240, 'calculateMacros carbs (normal case)');

// resolveServingMacros — product with serving-level data, quantity 1.
const withServing = {
  'proteins_serving': 5, 'carbohydrates_serving': 37, 'fat_serving': 4, 'energy-kcal_serving': 200,
  'proteins_100g': 9.62, 'carbohydrates_100g': 71.15, 'fat_100g': 7.69, 'energy-kcal_100g': 385,
};
const s1 = resolveServingMacros(withServing, 1, null);
assertEqual(s1.protein_g, 5, 'resolveServingMacros uses serving data at quantity 1');
assertEqual(s1.calories, 200, 'resolveServingMacros calories at quantity 1');

// resolveServingMacros — same product, 2 servings.
const s2 = resolveServingMacros(withServing, 2, null);
assertEqual(s2.protein_g, 10, 'resolveServingMacros scales with quantity');

// resolveServingMacros — product with NO serving data, falls back to grams.
const noServing = { 'proteins_100g': 20, 'carbohydrates_100g': 0, 'fat_100g': 10, 'energy-kcal_100g': 180 };
assertEqual(hasCompleteServingData(noServing), false, 'hasCompleteServingData is false with no serving fields at all');
const s3 = resolveServingMacros(noServing, 1, 150);
assertEqual(s3.protein_g, 30, 'resolveServingMacros falls back to per-100g x grams when no serving data');
assertEqual(s3.calories, 270, 'resolveServingMacros calories fallback math');

// resolveServingMacros — PARTIAL serving data (protein present, calories
// missing) must NOT be treated as complete, or calories would silently
// report 0. This is the exact bug Codex's terra review flagged.
const partialServing = { 'proteins_serving': 5, 'carbohydrates_serving': 37, 'fat_serving': 4, 'proteins_100g': 9.62, 'carbohydrates_100g': 71.15, 'fat_100g': 7.69, 'energy-kcal_100g': 385 };
assertEqual(hasCompleteServingData(partialServing), false, 'hasCompleteServingData is false when energy-kcal_serving is missing');
const s4 = resolveServingMacros(partialServing, 1, 80);
assertEqual(s4.calories, 308, 'resolveServingMacros correctly falls back to per-100g x grams for partial serving data');

// remainingBudget — subtracts today's entries from targets.
const targets = { proteinG: 180, carbG: 240, fatG: 62, calories: 2242 };
const entries = [
  { protein_g: 40, carb_g: 50, fat_g: 10, calories: 460 },
  { protein_g: 30, carb_g: 20, fat_g: 5, calories: 250 },
];
const b = remainingBudget(targets, entries);
assertEqual(b.protein_g, 110, 'remainingBudget protein remaining');
assertEqual(b.calories, 1532, 'remainingBudget calories remaining');
assertEqual(b.consumed.protein_g, 70, 'remainingBudget tracks consumed total too');

// remainingBudget — empty log returns full targets remaining.
const b2 = remainingBudget(targets, []);
assertEqual(b2.protein_g, 180, 'remainingBudget with no entries returns full target');

// remainingBudget — a corrupt/non-numeric row contributes 0, not NaN.
const b3 = remainingBudget(targets, [{ protein_g: 'not-a-number', carb_g: null, fat_g: undefined, calories: 100 }]);
assertEqual(b3.protein_g, 180, 'remainingBudget treats non-numeric fields as 0 instead of propagating NaN');
assertEqual(b3.calories, 2142, 'remainingBudget still counts the valid numeric field on the same row');

console.log('macro-calc.selfcheck.js: all assertions passed');
```

- [ ] **Step 3: Run the self-check, verify it passes**

Run: `node macro-calc.selfcheck.js`
Expected: `macro-calc.selfcheck.js: all assertions passed`

- [ ] **Step 4: Commit**

```bash
git add macro-calc.js macro-calc.selfcheck.js
git commit -m "feat: add macro-calc pure functions + self-check"
```

---

### Task 3: Remove water tracking from `topbar.js`

**Files:**
- Modify: `topbar.js`

`topbar.js` is loaded on every Row page. This removes the water pill CSS, the water markup inside `topbarHtml`, and every water-specific JS function — not just a link.

- [ ] **Step 1: Remove the water CSS block**

Delete these rules (currently lines 93–135):

```css
.topbar-water-wrap { display: flex; align-items: stretch; }
.topbar-water-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 14px;
  background: rgba(125, 211, 252, 0.08);
  border: 1px solid rgba(125, 211, 252, 0.16);
  border-right: none;
  border-radius: 12px 0 0 12px;
  text-decoration: none; color: #FAFAFA;
  -webkit-tap-highlight-color: transparent;
}
.topbar-water-pill .topbar-pill-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #7DD3FC; flex-shrink: 0;
}
.topbar-water-pill.warn .topbar-pill-dot { background: #fbbf24; }
.topbar-water-pill.miss .topbar-pill-dot {
  background: #ff8a8a;
  animation: topbar-miss-pulse 1.6s ease-in-out infinite;
}
@keyframes topbar-miss-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  50%      { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
}
.topbar-pill-count {
  font-family: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 13px; font-weight: 700; color: #FAFAFA;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.topbar-water-add {
  width: 44px;
  border: 1px solid rgba(125, 211, 252, 0.16);
  background: linear-gradient(180deg, rgba(125, 211, 252, 0.28), rgba(110, 231, 183, 0.28));
  color: #FFFFFF; font-family: inherit;
  font-size: 20px; font-weight: 700; line-height: 1;
  cursor: pointer; border-radius: 0 12px 12px 0;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, transform 0.10s;
}
.topbar-water-add:active { transform: scale(0.94); }
.topbar-water-add.flash {
  background: linear-gradient(180deg, rgba(125, 211, 252, 0.7), rgba(110, 231, 183, 0.7));
}
```

Also remove these two lines from inside the existing `@media (max-width: 480px)` block (do not remove the rest of that block):

```css
  .topbar-water-pill { padding: 8px 11px; gap: 6px; }
  .topbar-water-add { width: 40px; font-size: 18px; }
```

- [ ] **Step 2: Remove the water markup from `topbarHtml`**

Change:

```js
  const topbarHtml = `
<header class="topbar" id="topbar" role="navigation" aria-label="Quick actions">
  <a href="index.html" class="topbar-home-btn" aria-label="Dashboard hub">
    <span class="topbar-home-icon">⌂</span>
  </a>
  <div class="topbar-water-wrap">
    <a href="health.html#water" class="topbar-water-pill" id="topbarWater" aria-label="Water progress">
      <span class="topbar-pill-dot"></span>
      <span class="topbar-pill-count" id="topbarWaterCount">0/0</span>
    </a>
    <button class="topbar-water-add" id="topbarWaterAdd" aria-label="Log one drink" type="button">+</button>
  </div>
  <a href="finance.html" class="topbar-finance-btn" id="topbarFinance" aria-label="Finance">
    <span class="topbar-finance-icon">📊</span>
  </a>
  <a href="coaching.html" class="topbar-coaching-btn" id="topbarCoaching" aria-label="Coaching">
    <span class="topbar-coaching-icon">🏋️</span>
  </a>
</header>`;
```

to:

```js
  const topbarHtml = `
<header class="topbar" id="topbar" role="navigation" aria-label="Quick actions">
  <a href="index.html" class="topbar-home-btn" aria-label="Dashboard hub">
    <span class="topbar-home-icon">⌂</span>
  </a>
  <a href="finance.html" class="topbar-finance-btn" id="topbarFinance" aria-label="Finance">
    <span class="topbar-finance-icon">📊</span>
  </a>
  <a href="coaching.html" class="topbar-coaching-btn" id="topbarCoaching" aria-label="Coaching">
    <span class="topbar-coaching-icon">🏋️</span>
  </a>
</header>`;
```

- [ ] **Step 3: Remove the water JS functions**

Delete `calendarDateKey()`, `getWaterProgress()`, `classifyStatus()`, `setPillStatus()`, `render()`, `defaultWaterState()`, `pushWaterMergedToSupabase()`, and `addWater()` in their entirety (currently lines 315–409).

- [ ] **Step 4: Strip the water wiring out of `boot()`**

Change:

```js
  function boot() {
    injectStyleAndHTML();
    const btn = document.getElementById('topbarWaterAdd');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); addWater(); });
    render();
    lockGestures();
    startModalLock();
    window.addEventListener('storage', render);
    window.addEventListener('focus', render);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    setInterval(render, 30 * 1000);
  }
```

to:

```js
  function boot() {
    injectStyleAndHTML();
    lockGestures();
    startModalLock();
  }
```

- [ ] **Step 5: Update the file header comment**

Change the top-of-file comment (currently lines 1–9) to drop the water reference:

```js
// =============================================================
// Persistent dashboard top bar + bottom tab bar.
// Drop this on any page with:
//     <script src="topbar.js" defer></script>
// It self-injects HTML + CSS and renders the Main/Health/Fitness
// bottom tabs. Skips chrome on finance.html and inside iframes.
// =============================================================
```

- [ ] **Step 6: Manually verify**

Open `index.html`, `health.html`, `gym.html` in a browser (or via `preview_start`). Confirm the topbar renders with home/finance/coaching buttons and no water pill, no console errors, and the bottom tab bar still works.

- [ ] **Step 7: Commit**

```bash
git add topbar.js
git commit -m "refactor: remove water tracking from topbar.js"
```

---

### Task 4: Repoint `health.html`'s embed slot to macros

**Files:**
- Modify: `health.html`

- [ ] **Step 1: Rename the CSS**

Change:

```css
.water-embed { margin-top: 56px; }
.water-iframe {
```

to:

```css
.macro-embed { margin-top: 56px; }
.macro-iframe {
```

And in the mobile media query, change:

```css
  .water-embed { margin-top: 40px; }
  .water-iframe { height: 780px; }
```

to:

```css
  .macro-embed { margin-top: 40px; }
  .macro-iframe { height: 780px; }
```

- [ ] **Step 2: Repoint the iframe**

Change:

```html
  <section id="water" class="water-embed">
    ...
    <iframe src="po-water.html" class="water-iframe" loading="lazy" title="Water Tracker"></iframe>
```

to:

```html
  <section id="macros" class="macro-embed">
    ...
    <iframe src="macros.html" class="macro-iframe" loading="lazy" title="Macro Tracker"></iframe>
```

(Keep whatever heading/label markup sits between the `<section>` tag and the `<iframe>` — just update its text if it currently says "Water".)

- [ ] **Step 3: Update `syncedKeys`**

Change:

```js
    syncedKeys: ['stack:items', 'stack:version', 'stack:low', 'po_water_v1'],
```

to:

```js
    syncedKeys: ['stack:items', 'stack:version', 'stack:low', 'macro_targets'],
```

- [ ] **Step 4: Commit**

```bash
git add health.html
git commit -m "refactor: repoint health.html embed slot from water to macros"
```

(Note: Task 5 below still needs to exist before this page fully works end-to-end — `macros.html` doesn't exist yet at this point. That's fine; commits are checkpoints, not deploys.)

---

### Task 5: `macros.html` — page shell, targets, remaining-budget bars

**Files:**
- Rename: `po-water.html` → `macros.html` (git mv, full rewrite)

- [ ] **Step 1: Rename the file, preserving history**

```bash
git mv po-water.html macros.html
```

- [ ] **Step 2: Replace the entire contents of `macros.html`**

```html
<!--
=====================================================
© 2026 Rowan Thistlebrooke — All Rights Reserved

Personal & Educational Use Only.
You may view and run this code locally for learning.
You may NOT use this code or data in a commercial
product, redistribute it, or republish it as your own.

Unauthorized use may be subject to copyright enforcement.
Contact: rowan.wisere@gmail.com
=====================================================
-->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0a0b">
<title>Macro Tracker</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
<script src="sync.js" defer></script>
<script src="topbar.js" defer></script>
<script src="macro-calc.js"></script>
<style>
* { box-sizing: border-box; }
body {
  margin: 0; background: #0a0a0b; color: #FAFAFA;
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  padding: 16px; padding-bottom: 100px;
}
.mt-shell { max-width: 480px; margin: 0 auto; }
.mt-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.mt-tab-btn {
  flex: 1; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04); color: #FAFAFA; font-weight: 600; font-size: 13px;
  cursor: pointer;
}
.mt-tab-btn.active { background: rgba(110, 231, 183, 0.16); border-color: rgba(110, 231, 183, 0.4); }
.mt-view-history .mt-log-view { display: none; }
.mt-view-log .mt-history-view { display: none; }
.mt-budget-card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; padding: 16px; margin-bottom: 16px;
}
.mt-budget-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.mt-budget-row:last-child { margin-bottom: 0; }
.mt-budget-label { font-size: 13px; color: rgba(255,255,255,0.7); width: 70px; }
.mt-budget-bar-track { flex: 1; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); margin: 0 10px; overflow: hidden; }
.mt-budget-bar-fill { height: 100%; background: #6EE7B7; transition: width 0.2s; }
.mt-budget-bar-fill.over { background: #ff8a8a; }
.mt-budget-value { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 13px; width: 90px; text-align: right; }
.mt-btn-row { display: flex; gap: 10px; margin-bottom: 16px; }
.mt-action-btn {
  flex: 1; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05); color: #FAFAFA; font-weight: 700; font-size: 14px;
  cursor: pointer;
}
.mt-entry {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03); margin-bottom: 8px;
}
.mt-entry-name { font-size: 13px; }
.mt-entry-macros { font-size: 11px; color: rgba(255,255,255,0.5); font-family: monospace; }
.mt-entry-del { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 16px; cursor: pointer; }
.mt-modal-bg {
  display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  align-items: center; justify-content: center; padding: 20px; z-index: 100;
}
.mt-modal-bg.show { display: flex; }
.mt-modal {
  background: #141416; border-radius: 16px; padding: 20px; width: 100%; max-width: 400px;
  max-height: 88vh; overflow-y: auto;
}
.mt-field { margin-bottom: 12px; }
.mt-field label { display: block; font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px; }
.mt-field input, .mt-field select {
  width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.05); color: #FAFAFA; font-size: 14px;
}
.mt-modal-actions { display: flex; gap: 10px; margin-top: 16px; }
.mt-modal-actions button {
  flex: 1; padding: 12px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer;
}
.mt-btn-primary { background: #6EE7B7; color: #0a0a0b; }
.mt-btn-secondary { background: rgba(255,255,255,0.08); color: #FAFAFA; }
#mtScanReader { width: 100%; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.mt-history-day { padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03); margin-bottom: 8px; }
.mt-history-date { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.mt-history-totals { font-size: 12px; color: rgba(255,255,255,0.5); font-family: monospace; }
</style>
</head>
<body>
<div class="mt-shell mt-view-log" id="mtShell">
  <div class="mt-tabs">
    <button class="mt-tab-btn active" id="mtTabLog" type="button">Today</button>
    <button class="mt-tab-btn" id="mtTabHistory" type="button">History</button>
  </div>

  <div class="mt-log-view">
    <div class="mt-budget-card" id="mtBudgetCard">
      <div class="mt-budget-row" data-macro="protein">
        <span class="mt-budget-label">Protein</span>
        <div class="mt-budget-bar-track"><div class="mt-budget-bar-fill"></div></div>
        <span class="mt-budget-value">0 / 0g</span>
      </div>
      <div class="mt-budget-row" data-macro="carb">
        <span class="mt-budget-label">Carbs</span>
        <div class="mt-budget-bar-track"><div class="mt-budget-bar-fill"></div></div>
        <span class="mt-budget-value">0 / 0g</span>
      </div>
      <div class="mt-budget-row" data-macro="fat">
        <span class="mt-budget-label">Fat</span>
        <div class="mt-budget-bar-track"><div class="mt-budget-bar-fill"></div></div>
        <span class="mt-budget-value">0 / 0g</span>
      </div>
      <div class="mt-budget-row" data-macro="calories">
        <span class="mt-budget-label">Calories</span>
        <div class="mt-budget-bar-track"><div class="mt-budget-bar-fill"></div></div>
        <span class="mt-budget-value">0 / 0</span>
      </div>
    </div>

    <div class="mt-btn-row">
      <button class="mt-action-btn" id="mtScanBtn" type="button">📷 Scan</button>
      <button class="mt-action-btn" id="mtManualBtn" type="button">✏️ Manual</button>
      <button class="mt-action-btn" id="mtTargetsBtn" type="button">🎯 Targets</button>
    </div>

    <div id="mtTodayList"></div>
  </div>

  <div class="mt-history-view">
    <div id="mtHistoryList"></div>
  </div>
</div>

<!-- Targets modal -->
<div class="mt-modal-bg" id="mtTargetsModalBg">
  <div class="mt-modal">
    <h3 style="margin-top:0;">Daily Targets</h3>
    <div class="mt-field">
      <label>Protein (g)</label>
      <input type="number" id="mtTargetProtein" inputmode="numeric">
    </div>
    <div class="mt-field">
      <label>Carbs (g)</label>
      <input type="number" id="mtTargetCarb" inputmode="numeric">
    </div>
    <div class="mt-field">
      <label>Fat (g)</label>
      <input type="number" id="mtTargetFat" inputmode="numeric">
    </div>
    <div class="mt-field">
      <label>Calories</label>
      <input type="number" id="mtTargetCalories" inputmode="numeric">
    </div>
    <div class="mt-modal-actions">
      <button class="mt-btn-secondary" id="mtTargetsCancel" type="button">Cancel</button>
      <button class="mt-btn-primary" id="mtTargetsSave" type="button">Save</button>
    </div>
  </div>
</div>

<script>
const LS_KEY = 'macro_targets';
const DEFAULT_TARGETS = { proteinG: 180, carbG: 200, fatG: 65, calories: 2200 };

function $(id) { return document.getElementById(id); }

function loadTargets() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return Object.assign({}, DEFAULT_TARGETS);
    const parsed = JSON.parse(raw);
    return Object.assign({}, DEFAULT_TARGETS, parsed);
  } catch (e) { return Object.assign({}, DEFAULT_TARGETS); }
}
function saveTargets(targets) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(targets)); } catch (e) {}
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';
let supa = null;
function getSupa() {
  if (!supa && window.supabase) supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return supa;
}

async function fetchTodayEntries() {
  const client = getSupa();
  if (!client) return [];
  const { data, error } = await client.from('food_log').select('*').eq('log_date', todayKey()).order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

// Both return { error } (error === null on success) so callers can decide
// whether to close a modal / refresh, or show the failure instead of
// silently behaving as if the write succeeded.
async function insertEntry(entry) {
  const client = getSupa();
  if (!client) return { error: new Error('Supabase not ready') };
  const { error } = await client.from('food_log').insert(Object.assign({ log_date: todayKey() }, entry));
  return { error };
}

async function deleteEntry(id) {
  const client = getSupa();
  if (!client) return { error: new Error('Supabase not ready') };
  const { error } = await client.from('food_log').delete().eq('id', id);
  return { error };
}

function showEntryError(message) {
  // Minimal, dependency-free surfacing — no toast/notification library
  // exists anywhere in this repo, so a plain alert is the lazy-correct
  // choice rather than introducing one for a single error path.
  window.alert(message);
}

function renderBudget(remaining, targets) {
  const rows = [
    { macro: 'protein', remaining: remaining.protein_g, target: targets.proteinG, unit: 'g' },
    { macro: 'carb', remaining: remaining.carb_g, target: targets.carbG, unit: 'g' },
    { macro: 'fat', remaining: remaining.fat_g, target: targets.fatG, unit: 'g' },
    { macro: 'calories', remaining: remaining.calories, target: targets.calories, unit: '' },
  ];
  rows.forEach((r) => {
    const rowEl = document.querySelector('.mt-budget-row[data-macro="' + r.macro + '"]');
    if (!rowEl) return;
    const consumed = r.target - r.remaining;
    const pct = r.target > 0 ? Math.min(100, Math.max(0, (consumed / r.target) * 100)) : 0;
    const fill = rowEl.querySelector('.mt-budget-bar-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('over', r.remaining < 0);
    const valEl = rowEl.querySelector('.mt-budget-value');
    valEl.textContent = Math.round(consumed) + ' / ' + Math.round(r.target) + r.unit;
  });
}

function renderTodayList(entries) {
  const list = $('mtTodayList');
  list.innerHTML = '';
  entries.forEach((e) => {
    const row = document.createElement('div');
    row.className = 'mt-entry';
    row.innerHTML =
      '<div><div class="mt-entry-name"></div><div class="mt-entry-macros"></div></div>' +
      '<button class="mt-entry-del" type="button">✕</button>';
    row.querySelector('.mt-entry-name').textContent = e.name;
    row.querySelector('.mt-entry-macros').textContent =
      Math.round(e.protein_g) + 'p / ' + Math.round(e.carb_g) + 'c / ' + Math.round(e.fat_g) + 'f — ' + Math.round(e.calories) + 'cal';
    row.querySelector('.mt-entry-del').addEventListener('click', async () => {
      const { error } = await deleteEntry(e.id);
      if (error) { showEntryError('Could not delete entry — try again.'); return; }
      refresh();
    });
    list.appendChild(row);
  });
}

let currentTargets = loadTargets();

async function refresh() {
  currentTargets = loadTargets();
  const entries = await fetchTodayEntries();
  const remaining = window.MacroCalc.remainingBudget(currentTargets, entries);
  renderBudget(remaining, currentTargets);
  renderTodayList(entries);
}

// ---- Targets modal ----
function openTargetsModal() {
  $('mtTargetProtein').value = currentTargets.proteinG;
  $('mtTargetCarb').value = currentTargets.carbG;
  $('mtTargetFat').value = currentTargets.fatG;
  $('mtTargetCalories').value = currentTargets.calories;
  $('mtTargetsModalBg').classList.add('show');
}
function closeTargetsModal() { $('mtTargetsModalBg').classList.remove('show'); }

$('mtTargetsBtn').addEventListener('click', openTargetsModal);
$('mtTargetsCancel').addEventListener('click', closeTargetsModal);
$('mtTargetsSave').addEventListener('click', () => {
  const targets = {
    proteinG: Number($('mtTargetProtein').value) || 0,
    carbG: Number($('mtTargetCarb').value) || 0,
    fatG: Number($('mtTargetFat').value) || 0,
    calories: Number($('mtTargetCalories').value) || 0,
  };
  saveTargets(targets);
  closeTargetsModal();
  refresh();
});

// ---- Tabs ----
$('mtTabLog').addEventListener('click', () => {
  $('mtShell').classList.remove('mt-view-history');
  $('mtShell').classList.add('mt-view-log');
  $('mtTabLog').classList.add('active');
  $('mtTabHistory').classList.remove('active');
});
$('mtTabHistory').addEventListener('click', () => {
  $('mtShell').classList.remove('mt-view-log');
  $('mtShell').classList.add('mt-view-history');
  $('mtTabHistory').classList.add('active');
  $('mtTabLog').classList.remove('active');
  renderHistory();
});

refresh();

// A tab left open across local midnight would otherwise keep showing
// yesterday's budget/list until something happens to call refresh() —
// re-run it whenever the tab regains focus/visibility, same pattern
// topbar.js's old water-pill render() used for the same reason.
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

document.addEventListener('DOMContentLoaded', function () {
  try { if (window.self !== window.top) return; } catch (e) { return; }
  if (typeof initCloudSync !== 'function') return;
  initCloudSync({
    appKey: 'health',
    syncedKeys: ['macro_targets'],
    onApplied: function () { refresh(); }
  });
});
</script>
</body>
</html>
```

- [ ] **Step 3: Manually verify**

Open `macros.html` directly in a browser. Confirm: the Targets modal opens/saves and the budget bars update; the page doesn't throw console errors (the Scan/Manual buttons and History tab are wired to functions added in Tasks 6–7, so clicking them now is expected to no-op or error until those tasks land — that's fine at this checkpoint).

- [ ] **Step 4: Commit**

```bash
git add macros.html
git commit -m "feat: macros.html page shell with targets and remaining-budget bars"
```

---

### Task 6: Manual entry + delete (already wired in Task 5 — this task adds the manual-entry modal)

**Files:**
- Modify: `macros.html`

- [ ] **Step 1: Add the manual-entry modal markup**

Insert after the Targets modal's closing `</div>` (still inside `<body>`, before the `<script>` block):

```html
<!-- Manual entry modal -->
<div class="mt-modal-bg" id="mtManualModalBg">
  <div class="mt-modal">
    <h3 style="margin-top:0;">Add Food</h3>
    <div class="mt-field">
      <label>Name</label>
      <input type="text" id="mtManualName">
    </div>
    <div class="mt-field">
      <label>Protein (g)</label>
      <input type="number" id="mtManualProtein" inputmode="numeric">
    </div>
    <div class="mt-field">
      <label>Carbs (g)</label>
      <input type="number" id="mtManualCarb" inputmode="numeric">
    </div>
    <div class="mt-field">
      <label>Fat (g)</label>
      <input type="number" id="mtManualFat" inputmode="numeric">
    </div>
    <div class="mt-field">
      <label>Calories</label>
      <input type="number" id="mtManualCalories" inputmode="numeric">
    </div>
    <div class="mt-modal-actions">
      <button class="mt-btn-secondary" id="mtManualCancel" type="button">Cancel</button>
      <button class="mt-btn-primary" id="mtManualSave" type="button">Add</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Wire the manual-entry button and modal**

Add to the `<script>` block, after the Targets modal wiring:

```js
// ---- Manual entry modal ----
function openManualModal() {
  $('mtManualName').value = '';
  $('mtManualProtein').value = '';
  $('mtManualCarb').value = '';
  $('mtManualFat').value = '';
  $('mtManualCalories').value = '';
  $('mtManualModalBg').classList.add('show');
}
function closeManualModal() { $('mtManualModalBg').classList.remove('show'); }

$('mtManualBtn').addEventListener('click', openManualModal);
$('mtManualCancel').addEventListener('click', closeManualModal);
function nonNegative(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

$('mtManualSave').addEventListener('click', async () => {
  const name = $('mtManualName').value.trim();
  if (!name) return;
  const { error } = await insertEntry({
    name,
    protein_g: nonNegative($('mtManualProtein').value),
    carb_g: nonNegative($('mtManualCarb').value),
    fat_g: nonNegative($('mtManualFat').value),
    calories: nonNegative($('mtManualCalories').value),
    source: 'manual',
    barcode: null,
  });
  if (error) { showEntryError('Could not save entry — try again.'); return; }
  closeManualModal();
  refresh();
});
```

- [ ] **Step 3: Manually verify**

Open `macros.html`, click Manual, fill in a food, save. Confirm it appears in the today list with a delete button, and the budget bars update. Delete it and confirm it disappears and the budget reverts.

- [ ] **Step 4: Commit**

```bash
git add macros.html
git commit -m "feat: manual food entry in macros.html"
```

---

### Task 7: Barcode scan via Open Food Facts

**Files:**
- Modify: `macros.html`

- [ ] **Step 1: Add the scan modal markup**

Insert after the manual-entry modal's closing `</div>`:

```html
<!-- Scan modal -->
<div class="mt-modal-bg" id="mtScanModalBg">
  <div class="mt-modal">
    <h3 style="margin-top:0;" id="mtScanTitle">Scan Barcode</h3>
    <div id="mtScanReader"></div>
    <div id="mtScanResult"></div>
    <div class="mt-modal-actions">
      <button class="mt-btn-secondary" id="mtScanCancel" type="button">Cancel</button>
      <button class="mt-btn-primary" id="mtScanConfirm" type="button" style="display:none;">Add</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Wire the scan flow**

Add to the `<script>` block:

```js
// ---- Barcode scan ----
let html5QrCode = null;
let scannedProduct = null; // { name, servingSize, nutriments, barcode }
let scanQuantity = 1;
let scanGrams = 100;
let scanDecodeInFlight = false; // guards against overlapping decode callbacks

// Renders an element's text via textContent, never innerHTML — OFF is a
// community-edited database and its product_name/serving_size fields are
// untrusted input as far as this page is concerned.
function setText(el, text) {
  el.textContent = text;
}

async function lookupOpenFoodFacts(barcode) {
  try {
    const res = await fetch('https://world.openfoodfacts.org/api/v2/product/' + barcode + '.json?fields=product_name,serving_size,nutriments,status');
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.product || json.status === 0) return null;
    return {
      name: json.product.product_name || ('Barcode ' + barcode),
      servingSize: json.product.serving_size || '',
      nutriments: json.product.nutriments || {},
      barcode,
    };
  } catch (e) { return null; }
}

function renderScanResult(product, quantity, grams) {
  const complete = window.MacroCalc.hasCompleteServingData(product.nutriments);
  const macros = complete
    ? window.MacroCalc.resolveServingMacros(product.nutriments, quantity, null)
    : window.MacroCalc.resolveServingMacros(product.nutriments, null, grams);

  const resultEl = $('mtScanResult');
  resultEl.innerHTML = '';

  const nameEl = document.createElement('p');
  nameEl.style.fontWeight = '700';
  setText(nameEl, product.name);
  resultEl.appendChild(nameEl);

  if (complete && product.servingSize) {
    const servingEl = document.createElement('p');
    servingEl.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.5);';
    setText(servingEl, 'Serving: ' + product.servingSize);
    resultEl.appendChild(servingEl);
  }

  const quantityField = document.createElement('div');
  quantityField.className = 'mt-field';
  if (complete) {
    quantityField.innerHTML = '<label>Servings</label><input type="number" id="mtScanQty" min="0.25" step="0.25">';
  } else {
    quantityField.innerHTML =
      '<label>No per-serving data for this product — grams eaten</label>' +
      '<input type="number" id="mtScanGrams" min="1" step="1">';
  }
  resultEl.appendChild(quantityField);

  const macrosEl = document.createElement('p');
  macrosEl.style.cssText = 'font-family:monospace;font-size:13px;';
  setText(macrosEl, macros.protein_g + 'p / ' + macros.carb_g + 'c / ' + macros.fat_g + 'f — ' + macros.calories + 'cal');
  resultEl.appendChild(macrosEl);

  if (complete) {
    const qtyInput = $('mtScanQty');
    qtyInput.value = quantity;
    qtyInput.addEventListener('input', (e) => {
      scanQuantity = Number(e.target.value) || 1;
      renderScanResult(product, scanQuantity, scanGrams);
    });
  } else {
    const gramsInput = $('mtScanGrams');
    gramsInput.value = grams;
    gramsInput.addEventListener('input', (e) => {
      scanGrams = Number(e.target.value) || 100;
      renderScanResult(product, scanQuantity, scanGrams);
    });
  }
  $('mtScanConfirm').style.display = 'block';
}

async function onBarcodeDecoded(barcode) {
  if (scanDecodeInFlight) return; // ignore decodes that arrive while one is already being resolved
  scanDecodeInFlight = true;
  try {
    if (html5QrCode) { try { await html5QrCode.stop(); } catch (e) {} }
    $('mtScanReader').innerHTML = '';
    const product = await lookupOpenFoodFacts(barcode);
    if (!product) {
      const msg = document.createElement('p');
      setText(msg, 'Not found. Try Manual entry instead.');
      $('mtScanResult').innerHTML = '';
      $('mtScanResult').appendChild(msg);
      return;
    }
    scannedProduct = product;
    scanQuantity = 1;
    scanGrams = 100;
    renderScanResult(product, 1, 100);
  } finally {
    scanDecodeInFlight = false;
  }
}

function openScanModal() {
  scannedProduct = null;
  scanDecodeInFlight = false;
  $('mtScanResult').innerHTML = '';
  $('mtScanConfirm').style.display = 'none';
  $('mtScanModalBg').classList.add('show');
  html5QrCode = new Html5Qrcode('mtScanReader');
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 220, height: 220 } },
    (decodedText) => onBarcodeDecoded(decodedText),
    () => {} // ignore per-frame decode failures
  ).catch(() => {
    const msg = document.createElement('p');
    setText(msg, 'Camera unavailable — use Manual entry instead.');
    $('mtScanResult').appendChild(msg);
  });
}
async function closeScanModal() {
  if (html5QrCode) { try { await html5QrCode.stop(); } catch (e) {} html5QrCode = null; }
  scannedProduct = null;
  scanDecodeInFlight = false;
  $('mtScanModalBg').classList.remove('show');
}

$('mtScanBtn').addEventListener('click', openScanModal);
$('mtScanCancel').addEventListener('click', closeScanModal);
$('mtScanConfirm').addEventListener('click', async () => {
  if (!scannedProduct) return;
  const complete = window.MacroCalc.hasCompleteServingData(scannedProduct.nutriments);
  const macros = complete
    ? window.MacroCalc.resolveServingMacros(scannedProduct.nutriments, scanQuantity, null)
    : window.MacroCalc.resolveServingMacros(scannedProduct.nutriments, null, scanGrams);
  const { error } = await insertEntry({
    name: scannedProduct.name,
    protein_g: macros.protein_g,
    carb_g: macros.carb_g,
    fat_g: macros.fat_g,
    calories: macros.calories,
    source: 'barcode',
    barcode: scannedProduct.barcode,
  });
  if (error) { showEntryError('Could not save entry — try again.'); return; }
  await closeScanModal();
  refresh();
});
```

- [ ] **Step 3: Manually verify**

Open `macros.html` on a phone (or a browser with camera access), click Scan, grant camera permission, scan a real packaged-food barcode. Confirm the product name, serving size, and macros appear, servings quantity adjusts the numbers live, and Add inserts it into the today list. Also scan (or call `onBarcodeDecoded()` directly with) a barcode for a product known to be missing per-serving data — confirm the UI switches to the "grams eaten" input instead of "Servings," and the math updates correctly as grams change. Test the not-found path with a garbage barcode (e.g. `onBarcodeDecoded('000000000000')` from devtools) and confirm it shows the "not found" message without crashing.

- [ ] **Step 4: Commit**

```bash
git add macros.html
git commit -m "feat: barcode scan via html5-qrcode + Open Food Facts lookup"
```

---

### Task 8: History tab

**Files:**
- Modify: `macros.html`

- [ ] **Step 1: Add the history-rendering function**

Add to the `<script>` block:

```js
async function renderHistory() {
  const client = getSupa();
  const list = $('mtHistoryList');
  if (!client) { list.innerHTML = ''; return; }
  const { data, error } = await client
    .from('food_log')
    .select('*')
    .neq('log_date', todayKey())
    .order('log_date', { ascending: false })
    .limit(500);
  if (error || !data) { list.innerHTML = ''; return; }

  const byDate = {};
  data.forEach((e) => { (byDate[e.log_date] = byDate[e.log_date] || []).push(e); });

  list.innerHTML = '';
  Object.keys(byDate).sort().reverse().forEach((date) => {
    const entries = byDate[date];
    // remainingBudget() already sums entries with the same num()-coercion
    // used everywhere else (protects against a corrupt/non-numeric row);
    // .consumed is the totals object, targets are irrelevant here.
    const totals = window.MacroCalc.remainingBudget({ proteinG: 0, carbG: 0, fatG: 0, calories: 0 }, entries).consumed;

    const row = document.createElement('div');
    row.className = 'mt-history-day';
    row.innerHTML =
      '<div class="mt-history-date">' + date + '</div>' +
      '<div class="mt-history-totals">' +
      Math.round(totals.protein_g) + 'p / ' + Math.round(totals.carb_g) + 'c / ' + Math.round(totals.fat_g) + 'f — ' +
      Math.round(totals.calories) + 'cal (' + entries.length + ' item' + (entries.length === 1 ? '' : 's') + ')</div>';
    list.appendChild(row);
  });
}
```

(`renderHistory()` is already called from the `mtTabHistory` click handler added in Task 5 — no change needed there.)

- [ ] **Step 2: Manually verify**

Log a few food entries, then wait until after local midnight or manually insert a `food_log` row with an older `log_date` via the Supabase dashboard. Click the History tab and confirm the past day's totals show up, grouped correctly, most recent first.

- [ ] **Step 3: Commit**

```bash
git add macros.html
git commit -m "feat: History tab showing past days' macro totals"
```

---

## Self-Review Notes

- **Spec coverage:** every section of the design spec maps to a task — `food_log` table (Task 1), targets/remaining budget (Task 5), barcode scan + manual entry (Tasks 6–7), history (Task 8), water removal from `topbar.js`/`health.html` (Tasks 3–4), reused `calculateMacros()` (Task 2), local-date handling to avoid Vessel's UTC bug (Task 5's `todayKey()`, matches `topbar.js`'s existing `calendarDateKey()` style), `console.assert`/self-check pattern (Task 2, using this repo's actual `require`/`node` convention from `gym-workout-events.selfcheck.js` rather than the in-browser `console.assert` style — closer fit to this repo, same spirit as the spec's testing section).
- **Type/name consistency checked:** `macro_targets` (localStorage key), `food_log` (table + columns `log_date`/`protein_g`/`carb_g`/`fat_g`/`calories`/`source`/`barcode`), `window.MacroCalc.{calculateMacros,resolveServingMacros,remainingBudget,hasCompleteServingData}` — used identically across Tasks 2, 5, 6, 7, 8.
- **Out of scope, confirmed not built:** topbar macro pill, barcode caching, `macro_leads` cross-reference — none appear in any task above.

## Codex (terra) Second Opinion — Applied 2026-07-20

Ran before execution per Carl's CLAUDE.md gate. Verified the `topbar.js`/`health.html` removal claims against the live files (all accurate, no changes needed there) and flagged real issues in the barcode/data-integrity logic, now fixed above:

- **Fixed:** serving-completeness detection only checked `proteins_serving`, so a product missing e.g. `energy-kcal_serving` would silently report 0 calories instead of falling back to grams-mode. Now `hasCompleteServingData()` requires all four fields (Task 2), and the scan UI (Task 7) switches to a "grams eaten" input instead of "Servings" whenever data is incomplete — this was a real violation of the approved spec's serving-size fallback requirement, not just a nice-to-have.
- **Fixed:** `insertEntry`/`deleteEntry` silently discarded write failures; UI would refresh/close as if the write succeeded. Now both return `{ error }` and callers surface a plain `alert()` on failure (Tasks 5–7).
- **Fixed:** overlapping barcode decode callbacks could fire duplicate lookups. Added a `scanDecodeInFlight` guard (Task 7).
- **Fixed:** Open Food Facts product name/serving text were being inserted via `innerHTML` — OFF is a community-edited database and that data is untrusted. Switched to `textContent` throughout the scan-result rendering (Task 7).
- **Fixed:** the OFF fetch didn't check `res.ok` or the response's own `status` field, so a bad HTTP response or an OFF "product not found" payload could fall through weakly. Added both checks (Task 7).
- **Fixed:** no validation against negative/non-numeric macro values, either client-side (manual entry, Task 6) or at the database level. Added `check (x >= 0)` constraints plus a barcode/source consistency constraint to the migration (Task 1), and `num()`/`nonNegative()` coercion helpers used in `macro-calc.js`, manual entry, and history totals (Tasks 2, 6, 8).
- **Fixed:** a tab left open across local midnight would keep showing yesterday's budget until something happened to trigger a re-render. Added `focus`/`visibilitychange` listeners that call `refresh()` (Task 5) — the same pattern `topbar.js`'s old water-pill code used for the same reason.
- **Fixed:** spec/plan naming mismatch — spec said `date`, plan said `log_date`. Kept `log_date` (avoids the reserved-word ambiguity) and updated the spec to match.
- **Deliberately not changed — anonymous RLS on `food_log`:** matches the existing pattern already used by `app_state`, `workout_events`, `content_ideas`, and `coaching_clients` in this same repo — a single-user tool behind `topbar.js`'s passphrase gate. Codex flagged this as a real exposure (anyone with the public key can read/write/delete), which is true, but it's an existing Row-wide risk posture, not something newly introduced by this feature. Not building per-table auth for `food_log` alone while every other table stays anonymous — that would be an inconsistent security tier, not a fix. Flagging explicitly rather than silently accepting: if Carl wants real auth, that's a Row-wide change, not a macro-tracking-specific one.
- **Open, not resolved:** backdating/editing existing entries (currently delete-and-recreate only) and cross-timezone travel behavior (calendar day is tied to the device's local clock) are both out of scope for v1 per the spec — noted as open questions by Codex, deliberately deferred rather than missed.
