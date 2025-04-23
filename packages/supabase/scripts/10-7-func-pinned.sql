/*
 * Pinned Message Functions
 * This file contains functions and triggers related to pinned messages:
 * - Message pinning and unpinning
 * - Message metadata updates for pinned status
 * - Channel activity tracking for pin actions
 */

/**
 * Function: update_message_on_pin
 * Description: Updates message metadata when a message is pinned
 * Trigger: Executes before INSERT on public.pinned_messages
 * Action: Sets pinned=true in message metadata and truncates content for pin record
 * Returns: The modified NEW record
 */
create or replace function update_message_on_pin()
returns trigger as $$
declare
    current_metadata jsonb;
    message_content text;
begin
    -- Retrieve current metadata and content from the messages table for the given message_id
    select metadata, content into current_metadata, message_content
    from public.messages
    where id = new.message_id and deleted_at is null;

    -- Check if the message exists and is not deleted
    if not found then
        raise exception 'Cannot pin message: Message with id % does not exist or has been deleted.', new.message_id;
    end if;

    -- Initialize metadata if null
    if current_metadata is null then
        current_metadata := '{}'::jsonb;
    end if;

    -- Set pinned status to true in metadata
    current_metadata := jsonb_set(current_metadata, '{pinned}', 'true');

    -- Update the message metadata
    update public.messages
    set metadata = current_metadata
    where id = new.message_id;

    -- Set the truncated content in the pinned message record
    new.content := truncate_content(message_content);

    return new;
end;
$$ language plpgsql;

comment on function update_message_on_pin() is
'Updates message metadata when a message is pinned and creates a truncated content preview.';

-- Trigger: set_message_pinned_status
create trigger set_message_pinned_status
before insert on public.pinned_messages
for each row
execute function update_message_on_pin();

comment on trigger set_message_pinned_status on public.pinned_messages is
'Sets pinned status and prepares content preview when a message is pinned.';

/**
 * Function: update_message_on_unpin
 * Description: Updates message metadata when a pinned message is unpinned
 * Trigger: Executes after DELETE on public.pinned_messages
 * Action: Sets pinned=false in message metadata
 * Returns: The OLD record
 */
create or replace function update_message_on_unpin()
returns trigger as $$
declare
    current_metadata jsonb;
begin
    -- Retrieve current metadata from the messages table for the given message_id
    select metadata into current_metadata
    from public.messages
    where id = old.message_id;

    -- Check if the message exists
    if not found then
        -- Message does not exist; nothing to update
        return old;
    end if;

    -- Initialize metadata if null
    if current_metadata is null then
        current_metadata := '{}'::jsonb;
    end if;

    -- Set pinned status to false in metadata
    current_metadata := jsonb_set(current_metadata, '{pinned}', 'false');

    -- Update the message metadata
    update public.messages
    set metadata = current_metadata
    where id = old.message_id;

    return old;
end;
$$ language plpgsql;

comment on function update_message_on_unpin() is
'Updates message metadata when a pinned message is unpinned by setting pinned=false.';

-- Trigger: clear_message_pinned_status
create trigger clear_message_pinned_status
after delete on public.pinned_messages
for each row
execute function update_message_on_unpin();

comment on trigger clear_message_pinned_status on public.pinned_messages is
'Clears pinned status in message metadata when a message is unpinned.';

/**
 * Function: update_channel_activity_on_pin
 * Description: Updates channel last_activity_at when a message is pinned
 * Trigger: Executes after INSERT on public.pinned_messages
 * Action: Updates the channel's last_activity_at timestamp
 * Returns: The NEW record
 */
create or replace function update_channel_activity_on_pin()
returns trigger as $$
begin
    -- Update the last_activity_at timestamp of the channel where the message is pinned
    if exists (select 1 from public.channels where id = new.channel_id) then
        update public.channels
        set last_activity_at = timezone('utc', now())
        where id = new.channel_id;
    end if;

    return new;
end;
$$ language plpgsql;

comment on function update_channel_activity_on_pin() is
'Updates the channel last activity timestamp when a message is pinned.';

-- Trigger: track_channel_activity_on_pin
create trigger track_channel_activity_on_pin
after insert on public.pinned_messages
for each row
execute function update_channel_activity_on_pin();

comment on trigger track_channel_activity_on_pin on public.pinned_messages is
'Tracks channel activity by updating last_activity_at when a message is pinned.';
