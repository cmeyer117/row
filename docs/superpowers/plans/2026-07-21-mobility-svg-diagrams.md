# Mobility SVG Diagrams (Daily + Posing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collapsible stick-figure SVG diagrams to the Daily tab's 11 stretches and build a new Posing tab with 7 standard bodybuilding poses, in `mobility.html`.

**Architecture:** Each `.mob-ex-row` gets a clickable header (name + chevron) that toggles an `expanded` class via one delegated click handler; the hidden panel (SVG + note) only renders when expanded, so the page stays as compact as it is today until the user taps a row. SVGs are inline `<svg>` markup embedded directly in each row's static HTML — no JS lookup table, since Daily and Posing rows are static HTML (not generated from the `PP` JS object like Pre/Post). A shared `SVG_LIB` dictionary is deferred to the follow-up pass that covers Pre/Post + Joint Care, where dedup against the dynamically-rendered `PP` data actually pays for the indirection.

**Tech Stack:** Plain HTML/CSS/vanilla JS, no build step, no framework. Static file served via `npx serve` (`.claude/launch.json`, port 5555).

---

### Task 1: Collapsible-card mechanism + Big 5 diagrams

**Files:**
- Modify: `mobility.html:152` (CSS insertion)
- Modify: `mobility.html:264-291` (Big 5 rows)
- Modify: `mobility.html:550-561` (tab-switch script block, add click handler)

- [ ] **Step 1: Add collapsible-card CSS**

Insert immediately after line 152 (`.mob-ex-note { ... }`), before the `/* ── Rule banner ── */` comment:

```css
/* ── Expandable exercise row ── */
.mob-ex-head {
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.mob-ex-chevron {
  color: var(--text-3); flex-shrink: 0; margin-left: 10px;
  transition: transform 0.15s;
}
.mob-ex-row.expanded .mob-ex-chevron { transform: rotate(180deg); }
.mob-ex-panel { display: none; margin-top: 10px; }
.mob-ex-row.expanded .mob-ex-panel { display: block; }
.mob-ex-diagram {
  width: 100%; max-width: 160px; height: auto;
  display: block; margin: 0 auto 8px;
}
```

- [ ] **Step 2: Rewrite the Big 5 rows with expandable markup + SVGs**

Replace lines 264-291 (the `.mob-block-title` through the closing `</div>` of the Big 5 `.mob-exercise-list`) with:

