# Morning Launch Redesign — Voice-First Manifestation Ritual

**Date:** 2026-08-13
**Status:** Approved by Carl

## Problem

The existing Morning Launch (`docs/superpowers/specs/2026-08-05-row-morning-launch-design.md`, shipped and live) is a solid, evidence-based 4-phase ritual (Clear → Align → Visualize → Commit) — but it reads and feels like a form: typed fields, a small per-field mic icon, clinical prompt copy. Carl wants it to feel like an actual morning manifestation practice — relaxing, voice-led, more explicitly built around visualizing the day's success — while staying grounded in real evidence rather than drifting into unfounded claims.

## Decision

Redesign the ritual's phase structure, interaction model, and copy; keep its proven data-layer conventions (Supabase `app_state` sync, the existing `morning_launch:<date>` record shape, extended not replaced) and its underlying research base (goal-setting theory, process simulation, mental contrasting/WOOP, implementation intentions), adding one new evidence-adjacent element: felt-sense future-self rehearsal, sourced from the vault's own Manifestation folder with its existing critical-review guardrails applied (the practice, never Dispenza's quantum-physics explanation of why it works).

**Explicitly considered and rejected:** a "two-track" design keeping the old form-based flow as a fast-mode alongside the new one (rejected — doubles the surface for no real benefit, dilutes the actual ask); a fully-produced guided-audio experience closer to a meditation app (rejected for v1 — meaningfully bigger build, higher risk of a rough first pass, revisit later if this version proves the concept).

## Evidence base

Existing citations carry over unchanged (Locke & Latham goal-setting theory, Pham & Taylor process-vs-outcome simulation, Wang/Wang/Gai WOOP meta-analysis, Sheeran/Listrom/Gollwitzer implementation-intention meta-analysis, Harkin et al. progress-monitoring meta-analysis — see the original design doc for links).

**New for this redesign**, from `Carl Meyer/05 - Faith & Philosophy/Manifestation/`:
- [[The Daily Protocol — Five Moves, Not a Philosophy]] — the vault's own synthesis across McGregor, Phelps/Bowman, Dispenza, Proctor, Swart, Senna, Csikszentmihalyi, and Kotler. Provides the five-move shape this redesign's phases now follow: build the videotape (with an explicit "something goes wrong and you handle it" beat, not just success); run it with elevated emotion; speak it aloud, not just think it; engineer flow deliberately; check the goal against an abundance-vs-fear filter.
- [[Joe Dispenza — The Morning and Evening Rehearsal]] and [[Joe Dispenza — What's Evidence-Based and What Isn't]] — the second note is the vault's own critical-review counterweight, already reviewed and corrected via a Codex triangulation pass (2026-08-05). Its standing application rule is the one this redesign follows exactly: *"Separate the practice from Dispenza's explanation of why it works — morning visualization with genuine emotional engagement may be worth doing on modest imagery-training and placebo-adjacent grounds, with no need to accept the quantum-consciousness framing."* The new Rehearse phase (below) implements the practice only — no energy-center, quantum-field, or theta-state language anywhere in the shipped copy.
- [[Tara Swart — The Two Brain Mechanisms Behind Manifestation]] — informs Rehearse's framing (a neuroscientist's version of why visualization + emotion can prime attention/behavior, without the pseudoscience).

## Phase structure

Five phases, replacing the current four. Each is voice-first (see Interaction Model): the app speaks the prompt via TTS, listens for the answer, shows an editable transcript before advancing.

