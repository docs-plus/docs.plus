-- Issue #400. Clients write only the message columns they send. Notice rows (type notification) come only from server writers.
-- A table-level revoke also clears column grants, so the revoke runs first. SELECT stays table-wide, or realtime drops rows.
-- Pairs with scripts/13-RLS.sql.

revoke insert, update on public.messages from authenticated, anon;

grant insert (id, channel_id, user_id, content, html, medias, type, metadata, reply_to_message_id)
  on public.messages to authenticated;

grant update (content, html, medias, type, deleted_at)
  on public.messages to authenticated;

drop policy if exists messages_self_insert on public.messages;
create policy messages_self_insert on public.messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and internal.can_read_channel(channel_id)
    and type is distinct from 'notification'
  );

drop policy if exists messages_self_update on public.messages;
create policy messages_self_update on public.messages
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and type is distinct from 'notification'
  )
  with check (
    user_id = (select auth.uid())
    and type is distinct from 'notification'
  );
