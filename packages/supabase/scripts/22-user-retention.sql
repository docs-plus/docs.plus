-- =============================================================================
-- User Retention Analytics (Phase 8)
-- =============================================================================
-- Provides DAU/WAU/MAU metrics, user lifecycle segments, and retention analysis.
--
-- METRICS:
--   - DAU/WAU/MAU: Active users based on online_at timestamp
--   - Stickiness: DAU/MAU ratio (engagement quality)
--   - User Lifecycle: New/Active/Returning/At Risk/Churned segments
--   - Activity Trends: Daily active user counts over time
--
-- USAGE:
--   SELECT * FROM get_retention_metrics();
--   SELECT * FROM get_user_lifecycle_segments();
--   SELECT * FROM get_dau_trend(30);
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Get Retention Metrics (DAU/WAU/MAU/Stickiness)
-- -----------------------------------------------------------------------------
-- Optimized: Single query with FILTER instead of 7 separate COUNT queries
-- -----------------------------------------------------------------------------
create or replace function public.get_retention_metrics()
returns jsonb
language plpgsql
security definer
stable
as $$
declare
    v_dau integer;
    v_wau integer;
    v_mau integer;
    v_dau_prev integer;
    v_wau_prev integer;
    v_mau_prev integer;
    v_total_users integer;
begin
    -- Single optimized query using FILTER
    select 
        count(*) filter (where online_at >= now() - interval '24 hours'),
        count(*) filter (where online_at >= now() - interval '7 days'),
        count(*) filter (where online_at >= now() - interval '30 days'),
        count(*) filter (where online_at >= now() - interval '48 hours' and online_at < now() - interval '24 hours'),
        count(*) filter (where online_at >= now() - interval '14 days' and online_at < now() - interval '7 days'),
        count(*) filter (where online_at >= now() - interval '60 days' and online_at < now() - interval '30 days'),
        count(*)
    into v_dau, v_wau, v_mau, v_dau_prev, v_wau_prev, v_mau_prev, v_total_users
    from public.users;

    return jsonb_build_object(
        'dau', v_dau,
        'wau', v_wau,
        'mau', v_mau,
        'dau_prev', v_dau_prev,
        'wau_prev', v_wau_prev,
        'mau_prev', v_mau_prev,
        'total_users', v_total_users,
        'stickiness', case when v_mau > 0 then round((v_dau::numeric / v_mau) * 100, 1) else 0 end,
        'dau_change_pct', case when v_dau_prev > 0 then round(((v_dau - v_dau_prev)::numeric / v_dau_prev) * 100, 1) else 0 end,
        'wau_change_pct', case when v_wau_prev > 0 then round(((v_wau - v_wau_prev)::numeric / v_wau_prev) * 100, 1) else 0 end,
        'mau_change_pct', case when v_mau_prev > 0 then round(((v_mau - v_mau_prev)::numeric / v_mau_prev) * 100, 1) else 0 end
    );
end;
$$;

comment on function public.get_retention_metrics() is
'Returns DAU/WAU/MAU counts with period-over-period comparison and stickiness ratio.';

-- -----------------------------------------------------------------------------
-- 2. Get User Lifecycle Segments
-- -----------------------------------------------------------------------------
-- Segments:
--   - New: Created in last 7 days
--   - Active: Online in last 7 days (not new)
--   - At Risk: Last online 14-30 days ago
--   - Churned: Last online > 30 days ago
-- Optimized: Single query with FILTER instead of 5 separate COUNT queries
-- -----------------------------------------------------------------------------
create or replace function public.get_user_lifecycle_segments()
returns jsonb
language plpgsql
security definer
stable
as $$
declare
    v_new integer;
    v_active integer;
    v_at_risk integer;
    v_churned integer;
    v_total integer;
