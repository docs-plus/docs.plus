-- #489. online_at now means "last ONLINE heartbeat", so an OFFLINE write keeps it.
-- Then a one-time data fix clears rows stuck ONLINE with a NULL online_at.
-- The function pairs with scripts/10-1-func-users.sql. The data fix has no scripts/ mirror (packages/supabase/CLAUDE.md:22).

create or replace function public.update_user_online_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Only an ONLINE write is activity. A sweep or tab-hide OFFLINE write keeps the last heartbeat.
    -- now() is timestamptz, which matches online_at whatever the session TimeZone.
    if new.status = 'ONLINE' then
        new.online_at := now();
    end if;
    return new;
end;
$$;

comment on function public.update_user_online_at() is 'Stamps online_at on every ONLINE write, so online_at is the last heartbeat that is_user_online and last-seen read.';
comment on trigger trigger_update_user_online_at on public.users is 'Stamps online_at on every ONLINE write; OFFLINE writes keep the last heartbeat.';

-- A NULL online_at never matches the sweep's "<", so these rows stayed ONLINE forever.
-- Every ONLINE write stamps now, so no writer can make this state again. A re-run matches 0 rows.
update public.users set status = 'OFFLINE' where status = 'ONLINE' and online_at is null;
