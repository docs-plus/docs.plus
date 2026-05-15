-- 20260515150000_settings_hardening.sql
--
-- 1. Push trigger preference keys renamed to match the FE's `push_*`
--    namespace (was bare `mentions_enabled` / `replies_enabled` /
--    `reactions_enabled` — keys the FE has never written). Per-type push
--    toggles were silently no-ops since they shipped.
--
-- 2. `internal.is_quiet_hours` reads timezone from
--    `notification_preferences.timezone`, not the top-level
--    `profile_data.timezone` (which the FE never sets). Push quiet hours
--    had always evaluated in UTC regardless of the user's pick.
--
-- 3. `public.get_notification_reach` (service-role analytics): JSONB
--    path fix for `email_enabled` aggregation, and replace the
--    non-existent `notifications.is_read` reference with `readed_at`.
--
-- Mirrors scripts/07-4-push-notifications-pgmq.sql and
-- scripts/22-user-retention.sql. Idempotent via `create or replace`.

-- 1. internal.is_quiet_hours — timezone path correction.

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
            coalesce(profile_data->'notification_preferences'->>'timezone', 'UTC') as tz
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

-- 2. public.enqueue_push_notification — preference-key rename.
--    Body mirrors scripts/07-4-push-notifications-pgmq.sql verbatim.

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
    v_receiver_id := new.receiver_user_id;

    if v_receiver_id = new.sender_user_id then
        return new;
    end if;

    if not internal.is_push_enabled(v_receiver_id) then
        return new;
    end if;

    if internal.is_user_online(v_receiver_id) then
        return new;
    end if;

    if internal.is_quiet_hours(v_receiver_id) then
        return new;
    end if;

    v_prefs := internal.get_push_preferences(v_receiver_id);
    v_notify_type := new.type;

    if v_notify_type = 'mention' and not coalesce((v_prefs->>'push_mentions')::boolean, true) then
        return new;
    end if;
    if v_notify_type = 'reply' and not coalesce((v_prefs->>'push_replies')::boolean, true) then
        return new;
    end if;
    if v_notify_type = 'reaction' and not coalesce((v_prefs->>'push_reactions')::boolean, true) then
        return new;
    end if;

    select exists(
        select 1 from public.push_subscriptions
        where user_id = v_receiver_id and is_active = true
    ) into v_has_subscriptions;

    if not v_has_subscriptions then
        return new;
    end if;

    select
        coalesce(full_name, username, 'Someone'),
        avatar_url
    into v_sender_name, v_sender_avatar
    from public.users
    where id = new.sender_user_id;

    v_action_url := coalesce(new.action_url, '');

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

-- 3. public.get_notification_reach — JSONB path + column name fixes.
--    Body mirrors scripts/22-user-retention.sql verbatim.

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
    select count(*) into v_total_users from public.users;

    select count(distinct user_id) into v_push_enabled
    from public.push_subscriptions
    where user_id is not null;

    select count(*) into v_email_enabled
    from public.users
    where (profile_data->'notification_preferences'->>'email_enabled')::boolean = true
       or profile_data->'notification_preferences'->>'email_enabled' is null;

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
