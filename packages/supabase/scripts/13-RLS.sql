-- =====================================================================
-- 13-RLS.sql — Row-Level Security: helpers + policies for chat surface
-- =====================================================================
-- Source of truth for the chat-surface RLS rollout. Mirrored by the
-- migration `20260513130000_chat_rls_rollout_catchup.sql`. See
-- docs/superpowers/plans/chatroom-s3-1-rls-rollout.md for design rationale.
--
-- Load order: this file runs after the table-creation scripts (02-08),
-- the function/RPC scripts (10-*), and the message-counter / cron / extension
-- scripts (11-12). The internal policy primitives (is_workspace_member,
-- is_channel_member, can_read_channel) live in 10-0-func-helpers.sql so the
-- 10-x RPCs that call them seed after their definitions; this file keeps
-- their grants, hardening, and every policy expression.
-- =====================================================================


-- Anon needs USAGE on internal because its policies below call
-- can_open_document. PostgREST does not expose the internal schema.
GRANT USAGE ON SCHEMA internal                                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.can_open_document(varchar, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_workspace_member(varchar) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_channel_member(varchar)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.can_read_channel(varchar)    TO authenticated, service_role;

-- Table privileges for authenticated + service_role.
-- Newer Supabase local stacks no longer auto-GRANT ALL on public tables to
-- authenticated/service_role. RLS policies alone are not enough: SECURITY
-- INVOKER RPCs (fetch_message_window, get_channel_aggregate_data, …) and
-- PostgREST need GRANT-layer access or they 42501. Anon SELECT whitelist
-- lives in 29-lint-hardening.sql §3; admin-table revokes stay in §4.
GRANT SELECT ON public.workspaces TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT SELECT ON public.channels TO authenticated;
GRANT SELECT, INSERT ON public.channel_members TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
-- Some images add a default table-wide grant, so each REVOKE below clears it.
-- A table revoke also clears column grants, so it runs before them.
-- A client never chooses a channel id, type or counter (#402).
REVOKE INSERT ON public.channels FROM authenticated;
GRANT INSERT (workspace_id, heading_id, created_by, name, slug) ON public.channels TO authenticated;
REVOKE INSERT, UPDATE ON public.messages FROM authenticated;
GRANT INSERT (id, channel_id, user_id, content, html, medias, type, metadata, reply_to_message_id)
  ON public.messages TO authenticated;
GRANT UPDATE (content, html, medias, type, deleted_at) ON public.messages TO authenticated;
GRANT SELECT ON public.pinned_messages TO authenticated;
GRANT SELECT ON public.channel_message_counts TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT ON public.message_bookmarks TO authenticated;
-- SECURITY DEFINER RPCs are the only writers (join_workspace, the bookmark RPCs).
REVOKE INSERT, UPDATE ON public.workspaces FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.message_bookmarks FROM authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;


-- =====================================================================
-- 2. RLS + policies per table
-- =====================================================================

-- 2a. users — readable by every authenticated user (mention picker, sender
--     info, avatars). Column-level GRANT excludes `email`, `status` and
--     `online_at` from both anon (29-lint-hardening.sql §3) and authenticated
--     (below), so the row policy stays `USING (true)`. Definer code reads them (#434).

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select       ON public.users;
DROP POLICY IF EXISTS users_self_update  ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_self_update ON public.users
  FOR UPDATE TO authenticated
  USING      (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Mirror the anon column whitelist for authenticated. `email`, `status` and
-- `online_at` are excluded; DEFINER RPCs bypass column grants.
REVOKE SELECT ON public.users FROM authenticated;
GRANT SELECT (
    id, username, full_name, display_name, avatar_url, avatar_updated_at,
    profile_data, created_at, updated_at, deleted_at
) ON public.users TO authenticated;

-- Mirror the SELECT whitelist for UPDATE so PostgREST cannot accept a PATCH
-- against `email`, `id`, `created_at`, or any column outside the
-- user-editable profile surface. `online_at` is excluded because it's
-- trigger-maintained from `status` writes — granting it directly would
-- let a client antedate themselves and skew the online-window used by
-- push suppression. DEFINER RPCs bypass column grants.
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (
    username, full_name, avatar_url, avatar_updated_at, profile_data, status
) ON public.users TO authenticated;


-- 2b. workspaces — visible to active members. No client writes: join_workspace
--     (SECURITY DEFINER) is the only writer, so there is no INSERT policy.

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspaces_member_select  ON public.workspaces;
DROP POLICY IF EXISTS workspaces_creator_insert ON public.workspaces;

CREATE POLICY workspaces_member_select ON public.workspaces
  FOR SELECT TO authenticated
  USING (internal.is_workspace_member(id));


-- 2c. workspace_members — same-workspace members see each other.

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;

CREATE POLICY workspace_members_select ON public.workspace_members
  FOR SELECT TO authenticated
  USING (internal.is_workspace_member(workspace_id));


-- 2d. channels — PUBLIC bypass + member visibility.
--     INSERT: only as creator and only into a workspace I'm a member of. The column
--     grant above leaves out id, so a new row takes the default id and is keyed by
--     (workspace_id, heading_id).
--     UPDATE: none from the client. SECURITY DEFINER triggers keep the
--     counters, previews and activity time current.

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channels_visible_select  ON public.channels;
DROP POLICY IF EXISTS channels_member_insert   ON public.channels;
DROP POLICY IF EXISTS channels_member_update   ON public.channels;

CREATE POLICY channels_visible_select ON public.channels
  FOR SELECT TO authenticated
  USING (
    (type = 'PUBLIC' AND internal.can_open_document(workspace_id, (select auth.uid())))
    OR internal.is_channel_member(id)
  );

CREATE POLICY channels_member_insert ON public.channels
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND internal.is_workspace_member(workspace_id)
  );

REVOKE UPDATE ON public.channels FROM authenticated;


-- 2e. channel_members — own row always, plus the full roster to channel members.
--     Not can_read_channel: that returns true for any PUBLIC channel, which would
--     expose every peer's notif_state / mute / read cursors to authed non-members.
--     Members read the roster (is_channel_member); non-members read only their own
--     row. FE: insert own row (joinChannel), update only notification + read cursor
--     columns (column GRANT below).

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_members_select ON public.channel_members;

CREATE POLICY channel_members_select ON public.channel_members
  FOR SELECT TO authenticated
  USING (member_id = (select auth.uid()) OR internal.is_channel_member(channel_id));

-- FE joinChannel uses PostgREST upsert; invoker must insert/update own row only.
-- A signed-in workspace member seeds their own row in a live PUBLIC channel;
-- can_read_channel is the wrong gate here — the row it looks for does not exist yet.

DROP POLICY IF EXISTS channel_members_join_insert ON public.channel_members;
CREATE POLICY channel_members_join_insert ON public.channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND c.deleted_at IS NULL
        AND c.type = 'PUBLIC'
        AND internal.is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS channel_members_self_update ON public.channel_members;
CREATE POLICY channel_members_self_update ON public.channel_members
  FOR UPDATE TO authenticated
  USING (member_id = (select auth.uid()))
  WITH CHECK (member_id = (select auth.uid()));

REVOKE UPDATE ON public.channel_members FROM authenticated;
GRANT UPDATE (
  last_read_message_id,
  last_read_update_at,
  mute_in_app_notifications,
  notif_state
) ON public.channel_members TO authenticated;


-- 2f. messages — visible iff channel is readable.
--     INSERT: as self into a readable channel. UPDATE: own row (edit, soft delete)
--     in a readable channel, so a past member of a Private document cannot edit.
--     Clients write only the columns granted at the top. Notice rows (type
--     notification) are server-only: definer and service-role writers skip RLS.

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
    user_id = (select auth.uid())
    AND internal.can_read_channel(channel_id)
    AND type IS DISTINCT FROM 'notification'
  );

CREATE POLICY messages_self_update ON public.messages
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND type IS DISTINCT FROM 'notification'
    AND internal.can_read_channel(channel_id)
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND type IS DISTINCT FROM 'notification'
  );


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
  USING (receiver_user_id = (select auth.uid()));

CREATE POLICY notifications_self_update ON public.notifications
  FOR UPDATE TO authenticated
  USING      (receiver_user_id = (select auth.uid()))
  WITH CHECK (receiver_user_id = (select auth.uid()));


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
-- A Private document is closed to anon: every policy below passes a null user
-- to internal.can_open_document (#396).
--
-- Each policy is a separate `<table>_public_anon_select` rule scoped to
-- TO anon — authenticated paths above remain unchanged. This deliberately
-- re-introduces `pg_graphql_anon_table_exposed` lints on these tables;
-- that's product intent now, not an oversight.

DROP POLICY IF EXISTS channels_public_anon_select       ON public.channels;
CREATE POLICY channels_public_anon_select ON public.channels
  FOR SELECT TO anon
  USING (
    type = 'PUBLIC'
    AND deleted_at IS NULL
    AND internal.can_open_document(workspace_id, null::uuid)
  );

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
        AND internal.can_open_document(c.workspace_id, null::uuid)
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
        AND internal.can_open_document(c.workspace_id, null::uuid)
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
        AND internal.can_open_document(c.workspace_id, null::uuid)
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
    AND internal.can_open_document(workspaces.id, null::uuid)
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
ALTER FUNCTION internal.can_open_document(p_document_id character varying, p_user_id uuid) SET search_path = public;

-- ============================================================
-- v2 chatroom RPC grants (paired with migrations 20260513140500..20260513141500).
-- Mirrored here so privilege review reads in one place.
-- ============================================================
grant execute on function public.fetch_message_window(varchar, text, text, int, int)
  to authenticated, anon;
grant execute on function public.fetch_messages_since(varchar, bigint, int)
  to authenticated, anon;
grant execute on function public.advance_read_cursor(varchar, bigint) to authenticated;
revoke execute on function public.advance_read_cursor(varchar, bigint) from anon, public;
grant execute on function public.add_reaction(uuid, text) to authenticated;
revoke execute on function public.add_reaction(uuid, text) from anon, public;
grant execute on function public.remove_reaction(uuid, text) to authenticated;
revoke execute on function public.remove_reaction(uuid, text) from anon, public;