begin
    -- Single optimized query using FILTER
    select 
        count(*) filter (where created_at >= now() - interval '7 days'),
        count(*) filter (where online_at >= now() - interval '7 days' and created_at < now() - interval '7 days'),
        count(*) filter (where 
            (online_at < now() - interval '14 days' and online_at >= now() - interval '30 days')
            or (online_at is null and created_at < now() - interval '14 days' and created_at >= now() - interval '30 days')
        ),
        count(*) filter (where 
            (online_at < now() - interval '30 days')
            or (online_at is null and created_at < now() - interval '30 days')
        ),
        count(*)
    into v_new, v_active, v_at_risk, v_churned, v_total
    from public.users;

    return jsonb_build_object(
        'new', v_new,
        'active', v_active,
        'at_risk', v_at_risk,
        'churned', v_churned,
        'total', v_total,
        'new_pct', case when v_total > 0 then round((v_new::numeric / v_total) * 100, 1) else 0 end,
        'active_pct', case when v_total > 0 then round((v_active::numeric / v_total) * 100, 1) else 0 end,
        'at_risk_pct', case when v_total > 0 then round((v_at_risk::numeric / v_total) * 100, 1) else 0 end,
        'churned_pct', case when v_total > 0 then round((v_churned::numeric / v_total) * 100, 1) else 0 end
    );
end;
$$;

comment on function public.get_user_lifecycle_segments() is
'Returns user counts by lifecycle segment: New, Active, At Risk, Churned.';

-- -----------------------------------------------------------------------------
-- 3. Get DAU Trend (Daily Active Users over time)
-- -----------------------------------------------------------------------------
create or replace function public.get_dau_trend(p_days integer default 30)
returns table (
    activity_date date,
    active_users integer
)
language plpgsql
security definer
stable
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
            online_at::date as activity_date,
            count(distinct id) as active_users
        from public.users
        where online_at >= current_date - p_days
        group by online_at::date
    )
    select 
        ds.d as activity_date,
        coalesce(dc.active_users, 0)::integer as active_users
    from date_series ds
    left join daily_counts dc on ds.d = dc.activity_date
    order by ds.d;
end;
$$;

comment on function public.get_dau_trend(integer) is
'Returns daily active user counts for the specified number of days.';

-- -----------------------------------------------------------------------------
-- 4. Get Activity by Hour (for heatmap)
-- -----------------------------------------------------------------------------
create or replace function public.get_activity_by_hour(p_days integer default 7)
returns table (
    hour_of_day integer,
    day_of_week integer,
    message_count bigint
)
language plpgsql
security definer
stable
as $$
begin
    return query
    select 
        extract(hour from m.created_at)::integer as hour_of_day,
        extract(dow from m.created_at)::integer as day_of_week,
        count(*) as message_count
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC'
    group by 
        extract(hour from m.created_at),
        extract(dow from m.created_at)
    order by day_of_week, hour_of_day;
end;
$$;

comment on function public.get_activity_by_hour(integer) is
'Returns message counts by hour and day of week for activity heatmap.';

-- -----------------------------------------------------------------------------
-- 5. Get Top Active Documents (by message count)
-- -----------------------------------------------------------------------------
create or replace function public.get_top_active_documents(p_limit integer default 5, p_days integer default 7)
returns table (
    workspace_id uuid,
    document_slug text,
    message_count bigint,
    unique_users bigint
)
language plpgsql
security definer
stable
as $$
begin
    return query
    select 
        w.id as workspace_id,
        w.slug as document_slug,
        count(m.id) as message_count,
        count(distinct m.user_id) as unique_users
    from public.workspaces w
    join public.channels c on c.workspace_id = w.id
    join public.messages m on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC'
    group by w.id, w.slug
    order by message_count desc
    limit p_limit;
end;
$$;

comment on function public.get_top_active_documents(integer, integer) is
'Returns top documents by message activity in the specified period.';

-- -----------------------------------------------------------------------------
-- 6. Get Message Type Distribution
-- -----------------------------------------------------------------------------
create or replace function public.get_message_type_distribution(p_days integer default 7)
returns table (
    message_type text,
    count bigint,
    percentage numeric
)
language plpgsql
security definer
stable
as $$
declare
    v_total bigint;
