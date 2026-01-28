-- -----------------------------------------------------------------------------
-- Email Notifications Schema
-- -----------------------------------------------------------------------------
-- Email notification system that works alongside push notifications.
-- Supports immediate, daily digest, and fallback email delivery.
--
-- DEPLOYMENT CHECKLIST:
--
-- 1. BACKEND EMAIL GATEWAY (hocuspocus.server):
--    Set these environment variables in your hocuspocus.server:
--    - SMTP_HOST (your SMTP server)
--    - SMTP_PORT (usually 587)
--    - SMTP_USER (your SMTP username)
--    - SMTP_PASS (your SMTP password)
--    - EMAIL_FROM (e.g., "Docs.plus <notifications@yourdomain.com>")
--    - SUPABASE_SERVICE_ROLE_KEY (for status callbacks)
--
-- 2. SET BACKEND URL:
--    Update internal.email_gateway_url() with your backend URL
--
-- The email gateway is a single source of truth for all email operations.
-- Emails are sent via the backend SMTP system, not external APIs.
-- -----------------------------------------------------------------------------

-- 1. Email Queue Table
-- Stores emails pending delivery with scheduling support
create table if not exists public.email_queue (
    id uuid default gen_random_uuid() primary key,
    notification_id uuid references public.notifications(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    email_type text not null check (email_type in ('immediate', 'digest', 'fallback')),
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
    scheduled_for timestamptz not null default now(),
    attempts int default 0 not null,
    sent_at timestamptz,
    error_message text,
    created_at timestamptz default now() not null
);

-- Index for efficient queue processing
create index if not exists idx_email_queue_pending
    on public.email_queue(scheduled_for)
    where status = 'pending';

-- Index for user lookups
create index if not exists idx_email_queue_user
    on public.email_queue(user_id, status);

-- RLS: Users can only view their own email queue (admin can see all via service role)
alter table public.email_queue enable row level security;

drop policy if exists "Users can view own email queue" on public.email_queue;
create policy "Users can view own email queue" on public.email_queue
    for select using (auth.uid() = user_id);

comment on table public.email_queue is 'Queue for email notifications with scheduling support';


-- 2. Helper: Check if user has email enabled
create or replace function internal.is_email_enabled(p_user_id uuid)
returns boolean
language sql
stable
as $$
    select coalesce(
        (profile_data->'notification_preferences'->>'email_enabled')::boolean,
        false
    )
    from public.users
    where id = p_user_id;
$$;

comment on function internal.is_email_enabled(uuid) is 'Checks if user has email notifications enabled';


-- 3. Helper: Get user email preferences
create or replace function internal.get_email_preferences(p_user_id uuid)
returns jsonb
language sql
stable
as $$
    select coalesce(
        profile_data->'notification_preferences',
        '{}'::jsonb
    )
    from public.users
    where id = p_user_id;
$$;


-- 3.5 Helper: Get email gateway configuration
create or replace function internal.get_email_gateway_config()
returns table (
    gateway_url text,
    service_key text
)
language sql
stable
security definer
as $$
    select
        -- Backend email gateway URL (hocuspocus.server)
        -- Use environment variable or default to localhost for dev
        coalesce(
            current_setting('app.email_gateway_url', true),
            'http://localhost:4000/api/email/send'
        ) as gateway_url,
        -- Supabase service role key for authorization
        current_setting('supabase.service_role_key', true) as service_key;
$$;

comment on function internal.get_email_gateway_config() is 'Returns email gateway URL and service key';


-- 4. Queue email for notification
-- Called by the notification trigger to queue emails based on user preferences
create or replace function public.queue_email_notification()
returns trigger
language plpgsql
security definer
as $$
declare
    prefs jsonb;
    email_frequency text;
    should_queue boolean := false;
    queue_type text;
    schedule_time timestamptz;
    user_tz text;
begin
    -- Only process inserts
    if tg_op != 'INSERT' then
        return new;
    end if;

    -- Get user's email preferences
    prefs := internal.get_email_preferences(new.receiver_user_id);

    -- Check if email is enabled
    if not coalesce((prefs->>'email_enabled')::boolean, false) then
        return new;
    end if;

    -- Check if this notification type is enabled for email
    case new.type::text
        when 'mention' then
            should_queue := coalesce((prefs->>'email_mentions')::boolean, true);
        when 'reply' then
            should_queue := coalesce((prefs->>'email_replies')::boolean, true);
        when 'reaction' then
            should_queue := coalesce((prefs->>'email_reactions')::boolean, false); -- Default off for reactions
        else
            should_queue := true; -- Allow other types
    end case;

    if not should_queue then
        return new;
    end if;

    -- Determine email frequency and schedule
    email_frequency := coalesce(prefs->>'email_frequency', 'daily');
    user_tz := coalesce(prefs->>'timezone', 'UTC');

    case email_frequency
        when 'immediate' then
            queue_type := 'immediate';
            -- Wait 15 minutes before sending (give push a chance)
            schedule_time := now() + interval '15 minutes';
        when 'daily' then
            queue_type := 'digest';
            -- Schedule for next 9 AM in user's timezone
            begin
                schedule_time := (
                    date_trunc('day', now() at time zone user_tz) + interval '1 day' + interval '9 hours'
                ) at time zone user_tz;
            exception when others then
                schedule_time := date_trunc('day', now()) + interval '1 day' + interval '9 hours';
            end;
        when 'weekly' then
            queue_type := 'digest';
            -- Schedule for next Monday 9 AM in user's timezone
            begin
                schedule_time := (
                    date_trunc('week', now() at time zone user_tz) + interval '1 week' + interval '9 hours'
                ) at time zone user_tz;
            exception when others then
                schedule_time := date_trunc('week', now()) + interval '1 week' + interval '9 hours';
            end;
        else
            -- 'never' or unknown - don't queue
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

            -- Handle overnight quiet hours
            if quiet_start > quiet_end then
                if now_time >= quiet_start or now_time <= quiet_end then
                    return new; -- Skip during quiet hours
                end if;
            else
                if now_time >= quiet_start and now_time <= quiet_end then
                    return new; -- Skip during quiet hours
                end if;
            end if;
        exception when others then
            null; -- Continue if quiet hours check fails
        end;
    end if;

    -- Queue the email
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

comment on function public.queue_email_notification() is 'Queues email notifications based on user preferences';

-- Trigger: queue email when notification is created
drop trigger if exists trigger_queue_email_notification on public.notifications;
create trigger trigger_queue_email_notification
    after insert on public.notifications
    for each row execute function public.queue_email_notification();


-- 5. Process email queue (called by pg_cron)
-- Sends pending emails that are due via the backend email gateway
create or replace function public.process_email_queue()
returns jsonb
language plpgsql
security definer
as $$
declare
    config record;
    pending_emails record;
    processed int := 0;
    skipped int := 0;
    failed int := 0;
    doc_slug text;
begin
    -- Get email gateway configuration
    select * into config from internal.get_email_gateway_config();
    if config.gateway_url is null then
        return jsonb_build_object('error', 'Email gateway not configured');
    end if;

    -- Process pending emails that are due
    for pending_emails in
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
          and eq.scheduled_for <= now()
          and eq.attempts < 3
        order by eq.scheduled_for
        limit 50 -- Process in batches
    loop
        -- Skip if notification was already read
        if pending_emails.readed_at is not null then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Notification already read'
            where id = pending_emails.queue_id;
            skipped := skipped + 1;
            continue;
        end if;

        -- Try to get document slug from channel if available
        doc_slug := null;
        if pending_emails.channel_id is not null then
            begin
                select slug into doc_slug
                from public.channels
                where id = pending_emails.channel_id
                limit 1;
            exception when others then
                null;
            end;
        end if;

        -- Send email via backend gateway (hocuspocus.server)
        begin
            perform net.http_post(
                url := config.gateway_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || config.service_key
                ),
                body := jsonb_build_object(
                    'queue_id', pending_emails.queue_id::text,
                    'to', pending_emails.recipient_email,
                    'recipient_name', coalesce(pending_emails.recipient_name, ''),
                    'recipient_id', pending_emails.recipient_id::text,
                    'sender_name', coalesce(pending_emails.sender_name, 'Someone'),
                    'sender_id', pending_emails.sender_id::text,
                    'sender_avatar_url', pending_emails.sender_avatar_url,
                    'notification_type', pending_emails.notification_type,
                    'message_preview', coalesce(pending_emails.message_preview, ''),
                    'channel_id', pending_emails.channel_id,
                    'document_slug', doc_slug
                )
            );

            -- Increment attempts (backend will update status on completion)
            update public.email_queue
            set attempts = attempts + 1
            where id = pending_emails.queue_id;

            processed := processed + 1;
        exception when others then
            update public.email_queue
            set attempts = attempts + 1,
                error_message = sqlerrm
            where id = pending_emails.queue_id;
            failed := failed + 1;
        end;
    end loop;

    return jsonb_build_object(
        'processed', processed,
        'skipped', skipped,
        'failed', failed
    );
