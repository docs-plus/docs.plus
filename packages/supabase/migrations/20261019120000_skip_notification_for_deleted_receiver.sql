-- Maintainer ruling 2026-10-19. An erased (soft-deleted) account got bell rows; push and
-- email already stopped. The one notification gate now drops a row for that receiver too.
-- The trigger loses its channel_id WHEN, so a channel-less system_alert is gated as well.
-- Pairs with scripts/10-func-notifications.sql. Grants and security mode stay the same.

set local lock_timeout = '5s';

create or replace function internal.skip_unopenable_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if exists (
        select 1
          from public.users u
         where u.id = new.receiver_user_id
           and u.deleted_at is not null
    ) then
        return null;
    end if;
    if exists (
        select 1
          from public.channels c
         where c.id = new.channel_id
           and not internal.can_open_document(c.workspace_id, new.receiver_user_id)
    ) then
        return null;
    end if;
    return new;
end;
$$;

revoke all on function internal.skip_unopenable_notification() from public, anon, authenticated;

drop trigger if exists skip_unopenable_notification on public.notifications;
create trigger skip_unopenable_notification
    before insert on public.notifications
    for each row
    execute function internal.skip_unopenable_notification();
