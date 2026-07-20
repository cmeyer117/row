# Macro Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-ingredient macro calculator to `macros.html` — pick foods from a curated staple-foods list, enter grams per ingredient, see live combined macros, and log the whole meal to today's tracker in one shot.

**Architecture:** A new static data file (`staple-foods.js`, ~59 bodybuilding-diet staples with USDA-sourced per-100g macros) plus one new pure function in `macro-calc.js` (`sumIngredients`). `macros.html` gets a 4th action button and a new modal reusing the existing `insertEntry()`/error-handling path already proven by Manual entry and Scan.

**Tech Stack:** Vanilla HTML/CSS/JS, no build step, no network calls for this feature (pure static lookup).

**Spec:** `docs/superpowers/specs/2026-07-20-macro-calculator-design.md`

---

### Task 1: `staple-foods.js` data file + self-check

**Files:**
- Create: `staple-foods.js`
- Create: `staple-foods.selfcheck.js`

- [ ] **Step 1: Write `staple-foods.js`**

```js
// staple-foods.js — curated bodybuilding-diet staple foods with USDA
// FoodData Central per-100g macro values. Static lookup, no network —
// same trust tier and dual-export pattern as gym-workout-events.js and
// macro-calc.js. A few entries (whey protein, protein bar, turkey
// bacon, Ezekiel bread) are brand-variable by nature; values here are
// generic/approximate — swap in a specific product's label if precision
// matters for one of those.
(function () {
  'use strict';

  const FOODS = [
    { name: 'Chicken Breast (cooked)', protein_100g: 31, carb_100g: 0, fat_100g: 3.6, calories_100g: 165 },
    { name: 'Chicken Thigh (cooked, skinless)', protein_100g: 26, carb_100g: 0, fat_100g: 10.9, calories_100g: 209 },
    { name: 'Turkey Breast (cooked)', protein_100g: 29, carb_100g: 0, fat_100g: 1, calories_100g: 135 },
    { name: 'Turkey Bacon (cooked, generic)', protein_100g: 25, carb_100g: 1.5, fat_100g: 20, calories_100g: 290 },
    { name: 'Ground Beef 93/7 (cooked)', protein_100g: 26, carb_100g: 0, fat_100g: 8, calories_100g: 176 },
    { name: 'Ground Beef 85/15 (cooked)', protein_100g: 24, carb_100g: 0, fat_100g: 15, calories_100g: 250 },
    { name: 'Ground Turkey 93/7 (cooked)', protein_100g: 27, carb_100g: 0, fat_100g: 8, calories_100g: 189 },
    { name: 'Sirloin Steak (cooked)', protein_100g: 29, carb_100g: 0, fat_100g: 8, calories_100g: 201 },
    { name: 'Filet Mignon (cooked)', protein_100g: 28, carb_100g: 0, fat_100g: 15, calories_100g: 267 },
    { name: 'Pork Chop (cooked, lean)', protein_100g: 27, carb_100g: 0, fat_100g: 9, calories_100g: 195 },
    { name: 'Bison (cooked, ground)', protein_100g: 28, carb_100g: 0, fat_100g: 7, calories_100g: 180 },
    { name: 'Tilapia (cooked)', protein_100g: 26, carb_100g: 0, fat_100g: 2.7, calories_100g: 128 },
    { name: 'Cod (cooked)', protein_100g: 23, carb_100g: 0, fat_100g: 0.9, calories_100g: 105 },
    { name: 'Halibut (cooked)', protein_100g: 27, carb_100g: 0, fat_100g: 2.3, calories_100g: 128 },
    { name: 'Salmon (cooked)', protein_100g: 25, carb_100g: 0, fat_100g: 13, calories_100g: 208 },
    { name: 'Shrimp (cooked)', protein_100g: 24, carb_100g: 0.2, fat_100g: 0.3, calories_100g: 99 },
    { name: 'Tuna, canned in water (drained)', protein_100g: 26, carb_100g: 0, fat_100g: 0.8, calories_100g: 116 },
    { name: 'Eggs, whole (cooked)', protein_100g: 13, carb_100g: 1.1, fat_100g: 11, calories_100g: 155 },
    { name: 'Egg Whites', protein_100g: 11, carb_100g: 0.7, fat_100g: 0.2, calories_100g: 52 },
    { name: 'Greek Yogurt (plain, nonfat)', protein_100g: 10, carb_100g: 3.6, fat_100g: 0.4, calories_100g: 59 },
    { name: 'Cottage Cheese (2%)', protein_100g: 11, carb_100g: 3.4, fat_100g: 2.3, calories_100g: 81 },
    { name: 'Whey Protein Powder (generic, dry)', protein_100g: 80, carb_100g: 8, fat_100g: 5, calories_100g: 400 },
    { name: 'Tofu (firm)', protein_100g: 8, carb_100g: 1.9, fat_100g: 4.8, calories_100g: 76 },
    { name: 'Mozzarella (part-skim)', protein_100g: 24, carb_100g: 3, fat_100g: 17, calories_100g: 254 },
    { name: 'Cheddar Cheese', protein_100g: 25, carb_100g: 1.3, fat_100g: 33, calories_100g: 403 },
    { name: 'White Rice (cooked)', protein_100g: 2.7, carb_100g: 28, fat_100g: 0.3, calories_100g: 130 },
    { name: 'Brown Rice (cooked)', protein_100g: 2.6, carb_100g: 23, fat_100g: 0.9, calories_100g: 111 },
    { name: 'Cream of Rice (cooked)', protein_100g: 1.4, carb_100g: 17, fat_100g: 0.1, calories_100g: 75 },
    { name: 'Oats (dry, rolled)', protein_100g: 13.5, carb_100g: 68, fat_100g: 6.5, calories_100g: 379 },
    { name: 'White Potato (baked, w/ skin)', protein_100g: 2, carb_100g: 21, fat_100g: 0.1, calories_100g: 93 },
    { name: 'Sweet Potato (baked)', protein_100g: 2, carb_100g: 20.7, fat_100g: 0.1, calories_100g: 90 },
    { name: 'Sourdough Bread', protein_100g: 8.8, carb_100g: 51, fat_100g: 1.6, calories_100g: 231 },
    { name: 'Ezekiel Bread (generic)', protein_100g: 12, carb_100g: 42, fat_100g: 2, calories_100g: 250 },
    { name: 'Rice Cakes (plain)', protein_100g: 8, carb_100g: 82, fat_100g: 2.8, calories_100g: 387 },
    { name: 'Quinoa (cooked)', protein_100g: 4.4, carb_100g: 21.3, fat_100g: 1.9, calories_100g: 120 },
    { name: 'Black Beans (cooked)', protein_100g: 8.9, carb_100g: 24, fat_100g: 0.5, calories_100g: 132 },
    { name: 'Chickpeas (cooked)', protein_100g: 8.9, carb_100g: 27, fat_100g: 2.6, calories_100g: 164 },
    { name: 'Lentils (cooked)', protein_100g: 9, carb_100g: 20, fat_100g: 0.4, calories_100g: 116 },
    { name: 'Banana', protein_100g: 1.1, carb_100g: 23, fat_100g: 0.3, calories_100g: 89 },
    { name: 'Blueberries', protein_100g: 0.7, carb_100g: 14.5, fat_100g: 0.3, calories_100g: 57 },
    { name: 'Apple', protein_100g: 0.3, carb_100g: 14, fat_100g: 0.2, calories_100g: 52 },
    { name: 'Broccoli (cooked)', protein_100g: 2.8, carb_100g: 7, fat_100g: 0.4, calories_100g: 35 },
    { name: 'Spinach (cooked)', protein_100g: 2.9, carb_100g: 3.6, fat_100g: 0.4, calories_100g: 23 },
    { name: 'Asparagus (cooked)', protein_100g: 2.4, carb_100g: 3.9, fat_100g: 0.2, calories_100g: 20 },
    { name: 'Green Beans (cooked)', protein_100g: 1.8, carb_100g: 7, fat_100g: 0.2, calories_100g: 35 },
    { name: 'Cauliflower (cooked)', protein_100g: 1.8, carb_100g: 5, fat_100g: 0.5, calories_100g: 25 },
    { name: 'Bell Pepper (raw)', protein_100g: 1, carb_100g: 6, fat_100g: 0.3, calories_100g: 31 },
    { name: 'Cucumber (raw)', protein_100g: 0.7, carb_100g: 3.6, fat_100g: 0.1, calories_100g: 15 },
    { name: 'Mixed Greens / Lettuce (raw)', protein_100g: 1.4, carb_100g: 2.9, fat_100g: 0.2, calories_100g: 15 },
    { name: 'Almonds', protein_100g: 21, carb_100g: 22, fat_100g: 50, calories_100g: 579 },
    { name: 'Peanut Butter', protein_100g: 25, carb_100g: 20, fat_100g: 50, calories_100g: 588 },
    { name: 'Walnuts', protein_100g: 15, carb_100g: 14, fat_100g: 65, calories_100g: 654 },
    { name: 'Cashews', protein_100g: 18, carb_100g: 30, fat_100g: 44, calories_100g: 553 },
    { name: 'Avocado', protein_100g: 2, carb_100g: 8.5, fat_100g: 14.7, calories_100g: 160 },
    { name: 'Olive Oil', protein_100g: 0, carb_100g: 0, fat_100g: 100, calories_100g: 884 },
    { name: 'Coconut Oil', protein_100g: 0, carb_100g: 0, fat_100g: 100, calories_100g: 862 },
    { name: 'Butter', protein_100g: 0.9, carb_100g: 0.1, fat_100g: 81, calories_100g: 717 },
    { name: 'Protein Bar (generic)', protein_100g: 20, carb_100g: 25, fat_100g: 8, calories_100g: 220 },
  ];

  const api = { FOODS };
  if (typeof window !== 'undefined') window.StapleFoods = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 2: Write `staple-foods.selfcheck.js`**

```js
// Run with: node staple-foods.selfcheck.js
'use strict';

