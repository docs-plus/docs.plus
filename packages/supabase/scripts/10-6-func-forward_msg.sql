/*
 * Forwarded Message Functions
 * This file contains functions and triggers related to message forwarding:
 * - Content copying from original messages
 * - Handling forwarding chain metadata
 * - Maintaining message integrity during forwarding
 */

/**
 * Function: prepare_forwarded_message
 * Description: Copies content from original message when forwarding a message
 * Trigger: Executes before INSERT on public.messages
 * Action: Copies content, media, and HTML from the original message and tracks forwarding history
 * Returns: The modified NEW record with content and metadata from the original message
 */
create or replace function prepare_forwarded_message()
returns trigger as $$
declare
  original_message record;
  forwarding_user record;
  user_details jsonb;
begin
  -- Only proceed if the message is a forward (has origin_message_id)
  if new.origin_message_id is not null then
    -- Retrieve content, html, medias, metadata, user_id from the original message if not soft-deleted
    select content, html, medias, metadata, user_id into original_message
    from public.messages
    where id = new.origin_message_id and deleted_at is null;

    -- Check if the original message exists
    if not found then
      -- Assign default values since the original message is not available
      new.content := 'Original message is not available.';
      new.medias := null;
      new.html := null;
      new.metadata := null;
    else
      -- Proceed with copying content from the original message

      -- Retrieve the original user's details
      select id, username, full_name, avatar_url, avatar_updated_at into forwarding_user
      from public.users
      where id = original_message.user_id;

      -- Check if the original user exists
      if not found then
        -- Handle the case where the user does not exist
        forwarding_user.id := null;
        forwarding_user.username := 'Unknown';
        forwarding_user.full_name := 'Unknown User';
        forwarding_user.avatar_url := null;
        forwarding_user.avatar_updated_at := null;
      end if;

      -- Prepare user details JSON object
      user_details := jsonb_build_object(
          'id', forwarding_user.id,
          'username', forwarding_user.username,
          'full_name', forwarding_user.full_name,
          'avatar_url', forwarding_user.avatar_url,
          'avatar_updated_at', forwarding_user.avatar_updated_at
      );

      -- Initialize new.metadata if null
      if new.metadata is null then
        new.metadata := '{}'::jsonb;
      end if;

      -- Track forwarding chain
      if original_message.metadata ? 'forwarding_chain' then
          -- Append the new user details to the existing array
          new.metadata := jsonb_set(
              original_message.metadata,
              '{forwarding_chain}',
              (original_message.metadata->'forwarding_chain') || user_details
          );
      else
          -- Create a new 'forwarding_chain' array with the user details
          new.metadata := new.metadata || jsonb_build_object(
              'forwarding_chain',
              jsonb_build_array(user_details)
          );
      end if;

      -- Copy content from the original message
      new.content := original_message.content;
      new.medias := original_message.medias;
      new.html := original_message.html;
    end if;

    -- Clear fields not relevant for a forwarded message
    new.reactions := null;
    new.reply_to_message_id := null;
    new.replied_message_preview := null;
  end if;

  return new;
end;
$$ language plpgsql;

comment on function prepare_forwarded_message() is
'Prepares a forwarded message by copying content from the original message and tracking forwarding history.';

-- Trigger: set_forwarded_message_content
create trigger set_forwarded_message_content
before insert on public.messages
for each row
execute function prepare_forwarded_message();

comment on trigger set_forwarded_message_content on public.messages is
'Copies content from the original message when a message is being forwarded.';
