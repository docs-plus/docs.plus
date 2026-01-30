-- -----------------------------------------------------------------------------
-- Push Notifications Schema
-- -----------------------------------------------------------------------------
-- Production-ready push notification system.
-- Sends notifications immediately via pg_net async HTTP to hocuspocus backend.
--
-- ARCHITECTURE:
--   Database Trigger → pg_net → hocuspocus.server → BullMQ → Web Push API
--   (Cohesive with email gateway - both use hocuspocus backend)
--
-- DEPLOYMENT CHECKLIST:
--
-- 1. DATABASE CONFIGURATION:
--    For hosted Supabase (recommended - uses config table):
--      SELECT internal.set_config('app.push_gateway_url', 'https://your-api.com');
--      SELECT internal.set_config('app.settings.service_role_key', 'YOUR-KEY');
--
--    For self-hosted (alternative - uses ALTER DATABASE):
--      ALTER DATABASE postgres SET app.push_gateway_url = 'https://your-api.com';
--      ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR-KEY';
--
-- 2. HOCUSPOCUS BACKEND ENVIRONMENT (hocuspocus.server/.env):
--    - VAPID_PUBLIC_KEY  (generate: npx web-push generate-vapid-keys)
--    - VAPID_PRIVATE_KEY (generate: npx web-push generate-vapid-keys)
--    - VAPID_SUBJECT     (e.g., mailto:support@yourdomain.com)
--    - SUPABASE_URL      (your Supabase project URL)
--    - SUPABASE_SERVICE_ROLE_KEY (for subscription lookups)
--    - REDIS_HOST / REDIS_PORT (for BullMQ)
--
-- 3. CLIENT ENVIRONMENT (webapp/.env):
--    - NEXT_PUBLIC_VAPID_PUBLIC_KEY (same as VAPID_PUBLIC_KEY above)
--
-- To verify configuration: SELECT public.get_push_notification_stats();
-- -----------------------------------------------------------------------------

-- Create internal schema for private helper functions
create schema if not exists internal;


-- =============================================================================
-- 1. Application Configuration Table
-- =============================================================================
-- For hosted Supabase where ALTER DATABASE is not available.
-- Stores key-value configuration that persists across sessions.
-- =============================================================================

