-- Issue #435. A soft delete clears the text, files and comment quote of a message.
-- Pairs with scripts/10-3-func-message.sql. The backfill at the end is one-shot and stays here only.

-- The AFTER trigger message_soft_delete cannot change NEW, and it still reads OLD.medias for
-- media cleanup. The WHEN clause leaves out OLD, so the backfill below fires this trigger only.
create or replace function public.clear_deleted_message_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.content := null;
    new.html := null;
    new.medias := null;
    -- The jsonb minus operator raises on a scalar, and metadata has no type check.
    new.metadata := case when jsonb_typeof(new.metadata) = 'object' then new.metadata - 'comment' else new.metadata end;
    return new;
end;
$$;

comment on function public.clear_deleted_message_text() is 'Clears the text, files and comment quote of a soft-deleted message.';

drop trigger if exists clear_deleted_message_text on public.messages;
create trigger clear_deleted_message_text
before update of deleted_at on public.messages
for each row
when (new.deleted_at is not null)
execute function public.clear_deleted_message_text();

-- Write deleted_at, never content. A content write fires update_message_previews and
-- overwrites the reply and channel previews. The cleanup triggers check OLD.deleted_at is null.
update public.messages
   set deleted_at = deleted_at
 where deleted_at is not null
   and (content is not null or html is not null or medias is not null
        or (jsonb_typeof(metadata) = 'object' and metadata ? 'comment'));
