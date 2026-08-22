// weekly-review.html's inline <script> is loaded as a classic (non-module)
// tag, so it can't be imported -- same vm-sandbox pattern as sync-status.test.js.
// This is the lightweight version of the item #6 wiring test (2026-08-22
// decision, see HANDOFF): rather than faking a full DOM + all ~15 window
// globals the page loads, run computeScorecard() (and its real transitive
// dependency, gym-volume-logic.js) in isolation. Catches a data-shape/
// field-name drift between weekly-review.html and the modules it composes --
// the silent-failure class of bug a test is actually for. A broken innerHTML
// template reference (the other class a full-DOM test would catch) is loud
// and shows up the first time the page is opened, so it's not covered here.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const gymVolumeSource = readFileSync(new URL('./gym-volume-logic.js', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./weekly-review.html', import.meta.url), 'utf8');

// Pull just the inline (non-src) <script> block -- the one with the page's
// own logic, not the <script src="..."> module tags.
const scriptMatch = pageSource.match(/<script>\r?\n(const MUSCLES[\s\S]*?)\r?\n<\/script>/);
if (!scriptMatch) {
  console.error('FAIL: could not find weekly-review.html\'s inline <script> block -- page structure changed');
  process.exit(1);
}
const pageScriptSource = scriptMatch[1];

function makePage({ poCoachData, healthData, posingData } = {}) {
  const fetchCalls = [];
  const sandbox = {
    window: {},
    document: { addEventListener: () => {}, getElementById: () => null },
    fetch: (url) => {
      fetchCalls.push(url);
      if (url.includes('key=eq.po-coach')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(poCoachData ? [{ data: poCoachData }] : []) });
      }
      if (url.includes('key=eq.health')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(healthData ? [{ data: healthData }] : []) });
      }
      if (url.includes('key=eq.posing')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(posingData ? [{ data: posingData }] : []) });
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
  sandbox.window.RowAuth = { getAccessToken: async () => 'tok' };
  vm.runInContext(pageScriptSource, sandbox);
  return { computeScorecard: sandbox.computeScorecard, fetchCalls };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

async function run() {
  // --- real GymVolumeLogic.weeklySetsByMuscle wiring: a decision to
  // add_set on Chest, actual sets genuinely exceed the recorded baseline ---
  {
    const decisionCreatedAt = '2026-08-01T12:00:00Z';
    const scoreWeekMonday = '2026-08-03'; // Monday of the score week (decision date + 7 days, eastern-adjusted)
    const page = makePage({
      poCoachData: {
        po_coach_v1: {
          exercises: [{ id: 'e1', name: 'Barbell Bench Press', muscle: 'Chest' }],
          logs: { e1: [{ date: scoreWeekMonday + 'T10:00:00Z', weight: 100, reps: 8 }, { date: scoreWeekMonday + 'T10:00:00Z', weight: 100, reps: 8 }] },
        },
      },
    });
    const decision = {
      created_at: decisionCreatedAt,
      details: { muscle_groups: { Chest: { action: 'add_set', baseline: 1 } } },
    };
    const scorecard = await page.computeScorecard(decision);
    const chestRow = scorecard.volumeRows.find((r) => r.muscle === 'Chest');
    assertEqual(chestRow.actual, 2, 'weeklySetsByMuscle wiring: 2 logged hard sets counted for Chest');
    assertEqual(chestRow.matched, true, 'matchesVolumeDecision wiring: 2 actual > baseline 1 for add_set counts as matched');
  }

  // --- cardio/posing Rx target wiring: health/posing app_state keys feed
  // through countEntriesInWeek + matchesCountTarget correctly ---
  {
    const decisionCreatedAt = '2026-08-01T12:00:00Z';
    const weekDate = '2026-08-04'; // inside the score week (2026-08-03..09)
    const page = makePage({
      poCoachData: { po_coach_v1: { exercises: [], logs: {} } },
      healthData: { 'health:cardio': [{ date: weekDate }, { date: weekDate }] },
      posingData: { 'posing:log': [{ date: weekDate }] },
    });
    const decision = {
      created_at: decisionCreatedAt,
      details: {
        muscle_groups: {},
        cardio_rx: { target: 2, guardrail: null },
        posing_rx: { target: 3, guardrail: null },
      },
    };
    const scorecard = await page.computeScorecard(decision);
    assertEqual(scorecard.cardioCount, 2, 'health:cardio entries in the score week counted correctly');
    assertEqual(scorecard.posingCount, 1, 'posing:log entries in the score week counted correctly');
    assertEqual(scorecard.cardioRx.verdict, 'matched', '2 actual >= 2 target -- matched');
    assertEqual(scorecard.posingRx.verdict, 'partly_matched', '1 actual < 3 target, actual > 0 -- partly_matched');
  }

  console.log('weekly-review-scorecard.test.js: all cases passed');
}

run();
