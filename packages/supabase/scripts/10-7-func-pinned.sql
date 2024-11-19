-----------------------------------------

-- Function to update message metadata
CREATE OR REPLACE FUNCTION update_message_metadata_on_pin()
RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
    message_content TEXT;
BEGIN
    -- Retrieve current metadata and content from the messages table for the given message_id, only if not deleted
    SELECT metadata, content INTO current_metadata, message_content
    FROM public.messages
    WHERE id = NEW.message_id AND deleted_at IS NULL;

    -- Check if the message exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot pin message: Message with id % does not exist or has been deleted.', NEW.message_id;
    END IF;

    -- Check if metadata is null and initialize it if necessary
    IF current_metadata IS NULL THEN
        current_metadata := '{}'::JSONB;
    END IF;

    -- Update the metadata with "pinned": true
    current_metadata := jsonb_set(current_metadata, '{pinned}', 'true');

    -- Update the messages table with new metadata
    UPDATE public.messages SET metadata = current_metadata WHERE id = NEW.message_id;

    -- Set the content of the pinned message
    NEW.content := truncate_content(message_content);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Trigger on the pinned_messages table
CREATE TRIGGER trigger_update_message_on_pin
BEFORE INSERT ON public.pinned_messages
FOR EACH ROW EXECUTE FUNCTION update_message_metadata_on_pin();

-----------------------------------------

-- Function to update message metadata when a pinned message is deleted
CREATE OR REPLACE FUNCTION update_message_metadata_on_unpin()
RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
BEGIN
    -- Retrieve current metadata from the messages table for the given message_id
    SELECT metadata INTO current_metadata FROM public.messages WHERE id = OLD.message_id;

    -- Check if the message exists
    IF NOT FOUND THEN
        -- Message does not exist; nothing to update
        RETURN OLD;
    END IF;

    -- Check if metadata is null and initialize it if necessary
    IF current_metadata IS NULL THEN
        current_metadata := '{}'::JSONB;
    END IF;

    -- Update the metadata with "pinned": false
    current_metadata := jsonb_set(current_metadata, '{pinned}', 'false');

    -- Update the messages table
    UPDATE public.messages SET metadata = current_metadata WHERE id = OLD.message_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger on the pinned_messages table for deletion
CREATE TRIGGER trigger_update_message_on_unpin
AFTER DELETE ON public.pinned_messages
FOR EACH ROW EXECUTE FUNCTION update_message_metadata_on_unpin();


/*
    --------------------------------------------------------
    Trigger Function: update_channel_activity_on_pin
    Description: Updates the last activity timestamp of a channel when a message is pinned to it.
                 This helps in tracking the latest interactions within the channel.
    --------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION update_channel_activity_on_pin() RETURNS TRIGGER AS $$
BEGIN
    -- Update the last_activity_at timestamp of the channel where the message is pinned
    IF EXISTS (SELECT 1 FROM public.channels WHERE id = NEW.channel_id) THEN
        UPDATE public.channels
        SET last_activity_at = timezone('utc', now())
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW; -- Return the new pinned message record
END;
$$ LANGUAGE plpgsql;


/*
    --------------------------------------------------------
    Trigger: channel_activity_update_on_message_pin_trigger
    Description: Triggered after a message is pinned. It invokes update_channel_activity_on_pin
                 function to refresh the channel's last activity timestamp.
    --------------------------------------------------------
*/

CREATE TRIGGER channel_activity_update_on_message_pin_trigger
AFTER INSERT ON public.pinned_messages
FOR EACH ROW
EXECUTE FUNCTION update_channel_activity_on_pin();
