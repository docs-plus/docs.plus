-- =====================================================================
-- 20260513140500_add_fetch_message_window.sql
-- =====================================================================
-- Anchor-aware window fetch for v2 chatroom. Four anchor kinds:
--   'tail'         — last N rows; anchor_value ignored.
--   'first_unread' — window around min(seq) > last_read_seq for caller;
--                    falls back to 'tail' for anon or no unread.
--   'message_id'   — window around target; raises 42501 if caller cannot
--                    read the channel (distinct from "no messages").
--   'before_seq'   — rows strictly older than anchor_value::bigint; used
--                    by useChannelMessages.loadOlder.
-- Returns jsonb: { rows, anchor_seq, has_more_before, has_more_after }.
-- p_channel_id is varchar(36) to match schema (channels.id, messages.channel_id,
-- internal.can_read_channel). Mirrors scripts/10-functions.sql.
-- =====================================================================

create or replace function public.fetch_message_window(
  p_channel_id   varchar(36),
  p_anchor_kind  text,
  p_anchor_value text default null,
  p_before_limit int default 40,
  p_after_limit  int default 40
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_anchor_seq bigint;
  v_rows jsonb;
  v_has_more_before boolean;
  v_has_more_after boolean;
  v_target_msg_id uuid;
  v_target_channel varchar(36);
begin
  if p_anchor_kind = 'tail' then
    select coalesce(max(seq), 0) into v_anchor_seq
    from public.messages
    where channel_id = p_channel_id and deleted_at is null;

  elsif p_anchor_kind = 'first_unread' then
    if v_uid is null then
      select coalesce(max(seq), 0) into v_anchor_seq
      from public.messages
      where channel_id = p_channel_id and deleted_at is null;
    else
      select min(m.seq) into v_anchor_seq
      from public.messages m
      join public.channel_members cm on cm.channel_id = m.channel_id
      where m.channel_id = p_channel_id
        and m.deleted_at is null
        and cm.member_id = v_uid
        and m.seq > cm.last_read_seq;
      if v_anchor_seq is null then
        select coalesce(max(seq), 0) into v_anchor_seq
        from public.messages
        where channel_id = p_channel_id and deleted_at is null;
      end if;
    end if;

  elsif p_anchor_kind = 'message_id' then
    v_target_msg_id := p_anchor_value::uuid;
    select channel_id, seq into v_target_channel, v_anchor_seq
    from public.messages
    where id = v_target_msg_id and deleted_at is null;
    if v_target_channel is null or v_target_channel <> p_channel_id then
      raise exception 'message not found or not in channel' using errcode = '42501';
    end if;

  elsif p_anchor_kind = 'before_seq' then
    v_anchor_seq := (p_anchor_value::bigint) - 1;
    select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
      into v_rows
      from (
        select * from public.messages
        where channel_id = p_channel_id
          and deleted_at is null
          and seq < (p_anchor_value::bigint)
        order by seq desc
        limit p_before_limit
      ) t;
    v_has_more_before := exists (
      select 1 from public.messages
      where channel_id = p_channel_id and deleted_at is null
        and seq < coalesce(
          (select min((value->>'seq')::bigint) from jsonb_array_elements(v_rows)),
          (p_anchor_value::bigint)
        )
    );
    v_has_more_after := true;
    return jsonb_build_object(
      'rows', v_rows,
      'anchor_seq', v_anchor_seq,
      'has_more_before', v_has_more_before,
      'has_more_after', v_has_more_after
    );

  else
    raise exception 'invalid anchor_kind: %', p_anchor_kind using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
  into v_rows
  from (
    (
      select * from public.messages
      where channel_id = p_channel_id and deleted_at is null and seq <= v_anchor_seq
      order by seq desc limit p_before_limit + 1
    )
    union all
    (
      select * from public.messages
      where channel_id = p_channel_id and deleted_at is null and seq > v_anchor_seq
      order by seq asc limit p_after_limit
    )
  ) t;

  select exists (
    select 1 from public.messages
    where channel_id = p_channel_id and deleted_at is null
      and seq < coalesce(
        (select min((value->>'seq')::bigint) from jsonb_array_elements(v_rows)),
        v_anchor_seq + 1
      )
  ) into v_has_more_before;

  select exists (
    select 1 from public.messages
    where channel_id = p_channel_id and deleted_at is null
      and seq > coalesce(
        (select max((value->>'seq')::bigint) from jsonb_array_elements(v_rows)),
        v_anchor_seq - 1
      )
  ) into v_has_more_after;

  return jsonb_build_object(
    'rows', v_rows,
    'anchor_seq', v_anchor_seq,
    'has_more_before', v_has_more_before,
    'has_more_after', v_has_more_after
  );
end;
$$;

grant execute on function public.fetch_message_window(varchar, text, text, int, int)
  to authenticated, anon;
