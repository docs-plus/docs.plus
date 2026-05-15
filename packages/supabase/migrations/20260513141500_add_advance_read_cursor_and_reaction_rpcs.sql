-- =====================================================================
-- 20260513141500_add_advance_read_cursor_and_reaction_rpcs.sql
-- =====================================================================
-- advance_read_cursor — single-row UPDATE on channel_members.last_read_seq,
--   replacing the bulk-UPDATE mark_messages_as_read that floods realtime.
--   channel_members IS in supabase_realtime (per scripts/17-realtime-replica.sql);
--   each advance broadcasts one row UPDATE — useful for cross-tab sync, far
--   below the message-level flood.
-- add_reaction / remove_reaction — SECURITY DEFINER with SELECT ... FOR
--   UPDATE on the message row before atomic JSONB mutation.
-- p_channel_id is varchar(36) to match schema. v_channel_id (selected from
-- messages.channel_id) is varchar(36) for internal.can_read_channel.
-- Mirrors scripts/10-functions.sql (advance_read_cursor),
-- scripts/10-3-func-message.sql (reactions), and scripts/13-RLS.sql (grants).
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
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.channel_members
  set last_read_seq = greatest(last_read_seq, p_up_to_seq)
  where channel_id = p_channel_id and member_id = v_uid;
end;
$$;

grant execute on function public.advance_read_cursor(varchar, bigint) to authenticated;
revoke execute on function public.advance_read_cursor(varchar, bigint) from anon, public;

create or replace function public.add_reaction(
  p_message_id uuid,
  p_emoji      text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel_id varchar(36);
  v_reactions jsonb;
  v_already_reacted boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if length(p_emoji) = 0 or length(p_emoji) > 16 then
    raise exception 'invalid emoji' using errcode = '22023';
  end if;

  select channel_id into v_channel_id
  from public.messages
  where id = p_message_id and deleted_at is null;
  if v_channel_id is null then
    raise exception 'message not found' using errcode = '42501';
  end if;
  if not internal.can_read_channel(v_channel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(reactions, '[]'::jsonb) into v_reactions
  from public.messages where id = p_message_id for update;

  v_already_reacted := exists (
    select 1 from jsonb_array_elements(v_reactions) elt
    where elt->>'user_id' = v_uid::text and elt->>'emoji' = p_emoji
  );

  if not v_already_reacted then
    v_reactions := v_reactions || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_uid::text,
        'emoji', p_emoji,
        'at', extract(epoch from now())
      )
    );
    update public.messages set reactions = v_reactions where id = p_message_id;
  end if;

  return v_reactions;
end;
$$;

grant execute on function public.add_reaction(uuid, text) to authenticated;
revoke execute on function public.add_reaction(uuid, text) from anon, public;

create or replace function public.remove_reaction(
  p_message_id uuid,
  p_emoji      text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel_id varchar(36);
  v_reactions jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select channel_id into v_channel_id
  from public.messages
  where id = p_message_id and deleted_at is null;
  if v_channel_id is null then
    raise exception 'message not found' using errcode = '42501';
  end if;
  if not internal.can_read_channel(v_channel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(reactions, '[]'::jsonb) into v_reactions
  from public.messages where id = p_message_id for update;

  v_reactions := coalesce((
    select jsonb_agg(elt)
    from jsonb_array_elements(v_reactions) elt
    where not (elt->>'user_id' = v_uid::text and elt->>'emoji' = p_emoji)
  ), '[]'::jsonb);

  update public.messages set reactions = v_reactions where id = p_message_id;

  return v_reactions;
end;
$$;

grant execute on function public.remove_reaction(uuid, text) to authenticated;
revoke execute on function public.remove_reaction(uuid, text) from anon, public;
