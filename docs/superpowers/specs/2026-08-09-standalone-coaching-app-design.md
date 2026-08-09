# Standalone Coaching App — Design Spec

**Date:** 2026-08-09
**Status:** Approved by Carl, pending Codex (terra) review
**Author:** Claude (brainstorming session with Carl)

## Context

Coaching currently lives inside Row as `coaching.html`, `coaching-plan.html`, `coaching-log.html`, plus supporting logic files (`coaching-auth.js`, `coaching-templates.js`, `coaching-exercise-meta.js`, `coaching-diet-trend.js`, `coach-meal-plan.js`) and API routes (`api/create-coaching-payment.js`, `api/stripe-webhook.js`, `api/send-coaching-inquiry-nudge.js`). It's bundled into Row's shared, single-anon-key Supabase project, with an owner-only auth gate (`coaching-auth.js`, Supabase Auth email/password) and RLS locked down to the owner since 2026-07-24.

Carl decided to spin coaching out into its own standalone app, separate from Row, rather than merging it into Content Manager. Rationale (established during the brainstorm, not re-litigated here): coaching is client-facing with real billing and PII, while Content Manager and Row are both personal single-user tools — different audiences, different security bar, different monetization model. This confirms/sharpens the "Model C" direction already floated in `project-productization-plan.md` and `project-wealth-funnel-model.md`.

This is Phase 1 of that productization: get the *existing* feature set safely onto real, dedicated multi-tenant infrastructure. New client-facing features (billing visibility, messaging, progress photos, etc.) are explicitly out of scope for this build — the goal is proving the new auth/infra works before adding anything on top of it.

## Key discovery during brainstorming

`coaching-log.html` is *already* client-facing today, but via an unauthenticated `?id=<uuid>` URL parameter — no login, no session. Anyone holding that link can view/edit that client's logged sets via Supabase RPCs (`get_coaching_plan`, `get_coaching_client_logs`, `upsert_coaching_weight`, and a set-logging RPC). This is the real access-control gap this project closes, not just a lift-and-shift.

## Decisions made

1. **New standalone repo + Vercel project**, separate from `row`. Working name: `coaching-app` (Carl can rename).
2. **New dedicated Supabase project**, not Row's shared one. Row's project is single-anon-key/single-owner; mixing in real multi-tenant `auth.users` accounts for clients would co-mingle a personal-tool data model with a productized one. This is exactly the migration `project-productization-plan.md` already calls for when productization becomes real.
3. **Two auth roles, both real Supabase Auth sessions:**
   - **Owner (Carl):** email/password, same pattern as today's `coaching-auth.js`. Full access to every client's data. Owner-ness is a single-email match against a constant — exactly Row's existing `verifyOwner()` pattern (`api/_lib/verify-owner.js`, `OWNER_EMAIL` constant), reused as-is. No separate roles table — there's exactly one owner.
   - **Clients:** magic-link only (passwordless). Each client gets an `auth.users` row tied to their `coaching_clients` row by email. No password to manage, no signup form.
4. **Invite flow is manual, not automatic.** Carl triggers "send magic link" from the owner dashboard when he's ready (e.g., after a client has actually paid/onboarded) — not auto-sent the instant a `coaching_clients` row is created.
5. **Feature scope is a strict 1:1 port** — no new client-facing features in this build. See mapping table below.
6. **RLS is the real security boundary.** A client's session can only read/write rows where `coaching_clients.email` (or a `client_id` FK on child tables) matches their authenticated email. Owner role bypasses this. The old `?id=` URL-param access model is retired entirely — a client without a valid session gets nothing.

## Feature mapping (what moves where)

| Today (Row) | New app |
|---|---|
| `coaching.html` — owner: client list, billing, add/manage | Owner dashboard, same features, RLS-scoped instead of per-request owner-JWT-checked |
| `coaching-plan.html` — plan view/edit | Same page serves both roles: owner picks any client via the dashboard; a client sees only their own (resolved from their session — no `?id=` param for them at all) |
| `coaching-log.html` — client logs sets (**currently unauthenticated `?id=` link**) | Same UI, gated by the client's real magic-link session |
| `coaching-templates.js`, `coaching-exercise-meta.js`, `coaching-diet-trend.js`, `coach-meal-plan.js` | Ported as-is — pure logic/data, no auth-relevant changes |
| `api/create-coaching-payment.js`, `api/stripe-webhook.js` | Ported, repointed at the new Supabase project's service-role key; `verifyOwner()` pattern reused as-is |
| `api/send-coaching-inquiry-nudge.js` | Ported as-is (Telegram nudge on new inquiry, not auth-relevant) |

## Data migration

One-time migration script, run once by hand (not scheduled/automated):

1. Pull all `coaching_clients` rows + related plan/log data from Row's Supabase project.
2. Insert into the new project's schema — same shape, no transform needed since the schema is ported as-is.
3. Migrated clients are **not** auto-invited — they sit inactive until Carl manually sends each one a magic link (per decision #4).
4. Row's original `coaching_clients` data stays in place, untouched, as a fallback until the new app is verified live with real client logins. Deletion is a separate, later, explicit decision — not part of this build.

## Verification before declaring done

- **RLS cross-client isolation is the one thing that has to be bulletproof.** Log in as client A, confirm client B's data is genuinely unreachable (not just hidden in the UI — a direct RPC/REST call with client A's session must fail against client B's rows).
- Owner login still sees every client's data.
- A real Stripe test-mode payment flows end-to-end against the new project (checkout session → webhook → `coaching_clients` billing status update).
- Magic-link invite → client login → client sees their own plan/log, nothing else.

## Explicitly out of scope for this build

- Any new client-facing feature (billing status view, progress photos, messaging, etc.) — deliberately deferred to a later phase once the foundation is proven.
- Deleting coaching data from Row's Supabase project — stays as a fallback, removed later as an explicit separate decision.
- Automating client migration/invites — both are manual, one-at-a-time actions by design.
