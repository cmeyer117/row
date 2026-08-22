// weekly-review.html's inline <script> is loaded as a classic (non-module)
// tag, so it can't be imported -- same vm-sandbox extraction pattern as
// weekly-review-scorecard.test.js. Tests buildCoachResponse() in isolation:
// a pure function with no DOM/fetch dependency, so no fixture stubs needed.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const pageSource = readFileSync(new URL('./weekly-review.html', import.meta.url), 'utf8');

const scriptMatch = pageSource.match(/<script>\r?\n(const MUSCLES[\s\S]*?)\r?\n<\/script>/);
if (!scriptMatch) {
  console.error('FAIL: could not find weekly-review.html\'s inline <script> block -- page structure changed');
  process.exit(1);
}
const pageScriptSource = scriptMatch[1];

function loadPage() {
  const sandbox = {
    window: {},
    document: { addEventListener: () => {}, getElementById: () => null },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve([]) }),
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
  // GymVolumeLogic isn't needed for buildCoachResponse, but the page script
  // references `window.GymVolumeLogic.MUSCLE_BANDS` at its top level (the
  // MUSCLES constant) -- stub just enough for the script to load without
  // throwing.
  sandbox.window.GymVolumeLogic = { MUSCLE_BANDS: {} };
  vm.runInContext(pageScriptSource, sandbox);
  return sandbox.buildCoachResponse;
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

function run() {
  const buildCoachResponse = loadPage();

  assertEqual(buildCoachResponse('', ''), null, 'both blank -- omitted entirely (null)');
  assertEqual(buildCoachResponse('', '   '), null, 'whitespace-only note with no status -- still omitted');
  assertEqual(
    buildCoachResponse('approved', ''),
    { status: 'approved', note: null },
    'status only -- included, note is null not empty string'
  );
  assertEqual(
    buildCoachResponse('', 'said to hold volume flat'),
    { status: null, note: 'said to hold volume flat' },
    'note only -- included, status is null'
  );
  assertEqual(
    buildCoachResponse('modified', '  add 2g protein/day  '),
    { status: 'modified', note: 'add 2g protein/day' },
    'both filled -- included, note trimmed'
  );

  console.log('weekly-review-closeout.test.js: all cases passed');
}

run();
