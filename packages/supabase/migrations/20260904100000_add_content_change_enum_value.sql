-- Issue #203, part one of two. The enum value ships alone and consumes nothing.
-- Supabase wraps each migration in one transaction, and Postgres forbids using
-- an enum value added inside the same transaction. The column, the functions
-- and the grants therefore live in the next, later-timestamped migration.

alter type public.notification_category add value if not exists 'content_change';