```html
    <div class="mob-block-title">The Big 5 — Do These Daily (8–10 min)</div>
    <div class="mob-exercise-list">
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">1. World's Greatest Stretch</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail"><strong>5 reps/side · 2 min</strong> — Step into deep lunge, drop back knee, same-side hand inside front foot, rotate opposite arm to ceiling, hold 2–3 sec at top, repeat.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="52" cy="18" r="6"/>
            <line x1="50" y1="24" x2="45" y2="50"/>
            <line x1="45" y1="50" x2="35" y2="70"/>
            <line x1="35" y1="70" x2="30" y2="90"/>
            <line x1="45" y1="50" x2="60" y2="72"/>
            <line x1="60" y1="72" x2="75" y2="88"/>
            <line x1="47" y1="30" x2="30" y2="45"/>
            <line x1="43" y1="28" x2="35" y2="12"/>
            <line x1="35" y1="12" x2="24" y2="4"/>
          </svg>
          <div class="mob-ex-note">Hits hip flexors, thoracic rotation, hamstrings, adductors, and shoulders in one movement. Best all-in-one drill.</div>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">2. Couch Stretch</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail"><strong>90 sec/side · 3 min</strong> — Back knee on ground, back foot elevated on couch/chair. Front foot flat, shin vertical. Drive hips forward and hold.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="55" cy="14" r="6"/>
            <line x1="54" y1="20" x2="52" y2="45"/>
            <line x1="52" y1="45" x2="50" y2="65"/>
            <line x1="50" y1="65" x2="48" y2="88"/>
            <line x1="52" y1="45" x2="66" y2="80"/>
            <line x1="66" y1="80" x2="70" y2="55"/>
            <line x1="53" y1="25" x2="53" y2="42"/>
          </svg>
          <div class="mob-ex-note">Most important stretch for bodybuilders. Hip flexors shorten from every squat, leg press, and hour of sitting. Short hip flexors = anterior pelvic tilt = forward lean = lower back stress = affected posing stance.</div>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">3. T-Spine Extension on Foam Roller</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail"><strong>2 min</strong> — Roller at mid-back (T4–T10), arms crossed or hands behind head. Drop back slowly and breathe. Move roller 1–2 inches up, pause, then 1–2 inches down.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="50" cy="58" rx="20" ry="7"/>
            <circle cx="18" cy="52" r="6"/>
            <line x1="24" y1="52" x2="70" y2="55"/>
            <line x1="66" y1="55" x2="80" y2="45"/>
            <line x1="80" y1="45" x2="92" y2="50"/>
            <line x1="66" y1="55" x2="78" y2="68"/>
            <line x1="78" y1="68" x2="90" y2="62"/>
            <line x1="24" y1="48" x2="14" y2="35"/>
          </svg>
          <div class="mob-ex-note">Root cause of your limited right-side rotation — not just the labrum. T-spine kyphosis from pressing compresses the spine and forces the shoulder into impingement position.</div>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">4. 90/90 Hip Stretch</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail"><strong>60 sec/side · 2 min</strong> — Sit on floor, front leg at 90° perpendicular to torso, back leg at 90° behind. Sit tall, push hips down. Lean forward over front shin (external rotator), then rotate over back shin (internal rotator).</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="52" cy="20" r="6"/>
            <line x1="52" y1="26" x2="50" y2="58"/>
            <line x1="50" y1="58" x2="28" y2="58"/>
            <line x1="28" y1="58" x2="28" y2="76"/>
            <line x1="50" y1="58" x2="66" y2="68"/>
            <line x1="66" y1="68" x2="82" y2="55"/>
            <line x1="51" y1="32" x2="34" y2="40"/>
          </svg>
          <div class="mob-ex-note">Fixes piriformis tightness causing hip and sciatic pain. Most stretches only hit one direction — this covers both.</div>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">5. Doorway Chest + Overhead Lat (superset)</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail"><strong>60 sec each side · 2 min</strong> — Chest: forearm on frame, step through and rotate. Two positions: 90° and 120°. Lat: same-side arm overhead on doorframe, drop hip away.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="72" y1="6" x2="72" y2="94"/>
            <circle cx="42" cy="18" r="6"/>
            <line x1="42" y1="24" x2="46" y2="52"/>
            <line x1="46" y1="52" x2="40" y2="80"/>
            <line x1="46" y1="52" x2="56" y2="80"/>
            <line x1="44" y1="28" x2="62" y2="18"/>
            <line x1="62" y1="18" x2="72" y2="14"/>
          </svg>
          <div class="mob-ex-note">Alternate: chest one side, lat same side, switch. Both tight areas in one doorframe visit.</div>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Add the delegated click handler**

In the `<script>` IIFE at line 550, immediately after the closing `});` of the existing tab-switching block (originally ending at line 561), add:

```javascript
  // ── Expandable exercise rows ──
  document.addEventListener('click', function(e) {
    var head = e.target.closest('.mob-ex-head');
    if (!head) return;
    head.closest('.mob-ex-row').classList.toggle('expanded');
  });
```

- [ ] **Step 4: Verify in browser**

Start the dev server and open the page:

```
preview_start { "name": "row" }
```

Navigate to `http://localhost:5555/mobility.html`, confirm the Daily tab is active by default. Click each of the 5 Big 5 row headers — the chevron should flip and an SVG diagram + note should appear below the detail line; click again to collapse. Confirm rows are collapsed by default (no diagrams visible on page load) and detail text (the bold reps/duration line) still shows without expanding.

- [ ] **Step 5: Commit**

```bash
git add mobility.html
git commit -m "feat(mobility): collapsible cards + diagrams for Big 5 daily stretches"
```

---

### Task 2: Add-Ons diagrams

**Files:**
- Modify: `mobility.html` (Add-Ons rows, immediately following the Big 5 block from Task 1)

- [ ] **Step 1: Rewrite the Add-Ons rows with expandable markup + SVGs**

Replace the Add-Ons block (originally lines 294-320: `.mob-block-title` "Add-Ons (If You Have More Time)" through its closing `.mob-exercise-list` `</div>`) with:

