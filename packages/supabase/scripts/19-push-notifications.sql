-- -----------------------------------------------------------------------------
-- Push Notifications Schema
-- -----------------------------------------------------------------------------
-- Production-ready push notification system.
-- Sends notifications immediately via pg_net async HTTP to hocuspocus backend.
--
-- ARCHITECTURE:
--   Database Trigger → pg_net → hocuspocus.server → Web Push API
--   (Cohesive with email gateway - both use hocuspocus backend)
--
-- DEPLOYMENT CHECKLIST:
--
-- 1. DATABASE SETTINGS (run once per environment):
--    ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
--    ALTER DATABASE postgres SET app.push_gateway_url = 'https://your-hocuspocus-server.com';
--
-- 2. HOCUSPOCUS BACKEND ENVIRONMENT (hocuspocus.server/.env):
--    - VAPID_PUBLIC_KEY  (generate: npx web-push generate-vapid-keys)
--    - VAPID_PRIVATE_KEY (generate: npx web-push generate-vapid-keys)
--    - VAPID_SUBJECT     (e.g., mailto:support@yourdomain.com)
--    - SUPABASE_URL      (your Supabase project URL)
--    - SUPABASE_SERVICE_ROLE_KEY (for subscription lookups)
--
-- 3. CLIENT ENVIRONMENT (webapp/.env):
--    - NEXT_PUBLIC_VAPID_PUBLIC_KEY (same as VAPID_PUBLIC_KEY above)
--
-- To verify configuration: SELECT public.get_push_notification_stats();
-- -----------------------------------------------------------------------------

-- Create internal schema for private helper functions
create schema if not exists internal;

-- 1. Push Subscriptions Table
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


-- 2. Helper: Get configuration with validation
-- Returns null if not configured (caller should handle gracefully)
-- Now uses hocuspocus backend gateway instead of Edge Function
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
    -- Priority: app.push_gateway_url > app.hocuspocus_url > default localhost
    v_gateway_url := coalesce(
        current_setting('app.push_gateway_url', true),
        current_setting('app.hocuspocus_url', true),
        'http://localhost:4000'
    );

    -- Get service role key for authorization
    v_service_key := current_setting('app.settings.service_role_key', true);

    -- Validate configuration
    if v_service_key is null or v_service_key = '' then
        raise warning 'Push notifications: app.settings.service_role_key not configured';
        return;
    end if;

    -- Return backend gateway URL and service key
    return query select
        v_gateway_url || '/api/push/send',
        v_service_key;
end;
$$;

comment on function internal.get_push_config() is
'Returns push gateway URL and service key.
Uses hocuspocus.server backend for cohesive architecture with email gateway.';


-- 3. Send push notification immediately via pg_net (async, non-blocking)
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

    -- Send RAW DATA to Edge Function
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


-- 4. Cleanup: Deactivate failed subscriptions (runs via pg_cron)
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


-- 5. Client API Functions

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


-- 6. Admin function to check push notification health
create or replace function public.get_push_notification_stats()
returns jsonb
language sql
security definer
stable
as $$
    select jsonb_build_object(
        'total_subscriptions', (select count(*) from public.push_subscriptions),
        'active_subscriptions', (select count(*) from public.push_subscriptions where is_active),
        'failed_subscriptions', (select count(*) from public.push_subscriptions where failed_count > 0),
        'config_status', case
            when current_setting('app.settings.supabase_url', true) is not null
             and current_setting('app.settings.service_role_key', true) is not null
            then 'configured'
            else 'missing_configuration'
        end
    );
$$;
