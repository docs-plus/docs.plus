-- Reply-aware row hooks: snapshot the parent preview, mirror the new id
-- onto the parent's replied[] metadata, and refresh the channel preview.

-- Stamps the parent's truncated content onto the reply row before insert
-- so the UI can render the quoted preview without an extra join.
CREATE OR REPLACE FUNCTION set_replied_message_preview()
RETURNS TRIGGER AS $$
DECLARE
    original_message_content TEXT;
    truncated_content TEXT;
BEGIN
    -- Only proceed if this message is a reply
    IF NEW.reply_to_message_id IS NOT NULL THEN
        -- Retrieve the content of the original message, only if not deleted
        SELECT content INTO original_message_content FROM public.messages
        WHERE id = NEW.reply_to_message_id AND deleted_at IS NULL;

        IF FOUND THEN
            -- Truncate and set the replied_message_preview
            truncated_content := truncate_content(original_message_content);
            NEW.replied_message_preview := truncated_content;
        ELSE
            -- Original message does not exist or has been deleted
            NEW.replied_message_preview := 'The original message is not available.';
        END IF;
    END IF;

    -- Proceed with the insert operation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_replied_message_preview() IS 'Sets the preview content for replied messages by truncating the original message content.';

-- Trigger: set_reply_message_preview
DROP TRIGGER IF EXISTS set_reply_message_preview ON public.messages;
CREATE TRIGGER set_reply_message_preview
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION set_replied_message_preview();

COMMENT ON TRIGGER set_reply_message_preview ON public.messages IS 'Sets the replied_message_preview field when a new reply message is created.';

-- Appends the new reply id into the parent's metadata.replied[] so the
-- parent row carries an inline list of replies for the UI.
CREATE OR REPLACE FUNCTION update_original_message_metadata()
RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
BEGIN
    -- Only proceed if this message is a reply
    IF NEW.reply_to_message_id IS NOT NULL THEN
        -- Generate a new ID if not provided
        IF NEW.id IS NULL THEN
            NEW.id := uuid_generate_v4();
        END IF;

        -- Retrieve the current metadata of the original message, only if not deleted
        SELECT metadata INTO current_metadata FROM public.messages
        WHERE id = NEW.reply_to_message_id AND deleted_at IS NULL;

        IF FOUND THEN
            -- Initialize metadata if null
            IF current_metadata IS NULL THEN
                current_metadata := '{}'::jsonb;
            END IF;

            -- Check if the 'replied' key exists, if not initialize it as an empty array
            IF NOT (current_metadata ? 'replied') THEN
                current_metadata := current_metadata || jsonb_build_object('replied', '[]'::jsonb);
            END IF;

            -- Append the new message ID to the 'replied' array
            current_metadata := jsonb_set(
                current_metadata,
                '{replied}',
                (current_metadata->'replied') || to_jsonb(NEW.id::text)
            );

            -- Update the original message's metadata
            UPDATE public.messages
            SET metadata = current_metadata
            WHERE id = NEW.reply_to_message_id;
        END IF;
    END IF;

    -- Proceed with the insert operation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_original_message_metadata() IS 'Updates the metadata of the original message to track reply message IDs.';

-- Trigger: track_message_replies
DROP TRIGGER IF EXISTS track_message_replies ON public.messages;
CREATE TRIGGER track_message_replies
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_original_message_metadata();

COMMENT ON TRIGGER track_message_replies ON public.messages IS 'Updates the original message metadata to track reply message IDs.';

-- Bumps last_message_preview / last_activity_at on the channel so the
-- sidebar can sort and preview without scanning messages.
CREATE OR REPLACE FUNCTION update_channel_preview_on_new_message() RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT;
BEGIN
    truncated_content := truncate_content(NEW.content);

    IF EXISTS (SELECT 1 FROM public.channels WHERE id = NEW.channel_id) THEN
        UPDATE public.channels
        SET last_message_preview = truncated_content,
            last_activity_at = timezone('utc', now())
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_channel_preview_on_new_message() IS 'Updates the last message preview in a channel when a new message is inserted.';

-- Trigger: update_channel_preview
DROP TRIGGER IF EXISTS update_channel_preview ON public.messages;
CREATE TRIGGER update_channel_preview
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_channel_preview_on_new_message();

COMMENT ON TRIGGER update_channel_preview ON public.messages IS 'Updates the channel preview when a new message is posted.';


-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.set_replied_message_preview() SET search_path = public;
ALTER FUNCTION public.update_original_message_metadata() SET search_path = public;
ALTER FUNCTION public.update_channel_preview_on_new_message() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.set_replied_message_preview() SECURITY DEFINER;
ALTER FUNCTION public.update_original_message_metadata() SECURITY DEFINER;
ALTER FUNCTION public.update_channel_preview_on_new_message() SECURITY DEFINER;
