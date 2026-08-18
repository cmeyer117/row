# Row — CI Test Runner

**Date:** 2026-08-17
**Status:** Approved by Carl (brainstorm). Pending written-spec review.

## Context

A full manual audit of Row (`docs/superpowers/specs/2026-08-17-bonus-section-ui-redesign-design.md`'s session) found the app's logic layer fully healthy — all 37 test/selfcheck files pass — but nothing runs them automatically. Row has `.github/workflows/` already (4 cron-triggered nudge senders: `coaching-inquiry-nudge.yml`, `macro-drift-nudge.yml`, `morning-launch-nudge.yml`, `workout-nudge.yml`) but no CI that runs on push/PR. Jarvis (`claude-workspace` repo) has this via `.github/workflows/jarvis-ci.yml`; Row doesn't, and was the actual gap the manual audit surfaced — a test regression could land on `main` and deploy to production with nothing catching it until the next manual sweep.

## Design

1. **`scripts/run-tests.mjs`** — a small Node script, not a test framework. Recursively walks the repo (skipping `node_modules`, `.git`) for files matching `*.selfcheck.cjs` or `*.test.js`, spawns `node <file>` for each as a child process, reports PASS/FAIL per file, and exits non-zero if any file failed. This mirrors exactly what CLAUDE.md's existing testing section already establishes ("run directly with node, not a test runner") and what the manual audit did by hand — the script just automates that loop. No new dependency: `child_process` and `fs` are Node built-ins.

2. **`package.json`**: add `"test": "node scripts/run-tests.mjs"` under `scripts`. Makes `npm test` work identically locally (any OS — the script shells out to `node`, no bash-specific syntax) and in CI.

3. **`.github/workflows/row-ci.yml`**: new workflow, matching the plain style of the 4 existing workflow files (simple `runs-on: ubuntu-latest`, no path filtering — Row is a single monolithic repo, unlike `claude-workspace`'s multi-project structure). Steps: `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: '24'`, matching Jarvis's CI and the locally-installed version), `npm ci` (lockfile already present), `npm test`. Triggers: `push` to `main` and `pull_request` — Row mostly pushes straight to `main` per its own convention, but PRs do occur (seen in recent history), so both are covered.

## Explicitly out of scope

- No test framework (vitest/jest) — rejected in brainstorming as unnecessary complexity for 37 files that already run correctly via plain `node`, and it would contradict CLAUDE.md's explicit no-framework convention for this repo.
- No linting, build step, or static-analysis checks in this workflow — Row has no build step at all, and adding lint/audit checks wasn't part of what Carl asked for. Could be added later as a separate, explicitly-requested addition.
- No failure notification (Slack/Telegram) beyond GitHub's own commit-status/PR-check UI — first version relies on that; add a notifier only if it turns out not to be visible enough in practice.
- No changes to the 4 existing nudge-sender workflows or any existing test file.

## Testing

The test runner script's own correctness is verified by using it: once written, `npm test` must discover and run all 37 existing files with the same pass/fail result as the manual `for` loop the audit already ran, plus one deliberate check that a failing file is correctly detected (temporarily break a test, confirm the script reports FAIL and exits non-zero, then revert). The CI workflow itself is verified by pushing it and confirming a real GitHub Actions run goes green.