```html
    <div class="mob-divider"></div>
    <div class="mob-block-title">Add-Ons (If You Have More Time)</div>
    <div class="mob-exercise-list">
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">Dead hang</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">30 sec × 2 — Decompress spine and shoulders. Best after roller work.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="24" y1="8" x2="76" y2="8"/>
            <circle cx="50" cy="22" r="6"/>
            <line x1="50" y1="28" x2="50" y2="60"/>
            <line x1="50" y1="60" x2="44" y2="92"/>
            <line x1="50" y1="60" x2="56" y2="92"/>
            <line x1="48" y1="30" x2="40" y2="8"/>
            <line x1="52" y1="30" x2="60" y2="8"/>
          </svg>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">Cat-cow</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">10 slow reps — Arch fully, then round fully. Lubricates the spine cervical to lumbar.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18,52 Q50,32 82,52"/>
            <line x1="20" y1="52" x2="20" y2="82"/>
            <line x1="82" y1="52" x2="82" y2="82"/>
            <line x1="30" y1="46" x2="30" y2="80"/>
            <line x1="70" y1="48" x2="70" y2="80"/>
            <circle cx="14" cy="46" r="6"/>
          </svg>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">Figure-4 piriformis stretch</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">60 sec/side — Lying on back, cross ankle over opposite knee, pull that knee toward chest.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="14" cy="60" r="6"/>
            <line x1="20" y1="60" x2="55" y2="62"/>
            <line x1="55" y1="62" x2="60" y2="40"/>
            <line x1="55" y1="62" x2="72" y2="48"/>
            <line x1="72" y1="48" x2="60" y2="40"/>
          </svg>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">Standing hamstring stretch</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">60 sec/side — Foot elevated, hinge forward at hip with flat back. Not a rounded-back reach.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <rect x="64" y="46" width="18" height="8"/>
            <circle cx="60" cy="30" r="6"/>
            <line x1="35" y1="55" x2="35" y2="92"/>
            <line x1="35" y1="55" x2="55" y2="45"/>
            <line x1="55" y1="45" x2="70" y2="46"/>
            <line x1="35" y1="55" x2="55" y2="36"/>
            <line x1="55" y1="36" x2="66" y2="40"/>
          </svg>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">Child's pose with rotation</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">60 sec — Thread one arm under body, reach to opposite side. Opens thoracic rotators and lat simultaneously.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="62" y1="70" x2="62" y2="85"/>
            <line x1="62" y1="70" x2="32" y2="55"/>
            <circle cx="26" cy="52" r="6"/>
            <line x1="35" y1="56" x2="14" y2="50"/>
            <line x1="42" y1="60" x2="22" y2="76"/>
          </svg>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">Wrist flexor + extensor stretch</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">30 sec each — Arm extended, palm up/down, pull fingers back. Especially important if elbows ache.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="28" y1="52" x2="60" y2="50"/>
            <line x1="60" y1="50" x2="76" y2="50"/>
            <line x1="66" y1="34" x2="72" y2="47"/>
          </svg>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:5555/mobility.html`, click all 6 Add-Ons row headers, confirm each expands to show its diagram and collapses again correctly. Confirm the "Minimum Viable (3 Min)" block below still renders unchanged.

- [ ] **Step 3: Commit**

```bash
git add mobility.html
git commit -m "feat(mobility): diagrams for daily add-on stretches"
```

---

### Task 3: New Posing tab

**Files:**
- Modify: `mobility.html:249-253` (tab button list)
- Modify: `mobility.html` (remove Posing Tip block from Daily section, added in Task 1/2's rewritten Daily section — now sits right before the Daily section's closing `</div>`)
- Modify: `mobility.html` (insert new `section-posing` after the Joint Care section, before `mob-shell` closes)

- [ ] **Step 1: Add the Posing tab button**

Replace the tabs block:

```html
  <div class="mob-tabs">
    <button class="mob-tab-btn active" data-section="daily" type="button">Daily</button>
    <button class="mob-tab-btn" data-section="preppost" type="button">Pre / Post</button>
    <button class="mob-tab-btn" data-section="joints" type="button">Joint Care</button>
  </div>
```

with:

