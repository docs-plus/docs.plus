-- Table: public.messages
-- Description: Stores all messages exchanged in the application. This includes various types of messages like text, image, video, or audio.
-- The table also tracks message status (edited, deleted) and associations (user, channel, replies, and forwardings).
CREATE TABLE public.messages (
    id                     UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Creation timestamp of the message.
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Last update timestamp of the message.
    deleted_at             TIMESTAMP WITH TIME ZONE, -- Timestamp for when the message was marked as deleted.
    edited_at              TIMESTAMP WITH TIME ZONE, -- Timestamp for when the message was edited.
    content                TEXT CHECK (length(content) <= 3000),  -- The actual text content of the message.
    html                   TEXT CHECK (length(html) <= 3000), -- The actual HTML content of the message.
    medias                 JSONB, -- Stores URLs to media (images, videos, etc.) associated with the message.
    user_id                UUID NOT NULL REFERENCES public.users, -- The ID of the user who sent the message.
    channel_id             VARCHAR(36) NOT NULL REFERENCES public.channels ON DELETE SET NULL, -- The ID of the channel where the message was sent.
    reactions              JSONB, -- JSONB field storing user reactions to the message.
    type                   message_type DEFAULT 'text', -- Enumerated type of the message (text, image, video, etc.).
    metadata               JSONB, -- Additional metadata about the message in JSONB format.
    reply_to_message_id    UUID REFERENCES public.messages(id) ON DELETE SET NULL, -- The ID of the message this message is replying to, if any.
    replied_message_preview TEXT, -- Preview text of the message being replied to.
    origin_message_id      UUID REFERENCES public.messages(id) ON DELETE SET NULL, -- ID of the original message if this is a forwarded message.
    thread_id              UUID REFERENCES public.messages(id) ON DELETE SET NULL, -- ID of the thread this message belongs to.
    thread_depth           INT DEFAULT 0, -- Depth of the message in the thread.
    is_thread_root         BOOLEAN DEFAULT false, -- Indicates if the message is the root of a thread.
    thread_owner_id        UUID REFERENCES public.users ON DELETE SET NULL, -- ID of the user who owns/opens the thread.
    readed_at              TIMESTAMP WITH TIME ZONE -- Timestamp for when the message was read by a user.
);

COMMENT ON TABLE public.messages IS 'Contains individual messages sent by users, including their content, type, and associated metadata.';
-- TODO: partition by channel_id and created_at

-- NOTE: write more about the purpose of each column.


-- public.messages.reaction and .medias Jsonb can be look like this:

-- TODO: forwardChain must be split into a separate table
-- const metadata = {
--   "replied": [
--     "68d37413-e405-40e8-aec6-4a741be8982b"
--   ],
--   "is_important": true,
--   "forwarding_chain": [
--     {
--       "user_id": "35477c6b-f9a0-4bad-af0b-545c99b33fae",
--       "username": "philip",
--       "full_name": null
--     },
--     {
--       "user_id": "1059dbd0-3478-46f9-b8a9-dcd23ed0a23a",
--       "username": "emma",
--       "full_name": null
--     }
--   ],
--   "thread": {
--     "count": 0,
--   }
-- }

-- const medias = [
--   {
--     url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
--     type: 'video',
--     description: "Gangnam Style"
--   },
--   {
--     url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
--     type: 'video',
--     description: "Gangnam Style"
--   }
-- ]

-- const reactions = {
--   "👍": [
--     {
--       "user_id": "35477c6b-f9a0-4bad-af0b-545c99b33fae",
--       "created_at": "2023-11-29T18:38:50.60264+00:00"
--     }
--   ],
--   "😄": [
--     {
--       "user_id": "c2e3e9e7-d0e8-4960-9b05-d263deb2722f",
--       "created_at": "2023-11-29T18:38:50.60264+00:00"
--     }
--   ]
-- }
