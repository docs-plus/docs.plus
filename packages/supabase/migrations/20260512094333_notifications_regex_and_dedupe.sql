-- Notification trigger fixes. Mirrors packages/supabase/scripts/10-func-notifications.sql.
--
-- 1. `@everyone` and `@username` now match by word boundary instead of
--    raw substring, so `@everyone_team` does not fan out to the channel
--    and `@al` does not notify `alice`/`alpha`/`walter`.
-- 2. create_regular_message_notifications no longer emits a duplicate
--    'reply' row — that path is owned exclusively by create_reply_notification.

-- =====================================================================
-- 1a. Tokenised @username match in the mention fan-out
-- =====================================================================

create or replace function create_mention_notifications()
returns trigger as $$
declare
    mentioned_user_id uuid;
    is_channel_muted boolean;
    truncated_content text;
begin
    select mute_in_app_notifications
      into is_channel_muted
      from public.channels
     where id = new.channel_id;

    if not found or is_channel_muted then
        return new;
    end if;

    if not exists (
        select 1 from public.users where id = new.user_id
    ) then
        return new;
    end if;

    truncated_content := truncate_content(new.content);

    for mentioned_user_id in
        select u.id
          from public.users u
         where new.content ~ ('(^|[^a-z0-9_-])@' || u.username || '($|[^a-z0-9_-])')
    loop
        if exists (
            select 1
              from public.channel_members
             where channel_id = new.channel_id
               and member_id  = mentioned_user_id
               and mute_in_app_notifications = false
               and notif_state != 'MUTED'
        ) then
            insert into public.notifications (
                receiver_user_id, sender_user_id, type, message_id,
                channel_id, message_preview, created_at
            ) values (
                mentioned_user_id, new.user_id, 'mention', new.id,
                new.channel_id, truncated_content, timezone('utc', now())
            );
        end if;
    end loop;

    return new;
end;
$$ language plpgsql;

alter function public.create_mention_notifications() set search_path = public;
alter function public.create_mention_notifications() security definer;


-- =====================================================================
-- 1b. Tokenised @everyone match in the everyone fan-out
-- =====================================================================

create or replace function create_everyone_notifications()
returns trigger as $$
declare
    channel_member_id uuid;
    is_channel_muted boolean;
    truncated_content text;
begin
    select mute_in_app_notifications
      into is_channel_muted
      from public.channels
     where id = new.channel_id;

    if not found or is_channel_muted then
        return new;
    end if;

    if not exists (
        select 1 from public.users where id = new.user_id
    ) then
        return new;
    end if;

    truncated_content := truncate_content(new.content);

    if new.content ~ '(^|[^a-z0-9_-])@everyone($|[^a-z0-9_-])' then
        for channel_member_id in
            select cm.member_id
              from public.channel_members cm
             where cm.channel_id = new.channel_id
               and cm.member_id != new.user_id
               and cm.mute_in_app_notifications = false
               and cm.notif_state != 'MUTED'
        loop
            insert into public.notifications (
                receiver_user_id, sender_user_id, type, message_id,
                channel_id, message_preview, created_at
            ) values (
                channel_member_id, new.user_id, 'channel_event', new.id,
                new.channel_id, truncated_content, timezone('utc', now())
            );
        end loop;
    end if;

    return new;
end;
$$ language plpgsql;

alter function public.create_everyone_notifications() set search_path = public;
alter function public.create_everyone_notifications() security definer;

drop trigger if exists create_everyone_notifications on public.messages;
create trigger create_everyone_notifications
after insert on public.messages
for each row
when (new.content ~ '(^|[^a-z0-9_-])@everyone($|[^a-z0-9_-])')
execute function create_everyone_notifications();


-- =====================================================================
-- 2. Drop duplicate 'reply' rows from regular-message fan-out
-- =====================================================================

create or replace function create_regular_message_notifications()
returns trigger as $$
declare
    is_channel_muted boolean;
    truncated_content text;
begin
    select mute_in_app_notifications
      into is_channel_muted
      from public.channels
     where id = new.channel_id;

    if not found or is_channel_muted then
        return new;
    end if;

    if not exists (
        select 1 from public.users where id = new.user_id
    ) then
        return new;
    end if;

    truncated_content := truncate_content(new.content);

    -- Reply notifications for the original-message author are emitted by
    -- create_reply_notification; do not duplicate the row here.
    insert into public.notifications (
        receiver_user_id, sender_user_id, type, message_id,
        channel_id, message_preview, created_at
    )
    select
        cm.member_id,
        new.user_id,
        'message'::notification_category,
        new.id,
        new.channel_id,
        truncated_content,
        timezone('utc', now())
    from public.channel_members cm
    join public.users u on u.id = cm.member_id
    where cm.channel_id = new.channel_id
      and cm.member_id != new.user_id
      and (u.status is null or u.status != 'ONLINE')
      and cm.mute_in_app_notifications = false
      and cm.notif_state = 'ALL';

    return new;
end;
$$ language plpgsql;

alter function public.create_regular_message_notifications() set search_path = public;
alter function public.create_regular_message_notifications() security definer;
