# Visible Sync Status + Acknowledged-Write Fix — Design

**Date:** 2026-08-20
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

`sync.js`'s `pushNow()` and `flushOnUnload()` both swallow every network/database failure silently (`catch (e) {}`), so a lost workout, check-in, or coach decision can look saved locally with no durable signal to Carl that it isn't. Separately, `flushOnUnload()` marks its write as synced (`lastSyncedJson = json`) immediately after firing a `keepalive` fetch, without ever reading whether that request actually succeeded — impossible in principle, since the page tears down before any response can be read. When both `beforeunload` and `pagehide` fire for one real navigation (the common case, not an edge case), the second flush attempt sees `json === lastSyncedJson` from the first attempt and skips itself, even if the first attempt genuinely failed.

Codex review 2026-08-20 (rank #1 and #3 of the Row reliability pass).

## Scope

1. `sync.js` broadcasts its status (`pending` / `synced` / `error`) per `appKey` via a `window` CustomEvent, with automatic retry-with-backoff on failure.
2. `topbar.js` renders a small status badge reflecting the worst status across every active `initCloudSync()` instance on the current page, with a tap-to-expand detail view (per-key last-synced time, manual retry).
3. `flushOnUnload()` stops optimistically marking itself synced — it fires the same underlying push attempt as a real `pushNow()` call would, without any acknowledgment shortcut.

Out of scope: the schema-manifest/merge-conflict rework (separate item), the coach-response closeout feature (separate item), and any change to `mergeArrays`/`applyRemote`'s existing merge logic.

## sync.js changes

- New internal state per `initCloudSync()` instance: `status` (`'pending'|'synced'|'error'`), `lastSyncedAt` (ISO string or null), `retryDelayMs` (backoff counter, reset to 0 on success).
- New `broadcastStatus()` helper: `window.dispatchEvent(new CustomEvent('row:sync-status', { detail: { appKey, status, lastSyncedAt } }))`. Called on every status transition (schedulePush → `pending`; pushNow success → `synced` + `lastSyncedAt` set + retry counter reset; pushNow failure → `error` + backoff retry scheduled).
- `pushNow()` failure path: instead of a bare `catch (e) {}`, set status `error`, broadcast, and schedule a retry via `setTimeout` at the current backoff delay (5000 → 15000 → 30000, capped at 30000). A subsequent successful `pushNow()` (whether from the retry timer or a fresh edit's `schedulePush()`) resets the backoff and clears the retry timer.
- New `window.__rowSyncRetry(appKey)` (or equivalent scoped hook) topbar.js's tap-to-retry can call to force an immediate `pushNow()` attempt, bypassing the backoff wait. Exposed narrowly (a per-instance retry function registered into a small shared registry keyed by appKey), not a global grab-bag.
- `flushOnUnload()`: remove the `lastSyncedJson = json` line after the fetch call. The request still fires with `keepalive: true` exactly as before (best-effort, fire-and-forget is the only option during real unload) — the fix is purely removing the false acknowledgment, not changing the request itself. `pagehide`/`beforeunload` firing twice for one navigation now both genuinely attempt the write (a harmless duplicate `upsert`) instead of the second silently no-op'ing on a guess.

## topbar.js changes

- New badge element in the existing `<header class="topbar">`, positioned near the home/review buttons.
- Listens for `row:sync-status` events, keeps a small in-memory map `{appKey: {status, lastSyncedAt}}` for the current page (a page can run multiple `initCloudSync()` instances for different appKeys, e.g. gym.html's `hype-audio`/`health` pattern).
- Badge renders the worst status across the map: any `error` → red; else any `pending` → yellow (pulsing/subtle animation optional); else (all `synced` or map empty) → green/neutral, matching existing topbar icon styling.
- Tap opens a small popover: one row per tracked appKey with its status and last-synced time (relative, e.g. "2m ago"), and a "Retry now" action per errored key that calls into the exposed retry hook.

## Error handling

- A page with zero `initCloudSync()` calls (shouldn't happen given topbar.js is universal, but defensive): badge renders neutral/hidden, no events ever arrive.
- Backoff retry timer must be cleared on a fresh successful push (whether from the timer firing or an unrelated new edit triggering its own `pushNow()`) — no orphaned retry loops continuing after success.
- `broadcastStatus()` wrapped in the same try/catch discipline as the rest of this file (a `CustomEvent`/`dispatchEvent` failure must never break the actual sync logic).

## Testing

- `sync.selfcheck.cjs` (already exists) extended: pushNow failure transitions to `error` status and schedules a retry; a subsequent successful pushNow resets backoff; flushOnUnload never sets `lastSyncedJson` regardless of the fetch outcome (mock fetch resolving/rejecting, assert `lastSyncedJson` stays whatever it was before the call).
- Browser verification: load a page with cloud sync, confirm the badge renders, simulate a failed push (e.g. bad Supabase key or offline) and confirm the badge goes red with a working manual retry, confirm it returns to green once the retry succeeds.
