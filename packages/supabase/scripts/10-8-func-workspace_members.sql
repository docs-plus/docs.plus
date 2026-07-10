-- Posts a synthetic notification message into the workspace's channel
-- when a new member joins, so the chat shows a "joined" line.
create or replace function notify_user_join_workspace()
returns trigger as $$
declare
    joining_username text;
    workspace_name text;
    workspace_channel_id varchar(36);
begin
    -- Get the username of the joining member
    select username into joining_username
    from public.users
    where id = new.member_id;

    -- Get the workspace name
    select name into workspace_name
    from public.workspaces
    where id = new.workspace_id;

    -- Check if channel exists for this workspace
    select id into workspace_channel_id
    from public.channels
    where id = new.workspace_id
    limit 1;

    -- If no channel exists, create one
    if workspace_channel_id is null then
        insert into public.channels (
            id,
            workspace_id,
            slug,
            name,
            created_by,
            description,
            type
        ) values (
            new.workspace_id,
            new.workspace_id,
            'c' || regexp_replace(lower(new.workspace_id), '[^a-z0-9]', '', 'g'),
            regexp_replace(lower(new.workspace_id), '[^a-z0-9]', '', 'g'),
            '992bb85e-78f8-4747-981a-fd63d9317ff1', -- System user ID
            'Main workspace channel',
            'PUBLIC'
        ) returning id into workspace_channel_id;
    end if;

    -- Create the notification message
    insert into public.messages (
        user_id,
        channel_id,
        type,
        content,
        metadata
    )
    values (
        new.member_id,
        workspace_channel_id,
        'notification',
        '@' || joining_username || ' joined the workspace ',
        jsonb_build_object(
            'type', 'user_join_workspace',
            'user_name', joining_username,
            'user_id', new.member_id,
            'workspace_name', workspace_name
        )
    );

    return new;
end;
$$ language plpgsql;

comment on function notify_user_join_workspace() is
'Creates a notification message when a user joins a workspace.';

-- Trigger: notify_on_workspace_join
drop trigger if exists notify_on_workspace_join on public.workspace_members;
create trigger notify_on_workspace_join
after insert on public.workspace_members
for each row
execute function notify_user_join_workspace();

comment on trigger notify_on_workspace_join on public.workspace_members is
'Creates a notification when a user joins a workspace.';


-- =============================================================================
-- Admin: document member counts (used by admin dashboard)
-- =============================================================================

-- Returns workspace member counts for a batch of document slugs.
-- SECURITY DEFINER bypasses RLS; guarded by is_admin() for authenticated
-- callers and allows service_role (backend) direct access.

create or replace function public.admin_get_document_member_counts(p_slugs text[])
returns table (
    slug text,
    member_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_jwt_role text;
begin
    -- Allow: service_role (backend API) or authenticated admin
    v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');

    if v_jwt_role not in ('service_role') then
        if auth.uid() is not null and not public.is_admin(auth.uid()) then
            raise exception 'Access denied: user is not an admin.';
        end if;
    end if;

    return query
    select
        w.slug,
        count(wm.id) as member_count
    from public.workspaces w
    left join public.workspace_members wm
        on wm.workspace_id = w.id
        and wm.left_at is null
    where w.slug = any(p_slugs)
    group by w.slug;
end;
$$;

comment on function public.admin_get_document_member_counts(text[]) is
'Returns workspace member counts per document slug. Admin-only or service_role, bypasses RLS.';

revoke execute on function public.admin_get_document_member_counts(text[]) from anon;
grant execute on function public.admin_get_document_member_counts(text[]) to authenticated;
grant execute on function public.admin_get_document_member_counts(text[]) to service_role;

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.notify_user_join_workspace() SET search_path = public;
ALTER FUNCTION public.admin_get_document_member_counts(p_slugs text[]) SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.notify_user_join_workspace() SECURITY DEFINER;


-- =============================================================================
-- Owner document member roster (Settings → My documents)
-- =============================================================================
-- Membership = "opened a document while signed in". No roles, no anonymous
-- viewers, no realtime presence. The membership gate is the caller's own
-- workspace membership, so a non-member gets 0 rows (never an error).
-- Slug → workspace id is resolved through the workspaces join; never compare
-- a slug to workspace_id (varchar36). Distinct from admin_get_document_member_counts,
-- which is is_admin-gated for the admin dashboard.

-- Batched avatar-cluster previews for the visible document list. Returns the
-- true member_count plus up to 4 earliest-joined members per slug as jsonb.
drop function if exists public.get_document_member_previews(text[]);
create function public.get_document_member_previews(p_slugs text[])
returns table (
    slug text,
    member_count bigint,
    previews jsonb
)
language sql
stable
security definer
set search_path = public
as $$
    with ranked as (
        select
            w.slug as ws_slug,
            wm.member_id,
            u.display_name,
            u.avatar_url,
            u.avatar_updated_at,
            row_number() over (partition by w.id order by wm.created_at asc) as rn
        from public.workspaces w
        join public.workspace_members wm
            on wm.workspace_id = w.id
            and wm.left_at is null
        join public.users u
            on u.id = wm.member_id
        where w.slug = any(p_slugs)
          and internal.is_workspace_member(w.id)
    )
    select
        ws_slug as slug,
        count(*)::bigint as member_count,
        jsonb_agg(
            jsonb_build_object(
                'member_id', member_id,
                'display_name', display_name,
                'avatar_url', avatar_url,
                'avatar_updated_at', avatar_updated_at
            ) order by rn
        ) filter (where rn <= 4) as previews
    from ranked
    group by ws_slug;
$$;

comment on function public.get_document_member_previews(text[]) is
'Member-gated avatar-cluster previews (member_count + up to 4 earliest members) per document slug. Caller must be an active workspace member; non-member slugs return no row.';

revoke execute on function public.get_document_member_previews(text[]) from anon;
grant execute on function public.get_document_member_previews(text[]) to authenticated;

-- Full roster for one document when the cluster popover opens. Caller sorts
-- first, then by join order. last_visit_at falls back to join time.
drop function if exists public.get_document_members(text);
create function public.get_document_members(p_slug text)
returns table (
    member_id uuid,
    username text,
    display_name text,
    full_name text,
    avatar_url text,
    avatar_updated_at timestamptz,
    joined_at timestamptz,
    last_visit_at timestamptz,
    is_caller boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select
        wm.member_id,
        u.username,
        u.display_name,
        u.full_name,
        u.avatar_url,
        u.avatar_updated_at,
        wm.created_at as joined_at,
        coalesce(wm.updated_at, wm.created_at) as last_visit_at,
        (wm.member_id = auth.uid()) as is_caller
    from public.workspaces w
    join public.workspace_members wm
        on wm.workspace_id = w.id
        and wm.left_at is null
    join public.users u
        on u.id = wm.member_id
    where w.slug = p_slug
      and internal.is_workspace_member(w.id)
    order by (wm.member_id = auth.uid()) desc, wm.created_at asc;
$$;

comment on function public.get_document_members(text) is
'Member-gated full member roster for one document slug (caller first, then join order). Caller must be an active workspace member; non-member returns no rows.';

revoke execute on function public.get_document_members(text) from anon;
grant execute on function public.get_document_members(text) to authenticated;
