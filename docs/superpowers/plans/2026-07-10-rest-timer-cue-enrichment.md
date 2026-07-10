# Rest Timer + Cue Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rest timer that auto-starts after logging a set (with a muscle-specific squeeze/pose reminder), and enrich each of the 34 `DEFAULT_CUES` entries with a tempo/squeeze/stretch cue — both sourced from Carl's existing `03 - Bodybuilding/Exercise Cues/` vault notes.

**Architecture:** A new `MUSCLE_PRIMARY` static lookup (same pattern as `DEFAULT_CUES`) drives the reminder text. A new `startRestTimer(ex)` function runs a plain `setInterval` countdown, rendering into a new sticky banner at the top of the Log tab. Hooked into the existing `logBtn` click handler, right after a set is successfully logged. `DEFAULT_CUES` gets one new line appended to each of its 34 arrays.

**Tech Stack:** Plain HTML/CSS/JS in `gym.html`, no build step, no framework.

---

### Task 1: `MUSCLE_PRIMARY` lookup + cue enrichment

**Files:**
- Modify: `gym.html:4158-4193` (the `DEFAULT_CUES` object — add a 4th line to every entry)
- Modify: `gym.html` (add new `MUSCLE_PRIMARY` object right after `DEFAULT_CUES`, before `getCues()`)

- [ ] **Step 1: Add the 4th cue line to every `DEFAULT_CUES` entry**

