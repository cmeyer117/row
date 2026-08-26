// form-cues.js — reader-facing form guidance for Form Coach (Coach tab split,
// Part B: docs/superpowers/specs/2026-08-25-form-coach-cues-design.md).
// Keys match gym.html's defaultExercises names/subs exactly. `primaries`
// holds one full write-up per primary exercise; `variants` holds a short
// note per sub pointing back to its primary. Purely reader-facing content —
// benchmarks.js's numeric scoring is untouched by this file.
(function () {
  'use strict';

  var FormCues = {
    primaries: {
      "Neutral Grip Shoulder Press Machine": {
        setup: "Seat height so the handles start level with your upper chest. Slide your butt forward and arch your upper back into the pad.",
        execution: "Press straight up, elbows tracking slightly forward of your torso (not flared wide) — the neutral grip keeps them in close, which is what shifts emphasis onto the upper chest instead of pure shoulders.",
        mistakes: ["Letting the elbows flare out to the sides — that turns it into a lateral raise, not a press.", "Not arching enough — a flat upper back shortens the range and shifts load to front delts."],
        benchmarkNote: "Elbow lockout target ~165° — press to a real, controlled lockout at the top, don't stop short."
      },
      "Smith Machine Flat Chest Press": {
        setup: "Bar path directly over your lower chest/upper abs, not your face. Retract your shoulder blades and keep them pinned to the bench throughout.",
        execution: "Lower under control to light chest touch, drive back up through a straight bar path — the Smith's fixed track means YOU control the angle by where you set up, not the bar.",
        mistakes: ["Flaring elbows to 90° from the torso — bad for the shoulder joint, keep them closer to 45-60°.", "Bouncing the bar off the chest instead of a controlled touch."],
        benchmarkNote: "Elbow lockout target ~165°."
      },
      "Chest Dip": {
        setup: "Lean your torso forward from the start — this is the single biggest lever for chest vs. triceps bias on a dip.",
        execution: "Lower until you feel a stretch in the chest/front delt (not pain in the shoulder joint), drive back up while maintaining the forward lean.",
        mistakes: ["Staying upright — that shifts the whole exercise to triceps, defeats the point of doing it on a chest day.", "Going so deep the shoulders roll forward and down — stop at a stretch, not a shoulder-joint end range."],
        benchmarkNote: "Elbow lockout target ~165° at the top."
      },
      "Incline Cable Pec Fly": {
        setup: "Cables set low, seat/stance positioned so the resistance pulls your arms down and out at the bottom, matching an incline pressing angle.",
        execution: "Slight bend in the elbows held constant throughout — this is a fly, not a press, so the elbow angle shouldn't change rep to rep. Squeeze the arms together in front of the upper chest at the top.",
        mistakes: ["Bending the elbows more at the top to turn it into a press — reduces chest stretch and tension.", "Using so much weight you can't control the stretch at the bottom — shoulders take over."],
        benchmarkNote: "Top-of-fly chest squeeze target ~45° — a genuinely smaller angle than the raise family, since the target position is arms drawn together, not away."
      },
      "Dumbbell Lateral Raise": {
        setup: "Slight forward lean, dumbbells starting at your sides with a soft bend in the elbows held constant.",
        execution: "Raise out to the sides, leading with the elbows (not the hands), to roughly shoulder height. Think 'pour a jug' — slight forward tilt of the wrist at the top so you're not just shrugging the weight up with traps.",
        mistakes: ["Using momentum/swinging the torso to sling the weight up.", "Raising past shoulder height — recruits traps, not the target lateral delt fiber."],
        benchmarkNote: "Top-of-raise shoulder abduction target ~85°."
      },
      "Cable Front Raise": {
        setup: "Cable set low, standing with your back to the stack (or facing it, depending on setup) — a low pulley keeps constant tension through the full range, unlike a dumbbell front raise.",
        execution: "Raise straight out in front to roughly shoulder height, controlled on the way down (don't let the cable yank your arm back down).",
        mistakes: ["Swinging the torso to generate momentum.", "Raising above shoulder height — no added front-delt benefit past that point, just more shoulder-joint stress."],
        benchmarkNote: "Top-of-raise shoulder abduction target ~85°."
      },
      "Cable Triceps Overhead Extension": {
        setup: "Rope or bar attachment, positioned so your elbows stay fixed and pointed forward/up throughout — this is the whole point of the overhead angle (stretches the long head of the triceps more than a pushdown).",
        execution: "Extend to full lockout, control the eccentric back down to a real stretch behind the head.",
        mistakes: ["Letting the elbows drift out to the sides or flare — keep them fixed and close to your ears.", "Using body English (leaning forward/back) to move the weight instead of the triceps."],
        benchmarkNote: "Elbow lockout target ~170°."
      },
      "Lat Pulldown": {
        setup: "Standard wide bar, thumbs over or around — grip just outside shoulder width.",
        execution: "Pull with elbows out wide and down, driving them toward your back pockets, leading with the elbows not the hands. Lean back slightly, but don't turn it into a row.",
        mistakes: ["Yanking the bar down with momentum/leaning way back — shifts load off the lats.", "Pulling behind the neck — unnecessary shoulder-joint risk for no extra benefit."],
        benchmarkNote: "Bottom-of-pull elbow flexion target ~55°."
      },
      "Cable Seated Row (Neutral Grip)": {
        setup: "Neutral/underhand handle, knees slightly bent, chest up.",
        execution: "Pull elbows in close to the torso (not flared), driving them straight back past your ribs — the neutral grip is specifically to let the elbows tuck in and bias the lats over the upper back.",
        mistakes: ["Leaning way back and using the torso to heave the weight.", "Shrugging the shoulders up toward the ears at the top instead of pulling the elbows back."],
        benchmarkNote: "Top-of-row elbow flexion target ~60°."
      },
      "Machine High Row": {
        setup: "Chest against the pad, handles at the higher position matching a high-row angle.",
        execution: "Pull elbows up and back, targeting the upper back/rear delt tie-in — a different angle than a standard row, so keep the elbow path higher, not straight back.",
        mistakes: ["Letting the chest come off the pad to add body English.", "Using a low-row elbow path on a high-row machine — defeats the point of the angle."],
        benchmarkNote: "Top-of-row elbow flexion target ~60°."
      },
      "Machine Low Row": {
        setup: "Chest against the pad, handles at the lower position.",
        execution: "Pull elbows straight back and down, squeezing the shoulder blades together at the end range.",
        mistakes: ["Coming off the chest pad to cheat the weight up.", "Stopping the pull short — a low row's benefit is the full squeeze at the back."],
        benchmarkNote: "Top-of-row elbow flexion target ~60°."
      },
      "Cable Lat Pushdown/Pullover": {
        setup: "Straight bar or rope high on the cable, arms starting extended overhead.",
        execution: "Pull down and back in an arc (pullover pattern), keeping the elbows relatively straight (this is a lat isolation, not an elbow-flexion exercise) — finish with your hands near your thighs.",
        mistakes: ["Bending the elbows significantly to turn it into a pushdown/triceps move.", "Using so much weight the shoulders round forward at the top of the stretch."],
        benchmarkNote: "Rep range without a matching numeric target in this app — coach by feel: full stretch overhead, full squeeze at the bottom."
      },
      "Cable Rear Delt Fly": {
        setup: "Cables crossed (right handle in left hand or vice versa) at roughly shoulder height, slight forward lean.",
        execution: "Pull the handles out and back in a wide arc, squeezing the shoulder blades together, elbows staying roughly at shoulder height throughout.",
        mistakes: ["Turning it into a row by bending the elbows and pulling toward the torso instead of out to the sides.", "Using momentum from the lower back."],
        benchmarkNote: "Top-of-fly shoulder abduction target ~85°."
      },
      "Seated Behind-the-Back Cable Curl": {
        setup: "This is the Bayesian curl setup: pulley at its lowest, single handle, back to the cable stack, one arm at a time. Step 1-2 feet forward, lean slightly forward, let the cable draw your arm behind your torso.",
        execution: "Keep the upper arm fixed at roughly a 45° angle behind you and don't let it drift further back — curl by bending only at the elbow, then lean back slightly as you lower for a full stretch. This 'lean forward to curl, lean back to lower' motion is the exercise's signature move, not cheating.",
        mistakes: ["Letting the weight drag your arm too far back — kills tension at both ends of the rep.", "Letting the cable touch your forearm on the way up (means you're not leaning forward enough).", "Loading too heavy to control the lean — this is a stretch-focused isolation move, not a strength lift."],
        benchmarkNote: "Top-of-curl flexion target ~50°."
      },
      "Hack Squat": {
        setup: "Shoulders and back firmly against the pads, feet slightly forward on the platform, hip-width or slightly wider.",
        execution: "Lower under control to at least parallel (deeper if mobility allows), drive through the whole foot — not just the toes — back to the top.",
        mistakes: ["Heels lifting off the platform on the way down — shifts stress to the knees.", "Cutting depth short — the machine's fixed path means depth is mostly a matter of choosing to go there."],
        benchmarkNote: "Knee flexion depth target ~100° — a real bend, not a quarter-squat."
      },
      "Sissy Leg Press": {
        setup: "Feet lower and closer together on the platform than a standard leg press — this narrow, low foot position is what biases quads over glutes/hamstrings.",
        execution: "Lower to a full stretch, drive back up without locking the knees out hard at the top.",
        mistakes: ["Feet too high/wide, which turns it into a standard (more glute-biased) leg press.", "Locking knees out aggressively at the top — unnecessary joint stress."],
        benchmarkNote: "No benchmarks.js entry for this exact name — treat as the same knee-flexion pattern as the squat/leg-press family for coaching cues."
      },
      "Seated Hamstrings Curl": {
        setup: "Back against the pad, ankle pad positioned just above the heel, knee aligned with the machine's pivot point.",
        execution: "Curl the pad toward your glutes through a full range, control the eccentric back to a full stretch rather than letting the weight stack drop.",
        mistakes: ["Using hip movement/scooting forward to help generate momentum.", "Not fully extending on the way back — half-reps shortchange the stretch, which is where hamstrings respond best."],
        benchmarkNote: "Top-of-curl knee flexion target ~60°."
      },
      "Dumbbell B-Stance RDL": {
        setup: "B-stance: working-leg foot flat and forward, other foot's toes lightly behind for balance (not bearing real weight). Hinge from the hips, not the knees.",
        execution: "Push your hips back while keeping a soft bend in the working knee, dumbbells tracking close to the leg, until you feel a real hamstring stretch — then drive the hips forward to stand.",
        mistakes: ["Squatting instead of hinging — knees bending forward rather than hips pushing back.", "Rounding the lower back at the bottom of the stretch — stop at your mobility limit, not past it."],
        benchmarkNote: "Hip lockout target ~165° at the top of the rep."
      },
      "Hip Adduction Machine": {
        setup: "Seated, pads positioned against the outside of the knees/thighs, machine's starting position with legs spread.",
        execution: "Squeeze the legs together through the full range, pause briefly at full squeeze, control the return.",
        mistakes: ["Using a partial range to move more weight — the squeeze at full adduction is the point.", "Rocking the torso/using momentum instead of the adductors."],
        benchmarkNote: "No benchmarks.js entry — this app's knee/hip angle tracking doesn't cover the frontal-plane adduction motion yet (flagged as a known gap in benchmarks.js)."
      },
      "Standing Calf Raise": {
        setup: "Balls of the feet on the platform edge, heels hanging free, knees straight but not locked.",
        execution: "Full stretch at the bottom (heels well below the platform), drive up onto the toes for a full contraction, pause briefly at the top.",
        mistakes: ["Bouncing at the bottom instead of a controlled stretch.", "Using a tiny, bouncy range of motion — calves respond to full stretch-to-contraction range more than partial-rep speed."],
        benchmarkNote: "Ankle plantarflexion target ~140°."
      },
      "Dumbbell Incline Chest Press": {
        setup: "Bench at a moderate incline (30-45°) — too steep shifts to front delts, too flat loses the upper-chest bias.",
        execution: "Lower the dumbbells to a stretch at chest level, press up and slightly in toward each other at the top.",
        mistakes: ["Bench angle too steep, turning it into a shoulder press.", "Flaring elbows to a full 90° — keep them at roughly 45-60° from the torso for shoulder-joint safety."],
        benchmarkNote: "Elbow lockout target ~165°."
      },
      "Chest Supported T-Bar Row": {
        setup: "Chest firmly against the support pad — this is what lets you row heavy without lower-back involvement.",
        execution: "Pull with elbows flared out to roughly 45° from the body, driving them up and back to target the upper/mid back.",
        mistakes: ["Coming off the chest pad to use body momentum — defeats the point of the chest-supported setup.", "Pulling with a narrow elbow path (biases lats over upper back) when the intent here is upper-back width."],
        benchmarkNote: "Top-of-row elbow flexion target ~60°."
      },
      "Smith Machine Narrow Grip Bench": {
        setup: "Grip just inside shoulder width, elbows tucked close to the torso throughout — narrow grip is what shifts emphasis to triceps.",
        execution: "Lower to the lower chest/upper abs with elbows staying close (not flaring), press to full lockout.",
        mistakes: ["Grip too narrow (hands touching) — actually reduces control and can strain the wrists.", "Letting the elbows flare out, which turns it back into a standard chest-biased press."],
        benchmarkNote: "Elbow lockout target ~165°."
      },
      "Neutral Grip Lat Pulldown": {
        setup: "Neutral (palms-facing) handles, which let the elbows track in close to the body through the whole pull.",
        execution: "Pull elbows down and in toward your torso, driving your chest up slightly to meet the bar.",
        mistakes: ["Leaning back excessively to use momentum.", "Not achieving a full stretch at the top of each rep."],
        benchmarkNote: "Bottom-of-pull elbow flexion target ~55°."
      },
      "Low Cable Lateral Raise": {
        setup: "Cable set low, standing to the side so the resistance pulls your arm across your body at the bottom — this gives constant tension a dumbbell can't at the start of the rep.",
        execution: "Raise out and up to roughly shoulder height leading with the elbow, same cue as the dumbbell version, just with the cable's constant-tension advantage at the bottom.",
        mistakes: ["Standing too close to the pulley, losing the cross-body starting tension that's the whole point of doing it low-cable.", "Swinging the torso for momentum."],
        benchmarkNote: "Top-of-raise shoulder abduction target ~85°."
      },
      "Dumbbell Front Raise": {
        setup: "Dumbbells at your sides or in front of your thighs, slight bend in the elbows held constant.",
        execution: "Raise one or both arms straight out in front to shoulder height, controlled on the way down.",
        mistakes: ["Swinging/using momentum from the lower back.", "Raising too high — past shoulder height adds no benefit and stresses the joint."],
        benchmarkNote: "Top-of-raise shoulder abduction target ~85°."
      },
      "Machine Preacher Curl": {
        setup: "Upper arms flat against the preacher pad — this fixes the shoulder in place so only the elbow moves, isolating the biceps more than a standing curl.",
        execution: "Curl through the full range the pad allows, control the eccentric all the way down to a full stretch.",
        mistakes: ["Not extending fully at the bottom — the preacher position's whole benefit is that stretched-position tension.", "Letting the elbows lift off the pad to cheat the weight up."],
        benchmarkNote: "Top-of-curl flexion target ~50°."
      },
      "Cable Triceps Pushdown": {
        setup: "Elbows pinned to your sides from the start — this stays true for the entire set, the elbows should not travel.",
        execution: "Extend down to full lockout without the elbows drifting forward or out, control the return to a stretch behind the elbow.",
        mistakes: ["Letting the elbows drift forward as the weight gets heavy — turns it into a lat-pulldown-style pull instead of a triceps isolation.", "Using body weight/leaning into the movement instead of triceps extension."],
        benchmarkNote: "Elbow lockout target ~170°."
      },
      "Smith Machine RDL": {
        setup: "Bar starting at hip height, slight bend in the knees held constant throughout — this is a hip hinge, not a squat.",
        execution: "Push the hips back, bar tracking close to the legs, until you feel a real hamstring stretch, then drive the hips forward to stand tall.",
        mistakes: ["Bending the knees more as the bar descends, turning it into a squat.", "Rounding the lower back to chase more range than your hamstring flexibility allows."],
        benchmarkNote: "Hip lockout target ~165° at the top."
      },
      "Lying Hamstrings Curl": {
        setup: "Face down, ankle pad just above the heels, hips pressed into the bench (not lifted).",
        execution: "Curl the pad toward your glutes through a full range, control the negative back to full extension.",
        mistakes: ["Lifting the hips off the bench to help generate momentum — shifts load off the hamstrings.", "Using a fast, bouncy tempo instead of controlling the eccentric."],
        benchmarkNote: "Top-of-curl knee flexion target ~60°."
      },
      "Cybex Leg Press": {
        setup: "Feet shoulder-width on the platform, mid-foot placement (not too high or low), back flat against the pad.",
        execution: "Lower until your knees reach roughly 90° or your lower back starts to round off the pad (whichever comes first), press back up without locking the knees out hard.",
        mistakes: ["Letting the lower back round/lift off the pad at depth — that's your real depth limit, not a fixed number.", "Locking the knees out hard and aggressively at the top."],
        benchmarkNote: "No matching benchmarks.js entry under this exact name — same knee-flexion coaching pattern as the squat/leg-press family."
      },
      "Dumbbell Heel Elevated Lunge": {
        setup: "Rear foot elevated on a plate or small platform, front foot planted flat, torso upright.",
        execution: "Lower straight down until the front knee reaches roughly a 100° bend, drive back up through the front heel.",
        mistakes: ["Front knee traveling far past the toes with the heel lifting — usually means the stance is too short.", "Pushing off the back (elevated) foot instead of driving through the front leg — defeats the point of the unilateral bias."],
        benchmarkNote: "Front knee flexion depth target ~100°."
      },
      "Leg Extension": {
        setup: "Back against the pad, ankle pad resting just above the feet, knees aligned with the machine's pivot.",
        execution: "Extend to a full, controlled lockout, pause briefly, lower under control rather than letting the stack drop.",
        mistakes: ["Using a fast, bouncy tempo to move more weight — reduces quad tension and stresses the knee joint.", "Not achieving full lockout at the top."],
        benchmarkNote: "Knee lockout target ~170°."
      },
      "Seated Calf Raise": {
        setup: "Knees under the pad, balls of the feet on the platform edge, heels free to drop.",
        execution: "Full stretch at the bottom, drive up to a full contraction, brief pause at the top — the seated angle (knee bent) shifts emphasis to the soleus, versus the standing version's gastrocnemius bias.",
        mistakes: ["Bouncing instead of a controlled stretch at the bottom.", "Using a short, partial range — the whole benefit here is the full stretch-to-contraction range."],
        benchmarkNote: "Ankle plantarflexion target ~140°."
      }
    },

    variants: {
      // Push
      "Dumbbell Neutral Grip Shoulder Press": { primary: "Neutral Grip Shoulder Press Machine", note: "Free-weight version — same neutral-grip, elbows-in cue, but you also have to stabilize the dumbbells independently, so expect less total load than the machine." },
      "Smith Incline Machine Chest Press": { primary: "Neutral Grip Shoulder Press Machine", note: "A pressing-angle substitute, not a literal neutral-grip match — same elbows-forward, controlled-lockout cues apply." },
      "Machine Flat Chest Press": { primary: "Smith Machine Flat Chest Press", note: "Fixed machine path instead of the Smith's bar — same elbow-flare and bar-path cues, machine just removes the balance component." },
      "Barbell / Dumbbell Flat Chest Press": { primary: "Smith Machine Flat Chest Press", note: "Free-weight version — no fixed bar path, so you're responsible for keeping the bar/dumbbells tracking straight over the lower chest yourself." },
      "Seated Cable Flat Chest Press": { primary: "Smith Machine Flat Chest Press", note: "Cable gives constant tension through the full range, unlike a barbell which loses tension at lockout — same elbow-flare cue applies." },
      "Dip Machine (Chest Bias)": { primary: "Chest Dip", note: "Assisted/fixed-path version — same forward-lean-for-chest cue, machine just controls part of your bodyweight." },
      "Chest Dip (RG Variant)": { primary: "Chest Dip", note: "Ring/RG-grip variant — same forward lean cue, plus added stabilizer demand from the unstable grip." },
      "Other Dip Variations": { primary: "Chest Dip", note: "Same forward-lean-for-chest, controlled-depth cues apply regardless of the specific dip station." },
      "Pec Dec Fly (Upper Chest Bias)": { primary: "Incline Cable Pec Fly", note: "Fixed-arc machine version — same constant-elbow-bend, squeeze-in-front cue, fixed path just removes the stabilization demand." },
      "Incline Dumbbell Pec Fly": { primary: "Incline Cable Pec Fly", note: "Free-weight version — loses tension at the very top (dumbbells have no resistance directly overhead), so the stretch at the bottom matters even more here." },
      // "Low Cable Lateral Raise" is a sub here (Dumbbell Lateral Raise, Push
      // day) but is ALSO a primary in its own right (Upper day) -- no
      // separate variants entry needed, lookup checks primaries first.
      "Seated Machine Lateral Raise": { primary: "Dumbbell Lateral Raise", note: "Fixed machine path — same lead-with-the-elbows cue, seated position removes any torso-swing cheating." },
      "Standing Machine Lateral Raise": { primary: "Dumbbell Lateral Raise", note: "Fixed machine path, standing — same cues as the dumbbell version, less swing risk than free weights." },
      "Dumbbell Overhead Extension": { primary: "Cable Triceps Overhead Extension", note: "Free-weight version, usually two-handed behind the head — same fixed-elbow cue, but loses the cable's constant tension." },
      "Machine Overhead Triceps Extension": { primary: "Cable Triceps Overhead Extension", note: "Fixed-path machine version — same overhead-stretch cue with less stabilization demand." },
      "Machine Triceps Extension": { primary: "Cable Triceps Overhead Extension", note: "Check the specific machine's arm angle — if it's not an overhead position, the long-head-stretch benefit is reduced versus the primary." },
      // Pull
      "Wide Grip Pullup": { primary: "Lat Pulldown", note: "Bodyweight version of the same wide-grip, elbows-out pattern — since it's bodyweight-loaded, watch for kipping/momentum substituting for real range of motion." },
      "Lat Pulldown Machine": { primary: "Lat Pulldown", note: "Same movement as the primary, just naming the specific machine — identical cues apply." },
      "Smith Machine UH Barbell Row": { primary: "Cable Seated Row (Neutral Grip)", note: "Underhand barbell row on the Smith's fixed bar path — same elbows-in cue, plus real lower-back bracing demand since you're bent over, not seated." },
      "Underhand Grip Barbell Row": { primary: "Cable Seated Row (Neutral Grip)", note: "Free-weight bent-over version — same elbows-in cue, add a hip hinge and neutral spine to the setup since there's no bench/pad support." },
      "Cable High Row": { primary: "Machine High Row", note: "Cable version of the same high-angle pull — same elbows-up-and-back cue." },
      "Nautilus Lat Pulldown": { primary: "Machine High Row", note: "Listed as a high-row sub here for the angle it creates on this specific machine — confirm the pad/arm setup matches a high-row path, not a standard pulldown." },
      "High Row Setup on Lat Pulldown": { primary: "Machine High Row", note: "Same high-row angle, achieved by adjusting a standard pulldown station's seat/arm position." },
      "Cable Low Row": { primary: "Machine Low Row", note: "Cable version — same straight-back-and-down elbow path, squeeze at the finish." },
      "Single Arm Landmine Row": { primary: "Machine Low Row", note: "Unilateral free-weight version — same low-row elbow path, plus real core/anti-rotation demand from the single-arm load." },
      "Machine Lat Pullover": { primary: "Cable Lat Pushdown/Pullover", note: "Fixed-arc machine version — same straight-elbow, full-stretch-to-full-squeeze cue." },
      "Dumbbell Lat Pullover": { primary: "Cable Lat Pushdown/Pullover", note: "Free-weight version, lying on a bench — same straight-elbow cue, but loses tension at the very top like most free-weight pulls." },
      "Machine Rear Delt Fly": { primary: "Cable Rear Delt Fly", note: "Fixed-arc machine version — same elbows-at-shoulder-height, squeeze-the-blades cue." },
      "Dumbbell Rear Delt Fly": { primary: "Cable Rear Delt Fly", note: "Bent-over free-weight version — same wide-arc cue, add a stable hip hinge to keep the lower back out of it." },
      "Bayesian Cable Curl": { primary: "Seated Behind-the-Back Cable Curl", note: "This IS the Bayesian curl — same exercise, this is just the more common name for it. See the primary entry's full setup." },
      "Seated Incline Dumbbell Curl": { primary: "Seated Behind-the-Back Cable Curl", note: "A different stretched-position curl (incline bench, arms hanging behind the torso plane) — shares the same stretched-biceps intent as the Bayesian curl but with dumbbells instead of a cable, so tension drops near the bottom of the rep." },
      // Legs A
      "Pendulum Squat": { primary: "Hack Squat", note: "Machine-guided arc, back firmly against the pad. Keep heels flat and feet low on the platform for max knee flexion/quad recruitment; don't let the knees cave in. The arc makes the weight feel heavier than the number on the stack — start light." },
      "Smith Machine Squat (Quad Bias)": { primary: "Hack Squat", note: "Fixed bar path — set your feet slightly forward of the bar to bias the quads, same depth cue as the primary." },
      "Barbell Squat (Quad Bias)": { primary: "Hack Squat", note: "Free-weight version, feet closer together and more upright torso than a powerlifting-style squat to keep the quad bias — same depth target." },
      "Hack Squat Sissy Squats": { primary: "Sissy Leg Press", note: "Same low, narrow-foot position on the hack squat machine instead of a leg press — same quad-bias cue." },
      "Sissy Squat on Sissy Stand": { primary: "Sissy Leg Press", note: "Bodyweight/fixed-stand version — lean back from the knees (not the hips) while keeping a straight line from knee to shoulder; this is a much more advanced knee-dominant pattern than the machine version." },
      "Leg Press Quad Bias": { primary: "Sissy Leg Press", note: "Standard leg press with feet set low and close together to mimic the sissy leg press's quad emphasis." },
      "Cable Hip Extension Machine": { primary: "Dumbbell B-Stance RDL", note: "A machine-guided hip-hinge alternative — same hips-back, hamstring-stretch cue as an RDL, but the machine's fixed arc removes the balance/stabilization demand." },
      "Single Leg Hip Extension": { primary: "Dumbbell B-Stance RDL", note: "Unilateral hip-hinge — same hinge-not-squat cue, plus real single-leg balance/stability demand." },
      "V-Squat Good Morning": { primary: "Dumbbell B-Stance RDL", note: "Machine-guided good morning — same hip-hinge pattern, the V-Squat's frame provides the fixed path/back support." },
      "Barbell Good Morning": { primary: "Dumbbell B-Stance RDL", note: "Free-weight hip hinge with the bar on your back — same hips-back cue, but with a heavier lower-back bracing demand than a dumbbell RDL." },
      "Cable Hip Adduction": { primary: "Hip Adduction Machine", note: "Cable ankle-cuff version — same full-squeeze-through-the-range cue, standing instead of seated." },
      "Smith Machine Calf Raise": { primary: "Standing Calf Raise", note: "Bar on your back on a fixed Smith path instead of a dedicated calf machine — same full-stretch-to-full-contraction cue." },
      // Upper
      "Machine Incline Chest Press": { primary: "Dumbbell Incline Chest Press", note: "Fixed-path machine version — same elbow-flare cue, less stabilization demand than dumbbells." },
      // "Smith Incline Machine Chest Press" already covered above (Push section)
      "Smith Machine Barbell Row": { primary: "Chest Supported T-Bar Row", note: "No chest support here — this version needs a real hip hinge and braced lower back that the chest-supported primary doesn't require." },
      "Landmine T-Bar Row": { primary: "Chest Supported T-Bar Row", note: "Unsupported landmine version — same flared-elbow, upper-back-focused pull, but without the chest pad, brace your core and keep a flat back." },
      "Barbell Row": { primary: "Chest Supported T-Bar Row", note: "Free bent-over row — same flared-elbow cue, plus a genuine hip-hinge/lower-back bracing requirement the chest-supported version removes." },
      "Barbell Narrow Grip Bench Press": { primary: "Smith Machine Narrow Grip Bench", note: "Free-weight version — same narrow-grip, elbows-tucked cue, without the fixed bar path." },
      "Machine Narrow Grip Chest Press": { primary: "Smith Machine Narrow Grip Bench", note: "Fixed machine handles set narrow — same elbows-in cue with a machine's stabilization removed." },
      "Narrow Grip Push-up": { primary: "Smith Machine Narrow Grip Bench", note: "Bodyweight version — hands roughly shoulder-width or slightly narrower, same elbows-tucked-to-the-torso cue." },
      "Nautilus Lat Pulldown Machine": { primary: "Neutral Grip Lat Pulldown", note: "Same neutral-grip pattern on Nautilus's specific machine — identical elbows-in cue." },
      "Single Arm Lat Pulldown": { primary: "Neutral Grip Lat Pulldown", note: "Unilateral version — same elbow-tuck cue, plus real anti-rotation core demand from the offset load." },
      // "Standing Machine Lateral Raise" / "Seated Machine Lateral Raise" already covered above
      // "Cable Front Raise" is a sub here (Dumbbell Front Raise, Upper day)
      // but is ALSO a primary in its own right (Push day) -- no separate
      // variants entry needed, lookup checks primaries first.
      "Barbell Preacher Curl": { primary: "Machine Preacher Curl", note: "Free-weight version on a preacher bench — same shoulder-fixed, full-stretch cue as the machine." },
      "Standing Cable Curl": { primary: "Machine Preacher Curl", note: "Standing, no preacher support — you'll need to actively keep the elbows pinned to your sides yourself, since nothing's fixing the shoulder position for you." },
      "Cable Elbow Supported Triceps Pushdown": { primary: "Cable Triceps Pushdown", note: "An elbow pad locks the upper arm in place — makes the elbows-pinned cue almost automatic, good if you struggle to keep them still on the standard version." },
      "Triceps Crossbody Extension": { primary: "Cable Triceps Pushdown", note: "Single-arm, cable crossing the body — same elbow-pinned cue, plus it hits a slightly different angle through the long head." },
      // Legs B
      "Barbell / Dumbbell / Trap Bar RDL": { primary: "Smith Machine RDL", note: "Free-weight versions — same hip-hinge, knees-mostly-locked cue, without the Smith's fixed bar path to keep things vertical for you." },
      "V-Squat Machine Good Morning": { primary: "Smith Machine RDL", note: "Machine-guided good morning on the V-Squat frame — same hip-hinge pattern with built-in path support." },
      "Arsenal Posterior Chain Developer": { primary: "Smith Machine RDL", note: "A dedicated good-morning machine (pivoting hip pad, adjustable deck) — sit against the pad, hinge from the hips while the machine guides the arc, and use its adjustment range to bias hamstrings vs. spinal erectors as needed. Purpose-built for exactly this hip-hinge pattern, generally very safe for the lower back." },
      // "Seated Hamstrings Curl" / "Glute Ham Raise" already covered / covered below
      "Glute Ham Raise": { primary: "Lying Hamstrings Curl", note: "Bodyweight/GHD version — a much harder variation involving both hip and knee extension, not just knee flexion; start with an assisted or partial-range version if it's new to you." },
      "45° Sled Leg Press": { primary: "Cybex Leg Press", note: "Standard angled sled — same mid-foot placement and lower-back-off-the-pad depth limit cue." },
      "Horizontal Leg Press": { primary: "Cybex Leg Press", note: "Flat/horizontal sled — same depth cue (stop when the lower back starts to round), the horizontal angle just removes gravity's assist on the eccentric." },
      "Dumbbell Split Squat": { primary: "Dumbbell Heel Elevated Lunge", note: "Same split stance without the rear-foot elevation — a bit more balance-demanding, same front-knee-tracking cue." },
      "Smith Machine Split Squat": { primary: "Dumbbell Heel Elevated Lunge", note: "Fixed bar path removes the balance component — same front-knee depth cue, easier to load heavy." },
      "DB/BB Walking Lunge": { primary: "Dumbbell Heel Elevated Lunge", note: "Dynamic/walking version instead of stationary — same knee-tracking cue each step, plus real balance and coordination demand." },
      "Sissy Squat": { primary: "Leg Extension", note: "A much harder bodyweight substitute — leans the torso back from the knees while keeping hips extended, intense direct quad/knee-extensor stretch. Build up range gradually; it's unforgiving on the knees if rushed." },
      "Bent Knee Calf Press on Leg Press": { primary: "Seated Calf Raise", note: "Same soleus-biased bent-knee angle as the seated calf raise, done on the leg press platform instead of a dedicated machine." }
    }
  };

  if (typeof window !== 'undefined') window.FormCues = FormCues;
  if (typeof module !== 'undefined' && module.exports) module.exports = FormCues;
})();
