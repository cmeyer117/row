// coaching-templates.selfcheck.js — run with: node coaching-templates.selfcheck.js
const { STAGES, assemblePlan, needsReview } = require('./coaching-templates.js');

// All three stages exist with real content, not placeholders.
console.assert(Object.keys(STAGES).length === 3, 'expected 3 stages');
['beginner', 'intermediate', 'advanced'].forEach((s) => {
  console.assert(STAGES[s].training.days.length >= 3, s + ' should have >=3 training days');
  console.assert(STAGES[s].diet.approach.length > 20, s + ' diet approach should be real content');
  console.assert(STAGES[s].advice.length > 20, s + ' advice should be real content');
});

// Clean case: no injury flags, valid combo -> no review needed.
const clean = { stage: 'intermediate', goal: 'recomp', equipment: 'full-gym', trainingDaysPerWeek: 4, sessionLength: 60, injuryFlags: [] };
console.assert(needsReview(clean) === false, 'clean intake should not need review');

// Injury flag -> always needs review, regardless of otherwise-valid combo.
const injured = Object.assign({}, clean, { injuryFlags: ['shoulder'] });
console.assert(needsReview(injured) === true, 'any injury flag must force needs_review');

// Unknown stage -> assemblePlan throws rather than silently producing garbage.
let threw = false;
try { assemblePlan({ stage: 'expert', goal: 'cut', equipment: 'full-gym', trainingDaysPerWeek: 5, sessionLength: 60, injuryFlags: [] }); }
catch (e) { threw = true; }
console.assert(threw, 'unknown stage should throw, not silently fall through');

// Non-full-gym equipment surfaces an equipment note for manual substitution.
const homePlan = assemblePlan({ stage: 'beginner', goal: 'cut', equipment: 'home', trainingDaysPerWeek: 3, sessionLength: 45, injuryFlags: [] });
console.assert(homePlan.equipmentNote !== null, 'non-full-gym equipment should surface a substitution note');

console.log('coaching-templates.selfcheck.js: all assertions passed');
