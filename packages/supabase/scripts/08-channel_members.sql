-- Table: public.channel_members
-- Description: Manages the membership of users within channels. This table tracks which messages each user has read in a channel,
-- enabling the application to maintain an up-to-date read status. This is crucial for message-based applications where read receipts are important.
create table public.channel_members (
    id                    uuid default uuid_generate_v4() not null primary key, -- Unique ID for the channel member record.
    channel_id            varchar(36) not null references public.channels(id) on delete cascade, -- The ID of the channel. If the channel is deleted, associated member records are also deleted.
    member_id             uuid not null references public.users(id) on delete cascade, -- The ID of the channel member (user). If the user is deleted, their membership records are also deleted.
    last_read_message_id  uuid references public.messages(id) on delete set null, -- The ID of the last message read by the user in the channel. Helps in tracking read status.
    last_read_update_at   timestamp with time zone default timezone('utc', now()), -- Timestamp when the user's last read status was updated.
    joined_at             timestamp with time zone default timezone('utc', now()) not null, -- Timestamp when the user joined the channel.
    left_at               timestamp with time zone, -- Timestamp when the user left the channel.
    mute_in_app_notifications boolean default false, -- Indicates if notifications are muted for the channel.
    notif_state           channel_notification_state default 'MENTIONS'::public.channel_notification_state, -- User's notification preference for this channel
    channel_member_role   channel_member_role default 'MEMBER'::public.channel_member_role, -- The role of the user in the channel (e.g., admin, moderator, member).
    unread_message_count  int default 0, -- The number of unread messages for the user in the channel.
    created_at            timestamp with time zone default timezone('utc', now()) not null, -- Timestamp when the membership record was created.
    updated_at            timestamp with time zone default timezone('utc', now()) -- Timestamp when the membership record was last updated.
);

comment on table public.channel_members is 'Tracks user membership in channels, including the status of the last message read by each user in a specific channel. The created_at and updated_at columns help monitor the history and changes in user-channel relationships.';

-- Column comments for better documentation
comment on column public.channel_members.id is 'Unique identifier for this membership record';
comment on column public.channel_members.channel_id is 'Reference to the channel this membership belongs to';
comment on column public.channel_members.member_id is 'Reference to the user who is a member of the channel';
comment on column public.channel_members.last_read_message_id is 'Reference to the last message the user has read in this channel';
comment on column public.channel_members.last_read_update_at is 'Timestamp when the user last updated their read status';
comment on column public.channel_members.joined_at is 'Timestamp when the user joined this channel';
comment on column public.channel_members.left_at is 'Timestamp when the user left this channel, null if still active';
comment on column public.channel_members.mute_in_app_notifications is 'Whether the user has muted notifications for this channel';
comment on column public.channel_members.notif_state is 'User preference for notification delivery (ALL, MENTIONS, MUTED)';
comment on column public.channel_members.channel_member_role is 'Role of the user in this channel (ADMIN, MODERATOR, MEMBER, GUEST)';
comment on column public.channel_members.unread_message_count is 'Counter of unread messages for this user in this channel';
comment on column public.channel_members.created_at is 'Timestamp when this membership record was created';
comment on column public.channel_members.updated_at is 'Timestamp when this membership record was last updated';
