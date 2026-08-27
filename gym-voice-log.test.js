// Loaded as a classic <script> tag in the browser — see
// gym-weight-outlier-logic.test.js for why this sandboxes instead of import/require.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./gym-voice-log.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { parseSetUtterance } = sandbox.window.GymVoiceLog;

const EXERCISES = [
  { id: 'ex_incline', name: 'Smith Machine Flat Chest Press', day: 'push', bw: false },
  { id: 'ex_dip', name: 'Chest Dip', day: 'push', bw: false },
  { id: 'ex_lateral', name: 'Dumbbell Lateral Raise', day: 'push', bw: false },
  { id: 'ex_pullup', name: 'Pull Up', day: 'pull', bw: true },
];
const TODAYS = EXERCISES.filter((e) => e.day === 'push');

const cases = [];

{
  const r = parseSetUtterance('chest dip 245 for 8', TODAYS, EXERCISES);
  cases.push(['weight-then-reps order ("N for M")', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip 8 reps at 245', TODAYS, EXERCISES);
  cases.push(['reps-word cues reps explicitly', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip 8 at 245 pounds', TODAYS, EXERCISES);
  cases.push(['pounds-word cues weight explicitly', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip 245 for 8, two RIR', TODAYS, EXERCISES);
  cases.push(['trailing RIR phrase stripped, does not corrupt reps', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip 245 for 8, two reps in reserve', TODAYS, EXERCISES);
  cases.push(['"reps in reserve" phrasing also stripped', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip 245 for eight', TODAYS, EXERCISES);
  cases.push(['spoken small number-word for reps still parses ("eight")', r.exId === 'ex_dip' && r.weight === 245 && r.reps === 8]);
}
{
  const r = parseSetUtterance('pull up eight', TODAYS, EXERCISES);
  cases.push(['bodyweight exercise needs only one number, treated as reps', r.exId === 'ex_pullup' && r.weight === 0 && r.reps === 8]);
}
{
  const r = parseSetUtterance('chest dip', TODAYS, EXERCISES);
  cases.push(['exercise matched but no numbers at all -> no-numbers error', r.error === 'no-numbers' && r.transcript === 'chest dip']);
}
{
  const r = parseSetUtterance('chest dip 245', TODAYS, EXERCISES);
  cases.push(['exercise matched but only one number for a non-bw exercise -> no-numbers error', r.error === 'no-numbers']);
}
{
  const r = parseSetUtterance('lateral raise 35 for 12', TODAYS, EXERCISES);
  cases.push(['partial-name match above threshold ("lateral raise" -> Dumbbell Lateral Raise)', r.exId === 'ex_lateral']);
}
{
  const r = parseSetUtterance('bench press 200 for 5', TODAYS, EXERCISES);
  cases.push(['no exercise clears the match threshold -> no-match error', r.error === 'no-match' && r.transcript === 'bench press 200 for 5']);
}
{
  const r = parseSetUtterance('pull up 8 reps', [], EXERCISES);
  cases.push(['todaysExercises empty falls through to the full list', r.exId === 'ex_pullup']);
}
{
  const r = parseSetUtterance('', TODAYS, EXERCISES);
  cases.push(['empty transcript -> no-match, never throws', r.error === 'no-match']);
}
{
  // Both names are 2 significant words sharing only "press" -- each scores
  // exactly 0.5 (the bare MATCH_THRESHOLD), so the old code's strict ">"
  // comparison silently kept whichever candidate came first in the array.
  const AMBIGUOUS = [
    { id: 'ex_chest_press', name: 'Chest Press', day: 'push', bw: false },
    { id: 'ex_shoulder_press', name: 'Shoulder Press', day: 'push', bw: false },
  ];
  const r = parseSetUtterance('press 135 for 8', AMBIGUOUS, AMBIGUOUS);
  cases.push(['a word shared by two same-scoring candidates is ambiguous, not a silent pick', r.error === 'no-match']);
}
{
  const r = parseSetUtterance('chest dip 245 for 8', TODAYS, EXERCISES);
  cases.push(['a clear single-candidate match still wins (regression guard)', r.exId === 'ex_dip']);
}
{
  // Codex catch (2026-08-26), confirmed against a real exercise in Carl's
  // own program ("45° Sled Leg Press", gym.html:176 sub-variant): a number
  // embedded in the exercise's OWN name must not compete with the spoken
  // weight/reps for a role.
  const NUMBERED = [{ id: 'ex_45sled', name: '45 Sled Leg Press', day: 'push', bw: false }];
  const r = parseSetUtterance('45 sled leg press 225 for 8', NUMBERED, NUMBERED);
  cases.push(['a number inside the exercise\'s own name is not mistaken for weight/reps', r.exId === 'ex_45sled' && r.weight === 225 && r.reps === 8]);
}
{
  // Codex catch (2026-08-26): matching today's list and the full list as
  // two SEPARATE searches let a weak, single-candidate today's match (no
  // runner-up to compare against) beat a much better full-catalog match
  // that never got the chance to compete. Merging into one combined pool
  // means the margin check runs across all real candidates, not just
  // whichever list happened to be checked first.
  const TODAY_ONLY = [{ id: 'ex_press', name: 'Press', day: 'push', bw: false }];
  const FULL = TODAY_ONLY.concat([{ id: 'ex_overhead_press', name: 'Overhead Press', day: 'pull', bw: false }]);
  const r = parseSetUtterance('overhead press 135 for 8', TODAY_ONLY, FULL);
  cases.push(['a generic today\'s-split name no longer silently beats a more specific full-catalog name', r.exId !== 'ex_press']);
}
{
  // Codex catch (2026-08-26): a malformed/null array element (possible from
  // legacy or hand-edited localStorage data) must not crash the whole parse.
  const WITH_NULL = [null, { id: 'ex_dip', name: 'Chest Dip', day: 'push', bw: false }];
  const r = parseSetUtterance('chest dip 245 for 8', WITH_NULL, WITH_NULL);
  cases.push(['a null entry in the exercise list is skipped, not thrown on', r.exId === 'ex_dip']);
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`gym-voice-log: all ${cases.length} cases pass`);
