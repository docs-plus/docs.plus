-- Add optional p_id parameter and return UUID so clients can supply
-- a UUID to reconcile optimistic UI with the realtime echo.

-- Return type changes from VOID to UUID; CREATE OR REPLACE cannot do that.
DROP FUNCTION IF EXISTS public.create_thread_message(TEXT, TEXT, UUID, VARCHAR);

CREATE OR REPLACE FUNCTION create_thread_message(
    p_content      TEXT,
    p_html         TEXT,
    p_thread_id    UUID,
    p_workspace_id VARCHAR(36),
    p_id           UUID DEFAULT NULL
)
RETURNS UUID
AS $$
DECLARE
    v_channel_exists  BOOLEAN;
    v_is_user_member  BOOLEAN;
    v_is_thread_root  BOOLEAN;
    v_thread_owner_id UUID;
    v_message_id      UUID := COALESCE(p_id, uuid_generate_v4());
BEGIN
    SELECT
        EXISTS (
            SELECT 1 FROM public.channels WHERE id = p_thread_id
        ),
        EXISTS (
            SELECT 1 FROM public.channel_members
             WHERE channel_id = p_thread_id
               AND member_id = auth.uid()
        )
      INTO v_channel_exists, v_is_user_member;

    IF NOT v_channel_exists THEN
        INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type)
        VALUES (
            p_thread_id, p_workspace_id, 'thread-' || uuid_generate_v4(),
            'Thread Channel', auth.uid(),
            'Automatically created channel for thread', 'THREAD'
        );
        v_is_user_member := TRUE;
    ELSIF NOT v_is_user_member THEN
        INSERT INTO public.channel_members (channel_id, member_id, channel_member_role)
        VALUES (p_thread_id, auth.uid(), 'MEMBER')
        ON CONFLICT DO NOTHING;
        v_is_user_member := TRUE;
    END IF;

    IF v_is_user_member THEN
        WITH cte_thread_root AS (
            UPDATE public.messages
               SET thread_owner_id = COALESCE(thread_owner_id, auth.uid()),
                   is_thread_root  = TRUE
             WHERE id = p_thread_id
               AND (thread_owner_id IS NULL OR NOT is_thread_root)
             RETURNING thread_owner_id, is_thread_root
        )
        SELECT thread_owner_id, is_thread_root
          INTO v_thread_owner_id, v_is_thread_root
          FROM cte_thread_root;

        INSERT INTO public.messages (id, content, channel_id, user_id, html, thread_id)
        VALUES (v_message_id, p_content, p_thread_id, auth.uid(), p_html, p_thread_id);
    END IF;

    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;
