# gym.html Exercise Library (Coaching Posters) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-exercise coaching-poster image to `gym.html`'s log form, reusing the existing `DEFAULT_CUES`/`getCues`/`renderCues` architecture instead of introducing new fields or a new per-row UI.

**Architecture:** A new name-keyed lookup object `EXERCISE_SLUGS` (same convention as `DEFAULT_CUES`/`MUSCLE_PRIMARY`) maps every exercise/variant name to an image slug. `getPoster(exId)` mirrors `getCues(exId)`'s resolution (active variant's slug, else the primary's slug, else `null`). A single collapsed-by-default `#posterSection` lives inside `logFormWrap` next to the existing Cues section; `renderPoster(ex)` is called alongside `renderCues(ex)` in `renderForm()`, so switching the selected exercise *or* switching a substitution variant both update the poster automatically. If a slug has no `.png` yet (this pass ships the code, not the 100 generated images — those come in a separate image-generation session per the spec's day-by-day batching), the section simply stays hidden — no broken-image state.

**Tech Stack:** Plain HTML/CSS/vanilla JS, no build step, no framework. Static file served via `npx serve` (`.claude/launch.json`, port 5555).

**Out of scope for this plan:** Generating the 100 poster `.png` assets themselves (`assets/gym/<slug>.png`). That's a separate, non-code content-generation pass, batched by day (Push → Pull → Legs A → Upper → Legs B) per the spec — this plan ships the display mechanism so that pass can drop in images incrementally with zero further code changes.

---

### Task 1: `EXERCISE_SLUGS` lookup object

**Files:**
- Modify: `gym.html:4483-4485` (insert between `DEFAULT_CUES`'s closing `};` and `MUSCLE_PRIMARY`'s declaration)

- [ ] **Step 1: Insert the slug lookup**

Find this exact text (the end of `DEFAULT_CUES` and start of `MUSCLE_PRIMARY`):

```javascript
    'Bent Knee Calf Press on Leg Press':      ['Full heel drop — no partials','2–3 sec eccentric, pause at bottom','Bent knee = soleus bias','Full heel-drop stretch, 2-3 sec eccentric, pause + squeeze at top'],
  };

  const MUSCLE_PRIMARY = {
```

Replace it with:

```javascript
    'Bent Knee Calf Press on Leg Press':      ['Full heel drop — no partials','2–3 sec eccentric, pause at bottom','Bent knee = soleus bias','Full heel-drop stretch, 2-3 sec eccentric, pause + squeeze at top'],
  };

  // One entry per DEFAULT_CUES key (34 primary + 66 substitute names) — image slug for the poster.
  const EXERCISE_SLUGS = {
    'Neutral Grip Shoulder Press Machine':    'neutral-grip-shoulder-press-machine',
    'Smith Machine Flat Chest Press':         'smith-machine-flat-chest-press',
    'Chest Dip':                              'chest-dip',
    'Incline Cable Pec Fly':                  'incline-cable-pec-fly',
    'Dumbbell Lateral Raise':                 'dumbbell-lateral-raise',
    'Cable Front Raise':                      'cable-front-raise',
    'Cable Triceps Overhead Extension':       'cable-triceps-overhead-extension',
    'Lat Pulldown':                           'lat-pulldown',
    'Cable Seated Row (Neutral Grip)':        'cable-seated-row-neutral-grip',
    'Machine High Row':                       'machine-high-row',
    'Machine Low Row':                        'machine-low-row',
    'Cable Lat Pushdown/Pullover':            'cable-lat-pushdown-pullover',
    'Cable Rear Delt Fly':                    'cable-rear-delt-fly',
    'Seated Behind-the-Back Cable Curl':      'seated-behind-the-back-cable-curl',
    'Hack Squat':                             'hack-squat',
    'Sissy Leg Press':                        'sissy-leg-press',
    'Seated Hamstrings Curl':                 'seated-hamstrings-curl',
    'Dumbbell B-Stance RDL':                  'dumbbell-b-stance-rdl',
    'Hip Adduction Machine':                  'hip-adduction-machine',
    'Standing Calf Raise':                    'standing-calf-raise',
    'Dumbbell Incline Chest Press':           'dumbbell-incline-chest-press',
    'Chest Supported T-Bar Row':              'chest-supported-t-bar-row',
    'Smith Machine Narrow Grip Bench':        'smith-machine-narrow-grip-bench',
    'Neutral Grip Lat Pulldown':              'neutral-grip-lat-pulldown',
    'Low Cable Lateral Raise':                'low-cable-lateral-raise',
    'Dumbbell Front Raise':                   'dumbbell-front-raise',
    'Machine Preacher Curl':                  'machine-preacher-curl',
    'Cable Triceps Pushdown':                 'cable-triceps-pushdown',
    'Smith Machine RDL':                      'smith-machine-rdl',
    'Lying Hamstrings Curl':                  'lying-hamstrings-curl',
    'Cybex Leg Press':                        'cybex-leg-press',
    'Dumbbell Heel Elevated Lunge':           'dumbbell-heel-elevated-lunge',
    'Leg Extension':                          'leg-extension',
    'Seated Calf Raise':                      'seated-calf-raise',

    // ── Variant / substitute slugs ──────────────────────────────────
    'Dumbbell Neutral Grip Shoulder Press':   'dumbbell-neutral-grip-shoulder-press',
    'Smith Incline Machine Chest Press':      'smith-incline-machine-chest-press',
    'Machine Flat Chest Press':               'machine-flat-chest-press',
    'Barbell / Dumbbell Flat Chest Press':    'barbell-dumbbell-flat-chest-press',
    'Seated Cable Flat Chest Press':          'seated-cable-flat-chest-press',
    'Dip Machine (Chest Bias)':               'dip-machine-chest-bias',
    'Chest Dip (RG Variant)':                 'chest-dip-rg-variant',
    'Other Dip Variations':                   'other-dip-variations',
    'Pec Dec Fly (Upper Chest Bias)':         'pec-dec-fly-upper-chest-bias',
    'Incline Dumbbell Pec Fly':               'incline-dumbbell-pec-fly',
    'Seated Machine Lateral Raise':           'seated-machine-lateral-raise',
    'Standing Machine Lateral Raise':         'standing-machine-lateral-raise',
    'Dumbbell Overhead Extension':            'dumbbell-overhead-extension',
    'Machine Overhead Triceps Extension':     'machine-overhead-triceps-extension',
    'Machine Triceps Extension':              'machine-triceps-extension',
    'Wide Grip Pullup':                       'wide-grip-pullup',
    'Lat Pulldown Machine':                   'lat-pulldown-machine',
    'Smith Machine UH Barbell Row':           'smith-machine-uh-barbell-row',
    'Underhand Grip Barbell Row':             'underhand-grip-barbell-row',
    'Cable High Row':                         'cable-high-row',
    'Nautilus Lat Pulldown':                  'nautilus-lat-pulldown',
    'High Row Setup on Lat Pulldown':         'high-row-setup-on-lat-pulldown',
    'Cable Low Row':                          'cable-low-row',
    'Single Arm Landmine Row':                'single-arm-landmine-row',
    'Machine Lat Pullover':                   'machine-lat-pullover',
    'Dumbbell Lat Pullover':                  'dumbbell-lat-pullover',
    'Machine Rear Delt Fly':                  'machine-rear-delt-fly',
    'Dumbbell Rear Delt Fly':                 'dumbbell-rear-delt-fly',
    'Bayesian Cable Curl':                    'bayesian-cable-curl',
    'Seated Incline Dumbbell Curl':           'seated-incline-dumbbell-curl',
    'Pendulum Squat':                         'pendulum-squat',
    'Smith Machine Squat (Quad Bias)':        'smith-machine-squat-quad-bias',
    'Barbell Squat (Quad Bias)':              'barbell-squat-quad-bias',
    'Hack Squat Sissy Squats':                'hack-squat-sissy-squats',
    'Sissy Squat on Sissy Stand':             'sissy-squat-on-sissy-stand',
    'Leg Press Quad Bias':                    'leg-press-quad-bias',
    'Glute Ham Raise':                        'glute-ham-raise',
    'Cable Hip Extension Machine':            'cable-hip-extension-machine',
    'Single Leg Hip Extension':               'single-leg-hip-extension',
    'V-Squat Good Morning':                   'v-squat-good-morning',
    'Barbell Good Morning':                   'barbell-good-morning',
    'Cable Hip Adduction':                    'cable-hip-adduction',
    'Smith Machine Calf Raise':               'smith-machine-calf-raise',
    'Machine Incline Chest Press':            'machine-incline-chest-press',
    'Smith Machine Barbell Row':              'smith-machine-barbell-row',
    'Landmine T-Bar Row':                     'landmine-t-bar-row',
    'Barbell Row':                            'barbell-row',
    'Barbell Narrow Grip Bench Press':        'barbell-narrow-grip-bench-press',
    'Machine Narrow Grip Chest Press':        'machine-narrow-grip-chest-press',
    'Narrow Grip Push-up':                    'narrow-grip-push-up',
    'Nautilus Lat Pulldown Machine':          'nautilus-lat-pulldown-machine',
    'Single Arm Lat Pulldown':                'single-arm-lat-pulldown',
    'Barbell Preacher Curl':                  'barbell-preacher-curl',
    'Standing Cable Curl':                    'standing-cable-curl',
    'Cable Elbow Supported Triceps Pushdown': 'cable-elbow-supported-triceps-pushdown',
    'Triceps Crossbody Extension':            'triceps-crossbody-extension',
    'Barbell / Dumbbell / Trap Bar RDL':      'barbell-dumbbell-trap-bar-rdl',
    'V-Squat Machine Good Morning':           'v-squat-machine-good-morning',
    'Arsenal Posterior Chain Developer':      'arsenal-posterior-chain-developer',
    '45° Sled Leg Press':                     '45-sled-leg-press',
    'Horizontal Leg Press':                   'horizontal-leg-press',
    'Dumbbell Split Squat':                   'dumbbell-split-squat',
    'Smith Machine Split Squat':              'smith-machine-split-squat',
    'DB/BB Walking Lunge':                    'db-bb-walking-lunge',
    'Sissy Squat':                            'sissy-squat',
    'Bent Knee Calf Press on Leg Press':      'bent-knee-calf-press-on-leg-press',
  };

  const MUSCLE_PRIMARY = {
```