```html
  <div class="mob-tabs">
    <button class="mob-tab-btn active" data-section="daily" type="button">Daily</button>
    <button class="mob-tab-btn" data-section="preppost" type="button">Pre / Post</button>
    <button class="mob-tab-btn" data-section="joints" type="button">Joint Care</button>
    <button class="mob-tab-btn" data-section="posing" type="button">Posing</button>
  </div>
```

No JS change needed — the existing tab-switch handler reads `data-section` and toggles `#section-<value>`, which will work automatically once `#section-posing` exists (Step 3).

- [ ] **Step 2: Remove the Posing Tip block from the Daily section**

Find this block near the end of `#section-daily` (after "Minimum Viable (3 Min)"):

```html
    <div class="mob-divider"></div>
    <div class="mob-block-title">Posing Tip</div>
    <div class="mob-card">
      <div class="mob-card-body">Do your mobility session first, then practice posing immediately after. ROM is at its maximum within 30 min of active stretching. For the right lat spread: practice after overhead lat stretch and T-spine work while the tissue is open. Film it weekly — you will notice a difference.</div>
    </div>
```

Delete it entirely (it moves to the new Posing section in Step 3). The `#section-daily` div should now close immediately after the "Minimum Viable (3 Min)" block.

- [ ] **Step 3: Insert the new Posing section**

Immediately after the closing `</div>` of `#section-joints` (i.e. right before the final `</div>` that closes `.mob-shell`), insert:

