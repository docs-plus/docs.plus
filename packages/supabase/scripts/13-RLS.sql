-- =====================================================================
-- 13-RLS.sql — Row-Level Security: helpers + policies for chat surface
-- =====================================================================
-- Source of truth for the chat-surface RLS rollout. Mirrored by the
-- migration `20260506180311_chat_rls_rollout.sql`. See
-- docs/superpowers/plans/chatroom-s3-1-rls-rollout.md for design rationale.
--
-- Load order: this file runs after the table-creation scripts (02-08),
-- the function/RPC scripts (10-*), and the message-counter / cron / extension
-- scripts (11-12). Helpers come first in this file so the policy
-- expressions below can reference them.
-- =====================================================================


-- =====================================================================
-- 1. internal helper functions (policy primitives)
-- =====================================================================
-- SECURITY DEFINER + SET search_path = public — search-path-hijack safe.
-- STABLE SQL bodies are inlined by the planner, so policy expressions
-- effectively become the inlined EXISTS subqueries against:
--   workspace_members_workspace_id_member_id_key  → is_workspace_member
--   idx_channel_members_channel_id_member_id      → is_channel_member
--   channels_pkey + the above                     → can_read_channel

CREATE SCHEMA IF NOT EXISTS internal;

CREATE OR REPLACE FUNCTION internal.is_workspace_member(p_workspace_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND member_id    = auth.uid()
      AND left_at IS NULL
  );
$$;

COMMENT ON FUNCTION internal.is_workspace_member(varchar) IS
'Active workspace membership predicate for RLS policies.';

CREATE OR REPLACE FUNCTION internal.is_channel_member(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id
      AND member_id  = auth.uid()
      AND left_at IS NULL
  );
$$;

COMMENT ON FUNCTION internal.is_channel_member(varchar) IS
'Active channel membership predicate for RLS policies.';

CREATE OR REPLACE FUNCTION internal.can_read_channel(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = p_channel_id
      AND (
        c.type = 'PUBLIC'
        OR EXISTS (
          SELECT 1 FROM public.channel_members cm
          WHERE cm.channel_id = c.id
            AND cm.member_id  = auth.uid()
            AND cm.left_at IS NULL
        )
      )
  );
$$;

COMMENT ON FUNCTION internal.can_read_channel(varchar) IS
'PUBLIC bypass + active channel membership; read-eligibility predicate.';

-- Anon is blocked at the policy level (TO authenticated) before any helper
-- call, so anon does not need USAGE on internal.
GRANT USAGE ON SCHEMA internal                                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_workspace_member(varchar) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_channel_member(varchar)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.can_read_channel(varchar)    TO authenticated, service_role;


-- =====================================================================
-- 2. RLS + policies per table
-- =====================================================================

-- 2a. users — readable by every authenticated user (mention picker, sender
--     info, avatars). users.email exposure tracked as S3.1a follow-up.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select       ON public.users;
DROP POLICY IF EXISTS users_self_update  ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_self_update ON public.users
  FOR UPDATE TO authenticated
  USING      (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- 2b. workspaces — visible to active members.

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspaces_member_select  ON public.workspaces;
DROP POLICY IF EXISTS workspaces_creator_insert ON public.workspaces;

CREATE POLICY workspaces_member_select ON public.workspaces
  FOR SELECT TO authenticated
  USING (internal.is_workspace_member(id));

-- Auto-bootstrap path: client/SSR INSERT a workspace row when a new doc is
-- opened. Confined to the creating user; UPDATE remains gated through
-- SECURITY DEFINER paths (e.g. join_workspace) so name/slug stay immutable
-- from PostgREST.
CREATE POLICY workspaces_creator_insert ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());


-- 2c. workspace_members — same-workspace members see each other.

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;

CREATE POLICY workspace_members_select ON public.workspace_members
  FOR SELECT TO authenticated
  USING (internal.is_workspace_member(workspace_id));


-- 2d. channels — PUBLIC bypass + member visibility.
--     INSERT: only as creator and only into a workspace I'm a member of.
--     UPDATE: any active member can update *mutable* columns; immutable
--     columns are locked via column-level GRANT below.

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channels_visible_select  ON public.channels;
DROP POLICY IF EXISTS channels_member_insert   ON public.channels;
DROP POLICY IF EXISTS channels_member_update   ON public.channels;

CREATE POLICY channels_visible_select ON public.channels
  FOR SELECT TO authenticated
  USING (type = 'PUBLIC' OR internal.is_channel_member(id));

CREATE POLICY channels_member_insert ON public.channels
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND internal.is_workspace_member(workspace_id)
  );

CREATE POLICY channels_member_update ON public.channels
  FOR UPDATE TO authenticated
  USING      (internal.is_channel_member(id))
  WITH CHECK (internal.is_channel_member(id));

-- Column-level grant: lock id/slug/workspace_id/created_by/type/member_count
-- /deleted_at/created_at/updated_at from direct FE update. RPCs (definer)
-- bypass column grants too.
REVOKE UPDATE ON public.channels FROM authenticated;
GRANT UPDATE (
  name, description, member_limit, is_avatar_set,
  allow_emoji_reactions, mute_in_app_notifications, metadata,
  last_message_preview, last_activity_at
) ON public.channels TO authenticated;


-- 2e. channel_members — visible iff channel is readable.
--     FE: insert own row (joinChannel), update only notification + read cursor columns (column GRANT below).

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_members_select ON public.channel_members;

CREATE POLICY channel_members_select ON public.channel_members
  FOR SELECT TO authenticated
  USING (internal.can_read_channel(channel_id));