begin
    -- Get total count first
    select count(*) into v_total
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC';

    return query
    select 
        coalesce(m.type, 'text') as message_type,
        count(*) as count,
        case when v_total > 0 then round((count(*)::numeric / v_total) * 100, 1) else 0 end as percentage
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC'
    group by coalesce(m.type, 'text')
    order by count desc;
end;
$$;

comment on function public.get_message_type_distribution(integer) is
'Returns message counts by type (text, image, video, etc.) for PUBLIC channels.';

-- -----------------------------------------------------------------------------
-- 7. Get Communication Stats
-- -----------------------------------------------------------------------------
create or replace function public.get_communication_stats(p_days integer default 7)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
    v_total_messages bigint;
    v_thread_messages bigint;
    v_messages_with_reactions bigint;
    v_unique_senders bigint;
begin
    -- Count from PUBLIC channels only
    select 
        count(*),
        count(*) filter (where m.is_thread_root = true),
        count(*) filter (where m.reactions is not null and m.reactions != '[]'::jsonb),
        count(distinct m.user_id)
    into v_total_messages, v_thread_messages, v_messages_with_reactions, v_unique_senders
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC';

    return jsonb_build_object(
        'total_messages', v_total_messages,
        'thread_messages', v_thread_messages,
        'messages_with_reactions', v_messages_with_reactions,
        'unique_senders', v_unique_senders,
        'thread_rate', case when v_total_messages > 0 then round((v_thread_messages::numeric / v_total_messages) * 100, 1) else 0 end,
        'reaction_rate', case when v_total_messages > 0 then round((v_messages_with_reactions::numeric / v_total_messages) * 100, 1) else 0 end
    );
end;
$$;

comment on function public.get_communication_stats(integer) is
'Returns communication statistics for PUBLIC channels: messages, threads, reactions.';

-- -----------------------------------------------------------------------------
-- 8. Get Notification Reach
-- -----------------------------------------------------------------------------
create or replace function public.get_notification_reach()
returns jsonb
language plpgsql
security definer
stable
as $$
declare
    v_total_users integer;
    v_push_enabled integer;
    v_email_enabled integer;
    v_notification_read_rate numeric;
begin
    select count(*) into v_total_users from public.users;

    -- Users with active push subscriptions
    select count(distinct user_id) into v_push_enabled
    from public.push_subscriptions
    where user_id is not null;

    -- Users with email notifications enabled (check profile_data)
    select count(*) into v_email_enabled
    from public.users
    where profile_data->>'email_notifications' = 'true'
       or profile_data->>'email_notifications' is null; -- Default is enabled

    -- Notification read rate
    select 
        case when count(*) > 0 
            then round((count(*) filter (where is_read = true)::numeric / count(*)) * 100, 1)
            else 0 
        end
    into v_notification_read_rate
    from public.notifications
    where created_at >= now() - interval '7 days';

    return jsonb_build_object(
        'total_users', v_total_users,
        'push_enabled', v_push_enabled,
        'email_enabled', v_email_enabled,
        'push_reach_pct', case when v_total_users > 0 then round((v_push_enabled::numeric / v_total_users) * 100, 1) else 0 end,
        'email_reach_pct', case when v_total_users > 0 then round((v_email_enabled::numeric / v_total_users) * 100, 1) else 0 end,
        'notification_read_rate', v_notification_read_rate
    );
end;
$$;

comment on function public.get_notification_reach() is
'Returns notification reach statistics: push/email enabled users and read rate.';

-- -----------------------------------------------------------------------------
-- Grant Permissions
-- -----------------------------------------------------------------------------
grant execute on function public.get_retention_metrics() to service_role;
grant execute on function public.get_user_lifecycle_segments() to service_role;
grant execute on function public.get_dau_trend(integer) to service_role;
grant execute on function public.get_activity_by_hour(integer) to service_role;
grant execute on function public.get_top_active_documents(integer, integer) to service_role;
grant execute on function public.get_message_type_distribution(integer) to service_role;
grant execute on function public.get_communication_stats(integer) to service_role;
grant execute on function public.get_notification_reach() to service_role;