```html
  <!-- ═══════════════════════════════════════════
       SECTION 4 — POSING
       ═══════════════════════════════════════════ -->
  <div class="mob-section" id="section-posing">
    <div class="mob-rule">
      <strong>When:</strong> Right after your daily mobility session, while ROM is at its maximum (within 30 min of active stretching). For the right lat spread specifically: pose right after overhead lat stretch and T-spine work, while that tissue is open.<br>
      <strong>Tip:</strong> Film it weekly — you will notice a difference.
    </div>

    <div class="mob-block-title">Mandatory Poses</div>
    <div class="mob-exercise-list">
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">1. Front Double Biceps</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">Facing forward, both arms raised and flexed, fists near shoulder height, legs braced.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="50" cy="14" r="6"/>
            <line x1="50" y1="20" x2="50" y2="55"/>
            <line x1="50" y1="55" x2="42" y2="90"/>
            <line x1="50" y1="55" x2="58" y2="90"/>
            <line x1="40" y1="25" x2="25" y2="34"/>
            <line x1="25" y1="34" x2="35" y2="18"/>
            <line x1="60" y1="25" x2="75" y2="34"/>
            <line x1="75" y1="34" x2="65" y2="18"/>
          </svg>
          <div class="mob-ex-note">Brace legs and flex quads, don't just flex arms — judges score the whole physique.</div>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">2. Front Lat Spread</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">Hands on waist, elbows driven wide and forward to spread the lats, chest up.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="50" cy="14" r="6"/>
            <line x1="50" y1="20" x2="50" y2="55"/>
            <line x1="50" y1="55" x2="42" y2="90"/>
            <line x1="50" y1="55" x2="58" y2="90"/>
            <line x1="40" y1="24" x2="20" y2="46"/>
            <line x1="20" y1="46" x2="40" y2="55"/>
            <line x1="60" y1="24" x2="80" y2="46"/>
            <line x1="80" y1="46" x2="60" y2="55"/>
          </svg>
          <div class="mob-ex-note">Right-side lat spread is limited by the shoulder — practice this one right after overhead lat stretch.</div>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">3. Side Chest</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">Turn to your best side, front leg bent and flexed, grip opposite wrist in front of chest, crush the pecs.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="50" cy="14" r="6"/>
            <line x1="50" y1="20" x2="50" y2="55"/>
            <line x1="50" y1="55" x2="40" y2="70"/>
            <line x1="40" y1="70" x2="45" y2="90"/>
            <line x1="50" y1="55" x2="60" y2="90"/>
            <line x1="40" y1="35" x2="60" y2="35"/>
            <circle cx="50" cy="35" r="2"/>
          </svg>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">4. Side Triceps</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">Turn to your side, near arm extended straight down and back to show triceps horseshoe, far hand grips the wrist.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="50" cy="14" r="6"/>
            <line x1="50" y1="20" x2="50" y2="55"/>
            <line x1="50" y1="55" x2="45" y2="90"/>
            <line x1="50" y1="55" x2="60" y2="85"/>
            <line x1="48" y1="25" x2="60" y2="40"/>
            <line x1="60" y1="40" x2="65" y2="55"/>
            <line x1="65" y1="58" x2="58" y2="52"/>
          </svg>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">5. Back Double Biceps</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">Back to the mirror, same arm flex as front double biceps, stagger the legs to show calves.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="50" cy="14" r="6"/>
            <line x1="38" y1="22" x2="62" y2="22"/>
            <line x1="50" y1="22" x2="50" y2="55"/>
            <line x1="50" y1="55" x2="43" y2="90"/>
            <line x1="50" y1="55" x2="58" y2="88"/>
            <line x1="40" y1="25" x2="25" y2="34"/>
            <line x1="25" y1="34" x2="35" y2="18"/>
            <line x1="60" y1="25" x2="75" y2="34"/>
            <line x1="75" y1="34" x2="65" y2="18"/>
          </svg>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">6. Back Lat Spread</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">Back to the mirror, hands on waist, drive elbows wide to show full back width.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="50" cy="14" r="6"/>
            <path d="M35,22 L50,20 L65,22 L60,55 L40,55 Z"/>
            <line x1="50" y1="55" x2="42" y2="90"/>
            <line x1="50" y1="55" x2="58" y2="90"/>
            <line x1="40" y1="24" x2="20" y2="46"/>
            <line x1="20" y1="46" x2="40" y2="55"/>
            <line x1="60" y1="24" x2="80" y2="46"/>
            <line x1="80" y1="46" x2="60" y2="55"/>
          </svg>
        </div>
      </div>
      <div class="mob-ex-row">
        <div class="mob-ex-head">
          <div class="mob-ex-name">7. Abdominal &amp; Thigh</div>
          <svg class="mob-ex-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="mob-ex-detail">Hands behind head, crunch forward slightly, one leg extended and flexed to show quad separation.</div>
        <div class="mob-ex-panel">
          <svg class="mob-ex-diagram" viewBox="0 0 100 100" stroke="var(--text-2)" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="50" cy="14" r="6"/>
            <line x1="50" y1="20" x2="52" y2="50"/>
            <line x1="40" y1="14" x2="50" y2="11"/>
            <line x1="60" y1="14" x2="50" y2="11"/>
            <line x1="52" y1="50" x2="48" y2="90"/>
            <line x1="52" y1="50" x2="70" y2="55"/>
            <line x1="70" y1="55" x2="82" y2="45"/>
          </svg>
        </div>
      </div>
    </div>

    <div class="mob-divider"></div>
    <div class="mob-block-title">Posing Tip</div>
    <div class="mob-card">
      <div class="mob-card-body">Do your mobility session first, then practice posing immediately after. ROM is at its maximum within 30 min of active stretching. For the right lat spread: practice after overhead lat stretch and T-spine work while the tissue is open. Film it weekly — you will notice a difference.</div>
    </div>
  </div>
```

- [ ] **Step 4: Verify in browser**

Reload `http://localhost:5555/mobility.html`. Click the new "Posing" tab button — confirm it becomes active and shows all 7 poses collapsed by default, plus the moved Posing Tip card. Click each pose row to confirm expand/collapse and diagrams. Switch back to "Daily" and confirm the old Posing Tip block is gone from the bottom of that section (no duplicate, no leftover empty divider).

- [ ] **Step 5: Commit**

```bash
git add mobility.html
git commit -m "feat(mobility): add Posing tab with 7 mandatory poses"
```

---

### Task 4: Final pass

- [ ] **Step 1: Full manual walkthrough**

With the `row` dev server still running, click through all 4 tabs (Daily, Pre/Post, Joint Care, Posing) and confirm: Pre/Post and Joint Care are unchanged (still text-only, in scope for a later pass per the spec), Daily's 11 rows and Posing's 7 rows all expand/collapse correctly, and the bottom gym tab bar (Log/Progress/Mobility) still navigates correctly.

- [ ] **Step 2: Push**

```bash
git push
```

(Per standing instructions, commit + push is default-on once a logical unit of work is done — confirm with Carl only if something looks off during the walkthrough.)
