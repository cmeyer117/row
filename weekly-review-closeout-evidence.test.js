// weekly-review.html's inline <script> is loaded as a classic (non-module)
// tag, so it can't be imported -- same vm-sandbox extraction pattern as
// weekly-review-scorecard.test.js / weekly-review-closeout.test.js.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const gymVolumeSource = readFileSync(new URL('./gym-volume-logic.js', import.meta.url), 'utf8');
const gymWorkoutEventsSource = readFileSync(new URL('./gym-workout-events.js', import.meta.url), 'utf8');
const insightEngineSource = readFileSync(new URL('./training-insight-engine.js', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./weekly-review.html', import.meta.url), 'utf8');

const scriptMatch = pageSource.match(/<script>\r?\n(const MUSCLES[\s\S]*?)\r?\n<\/script>/);
if (!scriptMatch) {
  console.error('FAIL: could not find weekly-review.html\'s inline <script> block -- page structure changed');
  process.exit(1);
}
const pageScriptSource = scriptMatch[1];

function makePage({ poCoachData, healthData } = {}) {
  const fetchCalls = [];
  const sandbox = {
    window: { SUPABASE_CONFIG: { URL: 'https://example.supabase.co', KEY: 'test-key' } },
    document: { addEventListener: () => {}, getElementById: () => null },
    fetch: (url) => {
      fetchCalls.push(url);
      if (url.includes('key=eq.po-coach')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(poCoachData ? [{ data: poCoachData }] : []) });
      }
      if (url.includes('key=eq.health')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(healthData ? [{ data: healthData }] : []) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
    },
    console,
    Promise,
    Date,
    Object,
    Array,
    Math,
    JSON,
    Intl,
  };
  vm.createContext(sandbox);
  vm.runInContext(gymVolumeSource, sandbox);
  vm.runInContext(gymWorkoutEventsSource, sandbox);
  vm.runInContext(insightEngineSource, sandbox);
  sandbox.window.RowAuth = { getAccessToken: async () => 'tok' };
  vm.runInContext(pageScriptSource, sandbox);
  return sandbox;
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

function assert(cond, label) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
}

function runMatchInsightFindingsTests(page) {
  const { matchInsightFindings } = page;

  const chronicUnder = { type: 'chronic-muscle-under', muscle: 'Chest', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const chronicOtherMuscle = { type: 'chronic-muscle-over', muscle: 'Back', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const stalledMatch = { type: 'stalled-load-plateau', exercise: 'Bench Press', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const stalledNoMatch = { type: 'stalled-load-regression', exercise: 'Overhead Press', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const missedSession = { type: 'missed-session-trend', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const volumePhase = { type: 'volume-phase-mismatch', observation: 'x', confidence: 'low', evidenceWindow: { start: 'a', end: 'b' } };
  const recovery = { type: 'recovery-signal', observation: 'x', confidence: 'medium', evidenceWindow: { start: 'a', end: 'b' } };

  const decision = {
    details: {
      muscle_groups: { Chest: { action: 'add_set', baseline: 10 } },
      anchor_lifts: [{ lift: 'bench press', call: 'progress', guardrail: null }],
    },
  };

  const all = [chronicUnder, chronicOtherMuscle, stalledMatch, stalledNoMatch, missedSession, volumePhase, recovery];
  const result = matchInsightFindings(decision, all);

  assert(result.includes(chronicUnder), 'chronic-muscle finding kept when its muscle is a decision.details.muscle_groups key');
  assert(!result.includes(chronicOtherMuscle), 'chronic-muscle finding dropped when its muscle is NOT in muscle_groups');
  assert(result.includes(stalledMatch), 'stalled-load finding kept when its exercise case-insensitively matches an anchor_lifts[].lift');
  assert(!result.includes(stalledNoMatch), 'stalled-load finding dropped when its exercise matches no anchor_lifts[].lift');
  assert(result.includes(missedSession), 'missed-session-trend always kept (no muscle/exercise field)');
  assert(result.includes(volumePhase), 'volume-phase-mismatch always kept (no muscle/exercise field)');
  assert(result.includes(recovery), 'recovery-signal always kept (no muscle/exercise field)');

  // Empty decision.details -- whole-training findings still kept, scoped ones dropped
  const emptyDecision = { details: {} };
  const emptyResult = matchInsightFindings(emptyDecision, all);
  assertEqual(emptyResult, [missedSession, volumePhase, recovery], 'empty muscle_groups/anchor_lifts -- only whole-training findings survive');

  console.log('matchInsightFindings: all cases passed');
}

function runBuildInsightFindingsCutoffTest(page) {
  const { buildInsightFindings } = page;

  // 4 exposures form a clear plateau (same load/reps, in-window). A 5th
  // exposure logged AFTER nowRef is a big new PR -- if buildInsightFindings
  // fails to filter it out, the plateau finding disappears (isNewHigh sees
  // the future PR as the "latest" exposure). This is the exact leak Codex
  // flagged in review (2026-08-31).
  const gymState = {
    exercises: [{ id: 'e1', name: 'Bodyweight Dip', bw: true }],
    logs: {
      e1: [
        { date: '2026-07-01T10:00:00Z', reps: 8 },
        { date: '2026-07-08T10:00:00Z', reps: 8 },
        { date: '2026-07-15T10:00:00Z', reps: 8 },
        { date: '2026-07-22T10:00:00Z', reps: 8 },
        { date: '2026-08-01T10:00:00Z', reps: 20 }, // AFTER nowRef -- must not leak in
      ],
    },
    season: {},
  };
  const nowRef = new Date('2026-07-25T00:00:00.000Z');
  const result = buildInsightFindings(gymState, null, null, nowRef);
  const stall = result.findings.find(f => f.exercise === 'Bodyweight Dip');
  assert(stall, 'plateau finding present -- future exposure correctly excluded from the trailing run');
  assertEqual(stall.type, 'stalled-load-plateau', 'finding type is stalled-load-plateau, not suppressed by the future PR');

  console.log('buildInsightFindings cutoff test: passed');
}

async function runComputeCloseoutEvidenceTest() {
  const decisionCreatedAt = '2026-08-01T12:00:00Z'; // scoreWeek Monday = 2026-08-03, Sunday = 2026-08-09 (see weekly-review-scorecard.test.js)
  const page = makePage({
    poCoachData: {
      po_coach_v1: {
        exercises: [{ id: 'e1', name: 'Bodyweight Dip', bw: true }],
        logs: {
          e1: [
            { date: '2026-07-01T10:00:00Z', reps: 8 },
            { date: '2026-07-08T10:00:00Z', reps: 8 },
            { date: '2026-07-15T10:00:00Z', reps: 8 },
            { date: '2026-07-22T10:00:00Z', reps: 8 },
            { date: '2026-08-10T10:00:00Z', reps: 20 }, // AFTER the review week's Sunday (08-09) -- must not leak in
          ],
        },
      },
    },
  });
  const decision = {
    created_at: decisionCreatedAt,
    details: {
      muscle_groups: {},
      anchor_lifts: [{ lift: 'Bodyweight Dip', call: 'progress', guardrail: null }],
    },
  };
  const evidence = await page.computeCloseoutEvidence(decision);
  const stall = evidence.find(f => f.exercise === 'Bodyweight Dip');
  assert(stall, 'computeCloseoutEvidence returns the anchor-lift-matched plateau finding');
  assertEqual(stall.type, 'stalled-load-plateau', 'finding survives both the Sunday cutoff and the anchor_lifts relevance filter');

  console.log('computeCloseoutEvidence test: passed');
}

function runRenderMeasuredEvidenceHtmlTests(page) {
  const { renderMeasuredEvidenceHtml } = page;

  assertEqual(renderMeasuredEvidenceHtml([]), '', 'empty findings -- block omitted entirely');

  const html = renderMeasuredEvidenceHtml([
    { observation: 'Bodyweight Dip: no new load/rep high across 4 exposures.', confidence: 'low', evidenceWindow: { start: '2026-07-01', end: '2026-07-22' } },
  ]);
  assert(html.includes('Measured evidence'), 'section has a Measured evidence heading');
  assert(html.includes('Bodyweight Dip: no new load/rep high across 4 exposures.'), 'finding observation text is rendered');
  assert(html.includes('low confidence'), 'confidence level is rendered');
  assert(html.includes('2026-07-01') && html.includes('2026-07-22'), 'evidence window start/end are rendered');

  console.log('renderMeasuredEvidenceHtml: all cases passed');
}

async function run() {
  const page = makePage();
  runMatchInsightFindingsTests(page);
  runBuildInsightFindingsCutoffTest(page);
  await runComputeCloseoutEvidenceTest();
  runRenderMeasuredEvidenceHtmlTests(page);
  console.log('weekly-review-closeout-evidence.test.js: all cases passed');
}

run();