- [ ] **Step 2: Verify in browser console**

Start the dev server (`preview_start { "name": "row" }`), open `http://localhost:5555/gym.html`, open the browser console, and run:

```javascript
Object.keys(EXERCISE_SLUGS).length
```

Expected: `100`. Also run `Object.keys(DEFAULT_CUES).every(k => k in EXERCISE_SLUGS)` — expected `true` (every cue key has a matching slug).

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "feat(gym): add EXERCISE_SLUGS lookup for exercise poster images"
```

---

### Task 2: `getPoster()` resolver

**Files:**
- Modify: `gym.html:4530-4535` (immediately after the existing `saveCues` function)

- [ ] **Step 1: Add the resolver function**

Find:

```javascript
  function saveCues(exId, lines) {
    if (!state.cues) state.cues = {};
    state.cues[exId] = lines;
    saveState();
  }

  let restTimerInterval = null;
```

Replace with:

```javascript
  function saveCues(exId, lines) {
    if (!state.cues) state.cues = {};
    state.cues[exId] = lines;
    saveState();
  }

  function getPoster(exId) {
    const ex = (state.exercises || []).find(function(e) { return e.id === exId; });
    if (!ex) return null;
    const variant = getSession(exId).activeVariant;
    return (variant && EXERCISE_SLUGS[variant]) || EXERCISE_SLUGS[ex.name] || null;
  }

  let restTimerInterval = null;
```

- [ ] **Step 2: Verify in browser console**

With an exercise selected in the Log tab, run in console:

```javascript
getPoster(state.currentEx)
```

Expected: a kebab-case slug string (e.g. `"hack-squat"`), matching whatever exercise is currently selected. Switch the "Alt" picker to a substitution variant, run it again — expected: the substitute's slug, not the primary's.

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "feat(gym): add getPoster() resolver mirroring getCues()"
```

