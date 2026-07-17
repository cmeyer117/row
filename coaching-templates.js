// =============================================================
// Coaching plan content: stage-tiered diet/training/advice
// templates + pure assembly logic. No AI calls, no network —
// deterministic template selection only. Sourced from Carl's
// vault (Black Magma macro style, M5 program shape, Exercise
// Cues library, Mental Models Applied to Training).
// =============================================================
(function () {
  'use strict';

  const STAGES = {
    beginner: {
      training: {
        summary: 'Full-body, 3x/week, focus on learning the core lifts and building the habit before adding complexity.',
        days: [
          { name: 'Full Body A', exercises: ['Goblet Squat', 'Dumbbell Bench Press', 'Seated Cable Row', 'Dumbbell Romanian Deadlift', 'Plank'] },
          { name: 'Full Body B', exercises: ['Leg Press', 'Lat Pulldown', 'Dumbbell Shoulder Press', 'Dumbbell Front Raise', 'Cable Triceps Pushdown'] },
          { name: 'Full Body C', exercises: ['Dumbbell Bulgarian Split Squat', 'Machine Low Row', 'Incline Cable Pec Fly', 'Standing Calf Raise', 'Machine Preacher Curl'] }
        ]
      },
      diet: {
        summary: 'Flexible macros, not a rigid meal plan — hit the targets with foods you actually like eating.',
        approach: 'Protein: 0.8-1g per lb bodyweight. Fat: 25-30% of total calories. Carbs: fill the remainder. Weigh food for 2 weeks to calibrate portion sense, then eyeball after that.',
        foodGuidance: 'Build meals around one protein source (chicken, eggs, whey, lean beef, fish), one carb source (rice, potato, oats, fruit), and vegetables for volume/fiber. Track honestly — measuring cups and a kitchen scale beat guessing every time at this stage.'
      },
      advice: 'The first 90 days are about consistency, not optimization. Change is a decision, not a feeling — show up on the days you don\'t want to and the results take care of themselves. Don\'t chase every new technique you see online; master the basics first.'
    },
    intermediate: {
      training: {
        summary: 'Upper/Lower split, 4x/week, more volume and exercise variety now that the base movement patterns are solid.',
        days: [
          { name: 'Upper A', exercises: ['Smith Machine Flat Chest Press', 'Machine High Row', 'Neutral Grip Shoulder Press Machine', 'Lat Pulldown', 'Cable Lateral Raise', 'Cable Triceps Pushdown', 'Machine Preacher Curl'] },
          { name: 'Lower A', exercises: ['Hack Squat', 'Smith Machine RDL', 'Leg Extension', 'Lying Hamstrings Curl', 'Standing Calf Raise'] },
          { name: 'Upper B', exercises: ['Dumbbell Incline Chest Press', 'Chest Supported T-Bar Row', 'Cable Front Raise', 'Neutral Grip Lat Pulldown', 'Cable Rear Delt Fly', 'Seated Behind-the-Back Cable Curl'] },
          { name: 'Lower B', exercises: ['Cybex Leg Press', 'Dumbbell B-Stance RDL', 'Hip Adduction Machine', 'Seated Hamstrings Curl', 'Seated Calf Raise'] }
        ]
      },
      diet: {
        summary: 'Same flexible-macro approach as beginner, tightened up with more precise tracking and simple timing.',
        approach: 'Protein: 1-1.1g per lb bodyweight. Fat: 20-25% of total calories. Carbs: fill the remainder, weighted toward training days. Adjust total calories by ~10% up or down based on 2-week weight trend, not single-day readings.',
        foodGuidance: 'Same whole-food base as beginner, with more attention to protein distribution across meals (aim for 4-5 evenly spaced feedings) and carb timing around training for performance.'
      },
      advice: 'Progressive overload isn\'t a program, it\'s a promise you keep to a spreadsheet — log every session and chase small, real increases in weight or reps. This is also where most people start negotiating with themselves on diet adherence; the plan only works if you run it.'
    },
    advanced: {
      training: {
        summary: 'PPL split (Push/Pull/Legs), matches Carl\'s own current M5 program shape — higher frequency and volume for a trained lifter chasing continued hypertrophy.',
        days: [
          { name: 'Push', exercises: ['Smith Machine Narrow Grip Bench', 'Neutral Grip Shoulder Press Machine', 'Incline Cable Pec Fly', 'Dumbbell Lateral Raise', 'Low Cable Lateral Raise', 'Cable Triceps Overhead Extension'] },
          { name: 'Pull', exercises: ['Lat Pulldown', 'Chest Supported T-Bar Row', 'Cable Seated Row (Neutral Grip)', 'Cable Rear Delt Fly', 'Cable Lat Pushdown Pullover', 'Seated Behind-the-Back Cable Curl'] },
          { name: 'Legs A', exercises: ['Hack Squat', 'Cybex Leg Press', 'Leg Extension', 'Seated Hamstrings Curl', 'Standing Calf Raise'] },
          { name: 'Legs B', exercises: ['Smith Machine RDL', 'Dumbbell Heel Elevated Lunge', 'Hip Adduction Machine', 'Lying Hamstrings Curl', 'Seated Calf Raise'] }
        ]
      },
      diet: {
        summary: 'Precision macro tracking with nuanced timing and refeed guidance — same flexible-dieting philosophy, more dialed in.',
        approach: 'Protein: 1-1.2g per lb bodyweight, held constant regardless of phase. Fat: 20-25% of calories. Carbs: fill the remainder, with a planned refeed or diet break every 6-8 weeks in a sustained deficit to protect training performance and adherence.',
        foodGuidance: 'Same whole-food base, with attention to pre/post-training carb placement and a consistent weigh-in protocol (same conditions, daily, trend the average) to guide weekly adjustments.'
      },
      advice: 'At this stage the training and diet are rarely the limiting factor — recovery and consistency are. Earn the next day. Track sleep and stress the same way you track sets and macros; they move the needle just as much this deep into training experience.'
    }
  };

  function needsReview(intake) {
    if (intake.injuryFlags && intake.injuryFlags.length > 0) return true;
    const validCombo =
      STAGES[intake.stage] &&
      ['cut', 'bulk', 'recomp', 'contest-prep'].indexOf(intake.goal) !== -1 &&
      ['full-gym', 'home', 'limited'].indexOf(intake.equipment) !== -1;
    return !validCombo;
  }

  function assemblePlan(intake) {
    const stage = STAGES[intake.stage];
    if (!stage) throw new Error('Unknown stage: ' + intake.stage);
    return {
      stage: intake.stage,
      goal: intake.goal,
      equipment: intake.equipment,
      trainingDaysPerWeek: intake.trainingDaysPerWeek,
      sessionLength: intake.sessionLength,
      training: stage.training,
      diet: stage.diet,
      advice: stage.advice,
      needsReview: needsReview(intake),
      equipmentNote: intake.equipment !== 'full-gym'
        ? 'Client trains ' + intake.equipment + ' — swap machine exercises above for equivalent dumbbell/bodyweight/band movements before sending.'
        : null
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  if (typeof window !== 'undefined') {
    window.CoachingTemplates = { STAGES: STAGES, assemblePlan: assemblePlan, needsReview: needsReview, escapeHtml: escapeHtml };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STAGES: STAGES, assemblePlan: assemblePlan, needsReview: needsReview, escapeHtml: escapeHtml };
  }
})();
