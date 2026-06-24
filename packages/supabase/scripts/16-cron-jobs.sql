-- Scheduled tasks for database maintenance and system operations

-- Automatically update user status to offline when inactive
-- This cron job runs every 2 minutes and updates user status to 'OFFLINE'
-- for users who haven't been active (based on online_at timestamp) for more than 2 minutes.
-- The 2-minute interval is consistent with the is_user_online() helper function
-- used by push notifications, ensuring cohesive online/offline behavior.
select cron.schedule(
    'update-user-status',
    '*/2 * * * *',
    $$
    update public.users
    set status = 'OFFLINE'
    where online_at < now() - interval '2 minutes' and status = 'ONLINE';
    $$
);

-- Drains failed/expired push subscriptions so they do not accumulate
-- forever; function body is defined in 07-4 (push pipeline).
select cron.unschedule('cleanup-push-subscriptions')
from cron.job where jobname = 'cleanup-push-subscriptions';

select cron.schedule(
    'cleanup-push-subscriptions',
    '*/5 * * * *',
    $$ select internal.cleanup_push_subscriptions(); $$
);

-- Reclaims orphaned chat media: bucket objects with no live messages.medias
-- reference, older than 24h. Function body lives in 10-3-func-message.sql.
select cron.unschedule('cleanup-orphan-chat-media')
from cron.job where jobname = 'cleanup-orphan-chat-media';

select cron.schedule(
    'cleanup-orphan-chat-media',
    '30 3 * * *',
    $$ select internal.cleanup_orphan_chat_media(interval '24 hours'); $$
);

-- Commented out: Delete read notifications
-- This job would delete all notifications that have been read by users.
-- Uncomment if you want to periodically clean up read notifications from the database.
-- select cron.schedule(
--     'delete-read-notifications',
--     '0 0 * * *',  -- Run daily at midnight
--     $$
--     delete from public.notifications
--     where readed_at is not null;
--     $$
-- );
