-- Schedules internal.cleanup_push_subscriptions() so failed/expired push
-- subs do not accumulate; mirrors packages/supabase/scripts/16-cron-jobs.sql.

select cron.unschedule('cleanup-push-subscriptions')
from cron.job where jobname = 'cleanup-push-subscriptions';

select cron.schedule(
    'cleanup-push-subscriptions',
    '*/5 * * * *',
    $$ select internal.cleanup_push_subscriptions(); $$
);
