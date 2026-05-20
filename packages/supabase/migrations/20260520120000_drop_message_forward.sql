-- Remove message forwarding: trigger, function, column, and edit-preview propagation.

drop trigger if exists set_forwarded_message_content on public.messages;
drop function if exists public.prepare_forwarded_message();

create or replace function update_message_preview_on_edit()
returns trigger as $$
declare
    truncated_content text;
begin
    truncated_content := truncate_content(new.content);

    update public.notifications
    set message_preview = truncated_content
    where message_id = new.id and readed_at is null;

    update public.messages
    set replied_message_preview = truncated_content
    where reply_to_message_id = new.id;

    if new.channel_id is not null and exists (select 1 from public.channels where id = new.channel_id) then
        update public.channels
        set last_message_preview = truncated_content
        where id = new.channel_id;
    end if;

    return new;
end;
$$ language plpgsql;

comment on function update_message_preview_on_edit() is
'Updates message previews in various tables when a message is edited.';

drop index if exists public.idx_messages_origin_message_id;
alter table public.messages drop column if exists origin_message_id;
