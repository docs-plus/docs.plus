-- Move notification preferences out of the public profile.
--
-- users_select is USING (true) and profile_data is in the anon and
-- authenticated SELECT grants, so every visitor could read every user's
-- notification toggles, quiet hours, timezone and email_bounce_info.
-- The new column has no client SELECT grant; the owner reads it through
-- get_notification_preferences(). A Profile save sends the whole
-- profile_data, so moving the key also stops it overwriting preferences.
--
-- Also: update_profile merges top-level profile_data keys, so saving the
-- bio never replaces links another device wrote. users_profile_changed signals
-- the owner's clients on the private profile:<uid> topic.
-- get_notification_reach counts a missing email_enabled as off.
--
-- Deploy SQL first, then hocuspocus, then the webapp. Until the webapp
-- ships, an old tab shows default notification settings (a toggle still
-- saves one key, so nothing is lost), and its Profile or link save fails on
-- the check constraint until it reloads. Old hocuspocus reports email off
-- for every user in admin stats until it ships.

-- 1. Column, then backfill (destructive: removes the key from profile_data).
alter table public.users
    add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

update public.users
   set notification_preferences = case
           when jsonb_typeof(profile_data -> 'notification_preferences') = 'object'
           then profile_data -> 'notification_preferences'
           else '{}'::jsonb
       end,
       profile_data = profile_data - 'notification_preferences'
 where profile_data ? 'notification_preferences';

alter table public.users drop constraint if exists valid_notification_preferences;
alter table public.users
    add constraint valid_notification_preferences
    check (jsonb_typeof(notification_preferences) = 'object');

alter table public.users drop constraint if exists profile_data_has_no_notification_preferences;
alter table public.users
    add constraint profile_data_has_no_notification_preferences
    check (not profile_data ? 'notification_preferences');

-- No-op when only column grants exist, which is the intended state.
revoke select (notification_preferences), update (notification_preferences)
    on public.users from anon, authenticated;

-- Fail the deploy rather than ship a readable column: a table-level grant
-- would survive the column revoke above.
do $$
begin
    if has_column_privilege('anon', 'public.users', 'notification_preferences', 'SELECT')
       or has_column_privilege('authenticated', 'public.users', 'notification_preferences', 'SELECT') then
        raise exception 'notification_preferences is readable by a client role; narrow its users grant first';
    end if;
end $$;


comment on column public.users.profile_data is E'Public profile data, readable by every visitor:\n{
  "bio": string?,
  "linkTree": [{ "url": string, "type": string, "metadata": object? }]
}';
comment on column public.users.notification_preferences is 'Private notification settings. No anon or authenticated SELECT grant: the owner reads it through get_notification_preferences() and writes it through update_notification_preferences().';


-- 2. Readers and writers of the preferences.

