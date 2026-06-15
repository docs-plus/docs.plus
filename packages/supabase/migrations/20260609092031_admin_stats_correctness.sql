-- ============================================================================
-- Admin stats correctness
-- Mirrors scripts/22-user-retention.sql, scripts/11-indexes.sql, and
-- scripts/09-document-views.sql.
--
-- Affected objects:
--   - get_retention_metrics, get_user_lifecycle_segments, get_notification_reach:
--       exclude soft-deleted users (deleted_at is null); count only active
--       push subscriptions (is_active = true).
--   - get_top_active_documents: OUT workspace_id uuid -> text (workspaces.id is
--       varchar(36)). Return-type change requires DROP before CREATE; the drop
--       resets EXECUTE to PUBLIC, so re-apply the service_role-only grant.
--   - messages: plain idx_messages_created_at for created-at-only analytics RPCs.
--   - get_document_views_summary / get_top_viewed_documents /
--       get_document_views_trend / get_document_view_stats: lock EXECUTE to
--       service_role only (privilege-escalation fix). views_today is derived at
--       read time from document_views_daily.
--
-- Idempotent on prod: CREATE OR REPLACE, DROP ... IF EXISTS, CREATE INDEX IF NOT
-- EXISTS, REVOKE/GRANT are all re-runnable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 22-user-retention.sql
-- ----------------------------------------------------------------------------

create or replace function public.get_retention_metrics()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
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
    from public.users
    where deleted_at is null;

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

create or replace function public.get_user_lifecycle_segments()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
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
    from public.users
    where deleted_at is null;

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

-- Return-type change (workspace_id uuid -> text): CREATE OR REPLACE cannot alter
-- a function's return shape, so DROP first. The drop resets EXECUTE to PUBLIC;
-- the revoke/grant below restores service_role-only access.
drop function if exists public.get_top_active_documents(integer, integer);

create or replace function public.get_top_active_documents(p_limit integer default 5, p_days integer default 7)
returns table (
    workspace_id text,
    document_slug text,
    message_count bigint,
    unique_users bigint
)
language plpgsql
security definer
stable
set search_path = public
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

revoke execute on function public.get_top_active_documents(integer, integer) from public, anon, authenticated;
grant  execute on function public.get_top_active_documents(integer, integer) to service_role;

create or replace function public.get_notification_reach()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_total_users integer;
    v_push_enabled integer;
    v_email_enabled integer;
    v_notification_read_rate numeric;
begin
    select count(*) into v_total_users from public.users where deleted_at is null;

    -- Users with active push subscriptions
    select count(distinct user_id) into v_push_enabled
    from public.push_subscriptions
    where user_id is not null
      and is_active = true;

    -- Users with email notifications enabled (check profile_data.notification_preferences)
    select count(*) into v_email_enabled
    from public.users
    where deleted_at is null
      and (
        (profile_data->'notification_preferences'->>'email_enabled')::boolean = true
        or profile_data->'notification_preferences'->>'email_enabled' is null -- Default is enabled
      );

    -- Notification read rate
    select
        case when count(*) > 0
            then round((count(*) filter (where readed_at is not null)::numeric / count(*)) * 100, 1)
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

-- ----------------------------------------------------------------------------
-- 11-indexes.sql
-- ----------------------------------------------------------------------------

-- Plain created_at index for message analytics RPCs that filter on created_at only.
create index if not exists idx_messages_created_at on public.messages (created_at);

-- ----------------------------------------------------------------------------
-- 09-document-views.sql
-- ----------------------------------------------------------------------------

create or replace function public.get_document_views_summary()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
    select jsonb_build_object(
        'total_views', coalesce(sum(total_views), 0),
        'unique_visitors', coalesce(sum(unique_users), 0),
        -- Derived at read time: the stored per-doc views_today snapshot goes stale
        -- across the UTC day boundary for documents not touched today.
        'views_today', coalesce(
            (select sum(views) from public.document_views_daily where view_date = current_date),
            0
        ),
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

-- These SECURITY DEFINER functions read global cross-document analytics and the
-- underlying tables revoke direct SELECT from authenticated. They are called only
-- by the service_role Hocuspocus backend, so lock EXECUTE to service_role.
revoke execute on function public.get_document_views_summary() from public, anon, authenticated;
grant  execute on function public.get_document_views_summary() to service_role;

revoke execute on function public.get_top_viewed_documents(integer, integer) from public, anon, authenticated;
grant  execute on function public.get_top_viewed_documents(integer, integer) to service_role;

revoke execute on function public.get_document_views_trend(text, integer) from public, anon, authenticated;
grant  execute on function public.get_document_views_trend(text, integer) to service_role;

revoke execute on function public.get_document_view_stats(text) from public, anon, authenticated;
grant  execute on function public.get_document_view_stats(text) to service_role;
