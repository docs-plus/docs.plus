-- =============================================================================
-- Document View Analytics System (v2 - pgmq + Anonymous Auth)
-- =============================================================================
-- High-performance, queue-based document view tracking with anonymous user support.
--
-- ARCHITECTURE:
--   1. Hocuspocus calls `enqueue_document_view()` → fast pgmq.send()
--   2. pg_cron worker processes queue batch every 10 seconds
--   3. Worker deduplicates and inserts views
--   4. Hocuspocus calls `update_view_duration()` on disconnect
--   5. Aggregation runs every 5 minutes
--
-- USER TRACKING:
--   - Authenticated: Real user_id from Supabase Auth
--   - Anonymous: Temporary user_id from Supabase Anonymous Auth (linkable)
--   - Guest: Session-based only (no user_id)
--
-- WHY pgmq?
--   - Handles 100+ concurrent views on same document without contention
--   - Decouples write path from processing
--   - Batched deduplication is more efficient
--   - Consistent pattern with message_counter
--
-- DEPLOYMENT CHECKLIST:
--   1. Enable Anonymous Auth in Supabase dashboard
--   2. Run this migration
--   3. Restart Hocuspocus server
--   4. Verify pg_cron jobs are scheduled
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Raw Document Views Table (Partitioned by Month)
-- -----------------------------------------------------------------------------
-- Stores every view event. Partitioned for efficient data management.
-- Old partitions can be dropped without affecting performance.

create table if not exists public.document_views (
    id              uuid not null,  -- Generated upfront for duration updates
    document_slug   text not null,
    user_id         uuid references public.users(id) on delete set null,
    session_id      text not null,
    viewed_at       timestamp with time zone default now() not null,
    view_date       date not null default current_date,  -- For immutable dedup index
    duration_ms     integer default 0,
    is_bounce       boolean default true,  -- True until duration > 3s
    is_anonymous    boolean not null default false,  -- Supabase Anonymous Auth user
    is_authenticated boolean not null default false, -- Logged in with real account
    device_type     text check (device_type in ('desktop', 'mobile', 'tablet')),
    
    primary key (id, viewed_at)
) partition by range (viewed_at);

comment on table public.document_views is
'Raw document view events. Partitioned by month.
User types:
  - is_authenticated=true: Real logged-in user
  - is_anonymous=true: Supabase Anonymous Auth (can be linked later)
  - Both false: Guest with session_id only';

comment on table public.document_views is 
'Raw document view events. Partitioned by month for efficient data lifecycle management.';

-- Create partitions for current and next 3 months
do $$
declare
    start_date date;
    end_date date;
    partition_name text;
begin
    for i in 0..3 loop
        start_date := date_trunc('month', current_date + (i || ' months')::interval);
        end_date := start_date + interval '1 month';
        partition_name := 'document_views_' || to_char(start_date, 'YYYY_MM');
        
        -- Check if partition exists
        if not exists (
            select 1 from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where c.relname = partition_name and n.nspname = 'public'
        ) then
            execute format(
                'create table public.%I partition of public.document_views
                 for values from (%L) to (%L)',
                partition_name, start_date, end_date
            );
            
            -- Create indexes on partition
            execute format(
                'create index %I on public.%I (document_slug, viewed_at)',
                partition_name || '_slug_idx', partition_name
            );
            -- Unique index for ON CONFLICT dedup (session + document + date)
            execute format(
                'create unique index %I on public.%I (session_id, document_slug, view_date)',
                partition_name || '_dedup_idx', partition_name
            );
        end if;
    end loop;
end;
$$;

-- Function to auto-create future partitions (run monthly via pg_cron)
create or replace function public.create_document_views_partitions()
returns void
language plpgsql
security definer
as $$
declare
    start_date date;
    end_date date;
    partition_name text;
begin
    -- Create partitions for next 3 months
    for i in 1..3 loop
        start_date := date_trunc('month', current_date + (i || ' months')::interval);
        end_date := start_date + interval '1 month';
        partition_name := 'document_views_' || to_char(start_date, 'YYYY_MM');
        
        if not exists (
            select 1 from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where c.relname = partition_name and n.nspname = 'public'
        ) then
            execute format(
                'create table public.%I partition of public.document_views
                 for values from (%L) to (%L)',
                partition_name, start_date, end_date
            );
            execute format(
                'create index %I on public.%I (document_slug, viewed_at)',
                partition_name || '_slug_idx', partition_name
            );
            -- Unique index for ON CONFLICT dedup
            execute format(
                'create unique index %I on public.%I (session_id, document_slug, view_date)',
                partition_name || '_dedup_idx', partition_name
            );
        end if;
    end loop;
