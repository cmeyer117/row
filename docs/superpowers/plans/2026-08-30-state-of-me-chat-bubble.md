# State of Me Chat Bubble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the already-built, already-reviewed `mini-vision-chat` widget to `state-of-me.html`, the same way it already works on `gym.html`/`health.html`/`macros.html`/`main.html`, so the one page that synthesizes Row's cross-domain data also has a way to ask about it.

**Architecture:** Pure page-wiring change — 4 script/tag lines added at the end of `state-of-me.html`, no changes to the widget itself or its backend proxy.

**Tech Stack:** Plain browser JS (no framework, no build step). No test framework for this file.

---

## Spec reference

`docs/superpowers/specs/2026-08-30-state-of-me-chat-bubble-design.md` (committed `row@834b372`). This plan implements it verbatim.

## File Structure

- Modify: `state-of-me.html` — the only file touched. `mini-vision-chat.js`, `mini-vision-chat-logic.js`, `voice-helpers.js`, and `api/vision-talk.js` are all pre-existing and unchanged; this page becomes their 5th consumer.

One task — the whole change is 4 lines in one file.

---

### Task 1: Add the chat bubble to `state-of-me.html`

**Files:**
- Modify: `state-of-me.html` (end of file, immediately before `</body>`)

- [ ] **Step 1: Add the four lines**

Find this exact existing code (the last lines of the file):

```html
  renderPhaseHeader();
  Promise.all([renderMacros(), renderFaithIron()]).then(function (results) {
    var html = renderSteps() + renderStackAdherence() + renderVolume() + renderWeight() + renderRecomp() + renderSleep() + results[0] + results[1];
    document.getElementById('somContent').innerHTML = html;
  });
})();
</script>
</body>
</html>
```

Replace with (only the 4 new lines inserted between `</script>` and `</body>` — nothing else changes):

```html
  renderPhaseHeader();
  Promise.all([renderMacros(), renderFaithIron()]).then(function (results) {
    var html = renderSteps() + renderStackAdherence() + renderVolume() + renderWeight() + renderRecomp() + renderSleep() + results[0] + results[1];
    document.getElementById('somContent').innerHTML = html;
  });
})();
</script>
<script src="voice-helpers.js"></script>
<script src="mini-vision-chat-logic.js"></script>
<script src="mini-vision-chat.js"></script>
<mini-vision-chat></mini-vision-chat>
</body>
</html>
```

This matches `main.html`'s exact working pattern: `voice-helpers.js` loads before `mini-vision-chat.js` (script tags execute in document order, and neither has `defer`, so this ordering guarantees `window.RowVoice` exists before the widget's mic code can reference it), then the logic file, then the component definition, then the custom element tag itself.

- [ ] **Step 2: Verify the file still parses**

Run:
```bash
node -e "new Function(require('fs').readFileSync('state-of-me.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s => s.replace(/<\/?script>/g, '')).join('\n'))"
```
Expected: no output, exit code 0. (This regex only matches bare `<script>...</script>` blocks with inline code — the new `<script src="...">` tags have no inline body between open/close, so they won't be captured or interfere with this check; only the page's existing inline `<script>...</script>` block is being syntax-checked, which this change doesn't touch other than what comes after it.)

- [ ] **Step 3: Commit**

```bash
cd /c/Users/gregm/row
git add state-of-me.html
git commit -m "feat: add the mini-vision-chat bubble to state-of-me.html"
```

- [ ] **Step 4: Live browser trace**

This feature has no meaningful way to verify without a live, authenticated Supabase session and a real Vision backend call — same disclosed gap as every other voice/live-backend feature this session. On a device with real Row credentials:

1. Open `state-of-me.html`. Confirm the chat bubble renders bottom-right, with no visible overlap with the bottom topbar (the widget's own CSS already offsets `bottom: calc(150px + safe-area-inset-bottom)` for this — confirm it actually holds on this page, since it's never been checked against `state-of-me.html`'s specific layout before).
2. Click the bubble — confirm it expands into the message panel.
3. Confirm history loads (if any prior gym-coach conversation exists) or the panel renders empty/ready-to-send gracefully if there's none yet — either is correct per the widget's existing design, not a new behavior.
4. Type and send a text message. Confirm a reply renders as a new message bubble.
5. If a microphone is available, confirm voice input works the same as it does on `gym.html`/`main.html` — this is the same real-device verification gap the original widget build already disclosed, not new risk introduced by this page.

If any of 1-4 fails, the most likely cause is a load-order or missing-dependency issue (e.g. `voice-helpers.js` not actually loading before `mini-vision-chat.js` runs) — re-check Step 1's exact line order before looking elsewhere, since the component itself is unchanged and already works correctly on 4 other pages.

---

## Completion

After Task 1: hand off to `superpowers:finishing-a-development-branch` — working directly on `main`, no branch to merge, so this mainly checks whether a pre-push code-review ask is warranted before pushing to `origin/main` (this project's own standing convention).
