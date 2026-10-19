-- Issue #497. Skip a queued email when the receiver already read the message in the channel.
-- The read cursor channel_members.last_read_seq has passed the message seq. Bell rows stay as
-- they are. A row with no message_id (content_change) fails the join and sends as before.
-- Pairs with scripts/07-5-email-notifications-pgmq.sql. CREATE OR REPLACE keeps the grants.

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
            n.message_id,
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
        -- Skip if already read: in the bell, or in the channel (the read cursor passed the message)
        -- A reaction row points at the receiver's own message, so the cursor test would always hit.
        if pending_email.readed_at is not null
           or (pending_email.notification_type <> 'reaction' and exists (
               select 1
                 from public.channel_members cm
                 join public.messages m on m.id = pending_email.message_id
                where cm.channel_id = pending_email.channel_id
                  and cm.member_id = pending_email.user_id
                  and cm.last_read_seq >= m.seq
           )) then
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
      and (
          n.readed_at is not null
          or (n.type <> 'reaction' and exists (
              select 1
                from public.channel_members cm
                join public.messages m on m.id = n.message_id
               where cm.channel_id = n.channel_id
                 and cm.member_id = eq.user_id
                 and cm.last_read_seq >= m.seq
          ))
      );

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
                -- The digest places a heading chat by this, not by channel_id (#402).
                'heading_id', c.heading_id,
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
