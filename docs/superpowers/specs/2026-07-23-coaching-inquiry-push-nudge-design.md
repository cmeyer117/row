# Coaching Inquiry Push Nudge — Design

**Date:** 2026-07-23
**Status:** Approved by Carl, ready for implementation planning

## Problem

`coaching.html`'s Pending Applications card (shipped earlier tonight) only surfaces new `coaching_inquiries` rows when Carl actually opens that page. He wants a proactive nudge instead.

## Goal

Push a notification to Carl's phone within ~15-20 minutes of a new coaching application landing, at zero ongoing cost (confirmed: no Anthropic API involvement anywhere in this feature).

## Approach

Periodic polling via GitHub Actions cron, mirroring the existing `send-macro-drift-nudge.js`/`send-workout-nudge.js` pattern exactly — not a Supabase database webhook (would be new, first-of-its-kind infrastructure in this repo for a latency win that doesn't matter here; a coaching application isn't time-critical the way a security alert is).

Reuses the existing `push_subscriptions` table and `app='row'` subscriptions — no new subscribe flow, Carl's phone is already subscribed via the macro-drift/workout nudges.

## New: `api/send-coaching-inquiry-nudge.js`

Mirrors `send-macro-drift-nudge.js`'s structure:
- Queries `coaching_inquiries` for rows where `status = 'new'` and `created_at >=` (now minus 20 minutes — a buffer past the 15-minute cron interval to tolerate scheduling jitter, never so wide it re-notifies about something from hours ago).
- If none, no-op (`{message: 'No new inquiries, no push sent'}`, matching the existing no-op response shape).
- If any exist: one push per run, not one per inquiry — `title: 'Row'`, `body`: `'New coaching application from {name}'` for exactly one, or `'{N} new coaching applications'` for more than one.
- Same subscription fetch/send/410-cleanup loop as `send-macro-drift-nudge.js`, copied as-is (`fetchSubscriptions`, the `webpush.sendNotification` try/catch with `deleteSubscription` on a 410).
- Same `CRON_SECRET` bearer-auth gate on the exported `handler`.

## New: GitHub Actions workflow

`.github/workflows/coaching-inquiry-nudge.yml`, `cron: '*/15 * * * *'`, calling the new endpoint with `CRON_SECRET` — same shape as the existing nudge workflows (checkout, call the URL with the secret header, no build step needed since this just hits a deployed Vercel endpoint).

## Non-goals

No new subscription mechanism, no new schema, no per-inquiry push (a burst of 3 applications in one 15-minute window sends 1 push, not 3), no database webhook.

## Testing

No new pure logic module — this is the same shape of I/O wiring `send-macro-drift-nudge.js` already is (untested by design, per that file's own comment: "this file is just I/O wiring... mirrors send-workout-nudge.js"). Verification is a live, forced test push against the real deployed endpoint (matching how the original macro-drift nudge was verified), not a unit test.

## Cost

Zero. Supabase REST (already in use, free tier) + `web-push` library hitting the browser's own push service (free, standard Web Push infrastructure) + a 15-minute GitHub Actions cron (free at this frequency on a personal account). No Anthropic API involvement.