const { FOODS } = require('./staple-foods.js');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
}

assertEqual(FOODS.length >= 59, true, 'staple-foods dataset has at least 59 entries');

const chicken = FOODS.find((f) => f.name === 'Chicken Breast (cooked)');
assertEqual(!!chicken, true, 'Chicken Breast (cooked) exists in the dataset');
assertEqual(chicken.protein_100g, 31, 'Chicken Breast protein_100g');
assertEqual(chicken.carb_100g, 0, 'Chicken Breast carb_100g');
assertEqual(chicken.fat_100g, 3.6, 'Chicken Breast fat_100g');
assertEqual(chicken.calories_100g, 165, 'Chicken Breast calories_100g');

const rice = FOODS.find((f) => f.name === 'White Rice (cooked)');
assertEqual(rice.calories_100g, 130, 'White Rice calories_100g');

const broccoli = FOODS.find((f) => f.name === 'Broccoli (cooked)');
assertEqual(broccoli.protein_100g, 2.8, 'Broccoli protein_100g');

// No duplicate names — each is a unique dropdown option.
const names = FOODS.map((f) => f.name);
assertEqual(new Set(names).size, names.length, 'no duplicate food names in the dataset');

console.log('staple-foods.selfcheck.js: all assertions passed');
```

- [ ] **Step 3: Run the self-check, verify it passes**

Run: `node staple-foods.selfcheck.js`
Expected: `staple-foods.selfcheck.js: all assertions passed`

- [ ] **Step 4: Commit**

```bash
git add staple-foods.js staple-foods.selfcheck.js
git commit -m "feat: add curated staple-foods dataset + self-check"
```

---

### Task 2: `sumIngredients()` in `macro-calc.js`

**Files:**
- Modify: `macro-calc.js`
- Modify: `macro-calc.selfcheck.js`

- [ ] **Step 1: Add `sumIngredients` to `macro-calc.js`**

Add this function inside the IIFE, after `remainingBudget` and before the `const api = ...` line:

```js
  // rows: [{ foodName, grams }]. foods: an array shaped like
  // StapleFoods.FOODS ({ name, protein_100g, carb_100g, fat_100g,
  // calories_100g }) — passed in rather than imported, keeping this file
  // dependency-free like the rest of it. A row whose foodName doesn't
  // match anything in foods, or whose grams isn't a valid positive
  // number, contributes 0 rather than throwing or producing NaN.
  function sumIngredients(rows, foods) {
    const byName = {};
    (foods || []).forEach((f) => { byName[f.name] = f; });

    return (rows || []).reduce((acc, row) => {
      const food = byName[row.foodName];
      const grams = num(row.grams, 0);
      if (!food || grams <= 0) return acc;
      const factor = grams / 100;
      return {
        protein_g: round1(acc.protein_g + num(food.protein_100g, 0) * factor),
        carb_g: round1(acc.carb_g + num(food.carb_100g, 0) * factor),
        fat_g: round1(acc.fat_g + num(food.fat_100g, 0) * factor),
        calories: round1(acc.calories + num(food.calories_100g, 0) * factor),
      };
    }, { protein_g: 0, carb_g: 0, fat_g: 0, calories: 0 });
  }
