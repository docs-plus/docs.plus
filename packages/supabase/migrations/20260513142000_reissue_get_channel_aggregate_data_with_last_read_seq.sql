-- =====================================================================
-- 20260513142000_reissue_get_channel_aggregate_data_with_last_read_seq.sql
-- =====================================================================
-- Re-issues get_channel_aggregate_data so the unread cursor reads from
-- channel_members.last_read_seq (deploy 1) alongside last_read_message_id
-- (deferred to deploy 4 cleanup). Adds last_read_seq to the returned shape
-- and to channel_member_info so FE can adopt it in deploy 2 without
-- breaking the legacy field. Signature unchanged; return-type widened by
-- one column, so DROP FUNCTION IF EXISTS is required.
-- Mirrors scripts/10-functions.sql.
-- =====================================================================

drop function if exists public.get_channel_aggregate_data(varchar(36), int, uuid);

create or replace function public.get_channel_aggregate_data(
    input_channel_id varchar(36),
    message_limit int default 20,
    anchor_message_id uuid default null
)
returns table(
    channel_info jsonb,
    last_messages jsonb,
    pinned_messages jsonb,
    is_user_channel_member boolean,
    channel_member_info jsonb,
    total_messages_since_last_read int,
    unread_message boolean,
    last_read_message_id uuid,
    last_read_message_timestamp timestamp with time zone,
    last_read_seq bigint,
    anchor_message_timestamp timestamp with time zone,
    older_cursor timestamp with time zone,
    newer_cursor timestamp with time zone,
    has_more_older boolean,
    has_more_newer boolean
) as $$
declare
    channel_result jsonb;
    messages_result jsonb;
    pinned_result jsonb;
    is_member_result boolean;
    channel_member_info_result jsonb;
    total_messages_since_last_read int;
    last_read_message_id uuid;
    last_read_message_timestamp timestamp with time zone;
    last_read_seq_result bigint;
    unread_message boolean := false;
    anchor_message_timestamp timestamp with time zone;
    resolved_anchor_id uuid;
    before_n int;
    after_n int;
    older_cursor_result timestamp with time zone;
    newer_cursor_result timestamp with time zone;
    has_more_older_result boolean := false;
    has_more_newer_result boolean := false;
