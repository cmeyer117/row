# Voice Set Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Carl log a set by voice ("log 315 for 8") via a push-to-talk mic button in `gym.html`, without tapping through the UI between sets.

**Architecture:** A new pure-logic file (`gym-voice-logic.js`, following the existing `gym-state-merge-logic.js` / `gym-volume-logic.js` pattern) handles transcript normalization and a today's-workout-scoped fuzzy exercise match. `gym.html` gets a fixed mic button that drives the browser's `SpeechRecognition` API, feeds the result through the existing `parseQuickLog()`/`quickLog()` pipeline (already used by the "ghost tap" flow), and shows a toast with undo.

**Tech Stack:** Vanilla JS, `webkitSpeechRecognition` (iOS Safari), no new dependencies.

**Deviation from spec's file list:** The spec ([docs/superpowers/specs/2026-08-06-voice-set-logging-design.md](file:///C:/Users/gregm/row/docs/superpowers/specs/2026-08-06-voice-set-logging-design.md)) says "gym.html only." This plan adds one small new file instead, to match this codebase's established pattern (pure logic in a standalone `gym-*-logic.js`, loaded via `<script src>`, tested with a `.test.js` sibling — see `gym-state-merge-logic.js`/`.test.js`). `gym.html`'s own inline script isn't unit-testable in isolation, so this is the only way to give the parsing/matching logic a real automated test rather than a manual-only check. All DOM wiring, the mic button, and the SpeechRecognition glue still live directly in `gym.html`, matching the spec's intent.

---

### Task 1: Pure logic — transcript normalization + restricted exercise match

