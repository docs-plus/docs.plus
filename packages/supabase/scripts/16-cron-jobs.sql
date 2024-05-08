-- This cron job is scheduled to run every 5 minutes. Its purpose is to update the status of users in the `public.users` table. 
-- It sets the status to 'OFFLINE' for users who have not been active (as indicated by their `last_seen_at` timestamp) for more than 5 minutes.
-- This ensures that the user status remains up-to-date, reflecting whether they are currently active or inactive in the application.
-- NOTE: Active the pg_cron Extension in Supabase.
SELECT cron.schedule(
    'update-user-status',
    '*/5 * * * *',
    $$ 
    UPDATE public.users
    SET status = 'OFFLINE'
    WHERE online_at < NOW() - INTERVAL '5 minutes' AND status = 'ONLINE';
    $$ 
);


-- Cron Job: delete-read-notifications
-- Schedule: Runs daily at midnight (0 0 * * *)
-- Purpose: This job deletes all notifications from the 'public.notifications' table where the 'readed_at' field is not null.
-- This cleanup helps maintain the efficiency of the notifications table by removing entries that are no longer needed.
-- SELECT cron.schedule(
--     'delete-read-notifications',
--     '0 0 * * *',
--     $$
--     DELETE FROM public.notifications
--     WHERE readed_at IS NOT NULL;
--     $$
-- );
