# Morning Launch Nudge — Design

**Date:** 2026-08-09
**Status:** Approved, ready for planning

## Problem

Morning Launch (5-4-5 daily planning flow on `main.html`) and Evening Shutdown already
form a complete daily bookend, but Carl doesn't reliably open Row in the morning at
all — so the flow never gets seen, let alone started. This isn't a flow-quality
problem; it's an adherence/trigger problem.

## Goal

A single push notification at 8am (Eastern, Carl's timezone) that pulls him straight
into Morning Launch if he hasn't started it yet that day. No re-nudge if missed. No
push at all if he's already started.

## Approach

Reuse the existing nudge pattern exactly — `api/send-workout-nudge.js`,
`api/send-macro-drift-nudge.js`, and their matching `.github/workflows/*.yml` cron
triggers already solve this exact shape of problem (GitHub Actions cron → POST to a
Vercel endpoint with a `CRON_SECRET` bearer token → check a condition → web-push via
VAPID → Row's service worker shows the notification). No new infrastructure needed.

## Components

**`api/send-morning-launch-nudge.js`** (new, mirrors `send-workout-nudge.js`)
- Fetches `app_state` row keyed `morning_launch:<today's date>` from Supabase.
- Skip condition: if that row exists (session already started today), send nothing.
- Otherwise, fetch `push_subscriptions` (app = `row`) and send via `web-push`,
  same dead-subscription cleanup on HTTP 410 as the existing nudges.
- Payload: `{ title: 'Row', body: 'Plan your day — Morning Launch', url: '/main.html' }`.

**`.github/workflows/morning-launch-nudge.yml`** (new)
- `cron: '0 12 * * *'` — 12:00 UTC, matching `workout-nudge.yml`'s accepted convention
  of a fixed UTC time approximating Eastern local time (drifts ±1hr across DST,
  same known/accepted limitation as the existing nudges — not solved here).
- `curl -X POST` to `https://row-sage.vercel.app/api/send-morning-launch-nudge` with
  `Authorization: Bearer ${{ secrets.CRON_SECRET }}` — same secret already used by
  the other nudge workflows.

**`sw.js` fix (existing file, small change)**
- `notificationclick` currently hardcodes `clients.openWindow('/gym.html')` for every
  push type, including the two existing nudges (macro-drift, coaching-inquiry) that
  arguably shouldn't land on the gym page either. Change: read `url` off the
  notification's `data` (set from the push payload in the `push` handler), fall back
  to `/gym.html` if absent, so this nudge and any future ones land on the right page.

## Testing

`morning-launch-nudge-logic.js` (new, tiny, mirrors `workout-nudge-logic.js`'s
pattern) — pure function `hasStartedToday(appStateRow)` — unit tested. The
endpoint file itself stays thin I/O wiring, same convention as the other three nudge
endpoints (no test file for those either).

## Out of scope

- No changes to Morning Launch's own flow/content.
- No re-nudge/escalation logic — confirmed one-shot only.
- No DST-aware cron — accepted drift, consistent with existing nudges.
