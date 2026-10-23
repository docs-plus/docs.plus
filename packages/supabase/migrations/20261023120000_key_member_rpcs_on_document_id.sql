-- Issue #574. Member faces, roster and admin counts matched workspaces.slug, which holds the
-- human slug for workspaces made before 2026-08-09. All three now match workspaces.id with the
-- documentId verbatim. Pairs with scripts/10-8-func-workspace_members.sql. Ship with the webapp
-- and backend that send p_document_ids / p_document_id; an older client errors until then.

set local lock_timeout = '5s';

drop function if exists public.admin_get_document_member_counts(text[]);
create function public.admin_get_document_member_counts(p_document_ids text[])
returns table (
    document_id text,
    member_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
    select
        w.id::text as document_id,
        count(wm.id) as member_count
    from public.workspaces w
    left join public.workspace_members wm
        on wm.workspace_id = w.id
        and wm.left_at is null
    where w.id = any(p_document_ids)
    group by w.id;
$$;

comment on function public.admin_get_document_member_counts(text[]) is
'Returns workspace member counts per documentId (workspaces.id, exact case). Service role only; bypasses RLS.';

revoke all on function public.admin_get_document_member_counts(text[]) from public, anon, authenticated;
grant execute on function public.admin_get_document_member_counts(text[]) to service_role;

drop function if exists public.get_document_member_previews(text[]);
create function public.get_document_member_previews(p_document_ids text[])
returns table (
    document_id text,
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
            w.id::text as ws_id,
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
        where w.id = any(p_document_ids)
          and internal.is_workspace_member(w.id)
    )
    select
        ws_id as document_id,
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
    group by ws_id;
$$;

comment on function public.get_document_member_previews(text[]) is
'Member-gated avatar-cluster previews (member_count + up to 4 earliest members) per documentId (workspaces.id, exact case). Caller must be an active workspace member; a non-member document returns no row.';

revoke execute on function public.get_document_member_previews(text[]) from public, anon;
grant execute on function public.get_document_member_previews(text[]) to authenticated, service_role;

-- Full roster for one document when the cluster popover opens. Caller sorts
-- first, then by join order. last_visit_at falls back to join time.
drop function if exists public.get_document_members(text);
create function public.get_document_members(p_document_id text)
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
    where w.id = p_document_id
      and internal.is_workspace_member(w.id)
    order by (wm.member_id = auth.uid()) desc, wm.created_at asc;
$$;

comment on function public.get_document_members(text) is
'Member-gated full member roster for one documentId (workspaces.id, exact case), caller first, then join order. Caller must be an active workspace member; non-member returns no rows.';

revoke execute on function public.get_document_members(text) from public, anon;
grant execute on function public.get_document_members(text) to authenticated, service_role;

comment on function public.get_document_follow_state(varchar) is
'Returns the caller''s content-change follow state for one document: true when following, false when muted, null when the caller has no active membership. p_document_id is the documentId verbatim, the value held in workspace_members.workspace_id, never workspaces.slug.';

comment on function public.set_document_follow(varchar, boolean) is
'Sets the caller''s content-change follow state for one document. p_document_id is the documentId verbatim, the value held in workspace_members.workspace_id and workspaces.id, never workspaces.slug. UPDATE-only, and never writes updated_at. Returns true when a membership row matched, false when the caller has no active membership.';

comment on function public.mark_document_connection_closed(varchar, uuid, timestamptz) is
'Stamps the instant one live document session ended for one member. p_document_id is the documentId verbatim, the value held in workspace_members.workspace_id and workspaces.id, never workspaces.slug. UPDATE-only, so it never mints a membership row, and it never writes updated_at. The write is monotone, so a p_closed_at older than the stored value leaves the value alone. A p_closed_at after now() is clamped to now(). Returns true when an active membership row matched, which does not say the stamp advanced.';
