-- Remove push_subscriptions from supabase_realtime. No client subscribes to it,
-- and scripts/17-realtime-replica.sql already rebuilds the publication without it.
-- Paired with the drop in scripts/07-4-push-notifications-pgmq.sql.
do $$
begin
    if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'push_subscriptions'
    ) then
        alter publication supabase_realtime drop table push_subscriptions;
    end if;
end $$;
