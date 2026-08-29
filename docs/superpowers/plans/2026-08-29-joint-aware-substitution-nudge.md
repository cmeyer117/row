# Joint-Aware Substitution Nudge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visually flag an exercise's existing "Alt" button when its muscle group maps to a joint currently flagged by Row's existing pain-tracking flare-up detector, so a real substitution opportunity (catalog + detector both already exist) actually surfaces instead of requiring Carl to notice and act on his own.

**Architecture:** One new lookup table (`MUSCLE_TO_JOINTS`) and one new derived value (`flaggedJoint`) inside the existing `renderWorkoutList()` function, both in `gym.html`. Reuses `jointPainCountInWindow()` (already exists, already used by `anyJointFlagged()`) rather than adding new pain-tracking logic. Extends the existing Alt-button branch with a conditional CSS class and title attribute — no new DOM elements, no new click handlers, no change to `openSubPicker()` or the picker modal itself.

**Tech Stack:** Vanilla JS, inline in a static HTML page, no build step, no framework, no existing test harness for this class of logic.

---

## File Structure

- **Modify `gym.html`** only — single file, matching how every related piece of this feature (pain tracking, flare-up detection, substitution catalog, Alt button) already lives in this one file. No new files: the codebase's own convention for logic this small and single-use is to keep it inline (confirmed this session with the sibling Evening Examen mood-inference fix in the `vessel` repo, which stayed in its one host file rather than being extracted).

---

### Task 1: `MUSCLE_TO_JOINTS` lookup table

**Files:**
- Modify: `gym.html:3949-3951` (insert after `anyJointFlagged()`)

- [ ] **Step 1: Add the lookup table**

In `gym.html`, immediately after the existing `anyJointFlagged()` function (currently lines 3949-3951, right before the `WARMUP DATA` section divider comment), add:

```js
  // Maps each exercise's `muscle` field to the joint(s) it stresses, so a
  // flagged joint (jointPainCountInWindow above) can be connected to which
  // exercises on today's list might warrant a substitution. Deliberately
  // does NOT cover every muscle value in the catalog -- Glutes (Hip
  // Extension, Hip Adduction) and Calves (Calf Raise) exercises here are
  // hip- and ankle-dominant respectively, and anyJointFlagged only ever
  // tracks shoulder/elbow/knee. Mapping either to a tracked joint would be
  // a false positive, not a real signal -- confirmed against the real
  // exercise names in defaultExercises, not guessed. See
  // docs/superpowers/specs/2026-08-29-joint-aware-substitution-nudge-design.md.
  const MUSCLE_TO_JOINTS = {
    Chest: ['shoulder', 'elbow'],
    Shoulders: ['shoulder'],
    Triceps: ['elbow'],
    Back: ['shoulder', 'elbow'],
    Biceps: ['elbow'],
    Quads: ['knee'],
    Hamstrings: ['knee'],
  };
```

- [ ] **Step 2: Verify placement with a syntax check**

Run (Bash, from `C:\Users\gregm\row`):

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('gym.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => {
  try { new Function(s); console.log('script block', i, 'OK'); }
  catch (e) { console.log('script block', i, 'SYNTAX ERROR:', e.message); }
});
"
```

Expected: every classic (non-`type="module"`) script block reports OK. If `gym.html` has a `type="module"` block, that one will legitimately fail this specific check (`new Function()` can't parse ES `import`/`export` syntax) — that failure is expected and unrelated, not a sign this task broke anything. Confirm which block index corresponds to the classic script containing `MUSCLE_TO_JOINTS` (search the block's content for `'MUSCLE_TO_JOINTS'` if unsure which index it is) and confirm that specific one reports OK.

- [ ] **Step 3: Manual trace of the table itself**

Confirm by inspection: every muscle value that exists anywhere in `defaultExercises` (`Back`, `Biceps`, `Calves`, `Chest`, `Glutes`, `Hamstrings`, `Quads`, `Shoulders`, `Triceps` — the full set, already enumerated in the design spec from a live grep) either appears as a key in `MUSCLE_TO_JOINTS` or is deliberately absent (`Glutes`, `Calves`). No muscle value should be missing by omission rather than deliberate choice.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "feat: add MUSCLE_TO_JOINTS lookup for the substitution nudge"
```

---

### Task 2: `flaggedJoint` derivation in `renderWorkoutList()`

**Files:**
- Modify: `gym.html:4292` (alongside the existing `hasSubs` line)

- [ ] **Step 1: Add the derivation**

In `gym.html`, inside `renderWorkoutList()`, the existing line (currently 4292):

```js
      const hasSubs  = Array.isArray(ex.subs) && ex.subs.length > 0;
```

Add immediately after it:

```js
      const joints = MUSCLE_TO_JOINTS[ex.muscle] || [];
      const flaggedJoint = joints.find(function (j) { return jointPainCountInWindow(j, 7) >= 2; });
```

