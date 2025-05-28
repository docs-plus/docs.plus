-- Function: toggle_message_bookmark
-- Description: Toggles a bookmark for a message. If bookmark exists, removes it. If not, creates it.
create or replace function public.toggle_message_bookmark(
    p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_bookmark_id bigint;
    v_action text;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Check if bookmark already exists
    select id into v_bookmark_id
    from message_bookmarks
    where user_id = v_user_id and message_id = p_message_id;

    if v_bookmark_id is not null then
        -- Bookmark exists, remove it
        delete from message_bookmarks
        where id = v_bookmark_id;
        v_action := 'removed';
    else
        -- Bookmark doesn't exist, create it
        insert into message_bookmarks (user_id, message_id)
        values (v_user_id, p_message_id)
        returning id into v_bookmark_id;
        v_action := 'added';
    end if;

    return jsonb_build_object(
        'action', v_action,
        'bookmark_id', v_bookmark_id,
        'message_id', p_message_id
    );
end;
$$;

comment on function public.toggle_message_bookmark is 'Toggles a bookmark for a message. Returns the action taken (added/removed) and relevant IDs.';

-- Function: get_user_bookmarks
-- Description: Gets all bookmarked messages for the current user with message details
create or replace function public.get_user_bookmarks(
    p_workspace_id varchar(36) default null,
    p_archived boolean default false,
    p_limit int default 50,
    p_offset int default 0
)
returns table (
    bookmark_id bigint,
    bookmark_created_at timestamptz,
    bookmark_updated_at timestamptz,
    bookmark_archived_at timestamptz,
    bookmark_marked_at timestamptz,
    bookmark_metadata jsonb,
    message_id uuid,
    message_content text,
    message_html text,
    message_created_at timestamptz,
    message_user_id uuid,
    message_channel_id varchar,
    message_type message_type,
    user_details jsonb,
    channel_name text,
    channel_slug text,
    workspace_id varchar,
    workspace_name text,
    workspace_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    return query
    select
        mb.id as bookmark_id,
        mb.created_at as bookmark_created_at,
        mb.updated_at as bookmark_updated_at,
        mb.archived_at as bookmark_archived_at,
        mb.marked_at as bookmark_marked_at,
        mb.metadata as bookmark_metadata,
        m.id as message_id,
        m.content as message_content,
        m.html as message_html,
        m.created_at as message_created_at,
        m.user_id as message_user_id,
        m.channel_id as message_channel_id,
        m.type as message_type,
        user_details_json(u) as user_details,
        c.name as channel_name,
        c.slug as channel_slug,
        w.id as workspace_id,
        w.name as workspace_name,
        w.slug as workspace_slug
    from message_bookmarks mb
    join messages m on mb.message_id = m.id
    join users u on m.user_id = u.id
    join channels c on m.channel_id = c.id
    join workspaces w on c.workspace_id = w.id
    where mb.user_id = v_user_id
        and m.deleted_at is null
        and c.deleted_at is null
        and w.deleted_at is null
        and (p_workspace_id is null or w.id = p_workspace_id)
        and (
            (p_archived = true and mb.archived_at is not null)
            or (p_archived = false and mb.archived_at is null)
        )
    order by mb.created_at desc
    limit p_limit
    offset p_offset;
end;
$$;

comment on function public.get_user_bookmarks is 'Retrieves bookmarked messages for the current user with full message and channel context. Can filter by workspace and archived status.';

-- Function: archive_bookmark
-- Description: Archives or unarchives a bookmark
create or replace function public.archive_bookmark(
    p_bookmark_id bigint,
    p_archive boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_updated_count int;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Update the bookmark archive status
    update message_bookmarks
    set archived_at = case
        when p_archive then timezone('utc', now())
        else null
    end
    where id = p_bookmark_id
        and user_id = v_user_id;

    get diagnostics v_updated_count = row_count;

    return v_updated_count > 0;
end;
$$;

comment on function public.archive_bookmark is 'Archives or unarchives a bookmark. Returns true if successful, false if bookmark not found or not owned by user.';

-- Function: mark_bookmark_as_read
-- Description: Marks or unmarks a bookmark as read
create or replace function public.mark_bookmark_as_read(
    p_bookmark_id bigint,
    p_mark_as_read boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_updated_count int;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Update the bookmark read status
    update message_bookmarks
    set marked_at = case
        when p_mark_as_read then timezone('utc', now())
        else null
    end
    where id = p_bookmark_id
        and user_id = v_user_id;

    get diagnostics v_updated_count = row_count;

    return v_updated_count > 0;
end;
$$;

comment on function public.mark_bookmark_as_read is 'Marks or unmarks a bookmark as read. Returns true if successful, false if bookmark not found or not owned by user.';

-- Function: get_bookmark_count
-- Description: Gets the total count of bookmarks for the current user
create or replace function public.get_bookmark_count(
    p_workspace_id varchar(36) default null,
    p_archived boolean default false
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_count int;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    select count(*)::int into v_count
    from message_bookmarks mb
    join messages m on mb.message_id = m.id
    join channels c on m.channel_id = c.id
    join workspaces w on c.workspace_id = w.id
    where mb.user_id = v_user_id
        and m.deleted_at is null
        and c.deleted_at is null
        and w.deleted_at is null
        and (p_workspace_id is null or w.id = p_workspace_id)
        and (
            (p_archived = true and mb.archived_at is not null)
            or (p_archived = false and mb.archived_at is null)
        );

    return v_count;
end;
$$;

comment on function public.get_bookmark_count is 'Returns the total number of bookmarks for the current user. Can filter by workspace and archived status.';

-- Function: get_bookmark_stats
-- Description: Gets bookmark statistics for the current user
create or replace function public.get_bookmark_stats(
    p_workspace_id varchar(36) default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_total int := 0;
    v_archived int := 0;
    v_unread int := 0;
    v_read int := 0;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Get counts
    select
        count(*)::int,
        count(case when mb.archived_at is not null then 1 end)::int,
        count(case when mb.marked_at is null then 1 end)::int,
        count(case when mb.marked_at is not null then 1 end)::int
    into v_total, v_archived, v_unread, v_read
    from message_bookmarks mb
    join messages m on mb.message_id = m.id
    join channels c on m.channel_id = c.id
    join workspaces w on c.workspace_id = w.id
    where mb.user_id = v_user_id
        and m.deleted_at is null
        and c.deleted_at is null
        and w.deleted_at is null
        and (p_workspace_id is null or w.id = p_workspace_id);

    return jsonb_build_object(
        'total', v_total,
        'archived', v_archived,
        'active', v_total - v_archived,
        'unread', v_unread,
        'read', v_read
    );
end;
$$;

comment on function public.get_bookmark_stats is 'Returns bookmark statistics for the current user including total, archived, active, read, and unread counts.';
