-- Scheduled tasks for database maintenance and system operations

-- Automatically update user status to offline when inactive
-- This cron job runs every 5 minutes and updates user status to 'OFFLINE'
-- for users who haven't been active (based on online_at timestamp) for more than 5 minutes.
-- This keeps user status indicators accurate across the application.
select cron.schedule(
    'update-user-status',
    '*/5 * * * *',
    $$
    update public.users
    set status = 'OFFLINE'
    where online_at < now() - interval '5 minutes' and status = 'ONLINE';
    $$
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
