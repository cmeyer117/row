# Promote State of Me to Persistent Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `state-of-me.html` — Row's genuine cross-domain synthesis view — reachable in one tap from every page, instead of only from a chip on the `index.html` hub.

**Architecture:** Two edits to `topbar.js`: one new anchor in the `topbarHtml` template string (reusing the existing `.topbar-review-btn`/`.topbar-review-icon` classes verbatim, so zero new CSS), and one new case in `currentPageKey()` so the page doesn't falsely highlight the Goals tab. No new files, no changes to `state-of-me.html`, no backend or data changes.

**Tech Stack:** Vanilla JS in a static, no-build-step multi-page app. No test harness exists for `topbar.js` (verified by reading Row's conventions, not assumed).

---

## File Structure

- **Modify `topbar.js`** only. Both changes belong here because this file is the single owner of Row's persistent chrome — nav markup and active-tab resolution already live together in it. Nothing else in the app needs to know about this change.

---

### Task 1: Add the State of Me topbar link

**Files:**
- Modify: `topbar.js:168-181` (the `topbarHtml` template string)

- [ ] **Step 1: Add the anchor**

In `topbar.js`, the `topbarHtml` template currently reads (lines 168-181):

```js
  const topbarHtml = `
<header class="topbar" id="topbar" role="navigation" aria-label="Quick actions">
  <a href="index.html" class="topbar-home-btn" aria-label="Dashboard hub">
    <span class="topbar-home-icon">⌂</span>
  </a>
  <span class="topbar-mission-clock" id="topbarMissionClock"></span>
  <button type="button" class="topbar-sync-btn" id="topbarSync" aria-label="Sync status">
    <span class="topbar-sync-dot" id="topbarSyncDot"></span>
    <div class="topbar-sync-popover" id="topbarSyncPopover"></div>
  </button>
  <a href="weekly-review.html" class="topbar-review-btn" id="topbarReview" aria-label="Weekly Review">
    <span class="topbar-review-icon">🗓️</span>
  </a>
</header>`;
```

Change it to (one new anchor, inserted after the weekly-review link, before the closing `</header>`):

```js
  const topbarHtml = `
<header class="topbar" id="topbar" role="navigation" aria-label="Quick actions">
  <a href="index.html" class="topbar-home-btn" aria-label="Dashboard hub">
    <span class="topbar-home-icon">⌂</span>
  </a>
  <span class="topbar-mission-clock" id="topbarMissionClock"></span>
  <button type="button" class="topbar-sync-btn" id="topbarSync" aria-label="Sync status">
    <span class="topbar-sync-dot" id="topbarSyncDot"></span>
    <div class="topbar-sync-popover" id="topbarSyncPopover"></div>
  </button>
  <a href="weekly-review.html" class="topbar-review-btn" id="topbarReview" aria-label="Weekly Review">
    <span class="topbar-review-icon">🗓️</span>
  </a>
  <a href="state-of-me.html" class="topbar-review-btn" id="topbarStateOfMe" aria-label="State of Me">
    <span class="topbar-review-icon">📈</span>
  </a>
</header>`;
```

Class reuse is deliberate, not laziness: `.topbar-review-btn` (defined `topbar.js:59-68`) is already generic secondary-action styling, and its `@media (max-width: 480px)` overrides at `topbar.js:136-137` apply automatically to any element carrying the class. A `state-of-me`-specific duplicate ruleset would produce identical appearance while doubling the maintenance surface. The 📈 icon matches the hub's existing ops chip for this same destination (`index.html:418`), keeping both entry points visually consistent.

- [ ] **Step 2: Syntax check**

Run (Bash, from `C:\Users\gregm\row`):

```bash
node -e "require('/c/Users/gregm/row/topbar.js'); console.log('parsed OK');" 2>&1 | tail -3
```

If that errors because the file expects a browser environment (it references `window`/`document` at load), fall back to a parse-only check, which is what actually matters here:

```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('topbar.js', 'utf8');
new Function(src);
console.log('parsed OK');
"
```

Expected: `parsed OK`. This catches an unbalanced backtick or brace in the template string — the realistic failure mode for this edit.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\gregm\row
git add topbar.js
git commit -m "feat: add State of Me to the persistent topbar"
```

---

### Task 2: Stop the false Goals-tab highlight

**Files:**
- Modify: `topbar.js:205-213` (`currentPageKey()`)

- [ ] **Step 1: Add the case**

In `topbar.js`, `currentPageKey()` currently reads (lines 205-213):

```js
  function currentPageKey() {
    const p = (window.location.pathname || '').toLowerCase();
    if (p.endsWith('health.html') || p.endsWith('/health')) return 'health';
    if (p.endsWith('gym.html') || p.endsWith('/gym') || p.endsWith('mobility.html') || p.endsWith('/mobility') ||
        p.endsWith('coach.html') || p.endsWith('/coach') || p.endsWith('form-coach.html') || p.endsWith('posing.html')) return 'fitness';
    if (p.endsWith('main.html') || p.endsWith('/main')) return 'main';
    if (p.endsWith('index.html') || p === '/' || p.endsWith('/row/')) return '';
    return 'main';
  }
```

Change it to (one new line, inserted before the final catch-all):

```js
  function currentPageKey() {
    const p = (window.location.pathname || '').toLowerCase();
    if (p.endsWith('health.html') || p.endsWith('/health')) return 'health';
    if (p.endsWith('gym.html') || p.endsWith('/gym') || p.endsWith('mobility.html') || p.endsWith('/mobility') ||
        p.endsWith('coach.html') || p.endsWith('/coach') || p.endsWith('form-coach.html') || p.endsWith('posing.html')) return 'fitness';
    if (p.endsWith('main.html') || p.endsWith('/main')) return 'main';
    if (p.endsWith('index.html') || p === '/' || p.endsWith('/row/')) return '';
    // Cross-domain read, not a domain -- no bottom tab should claim it. Without
    // this, the `return 'main'` catch-all below falsely highlights Goals.
    if (p.endsWith('state-of-me.html') || p.endsWith('/state-of-me')) return '';
    return 'main';
  }
```

The two-variant check (`.html` plus extensionless) matches the defensive style every other case in this function already uses.

- [ ] **Step 2: Manual trace of all four branches**

No test harness exists for this file, so this trace replaces an automated test — it is not optional. Walk each case:

1. **`/state-of-me.html`** — misses `health`, misses the `fitness` group, misses `main`, misses `index`, matches the new case → returns `''` → no bottom tab highlighted. **Correct — this is the fix.**
2. **`/gym.html`** — misses `health`, matches the `fitness` group on its first condition → returns `'fitness'`. **Unchanged** (the new case sits below it and is never reached).
3. **`/main.html`** — misses `health` and `fitness`, matches `main` → returns `'main'`. **Unchanged** (new case never reached).
4. **`/planner.html`** (an unrecognized page) — misses every case including the new one, falls through → returns `'main'`. **Unchanged from today's behavior.**

Ordering note worth confirming while editing: the new case is placed *after* the existing four and *before* `return 'main'`. Placing it earlier would still work (no path matches two cases), but keeping the catch-all last preserves the function's existing top-to-bottom specificity shape.

- [ ] **Step 3: Syntax check**

Re-run the same parse-only check from Task 1 Step 2. Expected: `parsed OK`.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gregm\row
git add topbar.js
git commit -m "fix: stop state-of-me falsely highlighting the Goals tab"
```

---

### Task 3: Verification, review, and push

**Files:** none (verification and process only)

- [ ] **Step 1: Read the full diff in one pass**

```bash
cd C:\Users\gregm\row
git diff e7e7ab3..HEAD -- topbar.js
```

Expected: roughly 6 added lines across two hunks (3 for the anchor, 3 for the case-plus-comment), zero deletions beyond what the edits replace. Confirm both hunks landed where intended — particularly that the new anchor is inside the `<header>` element and not after the closing tag, which a careless insert could produce and which the parse check would *not* catch (it's valid JS either way, just broken HTML).

- [ ] **Step 2: Browser verification**

This change is purely visual/navigational, so browser verification is the real test — the manual trace above only covers the tab-highlight half.

Open Row in the Browser pane (`preview_start` with the deployed URL, or a local static server if one is convenient) and confirm all three:

1. The 📈 button appears in the topbar on `gym.html`, `health.html`, and `main.html`, and clicking it navigates to `state-of-me.html`.
2. On `state-of-me.html`, **no** bottom tab shows as active.
3. At a ≤480px viewport (use `resize_window` with the `mobile` preset), the topbar with two secondary buttons does not overflow or crowd the mission clock. **This is the one real visual risk of the change** — a fixed-height bar gaining a second 44×42 button — and the specific reason this step isn't skippable.

**Known constraint, disclose rather than skip:** the deployed site (`row-sage.vercel.app`) is sign-in gated, and entering credentials is outside what Claude does. If that blocks live verification and no local server is available, say so plainly — "the button/nav behavior was not visually confirmed live because the deployed site requires sign-in" — as an unverified gap. Do **not** claim verification that didn't happen, and do not fabricate a workaround. The manual trace still stands on its own for the `currentPageKey()` half.

- [ ] **Step 3: Review-before-push checkpoint**

Per this project's convention, ask before pushing whether a luna Codex diff review is wanted. This is a ~6-line, single-file, no-dependency, no-cost change — the smallest of the session — so "push now" is a defensible default, but the ask is the convention and prior small changes tonight did surface real bugs under review. Do not assume the answer.

- [ ] **Step 4: Push**

```bash
cd C:\Users\gregm\row
git push origin main
```

Row's default branch is `main`, not `master`. Its Vercel deployment is git-integrated and auto-deploys on push — confirm the live site actually updated (e.g. `curl -s -o /dev/null -w "%{http_code}\n" https://row-sage.vercel.app/state-of-me.html`) rather than assuming a silent success.

---

## Plan self-review notes

- **Spec coverage:** the topbar anchor (Task 1) matches the spec's exact markup, class-reuse rationale, and icon choice. The `currentPageKey()` case (Task 2) matches the spec's exact code and placement. All four trace branches the spec lists appear explicitly in Task 2 Step 2. All three browser checks the spec requires appear in Task 3 Step 2, including the ≤480px crowding check the spec singles out as the real risk. The spec's sign-in-gated disclosure requirement is carried through verbatim rather than softened. Everything the spec marks out of scope (no new synthesis page, no push delivery, no changes to `state-of-me.html`, no promotion of `row-wrapped`/`road-to-pro`, keeping the existing hub chip) is absent from every task — no task touches any of it.
- **Placeholder scan:** none. Task 1 Step 2's syntax check offers a fallback command, but both variants are complete and runnable — that's a real environment branch (whether the file parses standalone under Node), not an unfinished instruction.
- **Type consistency:** `topbarStateOfMe` (the new element id), `state-of-me.html` (the href and the path matched in `currentPageKey`), and the reused class names `.topbar-review-btn`/`.topbar-review-icon` are identical everywhere they appear across both tasks and the diff-review step.
- **Deliberate omission worth naming:** no task adds CSS. That's the point of reusing the existing classes, and the plan says so explicitly at Task 1 Step 1 so a future reader doesn't mistake it for an oversight and "helpfully" add a redundant ruleset.
