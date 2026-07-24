-- Guard the soft-delete cleanup trigger on the NULL -> NOT NULL transition
-- (matches the sibling counter trigger in 09-message_counter.sql). Without it
-- the DEFINER cleanup body — notification purge, unread decrement, preview
-- rewrites, media GC, delete broadcast — runs on ANY deleted_at write, so a
-- PATCH {deleted_at:null} on the caller's own live message fires the whole body
-- while the message stays visible. Mirrors packages/supabase/scripts/10-3-func-message.sql.
drop trigger if exists message_soft_delete on public.messages;

create trigger message_soft_delete
after update of deleted_at on public.messages
for each row
when (old.deleted_at is null and new.deleted_at is not null)
execute function handle_message_soft_delete();
