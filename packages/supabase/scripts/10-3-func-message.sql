CREATE OR REPLACE FUNCTION handle_soft_delete() RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT;
    currentMetadata JSONB;
BEGIN
    -- Set deleted_at timestamp for soft delete
    NEW.deleted_at := NOW();

    IF TG_OP = 'UPDATE' THEN
        -- Truncate content if necessary for soft deleted messages
        truncated_content := truncate_content(NEW.content);

        -- Delete pinned message
        DELETE FROM public.pinned_messages WHERE message_id = OLD.id;

        -- Delete associated notifications
        DELETE FROM public.notifications WHERE message_id = OLD.id;

        -- Update reply previews
        UPDATE public.messages
        SET replied_message_preview = 'The message has been deleted'
        WHERE reply_to_message_id = OLD.id;

        -- Update last message preview in the channel if it exists
        IF OLD.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels WHERE id = OLD.channel_id) THEN
            WITH last_msg AS (
                SELECT id, content
                FROM public.messages
                WHERE channel_id = OLD.channel_id AND deleted_at IS NULL AND id <> OLD.id
                ORDER BY created_at DESC
                LIMIT 1
            )
            UPDATE public.channels
            SET last_message_preview = truncated_content,
                last_activity_at = NOW()
            WHERE id = OLD.channel_id;
        END IF;

        -- Remove the reply from the metadata of the original message
        IF NEW.reply_to_message_id IS NOT NULL THEN
            SELECT metadata INTO currentMetadata FROM public.messages
            WHERE id = NEW.reply_to_message_id;

            IF currentMetadata IS NOT NULL THEN
                -- Remove the deleted message ID from the 'replied' array
                currentMetadata := jsonb_set(currentMetadata, '{replied}', (currentMetadata->'replied') - NEW.id::text);

                -- Update the original message's metadata
                UPDATE public.messages
                SET metadata = currentMetadata
                WHERE id = NEW.reply_to_message_id;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL; -- Should not reach here for an UPDATE trigger
END;
$$ LANGUAGE plpgsql;



CREATE TRIGGER handle_soft_delete_trigger
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
EXECUTE FUNCTION handle_soft_delete();

COMMENT ON TRIGGER handle_soft_delete_trigger ON public.messages IS 'Trigger to handle additional actions on message soft-delete.';


/*
    --------------------------------------------------------
    Trigger Function: update_message_preview_on_edit
    Description: Updates message previews in various tables when a message's content is edited.
                Previews are truncated to 67 characters with ellipsis if longer than 70 characters.
    --------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION update_message_preview_on_edit()
RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT; -- Declaration of the variable
BEGIN
    truncated_content := truncate_content(NEW.content);

    -- Update unread notification preview
    UPDATE public.notifications
    SET message_preview = truncated_content
    WHERE message_id = NEW.id AND readed_at IS NULL;

    -- Update previews for messages that are replies to the edited message
    UPDATE public.messages
    SET replied_message_preview = truncated_content
    WHERE reply_to_message_id = NEW.id;

    -- Update previews for messages that are forwards of the edited message
    UPDATE public.messages
    SET content = NEW.content
    WHERE origin_message_id = NEW.id;

    -- Update last message preview in the channel of the edited message
    IF NEW.thread_id IS NULL AND NEW.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels WHERE id = NEW.channel_id) THEN
        UPDATE public.channels
        SET last_message_preview = truncated_content
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/*
    --------------------------------------------------------
    Trigger: update_message_content_on_edit_trigger
    Description: Activates upon editing the content of a message.
                 Invokes the update_message_preview_on_edit function to update related previews.
    --------------------------------------------------------
*/

CREATE TRIGGER update_message_content_on_edit_trigger
AFTER UPDATE OF content ON public.messages
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content)
EXECUTE FUNCTION update_message_preview_on_edit();


-----------------------------------------

CREATE OR REPLACE FUNCTION update_edited_at() RETURNS TRIGGER AS $$
BEGIN
    -- Check if the content or html column has been updated
    IF OLD.content IS DISTINCT FROM NEW.content OR OLD.html IS DISTINCT FROM NEW.html THEN
        -- Update the edited_at timestamp
        NEW.edited_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trigger_update_edited_at
