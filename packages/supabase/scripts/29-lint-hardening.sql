-- =====================================================================
-- 29 — Lint hardening sweep
-- =====================================================================
-- Loaded last by the script bootstrap so it runs after every function
-- and table is defined. Closes WARN-level Supabase linter findings:
--   • function_search_path_mutable                      (~63 fns)
--   • public_bucket_allows_listing                      (3 buckets)
--   • pg_graphql_anon_table_exposed                     (21 tables)
--   • pg_graphql_authenticated_table_exposed (admin)    (10 tables)
--   • anon_security_definer_function_executable         (31 fns)
--   • authenticated_security_definer_function_executable (selective)
--
-- Strategy: revoke broadly (DO-block sweeps), grant back the small
-- whitelist explicitly. Idempotent — every statement uses IF EXISTS /
-- ALTER / programmatic discovery so re-running is safe.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. search_path sweep — pin SET search_path = public on every function
--    in public/internal that doesn't already have it set.
-- =====================================================================
-- Programmatic so future-added fns are caught on re-run. Skips
-- aggregates/window/procedures (only `prokind = 'f'`).

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
          -- Only functions whose owner is the role running this migration.
          -- Local Supabase exposes some helpers as `supabase_admin`-owned;
          -- those need to be re-grant-tightened by `supabase_admin` (or
          -- left alone). Skip silently here so the migration is portable.
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


-- =====================================================================
-- 2. Drop overbroad public-bucket SELECT/listing policies
-- =====================================================================
-- Public buckets serve files via direct URL; the SELECT-on-objects
-- policies allow listing every file in the bucket, which exposes the
-- file inventory. URL-based read access is unaffected (controlled by
-- the bucket's `public` flag in storage.buckets).

DROP POLICY IF EXISTS "Channel Avatar is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Media files are publicly accessible"   ON storage.objects;
DROP POLICY IF EXISTS "User Avatar is publicly accessible"    ON storage.objects;


-- =====================================================================
-- 3. Tighten anon table access (GraphQL schema discovery)
-- =====================================================================
-- Default-deny anon across public; then re-grant SELECT for the small
-- set of tables that anon legitimately reads (PUBLIC channel lurking).
-- Read access is filtered row-by-row by the `<table>_public_anon_select`
-- policies in 13-RLS.sql §3 so anon only sees PUBLIC-channel rows.

REVOKE SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public
    FROM anon;

-- Re-grant SELECT for the chat read path. Row-level filtering happens
-- through the anon policies; this just lifts the GRANT-layer block.
GRANT SELECT ON public.channels               TO anon;
GRANT SELECT ON public.messages               TO anon;
GRANT SELECT ON public.channel_message_counts TO anon;
GRANT SELECT ON public.pinned_messages        TO anon;
GRANT SELECT ON public.workspaces             TO anon;

-- users: column-level only — `email` is excluded from anon visibility.
GRANT SELECT (
    id, username, full_name, display_name, avatar_url, avatar_updated_at,
    profile_data, status, online_at, created_at, updated_at, deleted_at
) ON public.users TO anon;

-- channel_members + message_bookmarks: the read RPCs join these to
-- compose user-specific fields (last_read, is_bookmarked). Anon needs
-- GRANT-layer access so the JOIN doesn't 42501; RLS already yields zero
-- rows for anon (no anon-targeted policy), so user-scoped fields come
-- back NULL — the intended semantics for guest readers.
GRANT SELECT ON public.channel_members  TO anon;
GRANT SELECT ON public.message_bookmarks TO anon;


-- =====================================================================
-- 4. Tighten authenticated table access for admin/internal-only tables
-- =====================================================================
-- Tables whose only authenticated access path is via SECURITY DEFINER
-- RPCs (definer bypass). Direct PostgREST/GraphQL access is removed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.admin_users            FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_queue            FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_bounces          FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions     FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_view_stats    FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_views         FROM authenticated;

-- Partition tables (document_views_YYYY_MM) are created dynamically by
-- 09-document-views.sql for current + next 3 months, so the exact set
-- depends on when the script runs. Discover and revoke at runtime.
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

-- document_views_daily may exist on remote but not local; guard.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='document_views_daily'
    ) THEN
        EXECUTE 'REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_views_daily FROM authenticated';
    END IF;
END
$$;


-- =====================================================================
-- 5. Mass revoke EXECUTE FROM anon, authenticated on all public-schema
--    SECURITY DEFINER functions. Re-grant the small user-facing whitelist
--    in §6 below.
-- =====================================================================

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND p.prosecdef = true
          -- Only functions we own; supabase_admin-owned ones (email pgmq
          -- helpers on local) need to be revoked by their owner. Sprint 3a
          -- already covered them where ownable.
          AND p.proowner = current_user::regrole
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM public, anon, authenticated',
            fn.nspname, fn.proname, fn.args
        );
    END LOOP;
END
$$;


