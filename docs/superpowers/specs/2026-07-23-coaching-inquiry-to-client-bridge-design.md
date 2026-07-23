# Coaching Inquiry → Client Bridge — Design

**Date:** 2026-07-23
**Status:** Approved by Carl, ready for implementation planning

## Problem

`coaching-landing-nu.vercel.app`'s "Apply for Coaching" form already writes real applications to a `coaching_inquiries` Supabase table (name, email, stage, goal, message) — this exists and works today. But it's a dead end: there's no admin view anywhere in the Row repo for `coaching_inquiries` (confirmed via grep — zero references outside the landing page itself), and the table is completely disconnected from `coaching_clients`, the table that everything built earlier tonight (real `getRx()` progression, real `calculateMacros()` diet numbers, client logging) actually runs on. An approved applicant today would have to be manually re-typed into `coaching.html`'s intake form from scratch.

Carl has zero clients today but expects a real applicant soon and wants this gap closed now, not deferred — but built as small as it can be while still being real, reusing `coaching.html`'s existing intake/insert logic rather than rebuilding it.

## Goals

- A submitted application shows up somewhere Carl already looks (not a separate page to remember).
- Approving an application creates a real `coaching_clients` row using the exact same insert logic already in `coaching.html`, not a duplicate code path.
- Declining is accidental-click-proof — it's not destructive (record stays), but still consequential (turning away a real applicant) and needs confirmation.

## Non-goals

- A separate `coaching-inquiries.html` page — not worth it at near-zero application volume; revisit if volume ever makes a dedicated screen worth it.
- Email notifications when a new inquiry arrives — Carl checks `coaching.html` regularly already.
- Any change to the public landing page's form itself — it already works correctly.

## Data model

**`coaching_inquiries` gains one column:**
```sql
alter table coaching_inquiries add column status text not null default 'new';
```
Values: `'new'` (pending, shown in the UI), `'converted'` (became a client), `'declined'` (turned away, kept for the record — never deleted).

**`coaching_clients` gains one column:**
```sql
alter table coaching_clients add column email text;
```
No way today to actually send a client their private `coaching-log.html`/`coaching-plan.html` link without this — the inquiry already collects it, and it's useful for manually-added clients too (the intake form gets an Email field alongside the existing ones).

## UI: Pending Applications section

Added to `coaching.html`, directly above the existing intake form (`.card` for "Client name" etc.). A new `.card` listing every `coaching_inquiries` row where `status = 'new'`, newest first: name, stage, goal, message, applied date. Empty state ("No pending applications") when there are none — matches the existing `#emptyClients` pattern already on this page.

Each row has two buttons:

**Decline:**
```js
if (!confirm('Decline ' + name + '\'s application? This can\'t be easily undone from here.')) return;
await supa.from('coaching_inquiries').update({ status: 'declined' }).eq('id', inquiryId);
```
Same shape as the existing `archiveClient()` confirm pattern on this page. Row disappears from the pending list on success.

**Approve:**
1. Scrolls to the existing intake form.
2. Pre-fills `Client name` ← inquiry's `name`, `Stage` ← inquiry's `stage`, `Goal` ← inquiry's `goal`, and the new `Email` field ← inquiry's `email`.
3. Stores the inquiry's `id` in a module-scoped variable (`pendingApprovalInquiryId`) so the submit handler knows this add-client action originated from an approval.
4. Carl fills in the remaining fields (equipment, training days/week, session length, sex, age, height, weight, injury flags) exactly like adding a client manually today, and clicks the existing "+ Add Client" button.

## Submit handler change

The existing `addClientBtn` click handler is extended, not rewritten: after the `coaching_clients` insert succeeds (same code path as today, now also carrying `email: intake.email`), if `pendingApprovalInquiryId` is set, fire one more update:
```js
await supa.from('coaching_inquiries').update({ status: 'converted' }).eq('id', pendingApprovalInquiryId);
```
This runs **after** the client insert succeeds and is never allowed to block or roll back client creation — if this specific update fails, the client still exists and is usable; the inquiry just stays visible as "new" a little longer (a harmless, self-correcting inconsistency, not a data-loss risk). Reset `pendingApprovalInquiryId` to `null` after either a successful approval-triggered add or a normal (non-approval) add, so a later manual "+ Add Client" click never accidentally marks an old inquiry as converted.

## Testing

No new pure/standalone modules here — this is UI wiring on top of already-tested logic (`coaching_clients` insert validation is existing, unchanged code). Verification is manual: submit a real test application via the landing page, confirm it appears in the Pending Applications section, confirm Decline requires confirmation and hides it, confirm Approve pre-fills correctly and produces a real, usable `coaching_clients` row with `getRx()`/`calculateMacros()` working exactly like tonight's earlier build — then confirm the source inquiry flipped to `converted`.

## Migration

Both new columns are additive, nullable/defaulted — no existing data changes shape. Applied via the Supabase MCP `apply_migration` tool, same as tonight's earlier migration.
