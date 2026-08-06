// gym-voice-logic.js is loaded in the browser as a classic (non-module)
// <script> tag (gym.html), so it can't use `export`. Under this repo's
// "type": "module" package.json, load it the same way
// gym-state-merge-logic.test.js does: eval the source text in a sandboxed
// `window` object instead of require()/import.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./gym-voice-logic.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { normalizeTranscript, restrictedFuzzyMatch } = sandbox.window.GymVoiceLogic;

const cases = [];

// --- normalizeTranscript ---

{
  const result = normalizeTranscript('log 315 for 8');
  cases.push(['strips "log", collapses "for" between numbers', result === '315×8']);
}
{
  const result = normalizeTranscript('please log bench press 225 for 10');
  cases.push(['strips multiple filler words, keeps exercise name', result === 'bench press 225×10']);
}
{
  const result = normalizeTranscript('  LOG   315   FOR   8  ');
  cases.push(['lowercases and collapses whitespace', result === '315×8']);
}
{
  // Known v1 limitation (documented in the design spec): a bodyweight-style
  // command with no weight number leaves a bare "for" token in place, since
  // the collapse rule only fires between two numbers. restrictedFuzzyMatch's
  // bidirectional scoring still tolerates the extra token in practice.
  const result = normalizeTranscript('log pullups for 10');
  cases.push(['bodyweight phrasing leaves "for" (documented limitation)', result === 'pullups for 10']);
}
{
  const result = normalizeTranscript('');
  cases.push(['empty input returns empty string, does not throw', result === '']);
}

// --- restrictedFuzzyMatch ---

{
  const candidates = [{ id: '1', name: 'Barbell Bench Press' }, { id: '2', name: 'Back Squat' }];
  const result = restrictedFuzzyMatch('bench press', candidates);
  cases.push(['matches best candidate by token overlap', result && result.id === '1']);
}
{
  const candidates = [{ id: '1', name: 'Back Squat' }];
  const result = restrictedFuzzyMatch('zzz nonsense query', candidates);
  cases.push(['no match below threshold returns null', result === null]);
}
{
  // The whole point of "restricted" — deadlift isn't in this candidate
  // pool (e.g. not on today's workout), so it must not match anything
  // else in the pool by accident.
  const candidates = [{ id: '1', name: 'Back Squat' }, { id: '2', name: 'Bench Press' }];
  const result = restrictedFuzzyMatch('deadlift', candidates);
  cases.push(['out-of-pool exercise does not match', result === null]);
}
{
  const candidates = [{ id: '1', name: 'Pull Ups', bw: true }];
  const result = restrictedFuzzyMatch('pullups', candidates);
  cases.push(['extra fields (bw) pass through on the returned match', result && result.bw === true]);
}
{
  const result = restrictedFuzzyMatch('bench', []);
  cases.push(['empty candidate pool returns null, does not throw', result === null]);
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`gym-voice-logic: all ${cases.length} cases pass`);
