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
begin
    -- Get the username of the joining member
    select username into joining_username
    from public.users
    where id = new.member_id;

    -- Get the workspace name
    select name into workspace_name
    from public.workspaces
    where id = new.workspace_id;

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
        new.workspace_id,
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
