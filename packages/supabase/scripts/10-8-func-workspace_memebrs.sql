/**
 * Function: notify_user_join_workspace
 * Description: Creates a notification message when a user joins a workspace
 * Trigger: Executes after INSERT on public.workspace_members
 * Action: Creates a notification message showing who joined
 * Returns: The NEW record (trigger standard)
 */
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