```

- [ ] **Step 2: Add it to the exports**

Change:

```js
  const api = { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData };
```

to:

```js
  const api = { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData, sumIngredients };
```

- [ ] **Step 3: Add test cases to `macro-calc.selfcheck.js`**

Change the require line:

```js
const { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData } = require('./macro-calc.js');
```

to:

```js
const { calculateMacros, resolveServingMacros, remainingBudget, hasCompleteServingData, sumIngredients } = require('./macro-calc.js');
const { FOODS } = require('./staple-foods.js');
```

Add these cases at the end of the file, before the final `console.log`:

```js
// sumIngredients — Carl's own example: 200g White Rice + 200g Chicken
// Breast + 50g Broccoli. Hand-computed expected total:
//   protein: 200*2.7/100 + 200*31/100 + 50*2.8/100   = 5.4 + 62 + 1.4   = 68.8
//   carb:    200*28/100  + 200*0/100  + 50*7/100     = 56 + 0 + 3.5     = 59.5
//   fat:     200*0.3/100 + 200*3.6/100 + 50*0.4/100  = 0.6 + 7.2 + 0.2  = 8
//   cal:     200*130/100 + 200*165/100 + 50*35/100   = 260 + 330 + 17.5 = 607.5
const meal = sumIngredients([
  { foodName: 'White Rice (cooked)', grams: 200 },
  { foodName: 'Chicken Breast (cooked)', grams: 200 },
  { foodName: 'Broccoli (cooked)', grams: 50 },
], FOODS);
assertEqual(meal.protein_g, 68.8, 'sumIngredients protein for Carl\'s example meal');
assertEqual(meal.carb_g, 59.5, 'sumIngredients carb for Carl\'s example meal');
assertEqual(meal.fat_g, 8, 'sumIngredients fat for Carl\'s example meal');
assertEqual(meal.calories, 607.5, 'sumIngredients calories for Carl\'s example meal');