create table if not exists internal.app_config (
    key text primary key,
    value text not null,
    description text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

comment on table internal.app_config is
'Application configuration storage for settings that cannot use ALTER DATABASE (e.g., hosted Supabase).
Used by push notifications, email gateway, and other system configuration.';

-- Auto-update timestamp
create or replace function internal.update_app_config_timestamp()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_app_config_updated_at on internal.app_config;
create trigger trigger_app_config_updated_at
    before update on internal.app_config
    for each row execute function internal.update_app_config_timestamp();


-- =============================================================================
-- 2. Configuration Helper Functions
-- =============================================================================

-- Get config value (checks table first, then GUC settings, then default)
create or replace function internal.get_config(p_key text, p_default text default null)
returns text
language plpgsql
security definer
stable
as $$
declare
    v_value text;
begin
    -- First try the config table (works on hosted Supabase)
    select value into v_value
    from internal.app_config
    where key = p_key;

    if v_value is not null then
        return v_value;
    end if;

    -- Fall back to GUC settings (works on self-hosted/local)
    v_value := current_setting(p_key, true);

    if v_value is not null and v_value != '' then
        return v_value;
    end if;

    -- Return default
    return p_default;
end;
$$;

comment on function internal.get_config(text, text) is
'Get configuration value. Checks app_config table first, then PostgreSQL GUC settings.
Use this for all configuration lookups to support both hosted and self-hosted Supabase.';

-- Set config value
create or replace function internal.set_config(p_key text, p_value text, p_description text default null)
returns void
language plpgsql
security definer
as $$
begin
    insert into internal.app_config (key, value, description)
    values (p_key, p_value, p_description)
    on conflict (key) do update set
        value = excluded.value,
        description = coalesce(excluded.description, internal.app_config.description),
        updated_at = now();
end;
$$;

comment on function internal.set_config(text, text, text) is
'Set configuration value in app_config table. Use this on hosted Supabase instead of ALTER DATABASE.';


-- =============================================================================
-- 3. Push Subscriptions Table
-- =============================================================================
-- Stores browser/device push subscription credentials per user

create table if not exists public.push_subscriptions (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    device_id text not null,
    device_name text,
    platform text not null default 'web' check (platform in ('web', 'ios', 'android')),
    push_credentials jsonb not null,
    is_active boolean default true not null,
    failed_count int default 0 not null,
    last_error text,
    last_used_at timestamptz default now(),
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    unique(user_id, device_id)
);

-- Index for efficient lookup of active subscriptions
create index if not exists idx_push_subs_user_active
    on public.push_subscriptions(user_id) where is_active = true;

-- RLS: Users can only manage their own subscriptions
alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can manage own subscriptions" on public.push_subscriptions;
create policy "Users can manage own subscriptions" on public.push_subscriptions
    for all using (auth.uid() = user_id);

-- Auto-update updated_at timestamp
create or replace function update_push_subscriptions_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trigger_push_subscriptions_updated_at
    before update on public.push_subscriptions
    for each row execute function update_push_subscriptions_updated_at();


-- =============================================================================
-- 4. Push Configuration Helper
-- =============================================================================

-- Get push gateway configuration with validation
-- Returns null if not configured (caller should handle gracefully)
create or replace function internal.get_push_config()
returns table (edge_url text, service_key text)
language plpgsql
security definer
as $$
declare
    v_gateway_url text;
    v_service_key text;
begin
    -- Get push gateway URL (hocuspocus backend)
    -- Priority: app_config table > GUC settings > localhost fallback
    v_gateway_url := internal.get_config(
        'app.push_gateway_url',
        internal.get_config('app.hocuspocus_url', null)
    );

    -- Get service role key for authorization
    v_service_key := internal.get_config('app.settings.service_role_key', null);

    -- Validate configuration
    if v_gateway_url is null or v_gateway_url = '' then
        return; -- Return empty if not configured
    end if;

    if v_service_key is null or v_service_key = '' then
        return; -- Return empty if not configured
    end if;

    -- Return the full push endpoint URL
    return query select
        v_gateway_url || '/api/push/send' as edge_url,
        v_service_key as service_key;
end;
$$;

comment on function internal.get_push_config() is
'Returns push gateway URL and service key.
Uses hocuspocus.server backend for cohesive architecture with email gateway.
Checks app_config table first (for hosted Supabase), then GUC settings (for self-hosted).';


-- =============================================================================
-- 5. Send Push Notification Trigger
-- =============================================================================
-- Sends RAW DATA only - the service worker formats the title/body
-- Respects user preferences (notification types, quiet hours)

create or replace function public.send_push_notification()
returns trigger
language plpgsql
security definer
as $$
declare
    sender_info record;
    receiver_prefs jsonb;
    config record;
    computed_action_url text;
    workspace_slug text;
    user_timezone text;
    now_time time;
    quiet_start time;
    quiet_end time;
begin
    -- Only process inserts
    if tg_op != 'INSERT' then
        return new;
    end if;

    -- Skip if user has no active push subscriptions
    if not exists (
        select 1 from public.push_subscriptions
        where user_id = new.receiver_user_id and is_active = true
    ) then
        return new;
    end if;

    -- Skip if user is actively online (within last 2 minutes)
    -- User is viewing the app, no need for push notification
    if internal.is_user_online(new.receiver_user_id) then
        return new;
    end if;

    -- Get receiver's notification preferences
    select profile_data->'notification_preferences' into receiver_prefs
    from public.users
    where id = new.receiver_user_id;

    -- Check if notification type is enabled (default to true if not set)
    if receiver_prefs is not null then
        case new.type::text
            when 'mention' then
                if (receiver_prefs->>'push_mentions')::boolean is false then
                    return new;
                end if;
            when 'reply' then
                if (receiver_prefs->>'push_replies')::boolean is false then
                    return new;
                end if;
            when 'reaction' then
                if (receiver_prefs->>'push_reactions')::boolean is false then
                    return new;
                end if;
            else
                null; -- Allow other types
        end case;

        -- Check quiet hours (timezone-aware)
        if (receiver_prefs->>'quiet_hours_enabled')::boolean is true then
            -- Get user's timezone, default to UTC if not set
            user_timezone := coalesce(receiver_prefs->>'timezone', 'UTC');

            -- Convert current time to user's local timezone
            begin
                now_time := (now() at time zone user_timezone)::time;
            exception when others then
                -- Invalid timezone, fall back to UTC
                now_time := (now() at time zone 'UTC')::time;
            end;

            quiet_start := (receiver_prefs->>'quiet_hours_start')::time;
            quiet_end := (receiver_prefs->>'quiet_hours_end')::time;

            -- Handle overnight quiet hours (e.g., 22:00 to 08:00)
            if quiet_start > quiet_end then
                if now_time >= quiet_start or now_time <= quiet_end then
                    return new;
                end if;
            else
                if now_time >= quiet_start and now_time <= quiet_end then
                    return new;
                end if;
            end if;
        end if;
    end if;

    -- Get configuration (returns empty if not configured)
    select * into config from internal.get_push_config();
    if config.edge_url is null then
        return new;
    end if;

    -- Get sender info (raw data for service worker to format)
    select
        coalesce(display_name, username) as name,
        avatar_url
    into sender_info
    from public.users
    where id = new.sender_user_id;

    -- Get workspace slug from channel
    if new.channel_id is not null then
        select w.slug into workspace_slug
        from public.channels c
        join public.workspaces w on w.id = c.workspace_id
        where c.id = new.channel_id;
    end if;

    -- Build action_url with document path and query params
    -- Format: /{workspace_slug}?chatroom={channel_id}&msg_id={message_id}
    if workspace_slug is not null and new.message_id is not null and new.channel_id is not null then
        computed_action_url := '/' || workspace_slug || '?chatroom=' || new.channel_id || '&msg_id=' || new.message_id;
    elsif workspace_slug is not null and new.channel_id is not null then
        computed_action_url := '/' || workspace_slug || '?chatroom=' || new.channel_id;
    elsif workspace_slug is not null then
        computed_action_url := '/' || workspace_slug;
    else
        computed_action_url := coalesce(new.action_url, '/');
    end if;

    -- Send RAW DATA to hocuspocus backend
    -- Service worker will build the title and body
    perform net.http_post(
        url := config.edge_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || config.service_key,
            'apikey', config.service_key
        ),
        body := jsonb_build_object(
            -- Identifiers
            'user_id', new.receiver_user_id,
            'notification_id', new.id,
            -- Raw data for service worker to format
            'type', new.type::text,
            'sender_name', sender_info.name,
            'sender_avatar', sender_info.avatar_url,
            'message_preview', new.message_preview,
            'action_url', computed_action_url,
            -- Context
            'channel_id', new.channel_id
        )
    );

    return new;
