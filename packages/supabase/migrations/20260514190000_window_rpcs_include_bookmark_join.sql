-- =====================================================================
-- 20260514190000_window_rpcs_include_bookmark_join.sql
-- =====================================================================
-- v1 `get_channel_messages_paginated` (now dropped) computed
-- `is_bookmarked` and `bookmark_id` via a LEFT JOIN to
-- `message_bookmarks`. v2 `fetch_message_window` and
-- `fetch_messages_since` dropped that join, so the FE BookmarkIndicator
-- and the tinted-bg in MessageCardContext never had data to act on —
-- bookmarked messages rendered identically to plain ones.
--
-- Fix: re-add the LEFT JOIN, scoped to the calling user via
-- `mb.user_id = (select auth.uid())`. Anon callers (`auth.uid()` is
-- NULL) get no matches → both fields NULL → indicator stays hidden,
-- which is the desired behavior (anon has no bookmarks).
--
-- `useBookmarkMessageHandler` patches the Virtuoso row locally on
-- toggle (bookmarks live in a separate per-user table, so realtime
-- postgres_changes on `messages` doesn't fire and can't carry per-user
-- bookmark state anyway).
--
-- Mirrors scripts/10-functions.sql.
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
  v_response_anchor bigint;
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
    v_response_anchor := v_anchor_seq;

  elsif p_anchor_kind = 'first_unread' then
    if v_uid is null then
      select coalesce(max(seq), 0) into v_anchor_seq
      from public.messages
      where channel_id = p_channel_id and deleted_at is null;
      v_response_anchor := null;
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
        v_response_anchor := null;
      else
        v_response_anchor := v_anchor_seq;
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
    v_response_anchor := v_anchor_seq;

  elsif p_anchor_kind = 'before_seq' then
    v_anchor_seq := (p_anchor_value::bigint) - 1;
    v_response_anchor := v_anchor_seq;
    select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
      into v_rows
      from (
        select m.*,
          json_build_object(
            'id', u.id,
            'username', u.username,
            'fullname', u.full_name,
            'avatar_url', u.avatar_url,
            'avatar_updated_at', u.avatar_updated_at
          ) as user_details,
          (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
          mb.id as bookmark_id
        from public.messages m
        left join public.users u on u.id = m.user_id
        left join public.message_bookmarks mb
          on mb.message_id = m.id and mb.user_id = v_uid
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
      'anchor_seq', v_response_anchor,
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
      select m.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'fullname', u.full_name,
          'avatar_url', u.avatar_url,
          'avatar_updated_at', u.avatar_updated_at
        ) as user_details,
        (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
        mb.id as bookmark_id
      from public.messages m
      left join public.users u on u.id = m.user_id
      left join public.message_bookmarks mb
        on mb.message_id = m.id and mb.user_id = v_uid
      where m.channel_id = p_channel_id and m.deleted_at is null and m.seq <= v_anchor_seq
      order by m.seq desc limit p_before_limit + 1
    )
    union all
    (
      select m.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'fullname', u.full_name,
          'avatar_url', u.avatar_url,
          'avatar_updated_at', u.avatar_updated_at
        ) as user_details,
        (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
        mb.id as bookmark_id
      from public.messages m
      left join public.users u on u.id = m.user_id
      left join public.message_bookmarks mb
        on mb.message_id = m.id and mb.user_id = v_uid
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
    'anchor_seq', v_response_anchor,
    'has_more_before', v_has_more_before,
    'has_more_after', v_has_more_after
  );
end;
$$;

grant execute on function public.fetch_message_window(varchar, text, text, int, int)
  to authenticated, anon;

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
    select m.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'fullname', u.full_name,
        'avatar_url', u.avatar_url,
        'avatar_updated_at', u.avatar_updated_at
      ) as user_details,
      (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
      mb.id as bookmark_id
    from public.messages m
    left join public.users u on u.id = m.user_id
    left join public.message_bookmarks mb
      on mb.message_id = m.id and mb.user_id = (select auth.uid())
    where m.channel_id = p_channel_id
      and m.seq > p_since_seq
      and m.deleted_at is null
    order by m.seq asc
    limit p_limit
  ) t;
$$;

grant execute on function public.fetch_messages_since(varchar, bigint, int)
  to authenticated, anon;
