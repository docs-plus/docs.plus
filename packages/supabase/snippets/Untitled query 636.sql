
-- Schedule digest compilation (every 15 minutes)
do $$
begin
    perform cron.unschedule('compile_digest_emails')
    where exists (select 1 from cron.job where jobname = 'compile_digest_emails');

    perform cron.schedule(
        'compile_digest_emails',
        '*/15 * * * *',  -- Every 15 minutes (catches different timezone 9am slots)
        'select public.compile_digest_emails();'
    );
exception when others then
    raise notice 'pg_cron not available, skipping digest compilation scheduling';
end;
$$;