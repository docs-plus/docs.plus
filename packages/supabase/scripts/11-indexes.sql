-- -----------------------------------------------------------------------------
-- Database Indexes and System User Definition
-- -----------------------------------------------------------------------------
-- Description: Creates performance-optimizing indexes on primary application tables
-- and establishes a system user for automation purposes.
-- -----------------------------------------------------------------------------

-- Indexes on public.users Table
-- Optimizes queries filtering or sorting by username.
create index idx_users_username on public.users (username);

-- Indexes on public.messages Table
-- idx_messages_channel_id is covered by the composite (channel_id, created_at desc) below.
create index idx_messages_user_id on public.messages (user_id);
-- idx_messages_type serves m.type = 'notification' filters in get_channel_aggregate_data
-- and pin RPCs (10-functions.sql); keep despite low cardinality.
create index idx_messages_type on public.messages (type);
-- Plain created_at index for message analytics RPCs that filter on created_at only.
create index if not exists idx_messages_created_at on public.messages (created_at);

-- Composite Index on public.messages
create index idx_messages_channel_id_created_at on public.messages (channel_id, created_at desc);

-- Indexes on public.channels Table
-- Optimizes query performance for slug, created_by, and last_activity_at.
create index idx_channels_slug on public.channels (slug);
create index idx_channels_created_by on public.channels (created_by);
create index idx_channels_workspace_id on public.channels (workspace_id);
create index idx_channels_last_activity_at on public.channels (last_activity_at desc);

-- Indexes on public.pinned_messages Table
-- Optimizes query performance for channel_id and message_id.
create unique index idx_pinned_messages_channel_id_message_id on public.pinned_messages (channel_id, message_id);

-- Indexes on public.channel_members Table
-- Optimizes query performance for channel_id and member_id.
create unique index idx_channel_members_channel_id_member_id on public.channel_members (channel_id, member_id);

-- Indexes on public.notifications Table
-- Optimizes query performance for receiver_user_id and created_at.
create index idx_notifications_channel on public.notifications (channel_id);
create index idx_notifications_receiver_user_id on public.notifications (receiver_user_id);
create index idx_notifications_created_at on public.notifications (created_at);
create index idx_notifications_receiver_user_id_created_at on public.notifications (receiver_user_id, created_at desc);
create index idx_notifications_receiver_readed on public.notifications (receiver_user_id, readed_at) where readed_at is null;

-- Indexes on public.workspaces Table
-- Optimizes query performance for created_by.
create index idx_workspaces_slug on public.workspaces (slug);

-- Partial composite for the hot pagination read path under the soft-delete filter.
-- Replaces idx_messages_channel_id_not_deleted (channel_id only) which couldn't serve ORDER BY.
create index idx_messages_channel_id_created_at_active
  on public.messages (channel_id, created_at desc)
  where deleted_at is null;

-- workspace_members lookups by member alone (RLS hot path: is_workspace_member()).
-- The unique constraint covers (workspace_id, member_id); reverse direction needs its own index.
create index idx_workspace_members_member_id on public.workspace_members (member_id);

-- FK indexes on message-edit / soft-delete / reply hot triggers. Without
-- these every edit or soft-delete does a seq scan on messages /
-- notifications inside an AFTER trigger on the synchronous send path.
create index if not exists idx_messages_reply_to_message_id
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

create index if not exists idx_notifications_message_id
  on public.notifications (message_id);

-- channel_members(member_id) — reverse-direction lookup for user-keyed
-- joins (e.g. get_channel_users). The unique (channel_id, member_id) index
-- only serves channel-keyed scans.
create index if not exists idx_channel_members_member_id
  on public.channel_members (member_id);

-- v2 chatroom hot paths: seq-ordered scans and per-member read cursor.
create index if not exists idx_messages_channel_id_seq_desc
  on public.messages (channel_id, seq desc)
  where deleted_at is null;

create index if not exists idx_channel_members_channel_member_lastread
  on public.channel_members (channel_id, member_id, last_read_seq);

-- Create system user for system messages and notifications
-- This user serves as the sender for automated system notifications and messages.
insert into auth.users (id, email)
values ('992bb85e-78f8-4747-981a-fd63d9317ff1', 'system@system.com')
on conflict (id) do nothing;

-- comment on table auth.users is 'Auth users table - includes all users with auth accounts including system accounts';
-- comment on column auth.users.id is 'Unique identifier for the auth user';
-- comment on column auth.users.email is 'Email address associated with the auth user';
