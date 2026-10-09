-- Issue #402. Key heading chat channels by (workspace_id, heading_id), not by a global id.
-- Additive: an old webapp still inserts with `id`, and the fill trigger gives that row heading_id = id.
-- Push it alone, before the code that reads heading_id and before 20261009120000. Every statement can run twice.
-- Pairs with scripts/04-channels.sql, 10-2-func-channels.sql and 07-5-email-notifications-pgmq.sql.

set local lock_timeout = '5s';

alter table public.channels add column if not exists heading_id varchar(36);

-- Every existing row keeps its id, so messages, media paths and old links do not change.
update public.channels set heading_id = id where heading_id is null;

alter table public.channels alter column heading_id set not null;

comment on column public.channels.heading_id is 'Heading toc-id of this chat, or the documentId for the workspace channel. Unique per workspace.';

-- Copied from scripts/10-2-func-channels.sql.
create or replace function public.fill_channel_heading_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.heading_id := coalesce(new.heading_id, new.id);
    return new;
end;
$$;

drop trigger if exists fill_channel_heading_id on public.channels;
create trigger fill_channel_heading_id
before insert on public.channels
for each row
execute function public.fill_channel_heading_id();

-- A duplicate keeps its source's toc-ids and slugs, so neither key may be global.
alter table public.channels drop constraint if exists channels_slug_key;

-- Production may name the global slug key differently, so drop any unique key on slug alone.
do $$
declare
    v_name text;
begin
    for v_name in
        select c.conname from pg_constraint c
         where c.conrelid = 'public.channels'::regclass and c.contype = 'u'
           and c.conkey = array[(select attnum from pg_attribute
                                  where attrelid = 'public.channels'::regclass and attname = 'slug')]
    loop
        execute format('alter table public.channels drop constraint %I', v_name);
    end loop;
    if exists (
        select 1 from pg_index i
         where i.indrelid = 'public.channels'::regclass and i.indisunique
           and i.indkey::int2[] = array[(select attnum from pg_attribute
                                          where attrelid = 'public.channels'::regclass and attname = 'slug')]::int2[]
    ) then
        raise exception 'a global unique index on channels.slug remains; a copied document cannot open its heading chats';
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
         where conrelid = 'public.channels'::regclass and conname = 'channels_workspace_heading_key'
    ) then
        alter table public.channels
            add constraint channels_workspace_heading_key unique (workspace_id, heading_id);
    end if;
    if not exists (
        select 1 from pg_constraint
         where conrelid = 'public.channels'::regclass and conname = 'channels_workspace_slug_key'
    ) then
        alter table public.channels
            add constraint channels_workspace_slug_key unique (workspace_id, slug);
    end if;
end $$;

-- The digest places a heading chat by heading_id. Copied from scripts/07-5-email-notifications-pgmq.sql.
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

revoke execute on function public.compile_digest_emails() from public, anon, authenticated;
grant  execute on function public.compile_digest_emails() to service_role;
