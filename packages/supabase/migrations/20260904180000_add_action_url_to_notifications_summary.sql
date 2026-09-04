-- Issue #205. The notification panel's Unread and Mentions tabs are seeded from
-- notifications_summary, and its two sub-selects returned no action_url. So a
-- content_change row's View button marked it read and navigated nowhere.
--
-- get_unread_notifications_paginated and get_workspace_notifications already
-- select the column; only this function was short.

CREATE OR REPLACE FUNCTION public.notifications_summary(
    _workspace_id VARCHAR(36) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_unread_count          BIGINT;
    v_unread_mention_count  BIGINT;
    v_last_unread           JSONB;
    v_last_unread_mention   JSONB;
BEGIN
    /*
       If _workspace_id is not NULL, filter notifications by channels in that workspace.
       Otherwise, no workspace filter.
    */

    -- 1) Count all unread notifications
    SELECT COUNT(*)
    INTO v_unread_count
    FROM public.notifications AS n
    JOIN public.channels      AS c ON c.id = n.channel_id
    WHERE n.receiver_user_id = auth.uid()
      AND n.readed_at IS NULL
      AND (
          _workspace_id IS NULL
          OR c.workspace_id = _workspace_id
      );

    -- 2) Count all unread "mention" notifications
    SELECT COUNT(*)
    INTO v_unread_mention_count
    FROM public.notifications AS n
    JOIN public.channels      AS c ON c.id = n.channel_id
    WHERE n.receiver_user_id = auth.uid()
      AND n.type = 'mention'
      AND n.readed_at IS NULL
      AND (
          _workspace_id IS NULL
          OR c.workspace_id = _workspace_id
      );

    -- 3) Last 6 unread notifications (with embedded sender data)
    SELECT JSONB_AGG(to_jsonb(sub.*))
    INTO v_last_unread
    FROM (
        SELECT
            n.id,
            n.type,
            n.message_id,
            n.channel_id,
            n.action_url,
            n.message_preview,
            n.created_at,
            n.readed_at,
            JSON_BUILD_OBJECT(
                'id',               u.id,
                'username',         u.username,
                'full_name',        u.full_name,
                'avatar_url',       u.avatar_url,
                'display_name',     u.display_name,
                'avatar_updated_at',u.avatar_updated_at
            ) AS sender
        FROM public.notifications AS n
        JOIN public.channels      AS c ON c.id = n.channel_id
        LEFT JOIN public.users    AS u ON u.id = n.sender_user_id
        WHERE n.receiver_user_id = auth.uid()
          AND n.readed_at IS NULL
          AND (
              _workspace_id IS NULL
              OR c.workspace_id = _workspace_id
          )
        ORDER BY n.created_at DESC
        LIMIT 6
    ) AS sub;

    -- 4) Last 6 unread "mention" notifications (with embedded sender data)
    SELECT JSONB_AGG(to_jsonb(sub.*))
    INTO v_last_unread_mention
    FROM (
        SELECT
            n.id,
            n.type,
            n.message_id,
            n.channel_id,
            n.action_url,
            n.message_preview,
            n.created_at,
            n.readed_at,
            JSON_BUILD_OBJECT(
                'id',               u.id,
                'username',         u.username,
                'full_name',        u.full_name,
                'avatar_url',       u.avatar_url,
                'display_name',     u.display_name,
                'avatar_updated_at',u.avatar_updated_at
            ) AS sender
        FROM public.notifications AS n
        JOIN public.channels      AS c ON c.id = n.channel_id
        LEFT JOIN public.users    AS u ON u.id = n.sender_user_id
        WHERE n.receiver_user_id = auth.uid()
          AND n.type = 'mention'
          AND n.readed_at IS NULL
          AND (
              _workspace_id IS NULL
              OR c.workspace_id = _workspace_id
          )
        ORDER BY n.created_at DESC
        LIMIT 6
    ) AS sub;

    RETURN JSONB_BUILD_OBJECT(
        'unread_count',         v_unread_count,
        'unread_mention_count', v_unread_mention_count,
        'last_unread',         COALESCE(v_last_unread, '[]'::JSONB),
        'last_unread_mention', COALESCE(v_last_unread_mention, '[]'::JSONB)
    );
END;
$$;

ALTER FUNCTION public.notifications_summary(_workspace_id character varying) SET search_path = public;
