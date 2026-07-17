-- Advisor hygiene batch — clears the remaining WARN-level lints so real
-- signals stand out on the dashboard (no behavior change intended):
--   1. wrap bare auth.uid()/is_admin(auth.uid()) policy predicates as scalar
--      subqueries so they evaluate once per query, not per row (lint 0003);
--      pairs with scripts/02-z-admin-users.sql, 06-message-bookmarks.sql,
--      07-3-notification-broadcast.sql, 07-4/07-5, 09-document-views.sql,
--      13-RLS.sql;
--   2. re-run the programmatic search_path sweep from
--      scripts/29-lint-hardening.sql — prod predates it, so 23 functions
--      (including prod-only legacy ones) are still unpinned (lint 0011);
--   3. drop the two duplicate indexes flagged by lint 0009; pairs with the
--      removal in scripts/11-indexes.sql (the pinned_messages unique
--      constraint in 06-pinned_message.sql keeps the surviving index).

alter policy "Users can check own admin status" on public.admin_users
    using (user_id = (select auth.uid()));
alter policy "Admins can view all" on public.admin_users
    using ((select public.is_admin((select auth.uid()))));
alter policy "Admins can insert" on public.admin_users
    with check ((select public.is_admin((select auth.uid()))));
alter policy "Admins can delete others" on public.admin_users
    using (user_id != (select auth.uid()) and (select public.is_admin((select auth.uid()))));

alter policy "Users can view their own bookmarks" on public.message_bookmarks
    using ((select auth.uid()) = user_id);
alter policy "Users can create their own bookmarks" on public.message_bookmarks
    with check ((select auth.uid()) = user_id);
alter policy "Users can update their own bookmarks" on public.message_bookmarks
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
alter policy "Users can delete their own bookmarks" on public.message_bookmarks
    using ((select auth.uid()) = user_id);

alter policy "Admins can read document_view_stats" on public.document_view_stats
    using ((select public.is_admin((select auth.uid()))));
alter policy "Admins can read document_views_daily" on public.document_views_daily
    using ((select public.is_admin((select auth.uid()))));

alter policy users_self_update on public.users
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));
alter policy workspaces_creator_insert on public.workspaces
    with check (created_by = (select auth.uid()));
alter policy channels_member_insert on public.channels
    with check (created_by = (select auth.uid()) and internal.is_workspace_member(workspace_id));
alter policy channel_members_self_update on public.channel_members
    using (member_id = (select auth.uid()))
    with check (member_id = (select auth.uid()));
alter policy messages_self_insert on public.messages
    with check (user_id = (select auth.uid()) and internal.can_read_channel(channel_id));
alter policy messages_self_update on public.messages
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
alter policy notifications_self_select on public.notifications
    using (receiver_user_id = (select auth.uid()));
alter policy notifications_self_update on public.notifications
    using (receiver_user_id = (select auth.uid()))
    with check (receiver_user_id = (select auth.uid()));

alter policy "Users can manage own subscriptions" on public.push_subscriptions
    using ((select auth.uid()) = user_id);
alter policy "Users can view own email queue" on public.email_queue
    using ((select auth.uid()) = user_id);

-- realtime.messages may be owned by a platform role the migration role cannot
-- act for; skip silently rather than fail the whole batch.
do $$
begin
    alter policy "notifications_topic_access" on realtime.messages
        using (realtime.messages.topic = 'notifications:' || (select auth.uid())::text);
exception when insufficient_privilege then
    raise notice 'skipping notifications_topic_access alter (not table owner)';
end;
$$;

-- search_path sweep from scripts/29-lint-hardening.sql: pins
-- SET search_path = public on every public/internal function owned by the
-- running role that lacks it (covers prod-only legacy functions too).
DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('public', 'internal')
          AND p.prokind = 'f'
          AND p.proowner = current_user::regrole
          AND NOT EXISTS (
              SELECT 1
              FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
              WHERE cfg LIKE 'search_path=%'
          )
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = public',
            fn.nspname, fn.proname, fn.args
        );
    END LOOP;
END
$$;

drop index if exists public.idx_pinned_messages_channel_id_message_id;
drop index if exists public.idx_push_subs_user_active;
