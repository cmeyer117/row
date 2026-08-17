-- Code-review fix (2026-08-17): the original decisions migration only
-- granted `anon` access, matching app_state's *narrowest* policies but
-- missing the `authenticated` policy app_state also carries. Row/Vessel's
-- owner-login flows persist a Supabase session that any later
-- createClient() call in the same browser auto-attaches, so a caller can
-- authenticate as `authenticated` even though decisions.js only ever
-- passes the anon key -- with no matching policy, every read/write
-- silently failed for a signed-in owner. See
-- docs/superpowers/specs/2026-08-17-shared-decision-memory-design.md.
create policy "authenticated full access to decisions"
  on decisions
  for all
  to authenticated
  using (true)
  with check (true);