// sumIngredients — an unmatched food name contributes 0, not NaN.
const withUnknown = sumIngredients([
  { foodName: 'White Rice (cooked)', grams: 100 },
  { foodName: 'Nonexistent Food', grams: 999 },
], FOODS);
assertEqual(withUnknown.protein_g, 2.7, 'sumIngredients ignores an unmatched food name');

// sumIngredients — a zero/negative grams row is skipped.
const withZero = sumIngredients([
  { foodName: 'White Rice (cooked)', grams: 100 },
  { foodName: 'Chicken Breast (cooked)', grams: 0 },
  { foodName: 'Broccoli (cooked)', grams: -10 },
], FOODS);
assertEqual(withZero.calories, 130, 'sumIngredients skips zero/negative-gram rows');
```

- [ ] **Step 4: Run both self-checks, verify they pass**

Run: `node macro-calc.selfcheck.js && node staple-foods.selfcheck.js`
Expected: both print their `all assertions passed` line, no `FAIL` output.

- [ ] **Step 5: Commit**

```bash
git add macro-calc.js macro-calc.selfcheck.js
git commit -m "feat: add sumIngredients() for multi-ingredient meal totals"
```

---

### Task 3: Calculator button + modal in `macros.html`

**Files:**
- Modify: `macros.html`

- [ ] **Step 1: Load `staple-foods.js` in `<head>`**

Change:

```html
<script src="macro-calc.js"></script>
```

to:

```html
<script src="macro-calc.js"></script>
<script src="staple-foods.js"></script>
```

- [ ] **Step 2: Switch the action-button row from a 3-across flex row to a 2×2 grid**

Change (`macros.html:54`):

```css
.mt-btn-row { display: flex; gap: 10px; margin-bottom: 16px; }
```

to:

```css
.mt-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
```

Add these two new rules right after `.mt-action-btn`'s existing block (after its closing `}`, before `.mt-entry`):

```css
.mt-calc-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.mt-calc-row select { flex: 3; }
.mt-calc-row input { flex: 1; min-width: 0; }
.mt-calc-row button { flex: 0 0 auto; }
.mt-calc-totals {
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 13px;
  margin: 12px 0; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.04);
}
```

- [ ] **Step 3: Add the 4th button**

Change (`macros.html:125-129`):

```html
<div class="mt-btn-row">
<button class="mt-action-btn" id="mtScanBtn" type="button">📷 Scan</button>
<button class="mt-action-btn" id="mtManualBtn" type="button">✏️ Manual</button>
<button class="mt-action-btn" id="mtTargetsBtn" type="button">🎯 Targets</button>
</div>
```

to:

```html
<div class="mt-btn-row">
<button class="mt-action-btn" id="mtScanBtn" type="button">📷 Scan</button>
<button class="mt-action-btn" id="mtManualBtn" type="button">✏️ Manual</button>
<button class="mt-action-btn" id="mtCalcBtn" type="button">🧮 Calculator</button>
<button class="mt-action-btn" id="mtTargetsBtn" type="button">🎯 Targets</button>
</div>
```

- [ ] **Step 4: Add the Calculator modal markup**

Insert after the Scan modal's closing `</div>` (`macros.html:208`), before `<script>`:

```html
<!-- Calculator modal -->
<div class="mt-modal-bg" id="mtCalcModalBg">
  <div class="mt-modal">
    <h3 style="margin-top:0;">Macro Calculator</h3>
    <div id="mtCalcRows"></div>
    <button class="mt-btn-secondary" id="mtCalcAddRow" type="button" style="width:100%;margin-bottom:12px;">+ Add ingredient</button>
    <div class="mt-calc-totals" id="mtCalcTotals">0p / 0c / 0f — 0cal</div>
    <div class="mt-modal-actions">
      <button class="mt-btn-secondary" id="mtCalcCancel" type="button">Cancel</button>
      <button class="mt-btn-primary" id="mtCalcAddToday" type="button">Add to Today</button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Add the Calculator JS**

