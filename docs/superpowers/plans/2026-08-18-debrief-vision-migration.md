# Post-Workout Debrief: Migrate off Jarvis to Vision — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point `gym.html`'s post-workout debrief at Vision instead of the now-dormant Jarvis backend, so it actually works again, and delete the now-dead Jarvis proxy.

**Architecture:** `gym.html`'s `askJarvis()` currently POSTs to `/api/jarvis-chat.js`, which forwards to Jarvis's Railway `/chat`. Retarget it to POST to `/api/vision-talk` (the same Vercel proxy `mini-vision-chat.js` already uses successfully, 26 verified real turns), matching that call's request shape (`{transcript, coachId:'gym'}`), response shape (`data.reply`), and timeout (65s, no retry). Delete `api/jarvis-chat.js` once nothing calls it.

**Tech Stack:** Vanilla JS (no build step), Vercel serverless functions, existing `RowAuth`/`verifyOwner` auth pattern.

---

### Task 1: Retarget `askJarvis()` to Vision, rename to `askVisionCoach()`

**Files:**
- Modify: `C:\Users\gregm\row\gym.html:5700-5733` (the `askJarvis` function)
- Modify: `C:\Users\gregm\row\gym.html:5892` (the one call site, inside `fireDebrief()`)

No new test file — this is a thin fetch/DOM wrapper with no branching logic of its own; matches the existing codebase convention where `mini-vision-chat.js`'s equivalent fetch layer is also untested (only pure logic files like `gym-debrief-logic.js` get unit tests). Verification is the real click-through in Task 3.

- [ ] **Step 1: Replace the function body**

Current code at `gym.html:5700-5733`:

```javascript
  async function askJarvis(message) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(function() { controller.abort(); }, 12000);
      try {
        // 2026-08-12 audit fix: was a client-visible shared secret, now the
        // real owner session token -- see row-auth.js's getAccessToken().
        const token = await window.RowAuth.getAccessToken();
        const res = await fetch('/api/jarvis-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        // fetch() doesn't throw on non-2xx — a 401/500/etc. still resolves
        // here with a parseable JSON body. Without this check, an auth or
        // server error silently looked identical to "Jarvis had nothing to
        // say" (both fell through to data.response/data.message being
        // undefined -> null -> "No response." in the UI), which is exactly
        // what happened during the 2026-07-24 passphrase-gating rollout.
        if (!res.ok) {
          const err = new Error((data && data.error) || ('HTTP ' + res.status));
          err.status = res.status;
          throw err;
        }
        return data.response || data.message || null;
      } catch (e) {
        clearTimeout(timer);
        if (attempt === 1) throw e;
      }
    }
  }
```

Replace with:

```javascript
  // 2026-08-18: migrated off Jarvis (dormant since 2026-08-15) to Vision's
  // /api/vision-talk -- the same proxy mini-vision-chat.js already uses
  // successfully. No retry (unlike the old Jarvis version): Vision's /talk
  // runs a codex-exec call up to ~60s, so a second attempt after a timeout
  // just doubles the worst case for no benefit -- mini-vision-chat.js
  // doesn't retry either.
  async function askVisionCoach(message) {
    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, 65000);
    try {
      // 2026-08-12 audit fix: was a client-visible shared secret, now the
      // real owner session token -- see row-auth.js's getAccessToken().
      const token = await window.RowAuth.getAccessToken();
      const res = await fetch('/api/vision-talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ transcript: message, coachId: 'gym' }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      // fetch() doesn't throw on non-2xx — a 401/500/etc. still resolves
      // here with a parseable JSON body. Without this check, an auth or
      // server error silently looked identical to "Vision had nothing to
      // say", which is exactly what happened with Jarvis during the
      // 2026-07-24 passphrase-gating rollout.
      if (!res.ok) {
        const err = new Error((data && data.error) || ('HTTP ' + res.status));
        err.status = res.status;
        throw err;
      }
      return data.reply || null;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }
```

- [ ] **Step 2: Update the call site**

At `gym.html:5892`, change:

```javascript
      body.textContent = (await askJarvis(message)) || 'No response.';
```

to:

```javascript
      body.textContent = (await askVisionCoach(message)) || 'No response.';
```

The surrounding `catch` block (401/status/generic error messages, `gym.html:5893-5899`) stays exactly as-is — Vision's proxy uses the same `verifyOwner` auth and error-shape convention as Jarvis's did, so the same branches apply.

- [ ] **Step 3: Grep to confirm no other references to the old name/endpoint remain**

Run:
```bash
cd /c/Users/gregm/row && grep -n "askJarvis\|api/jarvis-chat" gym.html
```
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/gregm/row && git add gym.html && git commit -m "fix(gym): post-workout debrief migrated off dormant Jarvis to Vision"
```

---

### Task 2: Delete the now-dead Jarvis proxy

**Files:**
- Delete: `C:\Users\gregm\row\api\jarvis-chat.js`

- [ ] **Step 1: Confirm nothing else references it**

Run:
```bash
cd /c/Users/gregm/row && grep -rln "jarvis-chat" . --include="*.js" --include="*.html" | grep -v node_modules
```
Expected: no matches (Task 1 already removed the only caller).

- [ ] **Step 2: Delete the file**

```bash
cd /c/Users/gregm/row && rm api/jarvis-chat.js
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/gregm/row && git add -A && git commit -m "chore: remove dead Jarvis debrief proxy, superseded by vision-talk"
```

---

### Task 3: Push and verify live on Carl's phone

**Files:** none — deploy + manual verification.

- [ ] **Step 1: Push to trigger Vercel deploy**

```bash
cd /c/Users/gregm/row && git push
```

- [ ] **Step 2: Confirm the deploy went out**

Check the new commit is live (Vercel auto-deploys `main` on push) before asking Carl to test — avoids sending him to test against stale code.

- [ ] **Step 3: Carl tests live on his phone**

On the actual gym-sage.vercel.app PWA (the one where Ask Coach/debrief was just failing): log a set, tap the debrief trigger, confirm it returns a real Vision response instead of the previous failure. This step needs Carl's own login — cannot be done from this session.

- [ ] **Step 4: If it still fails, debug live with the real error**

Don't guess — get the exact failure (network tab status code, or the on-screen error text from the existing 401/status/generic branches in `fireDebrief()`) and root-cause from that, same as the 2026-07-24 Jarvis passphrase incident this pattern is modeled on.