(Matches the existing file's function-expression style for callbacks, e.g. `anyJointFlagged()`'s `.some(function (j) {...})`, rather than introducing an arrow function into a section of the file that doesn't use them.)

- [ ] **Step 2: Manual trace against the 5 cases from the spec's Testing section**

Trace through the logic by hand (no test harness exists for this file's rendering logic — this replaces an automated test, it is not optional):

1. **Quads exercise, knee flagged** (2+ `jointPain` entries with `joint: 'knee'` within the last 7 days): `joints = ['knee']`, `jointPainCountInWindow('knee', 7) >= 2` is true → `flaggedJoint === 'knee'`. Correct.
2. **Quads exercise, knee NOT flagged** (0-1 entries): `joints = ['knee']`, the `.find()` predicate is false for `'knee'` → `flaggedJoint === undefined`. Correct.
3. **Glutes exercise, knee flagged**: `MUSCLE_TO_JOINTS['Glutes']` is `undefined`, so `joints = []` (the `|| []` fallback), `.find()` on an empty array is always `undefined` → `flaggedJoint === undefined` regardless of any flagged joint. Correct — Glutes deliberately has no mapping.
4. **Chest exercise, shoulder flagged but elbow not**: `joints = ['shoulder', 'elbow']`, `.find()` checks in array order, `'shoulder'` matches first → `flaggedJoint === 'shoulder'`. Correct (first match wins; both being flagged would still just report the first, which is an acceptable simplification for a single-word title-attribute label — not incorrect, just not exhaustive, and the spec doesn't ask for multi-joint reporting).
5. **Exercise with no `subs`, joint flagged**: `flaggedJoint` computation is independent of `hasSubs` and would still compute a value, but Task 3 gates the visible change on `hasSubs && !isAdhoc` exactly as today — an exercise with no subs never shows an Alt button at all, flagged or not, so this case produces no visible change. Correct.

- [ ] **Step 3: Syntax check**

Re-run the same `node -e` check from Task 1 Step 2. Expected: the classic script block still reports OK.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "feat: derive flaggedJoint per exercise in renderWorkoutList"
```

---

### Task 3: Extend the Alt button and add flagged CSS

**Files:**
- Modify: `gym.html:4322-4335` (Alt button branch)
- Modify: `gym.html:2015-2029` (CSS, insert after `.wl-alt-btn:hover`)

- [ ] **Step 1: Extend the Alt button branch**

In `gym.html`, the existing Alt-button code (currently lines 4322-4335):

```js
      const altEl = document.createElement('button');
      altEl.type = 'button';
      if (hasSubs && !isAdhoc) {
        altEl.className = 'wl-alt-btn';
        altEl.textContent = 'Alt';
        altEl.addEventListener('click', e => {
          e.stopPropagation();
          openSubPicker(ex.id);
        });
      } else {
        altEl.style.visibility = 'hidden';
        altEl.style.pointerEvents = 'none';
        altEl.className = 'wl-alt-btn';
```

Change the `if (hasSubs && !isAdhoc)` block to (using literal `⚠` and em-dash characters directly, matching `gym.html:6920`'s existing convention of writing these characters literally rather than as `\u` escapes):

```js
      const altEl = document.createElement('button');
      altEl.type = 'button';
      if (hasSubs && !isAdhoc) {
        altEl.className = flaggedJoint ? 'wl-alt-btn wl-alt-btn--flagged' : 'wl-alt-btn';
        altEl.textContent = flaggedJoint ? 'Alt ⚠' : 'Alt';
        if (flaggedJoint) {
          altEl.title = flaggedJoint + ' flagged — 2+ times in the last 7 days';
        }
        altEl.addEventListener('click', e => {
          e.stopPropagation();
          openSubPicker(ex.id);
        });
      } else {
        altEl.style.visibility = 'hidden';
        altEl.style.pointerEvents = 'none';
        altEl.className = 'wl-alt-btn';
```

- [ ] **Step 2: Add the flagged CSS**

In `gym.html`, immediately after the existing `.wl-alt-btn:hover` rule (currently lines 2027-2031):

```css
.wl-alt-btn:hover {
  color: var(--text-1);
  border-color: rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.04);
}
```

Add:

```css
.wl-alt-btn--flagged {
  border-color: var(--warn);
  color: var(--warn);
}
.wl-alt-btn--flagged:hover {
  background: rgba(255,255,255,0.04);
}
```

- [ ] **Step 3: Manual trace of the rendered output**

Trace the two visible outcomes:

1. `hasSubs === true`, `isAdhoc === false`, `flaggedJoint === 'knee'` → button class `"wl-alt-btn wl-alt-btn--flagged"`, text `"Alt ⚠"`, `title="knee flagged — 2+ times in the last 7 days"`, click still calls `openSubPicker(ex.id)` unchanged.
2. `hasSubs === true`, `isAdhoc === false`, `flaggedJoint === undefined` → button class `"wl-alt-btn"` (unchanged from before this plan), text `"Alt"` (unchanged), no `title` set, click behavior unchanged. Confirms the no-flag case is byte-for-byte identical to current production behavior.

- [ ] **Step 4: Syntax check**

Re-run the same `node -e` check. Expected: the classic script block still reports OK.

- [ ] **Step 5: Live verification**

This change is visually observable (a real UI element changes appearance). Per this session's own verification workflow: open `gym.html` in the Browser pane (via `preview_start` with a `url` pointing at wherever Row's local/dev instance is reachable, or the deployed `row-sage.vercel.app` if no local dev server is running for this repo), and confirm:

- An exercise with real `subs` and no flagged joint shows a plain `"Alt"` button, unchanged from before.
- If real `jointPain` data exists for a tracked joint in the account being viewed, an exercise whose `muscle` maps to that joint shows `"Alt ⚠"` styled with the `--warn` color, and hovering shows the title tooltip naming the joint.

If no real flagged-joint data exists in the account to observe case 2 live (matches this session's earlier finding — Row's `jointPain` array was empty when checked), this is an acceptable, disclosed gap in live coverage: the manual traces in Steps 3 and Task 2 Step 2 already prove the logic correctly, and forcing fake pain-log data into a real account's Supabase state just to screenshot a warning color is disproportionate to what this step needs to prove. State plainly which case was and wasn't visually confirmed rather than claiming both were.

- [ ] **Step 6: Commit**

```bash
cd C:\Users\gregm\row
git add gym.html
git commit -m "feat: flag the Alt button when its muscle maps to a currently-flagged joint"
```

---

### Task 4: Final review and push

**Files:** none (verification and process only)

- [ ] **Step 1: Full re-read of the diff**

```bash
cd C:\Users\gregm\row
git diff e786c67..HEAD -- gym.html
```

Read the complete diff in one pass — small enough (roughly 20-30 changed lines across 3 spots) to review as a whole rather than piecemeal per-task, catching anything the incremental task-by-task view might miss (e.g. whether the CSS insertion point actually landed next to `.wl-alt-btn:hover` as intended, not accidentally inside an unrelated rule due to a line-number shift from an earlier task's edit).

- [ ] **Step 2: Review-before-push checkpoint**

Same posture as every other build this session: this is a small, single-file, no-new-dependency, no-paid-cost change. Ask whether a luna Codex diff review is wanted before pushing, same as was asked (and accepted) for the smaller-scoped Examen mood fix earlier this session — do not assume the answer either way from this plan alone.

- [ ] **Step 3: Push**

```bash
cd C:\Users\gregm\row
git push origin main
```

Note: this repo's default branch is `main`, not `master` — confirmed via `git branch --show-current` during this plan's own writing. Row's Vercel deployment is git-integrated (confirmed working reliably in prior sessions), so no separate manual deploy step is expected — but confirm the live site actually updates (e.g. a quick `curl -s -o /dev/null -w "%{http_code}\n" https://row-sage.vercel.app/gym.html` for a reachability check, or re-open the Browser pane on the deployed URL) rather than assuming git-integrated deploy always succeeds silently.

---

## Plan self-review notes

- **Spec coverage:** the `MUSCLE_TO_JOINTS` table (Task 1) matches the spec's table exactly, including the Glutes/Calves omission and its rationale. The `flaggedJoint` derivation (Task 2) matches the spec's exact code. The Alt-button extension and CSS (Task 3) match the spec's exact design (class name, text change, title attribute, `--warn` reuse). All 5 of the spec's Testing-section cases appear as explicit traced cases (4 in Task 2 Step 2, the 5th — no-subs-exercise — folded into Task 2 Step 2 case 5 since it's really about `hasSubs`, not `flaggedJoint`, but the spec listed it under Testing so it's covered explicitly rather than assumed). Explicitly-out-of-scope items from the spec (equipment-occupied, auto-opening the picker, expanding tracked joints, touching `anyJointFlagged`/warmup behavior) all match this plan's tasks — no task does any of them.
- **Placeholder scan:** none found.
- **Type consistency:** `MUSCLE_TO_JOINTS`, `flaggedJoint`, and `joints` are named identically everywhere they're referenced across Tasks 1-3. The CSS class name `wl-alt-btn--flagged` matches between Task 3's JS (`altEl.className`) and its CSS insertion.
- **Verification proportionality:** Task 3 Step 5 (live verification) is included because this change is genuinely browser-observable (a real UI element's appearance changes), per this session's own standing rule to verify UI changes rather than only unit-trace them — but it also explicitly allows for one real case (the flagged-button appearance) to go unconfirmed live if no real flagged-joint data exists to observe, rather than silently skipping verification or fabricating test data in a real account just to force a screenshot.
- **Caught during self-review, fixed before finalizing:** the initial draft wrote the ⚠ character and em dash as `\u` escapes in the code samples, then explained in prose that literal characters should be used instead — an internal contradiction between the shown code and the stated intent. Fixed by writing the literal characters directly in the code samples themselves, confirmed against `gym.html:6920`'s real existing usage of the same `⚠` character written literally.