end;
$$;

comment on function public.process_email_queue() is 'Processes pending email queue, sends due emails';


-- 6. Schedule email queue processing (every 5 minutes)
do $$
begin
    -- Remove old job if exists
    perform cron.unschedule('process_email_queue')
    where exists (select 1 from cron.job where jobname = 'process_email_queue');

    -- Schedule new job
    perform cron.schedule(
        'process_email_queue',
        '*/5 * * * *',
        'select public.process_email_queue();'
    );
exception when others then
    raise notice 'pg_cron not available, skipping email queue scheduling';
end;
$$;


-- 7. Cleanup old processed emails (daily)
create or replace function public.cleanup_email_queue()
returns void
language plpgsql
security definer
as $$
begin
    -- Delete emails older than 30 days that were sent or skipped
    delete from public.email_queue
    where created_at < now() - interval '30 days'
      and status in ('sent', 'skipped');

    -- Mark failed emails with 3+ attempts as permanently failed
    update public.email_queue
    set status = 'failed',
        error_message = coalesce(error_message, '') || ' (max attempts reached)'
    where attempts >= 3
      and status = 'pending';
end;
$$;

-- Schedule cleanup (daily at 3 AM)
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


-- 8. Get email notification stats (for admin/debugging)
create or replace function public.get_email_notification_stats()
returns jsonb
language sql
security definer
stable
as $$
    select jsonb_build_object(
        'total_queued', (select count(*) from public.email_queue),
        'pending', (select count(*) from public.email_queue where status = 'pending'),
        'sent', (select count(*) from public.email_queue where status = 'sent'),
        'skipped', (select count(*) from public.email_queue where status = 'skipped'),
        'failed', (select count(*) from public.email_queue where status = 'failed'),
        'users_with_email_enabled', (
            select count(*)
            from public.users
            where (profile_data->'notification_preferences'->>'email_enabled')::boolean = true
        )
    );
