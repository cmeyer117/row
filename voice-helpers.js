// Shared voice capture (MediaRecorder -> /api/vision-stt) + playback
// (/api/vision-talk?mode=tts -> Audio) primitive for gym.html and main.html.
// Replaces the old SpeechRecognition-based mic, which iOS WebKit silently
// disables in standalone/home-screen PWA mode (bug 185448) -- MediaRecorder
// + getUserMedia have no such restriction. Mirrors the pattern Vision's own
// useCodexVoice hook already uses successfully. See docs/superpowers/specs/
// 2026-08-11-spoken-morning-briefs-design.md.
window.RowVoice = (function () {
  // Same trust tier as topbar.js's AUTH_PASS -- see api/_lib/verify-app-secret.js.
  var ROW_APP_SECRET = '007007';
  var MAX_RECORD_MS = 30000; // safety net only -- normal use is manual tap-to-stop

  // fix (2026-08-12): TTS playback never actually played -- speak() called
  // audio.play() with a bare .catch(() => {}), so Safari's autoplay policy
  // silently blocked it and nothing surfaced. Root cause: by the time the
  // reply comes back (STT round trip -> Vision round trip -> TTS round
  // trip, several real seconds), Safari no longer considers play() tied to
  // the original tap gesture and refuses it. Standard fix: create+play a
  // silent element SYNCHRONOUSLY inside the tap handler (still counts as
  // the gesture) to unlock this ONE element, then reuse that same element
  // (not a fresh `new Audio()`) for every later async playback -- Safari's
  // "unlocked" state is per-element, not per-page.
  var _unlockedAudio = null;
  // 1-sample silent WAV, valid enough to satisfy play()/pause() without any
  // audible click.
  var SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  function unlockAudio() {
    if (_unlockedAudio) return;
    try {
      _unlockedAudio = new Audio(SILENT_WAV);
      _unlockedAudio.play().catch(function () {}); // best-effort; if this fails, speak() will too, same as before
    } catch (e) { _unlockedAudio = null; }
    // fix (2026-08-12): speechSynthesis has the same Safari gesture-timing
    // quirk as <audio>.play() did -- priming it with a silent utterance here,
    // synchronously inside the tap handler, before the real reply comes back
    // several seconds later through STT->Vision, same reasoning as the Audio
    // unlock above.
    try {
      if (window.speechSynthesis) {
        var primer = new SpeechSynthesisUtterance('');
        primer.volume = 0;
        window.speechSynthesis.speak(primer);
      }
    } catch (e) {}
  }

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  // Records until the caller calls stop() (or MAX_RECORD_MS elapses), then
  // POSTs to /api/vision-stt. Calls onTranscript(text) on success,
  // onError(msg) on failure. Returns a controller with stop().
  function startCapture(onTranscript, onError, opts) {
    opts = opts || {};
    unlockAudio(); // synchronous, still inside the caller's click handler
    var chunks = [];
    // fix (2026-08-11): `active` used to be a single flag serving two
    // conflicting purposes -- "cancelled before getUserMedia resolved" AND
    // "should onstop process the result." stop() set it false BEFORE calling
    // recorder.stop(), so by the time onstop's own `if (!active) return`
    // check ran, it always saw false and silently discarded every manual
    // stop -- confirmed live: tap to stop produced zero toast, zero error,
    // total silence. `cancelled` now means only the first case; a normal
    // stop no longer touches it, so onstop always processes real results.
    var cancelled = false;
    var recorder = null;
    var stream = null;
    var maxTimer = null;

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      if (cancelled) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      // fix (2026-08-11): letting MediaRecorder pick its own default codec
      // (no mimeType passed) is a known-unreliable path on iOS Safari --
      // real recordings still came back as zero bytes even after removing
      // the concurrent-AudioContext theory. Explicitly requesting a codec
      // Safari actually supports is the standard, well-documented fix.
      var PREFERRED_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
      var chosenType = PREFERRED_TYPES.find(function (t) {
        return window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t);
      });
      recorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);
      // iOS Safari has no WebM encoder -- MediaRecorder silently falls back
      // to audio/mp4 there. Read the real chosen type instead of assuming
      // webm, or the server mislabels the bytes and Whisper fails to decode
      // them (every recording came back as "Didn't catch that" on iOS).
      var recordedMimeType = recorder.mimeType || 'audio/webm';
      recorder.ondataavailable = function (e) { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = function () {
        clearTimeout(maxTimer);
        stream.getTracks().forEach(function (t) { t.stop(); });
        if (!chunks.length) { onError('No audio captured'); return; }
        var blob = new Blob(chunks, { type: recordedMimeType });
        blob.arrayBuffer().then(function (buf) {
          var headers = { 'Content-Type': recordedMimeType, 'Authorization': 'Bearer ' + ROW_APP_SECRET };
          if (opts.sttPrompt) headers['X-STT-Prompt'] = opts.sttPrompt;
          return fetch('/api/vision-talk?mode=stt', {
            method: 'POST',
            headers: headers,
            body: buf,
          });
        }).then(function (res) { return res.json(); }).then(function (data) {
          if (data && data.transcript && data.transcript.trim()) onTranscript(data.transcript.trim());
          else onError("Didn't catch that — try again");
        }).catch(function () { onError("Didn't catch that — try again"); });
      };
      // fix (2026-08-11): dropped the AudioContext-based silence-detection
      // auto-stop that used to run here. Concurrently attaching a
      // MediaStreamSource/analyser to the SAME stream an active
      // MediaRecorder is encoding is a known-flaky combination on iOS
      // Safari -- it was producing zero-byte recordings ("No audio
      // captured") despite real speech, confirmed via a from-scratch
      // server-side pipeline test that proved STT/Vision/TTS all work
      // correctly given real audio bytes, isolating the bug to capture.
      // Manual tap-to-stop already exists on every caller (gym.html's
      // toggle, attachMic's toggle below) -- this timeout is purely a
      // forgot-to-stop safety net, not the primary stop mechanism.
      recorder.start(1000); // timeslice: flush data progressively, not just at stop()
      maxTimer = setTimeout(function () {
        if (recorder.state === 'recording') recorder.stop();
      }, MAX_RECORD_MS);
    }).catch(function () {
      onError('Microphone unavailable — check browser permissions');
    });

    return {
      stop: function () {
        clearTimeout(maxTimer);
        if (recorder && recorder.state === 'recording') {
          recorder.stop(); // triggers onstop, which processes the real result
        } else if (!recorder) {
          // getUserMedia is still pending -- cancel so its .then() stops the
          // tracks instead of starting a recording nobody wants anymore.
          cancelled = true;
        }
      },
    };
  }

  // Speaks the given text via the browser's free built-in TTS (no OpenAI
  // call, no cost -- 2026-08-12, replaces the OpenAI-TTS fetch to stop
  // burning the shared OpenAI credit balance; see docs/superpowers/specs/
  // 2026-08-12-free-tts-speechsynthesis-design.md). Quality is a real,
  // accepted downgrade from the old "cedar" voice -- Carl's explicit call,
  // upgrade path (in-browser WASM Whisper for STT + a nicer TTS) is a
  // separate future pass, not this one. Returns the SpeechSynthesisUtterance
  // (or null if unsupported) so callers have a comparable return value to
  // the old Audio element, though nothing currently uses it.
  function speak(text, onDone) {
    if (!window.speechSynthesis || !text) { if (onDone) onDone(); return null; }
    try {
      window.speechSynthesis.cancel(); // don't queue behind the silent unlock primer or a prior reply
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = function () { if (onDone) onDone(); };
      utterance.onerror = utterance.onend;
      window.speechSynthesis.speak(utterance);
      return utterance;
    } catch (e) {
      if (onDone) onDone();
      return null;
    }
  }

  // Attaches a mic button after `input` (a <textarea> or <input type=text>).
  // On transcript, sets input.value and dispatches 'input' so existing
  // listeners (autosave, etc.) fire unchanged. Does not auto-submit.
  function attachMic(input, opts) {
    opts = opts || {};
    if (!isSupported()) return; // no mic button on unsupported browsers
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ml-voice-mic-btn';
    btn.setAttribute('aria-label', 'Fill by voice');
    btn.textContent = '🎤';
    var controller = null;
    btn.addEventListener('click', function () {
      if (controller) { controller.stop(); controller = null; btn.classList.remove('is-listening'); return; }
      btn.classList.add('is-listening');
      controller = startCapture(function (transcript) {
        controller = null;
        btn.classList.remove('is-listening');
        input.value = transcript;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, function (msg) {
        controller = null;
        btn.classList.remove('is-listening');
        if (opts.onError) opts.onError(msg);
      });
    });
    input.insertAdjacentElement('afterend', btn);
    return btn;
  }

  return { isSupported: isSupported, startCapture: startCapture, speak: speak, attachMic: attachMic };
})();