end;
$$;

comment on function public.create_document_views_partitions() is
'Creates future partitions for document_views table. Run monthly via pg_cron.';


-- -----------------------------------------------------------------------------
-- 2. Pre-computed Document View Statistics
-- -----------------------------------------------------------------------------
-- Aggregated stats per document. Updated every 5 minutes by pg_cron.
-- This is what the admin dashboard queries for fast reads.

create table if not exists public.document_view_stats (
    document_slug       text primary key,
    
    -- Lifetime stats
    total_views         bigint not null default 0,
    unique_sessions     bigint not null default 0,
    unique_users        bigint not null default 0,
    
    -- User type breakdown
    authenticated_views bigint not null default 0,  -- Logged in users
    anonymous_views     bigint not null default 0,  -- Supabase Anonymous Auth
    guest_views         bigint not null default 0,  -- No auth at all
    
    -- Device breakdown
    views_desktop       bigint not null default 0,
    views_mobile        bigint not null default 0,
    views_tablet        bigint not null default 0,
    
    -- Engagement
    total_duration_ms   bigint not null default 0,
    avg_duration_ms     integer not null default 0,
    bounce_count        bigint not null default 0,
    bounce_rate         numeric(5,2) not null default 0,
    
    -- Time-windowed stats
    views_today         integer not null default 0,
    views_7d            integer not null default 0,
    views_30d           integer not null default 0,
    unique_users_7d     integer not null default 0,
    unique_users_30d    integer not null default 0,
    
    -- Metadata
    first_viewed_at     timestamp with time zone,
    last_viewed_at      timestamp with time zone,
    stats_updated_at    timestamp with time zone default now()
);

comment on table public.document_view_stats is
'Pre-computed view stats per document.
User types:
  - authenticated_views: Real logged-in users
  - anonymous_views: Supabase Anonymous Auth users
  - guest_views: No auth (session-based only)';

create index if not exists idx_document_view_stats_views 
    on public.document_view_stats (views_7d desc);
create index if not exists idx_document_view_stats_updated 
    on public.document_view_stats (stats_updated_at);

comment on table public.document_view_stats is
'Pre-computed document view statistics. Updated every 5 minutes by pg_cron for fast dashboard queries.';


-- -----------------------------------------------------------------------------
-- 3. Daily View Summary (for trend charts)
-- -----------------------------------------------------------------------------
-- One row per document per day. Used for trend visualization.

create table if not exists public.document_views_daily (
    document_slug   text not null,
    view_date       date not null,
    views           integer not null default 0,
    unique_sessions integer not null default 0,
    unique_users    integer not null default 0,
    avg_duration_ms integer not null default 0,
    bounce_count    integer not null default 0,
    
    primary key (document_slug, view_date)
);

create index if not exists idx_document_views_daily_date 
    on public.document_views_daily (view_date desc);

comment on table public.document_views_daily is
'Daily aggregated view counts per document. Used for trend charts in admin dashboard.';


-- -----------------------------------------------------------------------------
-- 4. Record Document View (Main RPC Function)
-- -----------------------------------------------------------------------------
-- This is the ONLY function the frontend needs to call.
-- Handles all deduplication, validation, and recording.
-- Returns immediately after INSERT (non-blocking).

-- -----------------------------------------------------------------------------
-- 4. Create pgmq Queue for Document Views
-- -----------------------------------------------------------------------------

select from pgmq.create('document_views');

-- Enable RLS on the queue table (for consistency with other queues)
alter table pgmq.q_document_views enable row level security;

-- Policy for service_role (Hocuspocus writes)
create policy "service_role_all" on pgmq.q_document_views
  for all
  to service_role
  using (true)
  with check (true);

-- Note: pg_cron runs as postgres superuser, bypasses RLS automatically


