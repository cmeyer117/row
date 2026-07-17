// Run with: node hype-audio.selfcheck.js
// Minimal localStorage shim so the pure-logic functions in
// hype-audio.js (no DOM/network) can run under plain Node.
global.localStorage = (function () {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
})();
global.window = global;

require('./hype-audio.js');
const H = global.HypeAudio;

function assert(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); process.exitCode = 1; }
  else console.log('PASS: ' + msg);
}

// addClip + listClips
H.addClip({ id: '1', title: 'A', mentality: 'goggins', moment: 'pre_workout', play_count: 0 });
H.addClip({ id: '2', title: 'B', mentality: 'dorian', moment: 'mid_set', play_count: 0 });
assert(H.listClips().length === 2, 'addClip adds to the list');

// updateClip
H.updateClip('1', { play_count: 5 });
assert(H.listClips().find((c) => c.id === '1').play_count === 5, 'updateClip patches the right clip');

// pickRandom with filter
const picked = H.pickRandom({ mentality: 'dorian' });
assert(picked && picked.id === '2', 'pickRandom respects a mentality filter');

const pickedNone = H.pickRandom({ mentality: 'nonexistent' });
assert(pickedNone === null, 'pickRandom returns null when nothing matches');

// deleteClip
H.deleteClip('1');
assert(H.listClips().length === 1 && H.listClips()[0].id === '2', 'deleteClip removes only the target clip');

console.log('Self-check complete.');
