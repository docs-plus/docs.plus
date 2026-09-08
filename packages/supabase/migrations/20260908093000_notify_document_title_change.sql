-- Pad title change notice. Recreates three inbox-fan-out trigger WHEN
-- clauses so type = notification never mails or writes public.notifications,
-- then adds public.notify_document_title_change. REST calls the writer with
-- the service-role key after a signed-in rename of DocumentMetadata.title.
--
-- The grant is written here as well as in scripts/10-func-notifications.sql,
-- because remote never runs `db reset` and so never replays that script. The
-- §5 revoke sweep in scripts/29-lint-hardening.sql revokes from public, anon
-- and authenticated only, so a service_role grant needs no §6 whitelist entry.
--
-- Do not recreate the mention / regular / everyone function bodies. Only the
-- WHEN clause changes. Reply and reaction triggers stay as they are.
--
-- Idempotent: drop trigger if exists plus create or replace function, so a
-- re-apply over a partially present state is safe.

drop trigger if exists create_mention_notifications on public.messages;
create trigger create_mention_notifications
after insert on public.messages
for each row
when (new.content like '%@%' and new.type is distinct from 'notification')
execute function create_mention_notifications();

drop trigger if exists create_everyone_notifications on public.messages;
create trigger create_everyone_notifications
after insert on public.messages
for each row
when (new.content ~ '(^|[^a-z0-9_-])@everyone($|[^a-z0-9_-])' and new.type is distinct from 'notification')
execute function create_everyone_notifications();

drop trigger if exists create_regular_message_notifications on public.messages;
create trigger create_regular_message_notifications
after insert on public.messages
for each row
when (new.content !~ '@[A-Za-z0-9_]+|@everyone' and new.type is distinct from 'notification')
execute function create_regular_message_notifications();

create or replace function public.notify_document_title_change(
    p_document_id varchar(36),
    p_actor_id uuid,
    p_title_from text,
    p_title_to text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username text;
begin
    select u.username
      into v_username
      from public.users u
     where u.id = p_actor_id;

    if v_username is null then
        return 0;
    end if;

    -- A document nobody has joined has no workspaces row. Do not mint one.
    if not exists (
        select 1
          from public.workspaces w
         where w.id = p_document_id
           and w.deleted_at is null
    ) then
        return 0;
    end if;

    -- A workspaces row implies a channels row. A miss is a broken document.
    -- Return 0 rather than insert the channel or raise on the messages FK.
    if not exists (
        select 1
          from public.channels c
         where c.id = p_document_id
    ) then
        return 0;
    end if;

    insert into public.messages (
        user_id,
        channel_id,
        type,
        content,
        metadata
    )
    values (
        p_actor_id,
        p_document_id,
        'notification',
        'Document renamed',
        jsonb_build_object(
            'type', 'title_changed',
            'title_from', p_title_from,
            'title_to', p_title_to,
            'user_id', p_actor_id,
            'user_name', v_username
        )
    );

    return 1;
end;
$$;

comment on function public.notify_document_title_change(varchar, uuid, text, text) is
'Service-role only. Inserts one workspace-chat notice after a Pad title rename. Returns 1 when a row was inserted, or 0 when the actor is not in public.users, the document has no live workspaces row, or it has no channels row. Creates neither a workspace nor a channel. content is a short fallback with no @ token and no titles.';

revoke execute on function public.notify_document_title_change(varchar, uuid, text, text)
    from public, anon, authenticated;
grant execute on function public.notify_document_title_change(varchar, uuid, text, text)
    to service_role;
