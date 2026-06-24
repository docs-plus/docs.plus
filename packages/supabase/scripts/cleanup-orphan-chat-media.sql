-- Ops: run on a schedule (e.g. daily pg_cron or CI cron) with service_role.
-- Deletes storage objects under media/ with no referencing messages.medias path,
-- older than the interval (default 24h).
select internal.cleanup_orphan_chat_media(interval '24 hours');
