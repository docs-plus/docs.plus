-- =====================================================================
-- 20260513141000_add_fetch_messages_since.sql
-- =====================================================================
-- Connection-event refetch for v2 chatroom. Caller passes its highest
-- seen seq; RPC returns subsequent messages RLS-filtered.
-- p_channel_id is varchar(36) to match schema. Mirrors scripts/10-functions.sql.
-- =====================================================================

create or replace function public.fetch_messages_since(
  p_channel_id varchar(36),
  p_since_seq  bigint,
  p_limit      int default 100
) returns setof public.messages
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.messages
  where channel_id = p_channel_id
    and seq > p_since_seq
    and deleted_at is null
  order by seq asc
  limit p_limit;
$$;

grant execute on function public.fetch_messages_since(varchar, bigint, int)
  to authenticated, anon;