---

### Task 3: Poster section + lightbox CSS

**Files:**
- Modify: `gym.html:745-747` (insert between the Cues CSS block and the Warm-Up CSS comment)

- [ ] **Step 1: Insert the CSS**

Find:

```css
.po-cues-save-btn {
  font-size: 11px; padding: 4px 12px; border-radius: 999px;
  background: rgba(110,231,183,0.15); color: var(--good);
  border: 1px solid var(--good); cursor: pointer; margin-top: 4px;
  font-family: inherit;
}

/* ----- Warm-Up ----- */
```

Replace with:

```css
.po-cues-save-btn {
  font-size: 11px; padding: 4px 12px; border-radius: 999px;
  background: rgba(110,231,183,0.15); color: var(--good);
  border: 1px solid var(--good); cursor: pointer; margin-top: 4px;
  font-family: inherit;
}

/* ----- Poster ----- */
.poster-section {
  padding: 8px 0 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 8px;
}
.poster-header {
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.poster-label {
  font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
  color: var(--text-3); text-transform: uppercase;
}
.poster-chevron {
  color: var(--text-3); flex-shrink: 0; margin-left: 10px;
  transition: transform 0.15s;
}
.poster-section.expanded .poster-chevron { transform: rotate(180deg); }
.poster-panel { display: none; margin-top: 8px; }
.poster-section.expanded .poster-panel { display: block; }
.poster-img {
  width: 100%; max-width: 320px; height: auto;
  display: block; margin: 0 auto; border-radius: 8px;
  cursor: zoom-in;
}

/* ----- Poster lightbox ----- */
.gym-lightbox {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.9);
  display: none; align-items: center; justify-content: center;
  padding: 20px; cursor: zoom-out;
}
.gym-lightbox.show { display: flex; }
.gym-lightbox img {
  max-width: 100%; max-height: 100%; border-radius: 8px;
}

/* ----- Warm-Up ----- */
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:5555/gym.html`. No visible change yet (no markup uses these classes till Task 4) — confirm the page still loads with no console errors.

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "feat(gym): add poster section + lightbox CSS"
```

---

### Task 4: Poster markup

**Files:**
- Modify: `gym.html:2564-2577` (insert `#posterSection` after the existing `#cuesSection`, inside `logFormWrap`)
- Modify: `gym.html:2735-2737` (insert the lightbox modal after `progModalBg`)

- [ ] **Step 1: Add the poster section markup**

Find:

```html
      <!-- Cues -->
      <div class="po-cues-section" id="cuesSection">
        <div class="po-cues-header">
          <span class="po-cues-label">Cues</span>
          <button class="po-cues-edit-btn" id="cuesEditBtn" type="button">edit</button>
        </div>
        <div class="po-cues-list" id="cuesList"></div>
        <div id="cuesEditArea" style="display:none">
          <textarea class="po-cues-textarea" id="cuesTextarea" placeholder="One cue per line — e.g. scapular depression before pulling"></textarea>
          <button class="po-cues-save-btn" id="cuesSaveBtn" type="button">Save</button>
        </div>
      </div>

      <!-- Coach -->
```

Replace with:

```html
      <!-- Cues -->
      <div class="po-cues-section" id="cuesSection">
        <div class="po-cues-header">
          <span class="po-cues-label">Cues</span>
          <button class="po-cues-edit-btn" id="cuesEditBtn" type="button">edit</button>
        </div>
        <div class="po-cues-list" id="cuesList"></div>
        <div id="cuesEditArea" style="display:none">
          <textarea class="po-cues-textarea" id="cuesTextarea" placeholder="One cue per line — e.g. scapular depression before pulling"></textarea>
          <button class="po-cues-save-btn" id="cuesSaveBtn" type="button">Save</button>
        </div>
      </div>

      <!-- Poster -->
      <div class="poster-section" id="posterSection" style="display:none">
        <div class="poster-header" id="posterHeader">
          <span class="poster-label">Form Reference</span>
          <svg class="poster-chevron" viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="poster-panel">
          <img class="poster-img" id="posterImg" alt="">
        </div>
      </div>

      <!-- Coach -->
```