begin
    select json_build_object(
               'id', c.id,
               'slug', c.slug,
               'name', c.name,
               'created_by', c.created_by,
               'description', c.description,
               'member_limit', c.member_limit,
               'is_avatar_set', c.is_avatar_set,
               'allow_emoji_reactions', c.allow_emoji_reactions,
               'mute_in_app_notifications', c.mute_in_app_notifications,
               'type', c.type,
               'member_count', c.member_count,
               'metadata', c.metadata
           ) into channel_result
    from public.channels c
    where c.id = input_channel_id and c.deleted_at is null;

    if channel_result is null then
        return query select
            null::jsonb                       as channel_info,
            '[]'::jsonb                       as last_messages,
            '[]'::jsonb                       as pinned_messages,
            false                             as is_user_channel_member,
            null::jsonb                       as channel_member_info,
            0                                 as total_messages_since_last_read,
            false                             as unread_message,
            null::uuid                        as last_read_message_id,
            null::timestamp with time zone    as last_read_message_timestamp,
            null::bigint                      as last_read_seq,
            null::timestamp with time zone    as anchor_message_timestamp,
            null::timestamp with time zone    as older_cursor,
            null::timestamp with time zone    as newer_cursor,
            false                             as has_more_older,
            false                             as has_more_newer;
        return;
    end if;

    if (channel_result->>'type') <> 'PUBLIC'
       and not exists (
           select 1
           from public.channel_members cm
           where cm.channel_id = input_channel_id
             and cm.member_id  = auth.uid()
             and cm.left_at is null
       )
    then
        raise exception 'Access denied: caller is not a member of channel %.', input_channel_id;
    end if;

    -- v2: include last_read_seq alongside legacy last_read_message_id.
    select json_build_object(
            'last_read_message_id', cm.last_read_message_id,
            'last_read_seq', cm.last_read_seq,
            'last_read_update_at', cm.last_read_update_at,
            'joined_at', cm.joined_at,
            'left_at', cm.left_at,
            'mute_in_app_notifications', cm.mute_in_app_notifications,
            'channel_member_role', cm.channel_member_role,
            'unread_message_count', cm.unread_message_count
        )
    into channel_member_info_result
    from public.channel_members cm
    where cm.channel_id = input_channel_id and cm.member_id = auth.uid();

    is_member_result := (channel_member_info_result is not null);

    if is_member_result then
        select cm.last_read_message_id, cm.last_read_seq
          into last_read_message_id, last_read_seq_result
        from public.channel_members cm
        where cm.channel_id = input_channel_id and cm.member_id = auth.uid();

        if last_read_message_id is not null then
            select created_at into last_read_message_timestamp
            from public.messages
            where id = last_read_message_id and deleted_at is null;
        end if;
    end if;

    select count(*) into total_messages_since_last_read
    from public.messages
    where channel_id = input_channel_id
        and deleted_at is null
        and created_at > coalesce(last_read_message_timestamp, 'epoch'::timestamp);

    unread_message := (total_messages_since_last_read > 0);

    resolved_anchor_id := null;
    anchor_message_timestamp := null;

    if anchor_message_id is not null then
        select created_at into anchor_message_timestamp
        from public.messages
        where id = anchor_message_id and channel_id = input_channel_id and deleted_at is null;

        if anchor_message_timestamp is null then
            raise exception 'Anchor message % does not exist or has been deleted.', anchor_message_id;
        end if;
        resolved_anchor_id := anchor_message_id;
    elsif last_read_message_id is not null then
        select created_at into anchor_message_timestamp
        from public.messages
        where id = last_read_message_id and channel_id = input_channel_id and deleted_at is null;

        if anchor_message_timestamp is not null then
            resolved_anchor_id := last_read_message_id;
        end if;
    end if;

    if resolved_anchor_id is null then
        select coalesce(json_agg(t), '[]'::json) into messages_result
        from (
            select m.*,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'fullname', u.full_name,
                    'avatar_url', u.avatar_url,
                    'avatar_updated_at', u.avatar_updated_at
                ) as user_details,
                case
                    when m.reply_to_message_id is not null then
                        (select json_build_object(
                                'message', json_build_object(
                                    'id', rm.id,
                                    'created_at', rm.created_at
                                ),
                                'user', json_build_object(
                                    'id', ru.id,
                                    'username', ru.username,
                                    'fullname', ru.full_name,
                                    'avatar_url', ru.avatar_url,
                                    'avatar_updated_at', ru.avatar_updated_at
                                )
                            )
                         from public.messages rm
                         left join public.users ru on rm.user_id = ru.id
                         where rm.id = m.reply_to_message_id and rm.deleted_at is null)
                    else null
                end as replied_message_details,
                (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
                mb.id as bookmark_id
            from public.messages m
            left join public.users u on m.user_id = u.id
            left join public.message_bookmarks mb on m.id = mb.message_id and mb.user_id = auth.uid()
            where m.channel_id = input_channel_id
                and m.deleted_at is null
                and not (m.type = 'notification' and m.metadata->>'type' in ('user_join_channel', 'channel_created'))
            order by m.created_at desc, m.id desc
            limit message_limit
        ) t;
    else
        if anchor_message_id is null and total_messages_since_last_read > message_limit / 2 then
            before_n := greatest(message_limit / 5, 1);
            after_n := message_limit - before_n;
        else
            before_n := greatest(message_limit / 2, 1);
            after_n := message_limit - before_n;
        end if;

        with messages_before as (
            select m.*,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'fullname', u.full_name,
                    'avatar_url', u.avatar_url,
                    'avatar_updated_at', u.avatar_updated_at
                ) as user_details,
                case
                    when m.reply_to_message_id is not null then
                        (select json_build_object(
                                'message', json_build_object(
                                    'id', rm.id,
                                    'created_at', rm.created_at
                                ),
                                'user', json_build_object(
                                    'id', ru.id,
                                    'username', ru.username,
                                    'fullname', ru.full_name,
                                    'avatar_url', ru.avatar_url,
                                    'avatar_updated_at', ru.avatar_updated_at
                                )
                            )
                         from public.messages rm
                         left join public.users ru on rm.user_id = ru.id
                         where rm.id = m.reply_to_message_id and rm.deleted_at is null)
                    else null
                end as replied_message_details,
                (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
                mb.id as bookmark_id
            from public.messages m
            left join public.users u on m.user_id = u.id
            left join public.message_bookmarks mb on m.id = mb.message_id and mb.user_id = auth.uid()
            where m.channel_id = input_channel_id
                and m.deleted_at is null
                and not (m.type = 'notification' and m.metadata->>'type' in ('user_join_channel', 'channel_created'))
                and m.created_at <= anchor_message_timestamp
            order by m.created_at desc, m.id desc
            limit before_n
        ),
        messages_after as (
            select m.*,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'fullname', u.full_name,
                    'avatar_url', u.avatar_url,
                    'avatar_updated_at', u.avatar_updated_at
                ) as user_details,
                case
                    when m.reply_to_message_id is not null then
                        (select json_build_object(
                                'message', json_build_object(
                                    'id', rm.id,
                                    'created_at', rm.created_at
                                ),
                                'user', json_build_object(
                                    'id', ru.id,
                                    'username', ru.username,
                                    'fullname', ru.full_name,
                                    'avatar_url', ru.avatar_url,
                                    'avatar_updated_at', ru.avatar_updated_at
                                )
                            )
                         from public.messages rm
                         left join public.users ru on rm.user_id = ru.id
                         where rm.id = m.reply_to_message_id and rm.deleted_at is null)
                    else null
                end as replied_message_details,
                (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
                mb.id as bookmark_id
            from public.messages m
            left join public.users u on m.user_id = u.id
            left join public.message_bookmarks mb on m.id = mb.message_id and mb.user_id = auth.uid()
            where m.channel_id = input_channel_id
                and m.deleted_at is null
                and not (m.type = 'notification' and m.metadata->>'type' in ('user_join_channel', 'channel_created'))
                and m.created_at > anchor_message_timestamp
            order by m.created_at asc, m.id asc
            limit after_n
        ),
        combined_messages as (
            select * from messages_before
            union all
            select * from (select * from messages_after order by created_at desc) as sorted_after
        )
        select coalesce(json_agg(cm), '[]'::json) into messages_result
        from (
            select * from combined_messages
            order by created_at desc, id desc
            limit message_limit
        ) cm;
    end if;

    select
        min((m->>'created_at')::timestamptz),
        max((m->>'created_at')::timestamptz)
    into older_cursor_result, newer_cursor_result
    from jsonb_array_elements(messages_result) as m;

    if older_cursor_result is not null then
        select exists (
            select 1
            from public.messages
            where channel_id = input_channel_id
              and deleted_at is null
              and not (type = 'notification' and metadata->>'type' in ('user_join_channel', 'channel_created'))
              and created_at < older_cursor_result
        ) into has_more_older_result;
    end if;

    if newer_cursor_result is not null then
        select exists (
            select 1
            from public.messages
            where channel_id = input_channel_id
              and deleted_at is null
              and not (type = 'notification' and metadata->>'type' in ('user_join_channel', 'channel_created'))
              and created_at > newer_cursor_result
        ) into has_more_newer_result;
    end if;

    select coalesce(json_agg(pm), '[]'::json) into pinned_result
    from public.pinned_messages pm
    join public.messages m on pm.message_id = m.id
    where pm.channel_id = input_channel_id
      and m.deleted_at is null;

    return query select
        channel_result,
        messages_result,
        pinned_result,
        is_member_result,
        channel_member_info_result,
        coalesce(total_messages_since_last_read, 0),
        unread_message,
        last_read_message_id,
        last_read_message_timestamp,
        last_read_seq_result,
        anchor_message_timestamp,
        older_cursor_result,
        newer_cursor_result,
        has_more_older_result,
        has_more_newer_result;
end;
$$ language plpgsql stable;

alter function public.get_channel_aggregate_data(input_channel_id varchar, message_limit int, anchor_message_id uuid) set search_path = public;