Insert into the `<script>` block, immediately before the `// ---- Tabs ----` comment:

```js
// ---- Macro calculator ----
let calcRowCount = 0;

function calcFoodOptionsHtml() {
  return window.StapleFoods.FOODS
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => '<option value="' + f.name + '">' + f.name + '</option>')
    .join('');
}

function addCalcRow() {
  const id = 'calcRow' + (calcRowCount++);
  const row = document.createElement('div');
  row.className = 'mt-calc-row';
  row.dataset.rowId = id;
  row.innerHTML =
    '<select class="mt-calc-food"><option value="">Select food…</option>' + calcFoodOptionsHtml() + '</select>' +
    '<input type="number" class="mt-calc-grams" placeholder="grams" min="0">' +
    '<button type="button" class="mt-entry-del">✕</button>';
  row.querySelector('select').addEventListener('change', renderCalcTotals);
  row.querySelector('input').addEventListener('input', renderCalcTotals);
  row.querySelector('button').addEventListener('click', () => { row.remove(); renderCalcTotals(); });
  $('mtCalcRows').appendChild(row);
}

function collectCalcRows() {
  return Array.from(document.querySelectorAll('.mt-calc-row')).map((row) => ({
    foodName: row.querySelector('select').value,
    grams: Number(row.querySelector('input').value) || 0,
  }));
}

function renderCalcTotals() {
  const totals = window.MacroCalc.sumIngredients(collectCalcRows(), window.StapleFoods.FOODS);
  $('mtCalcTotals').textContent =
    totals.protein_g + 'p / ' + totals.carb_g + 'c / ' + totals.fat_g + 'f — ' + totals.calories + 'cal';
}

function calcMealName() {
  return collectCalcRows()
    .filter((r) => r.foodName && r.grams > 0)
    .map((r) => r.grams + 'g ' + r.foodName)
    .join(', ');
}

function openCalcModal() {
  $('mtCalcRows').innerHTML = '';
  calcRowCount = 0;
  addCalcRow();
  addCalcRow();
  renderCalcTotals();
  $('mtCalcModalBg').classList.add('show');
}
function closeCalcModal() { $('mtCalcModalBg').classList.remove('show'); }

$('mtCalcBtn').addEventListener('click', openCalcModal);
$('mtCalcCancel').addEventListener('click', closeCalcModal);
$('mtCalcAddRow').addEventListener('click', addCalcRow);
$('mtCalcAddToday').addEventListener('click', async () => {
  const name = calcMealName();
  if (!name) return;
  const totals = window.MacroCalc.sumIngredients(collectCalcRows(), window.StapleFoods.FOODS);
  const { error } = await insertEntry({
    name,
    protein_g: totals.protein_g,
    carb_g: totals.carb_g,
    fat_g: totals.fat_g,
    calories: totals.calories,
    source: 'manual',
    barcode: null,
  });
  if (error) { showEntryError('Could not save entry — try again.'); return; }
  closeCalcModal();
  refresh();
});
```

