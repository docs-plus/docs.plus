-- Table: public.channel_members
-- Description: Manages the membership of users within channels. This table tracks which messages each user has read in a channel, 
-- enabling the application to maintain an up-to-date read status. This is crucial for message-based applications where read receipts are important.
CREATE TABLE public.channel_members (
    id                    UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY, -- Unique ID for the channel member record.
    channel_id            UUID NOT NULL REFERENCES public.channels ON DELETE CASCADE, -- The ID of the channel. If the channel is deleted, associated member records are also deleted.
    member_id             UUID NOT NULL REFERENCES public.users ON DELETE CASCADE, -- The ID of the channel member (user). If the user is deleted, their membership records are also deleted.
    last_read_message_id  UUID REFERENCES public.messages, -- The ID of the last message read by the user in the channel. Helps in tracking read status.
    last_read_update_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()), -- Timestamp when the user's last read status was updated.
    joined_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp when the user joined the channel.
    left_at               TIMESTAMP WITH TIME ZONE, -- Timestamp when the user left the channel.
    mute_in_app_notifications BOOLEAN DEFAULT false, -- Indicates if notifications are muted for the channel.
    channel_member_role   channel_member_role DEFAULT 'MEMBER'::public.channel_member_role, -- The role of the user in the channel (e.g., admin, moderator, member).
    unread_message_count  INT DEFAULT 0, -- The number of unread messages for the user in the channel.
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp when the membership record was created.
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) -- Timestamp when the membership record was last updated.
);

COMMENT ON TABLE public.channel_members IS 'Tracks user membership in channels, including the status of the last message read by each user in a specific channel. The created_at and updated_at columns help monitor the history and changes in user-channel relationships.';
