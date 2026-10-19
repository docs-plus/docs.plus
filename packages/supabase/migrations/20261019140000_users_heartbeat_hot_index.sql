-- Heartbeats become HOT updates: no index on public.users names online_at.
set local lock_timeout = '5s';

drop index if exists public.idx_users_username;

do $$
begin
    if exists (select 1 from pg_indexes
                where schemaname = 'public' and indexname = 'idx_users_online_status'
                  and position('online_at' in indexdef) > 0) then
        drop index public.idx_users_online_status;
    end if;
end $$;

create index if not exists idx_users_online_status
    on public.users (id)
    where status = 'ONLINE';

do $$
begin
    if exists (select 1 from pg_indexes
                where schemaname = 'public' and tablename = 'users'
                  and position('online_at' in indexdef) > 0) then
        raise exception 'an index on public.users still names online_at; heartbeats stay non-HOT';
    end if;
end $$;