Find the full `DEFAULT_CUES` object (`gym.html:4158-4193`) and replace it with (every array gains one new line, sourced from that exercise's vault note — form cues/science sections already establish these; this makes the tempo explicit and consistent):

```javascript
  const DEFAULT_CUES = {
    'Neutral Grip Shoulder Press Machine':    ['Elbows in, arch chest up toward ceiling','Deltoid drives — no trap elevation','Full ROM to stretched bottom','2-3 sec eccentric, full stretch at bottom, no trap shrug at top'],
    'Smith Machine Flat Chest Press':         ['Bar to lower sternum','Elbows 45–60° from torso','Full stretch at bottom','2-3 sec eccentric, full stretch at bottom, squeeze pecs at top'],
    'Chest Dip':                              ['Lean forward = chest bias','Controlled 2–3 sec descent','Stop at full pec stretch — no shoulder roll','2-3 sec descent, full pec stretch at bottom, squeeze at top'],
    'Incline Cable Pec Fly':                  ['Arms travel fully back into stretch','Constant movement — not static at top','Don\'t clap handles','Full stretch at bottom (arms back), squeeze without clapping at top'],
    'Dumbbell Lateral Raise':                 ['Slight forward lean, lead with elbows','Stop at shoulder height — above = traps','No momentum','2 sec controlled eccentric, full stretch at bottom, no pause at top'],
    'Cable Front Raise':                      ['Cable from below = constant tension','Strict — no body swing','Shoulder height only','Strict controlled tempo, brief squeeze at shoulder height'],
    'Cable Triceps Overhead Extension':       ['Elbows fixed and close to head','Full extension + full stretch every rep','Elbows flare = drop the weight','Full overhead stretch at bottom, 2-3 sec eccentric, squeeze at full extension'],
    'Lat Pulldown':                           ['Depress scapulae before pulling','Elbows flared wide and out','Full arm extension at top','Full overhead stretch, 2-3 sec controlled return, squeeze scapula at peak contraction'],
    'Cable Seated Row (Neutral Grip)':        ['Lean forward to stretch, sit up to contract','Elbows to wall behind you','Full stretch every rep','Lean into full stretch each rep, 2-3 sec eccentric, squeeze elbows back at contraction'],
    'Machine High Row':                       ['Chest on pad throughout','Arms fully extend overhead at top','Elbows wide and down on pull','Full overhead stretch, 2-3 sec eccentric, squeeze at full contraction'],
    'Machine Low Row':                        ['Full arm extension at start — get the stretch','Retract scapulae before pulling','Elbows in close to body','Full stretch at start, 2-3 sec eccentric, squeeze elbows back at contraction'],
    'Cable Lat Pushdown/Pullover':            ['Arms mostly straight — not a row','Lats pull arms to back pockets','Full overhead stretch at top','Full overhead stretch every rep, 2-3 sec eccentric, squeeze lats at bottom'],
    'Cable Rear Delt Fly':                    ['Arms stay at shoulder height','Shoulder joint moves — not elbow','Light weight — no body swing','Reach into stretch at start, 2 sec eccentric, squeeze at rear every rep'],
    'Seated Behind-the-Back Cable Curl':      ['Elbow stays pinned back','Arm behind body = long head stretch','Slow controlled eccentric','Full stretch behind body, 3 sec eccentric, squeeze at top of curl'],
    'Hack Squat':                             ['Full depth — parallel or below','Drive through mid-foot','Don\'t let hips shoot back','Full depth for quad stretch, 2-3 sec eccentric, continuous tension — no lockout pause'],
    'Sissy Leg Press':                        ['Deep knee flexion = quad stretch','Don\'t half rep — stretch at bottom is the point','No lockout at top','3 sec eccentric into deep stretch, no lockout at top, continuous tension'],
    'Seated Hamstrings Curl':                 ['Full extension at bottom — get the stretch','Control eccentric back to start','Hip flexion = longer ham = more growth','Full stretch at bottom every rep, 2-3 sec eccentric, squeeze at full contraction'],
    'Dumbbell B-Stance RDL':                  ['Push hips back — not down','Feel hamstring fully stretch before reversing','Back foot is just a kickstand','Full hamstring stretch before reversing, 2-3 sec eccentric, squeeze glutes at lockout'],
    'Hip Adduction Machine':                  ['Full ROM in stretch — don\'t shortcut','Controlled return to full open','No torso crunch to assist','Full stretch at open position, controlled eccentric, squeeze hard at closed position'],
    'Standing Calf Raise':                    ['Full heel drop — no partials','2–3 sec eccentric, pause at bottom','Straight leg = gastroc','Full heel-drop stretch, 2-3 sec eccentric, pause + squeeze at top'],
    'Dumbbell Incline Chest Press':           ['30–45° bench only — above = front delt','Elbows 45–60° from torso','Lower to full upper pec stretch','Full stretch at bottom (elbows below shoulder), 2-3 sec eccentric, squeeze pecs at top'],
    'Chest Supported T-Bar Row':              ['Elbows at 45° from body','Chest stays on pad — don\'t peel off','Full extension at bottom','Full stretch at bottom, 2-3 sec eccentric, squeeze scapulae at top'],
    'Smith Machine Narrow Grip Bench':        ['Grip shoulder-width, elbows in close','Bar to lower chest','Triceps drive — not pecs','Full extension lockout at top, 2-3 sec eccentric, bar to lower chest for full stretch'],
    'Neutral Grip Lat Pulldown':              ['Full overhead arm extension at top','Elbows tuck in and drive down','Bar to clavicle','Full overhead stretch, 2-3 sec eccentric, squeeze at bottom of pull'],
    'Low Cable Lateral Raise':                ['Lead with elbow, stop at shoulder height','Lean slightly away from stack','Pinky slightly up at top','2 sec controlled eccentric, full stretch at bottom, brief pause at shoulder height'],
    'Dumbbell Front Raise':                   ['Strict — no body swing','Shoulder height only','Light weight, clean execution','Strict controlled tempo, brief pause at shoulder height, full stretch at bottom'],
    'Machine Preacher Curl':                  ['Full extension at bottom — don\'t cut','Slow eccentric','Squeeze hard at top','Full stretch at bottom, 3 sec controlled eccentric, squeeze hard at top'],
    'Cable Triceps Pushdown':                 ['Elbows pinned to sides','Only forearms move','Full extension at bottom','Full extension/squeeze at bottom, 2-3 sec eccentric, elbows pinned throughout'],
    'Smith Machine RDL':                      ['Push hips back — not a squat','Bar slides down legs','Feel hamstring fully stretch','Full hamstring stretch before reversing, 2-3 sec eccentric, squeeze glutes at lockout'],
    'Lying Hamstrings Curl':                  ['Full extension at bottom','Don\'t lift hips — weight too heavy','Toes slightly dorsiflexed','Full stretch at bottom every rep, controlled eccentric, squeeze at full contraction'],
    'Cybex Leg Press':                        ['Full depth — feel the quad stretch','Drive through mid-foot','Don\'t lock out at top','Full depth for quad stretch, 2-3 sec eccentric, no lockout — continuous tension'],
    'Dumbbell Heel Elevated Lunge':           ['Heel elevation = more quad','Front knee tracks over second toe','Full depth','Full depth for quad stretch, 2-3 sec eccentric, working leg drives — no back-leg assist'],
    'Leg Extension':                          ['Full extension at top','Controlled slow descent','Toes: straight=overall, in=outer, out=VMO','Full extension/squeeze at top, controlled slow eccentric, no crash at bottom'],
    'Seated Calf Raise':                      ['Full heel drop — no partials','2–3 sec eccentric, pause at bottom','Bent knee = soleus','Full heel-drop stretch, 2-3 sec eccentric, pause + squeeze at top'],
  };

  const MUSCLE_PRIMARY = {
    'Neutral Grip Shoulder Press Machine':    'front delts',
    'Smith Machine Flat Chest Press':         'chest',
    'Chest Dip':                              'chest',
    'Incline Cable Pec Fly':                  'upper chest',
    'Dumbbell Lateral Raise':                 'side delts',
    'Cable Front Raise':                      'front delts',
    'Cable Triceps Overhead Extension':       'triceps',
    'Lat Pulldown':                           'lats',
    'Cable Seated Row (Neutral Grip)':        'lats and mid-back',
    'Machine High Row':                       'upper lats',
    'Machine Low Row':                        'lower lats and mid-back',
    'Cable Lat Pushdown/Pullover':            'lats',
    'Cable Rear Delt Fly':                    'rear delts',
    'Seated Behind-the-Back Cable Curl':      'biceps',
    'Hack Squat':                             'quads',
    'Sissy Leg Press':                        'quads',
    'Seated Hamstrings Curl':                 'hamstrings',
    'Dumbbell B-Stance RDL':                  'hamstrings and glutes',
    'Hip Adduction Machine':                  'inner thigh',
    'Standing Calf Raise':                    'calves',
    'Dumbbell Incline Chest Press':           'upper chest',
    'Chest Supported T-Bar Row':              'upper back',
    'Smith Machine Narrow Grip Bench':        'triceps',
    'Neutral Grip Lat Pulldown':              'lats',
    'Low Cable Lateral Raise':                'side delts',
    'Dumbbell Front Raise':                   'front delts',
    'Machine Preacher Curl':                  'biceps',
    'Cable Triceps Pushdown':                 'triceps',
    'Smith Machine RDL':                      'hamstrings and glutes',
    'Lying Hamstrings Curl':                  'hamstrings',
    'Cybex Leg Press':                        'quads',
    'Dumbbell Heel Elevated Lunge':           'quads',
    'Leg Extension':                          'quads',
    'Seated Calf Raise':                      'calves',
  };
```

- [ ] **Step 2: Commit**

```bash
git add gym.html
git commit -m "feat(gym): enrich cues with tempo/squeeze lines, add MUSCLE_PRIMARY lookup"
```

---

### Task 2: Rest timer markup + CSS

**Files:**
- Modify: `gym.html:2457-2458` (insert the timer banner right before the "Log a set" section)
- Modify: `gym.html` `<style>` block (add new rules near the `.po-cues-section` rules)

- [ ] **Step 1: Add the timer banner markup**

Find (around line 2457-2458):
```html
    <!-- Log a set -->
    <div class="po-sub-section" id="logFormWrap">
```

Replace with (adds the banner as its own section, right before "Log a set"):
```html
    <!-- Rest Timer — auto-starts after logging a set -->
    <div class="po-rest-timer" id="restTimerBar" style="display:none">
      <span class="po-rest-timer-count" id="restTimerCount">0:00</span>
      <span class="po-rest-timer-msg" id="restTimerMsg"></span>
      <div class="po-rest-timer-actions">
        <button type="button" class="po-rest-timer-adj" data-delta="-15">-15s</button>
        <button type="button" class="po-rest-timer-adj" data-delta="15">+15s</button>
        <button type="button" class="po-rest-timer-dismiss" id="restTimerDismiss">Skip</button>
      </div>
    </div>

    <!-- Log a set -->
    <div class="po-sub-section" id="logFormWrap">
```

- [ ] **Step 2: Add the CSS**

Find the `.po-cues-section` rule (search `.po-cues-section {`) and add these new rules directly before it:

```css
.po-rest-timer {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: linear-gradient(165deg, rgba(16,26,22,.55) 0%, rgba(7,12,10,.40) 100%);
  border: 1px solid rgba(110, 231, 183, 0.30);
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 14px;
}
.po-rest-timer-count {
  font-family: var(--font-mono); font-size: 20px; font-weight: 700;
  color: var(--good); font-variant-numeric: tabular-nums;
}
.po-rest-timer-msg {
  font-size: 13px; color: var(--text-2); flex: 1; min-width: 140px;
}
.po-rest-timer-actions { display: flex; gap: 6px; }
.po-rest-timer-adj, .po-rest-timer-dismiss {
  font-family: var(--font-mono); font-size: 11px; font-weight: 700;
  padding: 6px 10px; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
  color: var(--text-2);
}
.po-rest-timer-adj:hover, .po-rest-timer-dismiss:hover { background: rgba(255,255,255,0.10); }
```

- [ ] **Step 3: Commit**

```bash
git add gym.html
git commit -m "feat(gym): add rest timer banner markup + CSS (not yet wired)"
```

---

### Task 3: Rest timer logic

**Files:**
- Modify: `gym.html` (add `startRestTimer()`, `stopRestTimer()`, `restTimerMessage()` functions near `getCues()`/`renderCues()`, ~line 4195-4223)
- Modify: `gym.html:4420-4456` (`logBtn` click handler — call `startRestTimer(ex)` after a successful log)
- Modify: `gym.html` (wire the +/-15s and Skip buttons)

- [ ] **Step 1: Add the timer functions**

Find (around line 4207, right before `function renderCues(ex) {`):
```javascript
  function renderCues(ex) {
```

Insert these three new functions right before it:
```javascript
  let restTimerInterval = null;
  let restTimerRemaining = 0;

  function restTimerMessage(ex) {
    const muscle = MUSCLE_PRIMARY[ex.name] || 'the target muscle';
    return 'Squeeze your ' + muscle + ' — hold the peak contraction.';
  }

  function updateRestTimerDisplay() {
    const mins = Math.floor(restTimerRemaining / 60);
    const secs = restTimerRemaining % 60;
    $('restTimerCount').textContent = mins + ':' + String(secs).padStart(2, '0');
  }

  function stopRestTimer() {
    if (restTimerInterval) { clearInterval(restTimerInterval); restTimerInterval = null; }
    $('restTimerBar').style.display = 'none';
  }

  function startRestTimer(ex) {
    stopRestTimer();
    const repMin = parseInt(ex.repMin, 10) || 8;
    restTimerRemaining = repMin <= 6 ? 150 : 75; // heavy (repMin 4-8) = 2:30, isolation (8-16) = 1:15
    $('restTimerMsg').textContent = restTimerMessage(ex);
    $('restTimerBar').style.display = 'flex';
    updateRestTimerDisplay();
    restTimerInterval = setInterval(function() {
      restTimerRemaining--;
      if (restTimerRemaining <= 0) { stopRestTimer(); return; }
      updateRestTimerDisplay();
    }, 1000);
  }

  function renderCues(ex) {
```

- [ ] **Step 2: Hook into the log-set flow**

Find (around line 4438-4446):
```javascript
    const dateKey = getChipDate('logDateInput');
    const isoDate = new Date(dateKey + 'T12:00:00').toISOString();
    const arr = state.logs[ex.id] || [];
    arr.push(Object.assign({ weight: w, reps: reps, date: isoDate }, entry));
    arr.sort((a, b) => a.date.localeCompare(b.date));
    state.logs[ex.id] = arr;
    if (plateMode) { plateCounts = {}; updatePlateUI(); }
    resetChipToToday('logDateChip', 'logDateInput');
    saveState(); renderAll();
```

Replace with (adds one call, right after the log succeeds):
```javascript
    const dateKey = getChipDate('logDateInput');
    const isoDate = new Date(dateKey + 'T12:00:00').toISOString();
    const arr = state.logs[ex.id] || [];
    arr.push(Object.assign({ weight: w, reps: reps, date: isoDate }, entry));
    arr.sort((a, b) => a.date.localeCompare(b.date));
    state.logs[ex.id] = arr;
    if (plateMode) { plateCounts = {}; updatePlateUI(); }
    resetChipToToday('logDateChip', 'logDateInput');
    startRestTimer(ex);
    saveState(); renderAll();
```

- [ ] **Step 3: Wire the +/-15s and Skip buttons**

Find (around line 4456-4458, right after the `logBtn` handler's closing `});`):
```javascript
  });

  $('undoBtn').addEventListener('click', () => {
```

Insert between them:
```javascript
  });

  document.querySelectorAll('.po-rest-timer-adj').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!restTimerInterval && restTimerRemaining <= 0) return;
      restTimerRemaining = Math.max(0, restTimerRemaining + parseInt(btn.dataset.delta, 10));
      updateRestTimerDisplay();
    });
  });
  $('restTimerDismiss').addEventListener('click', stopRestTimer);

  $('undoBtn').addEventListener('click', () => {
```

- [ ] **Step 4: Commit**

```bash
git add gym.html
git commit -m "feat(gym): wire up rest timer — auto-start, adjustable, muscle-specific reminder"
```

---

### Task 4: Manual verification in the browser preview

**Files:** none (verification only)

- [ ] **Step 1: Start the preview server**

Use the `row` launch config (`npx serve -l 5555 C:/Users/gregm/row`) already registered in `.claude/launch.json`.

- [ ] **Step 2: Confirm cues show the 4th line**

Navigate to gym.html, select an exercise with a known name (e.g. Lat Pulldown), check `#cuesList` via `read_page`/eval — confirm 4 `.po-cue-item` entries, the 4th being the new tempo/squeeze cue.

- [ ] **Step 3: Log a set, confirm the timer auto-starts**

Pick reps + weight, click `#logBtn`. Via eval, confirm `#restTimerBar` has `display:flex`, `#restTimerCount` shows a starting value matching the exercise's `repMin` (2:30 for repMin ≤6, 1:15 for repMin >6), and `#restTimerMsg` contains the exercise's `MUSCLE_PRIMARY` value.

- [ ] **Step 4: Confirm the countdown ticks down**

Wait ~3 seconds (real wall-clock, not tool-side), re-check `#restTimerCount` — confirm it decreased by roughly that amount.

- [ ] **Step 5: Confirm +/-15s and Skip work**

Click `.po-rest-timer-adj[data-delta="15"]`, confirm the displayed time increased by 15s. Click `#restTimerDismiss`, confirm `#restTimerBar` returns to `display:none`.

- [ ] **Step 6: Confirm no console errors**

Check `preview_console_logs`/`read_console_messages` for errors across all the above.

- [ ] **Step 7: Stop the preview server**

No commit needed — verification only. Fix inline and re-run the specific failing step if anything fails.

---

### Task 5: Push directly to `main`

**Files:** none

- [ ] **Step 1: Push**

```bash
git push origin main
```

Small and additive, same pattern as the graph-modal plan — no feature branch needed. Run `/code-review` first if a review pass is wanted.