$$;

comment on function public.get_email_notification_stats() is 'Returns email notification system statistics';


-- =============================================================================
-- UNSUBSCRIBE FUNCTIONALITY (Stateless HMAC Tokens)
-- =============================================================================
-- Implements one-click unsubscribe without login using signed tokens.
-- Follows RFC 8058 for List-Unsubscribe-Post support.
--
-- Token format: base64(JSON payload) + "." + hmac_signature
-- No database storage required - tokens are cryptographically verified.
-- =============================================================================

-- 9. Get unsubscribe secret key (from Supabase Vault or settings)
create or replace function internal.get_unsubscribe_secret()
returns text
language sql
stable
security definer
as $$
    -- Use Supabase Vault if available, otherwise fall back to settings
    -- In production, store this in Supabase Vault for better security
    select coalesce(
        current_setting('app.unsubscribe_secret', true),
        -- Fallback: derive from service role key (not ideal but works)
        encode(sha256(coalesce(current_setting('app.settings.service_role_key', true), 'default-dev-secret')::bytea), 'hex')
    );
$$;


-- 10. Generate signed unsubscribe token
-- Returns a token that can be verified without database lookup
create or replace function public.generate_unsubscribe_token(
    p_user_id uuid,
    p_action text  -- 'mentions', 'replies', 'reactions', 'digest', 'all'
)
returns text
language plpgsql
security definer
as $$
declare
    secret text;
    payload jsonb;
    payload_b64 text;
    signature text;
    token text;
begin
    -- Validate action
    if p_action not in ('mentions', 'replies', 'reactions', 'digest', 'all') then
        raise exception 'Invalid unsubscribe action: %', p_action;
    end if;

    -- Get secret
    secret := internal.get_unsubscribe_secret();
    if secret is null or secret = '' then
        raise exception 'Unsubscribe secret not configured';
    end if;

    -- Build payload
    payload := jsonb_build_object(
        'uid', p_user_id,
        'act', p_action,
        'exp', extract(epoch from (now() + interval '90 days'))::bigint,
        'iat', extract(epoch from now())::bigint
    );

    -- Encode payload
    payload_b64 := encode(convert_to(payload::text, 'UTF8'), 'base64');
    -- Remove padding for URL safety
    payload_b64 := replace(replace(replace(payload_b64, '=', ''), '+', '-'), '/', '_');

    -- Generate HMAC signature
    signature := encode(
        hmac(payload_b64::bytea, secret::bytea, 'sha256'),
        'base64'
    );
    -- URL-safe base64
    signature := replace(replace(replace(signature, '=', ''), '+', '-'), '/', '_');

    -- Combine: payload.signature
    token := payload_b64 || '.' || signature;

    return token;
