/*
 * Channel Management Functions
 * This file contains functions and triggers related to channel operations:
 * - Channel creation and membership
 * - Channel notifications
 * - Member counts and activity tracking
 */

/**
 * Function: add_channel_creator_as_admin
 * Description: Adds the creator of a new channel as an admin member
 * Trigger: Executes after INSERT on public.channels
 * Action: Inserts a record into channel_members with ADMIN role for the creator
 * Returns: The NEW record (trigger standard)
 */
create or replace function add_channel_creator_as_admin()
returns trigger as $$
begin
    -- Insert the channel creator as an admin member
    insert into public.channel_members (
        channel_id,
        member_id,
        channel_member_role,
        joined_at
    )
    values (
        new.id,
        new.created_by,
        'ADMIN',
        now()
    );

    return new;
end;
$$ language plpgsql;

comment on function add_channel_creator_as_admin() is
'Adds the creator of a new channel as an admin member in the channel_members table.';

-- Trigger: channel_creator_as_admin
create trigger channel_creator_as_admin
after insert on public.channels
for each row
execute function add_channel_creator_as_admin();

comment on trigger channel_creator_as_admin on public.channels is
'Automatically adds the channel creator as an admin member when a new channel is created.';

/**
 * Function: create_channel_notification
 * Description: Creates a system notification message when a new channel is created
 * Trigger: Executes after INSERT on public.channels
 * Action: Creates a notification message in the new channel
 * Returns: The NEW record (trigger standard)
 */
create or replace function create_channel_notification()
returns trigger as $$
begin
    insert into public.messages (
        channel_id,
        type,
        user_id,
        content,
        metadata
    )
    values (
        new.id,
        'notification',
        '992bb85e-78f8-4747-981a-fd63d9317ff1', -- System user ID
        'Channel created',
        jsonb_build_object(
            'type', 'channel_created'
        )
    );

    return new;
end;
$$ language plpgsql;

comment on function create_channel_notification() is
'Creates a system notification message when a new channel is created.';

-- Trigger: notify_channel_creation
create trigger notify_channel_creation
after insert on public.channels
for each row
execute function create_channel_notification();

comment on trigger notify_channel_creation on public.channels is
'Creates a notification message when a new channel is created.';

/* Legacy code - kept for reference but commented out
create or replace function update_last_read_time()
returns trigger as $$
begin
    -- Update the last_read_update_at if there's a change in last_read_message_id
    if old.last_read_message_id is distinct from new.last_read_message_id then
        new.last_read_update_at := timezone('utc', now());
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trigger_update_last_read_time
before update on public.channel_members
for each row
execute function update_last_read_time();
*/

/**
 * Function: notify_channel_name_change
 * Description: Creates a system notification when a channel's name is changed
 * Trigger: Executes after UPDATE of name on public.channels
 * Action: Creates a notification message with the new channel name
 * Returns: The NEW record (trigger standard)
 */
create or replace function notify_channel_name_change()
returns trigger as $$
begin
    if old.name is distinct from new.name then
        insert into public.messages (
            channel_id,
            type,
            user_id,
            content,
            metadata
        )
        values (
            new.id,
            'notification',
            '992bb85e-78f8-4747-981a-fd63d9317ff1', -- System user ID
            'Channel renamed to "' || new.name || '"',
            jsonb_build_object(
                'type', 'channel_name_changed',
                'name', new.name
            )
        );
    end if;

    return new;
end;
$$ language plpgsql;

comment on function notify_channel_name_change() is
'Creates a system notification message when a channel name is changed.';

-- Trigger: notify_on_channel_name_change
create trigger notify_on_channel_name_change
after update of name on public.channels
for each row
when (old.name is distinct from new.name)
execute function notify_channel_name_change();

comment on trigger notify_on_channel_name_change on public.channels is
'Creates a notification when a channel name is changed.';

/**
 * Function: notify_user_join_channel
 * Description: Creates a notification message when a user joins a channel
 * Trigger: Executes after INSERT on public.channel_members
 * Action: Creates a notification message showing who joined
 * Returns: The NEW record (trigger standard)
 */
create or replace function notify_user_join_channel()
returns trigger as $$
declare
    joining_username text;
    channel_workspace_id varchar(36);
begin
    -- Skip if this is a workspace channel
    select workspace_id into channel_workspace_id
    from public.channels
    where id = new.channel_id;

    if channel_workspace_id = new.channel_id then
        return new;
    end if;

    -- Get the username of the joining member
    select username into joining_username
    from public.users
    where id = new.member_id;

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
        new.channel_id,
        'notification',
        joining_username || ' joined the channel',
        jsonb_build_object(
            'type', 'user_join_channel',
            'user_name', joining_username
        )
    );

    return new;
