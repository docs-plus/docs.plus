-- Re-schedule every job that used to unschedule-then-schedule, with a bare
-- cron.schedule() call, so this migration itself does not rotate the jobid.
--
-- cron.schedule() upserts on (jobname, username) — it preserves the existing
-- jobid. The unschedule-then-schedule pattern these 11 jobs used to run on
-- every scripts/ apply minted a fresh jobid each time. cron.job_run_details
-- has no FK to cron.job, so a rotated jobid orphans the run history that
-- public.get_cron_job_health() joins on: the job reports last_success_at
-- NULL, the worker sampler maps that to 0, and the Grafana cron-stale rule
-- computes an age of ~56 years against a healthy job.
--
-- Re-applying the old unschedule-then-schedule form here would reproduce the
-- exact bug this migration exists to close. scripts/*.sql are the source of
-- truth this migration mirrors verbatim; see 07-5-email-notifications-pgmq.sql,
-- 09-document-views.sql, 09-message_counter.sql, and 16-cron-jobs.sql.
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.schedule(
            'cleanup-push-subscriptions',
            '*/5 * * * *',
            $job$ select internal.cleanup_push_subscriptions(); $job$
        );

        perform cron.schedule(
            'cleanup-orphan-chat-media',
            '30 3 * * *',
            $job$ select internal.cleanup_orphan_chat_media(interval '24 hours'); $job$
        );

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

        perform cron.schedule(
            'process_document_views_queue',
            '*/10 * * * *',
            'select public.process_document_views_queue();'
        );

        perform cron.schedule(
            'aggregate_document_view_stats',
            '*/5 * * * *',
            'select public.aggregate_document_view_stats();'
        );

        perform cron.schedule(
            'create_document_views_partitions',
            '5 0 1 * *',
            'select public.create_document_views_partitions();'
        );

        perform cron.schedule(
            'cleanup_old_document_views',
            '0 3 * * 0',
            'select public.cleanup_old_document_views();'
        );

        perform cron.schedule(
            'process_email_queue',
            '*/2 * * * *',
            'select public.process_email_queue();'
        );

        perform cron.schedule(
            'compile_digest_emails',
            '*/15 * * * *',
            'select public.compile_digest_emails();'
        );

        perform cron.schedule(
            'cleanup_email_queue',
            '0 3 * * *',
            'select public.cleanup_email_queue();'
        );

        perform cron.schedule(
            'message_counter_batch_job',
            '* * * * *',
            $job$
            SELECT public.message_counter_batch_worker();
            $job$
        );
    end if;
end $$;
