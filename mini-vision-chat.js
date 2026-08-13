// <mini-vision-chat> -- persistent floating chat bubble into Vision's `gym`
// coach, replacing gym.html's old push-to-talk-only mic (deleted in the same
// rollout). Shadow DOM custom element so it drops into any page with two
// lines and never fights that page's own CSS -- no build step, no
// framework, matching Row's existing static-page architecture. See
// docs/superpowers/specs/2026-08-12-mini-vision-chat-bubble-design.md.
(function () {
  var ROW_APP_SECRET = '007007'; // same client-visible trust tier as voice-helpers.js/gym.html -- see api/_lib/verify-app-secret.js.
  var COACH_ID = 'gym';
  // Must stay >= Vision's own 60s codex-exec timeout (vision/src/codex.ts
  // EXEC_OPTIONS). A shorter client timeout can abort a call whose write
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
      // Codex-review catch (2026-08-12): a text send that completes while a
      // voice capture is still in flight set `_pending`, which made the
      // eventual transcript's own `_send()` call silently no-op -- the
      // captured speech vanished with no feedback. Disabling text input/send
      // for the duration of a capture (mic stays enabled so tap-to-stop still
      // works) makes the two paths mutually exclusive instead of racing.
      this._input.disabled = true;
      this._sendBtn.disabled = true;
      // Feeds gym.html's real exercise vocabulary into STT when available
      // (window.__gym.getSttPrompt, added by gym.html itself) -- undefined
      // on the other 4 pages, which have no such vocabulary to hint with.
      var sttPrompt = (window.__gym && window.__gym.getSttPrompt) ? window.__gym.getSttPrompt() : '';
      this._voiceController = window.RowVoice.startCapture((transcript) => {
        this._voiceController = null;
        this._micBtn.classList.remove('listening');
        this._send(transcript, 'voice');
      }, (msg) => {
        this._voiceController = null;
        this._micBtn.classList.remove('listening');
        this._input.disabled = false;
        this._sendBtn.disabled = false;
        this._appendMessage('status', msg);
      }, { sttPrompt: sttPrompt });
    }

    _stopVoice() {
      if (this._voiceController) { this._voiceController.stop(); this._voiceController = null; }
      if (this._micBtn) this._micBtn.classList.remove('listening');
    }
  }

  window.customElements.define('mini-vision-chat', MiniVisionChat);
})();
