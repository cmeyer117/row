# Mini Vision Chat Bubble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `gym.html`'s single-page push-to-talk voice mic with a persistent `<mini-vision-chat>` Web Component (text + voice, visible history) embedded on the 5 Row pages Carl actually uses.

**Architecture:** A Shadow-DOM custom element (`mini-vision-chat.js`) backed by a pure logic module (`mini-vision-chat-logic.js`) for the one genuinely testable piece (history-turns → rendered messages). The element talks to the existing `/api/vision-talk` proxy, which gains one new `mode=history` branch that forwards to Vision's already-existing `GET /coach/:coachId/history` — no Vision backend changes.

**Tech Stack:** Plain browser JS (no build step, no framework — matches Row's existing static-HTML architecture), native Web Components (`customElements.define`, Shadow DOM), Node's `vm` module for testing browser-global scripts (matches this repo's existing `*.test.js` pattern, e.g. `gym-state-merge-logic.test.js`).

**Spec:** `docs/superpowers/specs/2026-08-12-mini-vision-chat-bubble-design.md`

---

## File Structure

- **Create** `mini-vision-chat-logic.js` — pure function `historyToMessages(turns)`, no DOM.
- **Create** `mini-vision-chat-logic.test.js` — vm-sandbox unit tests for the above.
- **Create** `mini-vision-chat.js` — the `<mini-vision-chat>` custom element (Shadow DOM markup/styles, bubble toggle, history load, text+voice send, mic lifecycle). Uses `window.MiniVisionChatLogic`.
- **Modify** `api/vision-talk.js` — add a `mode=history` branch.
- **Modify** `gym.html` — delete old mic HTML/CSS/JS; add `<script src="mini-vision-chat.js">` + `<mini-vision-chat></mini-vision-chat>`.
- **Modify** `main.html` — add the same script+tag (already loads `voice-helpers.js`).
- **Modify** `health.html`, `macros.html`, `coaching.html` — add `<script src="voice-helpers.js">` **and** the mini-vision-chat script+tag (none currently load `voice-helpers.js`).

---

### Task 1: Pure history-mapping logic + test

**Files:**
- Create: `mini-vision-chat-logic.js`
- Test: `mini-vision-chat-logic.test.js`

- [ ] **Step 1: Write the failing test**

Create `mini-vision-chat-logic.test.js`:

```js
// mini-vision-chat-logic.js is loaded in the browser as a classic
// (non-module) <script> tag, so it can't use `export`. Mirrors the vm-sandbox
// pattern in gym-state-merge-logic.test.js.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./mini-vision-chat-logic.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { historyToMessages } = sandbox.window.MiniVisionChatLogic;

const cases = [];

{
  const result = historyToMessages([]);
  cases.push(['empty array returns []', Array.isArray(result) && result.length === 0]);
}

{
  const result = historyToMessages(null);
  cases.push(['null returns []', Array.isArray(result) && result.length === 0]);
}

{
  const turns = [
    { userMessage: 'Log 3 sets of squats', assistantResponse: 'Got it, logged.', createdAt: '2026-08-12T10:00:00Z' },
  ];
  const result = historyToMessages(turns);
  cases.push(['single turn produces 2 messages', result.length === 2]);
  cases.push(['first message is user role', result[0].role === 'user' && result[0].text === 'Log 3 sets of squats']);
  cases.push(['second message is assistant role', result[1].role === 'assistant' && result[1].text === 'Got it, logged.']);
}

{
  const turns = [
    { userMessage: 'first', assistantResponse: 'reply one', createdAt: '2026-08-12T10:00:00Z' },
    { userMessage: 'second', assistantResponse: 'reply two', createdAt: '2026-08-12T10:05:00Z' },
  ];
  const result = historyToMessages(turns);
  cases.push(['two turns produce 4 messages in order', result.length === 4 &&
    result[0].text === 'first' && result[1].text === 'reply one' &&
    result[2].text === 'second' && result[3].text === 'reply two']);
}

{
  const turns = [{ userMessage: '', assistantResponse: 'reply only', createdAt: '2026-08-12T10:00:00Z' }];
  const result = historyToMessages(turns);
  cases.push(['empty userMessage is skipped', result.length === 1 && result[0].role === 'assistant']);
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`mini-vision-chat-logic: all ${cases.length} cases pass`);
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node mini-vision-chat-logic.test.js
```
Expected: `ENOENT` — `mini-vision-chat-logic.js` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `mini-vision-chat-logic.js`:

```js
// Pure logic for <mini-vision-chat> (mini-vision-chat.js) -- loaded as a
// classic <script> tag like gym-voice-logic.js, so it can't use `export`.
// See docs/superpowers/specs/2026-08-12-mini-vision-chat-bubble-design.md.
window.MiniVisionChatLogic = (function () {
  // Vision's GET /coach/:coachId/history returns turns oldest-first, each
  // { userMessage, assistantResponse, createdAt } (vision/src/turn-store.ts
  // CoachHistoryTurn). Flattens each turn into a user bubble followed by an
  // assistant bubble, preserving order. Skips either side of a turn if
  // that field is empty (defensive -- getCoachHistory filters null
  // assistant_response already, but doesn't guard empty-string).
  function historyToMessages(turns) {
    if (!Array.isArray(turns)) return [];
    var messages = [];
    turns.forEach(function (turn) {
      if (turn && typeof turn.userMessage === 'string' && turn.userMessage) {
        messages.push({ role: 'user', text: turn.userMessage });
      }
      if (turn && typeof turn.assistantResponse === 'string' && turn.assistantResponse) {
        messages.push({ role: 'assistant', text: turn.assistantResponse });
      }
    });
    return messages;
  }

  return { historyToMessages: historyToMessages };
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node mini-vision-chat-logic.test.js
```
Expected: `mini-vision-chat-logic: all 7 cases pass`

- [ ] **Step 5: Commit**

```bash
git add mini-vision-chat-logic.js mini-vision-chat-logic.test.js
git commit -m "feat: add history-to-messages logic for mini Vision chat bubble"
```

---

### Task 2: `mode=history` on the Row→Vision proxy

**Files:**
- Modify: `api/vision-talk.js`

- [ ] **Step 1: Add the `handleHistory` function**

In `api/vision-talk.js`, add this function after `handleStt` (currently ends at line 95, right before `export default async function handler`):

```js
async function handleHistory(req, res, rawBody) {
  let parsed;
  try { parsed = JSON.parse(rawBody.toString('utf8') || '{}'); } catch { parsed = {}; }
  const coachId = typeof parsed.coachId === 'string' ? parsed.coachId : 'gym';
  try {
    const upstream = await fetch(`${VISION_URL}/coach/${coachId}/history`, {
      method: 'GET',
      headers: { 'Cookie': sessionCookie(process.env.VISION_SESSION_SECRET) },
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Vision' });
  }
}
```

- [ ] **Step 2: Dispatch the new mode**

In the same file's `export default async function handler`, change:

```js
  const mode = (req.query && req.query.mode) || 'talk';
  if (mode === 'tts') return handleTts(req, res, rawBody);
  if (mode === 'stt') return handleStt(req, res, rawBody);
  return handleTalk(req, res, rawBody);
```

to:

```js
  const mode = (req.query && req.query.mode) || 'talk';
  if (mode === 'tts') return handleTts(req, res, rawBody);
  if (mode === 'stt') return handleStt(req, res, rawBody);
  if (mode === 'history') return handleHistory(req, res, rawBody);
  return handleTalk(req, res, rawBody);
```

- [ ] **Step 3: Manual verification against production**

This is a read-only GET (no writes, safe against real prod per Row's usual live-verification convention). After deploying (or via `vercel dev` if running locally), run:

```bash
curl -s -X POST "https://row-sage.vercel.app/api/vision-talk?mode=history" \
  -H "Authorization: Bearer 007007" -H "Content-Type: application/json" \
  -d '{"coachId":"gym"}'
```

Expected: `200` with `{"turns":[...]}` (real past gym-coach turns, or `{"turns":[]}` if none exist).

- [ ] **Step 4: Commit**

```bash
git add api/vision-talk.js
git commit -m "feat: add mode=history to Row's Vision proxy"
```

---

### Task 3: The `<mini-vision-chat>` custom element

**Files:**
- Create: `mini-vision-chat.js`

- [ ] **Step 1: Write the component**

Create `mini-vision-chat.js`:

```js
// <mini-vision-chat> -- persistent floating chat bubble into Vision's `gym`
// coach, replacing gym.html's old push-to-talk-only mic (deleted in the same
// rollout, see Task 4/5 of this plan). Shadow DOM custom element so it drops
// into any page with two lines and never fights that page's own CSS -- no
// build step, no framework, matching Row's existing static-page
// architecture. See docs/superpowers/specs/
// 2026-08-12-mini-vision-chat-bubble-design.md.
(function () {
  var ROW_APP_SECRET = '007007'; // same client-visible trust tier as voice-helpers.js/gym.html -- see api/_lib/verify-app-secret.js.
  var COACH_ID = 'gym';
  // Must stay >= Vision's own 60s codex-exec timeout (vision/src/codex.ts
  // EXEC_OPTIONS) -- a shorter client timeout can abort a call whose write
  // already landed server-side, making a retry double-log it.
  var TALK_TIMEOUT_MS = 65000;

  var STYLE = [
    ':host { all: initial; }',
    '.bubble { position: fixed; right: 16px; bottom: calc(150px + env(safe-area-inset-bottom)); z-index: 70;',
    '  width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center;',
    '  font-size: 24px; background: #6ee7b7; color: #0a0a0b; border: none; box-shadow: 0 8px 24px rgba(0,0,0,0.45);',
    '  cursor: pointer; font-family: -apple-system, sans-serif; }',
    '.panel { position: fixed; right: 16px; bottom: calc(216px + env(safe-area-inset-bottom)); z-index: 70;',
    '  width: min(340px, calc(100vw - 32px)); height: min(440px, calc(100vh - 260px));',
    '  background: rgba(20,20,22,0.97); border: 1px solid rgba(255,255,255,0.10); border-radius: 16px;',
    '  display: none; flex-direction: column; overflow: hidden; font-family: -apple-system, sans-serif;',
    '  box-shadow: 0 12px 36px rgba(0,0,0,0.55); }',
    '.panel.open { display: flex; }',
    '.messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }',
    '.msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.35; color: #f5f5f5; white-space: pre-wrap; }',
    '.msg.user { align-self: flex-end; background: #2a5c46; }',
    '.msg.assistant { align-self: flex-start; background: rgba(255,255,255,0.08); }',
    '.msg.status { align-self: center; color: rgba(255,255,255,0.5); font-size: 12px; }',
    '.inputRow { display: flex; gap: 6px; padding: 8px; border-top: 1px solid rgba(255,255,255,0.10); }',
    '.inputRow input { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);',
    '  border-radius: 10px; padding: 8px 10px; color: #f5f5f5; font-size: 14px; }',
    '.inputRow button { border: none; border-radius: 10px; width: 36px; height: 36px; cursor: pointer; font-size: 16px; }',
    '.sendBtn { background: #6ee7b7; color: #0a0a0b; }',
    '.micBtn { background: rgba(255,255,255,0.10); color: #f5f5f5; }',
    '.micBtn.listening { background: #ff4444; color: #fff; }',
    'button:disabled, input:disabled { opacity: 0.5; cursor: default; }',
  ].join('\n');

  var MARKUP = [
    '<button class="bubble" title="Talk to Vision">\u{1F4AC}</button>',
    '<div class="panel">',
    '  <div class="messages"></div>',
    '  <div class="inputRow">',
    '    <button class="micBtn" type="button" title="Talk to Vision" hidden>\u{1F3A4}</button>',
    '    <input type="text" placeholder="Ask Vision…" />',
    '    <button class="sendBtn" type="button" title="Send">➤</button>',
    '  </div>',
    '</div>',
  ].join('');

  class MiniVisionChat extends HTMLElement {
    connectedCallback() {
      var root = this.attachShadow({ mode: 'open' });
      var style = document.createElement('style');
      style.textContent = STYLE;
      root.appendChild(style);
      var wrap = document.createElement('div');
      wrap.innerHTML = MARKUP;
      while (wrap.firstChild) root.appendChild(wrap.firstChild);

      this._panel = root.querySelector('.panel');
      this._messages = root.querySelector('.messages');
      this._input = root.querySelector('.inputRow input');
      this._sendBtn = root.querySelector('.sendBtn');
      this._micBtn = root.querySelector('.micBtn');

      this._historyLoaded = false;
      this._pending = false;
      this._voiceController = null;

      root.querySelector('.bubble').addEventListener('click', () => this._toggle());
      this._sendBtn.addEventListener('click', () => this._sendFromInput());
      this._input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._sendFromInput(); });

      if (window.RowVoice && window.RowVoice.isSupported()) {
        this._micBtn.hidden = false;
        this._micBtn.addEventListener('click', () => this._toggleMic());
      }

      this._onPageHide = () => this._stopVoice();
      window.addEventListener('pagehide', this._onPageHide);
    }

    disconnectedCallback() {
      window.removeEventListener('pagehide', this._onPageHide);
      this._stopVoice();
    }

    _toggle() {
      var isOpen = this._panel.classList.contains('open');
      if (isOpen) { this._panel.classList.remove('open'); return; }
      this._panel.classList.add('open');
      if (!this._historyLoaded) this._loadHistory();
    }

    _setBusy(busy) {
      this._input.disabled = busy;
      this._sendBtn.disabled = busy;
      this._micBtn.disabled = busy;
    }

    _appendMessage(role, text) {
      var div = document.createElement('div');
      div.className = 'msg ' + role;
      div.textContent = text;
      this._messages.appendChild(div);
      this._messages.scrollTop = this._messages.scrollHeight;
      return div;
    }

    _loadHistory() {
      this._historyLoaded = true; // only ever attempt once per page load
      this._setBusy(true);
      var status = this._appendMessage('status', 'Loading…');
      fetch('/api/vision-talk?mode=history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ROW_APP_SECRET },
        body: JSON.stringify({ coachId: COACH_ID }),
      }).then((res) => res.json()).then((data) => {
        status.remove();
        var messages = window.MiniVisionChatLogic.historyToMessages(data && data.turns);
        messages.forEach((m) => this._appendMessage(m.role, m.text));
      }).catch(() => {
        status.remove(); // history is a display enhancement -- a failed load just means starting blank
      }).finally(() => this._setBusy(false));
    }

    _sendFromInput() {
      var text = this._input.value.trim();
      if (!text || this._pending) return;
      this._input.value = '';
      this._send(text, 'text');
    }

    _send(transcript, source) {
      if (this._pending) return;
      this._pending = true;
      this._setBusy(true);
      this._appendMessage('user', transcript);
      var status = this._appendMessage('status', 'Thinking…');
      var controller = new AbortController();
      var timer = setTimeout(() => controller.abort(), TALK_TIMEOUT_MS);
      fetch('/api/vision-talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ROW_APP_SECRET },
        body: JSON.stringify({ transcript: transcript, coachId: COACH_ID }),
        signal: controller.signal,
      }).then((res) => res.json()).then((data) => {
        clearTimeout(timer);
        status.remove();
        var reply = data && data.reply;
        this._appendMessage('assistant', reply || "Vision didn't respond — try again");
        if (reply && source === 'voice' && window.RowVoice) window.RowVoice.speak(reply);
        if (reply && window.__gym && window.__gym.pcPullRemote) window.__gym.pcPullRemote();
      }).catch(() => {
        clearTimeout(timer);
        status.remove();
        this._appendMessage('assistant', "Vision didn't respond — try again");
      }).finally(() => {
        this._pending = false;
        this._setBusy(false);
      });
    }

    _toggleMic() {
      if (this._voiceController) { this._stopVoice(); return; }
      this._micBtn.classList.add('listening');
      this._voiceController = window.RowVoice.startCapture((transcript) => {
        this._voiceController = null;
        this._micBtn.classList.remove('listening');
        this._send(transcript, 'voice');
      }, (msg) => {
        this._voiceController = null;
        this._micBtn.classList.remove('listening');
        this._appendMessage('status', msg);
      });
    }

    _stopVoice() {
      if (this._voiceController) { this._voiceController.stop(); this._voiceController = null; }
      if (this._micBtn) this._micBtn.classList.remove('listening');
    }
  }

  window.customElements.define('mini-vision-chat', MiniVisionChat);
})();
```

- [ ] **Step 2: Commit**

```bash
git add mini-vision-chat.js
git commit -m "feat: add mini-vision-chat custom element"
```

(No automated test for this file — it's DOM/fetch wiring, not pure logic. Matches this repo's existing convention: files like `gym.html`'s old `initVoiceLog` were never unit tested, only the pure logic they called was. Manual verification happens in Task 6.)

---

### Task 4: Wire the component into the 5 target pages

**Files:**
- Modify: `main.html`, `gym.html`, `health.html`, `macros.html`, `coaching.html`

- [ ] **Step 1: `main.html`** — already loads `voice-helpers.js` (line 908). Add, immediately before `</body>` (line 2397):

```html
<script src="mini-vision-chat.js"></script>
<mini-vision-chat></mini-vision-chat>
```

- [ ] **Step 2: `gym.html`** — already loads `voice-helpers.js` (line 3184). Add, immediately before `</body>` (line 7256, before Task 5 removes the old mic markup further up the file):

```html
<script src="mini-vision-chat.js"></script>
<mini-vision-chat></mini-vision-chat>
```

- [ ] **Step 3: `health.html`** — does not yet load `voice-helpers.js`. Add, immediately before `</body>` (line 1761):

```html
<script src="voice-helpers.js"></script>
<script src="mini-vision-chat.js"></script>
<mini-vision-chat></mini-vision-chat>
```

- [ ] **Step 4: `macros.html`** — does not yet load `voice-helpers.js`. Add, immediately before `</body>` (line 841):

```html
<script src="voice-helpers.js"></script>
<script src="mini-vision-chat.js"></script>
<mini-vision-chat></mini-vision-chat>
```

- [ ] **Step 5: `coaching.html`** — does not yet load `voice-helpers.js`. Add, immediately before `</body>` (line 398):

```html
<script src="voice-helpers.js"></script>
<script src="mini-vision-chat.js"></script>
<mini-vision-chat></mini-vision-chat>
```

- [ ] **Step 6: Commit**

```bash
git add main.html gym.html health.html macros.html coaching.html
git commit -m "feat: embed mini-vision-chat bubble on the 5 pages Carl uses"
```

---

### Task 5: Remove the old `gym.html` mic (HTML, CSS, JS)

**Files:**
- Modify: `gym.html`

- [ ] **Step 1: Delete the old mic markup**

Delete lines 2503-2512 (the comment, `#voiceMicBtn` button, and `#voiceToast` div):

```html
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

- [ ] **Step 2: Delete the old mic/toast CSS**

Delete lines 2198-2209 and 2217-2236 (the `.po-voice-mic`, `.po-voice-toast`, `.po-voice-toast-undo` rules and the `po-voice-pulse` keyframes). **Do not delete lines 2210-2216** (`.ml-voice-mic-btn` and its `.is-listening` rule) — that class is `voice-helpers.js`'s generic `attachMic()` button, used elsewhere in this file, unrelated to the mic being removed. After this step, the block should read:

```css
/* ----- Voice log mic + toast ----- */
.ml-voice-mic-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; margin-left: 6px; border-radius: 50%;
  border: 1px solid var(--border, rgba(255,255,255,0.15)); background: transparent;
  color: inherit; font-size: 14px; cursor: pointer; vertical-align: middle;
}
.ml-voice-mic-btn.is-listening { background: #ff4444; border-color: #ff4444; }
```

- [ ] **Step 3: Delete the old mic JS**

Delete the entire `initVoiceLog` IIFE, lines 5958-6049:

```js
  (function initVoiceLog() {
    var btn = $('voiceMicBtn');
    var toast = $('voiceToast');
    var toastMsg = $('voiceToastMsg');
    var toastUndo = $('voiceToastUndo');
    if (!btn) return;
    if (!window.RowVoice || !window.RowVoice.isSupported()) return; // button stays display:none

    btn.style.display = 'flex';
    var toastTimer = null;
    var talkPending = false;
    var voiceController = null;

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
      btn.classList.toggle('is-listening', on);
    }

    btn.addEventListener('click', function () {
      if (voiceController) { voiceController.stop(); voiceController = null; setListening(false); return; }
      setListening(true);
      voiceController = window.RowVoice.startCapture(function (transcript) {
        voiceController = null;
        setListening(false);
        sendToVision(transcript);
      }, function (msg) {
        voiceController = null;
        setListening(false);
        showToast(msg, null);
      });
    });

    // ponytail: routes through Vision's /talk (codex exec, ChatGPT-Plus-billed,
    // not metered API) instead of the local rigid regex parser -- see
    // docs/superpowers/specs/2026-08-10-voice-log-vision-talk-design.md.
    // Vision's log_workout action writes straight into the same po_coach_v1
    // cloud state gym.html reads, so a logged set shows up via the existing
    // initCloudSync pull, no local write here.
    function sendToVision(transcript) {
      if (talkPending) { showToast('Still working on the last one…', null); return; }
      talkPending = true;
      showToast('Thinking…', null);
      var controller = new AbortController();
      // Codex-review catch: this must stay >= Vision's own 60s codex-exec
      // timeout (vision/src/codex.ts EXEC_OPTIONS). A shorter client timeout
      // showed "didn't respond" while the action had actually already been
      // written server-side, making a retry likely to double-log.
      var timer = setTimeout(function () { controller.abort(); }, 65000);
      fetch('/api/vision-talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ROW_APP_SECRET },
        body: JSON.stringify({ transcript: transcript, coachId: 'gym' }),
        signal: controller.signal,
      }).then(function (res) { return res.json(); }).then(function (data) {
        clearTimeout(timer);
        talkPending = false;
        showToast(data && data.reply ? data.reply : "Vision didn't respond — try again", null);
        if (data && data.reply) window.RowVoice.speak(data.reply);
        // fix (2026-08-12): force an immediate re-sync instead of waiting on
        // whatever the normal pull cadence/realtime channel happens to
        // catch up with -- a real test showed a ~3 minute gap before a
        // voice-logged set appeared in the UI.
        if (data && data.reply && window.__gym && window.__gym.pcPullRemote) {
          if (window.__gym.pcDebug) window.__gym.pcDebug('voice-log-reply-received', { t: Date.now() });
          window.__gym.pcPullRemote();
        }
      }).catch(function () {
        clearTimeout(timer);
        talkPending = false;
        showToast("Vision didn't respond — try again", null);
      });
    }
  })();
```

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "refactor: remove old gym.html push-to-talk mic, replaced by mini-vision-chat"
```

---

### Task 6: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Local static check.** Open each of `main.html`, `gym.html`, `health.html`, `macros.html`, `coaching.html` in a browser (deployed Vercel preview, since `/api/*` routes need Vercel's serverless runtime). Confirm the 💬 bubble renders bottom-right and no console errors on load.

- [ ] **Step 2: History load.** Click the bubble on `gym.html` (a coach with real prior turns). Confirm it shows "Loading…" briefly, then real past turns in order, oldest first.

- [ ] **Step 3: Text send.** Type a message, hit Enter. Confirm: input disables while pending, a "Thinking…" status appears and is replaced by the real reply, no TTS audio plays (text-initiated).

- [ ] **Step 4: Voice send.** Tap the mic, speak, confirm transcript sends automatically and the reply is both shown and spoken aloud (`RowVoice.speak`).

- [ ] **Step 5: `gym.html` refresh hook.** On `gym.html`, voice-log a real set via the bubble and confirm it appears in the workout view without the old ~3-minute lag (i.e. `pcPullRemote()` fired).

- [ ] **Step 6: Page-nav cleanup.** Start a voice capture on one page, navigate away before it finishes. Confirm no lingering mic-active browser indicator afterward.

- [ ] **Step 7: `health.html`/`macros.html`/`coaching.html` voice parity.** Confirm the mic button now works there too (previously impossible — `RowVoice` wasn't loaded).

- [ ] **Step 8: Push.**

```bash
git push
```
