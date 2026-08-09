# Row Posing Coach → Vision Pose Critique Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Posing Coach's freeze-frame capture also gets an AI-written pose critique from Vision's already-shipped `POST /pose-critique`, rendered alongside the existing MediaPipe symmetry score, with the symmetry score staying visible and unaffected regardless of whether the AI call succeeds.

**Architecture:** New `row/api/vision-pose-critique.js` proxy mirrors `jarvis-chat.js` exactly (shared-secret gate, server-minted session cookie, forward to Vision, relay response). `form-coach.html`'s `captureFreeze()` calls it after the canvas capture, non-blockingly. `form-coach-logic.js`'s `buildHistoryRecord` gains an optional `poseCritique` field.

**Tech Stack:** Vanilla JS (`form-coach.html`/`form-coach-logic.js`), Vercel serverless function (`api/vision-pose-critique.js`), no test framework in `api/` (matches `jarvis-chat.js`'s own precedent) — `form-coach-logic.js`'s changes go through the existing `node form-coach-logic.selfcheck.cjs` assertion file.

**Full design:** `docs/superpowers/specs/2026-08-09-vision-pose-critique-wiring-design.md`

---

### Task 1: `buildHistoryRecord` gains `poseCritique`

**Files:**
- Modify: `row/form-coach-logic.js`
- Modify: `row/form-coach-logic.selfcheck.cjs`

- [ ] **Step 1: Add the assertion first**

In `form-coach-logic.selfcheck.cjs`, immediately after the existing `posingRecord` assertions (after the line asserting `posingRecord.timestamp`), add:

```javascript
// buildHistoryRecord — posing shape carries an optional poseCritique through when present.
var withCritique = FCL.buildHistoryRecord('posing', { pose: 'front-double-biceps', holdTimeMs: 1620, symmetry: symResult, poseCritique: { pose: 'Front Double Biceps', critique: 'Lock your lats down harder.' } }, '2026-08-07T00:00:00.000Z');
assertEqual(withCritique.poseCritique.critique, 'Lock your lats down harder.', 'buildHistoryRecord: posing record carries poseCritique through when provided');

// buildHistoryRecord — posing shape omits poseCritique (not a null placeholder) when absent, matching the existing fields' behavior.
assertEqual('poseCritique' in posingRecord, false, 'buildHistoryRecord: posing record has no poseCritique key when the caller did not provide one');
```

- [ ] **Step 2: Run the selfcheck to verify it fails**

Run: `node form-coach-logic.selfcheck.cjs` (from `row/`)
Expected: FAIL on the new `withCritique.poseCritique.critique` assertion (or a thrown error reading `.critique` off `undefined`) — `buildHistoryRecord` doesn't pass `poseCritique` through yet.

- [ ] **Step 3: Update `buildHistoryRecord`**

In `form-coach-logic.js`, change:

```javascript
    if (type === 'posing') {
      return { type: 'posing', timestamp: timestamp, pose: data.pose, holdTimeMs: data.holdTimeMs, symmetry: data.symmetry };
    }
```

to:

```javascript
    if (type === 'posing') {
      var record = { type: 'posing', timestamp: timestamp, pose: data.pose, holdTimeMs: data.holdTimeMs, symmetry: data.symmetry };
      if (data.poseCritique) record.poseCritique = data.poseCritique;
      return record;
    }
```

- [ ] **Step 4: Run the selfcheck to verify it passes**

Run: `node form-coach-logic.selfcheck.cjs` (from `row/`)
Expected: `form-coach-logic.selfcheck.cjs: all assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add form-coach-logic.js form-coach-logic.selfcheck.cjs
git commit -m "feat(form-coach): buildHistoryRecord carries an optional poseCritique field"
```

---

### Task 2: `vision-pose-critique.js` proxy

**Files:**
- Create: `row/api/vision-pose-critique.js`

- [ ] **Step 1: Write the proxy**

```javascript
// Vercel serverless proxy — forwards form-coach.html's Posing Coach AI
// critique calls to Vision's POST /pose-critique. Mirrors jarvis-chat.js
// exactly: shared-secret gate on the client-visible ROW_APP_SECRET, a
// server-minted session cookie so VISION_SESSION_SECRET never sits in
// static client HTML. See docs/superpowers/specs/
// 2026-08-09-vision-pose-critique-wiring-design.md.
import { createHmac } from 'node:crypto';
import { verifyAppSecret } from './_lib/verify-app-secret.js';

const VISION_URL = 'https://vision-backend-carlmeyer.up.railway.app';

function sessionCookie(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return 'vision_session=' + payload + '.' + sig;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!verifyAppSecret(req.headers['authorization'], process.env.ROW_APP_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64 || !mediaType) {
    res.status(400).json({ error: 'Missing imageBase64 or mediaType' });
    return;
  }
  try {
    const upstream = await fetch(VISION_URL + '/pose-critique', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie(process.env.VISION_SESSION_SECRET) },
      body: JSON.stringify({ imageBase64, mediaType }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Vision' });
  }
}
```

- [ ] **Step 2: Set the new Vercel env var**

Set `VISION_SESSION_SECRET` on Row's Vercel project — same value as Vision's Railway `VISION_SESSION_SECRET` env var (`railway variables --kv` in the Vision project to read it, `vercel env add VISION_SESSION_SECRET production` in Row to set it). This is an operator step, not automatable from here.

- [ ] **Step 3: Commit**

```bash
git add api/vision-pose-critique.js
git commit -m "feat(row): add Vision pose-critique proxy"
```

- [ ] **Step 4: Deploy and smoke-test the proxy directly**

After deploy, verify auth gating with a direct call (no camera needed for this check):

```bash
curl -i -X POST https://row.carlmeyer.io/api/vision-pose-critique -H "Content-Type: application/json" -d '{"imageBase64":"x","mediaType":"image/jpeg"}'
```

Expected: `401 {"error":"Unauthorized"}` (no `Authorization` header sent). Then repeat with `-H "Authorization: Bearer 007007"` — expected: a real response from Vision (likely `{"pose":null,"critique":"..."}` since `"x"` isn't real image data, not a 401/502). This confirms the secret gate and the Vision round-trip both work without needing the camera UI.

---

### Task 3: Client-side wiring in `form-coach.html`

**Files:**
- Modify: `row/form-coach.html`

- [ ] **Step 1: Add the `ROW_APP_SECRET` constant and the critique fetch helper**

In the posing-mode `<script>` block (the IIFE containing `captureFreeze`), add near the top of that IIFE, alongside the other local constants:

```javascript
  // Same trust tier as gym.html's own ROW_APP_SECRET -- ships in client JS,
  // just raises the bar on /api/vision-pose-critique from "any bot that
  // finds the URL burns Vision usage" to "requires reading page source".
  // Must match the ROW_APP_SECRET Vercel env var checked by
  // api/_lib/verify-app-secret.js.
  var ROW_APP_SECRET = '007007';

  async function fetchPoseCritique(imageBase64) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 25000);
    try {
      var res = await fetch('/api/vision-pose-critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ROW_APP_SECRET },
        body: JSON.stringify({ imageBase64: imageBase64, mediaType: 'image/jpeg' }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      var data = await res.json();
      return (data && typeof data.critique === 'string') ? data : null;
    } catch (err) {
      console.warn('[form-coach] pose critique fetch failed:', err && err.message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
```

- [ ] **Step 2: Wire it into `captureFreeze`**

Change:

```javascript
  function captureFreeze(holdMs) {
    frozen = true;
    var canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    var symmetry = window.FormCoachLogic.computeSymmetry(lastLandmarks, activeSlug);
    window.FormCoachHistory.logSession('posing', { pose: activeSlug, holdTimeMs: holdMs, symmetry: symmetry });
    document.getElementById('posingResult').innerHTML =
      '<div class="fc-compare">' +
        '<div><div class="fc-compare-label">You</div></div>' +
        '<div><div class="fc-compare-label">Reference</div><img src="assets/mobility/' + activeSlug + '.png" alt=""></div>' +
      '</div>' +
      '<div class="mob-card"><div class="mob-card-body"><strong>Held ' + (holdMs / 1000).toFixed(1) + 's</strong></div></div>' +
      '<div class="mob-card">' + renderSymmetry(symmetry) + '</div>' +
      '<button class="fc-btn fc-btn-secondary" id="tryAgainBtn" type="button">Try Again</button>';
    document.querySelector('.fc-compare > div:first-child').appendChild(canvas);
    document.getElementById('tryAgainBtn').addEventListener('click', function () {
      frozen = false;
      holdTracker = window.FormCoachLogic.createHoldTracker();
      document.getElementById('posingResult').innerHTML = '';
    });
  }
```

to:

```javascript
  function captureFreeze(holdMs) {
    frozen = true;
    var canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    var symmetry = window.FormCoachLogic.computeSymmetry(lastLandmarks, activeSlug);
    document.getElementById('posingResult').innerHTML =
      '<div class="fc-compare">' +
        '<div><div class="fc-compare-label">You</div></div>' +
        '<div><div class="fc-compare-label">Reference</div><img src="assets/mobility/' + activeSlug + '.png" alt=""></div>' +
      '</div>' +
      '<div class="mob-card"><div class="mob-card-body"><strong>Held ' + (holdMs / 1000).toFixed(1) + 's</strong></div></div>' +
      '<div class="mob-card">' + renderSymmetry(symmetry) + '</div>' +
      '<div class="mob-card" id="poseCritiqueCard"><div class="mob-card-body">Getting AI critique&hellip;</div></div>' +
      '<button class="fc-btn fc-btn-secondary" id="tryAgainBtn" type="button">Try Again</button>';
    document.querySelector('.fc-compare > div:first-child').appendChild(canvas);
    document.getElementById('tryAgainBtn').addEventListener('click', function () {
      frozen = false;
      holdTracker = window.FormCoachLogic.createHoldTracker();
      document.getElementById('posingResult').innerHTML = '';
    });

    var imageBase64 = canvas.toDataURL('image/jpeg', 0.85).replace(/^data:image\/jpeg;base64,/, '');
    fetchPoseCritique(imageBase64).then(function (result) {
      var card = document.getElementById('poseCritiqueCard');
      if (result) {
        if (card) card.querySelector('.mob-card-body').textContent = result.pose ? (result.pose + ': ' + result.critique) : result.critique;
        window.FormCoachHistory.logSession('posing', { pose: activeSlug, holdTimeMs: holdMs, symmetry: symmetry, poseCritique: result });
      } else {
        // Symmetry card above is unaffected -- this card just disappears
        // rather than showing an error on top of an already-successful capture.
        if (card) card.remove();
        window.FormCoachHistory.logSession('posing', { pose: activeSlug, holdTimeMs: holdMs, symmetry: symmetry });
      }
    });
  }
```

(Note: the history log moved from firing synchronously at the top of `captureFreeze` to firing once the AI critique settles — a several-second delay, acceptable since `FormCoachHistory` has no read path or UI depending on immediacy, per its own design.)

- [ ] **Step 3: Deploy**

Row has no build step for static HTML — a normal `git push` to the connected Vercel project deploys it. No local test command applies here (this is browser-only behavior); proceed to Task 4 for the parts of verification that don't need a real camera.

- [ ] **Step 4: Commit**

```bash
git add form-coach.html
git commit -m "feat(form-coach): wire Posing Coach captures to Vision's pose-critique proxy"
```

---

### Task 4: Verification

- [ ] **Step 1: Code-level checks (verifiable without a camera)**

- `node form-coach-logic.selfcheck.cjs` passes (already confirmed in Task 1, re-run once more after all changes to be sure nothing regressed).
- The proxy curl checks from Task 2 Step 4 both pass (401 without the secret, a real Vision response with it).
- Read through the final `captureFreeze()` diff once more: confirm the symmetry card's HTML is built and inserted *before* `fetchPoseCritique` is ever called — the symmetry score's correctness and rendering timing must not depend on the AI call in any way.

- [ ] **Step 2: Real-device verification — needs Carl, cannot be done from here**

Same limitation as the original Posing/Lift-Form Coach build (`row/docs/superpowers/plans/2026-08-06-posing-lift-form-coach.md`'s own open item): camera-based UI on a real device isn't something this session can exercise. **Flag this as open, don't claim it as done:**

- Open `form-coach.html` on a real device, hold a pose, confirm the symmetry card renders immediately (as it already did before this change) and the AI critique card appears a few seconds later with real pose+critique text.
- Confirm a slow/failed Vision response doesn't block or corrupt the symmetry card — the loading card should just quietly disappear.
- Confirm `FormCoachHistory`'s Supabase write includes `poseCritique` when the AI call succeeded (spot-check via Supabase directly, matching how the original history-logging feature was verified per its own spec).

## Self-review notes

- **Spec coverage:** `buildHistoryRecord` optional field (§1 client-side, history-logging note) → Task 1. Proxy (§2) → Task 2. Client wiring, loading/success/failure states, timeout (§1 client-side) → Task 3. Testing plan (§ of design) → Task 4.
- **Placeholder scan:** none — every step has real, complete code.
- **Type/shape consistency:** the proxy's `{imageBase64, mediaType}` request body and `{pose, critique}` response shape match Vision's actual `POST /pose-critique` contract (`vision/src/app.ts`'s route handler and `CritiquePoseOutput` type) exactly, not guessed.
