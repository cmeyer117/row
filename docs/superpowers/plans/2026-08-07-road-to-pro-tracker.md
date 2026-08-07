# Road to Pro Public Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone, gate-free public page (`road-to-pro.html`) that renders a hand-curated timeline from `road-to-pro-data.js` — the first page in Row that intentionally skips the passphrase gate.

**Architecture:** One plain data file (`road-to-pro-data.js`, a JS array — no logic, no computation, nothing to unit test) and one standalone HTML page that reads it and renders a reverse-chronological list via `textContent`. No `topbar.js`, no localStorage, no Supabase, no network calls beyond the shared Google Fonts `<link>` every Row page already uses.

**Tech Stack:** Vanilla JS, no build step, no dependencies.

---

### Task 1: The data file

**Files:**
- Create: `C:\Users\gregm\row\road-to-pro-data.js`

- [ ] **Step 1: Write the file with 2 seed entries** (real placeholder content Carl can edit later — not fabricated claims, just a clearly-a-starting-point structure)

```javascript
// road-to-pro-data.js — hand-curated Road to Pro timeline. Edited by
// Carl (or Claude on his instruction) and committed like any other
// content change. Never reads from po_coach_v1/live Supabase -- nothing
// in this file can leak private training data, by construction.
(function () {
  'use strict';
  var ENTRIES = [
    {
      date: '2026-08-07',
      title: 'The tracker goes live',
      body: 'Starting the public record of the road to a Pro card. Updates land here as they happen.',
      metric: null
    }
  ];
  var api = { ENTRIES: ENTRIES };
  if (typeof window !== 'undefined') window.RoadToProData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/gregm/row && git add road-to-pro-data.js && git commit -m "feat(road-to-pro): add the curated timeline data file"
```

### Task 2: The page

**Files:**
- Create: `C:\Users\gregm\row\road-to-pro.html`

- [ ] **Step 1: Write the full page.** No `<script src="topbar.js">` anywhere in this file — that's the entire mechanism by which this page stays gate-free; every other page's gate comes purely from including that one script tag.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0a0b">
<title>Road to Pro — Carl Meyer</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="road-to-pro-data.js"></script>
<style>
:root {
  --bg: #000000;
  --text-1: #F4F1EA;
  --text-2: rgba(244,241,234,0.6);
  --text-3: rgba(244,241,234,0.4);
  --border: rgba(255,255,255,0.08);
  --accent: #6ee7b7;
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SF Mono, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: var(--bg);
  color: var(--text-1);
  font-family: var(--font);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
body { max-width: 640px; margin: 0 auto; padding: max(40px, env(safe-area-inset-top)) 20px 80px; }
h1 { font-family: 'Instrument Serif', Georgia, serif; font-size: 40px; margin: 0 0 4px; }
.tagline { color: var(--text-2); font-size: 15px; margin: 0 0 40px; }
.entry { border-left: 2px solid var(--border); padding: 0 0 32px 20px; position: relative; }
.entry::before {
  content: ''; position: absolute; left: -6px; top: 4px;
  width: 10px; height: 10px; border-radius: 50%; background: var(--accent);
}
.entry-date { font-family: var(--font-mono); font-size: 12px; color: var(--accent); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
.entry-title { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
.entry-body { color: var(--text-2); font-size: 15px; line-height: 1.5; margin: 0; }
.entry-metric { display: inline-block; margin-top: 10px; font-family: var(--font-mono); font-size: 13px; color: var(--text-1); background: rgba(110,231,183,0.1); border: 1px solid rgba(110,231,183,0.3); border-radius: 999px; padding: 4px 12px; }
.empty-state { color: var(--text-3); font-size: 14px; padding: 40px 0; text-align: center; }
</style>
</head>
<body>
<h1>Road to Pro</h1>
<p class="tagline">The public record — Carl Meyer's journey to a Pro card.</p>
<div id="timeline"></div>

<script>
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function render() {
    var timeline = document.getElementById('timeline');
    var entries = (window.RoadToProData && Array.isArray(window.RoadToProData.ENTRIES))
      ? window.RoadToProData.ENTRIES
      : [];

    if (!entries.length) {
      timeline.appendChild(el('div', 'empty-state', 'More to come.'));
      return;
    }

    var sorted = entries.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    sorted.forEach(function (entry) {
      var card = el('div', 'entry');
      card.appendChild(el('div', 'entry-date', entry.date));
      card.appendChild(el('div', 'entry-title', entry.title));
      card.appendChild(el('p', 'entry-body', entry.body));
      if (entry.metric) card.appendChild(el('span', 'entry-metric', entry.metric));
      timeline.appendChild(card);
    });
  }

  render();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/gregm/row && git add road-to-pro.html && git commit -m "feat(road-to-pro): add the standalone public tracker page"
```

### Task 3: Browser verification

- [ ] **Step 1: Start a local static server** for `C:\Users\gregm\row` and open `road-to-pro.html` in the Browser pane.

- [ ] **Step 2: Confirm no auth gate fires.** Check `document.getElementById('auth-overlay')` is `null` and `document.documentElement.style.visibility` is not `'hidden'` — this proves the page truly never loaded `topbar.js`'s gate, not just that the passphrase happened to already be cached in `sessionStorage`.

- [ ] **Step 3: Confirm the seed entry renders.** `document.querySelectorAll('.entry').length` should be `1`, with the correct date/title/body text content.

- [ ] **Step 4: Test the empty state.** Temporarily override `window.RoadToProData = { ENTRIES: [] }` via the console and re-run the page's render logic (reload after `localStorage`... note: this page uses no `localStorage`, so just edit `road-to-pro-data.js`'s `ENTRIES` to `[]` on disk temporarily, reload, confirm `.empty-state` renders with "More to come.", then revert the file to the real seed entry before moving on).

- [ ] **Step 5: Test 2+ entries sort correctly.** Add a second seeded entry with an earlier date via the console (`window.RoadToProData.ENTRIES.push(...)` then manually re-invoke rendering, or simpler: edit the file on disk with 2 entries, reload) — confirm the newer date renders first.

- [ ] **Step 6: Confirm zero network requests beyond the Google Fonts link.** Use `read_network_requests` — the only external request should be to `fonts.googleapis.com`/`fonts.gstatic.com`. No Supabase, no other calls.

- [ ] **Step 7: Confirm no horizontal overflow at 375px** via `resize_window`.

- [ ] **Step 8: Restore `road-to-pro-data.js` to its committed single-seed-entry state** if Step 4/5 left it edited, and confirm `git status` shows it clean before moving on.

### Task 4: Finish

- [ ] **Step 1: Confirm working tree is clean**

```bash
cd /c/Users/gregm/row && git status -s
```

Expected: no output (nothing to commit).

- [ ] **Step 2: Push**

```bash
cd /c/Users/gregm/row && git push
```
