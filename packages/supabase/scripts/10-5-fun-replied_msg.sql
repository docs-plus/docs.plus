CREATE OR REPLACE FUNCTION update_replied_message_preview()
RETURNS TRIGGER AS $$
DECLARE
    originalMessageContent TEXT;
    truncatedContent TEXT;
BEGIN
    -- Only proceed if this message is a reply
    IF NEW.reply_to_message_id IS NOT NULL THEN
        -- Retrieve the content of the original message
        SELECT content INTO originalMessageContent FROM public.messages
        WHERE id = NEW.reply_to_message_id;

        -- Update the replied_message_preview of the new message
        NEW.replied_message_preview := truncate_content(originalMessageContent) truncatedContent;
    END IF;

    -- Proceed with the insert operation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER before_insert_reply_message_add_message_preview
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_replied_message_preview();

-----------------------------------------


/*
    --------------------------------------------------------
    Trigger Function: update_replied_metadata_before_insert
    Description: Updates the metadata of the original message when a reply is posted.
                 The metadata is updated to include the ID of the new reply message.
    --------------------------------------------------------
*/


CREATE OR REPLACE FUNCTION update_replied_metadata_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    currentMetadata JSONB;
BEGIN
    -- Only proceed if this message is a reply
    IF NEW.reply_to_message_id IS NOT NULL THEN

        -- Generate a new ID if not provided
        IF NEW.id IS NULL THEN
            NEW.id := uuid_generate_v4();
        END IF;

        -- Retrieve the current metadata of the original message
        SELECT metadata INTO currentMetadata FROM public.messages
        WHERE id = NEW.reply_to_message_id;

        -- Initialize metadata if null
        IF currentMetadata IS NULL THEN
            currentMetadata := '{}'::jsonb;
        END IF;

        -- Check if the 'replied' key exists, if not initialize it as an empty array
        IF NOT (currentMetadata ? 'replied') THEN
            currentMetadata := currentMetadata || jsonb_build_object('replied', '[]'::jsonb);
        END IF;

        -- Append the new message ID to the 'replied' array
        currentMetadata := jsonb_set(currentMetadata, '{replied}', (currentMetadata->'replied') || to_jsonb(NEW.id::text));

        -- Update the original message's metadata
        UPDATE public.messages
        SET metadata = currentMetadata
        WHERE id = NEW.reply_to_message_id;

    END IF;

    -- Proceed with the insert operation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER before_insert_message
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_replied_metadata_before_insert();


/*
    --------------------------------------------------------
    Trigger Function: update_message_preview_on_reply
    Description: Updates the preview of the message being replied to when a reply is posted.
    --------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION update_channel_preview_on_new_message() RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT; -- Declaration of the variable
BEGIN
    -- Check if the message is part of a thread. If it is, don't update the channel preview.
    IF NEW.thread_id IS NULL THEN
        -- Update the last message preview in the channel with the new message content
        -- Note: We can also add truncation logic here if required
        truncated_content := truncate_content(NEW.content);

        UPDATE public.channels
        SET last_message_preview = truncated_content,
            last_activity_at = NOW()
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_channel_preview_on_new_message() IS 'Function to update the last message preview in a channel when a new message is inserted, except for messages that are part of a thread.';


/*
    --------------------------------------------------------
    Trigger: update_channel_preview_on_new_message_trigger
    Description:  Activates after a new message is inserted.
                  Invokes the update_channel_preview_on_new_message function to update the last message preview in the channel.
    --------------------------------------------------------
*/

CREATE TRIGGER update_channel_preview_on_new_message_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_channel_preview_on_new_message();

COMMENT ON TRIGGER update_channel_preview_on_new_message_trigger ON public.messages IS 'Trigger to update the last message preview in the corresponding channel when a new message is inserted.';