-- -----------------------------------------------------------------------------
-- 5. Enqueue Document View (Fast - Called by Hocuspocus)
-- -----------------------------------------------------------------------------
-- Generates view_id upfront, enqueues to pgmq, returns immediately.
-- ~1ms latency, no contention even with 100+ concurrent views.

create or replace function public.enqueue_document_view(
    p_document_slug text,
    p_session_id text,
    p_user_id uuid default null,
    p_is_anonymous boolean default false,
    p_device_type text default 'desktop'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_view_id uuid := gen_random_uuid();
    v_device text;
begin
    -- Input validation
    if p_document_slug is null or length(trim(p_document_slug)) = 0 then
        return jsonb_build_object('success', false, 'error', 'document_slug required');
    end if;
    
    if p_session_id is null or length(trim(p_session_id)) < 10 then
        return jsonb_build_object('success', false, 'error', 'valid session_id required');
    end if;
    
    -- Validate device type
    v_device := lower(coalesce(p_device_type, 'desktop'));
    if v_device not in ('desktop', 'mobile', 'tablet') then
        v_device := 'desktop';
    end if;
    
    -- Enqueue view event (fast, ~1ms)
    perform pgmq.send('document_views', jsonb_build_object(
        'view_id', v_view_id,
        'document_slug', lower(trim(p_document_slug)),
        'session_id', trim(p_session_id),
        'user_id', p_user_id,
        'is_anonymous', coalesce(p_is_anonymous, false),
        'is_authenticated', p_user_id is not null and not coalesce(p_is_anonymous, false),
        'device_type', v_device,
        'viewed_at', now()
    ));
    
    -- Return view_id so Hocuspocus can update duration later
    return jsonb_build_object(
        'success', true,
        'view_id', v_view_id
    );

exception when others then
    raise warning 'enqueue_document_view error: %', sqlerrm;
    return jsonb_build_object('success', false, 'error', 'internal_error');
end;
$$;

comment on function public.enqueue_document_view(text, text, uuid, boolean, text) is
'Enqueues a document view for batch processing.
Fast (~1ms), no contention.
p_is_anonymous: true if user is using Supabase Anonymous Auth.
Returns view_id for duration updates.';

grant execute on function public.enqueue_document_view(text, text, uuid, boolean, text) 
    to authenticated, anon, service_role;


-- -----------------------------------------------------------------------------
-- 6. Document Views Queue Worker (pg_cron - every 10 seconds)
-- -----------------------------------------------------------------------------
-- Processes queued views in batches, handles deduplication.

create or replace function public.process_document_views_queue()
returns jsonb
language plpgsql
security definer
as $$
declare
    rec pgmq.message_record;
    v_processed integer := 0;
    v_duplicates integer := 0;
    v_errors integer := 0;
    max_loops integer := 10;
    loop_count integer := 0;
    batch_size integer := 100;
    row_count integer;
begin
    loop
        loop_count := loop_count + 1;
        row_count := 0;
        
        if loop_count > max_loops then
            exit;
        end if;
        
        -- Read batch from queue
        for rec in
            select * from pgmq.read(
                queue_name => 'document_views',
                vt => 30,
                qty => batch_size
            )
        loop
            row_count := row_count + 1;
            
            declare
                v_view_id uuid := (rec.message->>'view_id')::uuid;
                v_document_slug text := rec.message->>'document_slug';
                v_session_id text := rec.message->>'session_id';
                v_user_id uuid := (rec.message->>'user_id')::uuid;
                v_is_anonymous boolean := (rec.message->>'is_anonymous')::boolean;
                v_is_authenticated boolean := (rec.message->>'is_authenticated')::boolean;
                v_device_type text := rec.message->>'device_type';
                v_viewed_at timestamptz := (rec.message->>'viewed_at')::timestamptz;
                v_view_date date := (v_viewed_at at time zone 'UTC')::date;  -- Use UTC for consistency
            begin
                -- Check for duplicate (same session + document + day)
                if exists (
                    select 1 from public.document_views
                    where session_id = v_session_id
                      and document_slug = v_document_slug
                      and view_date = v_view_date
                    limit 1
                ) then
                    v_duplicates := v_duplicates + 1;
                else
                    -- Insert the view
                    insert into public.document_views (
                        id, document_slug, user_id, session_id, viewed_at, view_date,
                        is_anonymous, is_authenticated, device_type
                    ) values (
                        v_view_id, v_document_slug, v_user_id, v_session_id, v_viewed_at, v_view_date,
                        v_is_anonymous, v_is_authenticated, v_device_type
                    );
                    v_processed := v_processed + 1;
                end if;
                
                -- Delete from queue
                perform pgmq.delete('document_views', rec.msg_id);
                
            exception when others then
                v_errors := v_errors + 1;
                raise warning 'Error processing view %: %', rec.msg_id, sqlerrm;
                -- Still delete to prevent infinite retry
                perform pgmq.delete('document_views', rec.msg_id);
            end;
        end loop;
        
        -- Exit if queue is empty
        if row_count = 0 then
            exit;
        end if;
    end loop;
    
    return jsonb_build_object(
        'success', true,
        'processed', v_processed,
        'duplicates', v_duplicates,
        'errors', v_errors
    );
end;
$$;

comment on function public.process_document_views_queue() is
'Batch processes document views from pgmq queue.
Handles deduplication and inserts valid views.
Run every 10 seconds via pg_cron.';


-- -----------------------------------------------------------------------------
-- 7. Update View Duration (By view_id)
-- -----------------------------------------------------------------------------
-- Called by Hocuspocus on disconnect with the view_id from enqueue response.

create or replace function public.update_view_duration(
    p_view_id uuid,
    p_duration_ms integer
)
returns boolean
language plpgsql
security definer
as $$
begin
    if p_view_id is null or p_duration_ms is null then
        return false;
    end if;
    
    -- Cap duration at 30 minutes
    p_duration_ms := least(greatest(p_duration_ms, 0), 1800000);
    
    -- Update by view_id (works across partitions)
    update public.document_views
    set 
        duration_ms = p_duration_ms,
        is_bounce = p_duration_ms < 3000
    where id = p_view_id
      and viewed_at > now() - interval '24 hours';
    
    return found;
end;
$$;

comment on function public.update_view_duration(uuid, integer) is
'Updates duration for a view by view_id. Called by Hocuspocus on disconnect.';

grant execute on function public.update_view_duration(uuid, integer) 
    to authenticated, anon, service_role;


-- -----------------------------------------------------------------------------
-- 6. Aggregate Stats Worker (pg_cron job)
-- -----------------------------------------------------------------------------
-- Batch processes raw views into pre-computed stats.
-- Runs every 5 minutes for near-real-time dashboard updates.

create or replace function public.aggregate_document_view_stats()
returns jsonb
language plpgsql
security definer
as $$
declare
    v_docs_updated integer := 0;
    v_daily_updated integer := 0;
    v_start_time timestamp := clock_timestamp();
    v_last_run timestamptz;
    v_cutoff_30d timestamptz := now() - interval '30 days';
begin
    -- Get last successful run time (for incremental processing)
    select max(stats_updated_at) into v_last_run from public.document_view_stats;
    -- Default to 30 days ago if no previous run
    v_last_run := coalesce(v_last_run - interval '1 minute', v_cutoff_30d);
    
    -- Only process documents with views since last run (incremental)
    -- Use 30-day window for time-based stats (covers all needed data)
    with docs_to_update as (
        select distinct document_slug
        from public.document_views
        where viewed_at >= v_last_run
    ),
    raw_stats as (
        select
            dv.document_slug,
            count(*) as total_views,
            count(distinct session_id) as unique_sessions,
            count(distinct user_id) filter (where user_id is not null) as unique_users,
            -- User type breakdown
            count(*) filter (where is_authenticated and not is_anonymous) as authenticated_views,
            count(*) filter (where is_anonymous) as anonymous_views,
            count(*) filter (where not is_authenticated and not is_anonymous) as guest_views,
            -- Device breakdown
            count(*) filter (where device_type = 'desktop') as views_desktop,
            count(*) filter (where device_type = 'mobile') as views_mobile,
            count(*) filter (where device_type = 'tablet') as views_tablet,
            -- Engagement
            coalesce(sum(duration_ms), 0) as total_duration_ms,
            coalesce(avg(duration_ms) filter (where duration_ms > 0), 0)::integer as avg_duration_ms,
            count(*) filter (where is_bounce) as bounce_count,
            -- Time windows
            count(*) filter (where viewed_at >= current_date) as views_today,
            count(*) filter (where viewed_at >= current_date - interval '7 days') as views_7d,
            count(*) filter (where viewed_at >= v_cutoff_30d) as views_30d,
            count(distinct user_id) filter (
                where user_id is not null and viewed_at >= current_date - interval '7 days'
            ) as unique_users_7d,
            count(distinct user_id) filter (
                where user_id is not null and viewed_at >= v_cutoff_30d
            ) as unique_users_30d,
            min(viewed_at) as first_viewed_at,
            max(viewed_at) as last_viewed_at
        from public.document_views dv
        where dv.document_slug in (select document_slug from docs_to_update)
        group by dv.document_slug
    )
    insert into public.document_view_stats (
        document_slug, total_views, unique_sessions, unique_users,
        authenticated_views, anonymous_views, guest_views,
        views_desktop, views_mobile, views_tablet,
        total_duration_ms, avg_duration_ms, bounce_count, bounce_rate,
        views_today, views_7d, views_30d, unique_users_7d, unique_users_30d,
        first_viewed_at, last_viewed_at, stats_updated_at
    )
    select
        document_slug, total_views, unique_sessions, unique_users,
        authenticated_views, anonymous_views, guest_views,
        views_desktop, views_mobile, views_tablet,
        total_duration_ms, avg_duration_ms, bounce_count,
        case when total_views > 0 
            then round((bounce_count::numeric / total_views) * 100, 2) 
            else 0 
        end,
        views_today, views_7d, views_30d, unique_users_7d, unique_users_30d,
        first_viewed_at, last_viewed_at, now()
    from raw_stats
    on conflict (document_slug) do update set
        total_views = excluded.total_views,
        unique_sessions = excluded.unique_sessions,
        unique_users = excluded.unique_users,
        authenticated_views = excluded.authenticated_views,
        anonymous_views = excluded.anonymous_views,
        guest_views = excluded.guest_views,
        views_desktop = excluded.views_desktop,
        views_mobile = excluded.views_mobile,
        views_tablet = excluded.views_tablet,
        total_duration_ms = excluded.total_duration_ms,
        avg_duration_ms = excluded.avg_duration_ms,
        bounce_count = excluded.bounce_count,
        bounce_rate = excluded.bounce_rate,
        views_today = excluded.views_today,
        views_7d = excluded.views_7d,
        views_30d = excluded.views_30d,
        unique_users_7d = excluded.unique_users_7d,
        unique_users_30d = excluded.unique_users_30d,
        first_viewed_at = coalesce(document_view_stats.first_viewed_at, excluded.first_viewed_at),
        last_viewed_at = excluded.last_viewed_at,
        stats_updated_at = now();
    
    get diagnostics v_docs_updated = row_count;
    
    -- Update daily stats only for today and yesterday (incremental)
    with daily_raw as (
        select
            document_slug,
            view_date,
            count(*) as views,
            count(distinct session_id) as unique_sessions,
            count(distinct user_id) filter (where user_id is not null) as unique_users,
            coalesce(avg(duration_ms) filter (where duration_ms > 0), 0)::integer as avg_duration_ms,
            count(*) filter (where is_bounce) as bounce_count
        from public.document_views
        where view_date >= current_date - 1  -- Only today and yesterday
        group by document_slug, view_date
    )
    insert into public.document_views_daily (
        document_slug, view_date, views, unique_sessions,
        unique_users, avg_duration_ms, bounce_count
    )
    select * from daily_raw
    on conflict (document_slug, view_date) do update set
        views = excluded.views,
        unique_sessions = excluded.unique_sessions,
        unique_users = excluded.unique_users,
        avg_duration_ms = excluded.avg_duration_ms,
        bounce_count = excluded.bounce_count;
    
    get diagnostics v_daily_updated = row_count;
    
    return jsonb_build_object(
        'success', true,
        'documents_updated', v_docs_updated,
        'daily_records_updated', v_daily_updated,
        'duration_ms', extract(milliseconds from clock_timestamp() - v_start_time)::integer
    );
end;
$$;

comment on function public.aggregate_document_view_stats() is
'Incrementally aggregates views into pre-computed stats. Only processes documents with new views.';


-- -----------------------------------------------------------------------------
-- 7. Cleanup Old Data (pg_cron job)
-- -----------------------------------------------------------------------------
-- Drops old partitions and cleans up daily stats older than 1 year.

create or replace function public.cleanup_old_document_views()
returns jsonb
language plpgsql
security definer
as $$
declare
    v_partition_name text;
    v_partitions_dropped integer := 0;
    v_daily_deleted integer := 0;
begin
    -- Drop partitions older than 6 months
    for v_partition_name in
        select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname like 'document_views_%'
          and c.relkind = 'r'
          and c.relname < 'document_views_' || to_char(current_date - interval '6 months', 'YYYY_MM')
    loop
        execute format('drop table if exists public.%I', v_partition_name);
        v_partitions_dropped := v_partitions_dropped + 1;
    end loop;
    
    -- Delete daily stats older than 1 year
    delete from public.document_views_daily
    where view_date < current_date - interval '1 year';
    
    get diagnostics v_daily_deleted = row_count;
    
    return jsonb_build_object(
        'success', true,
        'partitions_dropped', v_partitions_dropped,
        'daily_records_deleted', v_daily_deleted
    );
end;
$$;

comment on function public.cleanup_old_document_views() is
'Cleans up old view data. Drops partitions older than 6 months, daily stats older than 1 year.';


-- -----------------------------------------------------------------------------
-- 8. Admin Query Functions (for Dashboard)
-- -----------------------------------------------------------------------------

-- Get overall view statistics
create or replace function public.get_document_views_summary()
returns jsonb
language sql
security definer
stable
as $$
    select jsonb_build_object(
        'total_views', coalesce(sum(total_views), 0),
        'unique_visitors', coalesce(sum(unique_users), 0),
        'views_today', coalesce(sum(views_today), 0),
        'views_7d', coalesce(sum(views_7d), 0),
        'views_30d', coalesce(sum(views_30d), 0),
        'avg_duration_ms', coalesce(
            (sum(total_duration_ms)::numeric / nullif(sum(total_views), 0))::integer, 
            0
        ),
        'bounce_rate', coalesce(
            round((sum(bounce_count)::numeric / nullif(sum(total_views), 0)) * 100, 2),
            0
        ),
        'user_types', jsonb_build_object(
            'authenticated', coalesce(sum(authenticated_views), 0),
            'anonymous', coalesce(sum(anonymous_views), 0),
            'guest', coalesce(sum(guest_views), 0)
        ),
        'devices', jsonb_build_object(
            'desktop', coalesce(sum(views_desktop), 0),
            'mobile', coalesce(sum(views_mobile), 0),
            'tablet', coalesce(sum(views_tablet), 0)
        ),
        'documents_with_views', count(*),
        'last_updated', max(stats_updated_at)
    )
    from public.document_view_stats;
$$;

comment on function public.get_document_views_summary() is
'Returns overall document view statistics for admin dashboard.
Includes user type breakdown (authenticated/anonymous/guest) and device breakdown.';


-- Get top viewed documents
create or replace function public.get_top_viewed_documents(
    p_limit integer default 10,
    p_days integer default 7
)
returns table (
    document_slug text,
    views bigint,
    unique_visitors bigint,
    avg_duration_ms integer,
    bounce_rate numeric
)
language sql
security definer
stable
as $$
    select
        document_slug,
        case when p_days = 7 then views_7d 
             when p_days = 30 then views_30d 
             else total_views 
        end as views,
        case when p_days = 7 then unique_users_7d 
             when p_days = 30 then unique_users_30d 
             else unique_users 
        end as unique_visitors,
        avg_duration_ms,
        bounce_rate
    from public.document_view_stats
    order by 
        case when p_days = 7 then views_7d 
             when p_days = 30 then views_30d 
             else total_views 
        end desc
    limit p_limit;
$$;

comment on function public.get_top_viewed_documents(integer, integer) is
'Returns top viewed documents for admin dashboard. p_days: 7, 30, or null for all time.';


-- Get view trend for a document or all documents
create or replace function public.get_document_views_trend(
    p_document_slug text default null,
    p_days integer default 30
)
returns table (
    view_date date,
    views bigint,
    unique_visitors bigint
)
language sql
security definer
stable
as $$
    select
        view_date,
        sum(views)::bigint as views,
        sum(unique_users)::bigint as unique_visitors
    from public.document_views_daily
    where view_date >= current_date - (p_days || ' days')::interval
      and (p_document_slug is null or document_slug = p_document_slug)
    group by view_date
    order by view_date;
$$;

comment on function public.get_document_views_trend(text, integer) is
'Returns daily view counts for trend charts. Pass document_slug for single doc, null for all.';


-- Get views for specific document
create or replace function public.get_document_view_stats(p_document_slug text)
returns jsonb
language sql
security definer
stable
as $$
    select coalesce(
        (
            select jsonb_build_object(
                'document_slug', document_slug,
                'total_views', total_views,
                'unique_visitors', unique_users,
                'views_7d', views_7d,
                'views_30d', views_30d,
                'avg_duration_ms', avg_duration_ms,
                'bounce_rate', bounce_rate,
                'first_viewed_at', first_viewed_at,
                'last_viewed_at', last_viewed_at
            )
            from public.document_view_stats
            where document_slug = lower(trim(p_document_slug))
        ),
        jsonb_build_object('document_slug', p_document_slug, 'total_views', 0)
    );
$$;

comment on function public.get_document_view_stats(text) is
'Returns view statistics for a specific document.';


-- -----------------------------------------------------------------------------
-- 9. RLS Policies
-- -----------------------------------------------------------------------------

alter table public.document_views enable row level security;
alter table public.document_view_stats enable row level security;
alter table public.document_views_daily enable row level security;

-- document_views: Only service role can read (admin queries use functions)
-- No direct table access needed

-- document_view_stats: Admins can read
create policy "Admins can read document_view_stats"
    on public.document_view_stats for select
    using (public.is_admin(auth.uid()));

-- document_views_daily: Admins can read
create policy "Admins can read document_views_daily"
    on public.document_views_daily for select
    using (public.is_admin(auth.uid()));


-- -----------------------------------------------------------------------------
-- 10. pg_cron Scheduling
-- -----------------------------------------------------------------------------

-- Process document views queue every 10 seconds
do $$
begin
    perform cron.unschedule('process_document_views_queue')
    where exists (select 1 from cron.job where jobname = 'process_document_views_queue');
    
    perform cron.schedule(
        'process_document_views_queue',
        '*/10 * * * * *',
        'select public.process_document_views_queue();'
    );
exception when others then
    raise notice 'pg_cron not available for process_document_views_queue';
end;
$$;

-- Aggregate stats every 5 minutes
do $$
begin
    perform cron.unschedule('aggregate_document_view_stats')
    where exists (select 1 from cron.job where jobname = 'aggregate_document_view_stats');
    
    perform cron.schedule(
        'aggregate_document_view_stats',
        '*/5 * * * *',
        'select public.aggregate_document_view_stats();'
    );
exception when others then
    raise notice 'pg_cron not available for aggregate_document_view_stats';
end;
$$;

-- Create partitions monthly (1st of each month at 00:05)
do $$
begin
    perform cron.unschedule('create_document_views_partitions')
    where exists (select 1 from cron.job where jobname = 'create_document_views_partitions');
    
    perform cron.schedule(
        'create_document_views_partitions',
        '5 0 1 * *',
        'select public.create_document_views_partitions();'
    );
exception when others then
    raise notice 'pg_cron not available for create_document_views_partitions';
end;
$$;

-- Cleanup old data weekly (Sunday at 03:00)
do $$
begin
    perform cron.unschedule('cleanup_old_document_views')
    where exists (select 1 from cron.job where jobname = 'cleanup_old_document_views');
    
    perform cron.schedule(
        'cleanup_old_document_views',
        '0 3 * * 0',
        'select public.cleanup_old_document_views();'
    );
exception when others then
    raise notice 'pg_cron not available for cleanup_old_document_views';
end;
$$;


-- -----------------------------------------------------------------------------
-- 11. Grant Permissions for Admin Functions
-- -----------------------------------------------------------------------------

grant execute on function public.get_document_views_summary() to authenticated;
grant execute on function public.get_top_viewed_documents(integer, integer) to authenticated;
grant execute on function public.get_document_views_trend(text, integer) to authenticated;
grant execute on function public.get_document_view_stats(text) to authenticated;
