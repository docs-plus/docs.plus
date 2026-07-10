-- Owner document member roster (Settings → My documents).
-- Mirrors scripts/10-8-func-workspace_members.sql (two RPCs) and the
-- join_workspace last-visit refresh in scripts/10-functions.sql.
-- Membership = "opened a document while signed in": no roles, no anonymous
-- viewers, no realtime presence. Gated by caller workspace membership, so a
-- non-member gets 0 rows (never an error). Slug → workspace id via the
-- workspaces join; never compare a slug to workspace_id (varchar36).

-- ---------------------------------------------------------------------------
-- Batched avatar-cluster previews for the visible document list.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Full roster for one document when the cluster popover opens.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- join_workspace: refresh "last visit" (updated_at) on the already-member
-- branch so the roster's last-seen time is real. Full-body replace.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_workspace(
    _workspace_id VARCHAR(36)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the current user ID
    user_id := auth.uid();

    -- Check if the user ID is valid
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. User ID is NULL.';
    END IF;

    -- Check if the workspace exists and is not deleted, create if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = _workspace_id AND deleted_at IS NULL
    ) THEN
        -- Create the workspace with the given ID
        INSERT INTO public.workspaces (id, name, slug, created_by)
        VALUES (_workspace_id, _workspace_id, lower(_workspace_id), user_id);
    END IF;

    -- Check if user is already a member of this workspace
    IF EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = _workspace_id AND member_id = user_id
    ) THEN
        -- Refresh "last visit" so the member roster shows a real last-seen time.
        UPDATE public.workspace_members
        SET updated_at = timezone('utc', now())
        WHERE workspace_id = _workspace_id AND member_id = user_id;
        -- Return true if the user is already a member
        RETURN TRUE;
    END IF;

    -- Insert new workspace member record
    INSERT INTO public.workspace_members (workspace_id, member_id)
    VALUES (_workspace_id, user_id);

        -- For new workspace members, create channel_members entries for all channels in this workspace
    -- Use a single INSERT with CTEs for optimal performance
    INSERT INTO public.channel_members (
        channel_id,
        member_id,
        unread_message_count,
        last_read_message_id,
        last_read_update_at
    )
    WITH channel_data AS (
        SELECT
            cmc.channel_id,
            cmc.message_count,
            c.created_at as channel_created_at
        FROM public.channel_message_counts cmc
        JOIN public.channels c ON c.id = cmc.channel_id
        WHERE cmc.workspace_id = _workspace_id
          AND c.deleted_at IS NULL
    ),
    first_messages AS (
        SELECT DISTINCT ON (m.channel_id)
            m.channel_id,
            m.id as first_message_id
        FROM public.messages m
        WHERE m.channel_id IN (SELECT channel_id FROM channel_data)
          AND m.deleted_at IS NULL
        ORDER BY m.channel_id, m.created_at ASC
    )
    SELECT
        cd.channel_id,
        user_id,
        cd.message_count,
        fm.first_message_id,
        cd.channel_created_at
    FROM channel_data cd
    LEFT JOIN first_messages fm ON fm.channel_id = cd.channel_id
    ON CONFLICT (channel_id, member_id) DO NOTHING;

    RETURN TRUE;
END;
$$;
