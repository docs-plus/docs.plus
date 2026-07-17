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

-- cron.job_run_details grows unbounded (one row per run; the 2-minute jobs
-- alone add ~720 rows/day). Keep a rolling week for health checks.
select cron.unschedule('cleanup-cron-job-run-details')
from cron.job where jobname = 'cleanup-cron-job-run-details';

select cron.schedule(
    'cleanup-cron-job-run-details',
    '15 4 * * *',
    $$
    delete from cron.job_run_details
    where end_time < now() - interval '7 days';
    $$
);

-- Per-job health for the observability exporter: latest run status plus the
-- end time of the most recent successful run. Single pass over
-- cron.job_run_details — the per-job correlated subqueries it replaces
-- seq-scanned the table twice per job on every worker scrape.
create or replace function public.get_cron_job_health()
returns table (
    jobname text,
    last_run_status text,
    last_success_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
    select
        j.jobname::text,
        (array_agg(d.status order by d.start_time desc))[1] as last_run_status,
        max(d.end_time) filter (where d.status = 'succeeded') as last_success_at
    from cron.job j
    left join cron.job_run_details d using (jobid)
    group by j.jobid, j.jobname;
$$;

comment on function public.get_cron_job_health() is
'Returns each pg_cron job with its latest run status and last successful run time.';

-- Scheduler internals are not user data. Admin gating happens at the
-- Hocuspocus controller (service_role key); revoke the default public grant
-- so the explicit service_role grant is exclusive.
revoke execute on function public.get_cron_job_health() from public, anon, authenticated;
grant  execute on function public.get_cron_job_health() to service_role;

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
