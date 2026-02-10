-- =============================================================================
-- Email Notifications Schema (pgmq Architecture)
-- =============================================================================
--
-- ARCHITECTURE:
--   Notification Insert → email_queue table → pgmq queue → Backend Consumer → SMTP
--
-- WHY pgmq INSTEAD OF pg_net?
--   ✅ Never lose messages (queue persists even if backend is down)
--   ✅ No exposed HTTP endpoint (security improvement)
--   ✅ Auto-retry built into queue semantics
--   ✅ Same pattern as push notifications (consistency)
--   ✅ $0 cost at any scale
--
-- REQUIRES:
--   - 14-realtime-replica.sql (pgmq extension)
--
-- @see docs/NOTIFICATION_ARCHITECTURE_COMPARISON.md
-- =============================================================================


-- =============================================================================
-- 1. Email Queue Table (source of truth for scheduled emails)
-- =============================================================================

create table if not exists public.email_queue (
    id uuid default gen_random_uuid() primary key,
    notification_id uuid references public.notifications(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    email_type text not null check (email_type in ('immediate', 'digest', 'fallback')),
    status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
    scheduled_for timestamptz not null default now(),
    attempts int default 0 not null,
    sent_at timestamptz,
    error_message text,
    created_at timestamptz default now() not null
);

create index if not exists idx_email_queue_pending
    on public.email_queue(scheduled_for)
    where status = 'pending';

create index if not exists idx_email_queue_user
    on public.email_queue(user_id, status);

alter table public.email_queue enable row level security;

drop policy if exists "Users can view own email queue" on public.email_queue;
create policy "Users can view own email queue" on public.email_queue
    for select using (auth.uid() = user_id);

comment on table public.email_queue is 'Queue for email notifications with scheduling support';


-- =============================================================================
-- 1b. Email Bounces Table (deliverability tracking)
-- =============================================================================
-- Tracks hard/soft bounces and complaints from email providers.
-- Hard bounces auto-suppress future sends to that address.

create table if not exists public.email_bounces (
    id uuid default gen_random_uuid() primary key,
    email text not null,
    bounce_type text not null check (bounce_type in ('hard', 'soft', 'complaint')),
    provider text,
    reason text,
    created_at timestamptz default now() not null
);

create index if not exists idx_email_bounces_email
    on public.email_bounces(email, bounce_type)
    where bounce_type = 'hard';

alter table public.email_bounces enable row level security;

comment on table public.email_bounces is 'Tracks email bounces and complaints for deliverability management';


-- =============================================================================
-- 2. Create pgmq Queue for Email
-- =============================================================================

select pgmq.create_non_partitioned('email_notifications_queue');

comment on table pgmq.q_email_notifications_queue is
'pgmq queue for email notification delivery. Consumed by hocuspocus-worker.';


-- =============================================================================
-- 3. Helper Functions
-- =============================================================================

create or replace function internal.is_email_enabled(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select coalesce(
        (profile_data->'notification_preferences'->>'email_enabled')::boolean,
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
    select coalesce(
        profile_data->'notification_preferences',
        '{}'::jsonb
    )
    from public.users
    where id = p_user_id;
$$;


-- Check if an email address is suppressed due to hard bounces (last 90 days)
create or replace function internal.is_email_suppressed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists(
        select 1 from public.email_bounces
        where email = lower(p_email)
          and bounce_type = 'hard'
          and created_at > now() - interval '90 days'
    );
$$;


-- Per-user daily email rate limit check
create or replace function internal.check_email_rate_limit(
    p_user_id uuid,
    p_max_per_day int default 50
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select count(*) < p_max_per_day
         from public.email_queue
         where user_id = p_user_id
           and status = 'sent'
           and sent_at > now() - interval '24 hours'),
        true
    );
$$;


-- Mask an email address for display: john.doe@example.com → j***@example.com
create or replace function internal.mask_email(p_email text)
returns text
language sql
immutable
as $$
    select
        case
            when p_email is null or p_email = '' then ''
            when position('@' in p_email) = 0 then '***'
            else left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2)
        end;
$$;

comment on function internal.mask_email(text) is
'Masks an email address for display, showing only first char and domain.';


-- Clear bounce info from a user's notification preferences
create or replace function internal.clear_email_bounce_info(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.users
    set profile_data = jsonb_set(
        coalesce(profile_data, '{}'::jsonb),
        '{notification_preferences}',
        (coalesce(profile_data->'notification_preferences', '{}'::jsonb) - 'email_bounce_info')
    )
    where id = p_user_id
      and profile_data->'notification_preferences' ? 'email_bounce_info';
end;
$$;

comment on function internal.clear_email_bounce_info(uuid) is
'Removes email_bounce_info from user notification preferences after re-enable or email update.';


-- Record a bounce event and auto-suppress on hard bounce
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
            set profile_data = jsonb_set(
                jsonb_set(
                    coalesce(profile_data, '{}'::jsonb),
                    '{notification_preferences,email_enabled}',
                    'false'::jsonb
                ),
                '{notification_preferences,email_bounce_info}',
                jsonb_build_object(
                    'email', v_masked_email,
                    'reason', coalesce(p_reason, 'Email delivery failed'),
                    'bounced_at', now()::text
                )
            )
            where id = v_user_id;

            -- Insert system_alert notification so user sees it in-app
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
                '/settings/notifications',
                now()
            );
        end if;
    end if;

    return v_id;
end;
$$;

comment on function public.record_email_bounce(text, text, text, text) is
'Records an email bounce/complaint. Hard bounces auto-disable email, store bounce info, and notify user.';


-- =============================================================================
-- 4. Queue Email on Notification Insert
-- =============================================================================

create or replace function public.queue_email_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    prefs jsonb;
    email_frequency text;
    should_queue boolean := false;
    queue_type text;
    schedule_time timestamptz;
    user_tz text;
begin
    if tg_op != 'INSERT' then
        return new;
    end if;

    prefs := internal.get_email_preferences(new.receiver_user_id);

    if not coalesce((prefs->>'email_enabled')::boolean, false) then
        return new;
    end if;

    case new.type::text
        when 'mention' then
            should_queue := coalesce((prefs->>'email_mentions')::boolean, true);
        when 'reply' then
            should_queue := coalesce((prefs->>'email_replies')::boolean, true);
        when 'reaction' then
            should_queue := coalesce((prefs->>'email_reactions')::boolean, false);
        else
            should_queue := true;
    end case;

    if not should_queue then
        return new;
    end if;

    email_frequency := coalesce(prefs->>'email_frequency', 'daily');
    user_tz := coalesce(prefs->>'timezone', 'UTC');

    case email_frequency
        when 'immediate' then
            queue_type := 'immediate';
            schedule_time := now() + interval '15 minutes';
        when 'daily' then
            queue_type := 'digest';
            begin
                schedule_time := (
                    date_trunc('day', now() at time zone user_tz) + interval '1 day' + interval '9 hours'
                ) at time zone user_tz;
            exception when others then
                schedule_time := date_trunc('day', now()) + interval '1 day' + interval '9 hours';
            end;
        when 'weekly' then
            queue_type := 'digest';
            begin
                schedule_time := (
                    date_trunc('week', now() at time zone user_tz) + interval '1 week' + interval '9 hours'
                ) at time zone user_tz;
            exception when others then
                schedule_time := date_trunc('week', now()) + interval '1 week' + interval '9 hours';
            end;
        else
            return new;
    end case;

    -- Check quiet hours for immediate emails
    if queue_type = 'immediate' and coalesce((prefs->>'quiet_hours_enabled')::boolean, false) then
        declare
            now_time time;
            quiet_start time;
            quiet_end time;
        begin
            now_time := (now() at time zone user_tz)::time;
            quiet_start := (prefs->>'quiet_hours_start')::time;
            quiet_end := (prefs->>'quiet_hours_end')::time;

            if quiet_start > quiet_end then
                if now_time >= quiet_start or now_time <= quiet_end then
                    return new;
                end if;
            else
                if now_time >= quiet_start and now_time <= quiet_end then
                    return new;
                end if;
            end if;
        exception when others then
            null;
        end;
    end if;

    insert into public.email_queue (
        notification_id,
        user_id,
        email_type,
        scheduled_for
    ) values (
        new.id,
        new.receiver_user_id,
        queue_type,
        schedule_time
    );

    return new;
end;
$$;

drop trigger if exists trigger_queue_email_notification on public.notifications;
create trigger trigger_queue_email_notification
    after insert on public.notifications
    for each row execute function public.queue_email_notification();


-- =============================================================================
-- 5. Process Email Queue → Enqueue to pgmq (pg_cron)
-- =============================================================================
-- This function moves due emails from email_queue to pgmq for backend processing

create or replace function public.process_email_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    pending_email record;
    enqueued int := 0;
    skipped int := 0;
    doc_slug text;
begin
    for pending_email in
        select
            eq.id as queue_id,
            eq.notification_id,
            eq.user_id,
            eq.email_type,
            n.type as notification_type,
            n.message_preview,
            n.channel_id,
            n.sender_user_id,
            n.readed_at,
            u.email as recipient_email,
            u.id as recipient_id,
            u.display_name as recipient_name,
            s.display_name as sender_name,
            s.id as sender_id,
            s.avatar_url as sender_avatar_url
        from public.email_queue eq
        join public.notifications n on n.id = eq.notification_id
        join public.users u on u.id = eq.user_id
        left join public.users s on s.id = n.sender_user_id
        where eq.status = 'pending'
          and eq.email_type = 'immediate'
          and eq.scheduled_for <= now()
          and eq.attempts < 3
        order by eq.scheduled_for
        limit 100
        for update of eq skip locked
    loop
        -- Skip if already read
        if pending_email.readed_at is not null then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Notification already read'
            where id = pending_email.queue_id;
            skipped := skipped + 1;
            continue;
        end if;

        -- Skip if email address is suppressed (hard bounced)
        if internal.is_email_suppressed(pending_email.recipient_email) then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Email address suppressed (hard bounce)'
            where id = pending_email.queue_id;
            skipped := skipped + 1;
            continue;
        end if;

        -- Skip if user exceeded daily rate limit
        if not internal.check_email_rate_limit(pending_email.user_id) then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Daily email rate limit exceeded'
            where id = pending_email.queue_id;
            skipped := skipped + 1;
            continue;
        end if;

        -- Get document slug
        doc_slug := null;
        if pending_email.channel_id is not null then
            begin
                select slug into doc_slug
                from public.channels
                where id = pending_email.channel_id
                limit 1;
            exception when others then
                null;
            end;
        end if;

        -- Mark as processing
        update public.email_queue
        set status = 'processing',
            attempts = attempts + 1
        where id = pending_email.queue_id;

        -- Enqueue to pgmq for backend consumption
        perform pgmq.send(
            'email_notifications_queue',
            jsonb_build_object(
                'queue_id', pending_email.queue_id::text,
                'to', pending_email.recipient_email,
                'recipient_name', coalesce(pending_email.recipient_name, ''),
                'recipient_id', pending_email.recipient_id::text,
                'sender_name', coalesce(pending_email.sender_name, 'Someone'),
                'sender_id', pending_email.sender_id::text,
                'sender_avatar_url', pending_email.sender_avatar_url,
                'notification_type', pending_email.notification_type,
                'message_preview', coalesce(pending_email.message_preview, ''),
                'channel_id', pending_email.channel_id,
                'document_slug', doc_slug,
                'enqueued_at', now()::text
            )
        );

        enqueued := enqueued + 1;
    end loop;

    return jsonb_build_object(
        'enqueued', enqueued,
        'skipped', skipped,
        'timestamp', now()
    );
end;
$$;

comment on function public.process_email_queue() is
'Moves due immediate emails from email_queue to pgmq for backend consumption. Run via pg_cron.';


-- =============================================================================
-- 5b. Compile Digest Emails → Enqueue to pgmq (pg_cron)
-- =============================================================================
-- Groups pending digest items per user into a single pgmq message.
-- Backend consumer transforms the flat list into Document→Channel→Notification hierarchy.

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
                u.profile_data->'notification_preferences'->>'email_frequency',
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

comment on function public.compile_digest_emails() is
'Compiles pending digest notifications per user into a single pgmq message. Run via pg_cron.';


-- =============================================================================
-- 6. Consumer Helper: Read Email Queue
-- =============================================================================

create or replace function public.consume_email_queue(
    p_batch_size int default 50,
    p_visibility_timeout int default 60
)
returns table (
    msg_id bigint,
    payload jsonb,
    enqueued_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    select
        m.msg_id,
        m.message as payload,
        m.enqueued_at
    from pgmq.read('email_notifications_queue', p_visibility_timeout, p_batch_size) m;
end;
$$;

comment on function public.consume_email_queue(int, int) is
'Reads email messages from pgmq queue. Called by backend consumer.';


-- =============================================================================
-- 7. Consumer Helper: Acknowledge Message
-- =============================================================================

create or replace function public.ack_email_message(p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    return pgmq.delete('email_notifications_queue', p_msg_id);
end;
$$;

comment on function public.ack_email_message(bigint) is
'Acknowledges (deletes) a processed email message from pgmq.';


-- =============================================================================
-- 8. Update Email Queue Status (called by backend after sending)
-- =============================================================================

create or replace function public.update_email_status(
    p_queue_id uuid,
    p_status text,
    p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.email_queue
    set status = p_status,
        sent_at = case when p_status = 'sent' then now() else sent_at end,
        error_message = p_error_message
    where id = p_queue_id;

    return found;
end;
$$;

comment on function public.update_email_status(uuid, text, text) is
'Updates email queue status after processing. Called by backend.';


-- =============================================================================
-- 9. Schedule Email Queue Processing (pg_cron)
-- =============================================================================

do $$
begin
    perform cron.unschedule('process_email_queue')
    where exists (select 1 from cron.job where jobname = 'process_email_queue');

    perform cron.schedule(
        'process_email_queue',
        '*/2 * * * *',  -- Every 2 minutes (immediate emails only)
        'select public.process_email_queue();'
    );
exception when others then
    raise notice 'pg_cron not available, skipping email queue scheduling';
end;
$$;

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


-- =============================================================================
-- 10. Cleanup Functions
-- =============================================================================

create or replace function public.cleanup_email_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.email_queue
    where created_at < now() - interval '30 days'
      and status in ('sent', 'skipped');

    update public.email_queue
    set status = 'failed',
        error_message = coalesce(error_message, '') || ' (max attempts reached)'
    where attempts >= 3
      and status = 'processing';
end;
$$;

do $$
begin
    perform cron.unschedule('cleanup_email_queue')
    where exists (select 1 from cron.job where jobname = 'cleanup_email_queue');

    perform cron.schedule(
        'cleanup_email_queue',
        '0 3 * * *',
        'select public.cleanup_email_queue();'
    );
exception when others then
    raise notice 'pg_cron not available, skipping email cleanup scheduling';
end;
$$;


-- =============================================================================
-- 11. Stats Function
-- =============================================================================

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
            where (profile_data->'notification_preferences'->>'email_enabled')::boolean = true
        )
    );
end;
$$;


-- =============================================================================
-- 12. Unsubscribe Functions (unchanged from v1)
-- =============================================================================

create or replace function internal.get_unsubscribe_secret()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        current_setting('app.unsubscribe_secret', true),
        encode(sha256(coalesce(current_setting('app.settings.service_role_key', true), 'default-dev-secret')::bytea), 'hex')
    );
$$;

create or replace function public.generate_unsubscribe_token(
    p_user_id uuid,
    p_action text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    secret text;
    payload jsonb;
    payload_b64 text;
    signature text;
begin
    if p_action not in ('mentions', 'replies', 'reactions', 'digest', 'all') then
        raise exception 'Invalid unsubscribe action: %', p_action;
    end if;

    secret := internal.get_unsubscribe_secret();
    if secret is null or secret = '' then
        raise exception 'Unsubscribe secret not configured';
    end if;

    payload := jsonb_build_object(
        'uid', p_user_id,
        'act', p_action,
        'exp', extract(epoch from (now() + interval '90 days'))::bigint,
        'iat', extract(epoch from now())::bigint
    );

    payload_b64 := encode(convert_to(payload::text, 'UTF8'), 'base64');
    payload_b64 := replace(replace(replace(payload_b64, '=', ''), '+', '-'), '/', '_');

    signature := encode(hmac(payload_b64::bytea, secret::bytea, 'sha256'), 'base64');
    signature := replace(replace(replace(signature, '=', ''), '+', '-'), '/', '_');

    return payload_b64 || '.' || signature;
end;
$$;

create or replace function internal.verify_unsubscribe_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    secret text;
    parts text[];
    payload_b64 text;
    provided_sig text;
    expected_sig text;
    payload_json text;
    payload jsonb;
    expiry bigint;
begin
    parts := string_to_array(p_token, '.');
    if array_length(parts, 1) != 2 then
        return null;
    end if;

    payload_b64 := parts[1];
    provided_sig := parts[2];

    secret := internal.get_unsubscribe_secret();
    if secret is null or secret = '' then
        return null;
    end if;

    expected_sig := encode(hmac(payload_b64::bytea, secret::bytea, 'sha256'), 'base64');
    expected_sig := replace(replace(replace(expected_sig, '=', ''), '+', '-'), '/', '_');

    if expected_sig != provided_sig then
        return null;
    end if;

    payload_b64 := replace(replace(payload_b64, '-', '+'), '_', '/');
    case length(payload_b64) % 4
        when 2 then payload_b64 := payload_b64 || '==';
        when 3 then payload_b64 := payload_b64 || '=';
        else null;
    end case;

    begin
        payload_json := convert_from(decode(payload_b64, 'base64'), 'UTF8');
        payload := payload_json::jsonb;
    exception when others then
        return null;
    end;

    expiry := (payload->>'exp')::bigint;
    if expiry < extract(epoch from now()) then
        return null;
    end if;

    return payload;
end;
$$;

create or replace function public.process_unsubscribe(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    payload jsonb;
    v_user_id uuid;
    v_action text;
    v_user_email text;
    prefs jsonb;
    new_prefs jsonb;
    action_description text;
begin
    payload := internal.verify_unsubscribe_token(p_token);
    if payload is null then
        return jsonb_build_object(
            'success', false,
            'error', 'invalid_token',
            'message', 'This unsubscribe link is invalid or has expired.'
        );
    end if;

    v_user_id := (payload->>'uid')::uuid;
    v_action := payload->>'act';

    select email, coalesce(profile_data->'notification_preferences', '{}'::jsonb)
    into v_user_email, prefs
    from public.users
    where id = v_user_id;

    if v_user_email is null then
        return jsonb_build_object(
            'success', false,
            'error', 'user_not_found',
            'message', 'User account not found.'
        );
    end if;

    case v_action
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
    set profile_data = jsonb_set(
        coalesce(profile_data, '{}'::jsonb),
        '{notification_preferences}',
        new_prefs
    )
    where id = v_user_id;

    return jsonb_build_object(
        'success', true,
        'action', v_action,
        'action_description', action_description,
        'email', v_user_email,
        'message', 'You have been unsubscribed from ' || action_description || '.',
        'user_id', v_user_id
    );
end;
$$;

create or replace function public.get_unsubscribe_url(
    p_user_id uuid,
    p_action text,
    p_base_url text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    token text;
    base_url text;
begin
    token := public.generate_unsubscribe_token(p_user_id, p_action);
    base_url := coalesce(
        p_base_url,
        current_setting('app.base_url', true),
        'https://docs.plus'
    );
    return base_url || '/unsubscribe?token=' || token;
end;
$$;

create or replace function public.get_email_footer_links(
    p_user_id uuid,
    p_base_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    base_url text;
begin
    base_url := coalesce(
        p_base_url,
        current_setting('app.base_url', true),
        'https://docs.plus'
    );

    return jsonb_build_object(
        'unsubscribe_mentions', public.get_unsubscribe_url(p_user_id, 'mentions', base_url),
        'unsubscribe_replies', public.get_unsubscribe_url(p_user_id, 'replies', base_url),
        'unsubscribe_reactions', public.get_unsubscribe_url(p_user_id, 'reactions', base_url),
        'unsubscribe_digest', public.get_unsubscribe_url(p_user_id, 'digest', base_url),
        'unsubscribe_all', public.get_unsubscribe_url(p_user_id, 'all', base_url),
        'preferences', base_url || '/settings/notifications'
    );
end;
$$;


-- =============================================================================
-- 13. Drop Deprecated Functions
-- =============================================================================

drop function if exists internal.get_email_gateway_config() cascade;
drop function if exists internal.http_post_signed(text, jsonb, jsonb, text) cascade;

