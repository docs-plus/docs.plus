-- #647: the immediate email payload gains workspace_id (the documentId, from
-- channels.workspace_id, exact case) and message_id, so the server can build the pad link.
-- Every old key stays, document_slug included, for a server that has not deployed yet.
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
    doc_workspace_id varchar(36);
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

        -- Get the channel slug and the documentId (channels.workspace_id, exact case)
        doc_slug := null;
        doc_workspace_id := null;
        if pending_email.channel_id is not null then
            begin
                select slug, workspace_id into doc_slug, doc_workspace_id
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
                'workspace_id', doc_workspace_id,
                'message_id', pending_email.message_id::text,
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
