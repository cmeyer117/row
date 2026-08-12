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
  var SILENCE_THRESHOLD = 0.01;
  var SILENCE_DELAY_MS = 1500;
  var MIN_RECORD_MS = 800;

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  // Records until sustained silence (or the caller can wire a manual
  // stop button), then POSTs to /api/vision-stt. Calls onTranscript(text)
  // on success, onError(msg) on failure. Returns a controller with stop().
  function startCapture(onTranscript, onError) {
    var chunks = [];
    var active = true;
    var recorder = null;
    var stream = null;

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      if (!active) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      recorder = new MediaRecorder(stream);
      // iOS Safari has no WebM encoder -- MediaRecorder silently falls back
      // to audio/mp4 there. Read the real chosen type instead of assuming
      // webm, or the server mislabels the bytes and Whisper fails to decode
      // them (every recording came back as "Didn't catch that" on iOS).
      var recordedMimeType = recorder.mimeType || 'audio/webm';
      recorder.ondataavailable = function (e) { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        if (!active) return;
        if (!chunks.length) { onError('No audio captured'); return; }
        var blob = new Blob(chunks, { type: recordedMimeType });
        blob.arrayBuffer().then(function (buf) {
          return fetch('/api/vision-talk?mode=stt', {
            method: 'POST',
            headers: { 'Content-Type': recordedMimeType, 'Authorization': 'Bearer ' + ROW_APP_SECRET },
            body: buf,
          });
        }).then(function (res) { return res.json(); }).then(function (data) {
          if (data && data.transcript && data.transcript.trim()) onTranscript(data.transcript.trim());
          else onError("Didn't catch that — try again");
        }).catch(function () { onError("Didn't catch that — try again"); });
      };
      recorder.start();

      // Silence-based auto-stop, same VAD approach as Vision's useCodexVoice.
      try {
        var ctx = new AudioContext();
        var analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        var data = new Uint8Array(analyser.frequencyBinCount);
        var start = Date.now();
        var silenceTimer = null;
        var interval = setInterval(function () {
          if (!active || recorder.state !== 'recording') { clearInterval(interval); return; }
          analyser.getByteTimeDomainData(data);
          var sum = 0;
          for (var i = 0; i < data.length; i++) { var x = (data[i] - 128) / 128; sum += x * x; }
          var rms = Math.sqrt(sum / data.length);
          var elapsed = Date.now() - start;
          if (rms < SILENCE_THRESHOLD && elapsed > MIN_RECORD_MS) {
            if (!silenceTimer) {
              silenceTimer = setTimeout(function () {
                if (recorder.state === 'recording') recorder.stop();
                clearInterval(interval);
                ctx.close().catch(function () {});
              }, SILENCE_DELAY_MS);
            }
          } else if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
          }
        }, 200);
      } catch (e) {
        // AudioContext unavailable -- caller's manual stop() is the only way
        // to submit; capture still works, just no auto-send on silence.
      }
    }).catch(function () {
      active = false;
      onError('Microphone unavailable — check browser permissions');
    });

    return {
      stop: function () {
        active = false;
        if (recorder && recorder.state === 'recording') recorder.stop();
      },
    };
  }

  // Fetches and plays TTS for the given text. Returns the Audio element (or
  // null if playback couldn't start) so callers can pause() it if needed.
  function speak(text, onDone) {
    return fetch('/api/vision-talk?mode=tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ROW_APP_SECRET },
      body: JSON.stringify({ text: text }),
    }).then(function (res) { return res.ok ? res.blob() : null; }).then(function (blob) {
      if (!blob) { if (onDone) onDone(); return null; }
      var url = URL.createObjectURL(blob);
      var audio = new Audio(url);
      audio.onended = function () { URL.revokeObjectURL(url); if (onDone) onDone(); };
      audio.onerror = audio.onended;
      audio.play().catch(function () {});
      return audio;
    }).catch(function () { if (onDone) onDone(); return null; });
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
