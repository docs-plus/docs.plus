-- Issue #402. A client inserts a channel only through the five granted columns, so it never chooses
-- the id, type or counters. Pairs with scripts/13-RLS.sql.
-- Push it after the new webapp is live, in the same push as 20261009120500 or later. An old tab
-- sends `id`, and this refuses that insert with 42501.

set local lock_timeout = '5s';

-- The table revoke also clears a default table-wide grant, so it runs before the column grant.
revoke insert on public.channels from authenticated;
grant insert (workspace_id, heading_id, created_by, name, slug) on public.channels to authenticated;

do $$
begin
    if has_column_privilege('authenticated', 'public.channels', 'id', 'INSERT')
       or has_column_privilege('authenticated', 'public.channels', 'type', 'INSERT') then
        raise exception 'authenticated can still insert channels.id or type; narrow its channels grant first';
    end if;
end $$;
