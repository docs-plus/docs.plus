-- FK indexes for the message-edit / soft-delete / reply hot triggers and
-- a reverse-direction channel_members lookup. Mirrors
-- packages/supabase/scripts/11-indexes.sql.

create index if not exists idx_messages_reply_to_message_id
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

create index if not exists idx_messages_origin_message_id
  on public.messages (origin_message_id)
  where origin_message_id is not null;

create index if not exists idx_notifications_message_id
  on public.notifications (message_id);

create index if not exists idx_channel_members_member_id
  on public.channel_members (member_id);
