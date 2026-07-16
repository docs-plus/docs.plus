-- Restore GRANT-layer access for authenticated (and service_role) on chat
-- surface tables. Newer Supabase local images no longer auto-GRANT ALL on
-- public tables; without these, SECURITY INVOKER RPCs fail with 42501
-- "permission denied for table messages|channels|channel_members".
-- Mirrors packages/supabase/scripts/13-RLS.sql (table privilege block).

GRANT SELECT, INSERT ON public.workspaces TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT ON public.channels TO authenticated;
GRANT SELECT, INSERT ON public.channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT SELECT ON public.pinned_messages TO authenticated;
GRANT SELECT ON public.channel_message_counts TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_bookmarks TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Keep admin/internal tables locked to DEFINER/service_role paths
-- (same revokes as 29-lint-hardening.sql §4).
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.admin_users FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_queue FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_bounces FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_view_stats FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_views FROM authenticated;

DO $$
DECLARE
    rec record;
BEGIN
    FOR rec IN
        SELECT n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname ~ '^document_views_[0-9]{4}_[0-9]{2}$'
    LOOP
        EXECUTE format(
            'REVOKE SELECT, INSERT, UPDATE, DELETE ON %I.%I FROM authenticated',
            rec.nspname, rec.relname
        );
    END LOOP;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'document_views_daily'
    ) THEN
        EXECUTE 'REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_views_daily FROM authenticated';
    END IF;
END
$$;
