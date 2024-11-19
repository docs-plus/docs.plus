-----------------------------------------
-----------------------------------------

CREATE OR REPLACE FUNCTION handle_set_thread_depth()
RETURNS TRIGGER AS $$
DECLARE
    parent_thread_depth INT;
BEGIN
    -- Check if the new message has a thread_id and retrieve the thread_depth of the parent message
    SELECT thread_depth INTO parent_thread_depth FROM public.messages WHERE id = NEW.thread_id;

    -- Set the thread_depth of the new message if parent_thread_depth is not null
    IF parent_thread_depth IS NOT NULL THEN
        NEW.thread_depth := parent_thread_depth + 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_thread_depth
BEFORE INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.thread_id IS NOT NULL)
EXECUTE FUNCTION handle_set_thread_depth();

-----------------------------------------
-----------------------------------------
CREATE OR REPLACE FUNCTION create_thread_message(
    p_content TEXT,
    p_html TEXT,
    p_thread_id UUID,
    p_workspace_id VARCHAR(36)
)
RETURNS VOID
AS $$
DECLARE
    v_channel_exists BOOLEAN;
    v_is_user_member BOOLEAN;
    v_is_thread_root BOOLEAN;
    v_thread_owner_id UUID;
BEGIN
    -- Check if the channel exists and if the user is a member
    SELECT
        EXISTS (
            SELECT 1
            FROM public.channels
            WHERE id = p_thread_id
        ),
        EXISTS (
            SELECT 1
            FROM public.channel_members
            WHERE channel_id = p_thread_id
            AND member_id = auth.uid()
        )
    INTO v_channel_exists, v_is_user_member;

    -- If the channel doesn't exist, create a new one and add the user as an admin
    IF NOT v_channel_exists THEN
        INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type)
        VALUES (p_thread_id, p_workspace_id, 'thread-' || uuid_generate_v4(), 'Thread Channel', auth.uid(), 'Automatically created channel for thread', 'THREAD');

        v_is_user_member := TRUE;
    -- If the user is not a member, add them as a member
    ELSIF NOT v_is_user_member THEN
        INSERT INTO public.channel_members (channel_id, member_id, channel_member_role)
        VALUES (p_thread_id, auth.uid(), 'MEMBER')
        ON CONFLICT DO NOTHING;

        v_is_user_member := TRUE;
    END IF;

    -- If the user is a member, update the thread and insert the new message
    IF v_is_user_member THEN
        -- Update the message to mark it as a thread root if needed
        WITH cte_thread_root AS (
            UPDATE public.messages
            SET thread_owner_id = COALESCE(thread_owner_id, auth.uid()),
                is_thread_root = TRUE
            WHERE id = p_thread_id
            AND (thread_owner_id IS NULL OR NOT is_thread_root)
            RETURNING thread_owner_id, is_thread_root
        )
        SELECT thread_owner_id, is_thread_root
        INTO v_thread_owner_id, v_is_thread_root
        FROM cte_thread_root;

        -- Insert the new message
        INSERT INTO public.messages (content, channel_id, user_id, html, thread_id)
        VALUES (p_content, p_thread_id, auth.uid(), p_html, p_thread_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------
-----------------------------------------

CREATE OR REPLACE FUNCTION increment_thread_message_count()
RETURNS TRIGGER AS $$
DECLARE
    root_id UUID;
    current_metadata JSONB;
BEGIN
    -- Find the root message ID from the thread_id of the newly inserted message
    IF NEW.thread_id IS NOT NULL THEN
        root_id := NEW.thread_id;

        -- Retrieve current metadata or initialize if null
        SELECT metadata INTO current_metadata FROM public.messages WHERE id = root_id;

        -- If the root message does not exist, exit the function
        IF NOT FOUND THEN
            RETURN NEW;
        END IF;

        IF current_metadata IS NULL THEN
            current_metadata := '{}'::jsonb;
        END IF;

        -- Ensure 'thread' object exists, initialize if not
        IF NOT (current_metadata ? 'thread') THEN
            current_metadata := jsonb_build_object('thread', jsonb_build_object('message_count', 0));
        END IF;

        -- Increment the message_count
        current_metadata := jsonb_set(current_metadata, '{thread, message_count}',
            ((current_metadata->'thread'->>'message_count')::int + 1)::text::jsonb, true);

        -- Update the root message's metadata
        UPDATE public.messages
        SET metadata = current_metadata
        WHERE id = root_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trigger_increment_thread_message_count
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION increment_thread_message_count();

-----------------------------------------
-----------------------------------------
CREATE OR REPLACE FUNCTION decrement_thread_message_count()
RETURNS TRIGGER AS $$
DECLARE
    root_id UUID;
    current_metadata JSONB;
BEGIN
    -- Check for the root message ID from the thread_id of the message being deleted or soft-deleted
    IF OLD.thread_id IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN
        root_id := OLD.thread_id;

        -- Retrieve current metadata
        SELECT metadata INTO current_metadata FROM public.messages WHERE id = root_id;

        -- If the root message does not exist, exit the function
        IF NOT FOUND THEN
            RETURN OLD;
        END IF;

        IF current_metadata IS NULL THEN
            current_metadata := '{}'::jsonb;
        END IF;

        -- Ensure 'thread' object exists, initialize if not
        IF NOT (current_metadata ? 'thread') THEN
            current_metadata := jsonb_build_object('thread', jsonb_build_object('message_count', 1));  -- Default to 1 to avoid negative counts
        END IF;

        -- Decrement the message_count but do not go below zero
        current_metadata := jsonb_set(current_metadata, '{thread, message_count}',
            GREATEST((current_metadata->'thread'->>'message_count')::int - 1, 0)::text::jsonb, true);

        -- Update the root message's metadata
        UPDATE public.messages
        SET metadata = current_metadata
        WHERE id = root_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trigger_decrement_thread_message_count
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
WHEN (OLD.thread_id IS NOT NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION decrement_thread_message_count();

-----------------------------------------
-----------------------------------------

-- Create the trigger function
CREATE OR REPLACE FUNCTION soft_delete_thread_root_messages()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the updated message is a soft-delete, is the thread root, and the user is the owner
    IF NEW.deleted_at IS NOT NULL AND NEW.is_thread_root AND NEW.thread_owner_id = auth.uid() THEN
        -- Delete the channel associated with this thread
        DELETE FROM public.channels WHERE id = NEW.thread_id;
        -- Deleting the channel will cascade delete messages and notifications due to ON DELETE CASCADE
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_soft_delete_thread_root_messages
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION soft_delete_thread_root_messages();



-----------------------------------------
-----------------------------------------
-----------------------------------------
