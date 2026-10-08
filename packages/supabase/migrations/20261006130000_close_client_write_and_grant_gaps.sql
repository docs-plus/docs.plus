-- Issues #397, #401, #409 and #410. Close grant and client-write gaps that only scripts/ closed.
-- No RPC signature or return type changes. Production already denies the #397 functions, so that part is a no-op there.
-- Pairs with scripts/03-0-workspaces.sql, 07-bookmark-functions.sql, 10-5-func-replied_msg.sql, 13-RLS.sql and 29-lint-hardening.sql.


-- #397. The ghost-account helpers were applied to production by hand. Copied from scripts/28-ghost-accounts-audit.sql.

create or replace function public.get_inactive_users(
  p_min_age_days integer default 30
)
returns table (
  user_id uuid,
  email text,
  username text,
  online_at timestamptz,
  created_at timestamptz,
  age_days integer,
  message_count bigint,
  channel_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.id as user_id,
    u.email,
    u.username,
    u.online_at,
    u.created_at,
    extract(day from now() - u.created_at)::integer as age_days,
    (select count(*) from public.messages m where m.user_id = u.id) as message_count,
    (select count(*) from public.channel_members cm where cm.member_id = u.id) as channel_count
  from public.users u
  where u.online_at is null
    and u.deleted_at is null
    and u.created_at < now() - (p_min_age_days || ' days')::interval
  order by u.created_at asc;
$$;

comment on function public.get_inactive_users(integer) is
'Returns public.users who have never been active (online_at IS NULL). Used by ghost accounts audit.';

create or replace function public.get_user_deletion_impact(p_user_id uuid)
returns table (
  message_count bigint,
  channel_memberships bigint,
  push_subscriptions bigint,
  email_queue_items bigint,
  notifications_received bigint,
  has_blocking_messages boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.messages where user_id = p_user_id) as message_count,
    (select count(*) from public.channel_members where member_id = p_user_id) as channel_memberships,
    (select count(*) from public.push_subscriptions where user_id = p_user_id) as push_subscriptions,
    (select count(*) from public.email_queue where user_id = p_user_id) as email_queue_items,
    (select count(*) from public.notifications where receiver_user_id = p_user_id) as notifications_received,
    -- messages.user_id has NO ACTION — will block hard-delete if count > 0
    exists(select 1 from public.messages where user_id = p_user_id) as has_blocking_messages;
$$;

comment on function public.get_user_deletion_impact(uuid) is
'Returns FK dependency counts for a user. has_blocking_messages=true means hard-delete will fail (messages.user_id NO ACTION).';

create or replace function public.get_ghost_summary_public()
returns table (
  total_public_users bigint,
  never_active_count bigint,
  soft_deleted_count bigint,
  active_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.users) as total_public_users,
    (select count(*) from public.users where online_at is null and deleted_at is null) as never_active_count,
    (select count(*) from public.users where deleted_at is not null) as soft_deleted_count,
    (select count(*) from public.users where online_at is not null and deleted_at is null) as active_count;
$$;

comment on function public.get_ghost_summary_public() is
'Returns summary counts from public.users: total, never active, soft-deleted, and active.';


-- #397. Only the service role or pg_cron calls these. Hosted Supabase grants new functions to anon and authenticated, so name all three roles.

revoke all on function public.purge_document_footprint(varchar, text) from public, anon, authenticated;
revoke all on function public.consume_push_queue(integer, integer) from public, anon, authenticated;
revoke all on function public.ack_push_message(bigint) from public, anon, authenticated;
revoke all on function public.get_inactive_users(integer) from public, anon, authenticated;
revoke all on function public.get_user_deletion_impact(uuid) from public, anon, authenticated;
revoke all on function public.get_ghost_summary_public() from public, anon, authenticated;
revoke all on function public.admin_get_document_member_counts(text[]) from public, anon, authenticated;
revoke all on function public.create_direct_message_channel(varchar, uuid) from public, anon, authenticated;
revoke all on function public.enqueue_document_view(text, text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.update_view_duration(uuid, integer) from public, anon, authenticated;
revoke all on function public.process_document_views_queue() from public, anon, authenticated;
revoke all on function public.get_workspace_media_storage_stats(varchar) from public, anon, authenticated;
revoke all on function public.get_all_workspace_media_storage_stats() from public, anon, authenticated;
revoke all on function public.get_workspace_media_storage_summary() from public, anon, authenticated;

grant execute on function public.purge_document_footprint(varchar, text) to service_role;
grant execute on function public.consume_push_queue(integer, integer) to service_role;
grant execute on function public.ack_push_message(bigint) to service_role;
grant execute on function public.get_inactive_users(integer) to service_role;
grant execute on function public.get_user_deletion_impact(uuid) to service_role;
grant execute on function public.get_ghost_summary_public() to service_role;
grant execute on function public.admin_get_document_member_counts(text[]) to service_role;
grant execute on function public.create_direct_message_channel(varchar, uuid) to service_role;
grant execute on function public.enqueue_document_view(text, text, uuid, boolean, text) to service_role;
grant execute on function public.update_view_duration(uuid, integer) to service_role;
grant execute on function public.process_document_views_queue() to service_role;
grant execute on function public.get_workspace_media_storage_stats(varchar) to service_role;
grant execute on function public.get_all_workspace_media_storage_stats() to service_role;
grant execute on function public.get_workspace_media_storage_summary() to service_role;


-- #401. No client path updates channels. Every SQL writer is SECURITY DEFINER. The table revoke also clears the column grant.

drop policy if exists channels_member_update on public.channels;
revoke update on public.channels from authenticated, anon;


-- #409. join_workspace (SECURITY DEFINER) is the only writer. The insert policy only let a user squat a document id.

drop policy if exists workspaces_creator_insert on public.workspaces;
revoke insert, update on public.workspaces from authenticated, anon;

comment on column public.workspaces.created_by is
'First signed-in visitor to open the document: join_workspace() auto-bootstraps the workspace row and stamps auth.uid() of whoever got there first. NOT ownership — that is Prisma DocumentMetadata.ownerId. Nothing reads this column.';


-- #410. A reply must stay in its parent's channel. Otherwise the trigger copies any message's preview, and the parent's author gets a notification.

create or replace function public.set_replied_message_preview()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    parent_channel_id public.messages.channel_id%type;
    original_message_content text;
    original_medias jsonb;
    original_type public.message_type;
    truncated_content text;
begin
    if new.reply_to_message_id is not null then
        -- No deleted_at filter: create_reply_notification reads a soft-deleted parent too.
        select channel_id
          into parent_channel_id
          from public.messages
         where id = new.reply_to_message_id;

        if found and parent_channel_id is distinct from new.channel_id then
            raise exception 'Reply parent % is in another channel.', new.reply_to_message_id
                using errcode = '22023';
        end if;

        select content, medias, type
          into original_message_content, original_medias, original_type
          from public.messages
         where id = new.reply_to_message_id and deleted_at is null;

        if found then
            truncated_content := message_content_preview(
                original_message_content,
                original_medias,
                original_type
            );
            new.replied_message_preview := truncated_content;
        else
            new.replied_message_preview := 'The original message is not available.';
        end if;
    end if;

    return new;
end;
$$;

-- Bookmark writes go through DEFINER RPCs only: toggle_message_bookmark, archive_bookmark and mark_bookmark_as_read.
revoke insert, update, delete on public.message_bookmarks from authenticated, anon;

-- Same signature and return table as 20260625150000. The new filter hides a bookmark of a message the caller cannot read.
create or replace function public.get_user_bookmarks(
    p_workspace_id varchar(36) default null,
    p_archived boolean default false,
    p_limit int default 50,
    p_offset int default 0,
    p_marked_as_read boolean default null
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
        message_content_preview(m.content, m.medias, m.type) as message_content,
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
        and internal.can_read_channel(m.channel_id)
        and (p_workspace_id is null or w.id = p_workspace_id)
        and (
            (p_archived = true and mb.archived_at is not null)
            or (p_archived = false and mb.archived_at is null)
        )
        and (
            p_marked_as_read is null
            or (p_marked_as_read = true and mb.marked_at is not null)
            or (p_marked_as_read = false and mb.marked_at is null)
        )
    order by mb.created_at desc
    limit p_limit
    offset p_offset;
end;
$$;