**Files:**
- Create: `gym-voice-logic.js`
- Test: `gym-voice-logic.test.js`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\gregm\row\gym-voice-logic.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\gregm\row && node gym-voice-logic.test.js`
Expected: throws (`gym-voice-logic.js` doesn't exist yet) — `Error: ENOENT: no such file or directory`.

- [ ] **Step 3: Write minimal implementation**

Create `C:\Users\gregm\row\gym-voice-logic.js`:

```js
// gym-voice-logic.js — pure transcript normalization + restricted exercise
// matching for voice set logging. No DOM, no Supabase, no dependency on
// gym.html's `state`: the candidate pool for matching is passed in
// explicitly so the caller controls scope (e.g. today's workout only).
(function () {
  'use strict';

  // "for", though it reads like a filler word, is intentionally NOT in this
  // list -- normalizeTranscript's digit-collapse regex keys off it. See the
  // bodyweight-phrasing test case for the known v1 gap this leaves.
  var FILLER_WORDS = ['log', 'please', 'set', 'at', 'on'];

  function normalizeTranscript(raw) {
    var s = (raw || '').toLowerCase().trim();
    // Collapse "X for Y" -> "X×Y" only when both sides are numeric, so
    // exercise names/words containing "for" are left alone.
    s = s.replace(/(\d+(?:\.\d+)?)\s+for\s+(\d+(?:\.\d+)?)/g, '$1×$2');
    var tokens = s.split(/\s+/).filter(function (t) {
      return t.length > 0 && FILLER_WORDS.indexOf(t) === -1;
    });
    return tokens.join(' ');
  }

  // Same bidirectional token-overlap scoring as gym.html's own
  // fuzzyMatchExercise() (threshold 0.35), but the candidate pool is an
  // explicit argument instead of being read from global state.
  // candidates: Array<{name: string, ...}> -- any extra fields on the
  // matched candidate are returned as-is.
  function restrictedFuzzyMatch(namePart, candidates) {
    var q = (namePart || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    var qTokens = q.split(/\s+/).filter(Boolean);
    if (!qTokens.length || !candidates || !candidates.length) return null;
    var best = null, bestScore = -1;
    candidates.forEach(function (c) {
      var name = c.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      var nTokens = name.split(/\s+/).filter(Boolean);
      var hits = 0;
      qTokens.forEach(function (qt) {
        if (nTokens.some(function (nt) { return nt.indexOf(qt) === 0 || qt.indexOf(nt) === 0; })) hits++;
      });
      var score = (hits * hits) / (Math.max(qTokens.length, 1) * Math.max(nTokens.length, 1));
      if (score > bestScore) { bestScore = score; best = c; }
    });
    return bestScore >= 0.35 ? best : null;
  }

  var api = { normalizeTranscript: normalizeTranscript, restrictedFuzzyMatch: restrictedFuzzyMatch };
  if (typeof window !== 'undefined') window.GymVoiceLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Users\gregm\row && node gym-voice-logic.test.js`
Expected: `gym-voice-logic: all 9 cases pass`

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\gregm\row"
git add gym-voice-logic.js gym-voice-logic.test.js
git commit -m "feat: add voice-log transcript normalizer + restricted exercise match"
```

---

### Task 2: Load the new script in gym.html

**Files:**
- Modify: `gym.html:6464`

- [ ] **Step 0: Re-check for collisions before the first `gym.html` edit**

Run: `cd C:\Users\gregm\row && git fetch && git status --short && git log --oneline -5 -- gym.html`

Per the design spec's collision note, Session 2 (Posing Coach) may also be editing `gym.html`. If `git status`/`git log` show unpushed or unfamiliar in-flight changes to `gym.html` from that session, stop and flag it to Carl before continuing — don't silently edit over it.

- [ ] **Step 1: Add the script tag**

At `gym.html:6464`, right after the `gym-state-merge-logic.js` tag:

```html
<script src="gym-state-merge-logic.js"></script>
<script src="gym-voice-logic.js"></script>
```

- [ ] **Step 2: Verify it loads with no console errors**

Run: `cd C:\Users\gregm\row && node -e "console.log('placeholder — real check happens in Task 6 browser smoke test')"`

(No automated check for a `<script src>` tag in a static HTML file — confirmed visually in Task 6's browser smoke test. This step just locks in the exact tag placement so Task 6 knows what to look for in DevTools' Network/Console tabs.)

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\gregm\row"
git add gym.html
git commit -m "feat: load gym-voice-logic.js in gym.html"
```

---

### Task 3: Mic button markup + CSS

**Files:**
- Modify: `gym.html:2460` (markup, right after `quickLogWrap`)
- Modify: `gym.html` CSS block near `.tabbar`/`.gym-tabbar` (styles)

- [ ] **Step 1: Add the button markup**

At `gym.html:2460`, right after the `quickLogWrap` div's closing `</div>`:

```html
  </div>

  <!-- Voice log: push-to-talk mic button. Fixed above both tab bars so
       it's reachable mid-set without scrolling. Hidden via JS if
       SpeechRecognition isn't supported (see initVoiceLog). -->
  <button class="po-voice-mic" id="voiceMicBtn" type="button" title="Log a set by voice" style="display:none;">
    🎙
  </button>
  <div class="po-voice-toast ql-hidden" id="voiceToast">
    <span id="voiceToastMsg"></span>
    <button id="voiceToastUndo" class="po-voice-toast-undo" type="button" style="display:none;">Undo</button>
  </div>
```

- [ ] **Step 2: Add CSS**

Add near the `.gym-tabbar` rules (around `gym.html:2196`, right after the `.gym-tab.active` rule):

```css
.po-voice-mic {
  position: fixed; right: 16px; bottom: calc(150px + env(safe-area-inset-bottom)); z-index: 70;
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; line-height: 1;
  background: var(--accent); color: #0a0a0b; border: none;
  box-shadow: 0 8px 24px rgba(0,0,0,0.45);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s, box-shadow 0.15s;
}
.po-voice-mic.is-listening {
  animation: po-voice-pulse 1.1s ease-in-out infinite;
}
@keyframes po-voice-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(0,0,0,0.45); }
  50% { transform: scale(1.08); box-shadow: 0 8px 30px rgba(110,231,183,0.55); }
}
.po-voice-toast {
  position: fixed; left: 50%; bottom: calc(150px + env(safe-area-inset-bottom)); z-index: 70;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px;
  max-width: calc(100vw - 32px);
  padding: 12px 16px; border-radius: 14px;
  background: rgba(20,20,22,0.92); border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 12px 36px rgba(0,0,0,0.55);
  color: var(--text-1); font-size: 14px; font-weight: 600;
  transition: opacity 0.15s, transform 0.15s;
}
.po-voice-toast.ql-hidden { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(8px); }
.po-voice-toast-undo {
  background: transparent; border: 1px solid rgba(255,255,255,0.25); color: var(--accent);
  border-radius: 8px; padding: 4px 10px; font-size: 13px; font-weight: 700; cursor: pointer;
}
```

Note: `.ql-hidden` already exists as a class name pattern in this file (used by `#quickLogFeedback`) — reusing the same name here for the same "hidden state" convention, but it's a distinct CSS rule scoped to `.po-voice-toast.ql-hidden`, not shared styling.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\gregm\row"
git add gym.html
git commit -m "feat: add voice-log mic button and toast markup/CSS"
```

---

### Task 4: SpeechRecognition wiring

**Files:**
- Modify: `gym.html:5877` (insert new IIFE right after `initQuickLog`'s closing `})();`, before `initPlateCalc`)

- [ ] **Step 1: Add the `initVoiceLog` IIFE**

At `gym.html:5877`, right after `initQuickLog`'s closing `})();` and before `(function initPlateCalc() {`:

```javascript
  (function initVoiceLog() {
    var btn = $('voiceMicBtn');
    var toast = $('voiceToast');
    var toastMsg = $('voiceToastMsg');
    var toastUndo = $('voiceToastUndo');
    var SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return; // button stays display:none — unsupported browser

    btn.style.display = 'flex';
    var recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    var listening = false;
    var toastTimer = null;

    function hideToast() {
      toast.classList.add('ql-hidden');
      toastUndo.style.display = 'none';
      toastUndo.onclick = null;
    }

    function showToast(msg, onUndo) {
      clearTimeout(toastTimer);
      toastMsg.textContent = msg;
      toast.classList.remove('ql-hidden');
      if (onUndo) {
        toastUndo.style.display = 'inline-block';
        toastUndo.onclick = function () { onUndo(); hideToast(); };
      } else {
        toastUndo.style.display = 'none';
        toastUndo.onclick = null;
      }
      toastTimer = setTimeout(hideToast, 5000);
    }

    function setListening(on) {
      listening = on;
      btn.classList.toggle('is-listening', on);
    }

    btn.addEventListener('click', function () {
      if (listening) { recognition.stop(); return; }
      try { recognition.start(); setListening(true); }
      catch (e) { setListening(false); } // already-started guard
    });

    recognition.addEventListener('end', function () { setListening(false); });
    recognition.addEventListener('error', function () {
      setListening(false);
      showToast("Didn't catch that — try again", null);
    });

    recognition.addEventListener('result', function (e) {
      var transcript = e.results[0][0].transcript;
      var normalized = window.GymVoiceLogic.normalizeTranscript(transcript);
      var parsed = parseQuickLog(normalized);
      if (!parsed) {
        showToast("Didn't catch that — try again", null);
        return;
      }
      var candidates = getFiltered(); // today's workout: program + today's adhoc
      var matched = window.GymVoiceLogic.restrictedFuzzyMatch(parsed.namePart, candidates);
      if (!matched) {
        showToast("Didn't catch the exercise — try again", null);
        return;
      }
      var raw = matched.bw
        ? matched.name + ' ' + parsed.reps + (parsed.rir != null ? ' @' + parsed.rir : '')
        : matched.name + ' ' + parsed.weight + '×' + parsed.reps + (parsed.rir != null ? ' @' + parsed.rir : '');
      var beforeCount = (state.logs[matched.id] || []).length;
      var result = quickLog(raw, getActiveDate());
      if (!result.ok) {
        showToast(result.msg, null);
        return;
      }
      var logsArr = state.logs[matched.id];
      var canUndo = logsArr.length > beforeCount;
      showToast(result.msg, canUndo ? function () {
        logsArr.pop(); // just-logged entry sorts last (its date is "now")
        saveState(); renderAll();
        if (typeof wtRender === 'function') wtRender();
      } : null);
    });
  })();
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\gregm\row"
git add gym.html
git commit -m "feat: wire push-to-talk voice logging to quickLog via SpeechRecognition"
```

---

### Task 5: Manual browser smoke test

SpeechRecognition needs a real mic + real browser — this can't be scripted. Run on Carl's iPhone Safari against the deployed/local `gym.html`, or in desktop Chrome (also supports `webkitSpeechRecognition`) as a faster first pass before the on-device check.

**Files:** none (verification only)

- [ ] **Step 1: Load `gym.html` in a browser with today's workout populated**

Confirm the mic button (🎙) is visible, fixed above the tab bars.

- [ ] **Step 2: Tap the mic, say "log 315 for 8" for the first exercise on today's workout**

Expected: button pulses while listening, then a toast reading "✓  <exercise name>  ·  315lb × 8" (or similar, per `formatSet()`) appears with an Undo button. Confirm the set actually appears in the exercise's log/PR display.

- [ ] **Step 3: Tap Undo within 5 seconds**

Expected: the just-logged set disappears from the log; toast dismisses.

- [ ] **Step 4: Say a command naming an exercise NOT on today's workout** (e.g. an exercise from a different day)

Expected: toast reads "Didn't catch the exercise — try again", and no new ad-hoc exercise is created (check `state.sessions[today]` in DevTools if unsure).

- [ ] **Step 5: Say gibberish / stay silent until the mic times out**

Expected: "Didn't catch that — try again" toast, no crash, mic button returns to idle state.

- [ ] **Step 6: Test a bodyweight exercise if today's workout has one** (e.g. "log pullups for 10")

Expected: logs correctly despite the known "for" phrasing gap noted in `gym-voice-logic.test.js` — confirm via the fuzzy-match tolerance, or report back if it actually fails so the plan's "not blocking v1" call can be revisited.

- [ ] **Step 7: On Carl's actual gym iPhone (Safari), repeat steps 2–3 in a real gym-noise environment**

This is the real gate — confirms the push-to-talk trigger (no accidental activation from ambient noise, since it's tap-triggered not always-listening) and mic accuracy hold up outside a quiet room.

---

### Task 6: Ship — update the Round 2 checklist

**Files:**
- Modify: `Claude Outputs/2026-08-06-vision-scan-review-checklist.md` (in the `G:\My Drive\Claude` repo, row 39) — only after Task 5's manual verification passes, especially step 7 (on Carl's actual phone).

- [ ] **Step 1: Mark row 39 shipped**

Update the row for Round 2 pick #7 (hands-free/voice gym logging) to reflect it's built and verified, per the "Standing rules for all 4 sessions" note in `Claude Outputs/2026-08-06-round2-parallel-builds.md`.

- [ ] **Step 2: Commit and push both repos**

```bash
cd "C:\Users\gregm\row"
git push

cd "G:\My Drive\Claude"
git add "Claude Outputs\2026-08-06-vision-scan-review-checklist.md"
git commit -m "docs: mark Round 2 voice set logging shipped"
git push
```