- [ ] **Step 2: Add the lightbox modal**

Find:

```html
  <!-- PROGRESS CARD EXPANDED-GRAPH MODAL -->
  <div class="sub-modal-bg" id="progModalBg">
    <div class="sub-modal">
      <div class="sub-modal-title" id="progModalTitle">Exercise</div>
      <div id="progModalChart"></div>
      <div id="progModalSessions"></div>
      <div class="sub-modal-actions">
        <button class="sub-cancel" id="progModalClose">Close</button>
      </div>
    </div>
  </div>

  <!-- PROGRESS VIEW -->
```

Replace with:

```html
  <!-- PROGRESS CARD EXPANDED-GRAPH MODAL -->
  <div class="sub-modal-bg" id="progModalBg">
    <div class="sub-modal">
      <div class="sub-modal-title" id="progModalTitle">Exercise</div>
      <div id="progModalChart"></div>
      <div id="progModalSessions"></div>
      <div class="sub-modal-actions">
        <button class="sub-cancel" id="progModalClose">Close</button>
      </div>
    </div>
  </div>

  <!-- POSTER LIGHTBOX -->
  <div class="gym-lightbox" id="gymLightbox">
    <img id="gymLightboxImg" src="" alt="">
  </div>

  <!-- PROGRESS VIEW -->
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:5555/gym.html`. The poster section stays hidden (no exercise has a real `.png` yet, and `#posterSection` starts with inline `display:none`) — confirm no layout shift or visual regression in the Log tab, no console errors.

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "feat(gym): add poster section and lightbox markup"
```

---

### Task 5: Wire rendering and interaction

**Files:**
- Modify: `gym.html:3497-3500` (call `renderPoster` alongside `renderCues` in `renderForm()`)
- Modify: `gym.html:4574-4591` (add `renderPoster` function after `renderCues`)
- Modify: `gym.html:4610-4612` (add delegated click handler after the existing cues-save listener)

- [ ] **Step 1: Add the `renderPoster` function**

Find:

```javascript
  function renderCues(ex) {
    const list = $('cuesList');
    const textarea = $('cuesTextarea');
    const editArea = $('cuesEditArea');
    const editBtn = $('cuesEditBtn');
    if (!ex) { $('cuesSection').style.display = 'none'; return; }
    $('cuesSection').style.display = '';
    editArea.style.display = 'none';
    editBtn.textContent = 'edit';
    const cues = getCues(ex.id);
    if (cues.length) {
      list.innerHTML = cues.map(c => '<div class="po-cue-item">' + escape(c) + '</div>').join('');
    } else {
      list.innerHTML = '<div class="po-cues-empty">No cues yet — tap edit to add</div>';
    }
    textarea.value = cues.join('\n');
  }

  $('warmupToggle').addEventListener('click', function() {
```

Replace with:

```javascript
  function renderCues(ex) {
    const list = $('cuesList');
    const textarea = $('cuesTextarea');
    const editArea = $('cuesEditArea');
    const editBtn = $('cuesEditBtn');
    if (!ex) { $('cuesSection').style.display = 'none'; return; }
    $('cuesSection').style.display = '';
    editArea.style.display = 'none';
    editBtn.textContent = 'edit';
    const cues = getCues(ex.id);
    if (cues.length) {
      list.innerHTML = cues.map(c => '<div class="po-cue-item">' + escape(c) + '</div>').join('');
    } else {
      list.innerHTML = '<div class="po-cues-empty">No cues yet — tap edit to add</div>';
    }
    textarea.value = cues.join('\n');
  }

  function renderPoster(ex) {
    const section = $('posterSection');
    const img = $('posterImg');
    if (!ex) { section.style.display = 'none'; return; }
    const slug = getPoster(ex.id);
    if (!slug) { section.style.display = 'none'; return; }
    section.classList.remove('expanded');
    img.onload = function() { section.style.display = ''; };
    img.onerror = function() { section.style.display = 'none'; };
    img.src = 'assets/gym/' + slug + '.png';
  }

  $('warmupToggle').addEventListener('click', function() {
```

- [ ] **Step 2: Call `renderPoster` from `renderForm()`**

Find:

```javascript
  function renderForm() {
    const ex = getCurrentEx();
    renderWarmup();
    renderCues(ex);
    // Reset coach panel when switching exercises
```

Replace with:

```javascript
  function renderForm() {
    const ex = getCurrentEx();
    renderWarmup();
    renderCues(ex);
    renderPoster(ex);
    // Reset coach panel when switching exercises
```

- [ ] **Step 3: Add the delegated click handler**

Find:

```javascript
  $('cuesSaveBtn').addEventListener('click', function() {
    const ex = getCurrentEx();
    if (!ex) return;
    const lines = $('cuesTextarea').value.split('\n').map(s => s.trim()).filter(Boolean);
    saveCues(ex.id, lines);
    renderCues(ex);
  });

  // ── Jarvis fetch helper (one retry, 12s timeout — Railway cold starts) ──
```

Replace with:

```javascript
  $('cuesSaveBtn').addEventListener('click', function() {
    const ex = getCurrentEx();
    if (!ex) return;
    const lines = $('cuesTextarea').value.split('\n').map(s => s.trim()).filter(Boolean);
    saveCues(ex.id, lines);
    renderCues(ex);
  });

  // ── Poster: expand/collapse + lightbox ──
  document.addEventListener('click', function(e) {
    if (e.target.closest('#posterHeader')) {
      $('posterSection').classList.toggle('expanded');
      return;
    }
    const photo = e.target.closest('#posterImg');
    if (photo && $('posterSection').classList.contains('expanded')) {
      $('gymLightboxImg').src = photo.src;
      $('gymLightbox').classList.add('show');
      return;
    }
    if (e.target.closest('#gymLightbox')) $('gymLightbox').classList.remove('show');
  });

  // ── Jarvis fetch helper (one retry, 12s timeout — Railway cold starts) ──
```

- [ ] **Step 4: Verify in browser**

Reload `http://localhost:5555/gym.html`. Since no `.png` files exist under `assets/gym/` yet, `#posterSection` should stay hidden for every exercise (confirm via console: `getPoster(state.currentEx)` still returns a slug string, but the section itself has `display:none` because the image 404s and `onerror` fires). Confirm no console errors, no broken-image icon ever flashes.

**To confirm the success path** without waiting for real poster art: temporarily drop any small test PNG at `assets/gym/hack-squat.png`, reload, select Hack Squat (Legs A day) in the Log tab. Confirm the poster section becomes visible, collapsed by default. Tap the "Form Reference" header — confirm it expands (chevron rotates, image shows). Tap the image — confirm the full-size lightbox opens; tap outside the image — confirm it closes. Delete the test PNG afterward (it's not part of this plan's deliverable).

- [ ] **Step 5: Commit**

```bash
git add gym.html
git commit -m "feat(gym): render poster per selected exercise/variant, expand + lightbox"
```

---

### Task 6: Final pass

- [ ] **Step 1: Full manual walkthrough**

With the dev server still running, click through several exercises across all 5 days (Push/Pull/Legs A/Upper/Legs B) and confirm: Cues section still renders correctly and independently of the poster section, switching a substitution variant via the "Alt" picker doesn't throw errors, the Progress tab and other existing features (warm-up, rest timer, coach) are unaffected.

- [ ] **Step 2: Push**

```bash
git push
```

(Per standing instructions, commit + push is default-on once a logical unit of work is done.)

---

## Follow-up (separate session, not part of this plan)

Generate the 100 poster `.png` files at `assets/gym/<slug>.png`, batched by day per the spec (Push → Pull → Legs A → Upper → Legs B, using each day's primaries and their `subs[]` names from `defaultExercises`, deduping names shared across days). No code changes needed — each image just needs to land in `assets/gym/` with the matching slug filename and the poster section will pick it up automatically.
