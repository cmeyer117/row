# Standalone Coaching App — Design Spec

**Date:** 2026-08-09
**Status:** Approved by Carl. Codex (terra) reviewed — 1 confirmed critical + 5 plausible security gaps found and folded in below (see "Codex review fixes"). Operational hardening items fast-followed, not blocking.
**Author:** Claude (brainstorming session with Carl), reviewed by Codex terra

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
6. **RLS is the real security boundary, bound to `auth.users.id` — not email.** Email is used only once, to match an invited client to the magic-link session on their *first* login; at that point their `coaching_clients` row gets a permanent `auth_user_id` FK, and every RLS policy and RPC from then on checks that FK against `auth.uid()`, never email. (Codex flagged email-based tenancy as fragile — a changed or reused email could otherwise let a new person inherit a prior client's data.) Owner role bypasses this via the single-email `verifyOwner()`-style check, evaluated server-side against a verified session, never a client-supplied value. Every RPC must derive the caller's authorized identity from their own session server-side — a client-supplied `client_id` parameter is never trusted as authority, even for existing RPCs being ported over (`get_coaching_plan`, `get_coaching_client_logs`, `upsert_coaching_weight`, etc. all need this checked, not assumed carried over safely). The old `?id=` URL-param access model is retired entirely — see "Codex review fixes" below for what that actually requires.

## Feature mapping (what moves where)

| Today (Row) | New app |
|---|---|
| `coaching.html` — owner: client list, billing, add/manage | Owner dashboard, same features, RLS-scoped instead of per-request owner-JWT-checked |
| `coaching-plan.html` — plan view/edit | Same page serves both roles: owner picks any client via the dashboard; a client sees only their own (resolved from their session — no `?id=` param for them at all) |
| `coaching-log.html` — client logs sets (**currently unauthenticated `?id=` link**) | Same UI, gated by the client's real magic-link session |
| `coaching-templates.js`, `coaching-exercise-meta.js`, `coaching-diet-trend.js`, `coach-meal-plan.js` | Ported as-is — pure logic/data, no auth-relevant changes |
| `api/create-coaching-payment.js`, `api/stripe-webhook.js` | Ported, repointed at the new Supabase project's service-role key; `verifyOwner()` pattern reused as-is |
| `api/send-coaching-inquiry-nudge.js` | Ported as-is (Telegram nudge on new inquiry, not auth-relevant) |

## Codex review fixes (folded in, not deferred)

Codex (terra) reviewed this spec pre-implementation and found one confirmed critical gap plus five plausible ones, all addressed here:

1. **Retire the old unauthenticated path, don't just leave it as "fallback data."** The original spec said Row's `coaching_clients` data stays in place untouched as a fallback — true for the *data*, but the *old unauthenticated `coaching-log.html?id=` access route itself* must be actively disabled once cutover is verified: revoke the anon-role `EXECUTE` grants on `get_coaching_plan`/`get_coaching_client_logs`/`upsert_coaching_weight`/the set-logging RPC in Row's Supabase project, so the URL stops working even though the underlying rows are preserved. This is the actual security fix this whole project delivers — leaving the door unlocked while moving the valuables elsewhere defeats the point.
2. **Tenancy bound to `auth.users.id`, not email** — see decision #6 above.
3. **RPC identity derived from session, never a parameter** — see decision #6 above.
4. **Rollout sequencing:** RLS policies, grants, and RPC identity checks must be fully in place and tested in the new Supabase project *before* any client account or magic-link invite is issued and before any real client data is inserted. Do not stand up the project, add data, then lock it down — lock it down first.
5. **`coaching-plan.html`'s dual role resolves only from the server-verified session.** For a client, their identity comes solely from their session — never a URL param, local storage, or hidden UI state. For the owner picking a client to view, that selection must be re-validated server-side on every request (the owner role can see anyone, but the *specific client shown* still needs the request to prove the owner role, not just trust a client-side dropdown value).
6. **Migration needs a real cutover point, not just a copy-and-go.** Freeze writes to Row's coaching pages for the migration window (brief, announced, not silent), reconcile row counts between old and new after the copy, make the migration script safely rerunnable (idempotent — a retry after partial failure shouldn't duplicate rows), and carry over the *same* `stripe_customer_id`/`stripe_subscription_id` values rather than creating new Stripe customers, so existing billing continuity isn't broken.

