-- Messages index hygiene; mirrors packages/supabase/scripts/11-indexes.sql.
-- Drops two indexes redundant with / weaker than the composite below, and
-- adds a partial composite that serves the channel-pagination read path
-- with the soft-delete filter.

drop index concurrently if exists public.idx_messages_channel_id;
drop index concurrently if exists public.idx_messages_updated_at;
drop index concurrently if exists public.idx_messages_channel_id_not_deleted;

create index concurrently if not exists idx_messages_channel_id_created_at_active
  on public.messages (channel_id, created_at desc)
  where deleted_at is null;
