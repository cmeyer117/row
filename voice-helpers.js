// Shared voice capture (MediaRecorder -> /api/vision-stt) + playback
// (/api/vision-talk?mode=tts -> Audio) primitive for gym.html and main.html.
// Replaces the old SpeechRecognition-based mic, which iOS WebKit silently
// disables in standalone/home-screen PWA mode (bug 185448) -- MediaRecorder
// + getUserMedia have no such restriction. Mirrors the pattern Vision's own
// useCodexVoice hook already uses successfully. See docs/superpowers/specs/
// 2026-08-11-spoken-morning-briefs-design.md.
window.RowVoice = (function () {
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
  var _currentUtterance = null; // keeps the in-flight SpeechSynthesisUtterance referenced -- see speak()
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
    // Fire-and-forget: starts the transformers.js/model download on first
    // tap so it's more likely warm by the time a capture actually finishes,
    // without blocking anything here. A rejection here is expected/silent
    // -- transcribeLocally() checks the same cached promise later and falls
    // back to OpenAI on failure.
    getAsrPipeline().catch(function () {});
  }

  // Pinned, not @latest -- the unpinned CDN URL resolved to a version that
  // threw "Can't create a session... Missing required scale" on this exact
  // model's quantized decoder weights (confirmed live, reproduced 3x across
  // different models/dtypes before finding this was a version-skew issue,
  // not a model problem). 3.0.0 confirmed working end-to-end, including a
  // real transcription call, not just pipeline creation.
  var TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0';
  var ASR_MODEL = 'Xenova/whisper-tiny.en';
  var _asrPipelinePromise = null;

  var ASR_TIMEOUT_MS = 15000; // local model load + inference budget before giving up and falling back

  // fix (2026-08-12): the CDN bundle is ESM-only (throws "Cannot use
  // 'import.meta' outside a module" if loaded as a classic <script src>,
  // confirmed live) -- dynamic import() works from any script context,
  // classic or module, with no HTML <script type=module> tag needed
  // anywhere.
  function getAsrPipeline() {
    if (_asrPipelinePromise) return _asrPipelinePromise;
    var p = import(TRANSFORMERS_CDN).then(function (mod) {
      return mod.pipeline('automatic-speech-recognition', ASR_MODEL);
    });
    // fix (2026-08-12, caught in Codex review): a rejected promise used to
    // stay cached for the rest of the page session, so one transient
    // CDN/network blip on the very first tap permanently reverted every
    // later tap to paid OpenAI -- the exact cost outcome this feature
    // exists to prevent. Clear the cache on rejection so the next tap gets
    // a genuinely fresh attempt instead of being stuck on the first
    // failure for the whole session.
    p.catch(function () { _asrPipelinePromise = null; });
    _asrPipelinePromise = p;
    return _asrPipelinePromise;
  }

  // Races a promise against ASR_TIMEOUT_MS -- without this, a stalled model
  // download or hung inference call never resolves OR rejects, so
  // transcribeLocally() never falls back and the caller's onTranscript/
  // onError never fires (caught in Codex review: a stuck mic with no
  // recovery path).
  function withAsrTimeout(promise) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('Local transcription timed out')); }, ASR_TIMEOUT_MS);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  // fix (2026-08-12, caught in Codex review + directly reproduced during
  // testing: transcribing 1s of raw silence returned {"text":" you"}):
  // local Whisper has no server-side no-speech/confidence filtering the
  // OpenAI path already has (jarvis/src/api/routes/stt.ts's isHallucination
  // check) -- a stray mic tap in a quiet gym could otherwise send a real
  // single-filler-word "transcript" straight to Vision as if Carl said it.
  // Same backstop word list as stt.ts's fallback filter (not the primary
  // no_speech_prob signal, which this pipeline's default output doesn't
  // expose) -- catches the exact reproduced case, not every possible one.
  function isLikelyHallucination(text) {
    var words = text.toLowerCase().replace(/[.!?,]/g, '').trim().split(/\s+/).filter(Boolean);
    return words.length === 1 && /^(bye|thanks?|ok|okay|um|uh|hi|hello|you|the|a)$/.test(words[0]);
  }

  // Transcribes locally, zero cost. Resolves to the transcript string, or
  // null on any failure (model load failed, inference threw, timed out,
  // empty/hallucinated result) -- callers fall back to
  // transcribeViaOpenAI() on null, never throw.
  function transcribeLocally(blob) {
    return withAsrTimeout(getAsrPipeline().then(function (transcriber) {
      var url = URL.createObjectURL(blob);
      // fix (2026-08-12, caught in Codex review): revoke was only reachable
      // on the success path -- a rejected transcriber() call (real
      // inference error, not just a bad result) leaked the blob URL for
      // the rest of the page's life. finally() runs on both paths.
      return transcriber(url).then(function (result) {
        var text = result && result.text ? result.text.trim() : '';
        if (!text || isLikelyHallucination(text)) return null;
        return text;
      }).finally(function () { URL.revokeObjectURL(url); });
    })).catch(function () { return null; });
  }

  // The exact OpenAI STT call that used to live inline in recorder.onstop,
  // extracted so it can serve as transcribeLocally()'s fallback. Resolves to
  // the transcript string, or null on any failure -- never throws, so the
  // caller's own onError message ("Didn't catch that...") is the single
  // source of truth for that message, not duplicated here.
  function transcribeViaOpenAI(blob, recordedMimeType, sttPrompt) {
    // 2026-08-12 audit fix: was a client-visible shared secret, now the
    // real owner session token -- see row-auth.js's getAccessToken().
    return Promise.all([blob.arrayBuffer(), window.RowAuth.getAccessToken()]).then(function (results) {
      var buf = results[0];
      var token = results[1];
      var headers = { 'Content-Type': recordedMimeType, 'Authorization': 'Bearer ' + token };
      if (sttPrompt) headers['X-STT-Prompt'] = sttPrompt;
      return fetch('/api/vision-talk?mode=stt', {
        method: 'POST',
        headers: headers,
        body: buf,
      });
    }).then(function (res) { return res.json(); }).then(function (data) {
      return (data && data.transcript && data.transcript.trim()) ? data.transcript.trim() : null;
    }).catch(function () { return null; });
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

    // Browser default audio processing is tuned for human-perceived call
    // clarity, not STT accuracy -- known to distort speech fighting
    // non-stationary noise (gym music, weight clangs, exactly this app's own
    // use case). Kept in sync with Vision's own useCodexVoice.ts fix,
    // 2026-08-29 (real mishears found live at the gym: "shoulder and arms"
    // -> "short-in-arms").
    //
    // With echo cancellation off, the mic can pick up this app's own TTS
    // playback (unlockAudio's own audio element, or morning-brief) if it's
    // still playing when recording starts. Stop it first. Found in Codex
    // review, 2026-08-29 (Vision/Jarvis equivalent).
    document.querySelectorAll('audio').forEach(function (a) { if (!a.paused) a.pause(); });
    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    }).then(function (s) {
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
        transcribeLocally(blob).then(function (localText) {
          if (localText) { onTranscript(localText); return; }
          return transcribeViaOpenAI(blob, recordedMimeType, opts.sttPrompt).then(function (fallbackText) {
            if (fallbackText) onTranscript(fallbackText);
            else onError("Didn't catch that — try again");
          });
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
      // Some browsers (documented Chrome bug, WebKit inconsistently too) can
      // garbage-collect an utterance mid-speech if nothing in JS holds a
      // strong reference to it -- speechSynthesis itself doesn't keep one.
      // Same reasoning as _unlockedAudio being module-scoped, not local.
      _currentUtterance = utterance;
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