BEFORE UPDATE OF content, html ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_edited_at();
----------------------------------------------------------------------------------
----------------------------------------------------------------------------------


-- CREATE OR REPLACE FUNCTION update_last_read_status()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- Check if it's a message insert or delete operation
--     IF TG_OP = 'INSERT' THEN
--         -- Update last_read_message_id and last_read_update only for the user who sent the message
--         UPDATE public.channel_members
--         SET last_read_message_id = NEW.id,
--             last_read_update_at = timezone('utc', now())
--         WHERE channel_id = NEW.channel_id AND member_id = NEW.user_id;
--     ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL THEN
--         -- If the message is soft-deleted, set last_read_message_id to null for this message
--         UPDATE public.channel_members
--         SET last_read_message_id = NULL
--         WHERE last_read_message_id = NEW.id;
--     END IF;

--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- -- Trigger for new message insertion
-- CREATE TRIGGER trigger_update_on_new_message
-- AFTER INSERT ON public.messages
-- FOR EACH ROW
-- EXECUTE FUNCTION update_last_read_status();

-- -- Trigger for message update (soft deletion)
-- CREATE TRIGGER trigger_update_on_message_delete
-- AFTER UPDATE OF deleted_at ON public.messages
-- FOR EACH ROW
-- WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
-- EXECUTE FUNCTION update_last_read_status();


-- TODO: Revise
-- CREATE OR REPLACE FUNCTION update_message_reads(last_message_id VARCHAR(36), channel_id VARCHAR(36))
-- RETURNS VOID AS $$
-- DECLARE
--     current_user_id VARCHAR(36) := auth.uid(); -- Get current user's ID
--     last_read_timestamp TIMESTAMP WITH TIME ZONE;
--     last_message_timestamp TIMESTAMP WITH TIME ZONE;
--     messages_to_read VARCHAR(36)[]; -- Array to hold message IDs for batch insertion
-- BEGIN
--     -- Retrieve the timestamp of the last read message for the current user in the specified channel
--     SELECT created_at INTO last_read_timestamp
--     FROM public.messages
--     WHERE id = (SELECT last_read_message_id
--                 FROM public.channel_members
--                 WHERE channel_id = channel_id AND member_id = current_user_id);

--     -- Retrieve the timestamp of the last_message_id
--     SELECT created_at INTO last_message_timestamp
--     FROM public.messages
--     WHERE id = last_message_id;

--     -- Check if both timestamps are valid (non-NULL)
--     IF last_read_timestamp IS NOT NULL AND last_message_timestamp IS NOT NULL THEN
--         -- Collect message IDs for messages sent after the last read message and up to the last_message_id
--         SELECT array_agg(id) INTO messages_to_read
--         FROM public.messages
--         WHERE channel_id = channel_id
--           AND user_id != current_user_id
--           AND created_at > last_read_timestamp
--           AND created_at <= last_message_timestamp
--         ORDER BY created_at;

--         -- Perform batch insertion into message_reads table
--         INSERT INTO public.message_reads (channel_id, message_id, reader_id, read_at)
--         SELECT channel_id, unnest(messages_to_read), current_user_id, now()
--         FROM unnest(messages_to_read)
--         ON CONFLICT (channel_id, message_id, reader_id) DO NOTHING; -- Avoid duplicates
--     END IF;
-- END;
-- $$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;


-- TODO: Revise
-- CREATE TABLE public.message_reads (
--     channel_id           VARCHAR(36) NOT NULL REFERENCES public.channels ON DELETE CASCADE,
--     message_id           VARCHAR(36) NOT NULL REFERENCES public.messages ON DELETE CASCADE,
--     reader_id            UUID NOT NULL REFERENCES public.users ON DELETE CASCADE,
--     read_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
--     PRIMARY KEY (channel_id, message_id, reader_id)
-- );

-- CREATE INDEX idx_message_reads_channel_id_message_id ON public.message_reads (channel_id, message_id);