-- =====================================================================
-- 6. GRANT EXECUTE TO authenticated — user-facing chat RPC whitelist
-- =====================================================================
-- Each entry corresponds to a file under packages/webapp/src/api/rpc/
-- (or a direct policy-primitive). Functions not in this list are
-- service_role-only (admin / worker / cron / trigger).
--
-- `_safe_grant_authenticated` wraps the GRANT in EXISTS check so a
-- function that doesn't exist locally (e.g. work-in-progress) doesn't
-- abort the migration. Keeps the apply portable across local/staging/prod.

DO $$
DECLARE
    fn record;
    fn_name text;
    user_facing_names text[] := ARRAY[
        -- Channel/feed reads
        'get_channel_aggregate_data',
        'get_channel_members_by_last_read_update',
        -- Bookmarks
        'toggle_message_bookmark', 'archive_bookmark', 'mark_bookmark_as_read',
        'get_bookmark_count', 'get_bookmark_stats', 'get_user_bookmarks',
        -- Notifications
        'notifications_summary', 'get_unread_notif_count',
        'get_unread_notifications_paginated', 'get_channel_notif_state',
        'get_workspace_notifications',
        -- Mentions / DMs
        'fetch_mentioned_users', 'create_direct_message_channel',
        -- Workspace / presence
        'join_workspace', 'update_user_online_at',
        -- Push subscriptions (per-user)
        'register_push_subscription', 'unregister_push_subscription',
        -- Policy primitive — used inside admin_users RLS, must remain
        -- callable in policy expressions for authenticated callers
        'is_admin'
    ];
BEGIN
    FOREACH fn_name IN ARRAY user_facing_names
    LOOP
        FOR fn IN
            SELECT p.oid, n.nspname, p.proname,
                   pg_get_function_identity_arguments(p.oid) AS args
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = fn_name
        LOOP
            EXECUTE format(
                'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
                fn.nspname, fn.proname, fn.args
            );
        END LOOP;
    END LOOP;
END
$$;


-- =====================================================================
-- 7. GRANT EXECUTE TO anon (+ authenticated) — analytics + read whitelist
-- =====================================================================
-- These RPCs power anonymous document-view tracking AND anonymous read
-- access to PUBLIC chat. `get_channel_aggregate_data` gates internally
-- on `type = 'PUBLIC' OR is_channel_member(...)`, so the anon caller
-- can only fetch PUBLIC-channel rows.

GRANT EXECUTE ON FUNCTION public.enqueue_document_view(text, text, uuid, boolean, text)
    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_view_duration(uuid, integer)
    TO anon, authenticated;

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('get_channel_aggregate_data')
    LOOP
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon',
            fn.nspname, fn.proname, fn.args
        );
    END LOOP;
END
$$;


-- =====================================================================
-- 8. supabase_admin-owned cleanup
-- =====================================================================
-- A handful of email/push pgmq helpers are created under the
-- `supabase_admin` role on local Docker (Supabase-internal pattern).
-- The owner-only ACL of REVOKE means our `postgres` migration role
-- cannot strip them locally. On real Supabase projects, the migration
-- role can revoke these. Wrapped in EXCEPTION so a local apply is a
-- no-op while a remote apply succeeds.

DO $$
DECLARE
    revoke_sql text;
    revoke_sqls text[] := ARRAY[
        'REVOKE EXECUTE ON FUNCTION public.ack_email_message(bigint) FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.compile_digest_emails() FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.consume_email_queue(integer, integer) FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.consume_push_queue(integer, integer) FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.enqueue_push_notification() FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.record_email_bounce(text, text, text, text) FROM public, anon, authenticated',
        'REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_bounces FROM anon, authenticated'
    ];
BEGIN
    FOREACH revoke_sql IN ARRAY revoke_sqls
    LOOP
        BEGIN
            EXECUTE revoke_sql;
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE NOTICE 'Skipped (local supabase_admin ownership): %', revoke_sql;
            WHEN undefined_function OR undefined_table THEN
                RAISE NOTICE 'Skipped (object not present): %', revoke_sql;
        END;
    END LOOP;
END
$$;


COMMIT;


-- =====================================================================
-- Post-apply verification
-- =====================================================================
-- Re-run the underlying linter SQL to confirm the four categories are clean:
--
-- (a) Mutable search_path (expect 0)
--   SELECT n.nspname || '.' || p.proname AS fn
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname IN ('public','internal')
--     AND p.prokind = 'f'
--     AND NOT EXISTS (
--       SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
--       WHERE cfg LIKE 'search_path=%'
--     );
--
-- (b) Public-bucket listing policies (expect 0)
--   SELECT polname FROM pg_policy
--   WHERE polrelid = 'storage.objects'::regclass
--     AND polname IN (
--       'Channel Avatar is publicly accessible',
--       'Media files are publicly accessible',
--       'User Avatar is publicly accessible'
--     );
--
-- (c) anon SELECT on public tables (expect 0)
--   SELECT table_name FROM information_schema.role_table_grants
--   WHERE grantee='anon' AND table_schema='public' AND privilege_type='SELECT';
--
-- (d) anon EXECUTE on SECURITY DEFINER fns (expect 2: enqueue_document_view, update_view_duration)
--   SELECT p.proname FROM pg_proc p
--   JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.prosecdef = true
--     AND has_function_privilege('anon', p.oid, 'EXECUTE');
