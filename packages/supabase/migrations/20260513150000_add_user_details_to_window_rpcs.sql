-- =====================================================================
-- 20260513150000_add_user_details_to_window_rpcs.sql
-- =====================================================================
-- v2 chatroom render needs author name + avatar inline. The previous
-- fetch_message_window / fetch_messages_since returned raw messages
-- columns only, so the FE rendered avatarless rows. Inject the same
-- user_details_json(u) shape that get_channel_aggregate_data already
-- emits, via LEFT JOIN public.users (so deleted authors don't drop the
-- row). fetch_messages_since switches from setof public.messages to
-- jsonb to allow the inline user_details column without altering the
-- base messages rowtype. Mirrors scripts/10-functions.sql.
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
        select m.*, public.user_details_json(u) as user_details
        from public.messages m
        left join public.users u on u.id = m.user_id
        where m.channel_id = p_channel_id
          and m.deleted_at is null
          and m.seq < (p_anchor_value::bigint)
        order by m.seq desc
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
      select m.*, public.user_details_json(u) as user_details
      from public.messages m
      left join public.users u on u.id = m.user_id
      where m.channel_id = p_channel_id and m.deleted_at is null and m.seq <= v_anchor_seq
      order by m.seq desc limit p_before_limit + 1
    )
    union all
    (
      select m.*, public.user_details_json(u) as user_details
      from public.messages m
      left join public.users u on u.id = m.user_id
      where m.channel_id = p_channel_id and m.deleted_at is null and m.seq > v_anchor_seq
      order by m.seq asc limit p_after_limit
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

-- fetch_messages_since: drop the setof-public.messages signature first so
-- the new returns-jsonb body can replace it cleanly. Existing FE consumer
-- treats the result as an array shape and is being updated in lockstep.
drop function if exists public.fetch_messages_since(varchar, bigint, int);

create or replace function public.fetch_messages_since(
  p_channel_id varchar(36),
  p_since_seq  bigint,
  p_limit      int default 100
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
  from (
    select m.*, public.user_details_json(u) as user_details
    from public.messages m
    left join public.users u on u.id = m.user_id
    where m.channel_id = p_channel_id
      and m.seq > p_since_seq
      and m.deleted_at is null
    order by m.seq asc
    limit p_limit
  ) t;
$$;

grant execute on function public.fetch_messages_since(varchar, bigint, int)
  to authenticated, anon;
