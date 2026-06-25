-- get_bookmark_stats counted marked_at across archived rows too, so the In Progress
-- tab badge included archived bookmarks the list never shows.

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
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    select
        count(*)::int,
        count(case when mb.archived_at is not null then 1 end)::int,
        count(case when mb.archived_at is null and mb.marked_at is null then 1 end)::int,
        count(case when mb.archived_at is null and mb.marked_at is not null then 1 end)::int
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

comment on function public.get_bookmark_stats is 'Bookmark panel tab counts: unread = in progress (non-archived, unmarked), archived, read = non-archived marked.';
