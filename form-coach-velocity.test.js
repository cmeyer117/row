// Loaded as a classic <script> tag in the browser — see
// gym-state-merge-logic.test.js for why this sandboxes instead of import/require.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./form-coach-logic.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { scoreVelocity, segmentReps, scoreSet } = sandbox.window.FormCoachLogic;

const cases = [];

// scoreVelocity operates on segmentReps() output (needs concentricMs via
// phaseDurations, so build reps the same way scoreSet does internally).
function repsFromRoms(specs) {
  // specs: [{ rom, concentricMs }] — build minimal rep-shaped objects
  // scoreVelocity actually needs: rom, and enough of segmentReps' shape
  // for phaseDurations to derive concentricMs (midT->endT).
  var t = 0;
  return specs.map(function (s) {
    var startT = t;
    var midT = startT + 500; // eccentric phase, arbitrary/unused by velocity
    var endT = midT + s.concentricMs;
    t = endT + 100;
    return { startT: startT, midT: midT, endT: endT, startValue: 0, midValue: s.rom, endValue: 0, rom: s.rom, durationMs: endT - startT };
  });
}

{
  const result = scoreVelocity([]);
  cases.push(['empty input -> []', Array.isArray(result) && result.length === 0]);
}
{
  // 4 reps, identical rom/concentric time throughout -> no fatigue, no flags.
  const reps = repsFromRoms([{ rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 900 }]);
  const result = scoreVelocity(reps);
  cases.push(['steady velocity across 4 reps -> no flags', result.every(function (r) { return r.velocityFlag === false; })]);
  cases.push(['steady velocity -> velocityPct near 1 for scored reps', result[2].velocityPct > 0.95 && result[2].velocityPct < 1.05]);
}
{
  // Baseline reps (first 2) never get a flag verdict -- nothing to compare against yet.
  const reps = repsFromRoms([{ rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 900 }]);
  const result = scoreVelocity(reps);
  cases.push(['baseline reps (1-2) have velocityPct null', result[0].velocityPct === null && result[1].velocityPct === null]);
  cases.push(['baseline reps (1-2) never flagged', result[0].velocityFlag === false && result[1].velocityFlag === false]);
}
{
  // Rep 3 drops concentric velocity by >20% (same rom, slower concentric) -> flagged.
  const reps = repsFromRoms([{ rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 1200 }]);
  const result = scoreVelocity(reps);
  cases.push(['rep 3 concentric slows >20% -> flagged', result[2].velocityFlag === true]);
  cases.push(['flagged rep velocityPct reflects the drop', result[2].velocityPct < 0.8]);
}
{
  // Rep 3 drops just under the 20% threshold -> not flagged.
  const reps = repsFromRoms([{ rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 1100 }]);
  const result = scoreVelocity(reps);
  cases.push(['rep 3 concentric slows <20% -> not flagged', result[2].velocityFlag === false]);
}
{
  // Zero concentric time (bad data) never divides by zero / crashes.
  const reps = repsFromRoms([{ rom: 90, concentricMs: 0 }, { rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 900 }]);
  const result = scoreVelocity(reps);
  cases.push(['zero concentricMs -> concentricVelocity null, not a crash/Infinity', result[0].concentricVelocity === null]);
}
{
  // Codex review catch (2026-09-09): 0 is a legitimate value for both
  // params, not "missing" -- must not fall back to the default via `||`.
  // baselineRepCount=0 means no baseline reps exist to average, so every
  // rep correctly gets velocityPct=null (nothing to compare against) --
  // the point of this test is that it does NOT silently become 2 instead.
  const reps = repsFromRoms([{ rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 1200 }]);
  const result = scoreVelocity(reps, 0, 0);
  cases.push(['baselineRepCount=0 is honored (not replaced by default 2) -- no baseline ever forms', result.every(function (r) { return r.velocityPct === null; })]);
}
{
  // flagPct=0 is honored too -- a flag threshold of 0 means nothing can
  // ever be "below" it, so no rep is flagged even with a real velocity drop.
  const reps = repsFromRoms([{ rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 5000 }]);
  const result = scoreVelocity(reps, 2, 0);
  cases.push(['flagPct=0 is honored (not replaced by default 0.8)', result[2].velocityFlag === false]);
}
{
  // Custom baselineRepCount and flagPct are honored.
  const reps = repsFromRoms([{ rom: 90, concentricMs: 900 }, { rom: 90, concentricMs: 950 }]);
  const result = scoreVelocity(reps, 1, 0.5);
  cases.push(['baselineRepCount=1 -> rep 2 gets a verdict, not null', result[1].velocityPct !== null]);
}
{
  // Full scoreSet() integration — velocity fields land on the combined output alongside the existing rom/tempo/stability fields.
  var samples = [];
  var t = 0;
  [90, 900, 0, 500, 90, 900, 0, 500, 90, 1200, 0].forEach(function (v, i) {
    // Build a plausible up/down signal: reuse the existing shape scoreSet's own tests would need.
  });
  // Simpler: call scoreSet with a hand-built rep-like sample stream via segmentReps directly is
  // out of scope here (covered by form-coach-logic's own segmentReps tests, absent today) —
  // just confirm scoreSet's return shape carries the new fields when reps exist.
  var syntheticSamples = [
    { t: 0, value: 0 }, { t: 500, value: 90 }, { t: 1400, value: 0 },
    { t: 1900, value: 90 }, { t: 2800, value: 0 },
    { t: 3300, value: 90 }, { t: 4500, value: 0 }
  ];
  var scored = scoreSet(syntheticSamples, [], 10, null);
  cases.push(['scoreSet output includes velocity fields', scored.length > 0 && 'velocityFlag' in scored[0] && 'concentricVelocity' in scored[0]]);
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`form-coach-velocity: all ${cases.length} cases pass`);
