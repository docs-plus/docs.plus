-- Refuse connected-app tokens (`client_id` claim) on the Data API, Storage and
-- Realtime. Paired with scripts/31-connected-app-token-gate.sql; same body.
-- Before running: check authenticator has no other pgrst.db_pre_request.
-- Idempotent: create or replace, drop policy if exists.

-- 1. Data API. PostgREST runs this before every table, view, RPC and GraphQL
-- request, after it sets the role and the JWT claims.
-- Security invoker on purpose: 29-lint-hardening.sql §5 revokes EXECUTE on every
-- definer function in public, and a hook anon cannot run fails every request.
create or replace function public.refuse_connected_app_request()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (auth.jwt() ->> 'client_id') is not null then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'connected_app',
        'message', 'Connected apps use docs.plus through its MCP server.'
      )::text,
      detail = json_build_object('status', 403, 'headers', json_build_object())::text;
  end if;
end;
$$;

comment on function public.refuse_connected_app_request() is
'PostgREST pre-request hook (pgrst.db_pre_request). Refuses tokens that carry client_id.';

revoke execute on function public.refuse_connected_app_request() from public;
grant execute on function public.refuse_connected_app_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.refuse_connected_app_request';
notify pgrst, 'reload config';

-- 2. Storage. The Storage API runs each request as the caller, under RLS.
drop policy if exists "Connected apps use only the MCP server" on storage.objects;
create policy "Connected apps use only the MCP server"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

-- 3. Realtime private channels: join, broadcast and presence read this table.
-- No COMMENT ON POLICY here: postgres does not own realtime.messages (42501).
drop policy if exists "Connected apps use only the MCP server" on realtime.messages;
create policy "Connected apps use only the MCP server"
  on realtime.messages
  as restrictive
  for all
  to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

-- 4. Realtime postgres_changes. Realtime checks each change against the table's
-- SELECT policies with the subscriber's claims, so gate every published table.
-- A table added to supabase_realtime later needs this block run again.
do $$
declare
  published record;
begin
  for published in
    select schemaname, tablename
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
  loop
    execute format(
      'drop policy if exists "Connected apps use only the MCP server" on %I.%I',
      published.schemaname, published.tablename
    );
    execute format(
      'create policy "Connected apps use only the MCP server" on %I.%I '
      'as restrictive for select to authenticated '
      'using ((select auth.jwt() ->> ''client_id'') is null)',
      published.schemaname, published.tablename
    );
  end loop;
end;
$$;
