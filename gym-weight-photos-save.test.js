// gym-weight-photos.js is loaded as a classic <script> tag and wires DOM
// listeners immediately at load (gym-state-merge-logic.test.js explains why
// this repo sandboxes such files via vm instead of import/require). It
// reads every DOM element through window.__gym.$, so a minimal fake-element
// stub lets the whole file load and run without a real DOM.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function fakeEl() {
  return {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {},
    dataset: {},
    childNodes: [{ textContent: '' }],
    textContent: '', value: '', innerHTML: '', disabled: false,
    addEventListener() {}, focus() {}, select() {}, appendChild() {},
    querySelectorAll: () => [],
  };
}

function makeStorage() {
  const data = {};
  return {
    throwOnSetItem: false,
    getItem: (k) => (k in data ? data[k] : null),
    setItem(k, v) {
      if (this.throwOnSetItem) throw new DOMException('quota exceeded', 'QuotaExceededError');
      data[k] = v;
    },
  };
}

const alerts = [];
const els = new Map();
const storage = makeStorage();
const sandbox = {
  window: {
    __gym: {
      $: (id) => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); },
      state: { units: 'lb', exercises: [], logs: {} },
      CONFIG: { composition: { enabled: false } },
      pcSupa: null,
      resetChipToToday() {},
      initDateChip() {},
      getChipDate: () => null,
      getActiveDate: () => '',
      fmtDateChipLabel: (k) => k,
    },
  },
  localStorage: storage,
  alert: (msg) => alerts.push(msg),
  confirm: () => true,
};
vm.createContext(sandbox);
const source = readFileSync(new URL('./gym-weight-photos.js', import.meta.url), 'utf8');
vm.runInContext(source, sandbox);
const { wtSave, wtSaveEntry } = sandbox.window;

const cases = [];

storage.throwOnSetItem = true;
cases.push(['wtSave returns false when localStorage.setItem throws', wtSave([{ dateKey: '2026-01-01', weight: 180 }]) === false]);

storage.throwOnSetItem = false;
cases.push(['wtSave returns true on a normal write', wtSave([{ dateKey: '2026-01-01', weight: 180 }]) === true]);

// Call-site check: wtSaveEntry must surface the failure (alert), not just
// silently update in-memory state as if the write succeeded.
storage.throwOnSetItem = true;
alerts.length = 0;
wtSaveEntry(181, '2026-01-02');
cases.push(['wtSaveEntry alerts the user when the underlying save fails', alerts.length === 1]);

storage.throwOnSetItem = false;
alerts.length = 0;
wtSaveEntry(182, '2026-01-03');
cases.push(['wtSaveEntry does not alert when the save succeeds', alerts.length === 0]);

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`gym-weight-photos-save: all ${cases.length} cases pass`);
