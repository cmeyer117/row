-- Closes an IDOR found by a supabase-rls-audit pass on 2026-08-22:
-- coaching-log.html calls get_coaching_client_logs/get_coaching_plan/
-- log_coaching_exercise/upsert_coaching_weight directly from the browser
-- with only the client's row UUID (from the URL) and the anon key -- no
-- auth check. Anyone holding a client's log link had full read/write to
-- that client's weights and exercise history. There's no client-auth
-- system to switch this to real RLS (row-auth.js has no signup flow --
-- Carl is the only authenticated principal in this project), so instead:
-- add an opaque per-client bearer token, and revoke direct RPC execute
-- from anon/authenticated so only the new server-side proxy
-- (row/api/coaching-client.js, using the service-role key) can call them.
alter table public.coaching_clients
  add column access_token text;

update public.coaching_clients
  set access_token = encode(gen_random_bytes(24), 'hex')
  where access_token is null;

alter table public.coaching_clients
  alter column access_token set not null,
  alter column access_token set default encode(gen_random_bytes(24), 'hex');

create unique index coaching_clients_access_token_key
  on public.coaching_clients (access_token);

revoke execute on function public.get_coaching_client_logs(uuid, text) from anon, authenticated;
revoke execute on function public.get_coaching_plan(uuid) from anon, authenticated;
revoke execute on function public.log_coaching_exercise(uuid, text, numeric, integer, boolean) from anon, authenticated;
revoke execute on function public.upsert_coaching_weight(uuid, numeric) from anon, authenticated;

grant execute on function public.get_coaching_client_logs(uuid, text) to service_role;
grant execute on function public.get_coaching_plan(uuid) to service_role;
grant execute on function public.log_coaching_exercise(uuid, text, numeric, integer, boolean) to service_role;
grant execute on function public.upsert_coaching_weight(uuid, numeric) to service_role;
