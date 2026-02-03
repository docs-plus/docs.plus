-- -----------------------------------------------------------------------------
-- Push Notifications Schema (pgmq Consumer Architecture)
-- -----------------------------------------------------------------------------
-- Production-ready push notification system using pgmq for reliability.
--
-- ARCHITECTURE (v2 - pgmq Consumer):
--   Database Trigger → pgmq queue → Backend Consumer → BullMQ → Web Push API
--
-- WHY pgmq INSTEAD OF pg_net?
--   ✅ Never lose messages (queue persists even if backend is down)
--   ✅ No exposed HTTP endpoint (security improvement)
--   ✅ Auto-retry built into queue semantics
--   ✅ Same pattern as document_views and message_counter (consistency)
--   ✅ $0 cost at any scale
--   ⚠️ 2-5 second delay (acceptable for push notifications)
--
-- MIGRATION FROM v1 (pg_net):
--   - Old trigger replaced with enqueue_push_notification
--   - Backend consumer polls queue every 2 seconds
--   - HTTP endpoint (/api/push/send) has been removed
--
-- DEPLOYMENT CHECKLIST:
--   1. Run this migration
--   2. Deploy backend with pgmq consumer
--   3. Verify queue is being consumed (check queue depth)
--   4. Remove pg_net dependency after 1 week of stable operation
--
-- @see docs/PUSH_NOTIFICATION_PGMQ.md for detailed architecture
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 1. Create pgmq Queue for Push Notifications
-- =============================================================================
-- Queue stores notification events until backend consumes them

select from pgmq.create('push_notifications');

comment on table pgmq.q_push_notifications is
'Queue for push notification events. Consumed by hocuspocus.server backend.
Events are processed in order and deleted after successful processing.';

-- =============================================================================
-- 2. Push Subscriptions Table
-- =============================================================================
-- Stores browser/device push subscription credentials per user

create table if not exists public.push_subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    device_id text not null,
    device_name text,
    platform text check (platform in ('web', 'ios', 'android', 'desktop')),
    push_credentials jsonb not null,
    is_active boolean default true not null,
    failed_count int default 0 not null,
    last_error text,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,

    constraint unique_user_device unique (user_id, device_id)
);

create index if not exists idx_push_subscriptions_user_active
    on public.push_subscriptions(user_id)
    where is_active = true;

create index if not exists idx_push_subscriptions_cleanup
    on public.push_subscriptions(is_active, failed_count)
    where is_active = false or failed_count > 3;

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can manage own subscriptions" on public.push_subscriptions;
create policy "Users can manage own subscriptions" on public.push_subscriptions
    for all using (auth.uid() = user_id);

comment on table public.push_subscriptions is
'Browser/device push notification subscriptions per user';

-- Updated_at trigger
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
-- 3. Helper Functions
-- =============================================================================

