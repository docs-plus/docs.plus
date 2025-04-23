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
-- Optimizes query performance for frequently accessed columns.
create index idx_messages_channel_id on public.messages (channel_id);
create index idx_messages_user_id on public.messages (user_id);
create index idx_messages_updated_at on public.messages (updated_at);
create index idx_messages_type on public.messages (type);
create index idx_thread_id_created_at on public.messages(thread_id, created_at);

-- Composite Index on public.messages
-- Optimizes query performance for filtering by channel_id and sorting by updated_at.
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

-- Filtered index for active messages in channels
-- Optimizes common queries that only retrieve non-deleted messages.
create index idx_messages_channel_id_not_deleted on public.messages (channel_id) where deleted_at is null;

-- Create system user for system messages and notifications
-- This user serves as the sender for automated system notifications and messages.
insert into auth.users (id, email)
values ('992bb85e-78f8-4747-981a-fd63d9317ff1', 'system@system.com')
on conflict (id) do nothing;

comment on table auth.users is 'Auth users table - includes all users with auth accounts including system accounts';
comment on column auth.users.id is 'Unique identifier for the auth user';
comment on column auth.users.email is 'Email address associated with the auth user';
