-- =====================================================================
-- 20260514170000_broadcast_message_soft_delete.sql
-- =====================================================================
-- Anon viewers (PUBLIC chat) never observe soft-deletes through
-- postgres_changes: the anon SELECT policy on messages filters
-- `deleted_at IS NULL`, so the realtime layer drops UPDATE events whose
-- NEW row state fails the policy. Result: deleted messages stay
-- rendered in anon Virtuoso state until next full window refetch.
--
-- Fix: emit a non-private `message:deleted` broadcast on the NULL →
-- NOT NULL transition. Payload is `{id, channel_id}` — no content
-- leak. Authed members on PRIVATE channels still receive the
-- postgres_changes UPDATE event; the broadcast is just the
-- extra path that reaches anon (and is harmlessly received by
-- authed members too — `deleteBufferRef` is a Set, idempotent).
--
-- Folded into the existing `handle_message_soft_delete` trigger
-- (AFTER UPDATE OF deleted_at) rather than added as a parallel trigger
-- to avoid double-firing on the same row. Mirrors
-- scripts/10-3-func-message.sql.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_message_soft_delete() RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
BEGIN
    NEW.deleted_at := NOW();

    IF TG_OP = 'UPDATE' THEN
        DELETE FROM public.pinned_messages WHERE message_id = OLD.id;

        UPDATE public.channel_members cm
        SET unread_message_count = GREATEST(0, unread_message_count - 1)
        FROM (
            SELECT receiver_user_id, channel_id
            FROM public.notifications
            WHERE message_id = OLD.id AND readed_at IS NULL
        ) n
        WHERE cm.channel_id = n.channel_id AND cm.member_id = n.receiver_user_id;

        DELETE FROM public.notifications WHERE message_id = OLD.id;

        UPDATE public.messages
        SET replied_message_preview = 'The message has been deleted'
        WHERE reply_to_message_id = OLD.id;

        IF OLD.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels WHERE id = OLD.channel_id) THEN
            UPDATE public.channels
            SET last_message_preview = (
                    SELECT public.truncate_content(m.content)
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

        IF NEW.reply_to_message_id IS NOT NULL THEN
            SELECT metadata INTO current_metadata FROM public.messages
            WHERE id = NEW.reply_to_message_id;

            IF current_metadata IS NOT NULL THEN
                current_metadata := jsonb_set(current_metadata, '{replied}', (current_metadata->'replied') - NEW.id::text);

                UPDATE public.messages
                SET metadata = current_metadata
                WHERE id = NEW.reply_to_message_id;
            END IF;
        END IF;

        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            PERFORM realtime.send(
                jsonb_build_object('id', NEW.id, 'channel_id', NEW.channel_id),
                'message:deleted',
                'chatroom:' || NEW.channel_id,
                FALSE
            );
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;
