-- Cron efficiency batch (pairs with scripts/16-cron-jobs.sql and
-- scripts/09-document-views.sql):
--   1. unschedule the pre-internal-schema push-cleanup job that duplicated
--      cleanup-push-subscriptions every 5 minutes;
--   2. rewrite get_cron_job_health() as a single pass — the correlated
--      subqueries seq-scanned the DB's largest table twice per job on every
--      worker scrape (26 scans/call, every 15 s);
--   3. explicit 5-field schedule for process_document_views_queue (the 6-field
--      form was intended as 10-second syntax but pg_cron runs it every 10
--      minutes — keep the observed cadence, drop the ambiguity).

select cron.unschedule('cleanup_push_subscriptions')
from cron.job where jobname = 'cleanup_push_subscriptions';

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

revoke execute on function public.get_cron_job_health() from public, anon, authenticated;
grant  execute on function public.get_cron_job_health() to service_role;

do $$
begin
    perform cron.unschedule('process_document_views_queue')
    where exists (select 1 from cron.job where jobname = 'process_document_views_queue');

    perform cron.schedule(
        'process_document_views_queue',
        '*/10 * * * *',
        'select public.process_document_views_queue();'
    );
exception when others then
    raise notice 'pg_cron not available for process_document_views_queue';
end;
$$;