-- FE joinChannel uses PostgREST upsert; invoker must insert/update own row only.
-- Eligibility: PUBLIC channels (same read gate as lurkers with login) or workspace member
-- (PRIVATE heading chats before a channel_members row exists — chicken/egg vs can_read_channel).

DROP POLICY IF EXISTS channel_members_join_insert ON public.channel_members;
CREATE POLICY channel_members_join_insert ON public.channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND c.deleted_at IS NULL
        AND (
          c.type = 'PUBLIC'
          OR internal.is_workspace_member(c.workspace_id)
        )
    )
  );

DROP POLICY IF EXISTS channel_members_self_update ON public.channel_members;
CREATE POLICY channel_members_self_update ON public.channel_members
  FOR UPDATE TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

REVOKE UPDATE ON public.channel_members FROM authenticated;
GRANT UPDATE (
  last_read_message_id,
  last_read_update_at,
  mute_in_app_notifications,
  notif_state
) ON public.channel_members TO authenticated;


-- 2f. messages — visible iff channel is readable.
--     INSERT: as self into a readable channel.
--     UPDATE: only own row (covers edit + soft-delete via deleted_at).

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_visible_select ON public.messages;
DROP POLICY IF EXISTS messages_self_insert    ON public.messages;
DROP POLICY IF EXISTS messages_self_update    ON public.messages;

CREATE POLICY messages_visible_select ON public.messages
  FOR SELECT TO authenticated
  USING (internal.can_read_channel(channel_id));

CREATE POLICY messages_self_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND internal.can_read_channel(channel_id)
  );

CREATE POLICY messages_self_update ON public.messages
  FOR UPDATE TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- 2g. pinned_messages — readable iff channel is readable.
--     Writes via update_message_on_pin trigger (definer bypass).

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pinned_messages_select ON public.pinned_messages;

CREATE POLICY pinned_messages_select ON public.pinned_messages
  FOR SELECT TO authenticated
  USING (internal.can_read_channel(channel_id));


-- 2h. channel_message_counts — readable iff channel is readable.
--     Writes via the counter worker (definer bypass).

ALTER TABLE public.channel_message_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_message_counts_select ON public.channel_message_counts;

CREATE POLICY channel_message_counts_select ON public.channel_message_counts
  FOR SELECT TO authenticated
  USING (internal.can_read_channel(channel_id));


-- 2i. notifications — only your own.
--     INSERT via the notification creators (triggers, definer bypass).

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_self_select  ON public.notifications;
DROP POLICY IF EXISTS notifications_self_update  ON public.notifications;

CREATE POLICY notifications_self_select ON public.notifications
  FOR SELECT TO authenticated
  USING (receiver_user_id = auth.uid());

CREATE POLICY notifications_self_update ON public.notifications
  FOR UPDATE TO authenticated
  USING      (receiver_user_id = auth.uid())
  WITH CHECK (receiver_user_id = auth.uid());


-- 2j. document_views (parent + future month-partitions) — analytics only.
--     enqueue_document_view (definer) and analytics RPCs (service_role)
--     bypass RLS. No SELECT/INSERT/UPDATE/DELETE policy → default deny
--     for authenticated/anon. The `create_document_views_partitions`
--     function (21-document-views.sql) is patched to enable RLS on each
--     newly-created partition so the linter stays clean every month.

ALTER TABLE public.document_views ENABLE ROW LEVEL SECURITY;
-- Existing partitions get RLS enabled by the migration. The line below
-- exists so a fresh `db reset` (which loads scripts from scratch) lands
-- in the same state without depending on migration replay. Currently a
-- no-op because the partition tables are managed by the cron function.


-- =====================================================================
-- 3. Anonymous read access to PUBLIC channels
-- =====================================================================
-- Product: anonymous visitors can READ chat in PUBLIC channels (lurking).
-- Writes (send, react, bookmark, mark-as-read) require login; the FE
-- gates those actions behind authentication, and the existing INSERT/
-- UPDATE policies (TO authenticated only) keep the DB layer correct
-- even if the FE skips its gate.
--
-- For unread display: anon has no channel_members row, so the FE shows
-- channel_message_counts.message_count as the "messages so far" total
-- (see useMapDocumentAndWorkspace.ts::fetchChannels).
--
-- Each policy is a separate `<table>_public_anon_select` rule scoped to
-- TO anon — authenticated paths above remain unchanged. This deliberately
-- re-introduces `pg_graphql_anon_table_exposed` lints on these tables;
-- that's product intent now, not an oversight.

DROP POLICY IF EXISTS channels_public_anon_select       ON public.channels;
CREATE POLICY channels_public_anon_select ON public.channels
  FOR SELECT TO anon
  USING (type = 'PUBLIC' AND deleted_at IS NULL);

DROP POLICY IF EXISTS messages_public_anon_select       ON public.messages;
CREATE POLICY messages_public_anon_select ON public.messages
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS counts_public_anon_select         ON public.channel_message_counts;
CREATE POLICY counts_public_anon_select ON public.channel_message_counts
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_message_counts.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS pinned_public_anon_select         ON public.pinned_messages;
CREATE POLICY pinned_public_anon_select ON public.pinned_messages
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = pinned_messages.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS users_public_anon_select          ON public.users;
CREATE POLICY users_public_anon_select ON public.users
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS workspaces_public_anon_select     ON public.workspaces;
CREATE POLICY workspaces_public_anon_select ON public.workspaces
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.workspace_id = workspaces.id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );


-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION internal.is_workspace_member(p_workspace_id character varying) SET search_path = public;
ALTER FUNCTION internal.is_channel_member(p_channel_id character varying) SET search_path = public;
ALTER FUNCTION internal.can_read_channel(p_channel_id character varying) SET search_path = public;
