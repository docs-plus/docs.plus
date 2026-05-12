-- FK indexes for the message-edit / soft-delete / reply hot triggers and
-- a reverse-direction channel_members lookup. Mirrors
-- packages/supabase/scripts/11-indexes.sql.
--
-- Without these every edit, soft-delete, or forward of a message ran a
-- seq scan on `messages` / `notifications` inside an AFTER trigger on the
-- synchronous send path.

create index concurrently if not exists idx_messages_reply_to_message_id
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

create index concurrently if not exists idx_messages_origin_message_id
  on public.messages (origin_message_id)
  where origin_message_id is not null;

create index concurrently if not exists idx_notifications_message_id
  on public.notifications (message_id);

-- Reverse-direction lookup for user-keyed joins (e.g. get_channel_users).
-- The unique (channel_id, member_id) index only serves channel-keyed scans.
create index concurrently if not exists idx_channel_members_member_id
  on public.channel_members (member_id);
