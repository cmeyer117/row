# Row Dashboard Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin all Row pages (`C:\Users\gregm\row`) to the "Vitality" palette/typography — pure black bg, warm off-white text, mint accent (unchanged), Instrument Serif italic headings, JetBrains Mono labels — without touching any page's layout, logic, or cloud-sync JS.

**Architecture:** Each page keeps its own `:root` CSS custom properties (names differ per page — `--text-1` vs `--text-primary`, etc.) rather than being unified into one shared stylesheet. Renaming variables across `gym.html`'s 5,262 lines to match a shared schema would be a high-risk mass refactor for a reskin task; instead each file's own token *values* are swapped in place and the Google Fonts `<link>` is swapped for one that includes Instrument Serif + Inter. Net visual result matches the design spec; blast radius per file stays to two edits.

**Tech Stack:** Plain HTML/CSS, no build step, no new dependencies.

---

## Shared font link (used in every task below)

Replace each page's existing Newsreader font `<link>` with:
```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

## Palette mapping (used in every task below)

| Old | New |
|---|---|
| `#050506`, `#0a0a0b` (bg) | `#000` |
| `#FAFAFA` (text-primary/text-1) | `#F4F1EA` |
| border alpha `0.06`/`0.14` | `0.08` (unify to reference's hairline) |
| `#6EE7B7`/`#6ee7b7` (accent) | unchanged |
| `'Newsreader', Georgia, serif` | `'Instrument Serif', Georgia, serif` |

---

### Task 1: index.html (hub)

**Files:**
- Modify: `index.html:11-19` (root tokens), `index.html:14` (font link)

- [ ] **Step 1: Swap font link**

Old:
```html
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,700;1,6..72,400&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
```
New: shared font link from above.

- [ ] **Step 2: Update root tokens**

Old:
```css
:root {
  --text-primary: #FAFAFA;
  --text-secondary: #B8B6B0;
  --text-tertiary: #76746E;
  --accent: #6EE7B7;
  --font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-serif: 'Newsreader', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```
New:
```css
:root {
  --text-primary: #F4F1EA;
  --text-secondary: #B8B6B0;
  --text-tertiary: #76746E;
  --accent: #6EE7B7;
  --font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```

- [ ] **Step 3: Update background color**

Find `background: #050506;` in `body` rule, replace with `background: #000;`.

- [ ] **Step 4: Visual check**

Open `index.html` in a browser (double-click or `start index.html` on Windows). Confirm: black bg, off-white tile text, mint accent on badges/arrows, tile names render in italic serif.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "style: reskin hub to Vitality palette"
```

---

### Task 2: main.html (Goals page)

**Files:**
- Modify: `main.html:14` (font link), `main.html:~15-27` (root tokens)

- [ ] **Step 1: Swap font link** — same as Task 1 Step 1, target `main.html:14`.

- [ ] **Step 2: Update root tokens**

Old:
```css
:root {
  --text-primary: #FAFAFA;
  --text-secondary: #B8B6B0;
  --text-tertiary: #76746E;
  --accent: #6EE7B7;
  --success: #6EE7B7;
  --warning: #F2C063;
  --danger: #FF6B6B;
  --font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-serif: 'Newsreader', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```
New:
```css
:root {
  --text-primary: #F4F1EA;
  --text-secondary: #B8B6B0;
  --text-tertiary: #76746E;
  --accent: #6EE7B7;
  --success: #6EE7B7;
  --warning: #F2C063;
  --danger: #FF6B6B;
  --font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```

- [ ] **Step 3:** Find the page background rule (`#050506`) and replace with `#000`.

- [ ] **Step 4: Visual check** — open `main.html`, confirm goals list still functions (add/check a to-do) and palette matches.

- [ ] **Step 5: Commit**

```bash
git add main.html
git commit -m "style: reskin goals page to Vitality palette"
```

---

### Task 3: gym.html

**Files:**
- Modify: `gym.html:14` (font link), `gym.html:~15-30` (root tokens)

- [ ] **Step 1: Swap font link** — same as Task 1 Step 1, target `gym.html:14`.

- [ ] **Step 2: Update root tokens**

Old:
```css
:root {
  --bg: #0a0a0b;
  --bg-card: #111113;
  --text-1: #ffffff;
  --text-2: rgba(255,255,255,0.6);
  --text-3: rgba(255,255,255,0.4);
  --text-4: rgba(255,255,255,0.25);
  --border: rgba(255,255,255,0.06);
  --border-strong: rgba(255,255,255,0.14);
  --accent: #6ee7b7;
  --good: #6ee7b7;
  --warn: #fbbf24;
  --bad: #ff8a8a;
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-serif: 'Newsreader', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SF Mono, Menlo, Consolas, monospace;
}
```
New:
```css
:root {
  --bg: #000000;
  --bg-card: #111113;
  --text-1: #F4F1EA;
  --text-2: rgba(244,241,234,0.6);
  --text-3: rgba(244,241,234,0.4);
  --text-4: rgba(244,241,234,0.25);
  --border: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.16);
  --accent: #6ee7b7;
  --good: #6ee7b7;
  --warn: #fbbf24;
  --bad: #ff8a8a;
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SF Mono, Menlo, Consolas, monospace;
}
```

- [ ] **Step 3: Visual + functional check**

Open `gym.html`. Confirm: palette updated, and — since this file has its own bespoke Supabase sync code (untouched, only `<style>` changed) — log a test set and confirm it still saves/syncs (check browser console for `[sync]` warnings, none expected).

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "style: reskin gym page to Vitality palette"
```

---

### Task 4: health.html

**Files:**
- Modify: `health.html:14` (font link), `health.html:~10-35` (root tokens)

- [ ] **Step 1: Swap font link** — same as Task 1 Step 1, target `health.html:14` (the `<link href=...>` line; keep the two `preconnect` lines above it as-is).

- [ ] **Step 2: Update root tokens**

Old:
```css
:root {
  --bg: #050506;
  --bg-card: rgba(255, 255, 255, 0.04);
  --bg-secondary: rgba(255, 255, 255, 0.035);
  --bg-input: rgba(0, 0, 0, 0.28);
  --bg-input-focus: rgba(0, 0, 0, 0.36);
  --bg-dropdown: rgba(15, 15, 18, 0.96);

  --border: rgba(255, 255, 255, 0.06);
  --border-soft: rgba(255, 255, 255, 0.04);
  --border-strong: rgba(255, 255, 255, 0.12);

  --text-primary: #FAFAFA;
  --text-secondary: #B8B6B0;
  --text-tertiary: #76746E;
  --text-quaternary: #4D4B47;

  --accent: #6EE7B7;
  --accent-glow: rgba(110, 231, 183, 0.30);
  --warning: #FF8A4D;
  --warning-bg: rgba(163, 45, 45, 0.10);
  --tag-stack: #D8AB30;
  --tag-stack-bg: rgba(216, 171, 48, 0.15);

  --font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-serif: 'Newsreader', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```
New: same block with `--bg: #000;`, `--text-primary: #F4F1EA;`, `--border: rgba(255, 255, 255, 0.08);`, `--border-strong: rgba(255, 255, 255, 0.16);`, `--font-serif: 'Instrument Serif', Georgia, serif;` — all other lines unchanged.

- [ ] **Step 3: Visual check** — open `health.html`, confirm supplement stack / water sections render with new palette.

- [ ] **Step 4: Commit**

```bash
git add health.html
git commit -m "style: reskin health page to Vitality palette"
```

---

### Task 5: finance.html

**Files:**
- Modify: `finance.html:14` (font link), `finance.html:~7-18` (root tokens)

- [ ] **Step 1: Swap font link** — same as Task 1 Step 1, target `finance.html:14`.

- [ ] **Step 2: Update root tokens**

Old:
```css
:root {
  --bg: #050506;
  --bg-card: rgba(255,255,255,0.04);
  --bg-secondary: rgba(255,255,255,0.035);
  --text-primary: #FAFAFA;
  --text-secondary: #B8B6B0;
  --text-tertiary: #76746E;
  --accent: #6EE7B7;
  --warning: #F2C063;
  --danger: #FF6B6B;
  --font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  --font-serif: 'Newsreader', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```
New:
```css
:root {
  --bg: #000000;
  --bg-card: rgba(255,255,255,0.04);
  --bg-secondary: rgba(255,255,255,0.035);
  --text-primary: #F4F1EA;
  --text-secondary: #B8B6B0;
  --text-tertiary: #76746E;
  --accent: #6EE7B7;
  --warning: #F2C063;
  --danger: #FF6B6B;
  --font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```

- [ ] **Step 3: Visual check** — open `finance.html`, confirm net worth/subscriptions views render with new palette.

- [ ] **Step 4: Commit**

```bash
git add finance.html
git commit -m "style: reskin finance page to Vitality palette"
```

---

### Task 6: mobility.html

**Files:**
- Modify: `mobility.html:~1-20` (root tokens; this page has no Google Fonts `<link>` and no `--font-serif` — it doesn't use the serif font anywhere, so none is added)

- [ ] **Step 1: Update root tokens**

Old:
```css
:root {
  --bg: #0a0a0b;
  --bg-card: #111113;
  --text-1: #ffffff;
  --text-2: rgba(255,255,255,0.6);
  --text-3: rgba(255,255,255,0.4);
  --text-4: rgba(255,255,255,0.25);
  --border: rgba(255,255,255,0.06);
  --border-strong: rgba(255,255,255,0.14);
  --accent: #6ee7b7;
  --good: #6ee7b7;
  --warn: #fbbf24;
  --bad: #ff8a8a;
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SF Mono, Menlo, Consolas, monospace;
}
```
New:
```css
:root {
  --bg: #000000;
  --bg-card: #111113;
  --text-1: #F4F1EA;
  --text-2: rgba(244,241,234,0.6);
  --text-3: rgba(244,241,234,0.4);
  --text-4: rgba(244,241,234,0.25);
  --border: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.16);
  --accent: #6ee7b7;
  --good: #6ee7b7;
  --warn: #fbbf24;
  --bad: #ff8a8a;
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SF Mono, Menlo, Consolas, monospace;
}
```

- [ ] **Step 2: Visual check** — open `mobility.html`, confirm stretch/mobility log renders with new palette.

- [ ] **Step 3: Commit**

```bash
git add mobility.html
git commit -m "style: reskin mobility page to Vitality palette"
```

---

### Task 7: po-water.html

**Files:**
- Modify: `po-water.html:~1-16` (root tokens; no Google Fonts link/serif here either)

- [ ] **Step 1: Update root tokens**

Old:
```css
:root {
  --bg: #0a0a0b;
  --bg-card: #111113;
  --text-1: #ffffff;
  --text-2: rgba(255,255,255,0.6);
  --text-3: rgba(255,255,255,0.4);
  --text-4: rgba(255,255,255,0.25);
  --border: rgba(255,255,255,0.06);
  --border-strong: rgba(255,255,255,0.14);
  --good: #6ee7b7;
  --warn: #fbbf24;
  --bad: #ff8a8a;
  --info: #7DD3FC;
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, SF Mono, Menlo, Consolas, monospace;
}
```
New:
```css
:root {
  --bg: #000000;
  --bg-card: #111113;
  --text-1: #F4F1EA;
  --text-2: rgba(244,241,234,0.6);
  --text-3: rgba(244,241,234,0.4);
  --text-4: rgba(244,241,234,0.25);
  --border: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.16);
  --good: #6ee7b7;
  --warn: #fbbf24;
  --bad: #ff8a8a;
  --info: #7DD3FC;
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, SF Mono, Menlo, Consolas, monospace;
}
```

- [ ] **Step 2: Visual check** — open `po-water.html`, confirm water intake tracker renders with new palette.

- [ ] **Step 3: Commit**

```bash
git add po-water.html
git commit -m "style: reskin water tracker to Vitality palette"
```

---

### Task 8: seed.html and offline.html (utility pages)

**Files:**
- Modify: `seed.html:7-12`, `offline.html:7-11`

- [ ] **Step 1: Update seed.html's inline style**

Old:
```css
  body { background: #0a0a0b; color: #fff; font-family: -apple-system, sans-serif;
    display: flex; align-items: center; justify-content: center; min-height: 100vh;
    margin: 0; flex-direction: column; gap: 12px; }
  p { color: rgba(255,255,255,0.5); font-size: 14px; margin: 0; }
```
New:
```css
  body { background: #000; color: #F4F1EA; font-family: -apple-system, sans-serif;
    display: flex; align-items: center; justify-content: center; min-height: 100vh;
    margin: 0; flex-direction: column; gap: 12px; }
  p { color: rgba(244,241,234,0.5); font-size: 14px; margin: 0; }
```

- [ ] **Step 2: Update offline.html's inline style**

Old:
```css
    body { margin:0; background:#050506; color:#FAFAFA; font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif; display:flex; align-items:center; justify-content:center; min-height:100dvh; text-align:center; padding:24px; box-sizing:border-box; }
    .icon { font-size:48px; margin-bottom:16px; }
    h1 { font-size:1.4rem; font-weight:600; margin:0 0 8px; }
    p { color:#76746E; font-size:0.95rem; line-height:1.6; margin:0; }
```
New:
```css
    body { margin:0; background:#000; color:#F4F1EA; font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif; display:flex; align-items:center; justify-content:center; min-height:100dvh; text-align:center; padding:24px; box-sizing:border-box; }
    .icon { font-size:48px; margin-bottom:16px; }
    h1 { font-size:1.4rem; font-weight:600; margin:0 0 8px; }
    p { color:#76746E; font-size:0.95rem; line-height:1.6; margin:0; }
```

- [ ] **Step 3: Visual check** — open both files directly in a browser, confirm palette.

- [ ] **Step 4: Commit**

```bash
git add seed.html offline.html
git commit -m "style: reskin utility pages to Vitality palette"
```

---

## Final check

- [ ] Open every page (`index.html`, `main.html`, `gym.html`, `health.html`, `finance.html`, `mobility.html`, `po-water.html`) in a browser and click through the hub links from `index.html` to confirm navigation still works and palette is consistent across all of them.
- [ ] Confirm `gym.html`'s cloud sync still works (log a set, refresh, confirm it persists) — this file's JS was never touched, only `<style>`.