-- Check if user has push notifications enabled
create or replace function internal.is_push_enabled(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select coalesce(
        (profile_data->'notification_preferences'->>'push_enabled')::boolean,
        true  -- Default to enabled
    )
    from public.users
    where id = p_user_id;
$$;

-- Get user's notification preferences
create or replace function internal.get_push_preferences(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
    select coalesce(
        profile_data->'notification_preferences',
        '{}'::jsonb
    )
    from public.users
    where id = p_user_id;
$$;

-- Check if current time is within user's quiet hours
create or replace function internal.is_quiet_hours(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    with user_prefs as (
        select
            coalesce((profile_data->'notification_preferences'->>'quiet_hours_enabled')::boolean, false) as enabled,
            coalesce(profile_data->'notification_preferences'->>'quiet_hours_start', '22:00') as start_time,
            coalesce(profile_data->'notification_preferences'->>'quiet_hours_end', '08:00') as end_time,
            coalesce(profile_data->>'timezone', 'UTC') as tz
        from public.users
        where id = p_user_id
    )
    select
        case
            when not enabled then false
            else (
                (now() at time zone tz)::time
                between start_time::time and end_time::time
                or (
                    start_time::time > end_time::time
                    and (
                        (now() at time zone tz)::time >= start_time::time
                        or (now() at time zone tz)::time <= end_time::time
                    )
                )
            )
        end
    from user_prefs;
$$;

-- Check if user is currently online (suppress push if online)
create or replace function internal.is_user_online(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.users
        where id = p_user_id
        and status = 'ONLINE'
        and last_seen_at > now() - interval '2 minutes'
    );
$$;


-- =============================================================================
-- 4. Enqueue Push Notification (replaces pg_net HTTP call)
-- =============================================================================
-- Trigger function that enqueues notification to pgmq instead of HTTP

create or replace function public.enqueue_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_receiver_id uuid;
    v_sender_name text;
    v_sender_avatar text;
    v_prefs jsonb;
    v_notify_type text;
    v_has_subscriptions boolean;
    v_action_url text;
begin
    -- Get receiver ID
    v_receiver_id := new.receiver_user_id;

    -- Don't notify self
    if v_receiver_id = new.sender_user_id then
        return new;
    end if;

    -- Check if user has push enabled
    if not internal.is_push_enabled(v_receiver_id) then
        return new;
    end if;

    -- Check if user is online (skip push if online)
    if internal.is_user_online(v_receiver_id) then
        return new;
    end if;

    -- Check quiet hours
    if internal.is_quiet_hours(v_receiver_id) then
        return new;
    end if;

    -- Get user preferences
    v_prefs := internal.get_push_preferences(v_receiver_id);
    v_notify_type := new.type;

    -- Check if this notification type is enabled
    if v_notify_type = 'mention' and not coalesce((v_prefs->>'mentions_enabled')::boolean, true) then
        return new;
    end if;
    if v_notify_type = 'reply' and not coalesce((v_prefs->>'replies_enabled')::boolean, true) then
        return new;
    end if;
    if v_notify_type = 'reaction' and not coalesce((v_prefs->>'reactions_enabled')::boolean, true) then
        return new;
    end if;

    -- Check if user has any active push subscriptions
    select exists(
        select 1 from public.push_subscriptions
        where user_id = v_receiver_id and is_active = true
    ) into v_has_subscriptions;

    if not v_has_subscriptions then
        return new;
    end if;

    -- Get sender info
    select
        coalesce(full_name, username, 'Someone'),
        avatar_url
    into v_sender_name, v_sender_avatar
    from public.users
    where id = new.sender_user_id;

    -- Build action URL
    v_action_url := coalesce(new.action_url, '');

    -- =========================================================================
    -- ENQUEUE TO pgmq (instead of pg_net HTTP call)
    -- Backend consumer will process this and send via Web Push API
    -- =========================================================================

    perform pgmq.send(
        queue_name := 'push_notifications',
        msg := jsonb_build_object(
            'notification_id', new.id,
            'user_id', v_receiver_id,
            'type', v_notify_type,
            'sender_name', v_sender_name,
            'sender_avatar', v_sender_avatar,
            'message_preview', coalesce(new.message_preview, ''),
            'action_url', v_action_url,
            'channel_id', new.channel_id,
            'enqueued_at', now()
        )
    );

    return new;
end;
$$;

comment on function public.enqueue_push_notification() is
'Enqueues push notification to pgmq queue for backend consumption.
Replaces pg_net HTTP approach for better reliability and security.';

-- Drop old trigger and create new one
drop trigger if exists trigger_send_push_notification on public.notifications;
drop trigger if exists trigger_enqueue_push_notification on public.notifications;
create trigger trigger_enqueue_push_notification
    after insert on public.notifications
    for each row execute function public.enqueue_push_notification();


-- =============================================================================
-- 5. Consumer RPC Functions (called by backend)
-- =============================================================================
-- Backend calls this RPC to read and process queue messages

create or replace function public.consume_push_queue(
    p_batch_size int default 50,
    p_visibility_timeout int default 30
)
returns table (
    msg_id bigint,
    payload jsonb,
    enqueued_at timestamptz
)
language sql
security definer
set search_path = public
as $$
    select
        msg_id,
        message as payload,
        enqueued_at
    from pgmq.read(
        queue_name := 'push_notifications',
        vt := p_visibility_timeout,
        qty := p_batch_size
    );
$$;

comment on function public.consume_push_queue(int, int) is
'Reads push notification messages from pgmq queue.
Called by backend consumer service every 2 seconds.
Returns batch of messages with visibility timeout.';

-- Grant execute to service_role (backend uses service_role key)
grant execute on function public.consume_push_queue(int, int) to service_role;


-- Acknowledge processed message (delete from queue)
create or replace function public.ack_push_message(p_msg_id bigint)
returns boolean
language sql
security definer
set search_path = public
as $$
    select pgmq.delete('push_notifications', p_msg_id);
$$;

comment on function public.ack_push_message(bigint) is
'Acknowledges a push notification message was processed successfully.
Deletes the message from the queue.';

grant execute on function public.ack_push_message(bigint) to service_role;


-- =============================================================================
-- 6. Subscription Management Functions
-- =============================================================================

create or replace function public.register_push_subscription(
    p_device_id text,
    p_device_name text,
    p_platform text,
    p_push_credentials jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_subscription_id uuid;
begin
    insert into public.push_subscriptions (
        user_id, device_id, device_name, platform, push_credentials, is_active
    ) values (
        auth.uid(), p_device_id, p_device_name, p_platform, p_push_credentials, true
    )
    on conflict (user_id, device_id) do update set
        device_name = excluded.device_name,
        platform = excluded.platform,
        push_credentials = excluded.push_credentials,
        is_active = true,
        failed_count = 0,
        last_error = null,
        updated_at = now()
    returning id into v_subscription_id;

    return v_subscription_id;
end;
$$;

comment on function public.register_push_subscription(text, text, text, jsonb) is
'Registers or updates a push subscription for the current user.';


create or replace function public.unregister_push_subscription(p_device_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.push_subscriptions
    set is_active = false, updated_at = now()
    where user_id = auth.uid() and device_id = p_device_id;

    return found;
end;
$$;

comment on function public.unregister_push_subscription(text) is
'Deactivates a push subscription for the current user.';


-- =============================================================================
-- 7. Admin/Monitoring Functions
-- =============================================================================

create or replace function public.get_push_queue_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
    with queue_stats as (
        select
            count(*) as queue_length,
            extract(epoch from (now() - min(enqueued_at))) as oldest_msg_age_sec
        from pgmq.q_push_notifications
    ),
    subscription_stats as (
        select
            count(*) filter (where is_active) as active_subscriptions,
            count(*) filter (where not is_active) as inactive_subscriptions,
            count(*) filter (where failed_count > 0) as failed_subscriptions
        from public.push_subscriptions
    )
    select jsonb_build_object(
        'queue_length', coalesce(q.queue_length, 0),
        'oldest_message_age_seconds', coalesce(q.oldest_msg_age_sec, 0),
        'active_subscriptions', coalesce(s.active_subscriptions, 0),
        'inactive_subscriptions', coalesce(s.inactive_subscriptions, 0),
        'failed_subscriptions', coalesce(s.failed_subscriptions, 0),
        'consumer_status', case
            when coalesce(q.queue_length, 0) = 0 then 'idle'
            when coalesce(q.queue_length, 0) < 100 then 'healthy'
            when coalesce(q.queue_length, 0) < 1000 then 'backlog'
            else 'critical'
        end
    )
    from queue_stats q, subscription_stats s;
$$;

comment on function public.get_push_queue_stats() is
'Returns push notification system health including queue status and subscription stats.';


-- =============================================================================
-- 8. Cleanup Stale Subscriptions (pg_cron job)
-- =============================================================================

create or replace function internal.cleanup_push_subscriptions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_deleted int;
begin
    -- Deactivate subscriptions that have failed too many times
    update public.push_subscriptions
    set is_active = false
    where is_active = true and failed_count >= 5;

    -- Delete very old inactive subscriptions
    delete from public.push_subscriptions
    where is_active = false
    and updated_at < now() - interval '30 days';

    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$$;

comment on function internal.cleanup_push_subscriptions() is
'Cleans up stale push subscriptions. Run via pg_cron every 5 minutes.';


-- =============================================================================
-- 9. Drop Deprecated Functions (from pg_net architecture)
-- =============================================================================
-- These functions are no longer needed with pgmq Consumer architecture

drop function if exists public.send_push_notification() cascade;
drop function if exists internal.get_push_config() cascade;
drop function if exists public.set_push_config(text, text) cascade;


-- =============================================================================
-- 10. Enable Realtime for Notification Tables
-- =============================================================================

do $$
begin
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
end $$;
