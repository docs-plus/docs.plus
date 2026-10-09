-- Issue #434. No client may read another user's status or last-active time.
-- Pairs with scripts 13-RLS (authenticated grant), 29-lint-hardening (anon grant)
-- and 17-realtime-replica (publication). Hold it out of the first push. Push it with
-- 20261009130100, at least 24 hours after the apps ship.

set local lock_timeout = '5s';

-- No-op for a column that a role never had.
revoke select (status, online_at) on public.users from anon, authenticated;

-- The admin Users page was the only postgres_changes consumer. It now refreshes on demand.
do $$
begin
    if exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'users'
    ) then
        alter publication supabase_realtime drop table public.users;
    end if;
end $$;

-- Script 31 made this policy because users was published. A fresh seed no longer makes it.
drop policy if exists "Connected apps use only the MCP server" on public.users;

-- Fail the deploy rather than ship a readable column: a table-level grant
-- would survive the column revoke above. The heartbeat still needs UPDATE on status.
do $$
begin
    if has_column_privilege('anon', 'public.users', 'status', 'SELECT')
       or has_column_privilege('anon', 'public.users', 'online_at', 'SELECT')
       or has_column_privilege('authenticated', 'public.users', 'status', 'SELECT')
       or has_column_privilege('authenticated', 'public.users', 'online_at', 'SELECT') then
        raise exception 'status or online_at is readable by a client role; narrow its users grant first';
    end if;
    if not has_column_privilege('authenticated', 'public.users', 'status', 'UPDATE') then
        raise exception 'authenticated lost UPDATE on users.status; the heartbeat cannot write';
    end if;
end $$;
