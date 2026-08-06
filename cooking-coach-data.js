// cooking-coach-data.js — condensed cooking guidance ported by hand from the
// vault's Cooking Technique notes (Carl Meyer/04 - Fitness/Recipes/Cooking
// Technique/). NOT a live sync. MEAL_PLAN reflects the coaching phase as of
// 2026-08-06: Black Magma Fitness, Coach Chris Eastman, "Recomp Phase,"
// started 8/2/26. Source PDF: G:\My Drive\Coaching documents\BLACK MAGMA
// FITNESS CLIENT Carl - Macros.doc.pdf (check that folder for the newest-
// dated file next time this needs updating — the coach updates it in place).
(function () {
  'use strict';

  const MEAL_PLAN = {
    phase: 'Recomp Phase — Black Magma Fitness, Coach Chris Eastman (started 8/2/26)',
    meals: [
      {
        label: 'Meal 1',
        build: '2 whole eggs, 45g egg whites, 2 slices turkey bacon, 200g fruit, 20g oats OR 30g cream of rice, 1 cup green veggies',
        foods: ['Eggs, whole (cooked)', 'Egg Whites', 'Turkey Bacon (cooked, generic)', 'Fruit (200g)', 'Oats (dry, rolled)', 'Cream of Rice (cooked)', 'Veggies (1 cup)'],
      },
      {
        label: 'Meal 2',
        build: '6oz chicken/tilapia/99% ground turkey, 250g rice OR 375g potatoes, 1 cup veggies',
        foods: ['Chicken Breast (cooked)', 'Tilapia (cooked)', 'Ground Turkey (99% lean)', 'White Rice (cooked)', 'White Potato (baked, w/ skin)', 'Veggies (1 cup)'],
      },
      {
        label: 'Meal 3',
        build: '6oz chicken/tilapia/99% ground turkey, 200g rice OR 525g potatoes, 1 cup veggies',
        foods: ['Chicken Breast (cooked)', 'Tilapia (cooked)', 'Ground Turkey (99% lean)', 'White Rice (cooked)', 'White Potato (baked, w/ skin)', 'Veggies (1 cup)'],
      },
      {
        label: 'Meal 4',
        build: '6oz chicken/tilapia/99% ground turkey, 250g rice OR 375g potatoes, 1 cup veggies',
        foods: ['Chicken Breast (cooked)', 'Tilapia (cooked)', 'Ground Turkey (99% lean)', 'White Rice (cooked)', 'White Potato (baked, w/ skin)', 'Veggies (1 cup)'],
      },
      {
        label: 'Meal 5',
        build: '6oz 93/7 ground beef or salmon, 65g sourdough (real fat), 1 cup veggies, 8oz kombucha, 200g fruit',
        foods: ['Ground Beef 93/7 (cooked)', 'Salmon (cooked)', 'Sourdough Bread', 'Veggies (1 cup)', 'Kombucha (8oz)', 'Fruit (200g)'],
      },
      {
        label: 'Pre/post-workout',
        build: '+50g rice OR +75g potatoes',
        foods: ['White Rice (cooked)', 'White Potato (baked, w/ skin)'],
      },
    ],
  };

  const COOKING_GUIDES = {
    'Chicken Breast (cooked)': {
      method: 'Reverse sear (whole, hot-served) / poach (shredded) / air fryer (hands-off)',
      tempTime: 'Pull at 155-160°F thick pieces with a verified hold, 165°F thin cutlets',
      steps: [
        'Salt ahead: dry brine 45+ min (overnight ideal) or wet brine 3 tbsp salt per 1.5qt water, 30-60 min',
        'Pound thick end flat or slice into even cutlets so it cooks evenly',
        'Reverse sear: covered dish, 275°F oven ~30 min, pat dry, hard sear ~2 min for crust',
        'Air fryer: 375°F, 10-14 min, flip at half, light oil spray for color',
      ],
      keyTip: 'Cook to temperature, not time or color — instant-read thermometer in the thickest part.',
      mistake: 'Trusting a rest to finish the cook. A 5-minute rest is not a guaranteed safety hold in a thin cutlet.',
    },
    'Ground Beef 93/7 (cooked)': {
      method: 'Steel pan, hard sear',
      tempTime: 'Pull at 160°F, no pink math',
      steps: [
        "Press flat into a hot pan and leave it — don't stir early",
        'Let one side brown fully, then break it up',
        "Don't crowd the pan — two batches beats one gray batch",
      ],
      keyTip: 'The crust is the flavor difference between good and sad ground beef.',
      mistake: 'Stirring immediately steams the meat in its own liquid and turns it gray.',
    },
    'Ground Beef 85/15 (cooked)': {
      method: 'Steel pan, hard sear (same as 93/7)',
      tempTime: 'Pull at 160°F, no pink math',
      steps: [
        'Press flat into a hot pan, leave until one side browns, then break up',
        "Don't crowd the pan",
        'Can brown and drain if a leaner macro is needed — loses some flavor but keeps the browning',
      ],
      keyTip: 'Fat ratio is a macro decision, not a quality one — 80/20 tastes better, 93/7 cuts leaner.',
      mistake: 'Stirring immediately steams the meat instead of browning it.',
    },
    'Ground Turkey (99% lean)': {
      method: 'Steel pan, hard sear, with added liquid',
      tempTime: 'Pull at 165°F (ground poultry floor) — verify with a thermometer',
      steps: [
        "Mix 2-3 tbsp broth or water in raw before it hits the pan — not optional at 99% lean, it has no fat to protect it",
        'Press flat, leave until it browns, then break up',
        'Pull slightly early and verify temp — it looks done well before it safely is',
      ],
      keyTip: 'Needs the sauce/seasoning more than any other protein in the rotation — dry rubs (Cajun, Taco/Southwest) hide the blandness best.',
      mistake: "A few extra minutes past done and it's chalk — the margin for error is small with zero fat.",
    },
    'Sirloin Steak (cooked)': {
      method: 'Thickness picks the method: under 1" = hot-and-fast pan sear, 1.5"+ = reverse sear',
      tempTime: 'USDA: 145°F + 3-min rest minimum. Medium-rare 130-135°F / medium 140-145°F final for lean cuts',
      steps: [
        'Under 1": screaming-hot pan, pat bone-dry, flip often, butter/garlic/thyme baste last 60 sec, rest 5-10 min',
        '1.5"+: dry brine 40-60 min, 225-275°F oven until 10-15°F below target, then 45-90 sec/side in ripping-hot cast iron',
        'Slice thin against the grain',
      ],
      keyTip: 'Reverse sear keeps the overcooked gray band thinner because the temperature gradient stays shallow.',
      mistake: "Air-frying a thick steak alone — it dries the surface but never gets hot enough for real crust. Pan finish is not optional.",
    },
    'Filet Mignon (cooked)': {
      method: "Reverse sear (it's a thick cut)",
      tempTime: 'USDA: 145°F + 3-min rest minimum. Medium-rare 130-135°F final',
      steps: [
        'Dry brine 40-60 min, or overnight uncovered on a rack in the fridge for the best crust',
        '225-275°F oven until internal temp is 10-15°F below target',
        'Ripping-hot cast iron, thin film of high-smoke-point oil, sear 45-90 sec per side',
      ],
      keyTip: 'Little quality rest is needed after — the gradient is already shallow.',
      mistake: 'Searing first on a thick cut shocks the outside while the center is cold, overcooking a wide gray band.',
    },
    'Salmon (cooked)': {
      method: 'Cold-pan sear, skin down',
      tempTime: 'Pull ~120-125°F center (medium-rare, best for wild) up to 140°F (USDA well-done)',
      steps: [
        'Dry brine 30 min, pat completely dry',
        'Lay skin-side down in a COLD, dry pan — no oil — then turn heat to medium',
        'Cook 6-8 min without touching it; the skin releases on its own when ready',
        'Flip, 30-90 sec on the flesh side, pull',
      ],
      keyTip: "If the skin is stuck, it isn't done — it self-releases. Don't force it.",
      mistake: 'Starting in a hot pan skips the fat-rendering window — skin clamps, curls, sticks, tears.',
    },
    'Tilapia (cooked)': {
      method: 'Hot pan or air fryer — cook fully opaque, no medium-rare zone for white fish',
      tempTime: 'Flakes at 140°F',
      steps: [
        "Pat surface thoroughly dry, don't crowd the pan",
        'Hot pan: roughly 10 min per inch of thickness, verify with a thermometer',
        'Air fryer: 380°F, 8-10 min, no flip — too delicate to flip',
      ],
      keyTip: 'Leanest protein available — the lever when fat needs to come down without touching protein.',
      mistake: 'Treating it like salmon and pulling it early. White fish has no fat safety net.',
    },
    'Cod (cooked)': {
      method: 'Hot pan or air fryer — cook fully opaque',
      tempTime: 'Flakes at 140°F',
      steps: [
        "Pat surface thoroughly dry, don't crowd the pan",
        'Hot pan: roughly 10 min per inch of thickness, verify with a thermometer',
        'Air fryer: 380°F, 8-10 min, no flip',
      ],
      keyTip: 'Spray the basket in the air fryer — lean fish glues itself to bare metal.',
      mistake: "Flipping it in the air fryer — too delicate, let it cook undisturbed.",
    },
    'Halibut (cooked)': {
      method: 'Hot pan or air fryer — cook fully opaque',
      tempTime: 'Flakes at 140°F',
      steps: [
        "Pat surface thoroughly dry, don't crowd the pan",
        'Hot pan: roughly 10 min per inch of thickness, verify with a thermometer',
        'Air fryer: 380°F, 8-10 min, no flip',
      ],
      keyTip: "Lean, no fat safety net — don't chase the medium-rare texture that works for salmon.",
      mistake: 'Cooking by the clock instead of verifying with a thermometer.',
    },
    'Eggs, whole (cooked)': {
      method: 'Scrambled (best texture) / hard-boiled / soft-boiled — pick by use case',
      tempTime: 'Yolk ~149°F, white ~185°F for full set (whole-egg methods are a compromise between the two)',
      steps: [
        'Scrambled: salt the beaten eggs and rest 15 min before cooking, real fat, low heat, pull while still glossy — carryover finishes them',
        'Hard-boiled: lower into ALREADY BOILING water (not cold start), lowest simmer 11-12 min, ice bath — this is what makes them peel easily',
        'Soft-boiled: steamer over simmering water, 6-7 min runny, 9-10 min jammy',
      ],
      keyTip: "Cooking substantially improves protein digestion vs raw — cook them, don't leave them runny.",
      mistake: 'Runny yolks carry real Salmonella risk — FDA guidance is firm yolks and whites unless using pasteurized shell eggs.',
    },
    'Egg Whites': {
      method: 'Nonstick pan, medium-low heat, patience — or air-fryer "boiled"',
      tempTime: 'White sets ~185°F',
      steps: [
        "Nonstick pan, medium-low, don't rush it",
        'Air fryer (as part of whole eggs "boiled"): 270°F, 15-17 min straight from the fridge, ice bath after',
      ],
      keyTip: 'Fold into oats or cream of rice for invisible protein volume without a separate cook step.',
      mistake: 'High heat turns them rubbery — this is the one place patience matters more than speed.',
    },
    'White Rice (cooked)': {
      method: 'Stovetop absorption or rice cooker',
      tempTime: 'Long-grain: 1.5-2 cups water per 1 cup dry, simmer 15-18 min, rest 10 min covered',
      steps: [
        'Rice cooker needs less water than stovetop — roughly 1:1.25 for white (sealed, minimal evaporation)',
        "Don't lift the lid, don't stir while it cooks",
        'Rest covered before fluffing, then fluff with a fork, not a spoon',
      ],
      keyTip: 'Texture (fluffy vs gummy) comes from variety, ratio, and not stirring — rinsing is not a reliable texture fix.',
      mistake: 'Reheating cooled rice that sat at room temperature — B. cereus toxin is heat-stable once formed. Cool promptly, refrigerate within 2 hours, reheat to 165°F.',
    },
    'Brown Rice (cooked)': {
      method: 'Stovetop absorption',
      tempTime: '2-2.5 cups water per 1 cup dry, simmer 40-45 min, rest 10-15 min covered',
      steps: [
        "Don't lift the lid or stir during the simmer",
        'Rest covered before fluffing',
      ],
      keyTip: 'Best meal-prep keeper along with basmati and long-grain white — stays separate rather than clumping.',
      mistake: 'Same rice-safety rule as white rice: cool promptly, refrigerate within 2 hours, reheat to 165°F.',
    },
    'Cream of Rice (cooked)': {
      method: 'Stovetop or microwave',
      tempTime: 'Whisk constantly for the first 60 seconds',
      steps: [
        'Cook per package ratio, whisking hard at the start to prevent clumps',
        'Add protein powder AFTER cooking, off heat, 4:1 ratio',
      ],
      keyTip: "Adding protein powder before it's done or while boiling makes it gluey.",
      mistake: 'Boiling the protein powder in — off-heat mixing only.',
    },
    'Oats (dry, rolled)': {
      method: 'Microwave (2:1 water) or baked',
      tempTime: 'Microwave: a few minutes, stir once partway',
      steps: [
        'Salt the water before cooking',
        "Rolled, steel-cut, and instant are not interchangeable by volume — don't swap forms in a recipe without adjusting liquid",
      ],
      keyTip: 'Salting the water is the single biggest reason people say they hate oats.',
      mistake: 'Never rinse oats — unlike rice, it does nothing useful here.',
    },
    'White Potato (baked, w/ skin)': {
      method: 'Air fryer, whole',
      tempTime: '400°F, 35-45 min',
      steps: [
        'Poke holes, no foil wrap',
        'Skin crisps while the inside goes custard-soft',
      ],
      keyTip: "Potatoes are weighed UNCOOKED on this plan — don't weigh after baking.",
      mistake: 'Wrapping in foil steams it instead of crisping the skin.',
    },
    'Sweet Potato (baked)': {
      method: 'Air fryer, whole',
      tempTime: '380°F, 35-45 min',
      steps: [
        'Poke holes, no foil wrap',
        'The single best air-fryer carb — skin crisps, inside goes custard',
      ],
      keyTip: "Not nutritionally superior to white potato for a lifter — it's a flavor/glycemic choice, not a health upgrade.",
      mistake: 'Weighing after cooking — this plan weighs potatoes uncooked.',
    },
    'Sourdough Bread': {
      method: 'Toast dry',
      tempTime: 'Standard toaster setting',
      steps: [
        'No butter needed — real-fat sourdough already has fat content, which is why the plan specifies it over low/very-low-fat bread',
        'Weigh on a scale, not by slice count — sourdough loaf slices vary 40g+ by thickness',
      ],
      keyTip: 'A kitchen scale beats "2 slices" for hitting the 65g target.',
      mistake: 'Assuming any sourdough is fine — the plan specifically wants real fat content, not a low-fat loaf.',
    },
    'Broccoli (cooked)': {
      method: 'Air fryer',
      tempTime: '380°F, 8-10 min',
      steps: [
        "Pat dry after washing — wet surfaces steam instead of browning",
        'Single layer, shake halfway',
      ],
      keyTip: 'Best air-fryer vegetable, period — crispy edges every time.',
      mistake: 'Pouring oil instead of measuring it — a thin film (spray or 1/2-1 tsp per batch) is all browning needs.',
    },
    'Spinach (cooked)': {
      method: 'Hot pan, NOT the air fryer',
      tempTime: '60 seconds, wilted',
      steps: [
        'Wilt in the hot pan right after a protein comes out — residual fat + fond is free flavor',
        'Or eat raw under a warm bowl',
      ],
      keyTip: 'A whole bag cooks down to about one serving — buy more than seems necessary.',
      mistake: 'Air-frying it — spinach is the one vegetable exception to the air-fryer default.',
    },
    'Asparagus (cooked)': {
      method: 'Air fryer',
      tempTime: '390°F, 6-8 min (thin spears closer to 5)',
      steps: [
        'Pat dry, single layer',
        'Shake halfway',
      ],
      keyTip: 'Lemon zest + pepper added after cooking is the go-to seasoning direction.',
      mistake: 'Leaving thin spears in the full 6-8 min — they finish faster than thick ones.',
    },
    'Green Beans (cooked)': {
      method: 'Air fryer',
      tempTime: '375°F, 8-10 min (frozen: add 2-3 min)',
      steps: [
        'Frozen goes in frozen, not thawed — thawing first makes them soggy',
        'Single layer, shake halfway',
      ],
      keyTip: 'Everything-bagel seasoning is the go-to for these.',
      mistake: 'Thawing frozen green beans before air-frying.',
    },
    'Cauliflower (cooked)': {
      method: 'Air fryer',
      tempTime: '390°F, 12-14 min',
      steps: [
        'Pat dry, single layer, shake halfway',
        "Browns beautifully — also the best rice-alternative base if it's doing double duty",
      ],
      keyTip: "Takes longer than most air-fryer veggies — don't pull it early expecting broccoli's timing.",
      mistake: 'Crowding the basket — cauliflower needs real airflow to brown instead of steam.',
    },
    'Turkey Bacon (cooked, generic)': {
      method: 'Air fryer (no oil) or dry nonstick pan',
      tempTime: 'Air fryer: 360°F, 5-7 min. Pan: medium heat, 2-3 min/side',
      steps: [
        'Air fryer: no oil needed — it renders its own fat and the basket lets it drip away',
        'Pan: dry nonstick, medium heat, watch closely',
      ],
      keyTip: '"Fully cooked" temp requirements vary by brand — check the package, not raw-pork-bacon safety margins.',
      mistake: "Walking away — it goes from done to burnt fast because it's thin and pre-cooked-ish.",
    },
    'Fruit (200g)': {
      method: 'No cooking — weighing technique only',
      tempTime: 'N/A',
      steps: [
        'Bananas and apples are easiest to weigh accurately — dense, low prep loss',
        'Berries lose weight to washing/stemming — weigh AFTER prep, not before',
      ],
      keyTip: 'Rotate fruit choices for micronutrients rather than eating the same one every day.',
      mistake: "Weighing berries before washing/stemming — the number won't match what you actually eat.",
    },
    'Veggies (1 cup)': {
      method: 'Air fryer default (see the specific vegetable in All Staple Foods for exact temp/time)',
      tempTime: 'Most run 375-390°F, 6-14 min depending on the vegetable',
      steps: [
        'Dry surfaces brown, wet surfaces steam — pat dry after washing',
        'Measure the oil: spray or 1/2-1 tsp tossed per batch, not a pour',
        'Salt after cooking for high-water veg (zucchini, mushrooms) for max crisp',
      ],
      keyTip: 'Anything but corn is approved on this plan — pick a specific vegetable in the staple list below for exact timing.',
      mistake: 'Drowning veggies in oil — that\'s where "veggies are free" quietly becomes 200+ extra calories.',
    },
    'Kombucha (8oz)': {
      method: 'No prep',
      tempTime: 'N/A',
      steps: [
        'Check the label for added sugar before buying — some flavored kombuchas run high',
      ],
      keyTip: "This phase's sauce rule is zero-sugar — treat kombucha with the same label-reading scrutiny.",
      mistake: 'Assuming all kombucha is low-sugar because it\'s "healthy" — flavored varieties vary a lot.',
    },
  };

  const api = { MEAL_PLAN, COOKING_GUIDES };
  if (typeof window !== 'undefined') window.CookingCoach = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