create or replace function public.update_notification_preferences(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_next jsonb;
begin
    if v_user_id is null then
        raise exception 'unauthenticated' using errcode = '42501';
    end if;
    if jsonb_typeof(p_patch) <> 'object' then
        raise exception 'patch_must_be_object' using errcode = '22023';
    end if;
    update public.users
       set notification_preferences = notification_preferences || p_patch
     where id = v_user_id
     returning notification_preferences into v_next;
    return v_next;
end;
$$;

revoke all on function public.update_notification_preferences(jsonb) from public, anon;
grant execute on function public.update_notification_preferences(jsonb) to authenticated;

-- get_notification_preferences — the owner's only read path. The column has
-- no client SELECT grant, because users_select lets anyone read any row.

create or replace function public.get_notification_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'unauthenticated' using errcode = '42501';
    end if;
    return (select notification_preferences from public.users where id = v_user_id);
end;
$$;

revoke all on function public.get_notification_preferences() from public, anon;
grant execute on function public.get_notification_preferences() to authenticated;

create or replace function internal.is_push_enabled(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select coalesce(
        (notification_preferences->>'push_enabled')::boolean,
        true  -- Default to enabled
    )
    from public.users
    where id = p_user_id;
$$;

create or replace function internal.get_push_preferences(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
    select notification_preferences
    from public.users
    where id = p_user_id;
$$;

create or replace function internal.is_quiet_hours(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    with user_prefs as (
        select
            coalesce((notification_preferences->>'quiet_hours_enabled')::boolean, false) as enabled,
            coalesce(notification_preferences->>'quiet_hours_start', '22:00') as start_time,
            coalesce(notification_preferences->>'quiet_hours_end', '08:00') as end_time,
            coalesce(notification_preferences->>'timezone', 'UTC') as tz
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

create or replace function internal.is_email_enabled(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select coalesce(
        (notification_preferences->>'email_enabled')::boolean,
        false
    )
    from public.users
    where id = p_user_id;
$$;

create or replace function internal.get_email_preferences(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
    select notification_preferences
    from public.users
    where id = p_user_id;
$$;

create or replace function internal.clear_email_bounce_info(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.users
    set notification_preferences = notification_preferences - 'email_bounce_info'
    where id = p_user_id
      and notification_preferences ? 'email_bounce_info';
end;
$$;

create or replace function public.record_email_bounce(
    p_email text,
    p_bounce_type text,
    p_provider text default null,
    p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_user_id uuid;
    v_masked_email text;
begin
    if p_bounce_type not in ('hard', 'soft', 'complaint') then
        raise exception 'Invalid bounce_type: %. Must be hard, soft, or complaint.', p_bounce_type;
    end if;

    insert into public.email_bounces (email, bounce_type, provider, reason)
    values (lower(p_email), p_bounce_type, p_provider, p_reason)
    returning id into v_id;

    -- Auto-disable email notifications and notify user on hard bounce / complaint
    if p_bounce_type in ('hard', 'complaint') then
        -- Find the user
        select id into v_user_id
        from public.users
        where lower(email) = lower(p_email);

        if v_user_id is not null then
            v_masked_email := internal.mask_email(p_email);

            -- Disable email + store bounce info in preferences
            update public.users
            set notification_preferences = notification_preferences || jsonb_build_object(
                'email_enabled', false,
                'email_bounce_info', jsonb_build_object(
                    'email', v_masked_email,
                    'reason', coalesce(p_reason, 'Email delivery failed'),
                    'bounced_at', now()::text
                )
            )
            where id = v_user_id;

            -- Insert system_alert notification so user sees it in-app.
            -- There is no /settings route: a path would open a pad named
            -- "settings". The hash opens the Settings panel, like the email footer.
            insert into public.notifications (
                receiver_user_id,
                sender_user_id,
                type,
                message_preview,
                action_url,
                created_at
            ) values (
                v_user_id,
                null,
                'system_alert',
                'Email delivery to ' || v_masked_email || ' failed. Your email notifications have been paused. Tap to review.',
                '/#settings?tab=notifications',
                now()
            );
        end if;
    end if;

    return v_id;
end;
$$;

create or replace function public.compile_digest_emails()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user record;
    v_compiled int := 0;
    v_skipped int := 0;
    v_app_url text;
    v_notifications jsonb;
    v_queue_ids uuid[];
begin
    v_app_url := coalesce(current_setting('app.base_url', true), 'https://docs.plus');

    -- Pre-pass: mark digest items with already-read notifications as skipped
    update public.email_queue eq
    set status = 'skipped',
        error_message = 'Notification already read'
    from public.notifications n
    where eq.notification_id = n.id
      and eq.status = 'pending'
      and eq.email_type = 'digest'
      and eq.scheduled_for <= now()
      and n.readed_at is not null;

    -- Process each user with pending digest entries
    for v_user in
        select distinct
            eq.user_id,
            u.email as recipient_email,
            u.display_name as recipient_name,
            coalesce(
                u.notification_preferences->>'email_frequency',
                'daily'
            ) as frequency
        from public.email_queue eq
        join public.users u on u.id = eq.user_id
        where eq.status = 'pending'
          and eq.email_type = 'digest'
          and eq.scheduled_for <= now()
          and eq.attempts < 3
    loop
        -- Skip if user disabled email
        if not internal.is_email_enabled(v_user.user_id) then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Email disabled by user'
            where user_id = v_user.user_id
              and status = 'pending'
              and email_type = 'digest'
              and scheduled_for <= now();
            v_skipped := v_skipped + 1;
            continue;
        end if;

        -- Skip if email suppressed (hard bounced)
        if internal.is_email_suppressed(v_user.recipient_email) then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Email address suppressed (hard bounce)'
            where user_id = v_user.user_id
              and status = 'pending'
              and email_type = 'digest'
              and scheduled_for <= now();
            v_skipped := v_skipped + 1;
            continue;
        end if;

        -- Lock and collect queue item IDs
        select array_agg(id)
        into v_queue_ids
        from (
            select eq.id
            from public.email_queue eq
            where eq.user_id = v_user.user_id
              and eq.status = 'pending'
              and eq.email_type = 'digest'
              and eq.scheduled_for <= now()
              and eq.attempts < 3
            for update of eq skip locked
        ) locked_items;

        if v_queue_ids is null or array_length(v_queue_ids, 1) = 0 then
            continue;
        end if;

        -- Collect notification data for locked items (only unread)
        select jsonb_agg(
            jsonb_build_object(
                'notification_type', n.type,
                'sender_name', coalesce(s.display_name, 'Someone'),
                'sender_avatar_url', s.avatar_url,
                'message_preview', coalesce(n.message_preview, ''),
                'channel_id', n.channel_id,
                'channel_name', coalesce(c.name, 'General'),
                'workspace_id', c.workspace_id,
                'workspace_name', coalesce(w.name, c.slug),
                'workspace_slug', coalesce(w.slug, c.slug),
                'created_at', n.created_at
            )
            order by n.created_at
        )
        into v_notifications
        from public.email_queue eq
        join public.notifications n on n.id = eq.notification_id
        left join public.users s on s.id = n.sender_user_id
        left join public.channels c on c.id = n.channel_id
        left join public.workspaces w on w.id = c.workspace_id
        where eq.id = any(v_queue_ids);

        -- Skip if nothing to compile
        if v_notifications is null or jsonb_array_length(v_notifications) = 0 then
            v_skipped := v_skipped + 1;
            continue;
        end if;

        -- Mark all items as processing
        update public.email_queue
        set status = 'processing',
            attempts = attempts + 1
        where id = any(v_queue_ids);

        -- Send compiled digest to pgmq as a single message
        perform pgmq.send(
            'email_notifications_queue',
            jsonb_build_object(
                'type', 'digest',
                'recipient_email', v_user.recipient_email,
                'recipient_name', coalesce(v_user.recipient_name, ''),
                'recipient_id', v_user.user_id::text,
                'frequency', v_user.frequency,
                'queue_ids', to_jsonb(v_queue_ids),
                'notifications', v_notifications,
                'enqueued_at', now()::text
            )
        );

        v_compiled := v_compiled + 1;
    end loop;

    return jsonb_build_object(
        'compiled', v_compiled,
        'skipped', v_skipped,
        'timestamp', now()
    );
end;
$$;

create or replace function public.get_email_notification_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    queue_depth bigint;
begin
    -- Get pgmq queue depth
    select count(*) into queue_depth
    from pgmq.q_email_notifications_queue;

    return jsonb_build_object(
        'architecture', 'pgmq_consumer',
        'queue', jsonb_build_object(
            'name', 'email_notifications_queue',
            'depth', queue_depth
        ),
        'email_queue', jsonb_build_object(
            'total', (select count(*) from public.email_queue),
            'pending', (select count(*) from public.email_queue where status = 'pending'),
            'processing', (select count(*) from public.email_queue where status = 'processing'),
            'sent', (select count(*) from public.email_queue where status = 'sent'),
            'skipped', (select count(*) from public.email_queue where status = 'skipped'),
            'failed', (select count(*) from public.email_queue where status = 'failed')
        ),
        'users_with_email_enabled', (
            select count(*)
            from public.users
            where (notification_preferences->>'email_enabled')::boolean = true
        )
    );
end;
$$;

create or replace function public.apply_unsubscribe(
    p_user_id uuid,
    p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_email text;
    prefs jsonb;
    new_prefs jsonb;
    action_description text;
begin
    select email, notification_preferences
    into v_user_email, prefs
    from public.users
    where id = p_user_id;

    if v_user_email is null then
        return jsonb_build_object(
            'success', false,
            'error', 'user_not_found',
            'message', 'User account not found.'
        );
    end if;

    case p_action
        when 'mentions' then
            new_prefs := jsonb_set(prefs, '{email_mentions}', 'false'::jsonb);
            action_description := 'mention emails';
        when 'replies' then
            new_prefs := jsonb_set(prefs, '{email_replies}', 'false'::jsonb);
            action_description := 'reply emails';
        when 'reactions' then
            new_prefs := jsonb_set(prefs, '{email_reactions}', 'false'::jsonb);
            action_description := 'reaction emails';
        when 'digest' then
            new_prefs := jsonb_set(prefs, '{email_frequency}', '"never"'::jsonb);
            action_description := 'digest emails';
        when 'all' then
            new_prefs := jsonb_set(prefs, '{email_enabled}', 'false'::jsonb);
            action_description := 'all email notifications';
        else
            return jsonb_build_object(
                'success', false,
                'error', 'invalid_action',
                'message', 'Invalid unsubscribe action.'
            );
    end case;

    update public.users
    set notification_preferences = new_prefs
    where id = p_user_id;

    return jsonb_build_object(
        'success', true,
        'action', p_action,
        'action_description', action_description,
        'email', v_user_email,
        'message', 'You have been unsubscribed from ' || action_description || '.',
        'user_id', p_user_id
    );
end;
$$;

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

    -- Missing means off, as in internal.is_email_enabled.
    select count(*) into v_email_enabled
    from public.users
    where deleted_at is null
      and (notification_preferences->>'email_enabled')::boolean = true;

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


-- 3. Profile save merges profile_data keys instead of replacing the column.

/**
 * Function: update_profile
 * Saves the owner's profile. Merges only the top-level profile_data keys it is given,
 * so saving the bio never replaces links another device just wrote. An omitted
 * name or username keeps its column. Invoker rights: the column grants and users_self_update still apply.
 */
CREATE OR REPLACE FUNCTION public.update_profile(
    p_username text DEFAULT NULL,
    p_full_name text DEFAULT NULL,
    p_profile_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_saved jsonb;
BEGIN
    IF (select auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
    END IF;
    IF p_profile_patch IS NULL OR jsonb_typeof(p_profile_patch) <> 'object' THEN
        RAISE EXCEPTION 'patch_must_be_object' USING errcode = '22023';
    END IF;
    UPDATE public.users
       SET username = coalesce(p_username, username),
           full_name = coalesce(p_full_name, full_name),
           profile_data = profile_data || p_profile_patch
     WHERE id = (select auth.uid())
     RETURNING jsonb_build_object(
         'username', username,
         'full_name', full_name,
         'profile_data', profile_data
     ) INTO v_saved;
    RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile(text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_profile(text, text, jsonb) TO authenticated;

-- 4. Profile change signal.

CREATE OR REPLACE FUNCTION public.broadcast_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM realtime.send(
        jsonb_build_object('user_id', NEW.id),
        'profile_changed',
        'profile:' || NEW.id::text,
        TRUE
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS users_profile_changed ON public.users;

-- The column list and the guard keep the status heartbeat and cron out.
CREATE TRIGGER users_profile_changed
AFTER UPDATE OF username, full_name, avatar_url, avatar_updated_at, profile_data, notification_preferences
ON public.users
FOR EACH ROW
WHEN (
    OLD.username IS DISTINCT FROM NEW.username
    OR OLD.full_name IS DISTINCT FROM NEW.full_name
    OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
    OR OLD.avatar_updated_at IS DISTINCT FROM NEW.avatar_updated_at
    OR OLD.profile_data IS DISTINCT FROM NEW.profile_data
    OR OLD.notification_preferences IS DISTINCT FROM NEW.notification_preferences
)
EXECUTE FUNCTION public.broadcast_profile_change();

DROP POLICY IF EXISTS "profile_topic_access" ON realtime.messages;

CREATE POLICY "profile_topic_access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.topic = 'profile:' || (select auth.uid())::text
);

-- A line comment, not comment on policy: postgres does not own realtime.messages.
-- profile_topic_access: a user subscribes only to profile:<auth.uid()>, the
-- private topic broadcast_profile_change() sends to.