end;
$$;

-- Trigger: send push immediately when notification is created
drop trigger if exists trigger_send_push_notification on public.notifications;
create trigger trigger_send_push_notification
    after insert on public.notifications
    for each row execute function public.send_push_notification();


-- =============================================================================
-- 6. Cleanup Function (runs via pg_cron)
-- =============================================================================

create or replace function public.cleanup_push_subscriptions()
returns void
language plpgsql
security definer
as $$
begin
    -- Deactivate subscriptions that failed 5+ consecutive times
    update public.push_subscriptions
    set is_active = false,
        last_error = 'Deactivated: exceeded failure threshold'
    where failed_count >= 5 and is_active = true;

    -- Reset failed_count for subscriptions used successfully in last hour
    update public.push_subscriptions
    set failed_count = 0
    where failed_count > 0
      and is_active = true
      and last_used_at > now() - interval '1 hour'
      and last_error is null;
end;
$$;

-- Schedule cleanup job (every 5 minutes)
-- Note: Requires pg_cron extension
do $$
begin
    -- Remove old job if exists
    perform cron.unschedule('cleanup_failed_push_subscriptions')
    where exists (select 1 from cron.job where jobname = 'cleanup_failed_push_subscriptions');

    -- Schedule new job
    perform cron.schedule(
        'cleanup_push_subscriptions',
        '*/5 * * * *',
        'select public.cleanup_push_subscriptions();'
    );
exception when others then
    raise notice 'pg_cron not available, skipping job scheduling';
end;
$$;


-- =============================================================================
-- 7. Client API Functions
-- =============================================================================

