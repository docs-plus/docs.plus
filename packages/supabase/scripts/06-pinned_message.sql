-- Table: public.pinned_messages
-- Description: Maintains a record of messages that are pinned in various channels. Pinned messages are typically important or frequently referenced.
CREATE TABLE public.pinned_messages (
    id            UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    channel_id    UUID NOT NULL REFERENCES public.channels ON DELETE CASCADE, -- The ID of the channel in which the message is pinned.
    message_id    UUID NOT NULL REFERENCES public.messages ON DELETE CASCADE, -- The ID of the message that is pinned.
    pinned_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp when the message was pinned.
    pinned_by     UUID NOT NULL REFERENCES public.users, -- The ID of the user who pinned the message.
    content       TEXT NOT NULL, -- The content of the message that is pinned.
    UNIQUE (channel_id, message_id)
);

COMMENT ON TABLE public.pinned_messages IS 'Tracks messages that are pinned in each channel for easy access and reference.';

-- NOTE: write more about the purpose of each column.
