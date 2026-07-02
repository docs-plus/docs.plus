-- Monitoring RPCs for the observability exporter, plus cron run-history retention.
-- Objects: public.get_pgmq_queue_metrics(), public.get_cron_job_health(),
--          public.get_signups_per_day(integer), cron job 'cleanup-cron-job-run-details'.
-- Safety: idempotent (create or replace / guarded schedule); no destructive changes.
-- Sources of truth: scripts/07-4-push-notifications-pgmq.sql, scripts/16-cron-jobs.sql,
--                   scripts/22-user-retention.sql.

-- -----------------------------------------------------------------------------
-- 1. All-queue pgmq metrics (push + email) for the observability exporter
-- -----------------------------------------------------------------------------
create or replace function public.get_pgmq_queue_metrics()
returns table (
    queue_name text,
    queue_length bigint,
    oldest_msg_age_sec integer,
    total_messages bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    return query
    select
        m.queue_name,
        m.queue_length,
        m.oldest_msg_age_sec,
        m.total_messages
    from pgmq.metrics_all() m;
end;
$$;

comment on function public.get_pgmq_queue_metrics() is
'Returns per-queue pgmq depth, oldest message age, and lifetime message count for monitoring.';

-- Queue depth is infrastructure state, not user data. Admin gating happens at
-- the Hocuspocus controller (service_role key); revoke the default public
-- grant so the explicit service_role grant is exclusive.
revoke execute on function public.get_pgmq_queue_metrics() from public, anon, authenticated;
grant  execute on function public.get_pgmq_queue_metrics() to service_role;

-- -----------------------------------------------------------------------------
-- 2. Per-job pg_cron health: latest run status + last successful run time
-- -----------------------------------------------------------------------------
create or replace function public.get_cron_job_health()
returns table (
    jobname text,
    last_run_status text,
    last_success_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    return query
    select
        j.jobname::text,
        (
            select d.status
            from cron.job_run_details d
            where d.jobid = j.jobid
            order by d.start_time desc
            limit 1
        ) as last_run_status,
        (
            select max(d.end_time)
            from cron.job_run_details d
            where d.jobid = j.jobid and d.status = 'succeeded'
        ) as last_success_at
    from cron.job j;
end;
$$;

comment on function public.get_cron_job_health() is
'Returns each pg_cron job with its latest run status and last successful run time.';

revoke execute on function public.get_cron_job_health() from public, anon, authenticated;
grant  execute on function public.get_cron_job_health() to service_role;

-- -----------------------------------------------------------------------------
-- 3. Signups per day (new accounts over time)
-- -----------------------------------------------------------------------------
create or replace function public.get_signups_per_day(p_days integer default 30)
returns table (
    day date,
    signups bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    return query
    with date_series as (
        select generate_series(
            current_date - (p_days - 1),
            current_date,
            interval '1 day'
        )::date as d
    ),
    daily_counts as (
        select
            created_at::date as signup_date,
            count(*) as signups
        from public.users
        where created_at >= current_date - (p_days - 1)
        group by created_at::date
    )
    select
        ds.d as day,
        coalesce(dc.signups, 0)::bigint as signups
    from date_series ds
    left join daily_counts dc on ds.d = dc.signup_date
    order by ds.d;
end;
$$;

comment on function public.get_signups_per_day(integer) is
'Returns new-account counts per day for the specified number of days.';

revoke execute on function public.get_signups_per_day(integer) from public, anon, authenticated;
grant  execute on function public.get_signups_per_day(integer) to service_role;

-- -----------------------------------------------------------------------------
-- 4. cron.job_run_details retention (rolling week)
-- -----------------------------------------------------------------------------
-- cron.job_run_details grows unbounded (one row per run; the 2-minute jobs
-- alone add ~720 rows/day). Guarded so the migration is safe where pg_cron is
-- unavailable; scripts/16-cron-jobs.sql is the canonical schedule for db reset.
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.unschedule('cleanup-cron-job-run-details')
        from cron.job where jobname = 'cleanup-cron-job-run-details';

        perform cron.schedule(
            'cleanup-cron-job-run-details',
            '15 4 * * *',
            $job$
            delete from cron.job_run_details
            where end_time < now() - interval '7 days';
            $job$
        );
    end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Fix get_message_type_distribution enum→text return mismatch
-- -----------------------------------------------------------------------------
-- messages.type is the message_type enum; coalesce(m.type, 'text') returns that
-- enum, not the declared text column, so the function raised "structure of query
-- does not match function result type" on every call. Cast to text. Pre-existing
-- since the function was added; surfaced once the admin route began calling it.
create or replace function public.get_message_type_distribution(p_days integer default 7)
returns table (
    message_type text,
    count bigint,
    percentage numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_total bigint;
begin
    select count(*) into v_total
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC';

    return query
    select
        coalesce(m.type::text, 'text') as message_type,
        count(*) as count,
        case when v_total > 0 then round((count(*)::numeric / v_total) * 100, 1) else 0 end as percentage
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC'
    group by coalesce(m.type::text, 'text')
    order by count desc;
end;
$$;