1. **Settle** (~1-2 min, replaces "Clear") — same brain-dump purpose (get what's occupying your mind out before continuing), reframed as a grounding moment rather than a task: *"Before anything else — what's on your mind this morning?"* Stored field unchanged (`brainDump`).

2. **Align** (~2-3 min, unchanged science) — recall the 5 current outcomes from memory, then Row reveals the saved set for comparison, then pick today's focus outcome. Same mechanics as today, voice-first delivery.

3. **Rehearse** (~5-8 min, merges "Visualize" + new felt-sense rehearsal) — two parts in sequence:
   - **Process** (existing): what does doing the work successfully look like; what's the likely internal obstacle; if that happens, what exactly will you do. Rendered as the existing if-then sentence.
   - **Feel it** (new): a felt-sense, present-tense rehearsal of the day going well — explicitly including the moment something goes wrong and how you handle it without flinching (the Daily Protocol synthesis's own framing of what separates disciplined rehearsal from wishful thinking). Practice only, no energy/quantum framing in any copy.

4. **Commit** (~4-7 min, unchanged mechanics) — 3 needle movers, one win condition, voice-first entry, same Today-list linking as today.

5. **Speak It** (~1 min, new) — the Daily Protocol's "speak it, don't just think it" move. Carl speaks his win condition and today's focus out loud; Row transcribes and stores it, and surfaces it back at Evening Shutdown (read back via TTS or shown as text) — closing the loop the vault synthesis names as the mechanism (spoken commitment costs something private thought doesn't).

Total target: 15-25+ minutes is fine (Carl's explicit call — longer is acceptable if it makes this feel like a real practice, not a form to fill out fast).

## Interaction model — voice-first, reusing existing `RowVoice` infrastructure

No new voice infrastructure. Every phase step uses the same loop against the existing `window.RowVoice` API (`row/voice-helpers.js`):

1. `RowVoice.speak(prompt)` — TTS reads the prompt aloud.
2. On speech completion, `RowVoice.startCapture()` opens automatically — no tap required to start listening.
3. Transcript shown as **editable text** after capture stops, before it's accepted — never silently committed. Tap to correct a misheard word, then confirm.
4. A visible "or type instead" toggle is present on every step — swaps the mic control for a plain text field, same underlying data field either way. Voice-first, not voice-only (Carl's explicit call).
5. ~4s of silence during active listening shows a gentle "still there?" with manual retry, not a hard error.
6. A deliberate 1-2s pause between TTS finishing and the mic opening, and between an answer and the next prompt — this is the actual pacing mechanism behind "relaxing," not just softer copy.

**Real, disclosed constraint:** TTS is the browser's free built-in `speechSynthesis` (voice quality is whatever the device provides, not a polished narrator voice) and STT tries local in-browser Whisper first, falling back to metered OpenAI Whisper only if local transcription fails — both already true of every other voice surface in Row today (Carl's own explicit free-tier choice from an earlier session), so this redesign adds no new paid-API surface.

## Visual design

No new visual language — stays within Row's existing dark/teal card-based UI. Changes scoped to this flow only:
- A large, centered mic control replaces the current small per-field mic icon as the dominant element per phase step.
- One prompt visible on screen at a time (not a full form) — reduces simultaneous reading/decision load.
- A clear listening-state indicator on the mic control (visually distinct while actively capturing vs. idle vs. speaking).
- No new component library, illustrations, or animation beyond what Row's CSS already provides elsewhere.

## Data model

Extends the existing `morning_launch:<date>` record (see the 2026-08-05 design doc for the full existing shape) — no new Supabase table, no new sync mechanism.

- `currentPhase` gains new values: `settle | align | rehearse | commit | speakit | complete` (was `clear | align | visualize | commit | complete`). A one-time migration on load maps old in-progress records: `clear` → `settle`, `visualize` → `rehearse` — so a session started under the old phase names resumes correctly under the new ones, no data loss.
- `brainDump` — same field and purpose, now populated via voice under Settle.
- **New on Rehearse:** `feltRehearsal` (string, the felt-sense/future-self description) — sits alongside the existing `processVisualization`/`obstacle`/`response` fields, does not replace them.
- **New on Speak It:** `spokenCommitment` (string, transcript of the spoken win condition) and `spokenAt` (ISO timestamp).
- Each phase's answer field gains a paired `<field>InputMode: 'voice' | 'text'` flag — records which path was actually used. Cheap to add now, useful later for judging whether voice-first is actually landing.

## Vault integration

Update `Carl Meyer/06 - Psychology & Mindset/Morning Launch — Evidence-Based 5-4-5.md` to reflect the new 5-phase shape and the new evidence sources, once the implementation is live and verified (matches the existing note's own convention — project notes describe the shipped feature, not the plan). Add wikilinks to [[The Daily Protocol — Five Moves, Not a Philosophy]], [[Joe Dispenza — The Morning and Evening Rehearsal]], [[Joe Dispenza — What's Evidence-Based and What Isn't]], and [[Tara Swart — The Two Brain Mechanisms Behind Manifestation]].

The existing monthly Vault history mirror (`Carl Meyer/11 - Personal Logs/Morning Launch/YYYY-MM Morning Launch Log.md`) extends to include the new fields (`feltRehearsal`, `spokenCommitment`) in its export, same append-only/fail-closed conventions as today. The raw `brainDump` (Settle) stays excluded from the mirror, unchanged from today's privacy rule.

## Error handling

- Mic permission denied or unsupported browser → falls back to text-only for that step, silently, no dead end (matches `RowVoice`'s existing `onError` contract exactly).
- Local Whisper transcription fails → existing OpenAI fallback fires automatically (unchanged, already-free-in-practice behavior).
- Both transcription paths fail → "Didn't catch that — try again," matching the existing pattern.
- Refresh/resume mid-ritual → unchanged mechanics; only transcribed text persists, not in-progress voice/recording state.
- An old in-progress session with a pre-redesign `currentPhase` value migrates on load per the Data Model section above; a completed pre-redesign session is left entirely alone (no retroactive rewrite of history).

## Testing

- `morning-launch-logic.js` / `.selfcheck.cjs` (existing convention, no new test framework): unit tests for the phase-name migration function (`clear`→`settle`, `visualize`→`rehearse`, unrecognized/already-new values pass through unchanged), and validation for the two new fields (`feltRehearsal`, `spokenCommitment`/`spokenAt`).
- Browser verification on the deployed mobile layout: full voice-first walkthrough across all 5 phases (mic auto-open, auto-advance, editable-transcript confirmation, "or type instead" toggle), refresh/resume mid-ritual at each phase, an old in-progress `clear`/`visualize`-phase record correctly resuming post-migration, Evening Shutdown correctly surfacing the Speak It commitment.

## Separate, out-of-band fix (not part of this redesign)

Clear the stale "Ship the PR" / "Call the client" Today-list test data Carl flagged — confirmed as leftover, not real goals. Small, independent cleanup done alongside this work, not folded into the design itself.

## Out of scope

- No new voice infrastructure — this redesign is a consumer of the existing `RowVoice` API only.
- No premium/paid TTS voice upgrade — free browser `speechSynthesis` stays, matching Carl's existing explicit cost decision.
- No fully-produced guided-audio experience (Approach C, considered and deferred) — revisit only if this version proves the voice-first concept works well in real use.
- No changes to Evening Shutdown's own structure beyond surfacing the new Speak It commitment.
- No retroactive rewrite of completed pre-redesign Morning Launch history.
