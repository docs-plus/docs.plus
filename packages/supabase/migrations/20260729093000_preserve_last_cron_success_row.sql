-- Keep every job's newest successful run past the 7-day pruning window.
--
-- get_cron_job_health reads last_success_at from cron.job_run_details, and the
-- daily pruner deleted every row older than 7 days. Any job whose period exceeds
-- that window therefore reported NULL for most of its cycle: the monthly
-- create_document_views_partitions read as "never succeeded" for ~23 days of every
-- 30, the worker sampler published 0, and cron-stale-monthly fired against a
-- healthy job. The weekly job survived only by a 75-minute margin.
--
-- Non-success rows still expire on the old schedule, so a job that keeps failing
-- cannot grow the table without bound. Guarded so the migration is safe where
-- pg_cron is unavailable; scripts/16-cron-jobs.sql is the canonical schedule for
-- db reset.
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.unschedule('cleanup-cron-job-run-details')
        from cron.job where jobname = 'cleanup-cron-job-run-details';

        perform cron.schedule(
            'cleanup-cron-job-run-details',
            '15 4 * * *',
            $job$
            delete from cron.job_run_details d
            where d.end_time < now() - interval '7 days'
              and (
                d.status is distinct from 'succeeded'
                or exists (
                  select 1 from cron.job_run_details n
                  where n.jobid = d.jobid
                    and n.status = 'succeeded'
                    and n.end_time > d.end_time
                )
              );
            $job$
        );
    end if;
end $$;
