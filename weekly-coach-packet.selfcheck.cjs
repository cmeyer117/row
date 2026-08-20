// Run with: node weekly-coach-packet.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'weekly-coach-packet.js'), 'utf8'), sandbox);
const P = sandbox.window.WeeklyCoachPacket;

function assert(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); process.exit(1); }
}

// --- full packet with real findings ---
const full = P.buildWeeklyCoachPacket({
  weekLabel: '2026-08-17 to 2026-08-23',
  summary: { sessionsLogged: 5, totalSets: 62, exercisesTouched: 14 },
  adherence: { macroDaysLogged: 6, sleepNightsLogged: 7, cardioSessions: 3 },
  findings: [{
    severity: 'medium',
    observation: 'Deadlift: latest load is more than 1 SD below recent average.',
    evidenceWindow: { start: '2026-07-20', end: '2026-08-17' },
    confidence: 'medium',
    reviewQuestion: 'Worth a look at Deadlift — has recovery around this lift changed?',
  }],
  notes: [{ title: 'Deload Protocol', path: '03 - Bodybuilding/Deload Protocol.md', reason: 'Tagged "deload"' }],
  missingData: ['No waist measurements logged this week.'],
});
assert(full.includes('# Weekly Coach Packet — 2026-08-17 to 2026-08-23'), 'header includes week label');
assert(full.includes('Sessions logged: 5'), 'summary section renders measured facts');
assert(full.includes('[MEDIUM]'), 'finding severity rendered');
assert(full.includes('Deload Protocol'), 'related note rendered as a link line');
assert(full.includes('No waist measurements logged this week.'), 'missing data explicitly listed');
assert(!full.toLowerCase().includes('you should'), 'no prescriptive language ("you should")');
assert(full.includes('nothing here is a diagnosis, a prescription, or an automatic program change'), 'explicit non-prescriptive/non-diagnostic disclaimer present');

// --- empty/missing input never throws, degrades to explicit "no data" text ---
const empty = P.buildWeeklyCoachPacket({});
assert(empty.includes('No findings met the evidence threshold'), 'empty findings -- explicit no-findings text, not a blank section');
assert(empty.includes('No training summary data supplied'), 'missing summary -- explicit text');
assert(empty.includes('No related notes surfaced'), 'missing notes -- explicit text');
assert(empty.includes('Nothing flagged as missing'), 'missing-data list itself defaults cleanly');

assert(typeof P.buildWeeklyCoachPacket(undefined) === 'string', 'undefined input never throws');

console.log('All weekly-coach-packet self-checks passed.');
