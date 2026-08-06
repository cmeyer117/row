// coach-meal-plan.js — default ingredient rows for the coach's prescribed
// 5-meal plan, one row per StapleFoods entry + grams. NOT a live sync from
// the vault — reflects the coaching phase as of 2026-08-06: Black Magma
// Fitness, Coach Chris Eastman, "Recomp Phase," started 8/2/26. Source PDF:
// G:\My Drive\Coaching documents\BLACK MAGMA FITNESS CLIENT Carl - Macros.doc.pdf
// (check that folder for the newest-dated file next time this needs updating).
//
// Where the coach's plan lists an OR choice (protein, carb), the row here
// defaults to the first-listed option — macros.html's Calculator modal's
// existing per-row food dropdown is the picker: change the dropdown to log
// what was actually eaten instead of the default. Fruit/veggie rows default
// to Banana/Broccoli since the coach's plan names those generically
// ("fruit", "veggies — anything but corn"), not as a specific OR choice.
(function () {
  'use strict';

  const MEALS = [
    {
      label: 'Meal 1',
      rows: [
        { foodName: 'Eggs, whole (cooked)', grams: 100 },
        { foodName: 'Egg Whites', grams: 45 },
        { foodName: 'Turkey Bacon (cooked, generic)', grams: 30 },
        { foodName: 'Banana', grams: 200 },
        { foodName: 'Oats (dry, rolled)', grams: 20 },
        { foodName: 'Broccoli (cooked)', grams: 150 },
      ],
    },
    {
      label: 'Meal 2',
      rows: [
        { foodName: 'Chicken Breast (cooked)', grams: 170 },
        { foodName: 'White Rice (cooked)', grams: 250 },
        { foodName: 'Broccoli (cooked)', grams: 150 },
      ],
    },
    {
      label: 'Meal 3',
      rows: [
        { foodName: 'Chicken Breast (cooked)', grams: 170 },
        { foodName: 'White Rice (cooked)', grams: 200 },
        { foodName: 'Broccoli (cooked)', grams: 150 },
      ],
    },
    {
      label: 'Meal 4',
      rows: [
        { foodName: 'Chicken Breast (cooked)', grams: 170 },
        { foodName: 'White Rice (cooked)', grams: 250 },
        { foodName: 'Broccoli (cooked)', grams: 150 },
      ],
    },
    {
      label: 'Meal 5',
      rows: [
        { foodName: 'Ground Beef 93/7 (cooked)', grams: 170 },
        { foodName: 'Sourdough Bread', grams: 65 },
        { foodName: 'Broccoli (cooked)', grams: 150 },
        { foodName: 'Kombucha (generic, bottled)', grams: 227 },
        { foodName: 'Banana', grams: 200 },
      ],
    },
    {
      label: 'Pre/Post-Workout',
      rows: [
        { foodName: 'White Rice (cooked)', grams: 50 },
      ],
    },
  ];

  const api = { MEALS };
  if (typeof window !== 'undefined') window.CoachMealPlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