- [ ] **Step 6: Manually verify**

Open `macros.html` in a browser (dev server: `preview_start` with the existing `row` launch config). Click Calculator — confirm two blank rows appear, the food dropdown is populated and alphabetized. Select "White Rice (cooked)" and enter `200`, select "Chicken Breast (cooked)" and enter `200`, click "+ Add ingredient," select "Broccoli (cooked)" and enter `50`. Confirm the totals line reads `68.8p / 59.5c / 8f — 607.5cal` (matching Task 2's hand-computed test case) and updates live as you type/select. Click "Add to Today" and confirm it appears in the today list as `"200g White Rice (cooked), 200g Chicken Breast (cooked), 50g Broccoli (cooked)"` with the budget bars updating accordingly. Remove a row via ✕ and confirm the totals recompute.

- [ ] **Step 7: Commit**

```bash
git add macros.html
git commit -m "feat: multi-ingredient macro calculator in macros.html"
```

---

## Self-Review Notes

- **Spec coverage:** curated dataset (Task 1) · `sumIngredients` pure function (Task 2) · repeatable rows/live totals/"Add to Today" reusing `insertEntry` (Task 3) · 2×2 button grid to fit the 4th button (Task 3, Step 2) · self-checks for both the dataset and the sum math, including Carl's own example meal and an unmatched-food/zero-grams case (Tasks 1-2).
- **Type/name consistency checked:** `staple-foods.js` exports `{ FOODS }` (array), consumed identically in `macro-calc.selfcheck.js` and in `macros.html`'s `window.StapleFoods.FOODS`. `sumIngredients(rows, foods)` signature matches every call site (selfcheck and the two calculator functions that call it). `insertEntry()`/`showEntryError()`/`refresh()` reused unchanged from the existing Manual-entry path — no new write or error-handling logic invented.
- **Out of scope, confirmed not built:** free-text parsing, in-UI dataset editing, coach-diet-sheet-exact matching — none appear in any task above.
