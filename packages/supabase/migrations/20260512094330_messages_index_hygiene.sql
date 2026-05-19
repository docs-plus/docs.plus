-- Messages index hygiene; mirrors packages/supabase/scripts/11-indexes.sql.
-- Non-concurrent DDL: Supabase migrations run inside a transaction; CONCURRENTLY
-- is rejected (SQLSTATE 25001). For very large prod tables, run CONCURRENTLY
-- manually outside db push during a maintenance window if lock time matters.

drop index if exists public.idx_messages_channel_id;
drop index if exists public.idx_messages_updated_at;
drop index if exists public.idx_messages_channel_id_not_deleted;

create index if not exists idx_messages_channel_id_created_at_active
  on public.messages (channel_id, created_at desc)
  where deleted_at is null;
