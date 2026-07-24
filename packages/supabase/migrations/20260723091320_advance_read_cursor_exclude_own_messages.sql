-- Exclude the reader's own messages from the advance_read_cursor recompute: the
-- increment trigger never counts a sender's own message as unread, so a stale
-- debounced advance must not transiently show your own send as unread. Mirrors
-- packages/supabase/scripts/10-functions.sql.
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

  -- FOR UPDATE locks the row so concurrent advances (open tab + mobile)
  -- cannot interleave SELECT/UPDATE and flap unread_message_count.
  select greatest(last_read_seq, p_up_to_seq) into v_new_seq
  from public.channel_members
  where channel_id = p_channel_id and member_id = v_uid
  for update;

  if v_new_seq is null then
    return;
  end if;

  -- Exclude the reader's own messages: the increment trigger never counts a
  -- sender's own message as unread, so the recompute must not either (a stale
  -- debounced advance could otherwise transiently show your own send as unread).
  select coalesce(count(*), 0) into v_unread
  from public.messages
  where channel_id = p_channel_id
    and deleted_at is null
    and seq > v_new_seq
    and user_id <> v_uid;

  update public.channel_members
  set last_read_seq = v_new_seq,
      unread_message_count = v_unread,
      last_read_update_at = (now() at time zone 'utc')
  where channel_id = p_channel_id and member_id = v_uid;

  -- Private topic `chatroom-read:{id}` gated by chatroom_read_topic_access
  -- on realtime.messages (members-only). The cursor write is the durable
  -- contract; broadcast failure (broker hiccup, missing extension) must
  -- not roll back the UPDATE.
  begin
    perform realtime.send(
      jsonb_build_object('user_id', v_uid, 'seq', v_new_seq),
      'read:advanced',
      'chatroom-read:' || p_channel_id,
      true
    );
  exception when others then
    raise warning 'read:advanced broadcast failed: %', sqlerrm;
  end;
end;
$$;

grant execute on function public.advance_read_cursor(varchar, bigint) to authenticated;
revoke execute on function public.advance_read_cursor(varchar, bigint) from anon, public;