**Verification scope, expanded per Codex's finding that the original list was too narrow:** the "client A can't see client B" test must cover every RPC (not just table-level REST access), all of read/insert/update/delete, guessed/incorrect client IDs, and expired/logged-out sessions — not just one happy-path read check.

## Fast-follow (not blocking this build)

Codex also flagged operational hardening that's real but doesn't need to block a one-owner-two-role Phase 1 launch:

- **Do now, cheap:** Supabase Auth magic-link redirect URL allowlist (prevents open-redirect abuse of the invite flow); confirm the ported Stripe webhook handles duplicate/replayed events idempotently (it already verifies signatures — idempotent *handling* of a re-delivered event is the gap to check, not signature verification itself).
- **Genuine fast-follow, not this build:** rate-limiting on login/invite endpoints, an audit log for owner actions and billing changes, a tested backup/restore procedure, and an explicit client offboarding/data-deletion procedure. Revisit once the app has real clients on it, not before.

## Data migration

One-time migration script, run once by hand (not scheduled/automated). RLS/grants in the new project must already be locked down before this runs (Codex fix #4 above — never insert real client data into an unsecured project).

1. Announce and hold a brief write-freeze window on Row's coaching pages for the migration.
2. Pull all `coaching_clients` rows + related plan/log data from Row's Supabase project, carrying over the same `stripe_customer_id`/`stripe_subscription_id` values (Codex fix #6 — don't create new Stripe customers).
3. Insert into the new project's schema — same shape, no transform needed. Script must be safely rerunnable (idempotent) in case of a partial-failure retry.
4. Reconcile row counts between old and new after the copy, before ending the write-freeze.
5. Migrated clients are **not** auto-invited — they sit inactive until Carl manually sends each one a magic link (per decision #4).
6. Row's original `coaching_clients` *data* stays in place as a fallback until the new app is verified live — but the old unauthenticated access *route* is disabled at the same time (Codex fix #1: revoke the anon-role `EXECUTE` grants on the coaching RPCs in Row's Supabase project). Data retained, access closed — not the same thing. Full data deletion is a separate, later, explicit decision.

## Verification before declaring done

- **RLS cross-client isolation is the one thing that has to be bulletproof — tested at full width, per Codex's finding that a single happy-path check isn't enough.** Log in as client A, confirm client B's data is genuinely unreachable across: every RPC (`get_coaching_plan`, `get_coaching_client_logs`, `upsert_coaching_weight`, the set-logging RPC — not just table-level REST), every operation (read, insert, update, delete), guessed/incorrect client IDs, and an expired or logged-out session.
- Owner login still sees every client's data, and the owner's selected-client view is re-validated server-side (not trusted from client-side UI state).
- A real Stripe test-mode payment flows end-to-end against the new project (checkout session → webhook → `coaching_clients` billing status update), using the migrated `stripe_customer_id`, not a freshly created one.
- Magic-link invite → client login → client sees their own plan/log, nothing else.
- The old Row `coaching-log.html?id=` URL genuinely stops working post-cutover (grants revoked, not just "clients won't know the link exists").

## Explicitly out of scope for this build

- Any new client-facing feature (billing status view, progress photos, messaging, etc.) — deliberately deferred to a later phase once the foundation is proven.
- Deleting coaching data from Row's Supabase project — stays as a fallback, removed later as an explicit separate decision.
- Automating client migration/invites — both are manual, one-at-a-time actions by design.