end;
$$ language plpgsql;

comment on function notify_user_join_channel() is
'Creates a notification message when a user joins a channel.';

-- Trigger: notify_on_user_join
create trigger notify_on_user_join
after insert on public.channel_members
for each row
execute function notify_user_join_channel();

comment on trigger notify_on_user_join on public.channel_members is
'Creates a notification when a user joins a channel.';

/**
 * Function: notify_user_leave_channel
 * Description: Creates a notification message when a user leaves a channel
 * Trigger: Executes after DELETE on public.channel_members
 * Action: Creates a notification message showing who left
 * Returns: The OLD record (trigger standard)
 */
create or replace function notify_user_leave_channel()
returns trigger as $$
declare
    leaving_username text;
begin
    -- Get the username of the leaving member
    select username into leaving_username
    from public.users
    where id = old.member_id;

    -- Check if the channel still exists before creating notification
    if exists (select 1 from public.channels where id = old.channel_id) then
        insert into public.messages (
            user_id,
            channel_id,
            type,
            content,
            metadata
        )
        values (
            old.member_id,
            old.channel_id,
            'notification',
            leaving_username || ' left the channel',
            jsonb_build_object(
                'type', 'user_leave_channel',
                'user_name', leaving_username
            )
        );
    end if;

    return old;
end;
$$ language plpgsql;

comment on function notify_user_leave_channel() is
'Creates a notification message when a user leaves a channel.';

-- Trigger: notify_on_user_leave
create trigger notify_on_user_leave
after delete on public.channel_members
for each row
execute function notify_user_leave_channel();

comment on trigger notify_on_user_leave on public.channel_members is
'Creates a notification when a user leaves a channel.';

/**
 * Function: increment_channel_member_count
 * Description: Increments the member_count of a channel when a new member is added
 * Trigger: Executes after INSERT on public.channel_members
 * Action: Updates the member_count in channels table by adding 1
 * Returns: The NEW record (trigger standard)
 * Note: Will be rolled back automatically if the transaction is rolled back
 */
create or replace function increment_channel_member_count()
returns trigger as $$
begin
    update public.channels
    set member_count = member_count + 1
    where id = new.channel_id;

    return new;
end;
$$ language plpgsql;

comment on function increment_channel_member_count() is
'Increments the member count of a channel when a new member is added.';

-- Trigger: increment_member_count
create trigger increment_member_count
after insert on public.channel_members
for each row
execute function increment_channel_member_count();

comment on trigger increment_member_count on public.channel_members is
'Automatically increments the member count when a new member is added to a channel.';

/**
 * Function: decrement_channel_member_count
 * Description: Decrements the member_count of a channel when a member is removed
 * Trigger: Executes after DELETE on public.channel_members
 * Action: Updates the member_count in channels table by subtracting 1
 * Returns: The OLD record (trigger standard)
 * Note: Will handle member removal from both explicit leave and cascade delete when a user is deleted
 */
create or replace function decrement_channel_member_count()
returns trigger as $$
begin
    update public.channels
    set member_count = member_count - 1
    where id = old.channel_id;

    return old;
end;
$$ language plpgsql;

comment on function decrement_channel_member_count() is
'Decrements the member count of a channel when a member is removed.';

-- Trigger: decrement_member_count
create trigger decrement_member_count
after delete on public.channel_members
for each row
execute function decrement_channel_member_count();

comment on trigger decrement_member_count on public.channel_members is
'Automatically decrements the member count when a member is removed from a channel.';

/**
 * Function: prevent_duplicate_channel_member
 * Description: Prevents adding the same user to a channel multiple times
 * Trigger: Executes before INSERT on public.channel_members
 * Action: Checks if the user is already a member of the channel and raises exception if true
 * Returns: The NEW record (trigger standard) if the user is not already a member
 */
create or replace function prevent_duplicate_channel_member()
returns trigger as $$
begin
    -- Check if a record already exists with the same channel_id and member_id
    if exists (
        select 1
        from public.channel_members
        where channel_id = new.channel_id
        and member_id = new.member_id
    ) then
        -- If exists, raise an exception
        raise exception 'This user is already a member of the channel.';
    end if;

    -- If not, allow the insertion
    return new;
end;
$$ language plpgsql;

comment on function prevent_duplicate_channel_member() is
'Prevents adding the same user to a channel multiple times.';

-- Trigger: check_duplicate_member
create trigger check_duplicate_member
before insert on public.channel_members
for each row
execute function prevent_duplicate_channel_member();

comment on trigger check_duplicate_member on public.channel_members is
'Ensures a user cannot be added to the same channel multiple times.';
