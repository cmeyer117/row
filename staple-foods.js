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
    { name: 'Ground Turkey 99% lean (cooked)', protein_100g: 25, carb_100g: 0, fat_100g: 1, calories_100g: 110 },
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
    { name: 'Cottage Cheese (fat-free)', protein_100g: 12, carb_100g: 4.3, fat_100g: 0.3, calories_100g: 72 },
    { name: 'Whey Protein Powder (generic, dry)', protein_100g: 80, carb_100g: 8, fat_100g: 5, calories_100g: 400 },
    { name: 'Tofu (firm)', protein_100g: 8, carb_100g: 1.9, fat_100g: 4.8, calories_100g: 76 },
    { name: 'Mozzarella (fat-free)', protein_100g: 25, carb_100g: 3.6, fat_100g: 0, calories_100g: 160 },
    { name: 'Cheddar Cheese (fat-free)', protein_100g: 28, carb_100g: 8, fat_100g: 0.5, calories_100g: 160 },
    { name: 'White Rice (cooked)', protein_100g: 2.7, carb_100g: 28, fat_100g: 0.3, calories_100g: 130 },
    { name: 'Brown Rice (cooked)', protein_100g: 2.6, carb_100g: 23, fat_100g: 0.9, calories_100g: 111 },
    { name: 'Cream of Rice (cooked)', protein_100g: 1.4, carb_100g: 17, fat_100g: 0.1, calories_100g: 75 },
    { name: 'Oats (dry, rolled)', protein_100g: 13.5, carb_100g: 68, fat_100g: 6.5, calories_100g: 379 },
    { name: 'Cocoa Powder (unsweetened)', protein_100g: 19.6, carb_100g: 57.9, fat_100g: 13.7, calories_100g: 228 },
    { name: 'Self-Raising Flour', protein_100g: 10, carb_100g: 76, fat_100g: 1, calories_100g: 364 },
    { name: 'Corn Flakes (dry)', protein_100g: 7, carb_100g: 84, fat_100g: 0.9, calories_100g: 378 },
    { name: 'White Potato (baked, w/ skin)', protein_100g: 2, carb_100g: 21, fat_100g: 0.1, calories_100g: 93 },
    { name: 'Sweet Potato (baked)', protein_100g: 2, carb_100g: 20.7, fat_100g: 0.1, calories_100g: 90 },
    { name: 'Sourdough Bread', protein_100g: 8.8, carb_100g: 51, fat_100g: 1.6, calories_100g: 231 },
    { name: 'Ezekiel Bread (generic)', protein_100g: 12, carb_100g: 42, fat_100g: 2, calories_100g: 250 },
    { name: 'Rice Cakes (plain)', protein_100g: 8, carb_100g: 82, fat_100g: 2.8, calories_100g: 387 },
    { name: 'Rice Chex Cereal (dry)', protein_100g: 6.5, carb_100g: 87, fat_100g: 0, calories_100g: 387 },
    { name: 'Quinoa (cooked)', protein_100g: 4.4, carb_100g: 21.3, fat_100g: 1.9, calories_100g: 120 },
    { name: 'Black Beans (cooked)', protein_100g: 8.9, carb_100g: 24, fat_100g: 0.5, calories_100g: 132 },
    { name: 'Chickpeas (cooked)', protein_100g: 8.9, carb_100g: 27, fat_100g: 2.6, calories_100g: 164 },
    { name: 'Lentils (cooked)', protein_100g: 9, carb_100g: 20, fat_100g: 0.4, calories_100g: 116 },
    { name: 'Banana', protein_100g: 1.1, carb_100g: 23, fat_100g: 0.3, calories_100g: 89 },
    { name: 'Pumpkin (canned, puree)', protein_100g: 1, carb_100g: 8, fat_100g: 0.3, calories_100g: 34 },
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
    { name: 'Avocado', protein_100g: 2, carb_100g: 8.5, fat_100g: 14.7, calories_100g: 160 },
    { name: 'Peanut Butter', protein_100g: 25, carb_100g: 20, fat_100g: 50, calories_100g: 588 },
    // Powdered PB (e.g. PB2) reconstituted with water + stevia — log the DRY POWDER
    // grams only, same convention as Oats/Cream of Rice. Water and stevia are both
    // ~0 calories, so they don't change the macros; weighing the finished paste would
    // just dilute the number for no reason.
    { name: 'Peanut Butter, Powdered (dry)', protein_100g: 33, carb_100g: 42, fat_100g: 13, calories_100g: 375 },
    { name: 'Almond Butter', protein_100g: 21, carb_100g: 19, fat_100g: 55, calories_100g: 614 },
    { name: 'Protein Bar (generic)', protein_100g: 20, carb_100g: 25, fat_100g: 8, calories_100g: 220 },
    // Kombucha is brand-variable (sugar content especially) — see the
    // sauce-rule caveat in Cooking Coach vault notes. This is a generic
    // low-sugar commercial average; swap in a label value if precision matters.
    { name: 'Kombucha (generic, bottled)', protein_100g: 0, carb_100g: 3.5, fat_100g: 0, calories_100g: 18 },
    // Zero/near-zero sugar bottled kombucha (e.g. GT's Zero Sugar-style
    // lines) -- residual sugar is what drives kombucha's calories, so a
    // sugar-free label runs close to 0 rather than this file's generic
    // entry's 18 cal/100g. Swap in the actual label figure if it's known.
    { name: 'Kombucha (sugar-free)', protein_100g: 0, carb_100g: 1, fat_100g: 0, calories_100g: 5 },
    // Carl's brand: ~10 cal per 2 tbsp (30ml). Carb estimated from typical
    // sugar-alcohol-based "sugar free" syrups at that calorie level (~4g
    // per 2 tbsp) -- swap in the actual label carb figure if it's known
    // and differs, same caveat as Kombucha/PB2 above.
    { name: 'Sugar-Free Maple Syrup', protein_100g: 0, carb_100g: 10, fat_100g: 0, calories_100g: 26 },
  ];

  const api = { FOODS };
  if (typeof window !== 'undefined') window.StapleFoods = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
