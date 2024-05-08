/*
    --------------------------------------------------------
    Trigger Function: copy_content_for_forwarded_message
    Description: Prepares a new message record before insertion when the message is a forward. 
                 It copies the content and media from the original message, resetting certain fields to ensure integrity.
    --------------------------------------------------------
*/
-- TODO: metadata for forwarded chains not good choice
CREATE OR REPLACE FUNCTION copy_content_for_forwarded_message()
RETURNS TRIGGER AS $$
DECLARE
  original_message RECORD;
  forwarding_user RECORD;
  user_details JSONB;
BEGIN
  -- Check if the message is a forward by the presence of origin_message_id
  IF NEW.origin_message_id IS NOT NULL THEN
    -- Retrieve content, media, and metadata from the original message
    SELECT content, html, medias, metadata, user_id INTO original_message 
    FROM public.messages 
    WHERE id = NEW.origin_message_id;

    -- Retrieve the forwarding user's details
    SELECT id, username, full_name, avatar_url INTO forwarding_user
    FROM public.users
    WHERE id = original_message.user_id; -- Assuming NEW.user_id is the ID of the user who is forwarding the message

    -- Prepare user details JSON object
    user_details := jsonb_build_object(
        'id', forwarding_user.id,
        'username', forwarding_user.username,
        'full_name', forwarding_user.full_name,
        'avatar_url', forwarding_user.avatar_url
    );

    -- Check if original_message.metadata has 'forwarding_chain' key
    IF original_message.metadata ? 'forwarding_chain' THEN
        -- Append the new user details to the existing array
        NEW.metadata := jsonb_set(original_message.metadata, '{forwarding_chain}', original_message.metadata->'forwarding_chain' || user_details);
    ELSE
        -- Create a new 'forwarding_chain' array with the user details
        NEW.metadata := jsonb_build_object('forwarding_chain', jsonb_build_array(user_details));
    END IF;

    -- Populate the new message record with content and media from the original
    NEW.content := original_message.content;
    NEW.medias := original_message.medias;
    NEW.html := original_message.html;

    -- Clear other fields not relevant for a forwarded message
    NEW.reactions := null;
    NEW.reply_to_message_id := null;
    NEW.replied_message_preview := null;
  END IF;

  RETURN NEW; -- Return the modified message record
END;
$$ LANGUAGE plpgsql;

/*
    --------------------------------------------------------
    Trigger: forward_message_content_before_insert_trigger
    Description: Activated before inserting a new message. It invokes copy_content_for_forwarded_message 
                 function to replicate content and media for forwarded messages, ensuring that certain fields are reset.
    --------------------------------------------------------
*/

CREATE TRIGGER forward_message_content_before_insert_trigger
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION copy_content_for_forwarded_message();