end;
$$;

comment on function public.generate_unsubscribe_token(uuid, text) is 
'Generates a signed unsubscribe token for one-click email unsubscribe. Token is stateless and verified via HMAC.';


-- 11. Verify and decode unsubscribe token
-- Returns the payload if valid, null if invalid or expired
create or replace function internal.verify_unsubscribe_token(p_token text)
returns jsonb
language plpgsql
security definer
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
    -- Split token into payload and signature
    parts := string_to_array(p_token, '.');
    if array_length(parts, 1) != 2 then
        return null;  -- Invalid format
    end if;

    payload_b64 := parts[1];
    provided_sig := parts[2];

    -- Get secret
    secret := internal.get_unsubscribe_secret();
    if secret is null or secret = '' then
        return null;
    end if;

    -- Verify signature
    expected_sig := encode(
        hmac(payload_b64::bytea, secret::bytea, 'sha256'),
        'base64'
    );
    expected_sig := replace(replace(replace(expected_sig, '=', ''), '+', '-'), '/', '_');

    if expected_sig != provided_sig then
        return null;  -- Invalid signature
    end if;

    -- Decode payload (restore standard base64)
    payload_b64 := replace(replace(payload_b64, '-', '+'), '_', '/');
    -- Add padding if needed
    case length(payload_b64) % 4
        when 2 then payload_b64 := payload_b64 || '==';
        when 3 then payload_b64 := payload_b64 || '=';
        else null;
    end case;

    begin
        payload_json := convert_from(decode(payload_b64, 'base64'), 'UTF8');
        payload := payload_json::jsonb;
    exception when others then
        return null;  -- Invalid payload
    end;

    -- Check expiry
    expiry := (payload->>'exp')::bigint;
    if expiry < extract(epoch from now()) then
        return null;  -- Token expired
    end if;

    return payload;
end;
$$;

comment on function internal.verify_unsubscribe_token(text) is 
'Verifies an unsubscribe token and returns the payload if valid, null otherwise.';


-- 12. Process unsubscribe action
-- Called by the API endpoint to actually update user preferences
create or replace function public.process_unsubscribe(p_token text)
returns jsonb
language plpgsql
security definer
as $$
declare
    payload jsonb;
    v_user_id uuid;
    v_action text;
    v_user_email text;
    prefs jsonb;
    new_prefs jsonb;
    update_path text[];
    update_value jsonb;
    action_description text;
begin
    -- Verify token
    payload := internal.verify_unsubscribe_token(p_token);
    if payload is null then
        return jsonb_build_object(
            'success', false,
            'error', 'invalid_token',
            'message', 'This unsubscribe link is invalid or has expired.'
        );
    end if;

    -- Extract user ID and action
    v_user_id := (payload->>'uid')::uuid;
    v_action := payload->>'act';

    -- Get current user and preferences
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

    -- Apply the unsubscribe action
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

    -- Update user preferences
    update public.users
    set profile_data = jsonb_set(
        coalesce(profile_data, '{}'::jsonb),
        '{notification_preferences}',
        new_prefs
    )
    where id = v_user_id;

    -- Return success with details for confirmation page
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

comment on function public.process_unsubscribe(text) is 
'Processes an unsubscribe request using a signed token. Updates user email preferences without requiring authentication.';


-- 13. Generate unsubscribe URL for a user
-- Helper function to build the full unsubscribe URL with token
create or replace function public.get_unsubscribe_url(
    p_user_id uuid,
    p_action text,
    p_base_url text default null
)
returns text
language plpgsql
security definer
as $$
declare
    token text;
    base_url text;
begin
    -- Generate token
    token := public.generate_unsubscribe_token(p_user_id, p_action);

    -- Get base URL
    base_url := coalesce(
        p_base_url,
        current_setting('app.base_url', true),
        'https://docs.plus'
    );

    return base_url || '/unsubscribe?token=' || token;
end;
$$;

comment on function public.get_unsubscribe_url(uuid, text, text) is 
'Generates a full unsubscribe URL with signed token for use in email templates.';


-- 14. Generate all unsubscribe links for email footer
-- Returns a JSON object with all unsubscribe URLs for a user
create or replace function public.get_email_footer_links(
    p_user_id uuid,
    p_base_url text default null
)
returns jsonb
language plpgsql
security definer
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

comment on function public.get_email_footer_links(uuid, text) is 
'Generates all unsubscribe links for email footers. Returns URLs for each notification type plus manage preferences link.';
