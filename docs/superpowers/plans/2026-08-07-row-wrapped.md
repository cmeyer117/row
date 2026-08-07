# Row Wrapped Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `row-wrapped.html` page that computes 4 quarterly stats (PRs, volume, longest streak, bodyweight arc) from Row's existing localStorage data and renders them as a downloadable IG-Story-sized PNG recap card.

**Architecture:** One new pure-logic module (`row-wrapped-logic.js`, TDD'd via `.selfcheck.cjs`, matching the codebase's established dual-export module pattern) computes all 4 stats from `state.exercises`/`state.logs`/`po_coach_weights`. One new page (`row-wrapped.html`, following `form-coach.html`'s existing standalone-page conventions — `topbar.js` for nav/auth chrome, no manual back-link) builds an SVG card from those stats, rasterizes it via canvas (same `drawImage`/`toDataURL` pattern `gym-weight-photos.js` already uses), and offers a download link. One small addition to `index.html`'s `ops-strip` links to the new page.

**Tech Stack:** Vanilla JS, no build step, no new dependencies. SVG string → `Image` → `<canvas>` → PNG data URL, all native browser APIs already used elsewhere in this codebase.

---

### Task 1: Pure logic — quarter math, PRs, volume, streak, bodyweight series

**Files:**
- Create: `C:\Users\gregm\row\row-wrapped-logic.js`
- Create: `C:\Users\gregm\row\row-wrapped-logic.selfcheck.cjs`

- [ ] **Step 1: Write the selfcheck file with all assertions (they will fail — module doesn't exist yet)**

```javascript
// Run with: node row-wrapped-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'row-wrapped-logic.js'), 'utf8'), sandbox);
const L = sandbox.window.RowWrappedLogic;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}
function assertTrue(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); process.exit(1); }
}

// --- quarterBounds ---
let b = L.quarterBounds(new Date('2026-08-07T12:00:00Z'));
assertEqual(b.label, 'Q3 2026', 'August 7 falls in Q3 2026');
assertEqual(b.start.toISOString().slice(0, 10), '2026-07-01', 'Q3 starts July 1');
assertEqual(b.end.toISOString().slice(0, 10), '2026-08-07', 'Q3 "so far" ends at now, not Sep 30');

b = L.quarterBounds(new Date('2026-01-15T12:00:00Z'));
assertEqual(b.label, 'Q1 2026', 'January falls in Q1');
assertEqual(b.start.toISOString().slice(0, 10), '2026-01-01', 'Q1 starts January 1');

b = L.quarterBounds(new Date('2027-01-02T12:00:00Z'));
assertEqual(b.label, 'Q1 2027', 'a new year rolls the quarter label correctly (Dec->Jan edge)');
assertEqual(b.start.toISOString().slice(0, 10), '2027-01-01', 'Q1 2027 starts Jan 1 2027, not Dec 2026');

b = L.quarterBounds(new Date('2028-02-29T12:00:00Z'));
assertEqual(b.label, 'Q1 2028', 'leap-year Feb 29 falls in Q1 without crashing');

// --- quarterPRs ---
const exercises = [
  { id: 'ex1', name: 'Bench Press', bw: false },
  { id: 'ex2', name: 'Pull-ups', bw: true }
];
let logs = {
  ex1: [
    { date: '2026-05-01T12:00:00Z', weight: 185, reps: 5 },  // before window, e1RM ~215.8
    { date: '2026-07-10T12:00:00Z', weight: 195, reps: 5 }   // in window, e1RM ~227.5 -- beats prior, qualifies
  ],
  ex2: [
    { date: '2026-05-01T12:00:00Z', weight: 0, reps: 12 },   // before window, 12 reps
    { date: '2026-07-15T12:00:00Z', weight: 0, reps: 10 }    // in window, fewer reps -- does NOT qualify
  ]
};
let bounds = L.quarterBounds(new Date('2026-08-07T12:00:00Z'));
let prs = L.quarterPRs(exercises, logs, bounds);
assertEqual(prs.length, 1, 'exactly one exercise qualifies as a new PR this quarter');
assertEqual(prs[0].exerciseId, 'ex1', 'the qualifying PR is the bench press, not the pull-ups');
assertTrue(prs[0].e1rm > prs[0].priorBest, 'the qualifying PR e1RM genuinely exceeds the prior best');

logs = { ex1: [{ date: '2026-07-10T12:00:00Z', weight: 100, reps: 5 }] }; // no prior log at all
prs = L.quarterPRs([exercises[0]], logs, bounds);
assertEqual(prs.length, 1, 'a first-ever log in the window with no prior history counts as a PR');
assertEqual(prs[0].priorBest, 0, 'priorBest is 0 when there is no log before the window');

prs = L.quarterPRs([], {}, bounds);
assertEqual(prs, [], 'no exercises and no logs returns an empty array, not null or a crash');

// --- quarterVolume ---
logs = {
  ex1: [
    { date: '2026-05-01T12:00:00Z', weight: 100, reps: 10 }, // before window -- excluded
    { date: '2026-07-10T12:00:00Z', weight: 100, reps: 10 }, // in window: 1000
    { date: '2026-07-20T12:00:00Z', weight: 200, reps: 5 }   // in window: 1000
  ]
};
assertEqual(L.quarterVolume(logs, bounds), 2000, 'quarterVolume sums only in-window logs, excludes the pre-window one');
assertEqual(L.quarterVolume({}, bounds), 0, 'quarterVolume of no logs is a real 0, not an error');

// --- longestStreak ---
logs = {
  ex1: [
    { date: '2026-07-01T12:00:00Z', weight: 100, reps: 5 },
    { date: '2026-07-02T12:00:00Z', weight: 100, reps: 5 },
    { date: '2026-07-03T12:00:00Z', weight: 100, reps: 5 },
    { date: '2026-07-06T12:00:00Z', weight: 100, reps: 5 },
    { date: '2026-07-07T12:00:00Z', weight: 100, reps: 5 }
  ]
};
assertEqual(L.longestStreak(logs, bounds), 3, 'longest streak is 3 (Jul 1-3), not the later 2-day run (Jul 6-7)');

logs = { ex1: [{ date: '2026-07-01T12:00:00Z', weight: 100, reps: 5 }] };
assertEqual(L.longestStreak(logs, bounds), 1, 'a single training day is a streak of 1');

assertEqual(L.longestStreak({}, bounds), 0, 'zero training days in the window is a streak of 0, not 1');

// two different exercises logged on the same day count as ONE training day, not two
logs = {
  ex1: [{ date: '2026-07-01T12:00:00Z', weight: 100, reps: 5 }],
  ex2: [{ date: '2026-07-01T12:00:00Z', weight: 0, reps: 8 }],
};
assertEqual(L.longestStreak(logs, bounds), 1, 'two exercises logged the same day form one training day, not a streak of 2');

// a log exactly on bounds.end counts; a log the day after does not affect a "so far" window
logs = { ex1: [{ date: bounds.end.toISOString(), weight: 100, reps: 5 }] };
assertEqual(L.longestStreak(logs, bounds), 1, 'a log dated exactly on bounds.end is included in the window');

// --- quarterBodyweightSeries ---
const weights = [
  { dateKey: '2026-06-15', weight: 210 },  // before window
  { dateKey: '2026-07-05', weight: 205 },  // in window
  { dateKey: '2026-07-25', weight: 202 }   // in window
];
let series = L.quarterBodyweightSeries(weights, bounds);
assertEqual(series.length, 2, 'quarterBodyweightSeries excludes the pre-window weigh-in');
assertEqual(series[0].dateKey, '2026-07-05', 'series is sorted ascending by date');

assertEqual(L.quarterBodyweightSeries([], bounds), [], 'no weigh-ins returns an empty array');

console.log('row-wrapped-logic.selfcheck.cjs: all assertions passed');
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:\Users\gregm\row && node row-wrapped-logic.selfcheck.cjs`
Expected: `Error: ENOENT` (the module file doesn't exist yet)

- [ ] **Step 3: Implement `row-wrapped-logic.js`**

```javascript
// row-wrapped-logic.js — pure functions for the Row Wrapped quarterly
// recap card: calendar-quarter math, new-PR detection, total volume,
// longest training-day streak, and a bodyweight-in-window slice. No DOM,
// no Supabase, no canvas/SVG -- see row-wrapped.html for the render side.
// Dual export like gym-volume-logic.js.
(function () {
  'use strict';

  // "So far" -- end is `now` itself, never the calendar quarter's actual
  // last day, so a card generated mid-quarter reflects real partial data
  // rather than implying data that doesn't exist yet.
  function quarterBounds(now) {
    now = now || new Date();
    var year = now.getUTCFullYear();
    var q = Math.floor(now.getUTCMonth() / 3); // 0-3
    var startMonth = q * 3;
    var start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0));
    return { start: start, end: now, label: 'Q' + (q + 1) + ' ' + year };
  }

  function inWindow(dateStr, bounds) {
    var d = new Date(dateStr);
    return d >= bounds.start && d <= bounds.end;
  }

  function estimate1RM(w, r) {
    if (r < 2) return w;
    return w * (1 + r / 30);
  }

  // exercises: [{id, name, bw}]. logs: {[exerciseId]: [{date, weight, reps}]}.
  // A PR is any exercise whose best in-window value beats every log dated
  // strictly before bounds.start. bw exercises compare by reps; others by
  // estimate1RM. priorBest is 0 when there is no log before the window
  // (a first-ever log in the window is honestly a new PR against nothing).
  function quarterPRs(exercises, logs, bounds) {
    var out = [];
    (exercises || []).forEach(function (ex) {
      var exLogs = (logs && logs[ex.id]) || [];
      var before = exLogs.filter(function (l) { return new Date(l.date) < bounds.start; });
      var inWin = exLogs.filter(function (l) { return inWindow(l.date, bounds); });
      if (!inWin.length) return;

      var valueOf = ex.bw
        ? function (l) { return l.reps; }
        : function (l) { return estimate1RM(l.weight, l.reps); };

      var priorBest = before.length ? Math.max.apply(null, before.map(valueOf)) : 0;
      var windowBest = Math.max.apply(null, inWin.map(valueOf));

      if (windowBest > priorBest) {
        out.push({ exerciseId: ex.id, name: ex.name, e1rm: windowBest, priorBest: priorBest });
      }
    });
    return out;
  }

  // logs: same shape as quarterPRs. Sums weight*reps for every log (any
  // exercise) dated inside the window. 0 is a real, valid answer.
  function quarterVolume(logs, bounds) {
    var total = 0;
    Object.keys(logs || {}).forEach(function (exId) {
      (logs[exId] || []).forEach(function (l) {
        if (inWindow(l.date, bounds)) total += (l.weight || 0) * (l.reps || 0);
      });
    });
    return total;
  }

  // Longest run of consecutive calendar days with at least one logged set
  // (any exercise). Two exercises logged the same day count as one
  // training day, not two. 0 for a window with zero training days.
  function longestStreak(logs, bounds) {
    var dayKeys = {};
    Object.keys(logs || {}).forEach(function (exId) {
      (logs[exId] || []).forEach(function (l) {
        if (inWindow(l.date, bounds)) dayKeys[l.date.slice(0, 10)] = true;
      });
    });
    var days = Object.keys(dayKeys).sort();
    if (!days.length) return 0;

    var longest = 1, current = 1;
    for (var i = 1; i < days.length; i++) {
      var prev = new Date(days[i - 1] + 'T00:00:00Z');
      var cur = new Date(days[i] + 'T00:00:00Z');
      var diffDays = Math.round((cur - prev) / 86400000);
      if (diffDays === 1) { current += 1; } else { current = 1; }
      if (current > longest) longest = current;
    }
    return longest;
  }

  // weights: [{dateKey, weight}]. Returns the in-window slice, sorted
  // ascending by dateKey. Empty array when nothing falls inside.
  function quarterBodyweightSeries(weights, bounds) {
    return (weights || [])
      .filter(function (w) { return inWindow(w.dateKey + 'T00:00:00Z', bounds); })
      .slice()
      .sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
  }

  var api = {
    quarterBounds: quarterBounds,
    quarterPRs: quarterPRs,
    quarterVolume: quarterVolume,
    longestStreak: longestStreak,
    quarterBodyweightSeries: quarterBodyweightSeries
  };
  if (typeof window !== 'undefined') window.RowWrappedLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd C:\Users\gregm\row && node row-wrapped-logic.selfcheck.cjs`
Expected: `row-wrapped-logic.selfcheck.cjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
cd /c/Users/gregm/row && git add row-wrapped-logic.js row-wrapped-logic.selfcheck.cjs && git commit -m "feat(row-wrapped): add quarter math, PR/volume/streak/bodyweight pure logic"
```

### Task 2: The page — SVG card build + canvas rasterize + download

**Files:**
- Create: `C:\Users\gregm\row\row-wrapped.html`

- [ ] **Step 1: Write the full page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0a0b">
<link rel="manifest" href="/manifest.json" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Row" />
<title>Wrapped — Row</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="row-wrapped-logic.js"></script>
<script src="topbar.js" defer></script>
<style>
:root {
  --bg: #000000;
  --text-1: #F4F1EA;
  --text-2: rgba(244,241,234,0.6);
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
body { padding: max(24px, env(safe-area-inset-top)) 20px 80px; }
h1 { font-family: 'Instrument Serif', Georgia, serif; font-size: 28px; margin: 0 0 4px; }
.subtitle { color: var(--text-2); font-size: 13px; margin: 0 0 20px; }
.card-preview {
  max-width: 340px; margin: 0 auto 20px;
  border-radius: 20px; overflow: hidden; border: 1px solid var(--border);
}
.card-preview img { display: block; width: 100%; height: auto; }
.wrapped-empty {
  max-width: 340px; margin: 0 auto 20px; padding: 40px 20px; text-align: center;
  border: 1px solid var(--border); border-radius: 20px; color: var(--text-2); font-size: 13px;
}
.actions { display: flex; justify-content: center; gap: 10px; }
.wrapped-download {
  background: var(--accent); color: #000; border: none; border-radius: 999px;
  padding: 12px 24px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block;
}
</style>
</head>
<body>
<h1 id="wrappedTitle">Wrapped</h1>
<p class="subtitle" id="wrappedSubtitle">Loading your quarter…</p>
<div id="wrappedContent"></div>

<script>
(function () {
  'use strict';

  var CARD_W = 1080, CARD_H = 1920;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadGymState() {
    try { return JSON.parse(localStorage.getItem('po_coach_v1') || '{}'); } catch (e) { return {}; }
  }
  function loadWeights() {
    try { return JSON.parse(localStorage.getItem('po_coach_weights') || '[]'); } catch (e) { return []; }
  }

  // Same sparkline-path convention as gym.html's buildSparkPath (kept as
  // a local copy -- no shared module between these two large HTML files
  // in this codebase, matching gym-volume-logic.js's own precedent for
  // mondayOfDate being duplicated rather than imported).
  function buildSparkPath(vals, w, h) {
    if (vals.length < 2) return '';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var range = max - min || 1;
    var pts = vals.map(function (v, i) {
      var x = (i / (vals.length - 1)) * w;
      var y = h - ((v - min) / range) * (h - 4) - 2;
      return x + ',' + y;
    });
    return 'M' + pts.join('L');
  }

  function buildCardSVG(stats) {
    var prLines = stats.prs.length
      ? stats.prs.slice(0, 3).map(function (p) { return esc(p.name); }).join(' · ')
      : 'Building the base this quarter';
    var prCountLabel = stats.prs.length ? (stats.prs.length + (stats.prs.length === 1 ? ' New PR' : ' New PRs')) : 'New PRs';

    var streakLabel = stats.streak > 0 ? (stats.streak + (stats.streak === 1 ? ' Day' : ' Days')) : 'Log your first day';

    var arcSection = '';
    if (stats.bodyweightSeries.length >= 2) {
      var vals = stats.bodyweightSeries.map(function (w) { return w.weight; });
      var path = buildSparkPath(vals, 900, 200);
      var first = stats.bodyweightSeries[0].weight;
      var last = stats.bodyweightSeries[stats.bodyweightSeries.length - 1].weight;
      arcSection =
        '<text x="90" y="1560" fill="#6ee7b7" font-family="JetBrains Mono, monospace" font-size="24" font-weight="700" letter-spacing="2">BODYWEIGHT</text>' +
        '<g transform="translate(90,1590)"><path d="' + path + '" fill="none" stroke="#6ee7b7" stroke-width="4"/></g>' +
        '<text x="90" y="1820" fill="#F4F1EA" font-family="Inter, sans-serif" font-size="22">' + first + ' → ' + last + ' lbs</text>';
    }

    return '' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + CARD_W + '" height="' + CARD_H + '" viewBox="0 0 ' + CARD_W + ' ' + CARD_H + '">' +
      '<rect width="' + CARD_W + '" height="' + CARD_H + '" fill="#000000"/>' +
      '<text x="90" y="180" fill="#F4F1EA" font-family="Instrument Serif, Georgia, serif" font-size="72">' + esc(stats.label) + '</text>' +
      '<text x="90" y="230" fill="rgba(244,241,234,0.5)" font-family="Inter, sans-serif" font-size="28">Row Wrapped</text>' +

      '<text x="90" y="420" fill="#6ee7b7" font-family="JetBrains Mono, monospace" font-size="24" font-weight="700" letter-spacing="2">' + esc(prCountLabel.toUpperCase()) + '</text>' +
      '<text x="90" y="470" fill="#F4F1EA" font-family="Inter, sans-serif" font-size="30">' + prLines + '</text>' +

      '<text x="90" y="640" fill="#6ee7b7" font-family="JetBrains Mono, monospace" font-size="24" font-weight="700" letter-spacing="2">VOLUME THIS QUARTER</text>' +
      '<text x="90" y="720" fill="#F4F1EA" font-family="Instrument Serif, Georgia, serif" font-size="64">' + stats.volume.toLocaleString() + ' lbs</text>' +

      '<text x="90" y="900" fill="#6ee7b7" font-family="JetBrains Mono, monospace" font-size="24" font-weight="700" letter-spacing="2">LONGEST STREAK</text>' +
      '<text x="90" y="980" fill="#F4F1EA" font-family="Instrument Serif, Georgia, serif" font-size="64">' + esc(streakLabel) + '</text>' +

      arcSection +
      '</svg>';
  }

  function renderPNG(svgString, onReady, onError) {
    var svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(svgBlob);
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = CARD_W; canvas.height = CARD_H;
      canvas.getContext('2d').drawImage(img, 0, 0, CARD_W, CARD_H);
      URL.revokeObjectURL(url);
      try { onReady(canvas.toDataURL('image/png')); } catch (e) { onError(e); }
    };
    img.onerror = function (e) { URL.revokeObjectURL(url); onError(e); };
    img.src = url;
  }

  function render() {
    if (!window.RowWrappedLogic) { onFatal(); return; }
    var L = window.RowWrappedLogic;
    var gymState = loadGymState();
    var bounds = L.quarterBounds(new Date());
    var stats = {
      label: bounds.label,
      prs: L.quarterPRs(gymState.exercises || [], gymState.logs || {}, bounds),
      volume: L.quarterVolume(gymState.logs || {}, bounds),
      streak: L.longestStreak(gymState.logs || {}, bounds),
      bodyweightSeries: L.quarterBodyweightSeries(loadWeights(), bounds)
    };

    document.getElementById('wrappedTitle').textContent = stats.label + ' Wrapped';
    document.getElementById('wrappedSubtitle').textContent = 'Your quarter so far.';

    var svg = buildCardSVG(stats);
    renderPNG(svg, function (dataUrl) {
      var content = document.getElementById('wrappedContent');
      content.innerHTML = '';
      var preview = document.createElement('div');
      preview.className = 'card-preview';
      var img = document.createElement('img');
      img.src = dataUrl;
      img.alt = stats.label + ' Wrapped recap card';
      preview.appendChild(img);
      content.appendChild(preview);

      var actions = document.createElement('div');
      actions.className = 'actions';
      var dl = document.createElement('a');
      dl.className = 'wrapped-download';
      dl.href = dataUrl;
      dl.download = 'row-wrapped-' + stats.label.replace(/\s+/g, '-').toLowerCase() + '.png';
      dl.textContent = 'Save Image';
      actions.appendChild(dl);
      content.appendChild(actions);
    }, onFatal);
  }

  function onFatal() {
    document.getElementById('wrappedSubtitle').textContent = "Couldn't render the shareable image.";
    var content = document.getElementById('wrappedContent');
    content.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'wrapped-empty';
    box.textContent = 'The card image failed to render this time. Your data is safe -- try reloading this page.';
    content.appendChild(box);
  }

  render();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/gregm/row && git add row-wrapped.html && git commit -m "feat(row-wrapped): add the Wrapped page -- SVG card build, canvas rasterize, PNG download"
```

### Task 3: Hub entry point

**Files:**
- Modify: `C:\Users\gregm\row\index.html`

- [ ] **Step 1: Add a 4th ops-chip linking to the new page.** Find this block:

```html
  <div class="ops-strip" id="opsStrip">
    <a href="health.html" class="ops-chip"><span id="opsMacroChip">Macros</span></a>
    <a href="health.html" class="ops-chip"><span id="opsStackChip">Stack</span></a>
    <a href="gym.html" class="ops-chip"><span id="opsCheckinChip">Check-in</span></a>
  </div>
```

Replace with:

```html
  <div class="ops-strip" id="opsStrip">
    <a href="health.html" class="ops-chip"><span id="opsMacroChip">Macros</span></a>
    <a href="health.html" class="ops-chip"><span id="opsStackChip">Stack</span></a>
    <a href="gym.html" class="ops-chip"><span id="opsCheckinChip">Check-in</span></a>
    <a href="row-wrapped.html" class="ops-chip">📊 Wrapped</a>
  </div>
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/gregm/row && git add index.html && git commit -m "feat(row-wrapped): add hub entry point"
```

### Task 4: Browser verification

- [ ] **Step 1: Start a local static server** for `C:\Users\gregm\row` and open `row-wrapped.html` in the Browser pane.

- [ ] **Step 2: Seed real-shaped test data via the console** (matching the shapes already used earlier this session for `getRx()` verification) covering: a qualifying PR, a non-qualifying one, a clean multi-day streak with a gap, a populated bodyweight series spanning the window boundary. Confirm via `document.getElementById('wrappedContent').querySelector('img')` that a real `data:image/png;base64,...` src is produced (not empty/broken), and spot-check the underlying stats object matches what the selfcheck already proved the pure functions compute.

- [ ] **Step 3: Clear all seeded data (empty account case)** and reload. Confirm all 4 degraded-state strings render (`Building the base this quarter`, `0 lbs` shown honestly, `Log your first day`, and the bodyweight arc section fully absent from the SVG -- check `svg.innerHTML` or the rendered PNG doesn't contain a broken/empty chart shape) and that the page never throws or shows a blank screen.

- [ ] **Step 4: Confirm the download link.** Click "Save Image", verify the `<a download>` attribute produces a sensible filename (e.g. `row-wrapped-q3-2026.png`) and that `dl.href` is a valid, non-empty `data:image/png;base64,...` URL.

- [ ] **Step 5: Resize to 375px and confirm no horizontal overflow** on the page itself (the card image is a fixed aspect ratio inside `.card-preview`, expected to scale down, not force the page wider).

- [ ] **Step 6: Confirm no writes to production Supabase.** This page only reads `localStorage` (`po_coach_v1`, `po_coach_weights`) -- it never calls `initCloudSync`, `sync.js`, or any Supabase client. Confirm via `read_network_requests` filtered to `supabase` that nothing fired during the whole verification pass (matching this session's established pattern for every other Row browser-verification this session).

### Task 5: Finish

- [ ] **Step 1: Run the full selfcheck one more time**

```bash
cd /c/Users/gregm/row && node row-wrapped-logic.selfcheck.cjs
```

- [ ] **Step 2: Push**

```bash
cd /c/Users/gregm/row && git push
```
