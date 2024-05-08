-- Indexes on public.users Table
-- Optimizes queries filtering or sorting by username.
CREATE INDEX idx_users_username ON public.users (username);

-- Indexes on public.messages Table
-- Optimizes query performance for frequently accessed columns.
CREATE INDEX idx_messages_channel_id ON public.messages (channel_id);
CREATE INDEX idx_messages_user_id ON public.messages (user_id);
CREATE INDEX idx_messages_updated_at ON public.messages (updated_at);
CREATE INDEX idx_messages_type ON public.messages (type);
CREATE INDEX idx_thread_id_created_at ON public.messages(thread_id, created_at);

-- Composite Index on public.messages
-- Optimizes query performance for filtering by channel_id and sorting by updated_at.
CREATE INDEX idx_messages_channel_id_updated_at ON public.messages (channel_id, updated_at);

-- Indexes on public.channels Table
-- Optimizes query performance for slug, created_by, and last_activity_at.
CREATE INDEX idx_channels_slug ON public.channels (slug);
CREATE INDEX idx_channels_created_by ON public.channels (created_by);

-- Indexes on public.pinned_messages Table
-- Optimizes query performance for channel_id and message_id.
CREATE INDEX idx_pinned_messages_channel_id ON public.pinned_messages (channel_id);
CREATE INDEX idx_pinned_messages_message_id ON public.pinned_messages (message_id);

-- Indexes on public.channel_members Table
-- Optimizes query performance for channel_id and member_id.
CREATE INDEX idx_channel_members_channel_id ON public.channel_members (channel_id);
CREATE INDEX idx_channel_members_member_id ON public.channel_members (member_id);

-- Indexes on public.notifications Table
-- Optimizes query performance for receiver_user_id and created_at.
CREATE INDEX idx_notifications_receiver_user_id ON public.notifications (receiver_user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at);

-- Indexes on public.workspaces Table
-- Optimizes query performance for created_by.
CREATE INDEX idx_channels_workspace_id ON public.channels (workspace_id);
CREATE INDEX idx_workspaces_slug ON public.workspaces (slug);


-- create a system user for system messages
insert into auth.users (id, email)
values ('992bb85e-78f8-4747-981a-fd63d9317ff1', 'system@system.com');
