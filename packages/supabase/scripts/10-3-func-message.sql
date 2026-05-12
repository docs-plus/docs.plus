/*
 * Message Management Functions
 * This file contains functions and triggers related to message operations:
 * - Message soft deletion
 * - Message editing and content updates
 * - Message preview generation
 */

/**
 * Function: handle_message_soft_delete
 * Description: Performs cleanup operations when a message is soft-deleted
 * Trigger: Executes after UPDATE of deleted_at on public.messages
 * Action:
 *   - Deletes related pinned messages
 *   - Decrements unread_message_count for users with unread notifications
 *   - Deletes related notifications
 *   - Updates related reply references
 *   - Updates channel last_message_preview if needed
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION handle_message_soft_delete() RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
BEGIN
    -- Set deleted_at timestamp for soft delete
    NEW.deleted_at := NOW();

    IF TG_OP = 'UPDATE' THEN
        -- Delete pinned message
        DELETE FROM public.pinned_messages WHERE message_id = OLD.id;

        -- Decrement unread count for users with unread notifications for this message
        -- Must happen BEFORE deleting notifications so we know who to decrement
        UPDATE public.channel_members cm
        SET unread_message_count = GREATEST(0, unread_message_count - 1)
        FROM (
            SELECT receiver_user_id, channel_id
            FROM public.notifications
            WHERE message_id = OLD.id AND readed_at IS NULL
        ) n
        WHERE cm.channel_id = n.channel_id AND cm.member_id = n.receiver_user_id;

        -- Delete associated notifications
        DELETE FROM public.notifications WHERE message_id = OLD.id;

        -- Update reply previews
        UPDATE public.messages
        SET replied_message_preview = 'The message has been deleted'
        WHERE reply_to_message_id = OLD.id;

        -- Refresh the channel preview to the next-newest non-deleted message.
        -- If OLD wasn't the latest, this resolves to the same row already in
        -- last_message_preview (no-op effect). If OLD was the latest, this
        -- pulls in the previous message. NULL when the channel is now empty.
        IF OLD.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels WHERE id = OLD.channel_id) THEN
            UPDATE public.channels
            SET last_message_preview = (
                    SELECT truncate_content(m.content)
                    FROM public.messages m
                    WHERE m.channel_id = OLD.channel_id
                      AND m.deleted_at IS NULL
                      AND m.id <> OLD.id
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1
                ),
                last_activity_at = NOW()
            WHERE id = OLD.channel_id;
        END IF;

        -- Remove the reply from the metadata of the original message
        IF NEW.reply_to_message_id IS NOT NULL THEN
            SELECT metadata INTO current_metadata FROM public.messages
            WHERE id = NEW.reply_to_message_id;

            IF current_metadata IS NOT NULL THEN
                -- Remove the deleted message ID from the 'replied' array
                current_metadata := jsonb_set(current_metadata, '{replied}', (current_metadata->'replied') - NEW.id::text);

                -- Update the original message's metadata
                UPDATE public.messages
                SET metadata = current_metadata
                WHERE id = NEW.reply_to_message_id;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL; -- Should not reach here for an UPDATE trigger
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION handle_message_soft_delete() IS 'Performs cleanup operations when a message is soft-deleted including updating previews and removing references.';

CREATE TRIGGER message_soft_delete
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
EXECUTE FUNCTION handle_message_soft_delete();

COMMENT ON TRIGGER message_soft_delete ON public.messages IS 'Handles additional actions when a message is soft-deleted.';

/**
 * Function: update_message_preview_on_edit
 * Description: Updates message previews across the system when a message is edited
 * Trigger: Executes after UPDATE of content on public.messages
 * Action: Updates previews in notifications, replies, forwarded messages, and channel
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION update_message_preview_on_edit()
RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT;
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

    -- Update content for messages that are forwards of the edited message
    UPDATE public.messages
    SET content = NEW.content
    WHERE origin_message_id = NEW.id;

    -- Update last message preview in the channel of the edited message
    IF NEW.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels WHERE id = NEW.channel_id) THEN
        UPDATE public.channels
        SET last_message_preview = truncated_content
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_message_preview_on_edit() IS 'Updates message previews in various tables when a message is edited.';

CREATE TRIGGER update_message_previews
AFTER UPDATE OF content ON public.messages
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content)
EXECUTE FUNCTION update_message_preview_on_edit();

COMMENT ON TRIGGER update_message_previews ON public.messages IS 'Updates message previews throughout the system when message content changes.';

/**
 * Function: update_message_edited_at
 * Description: Sets the edited_at timestamp when message content or HTML is modified
 * Trigger: Executes before UPDATE of content or html on public.messages
 * Action: Sets the edited_at timestamp to the current time
 * Returns: The modified NEW record
 */
CREATE OR REPLACE FUNCTION update_message_edited_at() RETURNS TRIGGER AS $$
BEGIN
    -- Check if the content or html column has been updated
    IF OLD.content IS DISTINCT FROM NEW.content OR OLD.html IS DISTINCT FROM NEW.html THEN
        -- Update the edited_at timestamp
        NEW.edited_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_message_edited_at() IS 'Sets the edited_at timestamp when a message is edited.';

CREATE TRIGGER set_message_edited_at
BEFORE UPDATE OF content, html ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_message_edited_at();

COMMENT ON TRIGGER set_message_edited_at ON public.messages IS 'Sets the edited_at timestamp when message content or HTML is updated.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.handle_message_soft_delete() SET search_path = public;
ALTER FUNCTION public.update_message_preview_on_edit() SET search_path = public;
ALTER FUNCTION public.update_message_edited_at() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.handle_message_soft_delete() SECURITY DEFINER;
ALTER FUNCTION public.update_message_preview_on_edit() SECURITY DEFINER;
ALTER FUNCTION public.update_message_edited_at() SECURITY DEFINER;
