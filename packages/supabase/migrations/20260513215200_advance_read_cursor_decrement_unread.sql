-- =====================================================================
-- 20260513215200_advance_read_cursor_decrement_unread.sql
-- =====================================================================
-- The original advance_read_cursor (added in 20260513141500) only writes
-- last_read_seq. unread_message_count is the field the FE renders on TOC
-- badges (eventsHub UNREAD_SYNC, UnreadBadge consumers), so it must move
-- in lockstep with the cursor — otherwise reading messages never clears
-- the badge.
--
-- The recompute form (count(*) where seq > new_seq) is safe under deletes
-- and skipped seqs (no drift from gaps). messages(channel_id, seq) is
-- indexed (idx_messages_channel_id_seq from scripts/11-indexes.sql) so
-- the count is a cheap index range scan.
--
-- Mirrors scripts/10-functions.sql.
-- =====================================================================

create or replace function public.advance_read_cursor(
  p_channel_id varchar(36),
  p_up_to_seq  bigint
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new_seq bigint;
  v_unread int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select greatest(last_read_seq, p_up_to_seq) into v_new_seq
  from public.channel_members
  where channel_id = p_channel_id and member_id = v_uid;

  if v_new_seq is null then
    return;
  end if;

  select coalesce(count(*), 0) into v_unread
  from public.messages
  where channel_id = p_channel_id
    and deleted_at is null
    and seq > v_new_seq;

  update public.channel_members
  set last_read_seq = v_new_seq,
      unread_message_count = v_unread,
      last_read_update_at = (now() at time zone 'utc')
  where channel_id = p_channel_id and member_id = v_uid;
end;
$$;

grant execute on function public.advance_read_cursor(varchar, bigint) to authenticated;
revoke execute on function public.advance_read_cursor(varchar, bigint) from anon, public;