-- Register a push subscription for the current user
create or replace function public.register_push_subscription(
    p_device_id text,
    p_device_name text,
    p_platform text,
    p_push_credentials jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
    v_user_id uuid := auth.uid();
    v_id uuid;
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    -- Upsert: insert or update existing subscription
    insert into public.push_subscriptions (
        user_id, device_id, device_name, platform, push_credentials
    )
    values (
        v_user_id, p_device_id, p_device_name, p_platform, p_push_credentials
    )
    on conflict (user_id, device_id) do update set
        device_name = excluded.device_name,
        push_credentials = excluded.push_credentials,
        is_active = true,
        failed_count = 0,
        last_error = null,
        updated_at = now()
    returning id into v_id;

    return v_id;
end;
$$;

-- Unregister push subscription for a device
create or replace function public.unregister_push_subscription(p_device_id text)
returns boolean
language plpgsql
security definer
as $$
begin
    delete from public.push_subscriptions
    where user_id = auth.uid() and device_id = p_device_id;

    return found;
end;
$$;

-- List current user's push subscriptions
create or replace function public.get_push_subscriptions()
returns table (
    id uuid,
    device_id text,
    device_name text,
    platform text,
    is_active boolean,
    created_at timestamptz
)
language sql
security definer
stable
as $$
    select id, device_id, device_name, platform, is_active, created_at
    from public.push_subscriptions
    where user_id = auth.uid()
    order by created_at desc;
$$;


-- =============================================================================
-- 8. Admin Functions
-- =============================================================================

-- Get push notification health and configuration status
create or replace function public.get_push_notification_stats()
returns jsonb
language plpgsql
security definer
as $$
declare
    v_result jsonb;
    v_gateway_url text;
    v_service_key text;
    v_config_status text;
begin
    -- Get configuration
    v_gateway_url := internal.get_config('app.push_gateway_url', null);
    v_service_key := internal.get_config('app.settings.service_role_key', null);

    -- Determine config status
    if v_gateway_url is null or v_gateway_url = '' then
        v_config_status := 'missing_gateway_url';
    elsif v_service_key is null or v_service_key = '' then
        v_config_status := 'missing_service_key';
    else
        v_config_status := 'ok';
    end if;

    -- Build result
    select jsonb_build_object(
        'config_status', v_config_status,
        'gateway_url', v_gateway_url,
        'total_subscriptions', (select count(*) from public.push_subscriptions),
        'active_subscriptions', (select count(*) from public.push_subscriptions where is_active = true),
        'failed_subscriptions', (select count(*) from public.push_subscriptions where failed_count > 0),
        'last_push_attempt', (select max(last_used_at) from public.push_subscriptions)
    ) into v_result;

    return v_result;
end;
$$;

comment on function public.get_push_notification_stats() is
'Returns push notification configuration status and subscription statistics.
Use this to verify push notifications are properly configured.';

-- Set push configuration (admin function)
create or replace function public.set_push_config(
    p_gateway_url text,
    p_service_key text default null
)
returns jsonb
language plpgsql
security definer
as $$
begin
    -- Require authentication
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    -- Set gateway URL
    if p_gateway_url is not null then
        perform internal.set_config(
            'app.push_gateway_url',
            p_gateway_url,
            'Push notification gateway URL (hocuspocus.server)'
        );
    end if;

    -- Set service key
    if p_service_key is not null then
        perform internal.set_config(
            'app.settings.service_role_key',
            p_service_key,
            'Supabase service role key for push gateway auth'
        );
    end if;

    -- Return updated config status
    return public.get_push_notification_stats();
end;
$$;

comment on function public.set_push_config(text, text) is
'Set push notification configuration.
For hosted Supabase where ALTER DATABASE is not available.
Call with gateway_url and optionally service_key.';

-- Grant execute to authenticated users
grant execute on function public.set_push_config(text, text) to authenticated;


-- =============================================================================
-- 9. Enable Realtime for Notification Tables
-- =============================================================================
-- Required for admin dashboard to receive live updates

do $$
begin
    -- Add tables to realtime publication if not already added
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'notifications'
    ) then
        alter publication supabase_realtime add table notifications;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'push_subscriptions'
    ) then
        alter publication supabase_realtime add table push_subscriptions;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'email_queue'
    ) then
        alter publication supabase_realtime add table email_queue;
    end if;
end $$;
