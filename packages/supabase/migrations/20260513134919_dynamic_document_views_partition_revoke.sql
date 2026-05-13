-- Revoke direct authenticated DML on every existing document_views_YYYY_MM
-- partition. Replaces the hardcoded list (2026_01..04) in 29-lint-hardening.sql
-- so the revoke also covers partitions created later by 09-document-views.sql's
-- monthly partition rollover. Idempotent — re-running is a no-op once revoked.
-- Pair: packages/supabase/scripts/29-lint-hardening.sql

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
